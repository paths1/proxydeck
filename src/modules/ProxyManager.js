import * as browser from 'webextension-polyfill';
import browserCapabilities from '../utils/feature-detection.js';
import { setupProxyRequestListener, applyProxySettings, disableProxy as disableProxyHelpers } from '../utils/proxy-helpers.js';
import { initializeProxyHandler, cleanupProxyHandler } from '../utils/firefox-proxy-handler.js';
import { handleError, ErrorTypes, ErrorSeverity } from '../utils/error-helpers.js';
import { createPriorityColorMap } from '../utils/priority-color.js';

/**
 * ProxyManager class manages proxy configurations and routing
 * Handles proxy enabling/disabling, PAC script generation, and browser-specific implementations
 */
class ProxyManager {
  constructor(options = {}) {
    this.tabManager = options.tabManager;
    this.patternMatcher = options.patternMatcher;
    this.trafficMonitor = options.trafficMonitor;
    
    this.config = null;
    this.enabledProxies = [];
    this.pacScript = '';
    
    this.onError = options.onError || (() => {});
    
    this.isBrowserProxy = false;
    this.hasProxyRequestListener = browserCapabilities.proxy.hasProxyRequestListener;
    this.hasContainerSupport = browserCapabilities.containers.hasContainerSupport;
    
    this.init();
  }
  
  findContainerProxy(cookieStoreId) {
    if (!this.hasContainerSupport || !cookieStoreId || !this.enabledProxies || this.enabledProxies.length === 0) {
      return null;
    }
    
    const matchingProxies = this.enabledProxies.filter(proxy => 
      proxy.enabled &&
      proxy.routingConfig &&
      proxy.routingConfig.useContainerMode &&
      proxy.routingConfig.containers &&
      proxy.routingConfig.containers.includes(cookieStoreId)
    );
    
    if (matchingProxies.length === 0) {
      return null;
    }
    
    matchingProxies.sort((a, b) => a.priority - b.priority);
    
    return matchingProxies[0];
  }
  
  async init() {
    await this.loadConfig();
    
    if (this.isFirefox) {
      this.setupFirefoxProxy();
    }
    
    await this.applyProxySettings();
  }
  
  setupFirefoxProxy() {
    if (browserCapabilities.proxy.hasProxyRequestListener) {
      this.isBrowserProxy = true;
      const handlerFunc = this.handleProxyRequest.bind(this);
      setupProxyRequestListener(handlerFunc);
    }
  }
  
  async loadConfig() {
    const result = await browser.storage.local.get('config');
    this.config = result.config || this.getDefaultConfig();
    
    if (!this.config.version || this.config.version !== 2 || !Array.isArray(this.config.proxies)) {
      this.config = this.getDefaultConfig();
    }
    
    this.config.proxyEnabled = true;
    
    if (this.config.proxies && this.config.proxies.length > 1) {
      const defaultProxies = this.config.proxies.filter(p => p.name === 'Default Proxy');
      if (defaultProxies.length > 1) {
        this.config.proxies = this.config.proxies.filter((p, index) => {
          if (p.name === 'Default Proxy') {
            return this.config.proxies.findIndex(x => x.name === 'Default Proxy') === index;
          }
          return true;
        });
        await this.saveConfig();
      }
    }
    
    // Ensure all proxies have colors
    this.ensureProxyColors();
    
    this.enabledProxies = this.config.proxies.filter(proxy => proxy.enabled);
    
    return this.config;
  }
  
  ensureProxyColors() {
    if (!this.config.proxies || this.config.proxies.length === 0) return false;
    
    // Check if any proxy is missing a color
    const needsColorUpdate = this.config.proxies.some(proxy => !proxy.color);
    
    if (needsColorUpdate) {
      // Only calculate colors if at least one proxy needs it
      return this.updateProxyColors(true);
    }
    
    return false;
  }
  
  getDefaultConfig() {
    const defaultConfig = {
      version: 2,
      proxies: [],
      proxyEnabled: true
    };
    
    return defaultConfig;
  }
  
  updateProxyColors(forceUpdate = false) {
    if (!this.config.proxies || this.config.proxies.length === 0) {
      return false;
    }
    
    // Check if colors need updating
    const colorMap = createPriorityColorMap(this.config.proxies);
    let colorsChanged = false;
    
    this.config.proxies.forEach(proxy => {
      const newColor = colorMap[proxy.id];
      if (proxy.color !== newColor || forceUpdate) {
        proxy.color = newColor;
        colorsChanged = true;
      }
    });
    
    return colorsChanged;
  }
  
