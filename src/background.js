import * as browser from 'webextension-polyfill';
import browserCapabilities from './utils/feature-detection.js';

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
      // Error classification logic could be added here if needed
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

// Clean up resources when extension is being suspended
browser.runtime.onSuspend.addListener(() => {
  // Stop traffic monitoring
  trafficMonitor.stopMonitoring();
  
  // Clean up tab manager
  tabManager.cleanup();
  
  // Clean up event manager listeners
  eventManager.cleanupAllListeners();
  
  // Clear proxy manager caches if they exist
  // Note: caches are now managed by TrafficMonitor's UnifiedCacheManager
});

// Handle extension updates gracefully
browser.runtime.onUpdateAvailable.addListener(() => {
  // Clean up before update
  trafficMonitor.stopMonitoring();
  tabManager.cleanup();
  eventManager.cleanupAllListeners();
  
  // Reload to apply update
  browser.runtime.reload();
});

// Helper function to handle configuration updates consistently
function handleProxyConfigurationChange() {
  const enabledProxies = proxyManager.enabledProxies;
  const config = proxyManager.config;
  
  // Notify TrafficMonitor of configuration update
  trafficMonitor.handleConfigurationUpdate(config, enabledProxies);
  
  // Notify TabManager of configuration update
  tabManager.handleConfigurationUpdate();
  
  // Broadcast configuration change to all extension tabs
  browser.runtime.sendMessage({
    action: MESSAGE_ACTIONS.CONFIGURATION_UPDATED,
    config: config
  }).catch(() => {
    // Ignore errors if no listeners
  });
}

// Generic proxy update handler
async function handleProxyUpdate(proxyId, updates) {
  try {
    const updatedProxy = await proxyManager.updateProxy(proxyId, updates);
    handleProxyConfigurationChange();
    return { 
      success: true, 
      proxy: updatedProxy,
      enabled: updatedProxy.enabled 
    };
  } catch (error) {
    console.error("Error updating proxy:", error);
    return { 
      success: false, 
      error: error.message || 'Unknown error' 
    };
  }
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
      // Handle configuration change consistently
      handleProxyConfigurationChange();
      
      // Clear and reschedule alarms if needed
      browser.alarms.clear(ALARMS.TAB_CHECK_AFTER_TOGGLE);
      
      return { 
        success: true,
        message: `Configuration saved and state reset successfully`
      };
    });
  },


  [MESSAGE_ACTIONS.TOGGLE_PROXY_STATE]: (message) => {
    if (!message.proxyId) {
      return Promise.resolve({ 
        success: false, 
        error: 'proxyId is required for TOGGLE_PROXY_STATE'
      });
    }
    
    // Use generic handler with enabled state
    const updates = message.enabled !== undefined 
      ? { enabled: message.enabled }
      : { enabled: undefined }; // Will trigger toggle logic in updateProxy
    
    return handleProxyUpdate(message.proxyId, updates);
  },



  [MESSAGE_ACTIONS.GET_TRAFFIC_DATA]: (message) => {
    return Promise.resolve(trafficMonitor.getTrafficData(
        message.windowSize || '1min'));
  },

  [MESSAGE_ACTIONS.GET_TRAFFIC_SOURCES]: async (_message) => {
    const { config = { proxies: [] } } = await browser.storage.local.get('config');
    return Promise.resolve(trafficMonitor.getAllTrafficSources(config.proxies || []));
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

  [MESSAGE_ACTIONS.GET_PROXY_FOR_TAB]: (message, _sender, sendResponse) => {
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

// Browser action click handler removed - legacy functionality

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