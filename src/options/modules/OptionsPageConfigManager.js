import * as browser from 'webextension-polyfill';
import { createProxyConfig } from '../../utils.js';
import { MESSAGE_ACTIONS } from '../../common/constants.js';
import browserCapabilities from '../../utils/feature-detection.js';

/**
 * Manages the overall configuration state for the options page
 * Handles loading, saving, and CRUD operations on proxy configurations
 */
export class OptionsPageConfigManager {
  constructor() {
    this.currentConfig = {
      proxies: [],
      version: 2
    };
    this.selectedProxyId = null;
    this.draftProxy = null;
    
    // ConfigSaver instance for debounced saving
    this.configSaver = new ConfigSaver();
  }
  
  /**
   * Load configuration from browser storage
   * @returns {Promise<Object>} The loaded configuration
   */
  async loadConfiguration() {
    try {
      const result = await browser.storage.local.get("config");
      if (result.config) {
        this.currentConfig = result.config;
      } else {
        // Initialize with default config
        this.currentConfig = {
          proxies: [],
          version: 2
        };
        
        // Initialize empty proxy array if needed
        if (!this.currentConfig.proxies || !Array.isArray(this.currentConfig.proxies)) {
          this.currentConfig.proxies = [];
        }
      }
      
      // Migrate old proxy structures if necessary
      if (this.currentConfig.proxies && this.currentConfig.proxies.length > 0) {
        this.currentConfig.proxies.forEach(proxy => {
          // Colors are now managed by ProxyManager in the background
          
          if (Object.prototype.hasOwnProperty.call(proxy, 'username') || Object.prototype.hasOwnProperty.call(proxy, 'password')) {
            // Only migrate auth fields for Firefox
            if (browserCapabilities.browser.isFirefox) {
              proxy.auth = {
                username: proxy.username || '',
                password: proxy.password || ''
              };
            }
            delete proxy.username;
            delete proxy.password;
          } else if (!Object.prototype.hasOwnProperty.call(proxy, 'auth') && browserCapabilities.browser.isFirefox) {
            // Only ensure auth object exists for Firefox
            proxy.auth = { username: '', password: '' };
          }
        });
      }
      
      // Select first proxy by priority if none selected
      if (this.currentConfig.proxies.length > 0) {
        const sortedProxies = [...this.currentConfig.proxies].sort((a, b) => a.priority - b.priority);
        this.selectedProxyId = sortedProxies[0].id;
      }
      
      return this.currentConfig;
    } catch (err) {
      console.error("Error loading configuration:", err);
      
      // Fallback to empty config
      this.currentConfig = {
        proxies: [],
        version: 2
      };
      
      return this.currentConfig;
    }
  }
  
  /**
   * Save configuration to browser storage
   * @param {Function} callback - Callback to execute after save
   * @param {boolean} immediate - Whether to save immediately or debounce
   */
  saveConfiguration(callback, immediate = false) {
    // Colors are managed by ProxyManager in the background
    
    if (immediate) {
      this.configSaver.forceSave(this.currentConfig, callback);
    } else {
      this.configSaver.debouncedSave(this.currentConfig, callback);
    }
  }
  
  /**
   * Select a proxy by ID
   * @param {string} proxyId - The proxy ID to select
   * @returns {Object|null} The selected proxy data
   */
  selectProxy(proxyId) {
    this.selectedProxyId = proxyId;
    const proxy = this.currentConfig.proxies.find(p => p.id === proxyId);
    
    if (!proxy) {
      this.draftProxy = null;
      return null;
    }
    
    // Create draft copy of the proxy
    this.draftProxy = { ...proxy };
    if (proxy.routingConfig) {
      this.draftProxy.routingConfig = { ...proxy.routingConfig };
      if (proxy.routingConfig.patterns) {
        this.draftProxy.routingConfig.patterns = [...proxy.routingConfig.patterns];
      }
      if (proxy.routingConfig.containers) {
        this.draftProxy.routingConfig.containers = [...proxy.routingConfig.containers];
      }
    }
    
    // Store original values for change detection
    this.draftProxy._originalEnabled = proxy.enabled;
    if (proxy.routingConfig) {
      this.draftProxy._originalRoutingMode = proxy.routingConfig.useContainerMode || false;
      if (proxy.routingConfig.patterns) {
        this.draftProxy._originalPatterns = [...proxy.routingConfig.patterns];
      }
      if (proxy.routingConfig.containers) {
        this.draftProxy._originalContainers = [...proxy.routingConfig.containers];
      }
    }
    
    return this.draftProxy;
  }
  
  /**
   * Get current draft proxy
   * @returns {Object|null} The current draft proxy
   */
  getCurrentDraftProxy() {
    return this.draftProxy;
  }
  