  async saveConfig() {
    // Ensure colors are up to date before saving
    this.updateProxyColors();
    await browser.storage.local.set({ config: this.config });
    return this.config;
  }

  // This method is called from background.js but wasn't implemented
  async updateConfig(newConfig) {
    // Make sure we preserve individual proxy enabled states 
    if (newConfig && newConfig.proxies && Array.isArray(newConfig.proxies)) {
      // Enforce proxy limit - maximum 10 proxies
      if (newConfig.proxies.length > 10) {
        throw new Error('Maximum of 10 proxies are allowed');
      }
      
      this.config = { 
        ...newConfig,
        proxies: newConfig.proxies.map(proxy => ({ 
          ...proxy,
          routingConfig: proxy.routingConfig ? { 
            ...proxy.routingConfig,
            patterns: [...(proxy.routingConfig.patterns || [])],
            containers: [...(proxy.routingConfig.containers || [])]
          } : undefined
        }))
      };
      
      // This ensures proxy features are enabled, but individual proxy enabled states are preserved
      this.config.proxyEnabled = true;
      
      // Calculate colors for the updated configuration
      this.updateProxyColors();
      
      // Update the enabledProxies array to match the new config
      this.enabledProxies = this.config.proxies.filter(proxy => proxy.enabled);
      
      // Save the config to storage
      await this.saveConfig();
      
      // Apply the new proxy settings
      await this.applyProxySettings();
    }
    
    return this.config;
  }
  
  async enable() {
    this.config.proxyEnabled = true;
    // Add defensive check
    if (!this.config.proxies || !Array.isArray(this.config.proxies)) {
      this.config.proxies = [];
    }
    this.enabledProxies = this.config.proxies.filter(proxy => proxy.enabled);
    await this.saveConfig();
    await this.applyProxySettings();
    
    return true;
  }
  
  async disable() {
    this.config.proxyEnabled = false;
    await this.saveConfig();
    await this.disableProxy();
    
    return false;
  }
  
  async toggle() {
    if (this.config.proxyEnabled) {
      return await this.disable();
    } else {
      return await this.enable();
    }
  }
  
  async updateProxy(proxyId, updates) {
    const proxyIndex = this.config.proxies.findIndex(p => p.id === proxyId);
    
    if (proxyIndex === -1) {
      throw new Error(`Proxy with ID ${proxyId} not found`);
    }
    
    const currentProxy = this.config.proxies[proxyIndex];
    
    // Handle toggling enabled state when no explicit value provided
    if ('enabled' in updates && updates.enabled === undefined) {
      updates.enabled = !currentProxy.enabled;
    }
    
    // Deep merge for routingConfig updates
    if (updates.routingConfig) {
      this.config.proxies[proxyIndex].routingConfig = {
        ...currentProxy.routingConfig,
        ...updates.routingConfig,
        // Preserve arrays properly
        patterns: updates.routingConfig.patterns !== undefined 
          ? [...updates.routingConfig.patterns]
          : currentProxy.routingConfig.patterns,
        containers: updates.routingConfig.containers !== undefined
          ? [...updates.routingConfig.containers]
          : currentProxy.routingConfig.containers
      };
      delete updates.routingConfig;
    }
    
    // Apply remaining updates
    Object.assign(this.config.proxies[proxyIndex], updates);
    
    // If priority was updated, recalculate colors for all proxies
    if ('priority' in updates) {
      this.updateProxyColors();
    }
    
    this.enabledProxies = this.config.proxies.filter(proxy => proxy.enabled);
    
    await this.saveConfig();
    await this.applyProxySettings();
    
    return this.config.proxies[proxyIndex];
  }
  
  
  
