import { LRUCache } from 'lru-cache';

/**
 * UnifiedCacheManager - Consolidates multiple caches into a single managed cache
 * with namespace prefixes to avoid key collisions
 */
class UnifiedCacheManager {
  constructor(options = {}) {
    this.cache = new LRUCache({
      max: options.maxSize || 1000,
      ttl: options.ttl || 60000, // 1 minute default
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      allowStale: false
    });
    
    // Track cache hit/miss statistics per namespace
    this.stats = new Map();
  }
  
  getNamespacedKey(namespace, key) {
    return `${namespace}:${key}`;
  }
  
  get(namespace, key) {
    const namespacedKey = this.getNamespacedKey(namespace, key);
    const value = this.cache.get(namespacedKey);
    
    // Update statistics
    this.updateStats(namespace, value !== undefined);
    
    return value;
  }
  
  set(namespace, key, value) {
    const namespacedKey = this.getNamespacedKey(namespace, key);
    return this.cache.set(namespacedKey, value);
  }
  
  has(namespace, key) {
    const namespacedKey = this.getNamespacedKey(namespace, key);
    return this.cache.has(namespacedKey);
  }
  
  delete(namespace, key) {
    const namespacedKey = this.getNamespacedKey(namespace, key);
    return this.cache.delete(namespacedKey);
  }
  
  clear(namespace = null) {
    if (namespace) {
      // Clear only entries for specific namespace
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${namespace}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // Clear entire cache
      this.cache.clear();
    }
  }
  
  updateStats(namespace, isHit) {
    if (!this.stats.has(namespace)) {
      this.stats.set(namespace, { hits: 0, misses: 0 });
    }
    
    const stats = this.stats.get(namespace);
    if (isHit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
  }
  
  getStats(namespace = null) {
    if (namespace) {
      return this.stats.get(namespace) || { hits: 0, misses: 0 };
    }
    
    // Return aggregated stats
    const aggregated = { hits: 0, misses: 0 };
    for (const stats of this.stats.values()) {
      aggregated.hits += stats.hits;
      aggregated.misses += stats.misses;
    }
    return aggregated;
  }
  
  getHitRate(namespace = null) {
    const stats = this.getStats(namespace);
    const total = stats.hits + stats.misses;
    return total > 0 ? stats.hits / total : 0;
  }
  
  // Get current cache size and capacity info
  getCacheInfo() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      ttl: this.cache.ttl,
      hitRate: this.getHitRate()
    };
  }
}

export default UnifiedCacheManager;