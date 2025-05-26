
/**
 * PatternMatcher class for proxy pattern matching
 * 
 * This class provides pattern matching functionality:
 * 1. Efficient regex pattern caching with RegexPatternCache
 * 2. Simple proxy resolution for hostnames based on patterns
 */
class PatternMatcher {
  constructor() {
    this.regexPatternCache = new RegexPatternCache({
      maxSize: 1000,
      ttl: 3600000
    });
  }
  
  testPattern(hostname, pattern) {
    return this.regexPatternCache.test(hostname, pattern);
  }
  
  matchesAnyPattern(value, patterns) {
    if (!patterns || patterns.length === 0) return false;
    
    if (patterns.length === 1) {
      const singlePattern = patterns[0].value || patterns[0];
      if (singlePattern === "*" || singlePattern === ".*") {
        return true;
      }
    }
    for (const pattern of patterns) {
      const patternValue = pattern.value || pattern;
      if (value.toLowerCase() === patternValue.toLowerCase()) {
        return true;
      }
    }
    
    return patterns.some(pattern => {
      const patternValue = pattern.value || pattern;
      return this.regexPatternCache.test(value, patternValue);
    });
  }
  
  isValidRoutingPattern(pattern) {
    return this.validatePattern(pattern, { logErrors: false, returnPattern: false });
  }
  
  /**
   * Validates a hostname pattern for regex
   * @param {string} pattern - Hostname pattern to validate
   * @returns {boolean} - Whether the pattern is valid
   */
  isValidHostnamePattern(pattern) {
    return this.isValidRoutingPattern(pattern);
  }
  
  validateRegexPattern(pattern) {
    return this.validatePattern(pattern, { logErrors: true, returnPattern: true });
  }
  
  // Core validation function for regex patterns
  validatePattern(pattern, options = {}) {
    const { logErrors = false, returnPattern = false } = options;
    
    if (!pattern || pattern.trim() === '') {
      return returnPattern ? null : false;
    }
    if (pattern === '*' || pattern === '.*') {
      return returnPattern ? pattern : true;
    }
    
    try {
      new RegExp(pattern);
      return returnPattern ? pattern : true;
    } catch (e) {
      if (logErrors) {
        console.error(`Invalid regex pattern: ${pattern}`, e);
      }
      return returnPattern ? null : false;
    }
  }
  
  hostMatchesPattern(host, pattern) {
    return this.testPattern(host, pattern);
  }
  
  /**
   * Resolves proxy routing conflicts based on priority
   * @param {string} host - Hostname or IP to check
   * @param {Array} proxies - Array of proxy configurations
   * @returns {Object|null} - Highest priority proxy that matches the host, or null if none match
   */
  resolveProxyForHost(host, proxies) {
    if (!Array.isArray(proxies) || proxies.length === 0 || !host) {
      return null;
    }
    
    // Filter to enabled, pattern-based proxies
    const patternProxies = proxies.filter(p => 
      p.enabled && !p.routingConfig?.useContainerMode
    );
    
    // Find all matching proxies
    const matches = [];
    for (const proxy of patternProxies) {
      const patterns = proxy.routingConfig?.patterns || [];
      if (this.matchesAnyPattern(host, patterns)) {
        matches.push(proxy);
      }
    }
    
    // Return highest priority (lowest number)
    if (matches.length === 0) return null;
    matches.sort((a, b) => a.priority - b.priority);
    return matches[0];
  }
}

class RegexPatternCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 500;
    this.ttl = options.ttl || 3600000;
    this.hitCount = 0;
    this.missCount = 0;
    
    this.universalWildcards = new Set();
    this.exactMatches = new Map();
  }
  
  get(pattern, flags = 'i') {
    if (pattern === '*' || pattern === '.*') {
      this.universalWildcards.add(pattern);
      return { isUniversalWildcard: true };
    }
    
    if (this.isExactMatchPattern(pattern)) {
      const exactPattern = pattern.toLowerCase();
      this.exactMatches.set(exactPattern, true);
      return { isExactMatch: true, pattern: exactPattern };
    }
    const cacheKey = `${pattern}:${flags}`;
    
    const cached = this.cache.get(cacheKey);
    
    if (cached && (cached.expires > Date.now())) {
      this.hitCount++;
      cached.lastAccessed = Date.now();
      return cached.regex;
    }
    this.missCount++;
    
    try {
      const regex = new RegExp(pattern, flags);
      
      this.cache.set(cacheKey, {
        regex,
        created: Date.now(),
        lastAccessed: Date.now(),
        expires: Date.now() + this.ttl
      });
      if (this.cache.size > this.maxSize) {
        this.evictLeastRecentlyUsed();
      }
      
      return regex;
    } catch (e) {
      console.error(`Invalid regex pattern: ${pattern}`, e);
      return null;
    }
  }
  
  test(hostname, pattern, flags = 'i') {
    if (this.universalWildcards.has(pattern)) {
      return true;
    }
    if (this.exactMatches.has(pattern.toLowerCase())) {
      return hostname.toLowerCase() === pattern.toLowerCase();
    }
    
    const regex = this.get(pattern, flags);
    
    if (!regex) return false;
    if (regex.isUniversalWildcard) {
      return true;
    }
    if (regex.isExactMatch) {
      return hostname.toLowerCase() === regex.pattern;
    }
    
    try {
      return regex.test(hostname);
    } catch (e) {
      console.error(`Error testing hostname against pattern: ${pattern}`, e);
      return false;
    }
  }
  
  isExactMatchPattern(pattern) {
    return !(/[\\^$.*+?()[\]{}|]/.test(pattern));
  }
  
  evictLeastRecentlyUsed() {
    let oldest = Infinity;
    let oldestKey = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldest) {
        oldest = entry.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  clear() {
    this.cache.clear();
    this.universalWildcards.clear();
    this.exactMatches.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }
  
  getStats() {
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRatio: this.hitCount / (this.hitCount + this.missCount || 1),
      exactMatchPatterns: this.exactMatches.size,
      universalWildcards: this.universalWildcards.size
    };
  }
}



const defaultPatternMatcher = new PatternMatcher();
export { defaultPatternMatcher };
export default PatternMatcher;