  /**
   * Update a field in the draft proxy
   * @param {string} field - Field name to update
   * @param {any} value - New value for the field
   */
  updateDraftProxyField(field, value) {
    if (!this.draftProxy) return;
    
    if (field.includes('.')) {
      // Handle nested fields like 'routingConfig.patterns'
      const parts = field.split('.');
      let target = this.draftProxy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) {
          target[parts[i]] = {};
        }
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
    } else {
      this.draftProxy[field] = value;
    }
  }
  
  /**
   * Commit draft proxy changes to current config
   * @returns {boolean} Success status
   */
  commitDraftToCurrentConfig() {
    if (!this.draftProxy) return false;
    
    const index = this.currentConfig.proxies.findIndex(p => p.id === this.draftProxy.id);
    if (index === -1) return false;
    
    this.currentConfig.proxies[index] = { ...this.draftProxy };
    return true;
  }
  
  /**
   * Revert draft proxy to original state
   * @returns {Object|null} The reverted draft proxy
   */
  revertDraftFromCurrentConfig() {
    if (!this.selectedProxyId) return null;
    return this.selectProxy(this.selectedProxyId);
  }
  
  /**
   * Add a new proxy to the configuration
   * @param {string} name - Name for the new proxy
   * @returns {Object} The newly created proxy
   */
  addNewProxyDefinition(name = "New Proxy") {
    const newProxy = createProxyConfig(name);
    
    // Set priority based on existing proxies
    if (this.currentConfig.proxies && this.currentConfig.proxies.length > 0) {
      const maxPriority = Math.max(...this.currentConfig.proxies.map(p => p.priority));
      newProxy.priority = maxPriority + 1;
    } else {
      newProxy.priority = 0;
    }
    
    if (!this.currentConfig.proxies) {
      this.currentConfig.proxies = [];
    }
    this.currentConfig.proxies.push(newProxy);
    
    this.selectedProxyId = newProxy.id;
    return newProxy;
  }
  
  /**
   * Delete a proxy from the configuration
   * @param {string} proxyId - ID of the proxy to delete
   * @returns {boolean} Success status
   */
  deleteProxyFromCurrentConfig(proxyId) {
    const index = this.currentConfig.proxies.findIndex(p => p.id === proxyId);
    if (index === -1) return false;
    
    this.currentConfig.proxies.splice(index, 1);
    
    // Select another proxy if the deleted one was selected
    if (this.selectedProxyId === proxyId) {
      if (this.currentConfig.proxies.length > 0) {
        this.selectedProxyId = this.currentConfig.proxies[0].id;
      } else {
        this.selectedProxyId = null;
      }
    }
    
    return true;
  }
  
  /**
   * Move proxy priority (up or down)
   * @param {string} proxyId - ID of the proxy to move
   * @param {string} direction - 'up' or 'down'
   * @returns {boolean} Success status
   */
  moveProxyPriorityInCurrentConfig(proxyId, direction) {
    const currentProxyIndex = this.currentConfig.proxies.findIndex(p => p.id === proxyId);
    if (currentProxyIndex === -1) return false;
    
    // Sort proxies by priority
    let sortedProxies = [...this.currentConfig.proxies].sort((a, b) => a.priority - b.priority);
    const currentSortedIndex = sortedProxies.findIndex(p => p.id === proxyId);
    
    let targetSortedIndex;
    if (direction === "up") {
      targetSortedIndex = Math.max(0, currentSortedIndex - 1);
    } else {
      targetSortedIndex = Math.min(sortedProxies.length - 1, currentSortedIndex + 1);
    }
    
    if (targetSortedIndex === currentSortedIndex) return false;
    
    // Reorder array
    const [itemToMove] = sortedProxies.splice(currentSortedIndex, 1);
    sortedProxies.splice(targetSortedIndex, 0, itemToMove);
    
    // Update priorities
    sortedProxies.forEach((proxy, index) => {
      const originalProxy = this.currentConfig.proxies.find(p => p.id === proxy.id);
      if (originalProxy) {
        originalProxy.priority = index;
      }
    });
    
    return true;
  }
  
  /**
   * Get sorted proxies by priority
   * @returns {Array} Sorted proxy array
   */
  getSortedProxies() {
    return [...this.currentConfig.proxies].sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Get current configuration
   * @returns {Object} Current configuration object
   */
  getCurrentConfig() {
    return this.currentConfig;
  }
  
  /**
   * Get selected proxy ID
   * @returns {string|null} Selected proxy ID
   */
  getSelectedProxyId() {
    return this.selectedProxyId;
  }
  
  /**
   * Update the current configuration with a new one
   * @param {Object} newConfig - The new configuration
   */
  updateCurrentConfig(newConfig) {
    this.currentConfig = newConfig;
  }
}

/**
 * ConfigSaver handles debounced configuration saving
 */
class ConfigSaver {
  constructor() {
    this.saveTimer = null;
    this.debounceDelay = 500;
    this.sequentialDelay = 100;
    this.lastSaveTime = 0;
    this.pendingCallbacks = [];
    this.saveInProgress = false;
  }
  
  debouncedSave(config, callback, immediate = false) {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    if (typeof callback === 'function') {
      this.pendingCallbacks.push(callback);
    }
    
    if (immediate) {
      this.executeSave(config);
      return;
    }
    
    const timeSinceLastSave = Date.now() - this.lastSaveTime;
    let delay = this.debounceDelay;
    
    if (timeSinceLastSave < 1000) {
      delay += this.sequentialDelay;
    }
    
    this.saveTimer = setTimeout(() => {
      this.executeSave(config);
    }, delay);
  }
  
  async executeSave(config) {
    this.saveInProgress = true;
    this.lastSaveTime = Date.now();
    
    try {
      await browser.storage.local.set({ config });
      
      await browser.runtime.sendMessage({
        action: MESSAGE_ACTIONS.SAVE_CONFIG,
        config
      });
      
      const callbacks = [...this.pendingCallbacks];
      this.pendingCallbacks = [];
      
      setTimeout(() => {
        callbacks.forEach(cb => {
          try {
            cb();
          } catch (e) {
            console.error("Error in save callback:", e);
          }
        });
        
        this.saveInProgress = false;
      }, 0);
    } catch (error) {
      console.error('[ConfigSaver] Error saving configuration:', error);
      this.saveInProgress = false;
      this.pendingCallbacks = [];
    }
  }
  
  cancelPendingSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.pendingCallbacks = [];
    }
  }
  
  forceSave(config, callback) {
    this.debouncedSave(config, callback, true);
  }
}