  resolveProxyForRequest(hostname, cookieStoreId = null, options = {}) {
    if (!this.config.proxyEnabled || this.enabledProxies.length === 0 || !hostname) {
      return options.returnAllMatches ? { selectedProxy: null, allProxies: [] } : null;
    }
    
    
    const matchingProxies = [];
    const containerProxies = [];
    const patternProxies = [];
    
    if (cookieStoreId) {
      const containerProxy = this.findContainerProxy(cookieStoreId);
      if (containerProxy) {
        matchingProxies.push(containerProxy);
        containerProxies.push(containerProxy);
      }
    }
    
    const patternProxy = this.findProxyForHostname(hostname);
    if (patternProxy) {
      if (!matchingProxies.some(p => p.id === patternProxy.id)) {
        matchingProxies.push(patternProxy);
      }
      patternProxies.push(patternProxy);
    }
    
    if (options.returnAllMatches) {
      // Get all enabled proxies for comprehensive filtering
      const enabledProxies = this.config.proxies.filter(p => p.enabled);
      
      // Get all container-matched proxies
      if (cookieStoreId) {
        const containerMatches = enabledProxies.filter(proxy => 
          proxy.routingConfig?.useContainerMode && 
          proxy.routingConfig?.containers?.includes(cookieStoreId)
        );
        // Add container matches that aren't already in the containerProxies array
        containerMatches.forEach(proxy => {
          if (!containerProxies.some(p => p.id === proxy.id)) {
            containerProxies.push(proxy);
          }
        });
      }
      
      // Get all pattern-matched proxies
      const patternMatches = enabledProxies.filter(proxy => {
        if (proxy.routingConfig?.useContainerMode) {
          return false;
        }
        
        return proxy.routingConfig?.patterns && 
               this.patternMatcher.matchesAnyPattern(hostname, proxy.routingConfig.patterns);
      });
      
      // Add pattern matches that aren't already in the patternProxies array
      patternMatches.forEach(proxy => {
        if (!patternProxies.some(p => p.id === proxy.id)) {
          patternProxies.push(proxy);
        }
      });
      
      const allMatches = [...containerProxies, ...patternProxies];
      const uniqueProxies = [];
      const seenIds = new Set();
      
      allMatches.forEach(proxy => {
        if (!seenIds.has(proxy.id)) {
          seenIds.add(proxy.id);
          uniqueProxies.push(proxy);
        }
      });
      
      uniqueProxies.sort((a, b) => a.priority - b.priority);
      
      let selectedProxy = null;
      if (matchingProxies.length > 0) {
        matchingProxies.sort((a, b) => a.priority - b.priority);
        selectedProxy = matchingProxies[0];
      } else if (uniqueProxies.length > 0) {
        selectedProxy = uniqueProxies[0];
      }
      
      return {
        selectedProxy: selectedProxy,
        allProxies: uniqueProxies,
        matchType: selectedProxy ? 
          (selectedProxy.routingConfig?.useContainerMode ? 'container' : 'pattern') : 
          null
      };
    }
    
    if (matchingProxies.length > 0) {
      matchingProxies.sort((a, b) => a.priority - b.priority);
      return matchingProxies[0];
    }
    
    return null;
  }
  
  handleProxyRequest(requestInfo) {
    if (!this.config.proxyEnabled || this.enabledProxies.length === 0) {
      return { type: "direct" };
    }
    
    let url;
    try {
      url = new URL(requestInfo.url);
    } catch (e) {
      handleError(
        `Invalid URL in proxy request: ${requestInfo.url}`,
        ErrorTypes.INTERNAL,
        ErrorSeverity.WARNING,
        e,
        { data: { requestUrl: requestInfo.url } }
      );
      return { type: "direct" };
    }
    
    const hostname = url.hostname.toLowerCase();
    const cookieStoreId = requestInfo.cookieStoreId;
    
    const selectedProxy = this.resolveProxyForRequest(hostname, cookieStoreId);
    
    if (selectedProxy) {
      const proxyType = selectedProxy.proxyType || 'socks5';
      const proxyInfo = {
        type: proxyType === 'socks5' ? 'socks' : proxyType,
        host: selectedProxy.host,
        port: parseInt(selectedProxy.port, 10),
        proxyDNS: proxyType.startsWith('socks')
      };
      
      if (selectedProxy.username && selectedProxy.password && proxyType !== 'socks4') {
        proxyInfo.username = selectedProxy.username;
        proxyInfo.password = selectedProxy.password;
      }
      
      return proxyInfo;
    }
    
    return { type: "direct" };
  }
  
