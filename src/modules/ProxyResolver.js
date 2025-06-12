/**
 * ProxyResolver - Handles proxy resolution and aggregation key management
 * 
 * This module provides:
 * - Proxy routing logic that matches ProxyManager behavior
 * - Aggregation key generation for traffic grouping
 * - Cached proxy groupings for performance
 */

import PatternMatcher from './PatternMatcher.js';
import browserCapabilities from '../utils/feature-detection.js';

class ProxyResolver {
  constructor(patternMatcher = null) {
    this.patternMatcher = patternMatcher || new PatternMatcher();
    this.proxyKeyMap = new Map();
    this.proxyIdToKeyMap = new Map();
    this.sortedProxies = [];
    this.sortedPatternProxies = [];
    this.sortedContainerProxies = [];
    this.resolutionCache = new Map();
    this.configVersion = null;
    this.lastBuildTime = 0;
  }

  buildProxyKeyMap(proxies, configVersion) {
    if (this.configVersion === configVersion && this.proxyKeyMap.size > 0) {
      return;
    }

    this.proxyKeyMap.clear();
    this.proxyIdToKeyMap.clear();
    this.resolutionCache.clear();
    const keyGroups = new Map();

    const enabledProxies = proxies.filter(p => p.enabled);
    
    // Sort proxies by priority for faster resolution
    this.sortedProxies = enabledProxies
      .slice()
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    
    // Pre-sort pattern and container proxies
    this.sortedPatternProxies = this.sortedProxies
      .filter(p => !p.routingConfig?.useContainerMode && 
                   Array.isArray(p.routingConfig?.patterns) && 
                   p.routingConfig.patterns.length > 0);
    
    this.sortedContainerProxies = this.sortedProxies
      .filter(p => p.routingConfig?.useContainerMode &&
                   Array.isArray(p.routingConfig?.containers) &&
                   p.routingConfig.containers.length > 0);

    enabledProxies.forEach(proxy => {
      const key = this.getAggregationKey(proxy);
      this.proxyIdToKeyMap.set(proxy.id, key);
      
      if (!keyGroups.has(key)) {
        keyGroups.set(key, []);
      }
      
      keyGroups.get(key).push({
        id: proxy.id,
        name: proxy.name || `Proxy ${proxy.id}`,
        priority: proxy.priority ?? 999,
        color: proxy.color,
        routingConfig: proxy.routingConfig
      });
    });

    keyGroups.forEach((proxyList, key) => {
      proxyList.sort((a, b) => a.priority - b.priority);
      
      this.proxyKeyMap.set(key, {
        proxies: proxyList,
        color: proxyList[0].color,
        displayName: proxyList.map(p => p.name).join(', '),
        primaryProxyId: proxyList[0].id
      });
    });

    this.configVersion = configVersion;
    this.lastBuildTime = Date.now();
  }

  getAggregationKey(proxy) {
    const protocol = (proxy.proxyType || 'http').toLowerCase()
      .replace('socks5', 'socks')
      .replace('https', 'http');
    
    const key = `${protocol}:${proxy.host}:${proxy.port}`;
    return key;
  }

  getProxyGroupByKey(key) {
    return this.proxyKeyMap.get(key);
  }

  getKeyByProxyId(proxyId) {
    return this.proxyIdToKeyMap.get(proxyId);
  }

