import * as browser from 'webextension-polyfill';
import browserCapabilities from './utils/feature-detection.js';
import { ErrorTypes, ErrorSeverity } from './utils/error-helpers.js';

import TabManager from './modules/TabManager.js';
import ProxyManager from './modules/ProxyManager.js';
import PatternMatcher from './modules/PatternMatcher.js';
import TrafficMonitor from './modules/TrafficMonitor.js';
import eventManager from './modules/EventManager.js';

import { MESSAGE_ACTIONS, ALARMS } from './common/constants.js';

const patternMatcher = new PatternMatcher();

// Helper function to detect Firefox
function isFirefox() {
  return typeof browser !== "undefined" &&
         browser.runtime &&
         browser.runtime.getURL && 
         typeof browser.runtime.getURL === 'function' && 
         browser.runtime.getURL('').startsWith('moz-extension://');
}

// Extension icon management functions
function updateExtensionIcon(isDark = false) {
  const title = "ProxyDeck";
  
  let iconPathConfig;
  if (isFirefox()) {
    // Always use light.svg for Firefox as it's theme-aware
    iconPathConfig = 'icons/light.svg';
  } else {
    const theme = isDark ? 'dark' : 'light';
    iconPathConfig = {
      16: `icons/icon16-${theme}.png`,
      48: `icons/icon48-${theme}.png`,
      128: `icons/icon128-${theme}.png`
    };
  }
  browser.action.setIcon({
    path: iconPathConfig
  });
  
  browser.action.setTitle({ title });
}

function initializeExtensionIcon() {
  updateExtensionIcon();
}

const trafficMonitor = new TrafficMonitor({
  patternMatcher: patternMatcher,
  requestThrottleTimeMs: 100,
  maxPendingRequests: 50
});

const proxyManager = new ProxyManager({
  patternMatcher: patternMatcher,
  onError: (error) => {
    console.error("[Proxy] Error:", error);
    
    if (!error || !error.type || !error.severity) {
      const errorMessage = typeof error === 'string' ? error : 
        (error.message || JSON.stringify(error));
        
      let errorType = ErrorTypes.INTERNAL;
      let errorSeverity = ErrorSeverity.ERROR;
      
      if (errorMessage.includes('connection') || errorMessage.includes('network')) {
        errorType = ErrorTypes.NETWORK;
      } else if (errorMessage.includes('proxy') || errorMessage.includes('configuration')) {
        errorType = ErrorTypes.PROXY_CONFIG;
      } else if (errorMessage.includes('permission')) {
        errorType = ErrorTypes.PERMISSION;
        errorSeverity = ErrorSeverity.CRITICAL;
      }
    }
  },
  trafficMonitor: trafficMonitor
});

const tabManager = new TabManager({
  proxyManager: proxyManager,
  patternMatcher: patternMatcher,
  tabUpdateDelay: 150,
  tabUpdateBatchSize: 5
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARMS.TAB_CHECK_AFTER_TOGGLE) {
    tabManager.checkCurrentTabForProxyUsage();
    tabManager.startPeriodicTabChecking();
  }
});

function initializeExtension(startPeriodicChecking = false) {
  proxyManager.loadConfig().then(config => {
    if (!config.proxyEnabled) {
      proxyManager.enable();
    } else {
      trafficMonitor.startMonitoring(config, proxyManager.enabledProxies);
    }
    
    tabManager.refreshAllTabBadges();
    
    if (startPeriodicChecking) {
      tabManager.startPeriodicTabChecking();
    }
  });
}

browser.runtime.onInstalled.addListener(() => {
  initializeExtension();
});

browser.runtime.onStartup.addListener(() => {
  initializeExtension(true);
});

function toggleProxy() {
  return proxyManager.enable().then(() => {
      browser.alarms.clear(ALARMS.TAB_CHECK_AFTER_TOGGLE);
    
    browser.alarms.create(ALARMS.TAB_CHECK_AFTER_TOGGLE, { delayInMinutes: 0.5/60 });
    
    return { success: true };
  });
}