  findProxyForHostname(hostname) {
    if (!hostname || !Array.isArray(this.enabledProxies) || this.enabledProxies.length === 0) {
      return null;
    }
    
    const patternProxies = this.enabledProxies.filter(proxy => 
      proxy.enabled && 
      proxy.routingConfig && 
      !proxy.routingConfig.useContainerMode &&
      Array.isArray(proxy.routingConfig.patterns)
    );
    if (this.patternMatcher && typeof this.patternMatcher.resolveProxyForHost === 'function') {
      return this.patternMatcher.resolveProxyForHost(hostname, patternProxies);
    }
    
    const matchingProxies = [];
    
    for (const proxy of patternProxies) {
      // Check if any of the proxy's patterns match the hostname
      if (this.patternMatcher.matchesAnyPattern(hostname, proxy.routingConfig.patterns)) {
        matchingProxies.push(proxy);
      }
    }
    
    if (matchingProxies.length === 0) {
      return null;
    }
    
    // Sort by priority (lower number = higher priority)
    matchingProxies.sort((a, b) => a.priority - b.priority);
    
    // Return the highest priority match
    return matchingProxies[0];
  }
  
  
  generatePacScript() {
    if (!this.enabledProxies || !Array.isArray(this.enabledProxies) || this.enabledProxies.length === 0) {
      this.pacScript = `
        function FindProxyForURL(url, host) {
          return "DIRECT";
        }
      `;
      return this.pacScript;
    }
    
    const proxyConfigurations = this.enabledProxies
      .filter(proxy => !proxy.routingConfig?.useContainerMode)
      .map(proxy => {
        const patterns = proxy.routingConfig?.patterns || [];
        let authString = "";
        
        if (proxy.username && proxy.password && !browserCapabilities.proxy.hasProxyRequestListener) {
          authString = `${proxy.username}:${proxy.password}@`;
        }
        
        // Convert proxy type to PAC script format
        let proxyTypeString;
        const proxyType = proxy.proxyType || 'socks5';
        switch (proxyType.toLowerCase()) {
          case 'http':
          case 'https':
            proxyTypeString = 'PROXY';
            break;
          case 'socks4':
            proxyTypeString = 'SOCKS4';
            break;
          case 'socks5':
          default:
            proxyTypeString = 'SOCKS5';
            break;
        }
        
        return {
          patterns: patterns.map(p => p.value || p),
          proxyString: `${proxyTypeString} ${authString}${proxy.host}:${proxy.port}`,
          priority: proxy.priority
        };
      })
      .filter(config => config.patterns.length > 0)
      .sort((a, b) => a.priority - b.priority); // Pre-sort by priority
    
    const configData = JSON.stringify(proxyConfigurations);
    
    this.pacScript = `
      var proxyConfigurations = ${configData};
      var regexCache = {};
      
      // Efficient O(1) LRU cache using hash table + doubly linked list
      var lruCache = {
        cache: {},
        head: null,
        tail: null,
        size: 0,
        maxSize: 50,
        
        get: function(hostname) {
          var node = this.cache[hostname];
          if (!node) return null;
          
          // Move to head (most recently used)
          this._moveToHead(node);
          return node.proxy;
        },
        
        set: function(hostname, proxy) {
          var node = this.cache[hostname];
          
          if (node) {
            // Update existing node
            node.proxy = proxy;
            this._moveToHead(node);
          } else {
            // Create new node
            var newNode = {
              hostname: hostname,
              proxy: proxy,
              prev: null,
              next: null
            };
            
            this.cache[hostname] = newNode;
            this._addToHead(newNode);
            this.size++;
            
            // Evict tail if over capacity
            if (this.size > this.maxSize) {
              var tail = this._removeTail();
              delete this.cache[tail.hostname];
              this.size--;
            }
          }
        },
        
        _moveToHead: function(node) {
          this._removeNode(node);
          this._addToHead(node);
        },
        
        _removeNode: function(node) {
          if (node.prev) {
            node.prev.next = node.next;
          } else {
            this.head = node.next;
          }
          
          if (node.next) {
            node.next.prev = node.prev;
          } else {
            this.tail = node.prev;
          }
        },
        
        _addToHead: function(node) {
          node.prev = null;
          node.next = this.head;
          
          if (this.head) {
            this.head.prev = node;
          }
          
          this.head = node;
          
          if (!this.tail) {
            this.tail = node;
          }
        },
        
        _removeTail: function() {
          var tail = this.tail;
          this._removeNode(tail);
          return tail;
        }
      };
      
      function getRegex(pattern) {
        if (!regexCache[pattern]) {
          try {
            regexCache[pattern] = new RegExp(pattern, "i");
          } catch (e) {
            regexCache[pattern] = null;
          }
        }
        return regexCache[pattern];
      }
      
      function testPatternMatch(hostname, pattern) {
        var regex = getRegex(pattern);
        return regex && regex.test(hostname);
      }
      
      function findProxyForHostname(hostname) {
        // Check each proxy configuration (already sorted by priority)
        for (var i = 0; i < proxyConfigurations.length; i++) {
          var config = proxyConfigurations[i];
          var patterns = config.patterns;
          
          for (var j = 0; j < patterns.length; j++) {
            if (testPatternMatch(hostname, patterns[j])) {
              return config.proxyString;
            }
          }
        }
        
        return "DIRECT";
      }
      
      function FindProxyForURL(url, host) {
        var hostname = host.toLowerCase();
        
        // Early exit for non-HTTP(S) protocols
        if (url.substring(0, 5) === 'file:' || 
            url.substring(0, 6) === 'about:' || 
            url.substring(0, 11) === 'javascript:' ||
            url.substring(0, 7) === 'chrome:' ||
            url.substring(0, 17) === 'chrome-extension:' ||
            url.substring(0, 16) === 'moz-extension:') {
          return "DIRECT";
        }
        
        // Early exit for localhost
        if (hostname === 'localhost' || 
            hostname === 'localhost.localdomain' || 
            hostname.endsWith('.localhost')) {
          return "DIRECT";
        }
        
        // Check LRU cache first
        var cachedProxy = lruCache.get(hostname);
        if (cachedProxy !== null) {
          return cachedProxy;
        }
        
        // Find proxy for hostname
        var proxy = findProxyForHostname(hostname);
        
        // Cache the result
        lruCache.set(hostname, proxy);
        
        return proxy;
      }
    `;
    
    return this.pacScript;
  }
  
