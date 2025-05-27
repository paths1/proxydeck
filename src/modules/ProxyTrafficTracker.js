/**
 * ProxyTrafficTracker
 * Efficient request-to-proxy mapping with automatic cleanup
 */
export class ProxyTrafficTracker {
  constructor() {
    // Use Map for O(1) lookups
    this.requestProxyMap = new Map();
    
    // Configure cleanup
    this.maxEntries = 5000;
    this.cleanupBatchSize = 500;
    this.retentionTimeMs = 300000; // 5 minutes
    
    // Cleanup state
    this.cleanupScheduled = false;
    this.lastCleanupTime = Date.now();
  }
  
  recordProxyForRequest(requestId, proxyId) {
    if (!requestId || !proxyId) return;
    
    this.requestProxyMap.set(requestId, {
      proxyId,
      timestamp: Date.now()
    });
    
    // Schedule cleanup if map is getting large
    if (this.requestProxyMap.size > this.maxEntries && !this.cleanupScheduled) {
      this.scheduleCleanup();
    }
  }
  
  getProxyForRequest(requestId) {
    const entry = this.requestProxyMap.get(requestId);
    
    if (!entry) return null;
    
    // Check if entry is still valid
    if (Date.now() - entry.timestamp > this.retentionTimeMs) {
      this.requestProxyMap.delete(requestId);
      return null;
    }
    
    return entry.proxyId;
  }
  
  scheduleCleanup() {
    if (this.cleanupScheduled) return;
    
    this.cleanupScheduled = true;
    
    // Use immediate cleanup in next tick instead of setTimeout
    Promise.resolve().then(() => {
      this.performCleanup();
      this.cleanupScheduled = false;
    });
  }
  
  performCleanup() {
    const now = Date.now();
    const cutoff = now - this.retentionTimeMs;
    
    const iterator = this.requestProxyMap.entries();
    
    // Process in batches to avoid blocking
    for (let i = 0; i < this.cleanupBatchSize; i++) {
      const next = iterator.next();
      if (next.done) break;
      
      const [requestId, entry] = next.value;
      if (entry.timestamp < cutoff) {
        this.requestProxyMap.delete(requestId);
        // Entry deleted
      }
    }
    
    // Schedule another cleanup if map is still large
    if (this.requestProxyMap.size > this.maxEntries) {
      this.scheduleCleanup();
    }
    
    this.lastCleanupTime = now;
  }
  
  clear() {
    this.requestProxyMap.clear();
    this.cleanupScheduled = false;
  }
  
  getStats() {
    const proxyDistribution = new Map();
    
    for (const entry of this.requestProxyMap.values()) {
      const count = proxyDistribution.get(entry.proxyId) || 0;
      proxyDistribution.set(entry.proxyId, count + 1);
    }
    
    return {
      totalRequests: this.requestProxyMap.size,
      oldestEntryAge: this.getOldestEntryAge(),
      proxyDistribution: Object.fromEntries(proxyDistribution)
    };
  }
  
  getOldestEntryAge() {
    if (this.requestProxyMap.size === 0) return 0;
    
    let oldestTimestamp = Date.now();
    
    for (const entry of this.requestProxyMap.values()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }
    
    return Date.now() - oldestTimestamp;
  }
}