const messageHandlers = {
  [MESSAGE_ACTIONS.GET_CONFIG]: () => {
    return proxyManager.loadConfig().then(config => {
      config.proxyEnabled = true;
      return { config: config };
    });
  },

  [MESSAGE_ACTIONS.SAVE_CONFIG]: (message) => {
    message.config.proxyEnabled = true;
    
    return proxyManager.updateConfig(message.config).then(() => {
      // Directly notify TabManager of configuration update
      tabManager.handleConfigurationUpdate();
      
      // Also broadcast to extension pages (options/popup)
      // Use the updated config from proxyManager which includes recalculated colors
      browser.runtime.sendMessage({
        action: MESSAGE_ACTIONS.CONFIGURATION_UPDATED,
        config: proxyManager.config
      }).catch(() => {
        // Ignore errors if no listeners
      });
      
      return { 
        success: true,
        message: `Configuration saved successfully`
      };
    });
  },

  [MESSAGE_ACTIONS.UPDATE_PROXY_PATTERNS]: (message) => {
    const { proxyId, patterns } = message;
    
    return proxyManager.updateProxyPatterns(proxyId, patterns).then(() => {
      // Get the updated configuration and broadcast it
      return proxyManager.loadConfig().then(config => {
        browser.runtime.sendMessage({
          action: MESSAGE_ACTIONS.CONFIGURATION_UPDATED,
          config: config
        }).catch(() => {
          // Ignore errors if no listeners
        });
        
        return { success: true };
      });
    });
  },

  [MESSAGE_ACTIONS.UPDATE_PROXY_CONTAINERS]: (message) => {
    const { proxyId, containers } = message;
    
    return proxyManager.updateProxyContainers(proxyId, containers).then(() => {
      // Get the updated configuration and broadcast it
      return proxyManager.loadConfig().then(config => {
        browser.runtime.sendMessage({
          action: MESSAGE_ACTIONS.CONFIGURATION_UPDATED,
          config: config
        }).catch(() => {
          // Ignore errors if no listeners
        });
        
        return { success: true };
      });
    });
  },

  [MESSAGE_ACTIONS.UPDATE_PROXY_ROUTING_MODE]: (message) => {
    const { proxyId, useContainerMode } = message;
    
    return proxyManager.updateProxy(proxyId, {
      routingConfig: {
        useContainerMode: useContainerMode
      }
    }).then(() => {
      // Get the updated configuration and broadcast it
      return proxyManager.loadConfig().then(config => {
        browser.runtime.sendMessage({
          action: MESSAGE_ACTIONS.CONFIGURATION_UPDATED,
          config: config
        }).catch(() => {
          // Ignore errors if no listeners
        });
        
        return { success: true };
      });
    });
  },

  [MESSAGE_ACTIONS.TOGGLE_PROXY_STATE]: (message) => {
    if (message.proxyId) {
      return proxyManager.loadConfig()
        .then(config => {
          const proxyExists = config.proxies.some(p => p.id === message.proxyId);
          
          if (!proxyExists) {
            throw new Error(`Proxy with ID ${message.proxyId} not found`);
          }
          
          if (message.enabled !== undefined) {
            return proxyManager.updateProxy(message.proxyId, {
              enabled: message.enabled
            });
          } else {
            return proxyManager.toggleProxy(message.proxyId);
          }
        })
        .then(updatedProxy => {
          // Get the updated configuration
          return proxyManager.loadConfig().then(config => {
            // Broadcast configuration change to all extension tabs
            browser.runtime.sendMessage({
              action: MESSAGE_ACTIONS.CONFIGURATION_UPDATED,
              config: config
            }).catch(() => {
              // Ignore errors if no listeners
            });
            
            return {
              success: true,
              enabled: updatedProxy.enabled,
              proxy: updatedProxy
            };
          });
        })
        .catch(error => {
          console.error("Error in toggleProxyState handler:", error);
          return { 
            success: false, 
            error: `Failed to toggle proxy: ${error.message || 'Unknown error'}` 
          };
        });
    } else {
      return toggleProxy().then(() => {
        return { 
          success: true, 
          proxyEnabled: true,
          message: 'Legacy call: Proxy system enabled (note: no specific proxy was toggled)'
        };
      });
    }
  },



  [MESSAGE_ACTIONS.GET_TRAFFIC_DATA]: (message) => {
    return Promise.resolve(trafficMonitor.getTrafficData(
        message.windowSize || '1min'));
  },

  [MESSAGE_ACTIONS.GET_TRAFFIC_SOURCES]: async (message) => {
    const { config = { proxies: [] } } = await browser.storage.local.get('config');
    return Promise.resolve(trafficMonitor.getAllTrafficSources(config.proxies || []));
  },


  [MESSAGE_ACTIONS.PING]: () => {
    return Promise.resolve({ pong: true, timestamp: Date.now() });
  },

  [MESSAGE_ACTIONS.UPDATE_ICON_THEME]: async (message) => {
    // Update icon theme (Chrome only)
    if (!browserCapabilities.isFirefox) {
      updateExtensionIcon(message.isDark);
      
      // Save theme preference to storage
      try {
        await browser.storage.local.set({
          iconTheme: {
            isDark: message.isDark,
            lastUpdated: Date.now()
          }
        });
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    }
    
    return Promise.resolve({ success: true });
  },

  [MESSAGE_ACTIONS.TOGGLE_PROXY]: () => {
    return toggleProxy().then(() => {
      return { 
        success: true, 
        proxyEnabled: true,
        message: 'Proxy system enabled and tab checking scheduled'
      };
    });
  },

  [MESSAGE_ACTIONS.GET_PROXY_FOR_TAB]: (message, sender, sendResponse) => {
    const { tabId, url } = message;

    if (!url) {
      const response = { success: false, error: "No URL provided" };
      sendResponse(response);
    } else {
      try {
        proxyManager.getProxyForTab(tabId, url, {
          includeAllMatches: message.includeAllMatches
        })
        .then(response => {
          // For backward compatibility when proxies are found
          if (response.success && response.proxyInfo) {
            // Make sure the proxy is accessible as 'proxy' for legacy code
            response.proxy = response.proxyInfo;
          }
          sendResponse(response);
        })
        .catch(error => {
          console.error('BG: GET_PROXY_FOR_TAB: Error getting proxy for tab:', error);
          sendResponse({ 
            success: false, 
            error: `Error getting proxy for tab: ${error.message || String(error)}` 
          });
        });
      } catch (e) {
        console.error('BG: GET_PROXY_FOR_TAB: Unexpected synchronous error:', e);
        sendResponse({ 
          success: false, 
          error: `Unexpected error processing request: ${e.message || String(e)}` 
        });
      }
    }
    return true;
  },

  [MESSAGE_ACTIONS.GET_MATCHING_PROXIES]: async (message) => {
    const { url, cookieStoreId } = message;
    
    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Get all proxies from storage
      const config = await proxyManager.loadConfig();
      const proxies = config.proxies || [];
      
      // Filter to only enabled proxies
      const enabledProxies = proxies.filter(proxy => proxy.enabled);
      
      // Find proxies that match the URL
      const matchingProxies = [];
      
      for (const proxy of enabledProxies) {
        // For container-based routing
        if (proxy.routingConfig.useContainerMode) {
          // If URL is in a container, check if proxy handles this container
          if (cookieStoreId && 
              proxy.routingConfig.containers && 
              proxy.routingConfig.containers.includes(cookieStoreId)) {
            matchingProxies.push(proxy);
          }
        } 
        // For pattern-based routing
        else if (proxy.routingConfig.patterns && proxy.routingConfig.patterns.length > 0) {
          // Check if any pattern matches the URL
          const matches = patternMatcher.matchesAnyPattern(hostname, proxy.routingConfig.patterns);
          
          if (matches) {
            matchingProxies.push(proxy);
          }
        }
      }
      
      // Sort by priority (lower number = higher priority)
      matchingProxies.sort((a, b) => a.priority - b.priority);
      
      return {
        success: true,
        matchingProxies: matchingProxies
      };
    } catch (error) {
      console.error('Error in GET_MATCHING_PROXIES handler:', error);
      return { success: false, error: error.message };
    }
  },
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'errorOccurred' && message.error) {
    browser.runtime.sendMessage({
      action: 'showError',
      error: message.error
    }).catch(() => {
      // Ignore if no listeners
    });
    
    return Promise.resolve({ received: true });
  }
  
  if (message.action === 'getErrorHistory') {
    return Promise.resolve({ success: true, history: [] });
  }
  
  const handler = messageHandlers[message.action];
  
  if (handler) {
    return handler(message, sender, sendResponse);
  }
  
  return Promise.resolve({ error: "Unhandled action" });
});

browser.action.onClicked.addListener(toggleProxy);

(async function initializeState() {
  // Initialize icon first
  initializeExtensionIcon();
  
  // Load saved theme and apply it (Chrome only)
  if (!browserCapabilities.isFirefox) {
    try {
      const savedTheme = await browser.storage.local.get('iconTheme');
      if (savedTheme.iconTheme && savedTheme.iconTheme.isDark !== undefined) {
        updateExtensionIcon(savedTheme.iconTheme.isDark);
      }
    } catch (error) {
      console.error('Failed to load saved theme:', error);
    }
  }
  
  proxyManager.loadConfig().then(config => {
    if (config.proxyEnabled) {
      proxyManager.applyProxySettings();
      trafficMonitor.startMonitoring(config, proxyManager.enabledProxies);
      
      browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (tabs && tabs.length > 0) {
          tabManager.handleTabActivated({ tabId: tabs[0].id });
          tabManager.startPeriodicTabChecking();
        }
      });
    }
  });
})();