  async applyProxySettings() {
    this.enabledProxies = this.config.proxies.filter(proxy => proxy.enabled);
    
    if (!this.config.proxyEnabled || this.enabledProxies.length === 0) {
      await this.disableProxy();
      return;
    }
    
    try {
      if (this.hasProxyRequestListener) {
        await this.applyRequestLevelProxySettings();
      } else {
        await this.applyPacScriptProxySettings();
      }
      
      
      if (this.trafficMonitor) {
          this.trafficMonitor.startMonitoring(this.config, this.enabledProxies);
      }
    } catch (error) {
      const errorObj = handleError(
        "Failed to apply proxy settings",
        ErrorTypes.PROXY_CONFIG,
        ErrorSeverity.ERROR,
        error,
        { 
          notify: true, 
          updateUI: true,
          data: {
            proxyCount: this.enabledProxies.length,
            browserType: this.hasProxyRequestListener ? 'firefox' : 'chrome'
          }
        }
      );
      
      if (this.onError) {
        this.onError(errorObj);
      }
    }
  }
  
  async applyRequestLevelProxySettings() {
    // Get the ProxyTrafficTracker from TrafficMonitor if available
    const proxyTrafficTracker = this.trafficMonitor ? this.trafficMonitor.proxyTrafficTracker : null;
    initializeProxyHandler(this.config, this.enabledProxies, this.patternMatcher, proxyTrafficTracker);
  }
  
  async applyPacScriptProxySettings() {
    this.generatePacScript();
    
    try {
      await applyProxySettings({ pacScript: this.pacScript });
    } catch (error) {
      handleError(
        "Failed to apply PAC script proxy settings",
        ErrorTypes.BROWSER_API,
        ErrorSeverity.ERROR,
        error,
        { data: { scriptLength: this.pacScript.length } }
      );
      throw error;
    }
  }
  
  async disableProxy() {
    if (this.hasProxyRequestListener) {
      cleanupProxyHandler();
      try {
        if (browser.proxy && browser.proxy.settings) {
          await browser.proxy.settings.clear({});
        }
      } catch (error) {
        handleError(
          "Failed to disable request-level proxy",
          ErrorTypes.BROWSER_API,
          ErrorSeverity.ERROR,
          error,
          { notify: true }
        );
        
        throw error;
      }
    } else {
      try {
        await disableProxyHelpers();
      } catch (error) {
        handleError(
          "Failed to disable PAC script proxy",
          ErrorTypes.BROWSER_API,
          ErrorSeverity.ERROR,
          error,
          { notify: true }
        );
        
        throw error;
      }
    }
    
    if (this.trafficMonitor) {
      this.trafficMonitor.stopMonitoring();
    }
  }
  