  resolveProxyForRequest(details) {
    if (this.sortedProxies.length === 0) {
      return null;
    }

    let url, hostname;
    try {
      url = new URL(details.url);
      hostname = url.hostname.toLowerCase();
    } catch (e) {
      console.error('[ProxyResolver] Failed to parse URL:', details.url);
      return null;
    }

    // Check resolution cache first
    const cacheKey = `${hostname}:${details.cookieStoreId || 'default'}`;
    const cached = this.resolutionCache.get(cacheKey);
    if (cached && cached.timestamp > Date.now() - 60000) {
      cached.hitCount++;
      // If we have a cached proxy ID, find the current proxy object
      if (cached.proxyId) {
        const currentProxy = this.sortedProxies.find(p => p.id === cached.proxyId);
        if (currentProxy) {
          return currentProxy;
        }
      }
      return cached.proxy; // Fallback for null/direct results
    }

    let selectedProxy = null;

    // Container-based routing (Firefox only) - use pre-sorted list
    if (browserCapabilities.containers.hasContainerSupport && details.cookieStoreId) {
      for (const proxy of this.sortedContainerProxies) {
        if (proxy.routingConfig.containers.includes(details.cookieStoreId)) {
          selectedProxy = proxy;
          break; // Exit early on first match (already sorted by priority)
        }
      }
    }

    // Pattern-based routing - use pre-sorted list
    if (!selectedProxy) {
      for (const proxy of this.sortedPatternProxies) {
        if (this.patternMatcher.matchesAnyPattern(hostname, proxy.routingConfig.patterns)) {
          selectedProxy = proxy;
          break; // Exit early on first match (already sorted by priority)
        }
      }
    }

    // Cache the resolution result with full context
    if (selectedProxy) {
      const aggregationKey = this.getAggregationKey(selectedProxy);
      this.resolutionCache.set(cacheKey, {
        proxy: selectedProxy,
        proxyId: selectedProxy.id, // Cache the ID for later lookup
        aggregationKey: aggregationKey,
        timestamp: Date.now(),
        hitCount: 1
      });
    } else {
      // Cache negative results too
      this.resolutionCache.set(cacheKey, {
        proxy: null,
        proxyId: null,
        aggregationKey: null,
        timestamp: Date.now(),
        hitCount: 1
      });
    }

    // Limit cache size
    if (this.resolutionCache.size > 1000) {
      // Remove least recently used entries
      const entries = Array.from(this.resolutionCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < 200; i++) {
        this.resolutionCache.delete(entries[i][0]);
      }
    }

    return selectedProxy;
  }

  resolveProxyFromProxyInfo(proxyInfo, proxies) {
    if (!proxyInfo || !proxies) {
      return null;
    }

    const proxyType = proxyInfo.type === 'socks' ? 'socks5' : proxyInfo.type;
    const enabledProxies = proxies.filter(p => p.enabled);

    const matchingProxies = enabledProxies.filter(proxy => {
      const configType = (proxy.proxyType || 'http').toLowerCase();
      const normalizedConfigType = configType === 'socks5' || configType === 'socks4' ? configType : configType.replace('https', 'http');
      const normalizedProxyType = proxyType === 'socks5' || proxyType === 'socks4' ? proxyType : proxyType.replace('https', 'http');
      
      return normalizedConfigType === normalizedProxyType &&
             proxy.host === proxyInfo.host &&
             parseInt(proxy.port, 10) === proxyInfo.port;
    });

    if (matchingProxies.length === 0) {
      return null;
    }

    if (matchingProxies.length === 1) {
      return matchingProxies[0];
    }

    // Multiple matches - return highest priority
    matchingProxies.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    return matchingProxies[0];
  }

  generateConfigVersion(config) {
    // Generate a version based on proxy configurations
    const proxyData = (config.proxies || []).map(p => ({
      id: p.id,
      enabled: p.enabled,
      host: p.host,
      port: p.port,
      proxyType: p.proxyType,
      priority: p.priority,
      routingConfig: p.routingConfig
    }));
    
    // Simple hash function
    return JSON.stringify(proxyData).split('').reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0);
    }, 0).toString(36);
  }

  getCachedStats() {
    return {
      keyCount: this.proxyKeyMap.size,
      proxyCount: this.proxyIdToKeyMap.size,
      sortedProxies: this.sortedProxies.length,
      cacheSize: this.resolutionCache.size,
      lastBuildTime: this.lastBuildTime,
      configVersion: this.configVersion
    };
  }

  clearCache() {
    this.resolutionCache.clear();
  }

  getCacheStats() {
    let totalHits = 0;
    let totalRequests = 0;
    
    for (const entry of this.resolutionCache.values()) {
      totalHits += entry.hitCount - 1;
      totalRequests += entry.hitCount;
    }
    
    return {
      entries: this.resolutionCache.size,
      hits: totalHits,
      misses: totalRequests - totalHits,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0
    };
  }
}

export default ProxyResolver;