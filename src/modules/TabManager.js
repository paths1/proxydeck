import * as browser from 'webextension-polyfill';
import eventManager from './EventManager.js';
import { MESSAGE_ACTIONS } from '../common/constants.js';

/**
 * TabManager handles browser tab tracking and proxy status for each tab
 * Manages tab-specific proxy badges and tracks which proxy is used per tab
 */
class TabManager {
  constructor(options = {}) {
    this.currentTabId = null;
    this.currentTabUrl = null;
    this.tabProxyMap = new Map();
    this.tabUpdateQueue = new Map();
    this.pendingTabUpdates = false;
    
    this.tabUpdateDelay = options.tabUpdateDelay || 150;
    this.tabUpdateBatchSize = options.tabUpdateBatchSize || 5;
    
    this.proxyManager = options.proxyManager;
    this.patternMatcher = options.patternMatcher;
    
    this.ALARM_PERIODIC_CHECK = 'periodicCheck';
    this.ALARM_PROCESS_TAB_UPDATES = 'processTabUpdates';
    
    this.setupTabEventListeners();
    this.boundHandleAlarm = (alarm) => {
      if (alarm.name === this.ALARM_PERIODIC_CHECK) {
        this.handlePeriodicCheck();
      } else if (alarm.name === this.ALARM_PROCESS_TAB_UPDATES) {
        this.processTabUpdateQueue();
      }
    };
    
    eventManager.addEventListener(
      'alarm',
      'tab_manager_alarms',
      browser.alarms,
      'onAlarm',
      this.boundHandleAlarm
    );
    
    this.setupConfigurationListener();
  }
  
  setupConfigurationListener() {
    this.boundHandleConfigUpdate = (message) => {
      if (message.action === MESSAGE_ACTIONS.CONFIGURATION_UPDATED) {
        this.refreshAllTabBadges();
      }
    };
    
    browser.runtime.onMessage.addListener(this.boundHandleConfigUpdate);
  }
  
  handleConfigurationUpdate() {
    this.refreshAllTabBadges();
  }
  
  setupTabEventListeners() {
    this.boundHandleTabActivated = this.handleTabActivated.bind(this);
    this.boundHandleTabUpdated = this.handleTabUpdated.bind(this);
    
    eventManager.addEventListener(
      'tab',
      'tab_activated',
      browser.tabs,
      'onActivated',
      this.boundHandleTabActivated
    );
    
    eventManager.addEventListener(
      'tab',
      'tab_updated',
      browser.tabs,
      'onUpdated',
      this.boundHandleTabUpdated
    );
  }
  
  handleTabActivated(activeInfo) {
    this.currentTabId = activeInfo.tabId;
    
    browser.tabs.get(this.currentTabId).then(tab => {
      this.currentTabUrl = tab.url;
      
      this.queueTabUpdate(this.currentTabId, this.currentTabUrl, true);
    }).catch(error => {
      if (!error.message?.includes("Invalid tab ID")) {
        console.error("[Tab Tracking] Error getting tab info:", error);
      }
      this.currentTabUrl = null;
    });
  }
  
  handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.url || ((changeInfo.status === 'complete' || changeInfo.status === 'loading') && tab && tab.url)) {
      const urlToCheck = changeInfo.url || tab.url;
      if (tabId === this.currentTabId) {
        this.currentTabUrl = urlToCheck;
      }
      this.queueTabUpdate(tabId, urlToCheck, tabId === this.currentTabId);
    }
  }
  
  queueTabUpdate(tabId, url, isActive) {
    if (!tabId || !url) return;
    
    this.tabUpdateQueue.set(tabId, {
      tabId,
      url,
      isActive,
      timestamp: Date.now()
    });
    
    if (!this.pendingTabUpdates) {
      this.pendingTabUpdates = true;
      
      browser.alarms.create(
        this.ALARM_PROCESS_TAB_UPDATES, 
        { delayInMinutes: this.tabUpdateDelay / 60000 }
      );
    }
  }
  
  // Process queued tab updates in batch
  processTabUpdateQueue() {
    if (this.tabUpdateQueue.size === 0) {
      this.pendingTabUpdates = false;
      return;
    }
    
    const entries = Array.from(this.tabUpdateQueue.values())
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const activeEntries = entries.filter(entry => entry.isActive);
    const nonActiveEntries = entries.filter(entry => !entry.isActive);
    
    const toProcess = [
      ...activeEntries,
      ...nonActiveEntries
    ].slice(0, this.tabUpdateBatchSize);
    
    // Process each entry
    for (const entry of toProcess) {
      // Remove from the queue
      this.tabUpdateQueue.delete(entry.tabId);
      // Process the update - only check proxy usage, icon update happens in callback
      Promise.resolve().then(async () => {
        try {
          await this.checkTabProxyUsage(entry.tabId, entry.url);
        } catch (error) {
          if (!error.message?.includes("No tab with id")) {
            console.error(`[TabManager] Error processing tab update for tab ${entry.tabId}:`, error);
          }
        }
      });
    }
    
    if (this.tabUpdateQueue.size > 0) {
      browser.alarms.create(
        this.ALARM_PROCESS_TAB_UPDATES, 
        { delayInMinutes: this.tabUpdateDelay / 60000 }
      );
    } else {
      this.pendingTabUpdates = false;
    }
  }
  
  
  async checkTabProxyUsage(tabId, url) {
    if (!url || url.startsWith('about:') || url.startsWith('chrome:')) {
      // Clear badge for non-HTTP URLs or browser internal pages
      await this.clearTabBadge(tabId);
      this.tabProxyMap.delete(tabId);
      return;
    }
    
    this.proxyManager.checkTabProxyUsage(tabId, url, {
      onProxyMatch: async (proxy, matchType) => {
        this.tabProxyMap.set(tabId, {
          id: proxy.id,
          name: proxy.name,
          priority: proxy.priority,
          color: proxy.color,
          matchType: matchType
        });
        
        await this.updateTabProxyBadge(tabId);
      },
      
      onNoMatch: async () => {
        this.tabProxyMap.delete(tabId);
        await this.clearTabBadge(tabId);
      }
    }).catch(async error => {
      console.error("Error in checkTabProxyUsage:", error);
      
      // Handle error cases similar to no match
      this.tabProxyMap.delete(tabId);
      await this.clearTabBadge(tabId);
    });
  }
  
  // Check if the current tab would use proxy based on its URL
  checkCurrentTabForProxyUsage() {
    // Don't check browser internal pages for proxy usage
    if (!this.currentTabUrl || this.currentTabUrl.startsWith('about:') || this.currentTabUrl.startsWith('chrome:')) {
      // Clear badge for the tab
      if (this.currentTabId) {
        this.clearTabBadge(this.currentTabId);
      }
      return Promise.resolve(false);
    }
    
    // If this tab has a proxy mapping, it's already using a proxy
    if (this.tabProxyMap.has(this.currentTabId)) {
      return Promise.resolve(true);
    }
    
    // Otherwise check if it should be using a proxy using the centralized method
    return this.proxyManager.getProxyForTab(this.currentTabId, this.currentTabUrl)
      .then(result => {
        if (result.success && result.proxyInfo) {
          // Store the mapping for future reference
          this.tabProxyMap.set(this.currentTabId, {
            id: result.proxyInfo.id,
            name: result.proxyInfo.name,
            priority: result.proxyInfo.priority,
            color: result.proxyInfo.color,
            matchType: result.matchType
          });
          
          return true;
        }
        
        return false;
      })
      .catch(error => {
        console.error(`[Tab Tracking] Error in checkCurrentTabForProxyUsage:`, error);
        return false;
      });
  }
  
  // Handler for periodic check alarm
  handlePeriodicCheck() {
    if (this.currentTabId && this.currentTabUrl) {
      // Queue the update instead of processing immediately
      this.queueTabUpdate(this.currentTabId, this.currentTabUrl, true);
    }
  }
  
  // Initialize periodic checking for the active tab
  startPeriodicTabChecking() {
    // Stop any existing alarm first
    this.stopPeriodicTabChecking();
    
    // Check every 8 seconds if we're still on a proxy-enabled page
    // This is less frequent than before to reduce overhead
    browser.alarms.create(this.ALARM_PERIODIC_CHECK, { periodInMinutes: 8/60 });
  }
  
  // Stop periodic checking
  stopPeriodicTabChecking() {
    browser.alarms.clear(this.ALARM_PERIODIC_CHECK);
    
    // Also clear tab update alarm
    browser.alarms.clear(this.ALARM_PROCESS_TAB_UPDATES);
    this.pendingTabUpdates = false;
  }
  
  // Clean up all event listeners (called when TabManager is no longer needed)
  cleanup() {
    // Remove event listeners through the event manager
    eventManager.removeEventListener('tab', 'tab_activated');
    eventManager.removeEventListener('tab', 'tab_updated');
    eventManager.removeEventListener('alarm', 'tab_manager_alarms');
    
    // Remove configuration listener
    if (this.boundHandleConfigUpdate) {
      browser.runtime.onMessage.removeListener(this.boundHandleConfigUpdate);
    }
    
    // Clear alarms
    this.stopPeriodicTabChecking();
    
    // Clear state
    this.tabUpdateQueue.clear();
    this.tabProxyMap.clear();
  }
  
  async refreshAllTabBadges() {
    this.tabProxyMap.clear();
    
    try {
      const tabs = await browser.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.url && tab.url.startsWith('http')) {
          await this.checkTabProxyUsage(tab.id, tab.url);
        }
      }
    } catch (error) {
      console.error('[TabManager] Error refreshing all tab badges:', error);
    }
  }
  
  // Update the proxy badge for a specific tab
  async updateTabProxyBadge(tabId) {
    if (!tabId || !this.tabProxyMap.has(tabId)) {
      return;
    }
    
    const proxyInfo = this.tabProxyMap.get(tabId);
    const badgeText = ` ${proxyInfo.name.charAt(0).toUpperCase()} `;
    
    try {
      await browser.action.setBadgeText({ tabId, text: badgeText });
      
      if (proxyInfo.color) {
        await browser.action.setBadgeBackgroundColor({ 
          tabId, 
          color: proxyInfo.color 
        });
      }
    } catch (error) {
      // Tab closed, clean up
      this.tabProxyMap.delete(tabId);
    }
  }
  
  // Clear badge for a specific tab
  async clearTabBadge(tabId) {
    if (!tabId) return;
    
    try {
      await browser.action.setBadgeText({ tabId, text: "" });
    } catch (error) {
      // Ignore errors for closed tabs
    }
  }
  
  
  // Get the current tab ID
  getCurrentTabId() {
    return this.currentTabId;
  }
  
  // Get the current tab URL
  getCurrentTabUrl() {
    return this.currentTabUrl;
  }
  
}

export default TabManager;