  handleProxyError(details) {
    if (details && details.error === 'net::ERR_PROXY_CONNECTION_FAILED') {
      const errorObj = handleError(
        "Proxy connection failed",
        ErrorTypes.NETWORK,
        ErrorSeverity.ERROR,
        null,
        { 
          data: details,
          notify: true,
          updateUI: true
        }
      );
      
      // Clear badge for the tab with error
      if (details.tabId > 0 && this.tabManager) {
        this.tabManager.clearTabBadge(details.tabId);
      }
      
      if (this.onError) {
        this.onError(errorObj);
      }
    } else if (details && details.error) {
      // Handle other proxy errors
      handleError(
        `Proxy error: ${details.error}`,
        ErrorTypes.PROXY_CONFIG,
        ErrorSeverity.WARNING,
        null,
        { 
          data: details,
          notify: false,
          updateUI: true
        }
      );
    }
  }
  
  
  
  
  
  /**
   * Gets proxy info for a specific tab - centralized method to be used by background.js and TabManager.js
   * @param {number} tabId - The tab ID to check
   * @param {string} url - The URL to check
   * @param {Object} options - Additional options
   * @param {boolean} [options.includeAllMatches=false] - Whether to include all matching proxies
   * @returns {Promise<Object>} - Information about proxy mapping
   */
  async getProxyForTab(tabId, url, options = {}) {
    if (!url || !url.startsWith('http')) {
      return { 
        success: false, 
        error: "Invalid or non-HTTP URL", 
        proxyInfo: null,
        matchType: null
      };
    }
    
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      let cookieStoreId = null;
      
      // Get container info for Firefox
      if (browserCapabilities.containers.hasContainerSupport && tabId) {
        try {
          const tab = await browser.tabs.get(tabId);
          cookieStoreId = tab?.cookieStoreId || null;
        } catch (error) {
          if (!error.message?.includes("Invalid tab ID")) {
            console.info("[Proxy] Error getting tab cookie store ID:", error);
          }
        }
      }
      
      // Use the enhanced resolveProxyForRequest method
      const result = this.resolveProxyForRequest(hostname, cookieStoreId, {
        returnAllMatches: !!options.includeAllMatches
      });
      
      // Format the response based on whether we're returning all matches
      if (options.includeAllMatches) {
        const { selectedProxy, allProxies, matchType } = result;
        
        return {
          success: true,
          proxyInfo: selectedProxy,
          matchType: matchType,
          allMatchingProxies: allProxies
        };
      } else {
        // For backward compatibility with existing code
        const selectedProxy = result;
        const matchType = selectedProxy ? 
          (cookieStoreId && selectedProxy.routingConfig?.useContainerMode ? 'container' : 'pattern') : 
          null;
        
        return {
          success: true,
          proxyInfo: selectedProxy,
          matchType: matchType
        };
      }
    } catch (error) {
      console.error("[Proxy] Error in getProxyForTab:", error);
      return { 
        success: false, 
        error: `Error processing tab info or URL: ${error.message || String(error)}`,
        proxyInfo: null,
        matchType: null
      };
    }
  }
  
  /**
   * Checks if a tab is using a proxy and updates UI accordingly
   * To be used by TabManager.js to centralize proxy usage detection
   * @param {number} tabId - The tab ID to check
   * @param {string} url - The URL to check
   * @param {Object} options - Additional options
   * @param {Function} [options.onProvisionalMatch] - Callback for provisional proxy match (Chrome only)
   * @param {Function} [options.onProxyMatch] - Callback for when a proxy is found
   * @param {Function} [options.onNoMatch] - Callback for when no proxy is found
   * @returns {Promise<Object>} - Information about the proxy match
   */
  async checkTabProxyUsage(tabId, url, options = {}) {
    if (!url || !url.startsWith('http') || url.startsWith('about:')) {
      // Non-HTTP URLs don't use proxies
      if (options.onNoMatch) {
        options.onNoMatch();
      }
      return { match: false };
    }
    
    try {
      const proxyInfo = await this.getProxyForTab(tabId, url);
      
      if (proxyInfo.success && proxyInfo.proxyInfo) {
        if (options.onProxyMatch) {
          options.onProxyMatch(proxyInfo.proxyInfo, proxyInfo.matchType);
        }
        
        return { 
          match: true, 
          proxy: proxyInfo.proxyInfo,
          matchType: proxyInfo.matchType
        };
      } else {
        // Tab is not using a proxy
        if (options.onNoMatch) {
          options.onNoMatch();
        }
        
        return { match: false };
      }
    } catch (error) {
      console.error("[Proxy] Error checking tab proxy usage:", error);
      
      if (options.onNoMatch) {
        options.onNoMatch();
      }
      
      return { 
        match: false, 
        error: String(error)
      };
    }
  }
  
  
}

export default ProxyManager;