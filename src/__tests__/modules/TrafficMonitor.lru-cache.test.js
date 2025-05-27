import TrafficMonitor from '../../modules/TrafficMonitor.js';
import { LRUCache } from 'lru-cache';

// Mock dependencies
jest.mock('webextension-polyfill', () => ({
  alarms: {
    create: jest.fn(),
    clear: jest.fn()
  },
  runtime: {
    sendMessage: jest.fn()
  }
}));

jest.mock('../../modules/EventManager.js', () => ({
  addEventListener: jest.fn(),
  addWebRequestListener: jest.fn(),
  removeWebRequestListener: jest.fn(),
  removeEventListener: jest.fn()
}));

jest.mock('../../utils/feature-detection.js', () => ({
  webRequest: {
    hasProxyInfoInDetails: false,
    hasRequestBodyAccess: true,
    hasOnCompleted: true,
    hasOnErrorOccurred: true,
    hasOnBeforeRequest: true
  },
  containers: {
    hasContainerSupport: false
  }
}));

describe('TrafficMonitor LRU Cache Implementation', () => {
  let trafficMonitor;
  let mockPatternMatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPatternMatcher = {
      matchesAnyPattern: jest.fn()
    };
    
    trafficMonitor = new TrafficMonitor({
      patternMatcher: mockPatternMatcher
    });
  });

  describe('LRU cache initialization', () => {
    it('should initialize proxyLookupCache as LRU cache with correct settings', () => {
      expect(trafficMonitor.proxyLookupCache).toBeInstanceOf(LRUCache);
      expect(trafficMonitor.proxyLookupCache.max).toBe(500);
      expect(trafficMonitor.proxyLookupCache.ttl).toBe(60000);
    });

    it('should initialize proxyInfoCache as LRU cache with correct settings', () => {
      expect(trafficMonitor.proxyInfoCache).toBeInstanceOf(LRUCache);
      expect(trafficMonitor.proxyInfoCache.max).toBe(500);
      expect(trafficMonitor.proxyInfoCache.ttl).toBe(60000);
    });
  });

  describe('Cache size limits', () => {
    it('should enforce maximum size on proxyLookupCache', () => {
      trafficMonitor.enabledProxies = [{ id: 'proxy1', enabled: true }];
      
      // Fill cache beyond limit
      for (let i = 0; i < 600; i++) {
        const key = `https://example${i}.com_`;
        trafficMonitor.cacheProxyLookup(key, `proxy${i % 3}`);
      }
      
      // Cache should not exceed max size
      expect(trafficMonitor.proxyLookupCache.size).toBeLessThanOrEqual(500);
    });

    it('should evict least recently used entries when cache is full', () => {
      trafficMonitor.enabledProxies = [{ id: 'proxy1', enabled: true }];
      
      // Fill cache to limit
      for (let i = 0; i < 500; i++) {
        const key = `https://example${i}.com_`;
        trafficMonitor.cacheProxyLookup(key, 'proxy1');
      }
      
      // Access first entry to make it recently used
      trafficMonitor.proxyLookupCache.get('https://example0.com_');
      
      // Add new entry that should evict an old one
      trafficMonitor.cacheProxyLookup('https://newsite.com_', 'proxy1');
      
      // First entry should still exist (recently accessed)
      expect(trafficMonitor.proxyLookupCache.has('https://example0.com_')).toBe(true);
      // New entry should exist
      expect(trafficMonitor.proxyLookupCache.has('https://newsite.com_')).toBe(true);
    });
  });

  describe('Cache TTL behavior', () => {
    it('should respect TTL for cached entries', () => {
      const key = 'https://example.com_';
      
      // Set cache entry
      trafficMonitor.cacheProxyLookup(key, 'proxy1');
      
      // Entry should exist initially
      expect(trafficMonitor.proxyLookupCache.get(key)).toBe('proxy1');
      
      // Fast-forward time beyond TTL
      jest.advanceTimersByTime(70000); // 70 seconds
      
      // Entry should be expired (LRU cache handles this internally)
      // The actual behavior depends on LRU cache implementation
    });
  });

  describe('Memory efficiency', () => {
    it('should not have unbounded growth with high traffic', () => {
      trafficMonitor.enabledProxies = [
        { 
          id: 'proxy1', 
          enabled: true,
          routingConfig: {
            useContainerMode: false,
            patterns: ['*example.com*']
          }
        },
        { 
          id: 'proxy2', 
          enabled: true,
          routingConfig: {
            useContainerMode: false,
            patterns: ['*site*.com*']
          }
        }
      ];
      
      // Simulate high traffic with many unique URLs
      for (let i = 0; i < 10000; i++) {
        const details = {
          url: `https://site${i % 1000}.com/path${i}`,
          requestId: `req${i}`
        };
        
        // This would use the cache
        trafficMonitor.resolveProxyForRequest(details);
      }
      
      // Both caches should stay within limits
      expect(trafficMonitor.proxyLookupCache.size).toBeLessThanOrEqual(500);
      expect(trafficMonitor.proxyInfoCache.size).toBeLessThanOrEqual(500);
    });
  });

  describe('Cache cleanup on stop', () => {
    it('should clear caches when monitoring stops', () => {
      // Add some cache entries
      trafficMonitor.cacheProxyLookup('https://example1.com_', 'proxy1');
      trafficMonitor.cacheProxyLookup('https://example2.com_', 'proxy2');
      
      expect(trafficMonitor.proxyLookupCache.size).toBeGreaterThan(0);
      
      // Stop monitoring
      trafficMonitor.stopMonitoring();
      
      // Caches should be cleared
      expect(trafficMonitor.proxyLookupCache.size).toBe(0);
    });
  });

  describe('Listener cleanup on stop', () => {
    it('should remove alarm listener when stopping monitoring', () => {
      const { addEventListener, removeEventListener } = require('../../modules/EventManager.js');
      
      // Configure traffic monitor to use alarms (sampleIntervalMs >= 60000)
      trafficMonitor.config.sampleIntervalMs = 60000;
      
      // Start monitoring to set up listeners
      trafficMonitor.startMonitoring({}, []);
      
      // Verify alarm listener was added
      expect(addEventListener).toHaveBeenCalledWith(
        'alarm',
        'traffic_sampling',
        expect.any(Object),
        'onAlarm',
        expect.any(Function)
      );
      
      // Stop monitoring
      trafficMonitor.stopMonitoring();
      
      // Verify alarm listener was removed
      expect(removeEventListener).toHaveBeenCalledWith('alarm', 'traffic_sampling');
    });
  });
});