import * as browser from 'webextension-polyfill';
import { MESSAGE_ACTIONS, SPECIAL_TRAFFIC_COLORS } from '../common/constants.js';
import browserCapabilities from '../utils/feature-detection.js';
import eventManager from './EventManager.js';
import { ProxyTrafficTracker } from './ProxyTrafficTracker.js';
import ProxyResolver from './ProxyResolver.js';
import UnifiedCacheManager from './UnifiedCacheManager.js';
import {
  createEmptyTrafficData,
  createEmptyDataPoint,
  addProxyDataToPoint,
  getProxyIdsFromDataPoint
} from '../types/traffic-data.js';

/**
 * TrafficMonitor - Resource-efficient traffic tracking
 * Key optimizations:
 * 1. Continuous background request processing
 * 2. Efficient proxy lookups with memoization
 * 3. Minimal object allocations in hot paths
 * 4. Smart batching and aggregation
 * 5. UI-friendly data structure maintained throughout lifecycle
 */
class TrafficMonitor {
  constructor(options = {}) {
    this.patternMatcher = options.patternMatcher;
    this.proxyTrafficTracker = options.proxyTrafficTracker || new ProxyTrafficTracker();
    this.proxyResolver = new ProxyResolver(this.patternMatcher);
    this.urlHostnameRegex = /^https?:\/\/([^/:]+)/i;
    
    // Recharts-compatible data structure
    this.trafficData = this.initializeDataStructure();
    
    // Sampling state
    this.currentSample = this.createEmptySample();
    this.sampleCounter = 0;
    
    // Stats calculation management
    this.lastFullRecalcTimestamp = {
      '1min': 0,
      '5min': 0,
      '10min': 0
    };
    this.fullRecalcIntervalMs = 60000; // Full recalculation every minute
    this.pointLastProcessed = {};
    
    // Request processing
    this.requestQueue = [];
    this.isProcessing = false;
    this.processingInterval = null;
    
    // Unified cache manager for all caching needs
    this.cacheManager = new UnifiedCacheManager({
      maxSize: 1000, // Larger unified cache
      ttl: 60000 // 1 minute TTL
    });
    
    // Configuration
    this.config = {
      maxHistoryPoints: 60,
      maxQueueSize: 1000,
      maxBatchSize: 100,
      processingIntervalMs: 25,
      sampleIntervalMs: 1000,
      aggregationIntervals: {
        '5min': 5,
        '10min': 10
      }
    };
    
    // Adaptive processing state
    this.lastUserActivity = Date.now();
    this.adaptiveProcessingEnabled = true;
    this.currentProcessingInterval = this.config.processingIntervalMs;
    
    // Bind methods for event listeners
    this.boundTrackDownload = this.trackDownloadTraffic.bind(this);
    this.boundTrackUpload = this.trackUploadTraffic.bind(this);
    this.boundSampleData = this.sampleData.bind(this);
    
    // setupAlarmListener() is now called conditionally in startMonitoring()
  }
  
  initializeDataStructure() {
    return {
      '1min': createEmptyTrafficData('1min', 1000),
      '5min': createEmptyTrafficData('5min', 5000),
      '10min': createEmptyTrafficData('10min', 10000)
    };
  }
  
  
  createEmptySample() {
    return {
      download: 0,
      upload: 0,
      proxyDownload: new Map(),
      proxyUpload: new Map(), 
      directDownload: 0,
      directUpload: 0,
      othersDownload: 0,
      othersUpload: 0
    };
  }
  
  setupAlarmListener() {
    this.alarmName = 'trafficSampling';
    this.boundAlarmListener = alarm => {
      if (alarm.name === this.alarmName) {
        this.sampleData();
      }
    };
    
    eventManager.addEventListener(
      'alarm',
      'traffic_sampling',
      browser.alarms,
      'onAlarm',
      this.boundAlarmListener
    );
  }
  
  startMonitoring(config, enabledProxies) {
    // Stop any existing monitoring first to prevent multiple intervals
    this.stopMonitoring();
    
    this.enabledProxies = enabledProxies;
    
    // Build proxy aggregation key map
    const configVersion = this.proxyResolver.generateConfigVersion(config);
    this.proxyResolver.buildProxyKeyMap(enabledProxies, configVersion);
    
    this.currentSample = this.createEmptySample();
    this.cacheManager.clear('proxyLookup');
    this.cacheManager.clear('proxyInfo');
    this.proxyResolver.clearCache();
    
    // Clear request queue to prevent processing stale requests
    this.requestQueue = [];
    
    // Initialize data structures for enabled proxies
    this.initializeProxyData(enabledProxies);
    
    // Start event listeners
    this.addWebRequestListeners();
    
    // Start continuous processing
    this.startContinuousProcessing();
    
    // Start sampling interval (use setInterval for sub-minute intervals)
    if (this.config.sampleIntervalMs < 60000) {
      // Use setInterval for intervals less than 1 minute
      this.sampleInterval = setInterval(this.boundSampleData, this.config.sampleIntervalMs);
    } else {
      // Use alarm for intervals 1 minute or longer
      // Set up alarm listener only for long intervals
      this.setupAlarmListener();
      browser.alarms.create(this.alarmName, { 
        periodInMinutes: this.config.sampleIntervalMs / 60000 
      });
    }
  }
  
  stopMonitoring() {
    eventManager.removeWebRequestListener('onCompleted', 'download_traffic_monitor');
    eventManager.removeWebRequestListener('onBeforeRequest', 'upload_traffic_monitor');
    eventManager.removeEventListener('alarm', 'traffic_sampling');
    
    // Clear both alarms and intervals
    browser.alarms.clear(this.alarmName);
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
    
    // Stop continuous processing
    this.stopContinuousProcessing();
    
    // Process any remaining requests
    this.processAllRemainingRequests();
    
    // Final sample if needed
    if (this.hasDataToSample()) {
      this.sampleData();
    }
    
    this.requestQueue = [];
    this.cacheManager.clear('proxyLookup');
  }

  handleConfigurationUpdate(newConfig, enabledProxies) {
    // Stop current monitoring
    this.stopMonitoring();
    
    // Clear request queue immediately to prevent processing stale requests
    this.requestQueue = [];
    
    // Update proxy resolver with new configuration
    const oldKeys = new Set(this.proxyResolver.proxyKeyMap.keys());
    const configVersion = this.proxyResolver.generateConfigVersion(newConfig);
    this.proxyResolver.buildProxyKeyMap(enabledProxies, configVersion);
    const newKeys = new Set(this.proxyResolver.proxyKeyMap.keys());
    const removedKeys = [...oldKeys].filter(key => !newKeys.has(key));
    if (removedKeys.length > 0) {
      this.clearTrafficDataForKeys(removedKeys);
    }
    
    // Clear resolution cache since config changed
    this.proxyResolver.clearCache();
    
    // Restart monitoring with new configuration
    this.startMonitoring(newConfig, enabledProxies);
  }

  clearTrafficDataForKeys(aggregationKeys) {
    if (!aggregationKeys || aggregationKeys.length === 0) return;
    
    for (const windowSize in this.trafficData) {
      const windowData = this.trafficData[windowSize];
      
      // Remove proxy-specific fields from all data points
      windowData.data.forEach(point => {
        aggregationKeys.forEach(key => {
          delete point[`download_${key}`];
          delete point[`upload_${key}`];
        });
      });
      
      // Remove proxy stats
      aggregationKeys.forEach(key => {
        delete windowData.stats.perProxy[key];
      });
      
      // Reset last processed tracking for affected data
      if (this.pointLastProcessed[windowSize]) {
        this.pointLastProcessed[windowSize] = {};
      }
    }
    
    // Clear proxy-specific data from current sample
    if (this.currentSample) {
      aggregationKeys.forEach(key => {
        this.currentSample.proxyDownload.delete(key);
        this.currentSample.proxyUpload.delete(key);
      });
    }
  }
  
  initializeProxyData(_proxies) {
    const timestamp = Date.now();
    
    for (const windowSize of ['1min', '5min', '10min']) {
      const windowData = this.trafficData[windowSize];
      
      // Initialize per-proxy stats for aggregation keys
      for (const [aggregationKey] of this.proxyResolver.proxyKeyMap) {
        if (!windowData.stats.perProxy[aggregationKey]) {
          windowData.stats.perProxy[aggregationKey] = {
            download: { current: 0, peak: 0, total: 0, average: 0 },
            upload: { current: 0, peak: 0, total: 0, average: 0 }
          };
        }
      }
      
      // Add initial data point if no data exists
      if (windowData.data.length === 0) {
        const initialPoint = createEmptyDataPoint(timestamp);
        for (const [aggregationKey] of this.proxyResolver.proxyKeyMap) {
          initialPoint[`download_${aggregationKey}`] = 0;
          initialPoint[`upload_${aggregationKey}`] = 0;
        }
        windowData.data.push(initialPoint);
        windowData.meta.pointCount = 1;
        windowData.meta.timeRange = { start: timestamp, end: timestamp };
      }
    }
  }
  
  addWebRequestListeners() {
    eventManager.addWebRequestListener(
      'onCompleted',
      'download_traffic_monitor',
      this.boundTrackDownload
    );
    
    if (browserCapabilities.webRequest.hasRequestBodyAccess) {
      eventManager.addWebRequestListener(
        'onBeforeRequest',
        'upload_traffic_monitor',
        this.boundTrackUpload
      );
    }
  }
  
  calculateAdaptiveInterval() {
    const now = Date.now();
    const timeSinceActivity = now - this.lastUserActivity;
    const queueSize = this.requestQueue.length;
    
    // User is idle if no activity for 30 seconds
    const userIdle = timeSinceActivity > 30000;
    
    // Adaptive intervals based on queue size and user activity
    if (userIdle && queueSize < 50) {
      // Very slow when user is idle with low traffic
      return Math.min(1000, this.config.processingIntervalMs * 40); // Max 1 second
    } else if (queueSize > 500) {
      // Very fast when queue is getting full
      return this.config.processingIntervalMs; // 25ms
    } else if (queueSize > 200) {
      // Fast for moderate queue
      return this.config.processingIntervalMs * 2; // 50ms
    } else if (queueSize > 100) {
      // Moderate speed
      return this.config.processingIntervalMs * 4; // 100ms
    } else if (userIdle) {
      // Slow when idle with minimal traffic
      return Math.min(500, this.config.processingIntervalMs * 20); // 500ms
    } else {
      // Default moderate speed for active user with low traffic
      return this.config.processingIntervalMs * 8; // 200ms
    }
  }
  
  updateProcessingInterval() {
    if (!this.adaptiveProcessingEnabled) return;
    
    const newInterval = this.calculateAdaptiveInterval();
    
    // Only update if interval changed significantly (more than 20% difference)
    if (Math.abs(newInterval - this.currentProcessingInterval) / this.currentProcessingInterval > 0.2) {
      this.currentProcessingInterval = newInterval;
      
      // Restart processing with new interval
      if (this.processingInterval) {
        this.stopContinuousProcessing();
        this.startContinuousProcessing();
      }
    }
  }
  
  startContinuousProcessing() {
    if (this.processingInterval) return;
    
    const processAndAdapt = () => {
      this.processRequestBatch();
      
      // Update interval based on current conditions
      if (this.adaptiveProcessingEnabled) {
        this.updateProcessingInterval();
      }
    };
    
    // Use adaptive interval if enabled
    const interval = this.adaptiveProcessingEnabled 
      ? this.currentProcessingInterval 
      : this.config.processingIntervalMs;
    
    this.processingInterval = setInterval(processAndAdapt, interval);
  }
  
  stopContinuousProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
  
  trackDownloadTraffic(details) {
    if (!details.url) return;
    
    // Update last user activity timestamp
    this.lastUserActivity = Date.now();
    
    // Check queue size limit
    if (this.requestQueue.length >= this.config.maxQueueSize) {
      // Drop oldest request to prevent unbounded growth
      this.requestQueue.shift();
    }
    
    // Queue the request for batch processing
    this.requestQueue.push({ type: 'download', details });
  }
  
  trackUploadTraffic(details) {
    if (!details.url || !details.requestBody) return;
    
    // Update last user activity timestamp
    this.lastUserActivity = Date.now();
    
    const size = this.calculateUploadSize(details);
    if (size === 0) return;
    
    // Process uploads immediately as they're less frequent
    const resolution = this.resolveProxyFromDetails(details);
    
    this.currentSample.upload += size;
    
    switch (resolution.type) {
      case 'configured':
        if (resolution.aggregationKey) {
          const currentProxyUpload = this.currentSample.proxyUpload.get(resolution.aggregationKey) || 0;
          this.currentSample.proxyUpload.set(resolution.aggregationKey, currentProxyUpload + size);
          
          // Track request for download correlation
          if (details.requestId && resolution.proxyId) {
            this.proxyTrafficTracker.recordProxyForRequest(details.requestId, resolution.proxyId);
          }
        }
        break;
      case 'direct':
        this.currentSample.directUpload += size;
        break;
      case 'others':
        this.currentSample.othersUpload += size;
        break;
    }
  }
  
  processRequestBatch() {
    if (this.requestQueue.length === 0 || this.isProcessing) return;
    
    this.isProcessing = true;
    
    // Process a limited batch to avoid blocking
    const batchSize = Math.min(this.config.maxBatchSize, this.requestQueue.length);
    const batch = this.requestQueue.splice(0, batchSize);
    
    for (const request of batch) {
      if (request.type === 'download') {
        this.processDownloadRequest(request.details);
      }
    }
    
    this.isProcessing = false;
  }
  
  processAllRemainingRequests() {
    while (this.requestQueue.length > 0) {
      const batch = this.requestQueue.splice(0, this.config.maxBatchSize);
      for (const request of batch) {
        if (request.type === 'download') {
          this.processDownloadRequest(request.details);
        }
      }
    }
  }
  
  processDownloadRequest(details) {
    const size = this.extractDownloadSize(details);
    if (size === 0) return;
    
    const resolution = this.resolveProxyFromDetails(details);
    
    this.currentSample.download += size;
    
    switch (resolution.type) {
      case 'configured':
        if (resolution.aggregationKey) {
          const currentProxyDownload = this.currentSample.proxyDownload.get(resolution.aggregationKey) || 0;
          this.currentSample.proxyDownload.set(resolution.aggregationKey, currentProxyDownload + size);
        }
        break;
      case 'direct':
        this.currentSample.directDownload += size;
        break;
      case 'others':
        this.currentSample.othersDownload += size;
        break;
    }
  }
  
  resolveProxyFromDetails(details) {
    // Firefox with proxyInfo support
    if (browserCapabilities.webRequest.hasProxyInfoInDetails && details.proxyInfo) {
      return this.resolveProxyFromProxyInfo(details);
    }
    
    // No proxyInfo = Direct traffic (Firefox only)
    if (browserCapabilities.webRequest.hasProxyInfoInDetails) {
      return { type: 'direct' };
    }
    
    // Chrome - use pattern matching
    const proxy = this.proxyResolver.resolveProxyForRequest(details);
    if (proxy) {
      const aggregationKey = this.proxyResolver.getAggregationKey(proxy);
      return { type: 'configured', aggregationKey, proxyId: proxy.id };
    } else {
      // Chrome: No matching proxy = unmatched traffic
      return { type: 'others' };
    }
  }
  
  resolveProxyFromProxyInfo(details) {
    const { type, host, port } = details.proxyInfo;
    
    // Generate aggregation key from proxyInfo
    const normalizedType = type === 'socks' ? 'socks' : type.toLowerCase().replace('https', 'http');
    const aggregationKey = `${normalizedType}:${host}:${port}`;
    
    // Check cache first
    const cached = this.cacheManager.get('proxyInfo', aggregationKey);
    if (cached) {
      return cached;
    }
    
    // Find matching proxy using ProxyResolver
    const proxy = this.proxyResolver.resolveProxyFromProxyInfo(details.proxyInfo, this.enabledProxies);
    
    let resolution;
    
    if (!proxy) {
      // No matching configured proxy - this is 'others' traffic
      resolution = { type: 'others' };
    } else {
      // Found matching proxy - use its aggregation key
      const proxyAggregationKey = this.proxyResolver.getAggregationKey(proxy);
      resolution = { 
        type: 'configured', 
        aggregationKey: proxyAggregationKey,
        proxyId: proxy.id // Still track for compatibility
      };
    }
    
    // Cache the result
    this.cacheManager.set('proxyInfo', aggregationKey, resolution);
    
    return resolution;
  }
  
  getAggregationKeysFromDataPoint(dataPoint) {
    const aggregationKeys = new Set();
    
    for (const key in dataPoint) {
      if (key.startsWith('download_') && 
          key !== 'download_total' && 
          key !== 'download_direct' && 
          key !== 'download_others') {
        aggregationKeys.add(key.replace('download_', ''));
      }
    }
    
    return Array.from(aggregationKeys);
  }
  
  extractDownloadSize(details) {
    // Priority: Content-Length > responseSize > transferSize
    if (details.responseHeaders) {
      const contentLength = details.responseHeaders.find(
        h => h.name.toLowerCase() === 'content-length'
      );
      if (contentLength) {
        return parseInt(contentLength.value, 10) || 0;
      }
    }
    
    return details.responseSize || details.transferSize || 0;
  }
  
  calculateUploadSize(details) {
    let size = 0;
    
    // Estimate headers
    size += 200 + details.method.length + details.url.length;
    
    // Body size
    if (details.requestBody.formData) {
      size += JSON.stringify(details.requestBody.formData).length;
    }
    
    if (details.requestBody.raw) {
      for (const item of details.requestBody.raw) {
        if (item.bytes) {
          size += item.bytes.byteLength;
        }
      }
    }
    
    return size;
  }
  
  sampleData() {
    const timestamp = Date.now();
    
    // Create new data point in Recharts format
    const dataPoint = createEmptyDataPoint(timestamp);
    dataPoint.download_total = this.currentSample.download;
    dataPoint.upload_total = this.currentSample.upload;
    
    // Add direct and unmatched traffic
    dataPoint.download_direct = this.currentSample.directDownload;
    dataPoint.upload_direct = this.currentSample.directUpload;
    dataPoint.download_others = this.currentSample.othersDownload;
    dataPoint.upload_others = this.currentSample.othersUpload;
    
    // Add per-proxy data using aggregation keys
    const keysWithData = new Set();
    
    // Process download data
    for (const [aggregationKey, downloadBytes] of this.currentSample.proxyDownload) {
      const uploadBytes = this.currentSample.proxyUpload.get(aggregationKey) || 0;
      // Use aggregation key as the data point key
      dataPoint[`download_${aggregationKey}`] = downloadBytes;
      dataPoint[`upload_${aggregationKey}`] = uploadBytes;
      keysWithData.add(aggregationKey);
    }
    
    // Process upload data for keys not already processed
    for (const [aggregationKey, uploadBytes] of this.currentSample.proxyUpload) {
      if (!keysWithData.has(aggregationKey)) {
        const downloadBytes = this.currentSample.proxyDownload.get(aggregationKey) || 0;
        dataPoint[`download_${aggregationKey}`] = downloadBytes;
        dataPoint[`upload_${aggregationKey}`] = uploadBytes;
        keysWithData.add(aggregationKey);
      }
    }
    
    // Add zero data for all known aggregation keys without activity
    if (this.proxyResolver.proxyKeyMap.size > 0) {
      for (const [aggregationKey] of this.proxyResolver.proxyKeyMap) {
        if (!keysWithData.has(aggregationKey)) {
          dataPoint[`download_${aggregationKey}`] = 0;
          dataPoint[`upload_${aggregationKey}`] = 0;
        }
      }
    }
    
    // Add to 1min data
    this.trafficData['1min'].data.push(dataPoint);
    
    // Update stats for 1min window
    this.updateStats('1min');
    
    // Reset current sample
    this.currentSample = this.createEmptySample();
    
    // Update aggregated views efficiently
    this.updateAggregatedViews(timestamp);
    
    // Trim old data
    this.trimChartData();
    
    this.sampleCounter++;
    
    // Broadcast update
    this.broadcastUpdate();
  }
  
  updateStats(windowSize) {
    const timestamp = Date.now();
    const windowData = this.trafficData[windowSize];
    const data = windowData.data;
    
    // Determine if we need a full recalculation
    const needsFullRecalc = timestamp - this.lastFullRecalcTimestamp[windowSize] >= this.fullRecalcIntervalMs;
    
    if (needsFullRecalc) {
      // Do full recalculation for safety/accuracy
      this.recalculateAllStats(windowSize);
      this.lastFullRecalcTimestamp[windowSize] = timestamp;
    } else {
      // Use incremental updates for better performance
      this.updateStatsIncrementally(windowSize);
    }
    
    // Update metadata
    windowData.meta.pointCount = data.length;
    windowData.meta.updateTimestamp = timestamp;
    
    // Update time range
    if (data.length > 0) {
      windowData.meta.timeRange = {
        start: data[0].timestamp,
        end: data[data.length - 1].timestamp
      };
    }
  }
  
  /**
   * Performs a full recalculation of all statistics
   * Used periodically to ensure accuracy
   */
  recalculateAllStats(windowSize) {
    const windowData = this.trafficData[windowSize];
    const data = windowData.data;
    
    // Initialize tracking
    if (!this.pointLastProcessed[windowSize]) {
      this.pointLastProcessed[windowSize] = {};
    }
    
    if (data.length === 0) return;
    
    // Calculate total stats
    const lastPoint = data[data.length - 1];
    
    // Download stats
    windowData.stats.download.current = lastPoint.download_total;
    windowData.stats.download.peak = Math.max(...data.map(pt => pt.download_total));
    windowData.stats.download.total = data.reduce((sum, pt) => sum + pt.download_total, 0);
    windowData.stats.download.average = windowData.stats.download.total / data.length;
    
    // Upload stats
    windowData.stats.upload.current = lastPoint.upload_total;
    windowData.stats.upload.peak = Math.max(...data.map(pt => pt.upload_total));
    windowData.stats.upload.total = data.reduce((sum, pt) => sum + pt.upload_total, 0);
    windowData.stats.upload.average = windowData.stats.upload.total / data.length;
    
    // Per-proxy stats using aggregation keys
    const aggregationKeys = this.getAggregationKeysFromDataPoint(lastPoint);
    
    for (const aggregationKey of aggregationKeys) {
      const downloadKey = `download_${aggregationKey}`;
      const uploadKey = `upload_${aggregationKey}`;
      
      // Initialize if needed
      if (!windowData.stats.perProxy[aggregationKey]) {
        windowData.stats.perProxy[aggregationKey] = {
          download: { current: 0, peak: 0, total: 0, average: 0 },
          upload: { current: 0, peak: 0, total: 0, average: 0 }
        };
      }
      
      // Download stats for this proxy
      const downloadValues = data.map(pt => pt[downloadKey] || 0);
      windowData.stats.perProxy[aggregationKey].download.current = lastPoint[downloadKey] || 0;
      windowData.stats.perProxy[aggregationKey].download.peak = Math.max(...downloadValues);
      windowData.stats.perProxy[aggregationKey].download.total = downloadValues.reduce((sum, val) => sum + val, 0);
      windowData.stats.perProxy[aggregationKey].download.average = 
        windowData.stats.perProxy[aggregationKey].download.total / data.length;
      
      // Upload stats for this proxy
      const uploadValues = data.map(pt => pt[uploadKey] || 0);
      windowData.stats.perProxy[aggregationKey].upload.current = lastPoint[uploadKey] || 0;
      windowData.stats.perProxy[aggregationKey].upload.peak = Math.max(...uploadValues);
      windowData.stats.perProxy[aggregationKey].upload.total = uploadValues.reduce((sum, val) => sum + val, 0);
      windowData.stats.perProxy[aggregationKey].upload.average = 
        windowData.stats.perProxy[aggregationKey].upload.total / data.length;
    }
    
    // Update tracking
    this.pointLastProcessed[windowSize]['data'] = data.length;
  }
  
  /**
   * Updates statistics incrementally for better performance
   * Only processes new data points since the last update
   */
  updateStatsIncrementally(windowSize) {
    const windowData = this.trafficData[windowSize];
    const data = windowData.data;
    
    // Initialize tracking for this window if needed
    if (!this.pointLastProcessed[windowSize]) {
      this.pointLastProcessed[windowSize] = {};
      // This is the first time, fallback to full calculation
      return this.recalculateAllStats(windowSize);
    }
    
    const lastProcessed = this.pointLastProcessed[windowSize]['data'] || 0;
    
    if (data.length === 0 || data.length <= lastProcessed) return;
    
    const lastPoint = data[data.length - 1];
    
    // Update current values
    windowData.stats.download.current = lastPoint.download_total;
    windowData.stats.upload.current = lastPoint.upload_total;
    
    // Update peaks if necessary
    windowData.stats.download.peak = Math.max(
      windowData.stats.download.peak,
      lastPoint.download_total
    );
    windowData.stats.upload.peak = Math.max(
      windowData.stats.upload.peak,
      lastPoint.upload_total
    );
    
    // Process new points for totals and averages
    let newDownloadSum = 0;
    let newUploadSum = 0;
    
    for (let i = lastProcessed; i < data.length; i++) {
      newDownloadSum += data[i].download_total;
      newUploadSum += data[i].upload_total;
    }
    
    // Update totals and averages
    windowData.stats.download.total += newDownloadSum;
    windowData.stats.download.average = windowData.stats.download.total / data.length;
    windowData.stats.upload.total += newUploadSum;
    windowData.stats.upload.average = windowData.stats.upload.total / data.length;
    
    // Update per-proxy stats using aggregation keys
    const aggregationKeys = this.getAggregationKeysFromDataPoint(lastPoint);
    
    for (const aggregationKey of aggregationKeys) {
      const downloadKey = `download_${aggregationKey}`;
      const uploadKey = `upload_${aggregationKey}`;
      
      // Initialize if needed
      if (!windowData.stats.perProxy[aggregationKey]) {
        windowData.stats.perProxy[aggregationKey] = {
          download: { current: 0, peak: 0, total: 0, average: 0 },
          upload: { current: 0, peak: 0, total: 0, average: 0 }
        };
      }
      
      // Update current values
      windowData.stats.perProxy[aggregationKey].download.current = lastPoint[downloadKey] || 0;
      windowData.stats.perProxy[aggregationKey].upload.current = lastPoint[uploadKey] || 0;
      
      // Update peaks
      windowData.stats.perProxy[aggregationKey].download.peak = Math.max(
        windowData.stats.perProxy[aggregationKey].download.peak,
        lastPoint[downloadKey] || 0
      );
      windowData.stats.perProxy[aggregationKey].upload.peak = Math.max(
        windowData.stats.perProxy[aggregationKey].upload.peak,
        lastPoint[uploadKey] || 0
      );
      
      // Process new points for this proxy
      let newProxyDownloadSum = 0;
      let newProxyUploadSum = 0;
      
      for (let i = lastProcessed; i < data.length; i++) {
        newProxyDownloadSum += data[i][downloadKey] || 0;
        newProxyUploadSum += data[i][uploadKey] || 0;
      }
      
      // Update totals and averages
      windowData.stats.perProxy[aggregationKey].download.total += newProxyDownloadSum;
      windowData.stats.perProxy[aggregationKey].download.average = 
        windowData.stats.perProxy[aggregationKey].download.total / data.length;
      windowData.stats.perProxy[aggregationKey].upload.total += newProxyUploadSum;
      windowData.stats.perProxy[aggregationKey].upload.average = 
        windowData.stats.perProxy[aggregationKey].upload.total / data.length;
    }
    
    // Update tracking
    this.pointLastProcessed[windowSize]['data'] = data.length;
  }
  
  updateAggregatedViews(timestamp) {
    // Only aggregate on appropriate boundaries to reduce work
    const shouldAggregate5min = this.sampleCounter % 5 === 0;
    const shouldAggregate10min = this.sampleCounter % 10 === 0;
    
    if (shouldAggregate5min) {
      this.aggregateWindow('5min', 5, timestamp);
    }
    
    if (shouldAggregate10min) {
      this.aggregateWindow('10min', 10, timestamp);
    }
  }
  
  aggregateWindow(windowSize, factor, timestamp) {
    // Get source data (1min)
    const sourceData = this.trafficData['1min'];
    if (!sourceData.data || sourceData.data.length < factor) {
      return;
    }
    
    const targetData = this.trafficData[windowSize];
    
    // Get last 'factor' points from 1min data
    const startIdx = Math.max(0, sourceData.data.length - factor);
    const sourcePoints = sourceData.data.slice(startIdx);
    
    // Create aggregated data point
    const aggregatedPoint = createEmptyDataPoint(timestamp);
    
    // Aggregate totals
    aggregatedPoint.download_total = sourcePoints.reduce((sum, pt) => sum + pt.download_total, 0);
    aggregatedPoint.upload_total = sourcePoints.reduce((sum, pt) => sum + pt.upload_total, 0);
    
    // Aggregate direct and unmatched traffic
    aggregatedPoint.download_direct = sourcePoints.reduce((sum, pt) => sum + (pt.download_direct || 0), 0);
    aggregatedPoint.upload_direct = sourcePoints.reduce((sum, pt) => sum + (pt.upload_direct || 0), 0);
    aggregatedPoint.download_others = sourcePoints.reduce((sum, pt) => sum + (pt.download_others || 0), 0);
    aggregatedPoint.upload_others = sourcePoints.reduce((sum, pt) => sum + (pt.upload_others || 0), 0);
    
    // Get all proxy IDs from the source data
    const proxyIds = new Set();
    
    // Include all enabled proxies
    if (this.enabledProxies) {
      for (const proxy of this.enabledProxies) {
        proxyIds.add(proxy.id);
      }
    }
    
    // Also include any proxy IDs found in the data
    sourcePoints.forEach(point => {
      getProxyIdsFromDataPoint(point).forEach(id => proxyIds.add(id));
    });
    
    // Aggregate per-proxy data
    for (const proxyId of proxyIds) {
      const downloadKey = `download_${proxyId}`;
      const uploadKey = `upload_${proxyId}`;
      
      const downloadSum = sourcePoints.reduce((sum, pt) => sum + (pt[downloadKey] || 0), 0);
      const uploadSum = sourcePoints.reduce((sum, pt) => sum + (pt[uploadKey] || 0), 0);
      
      addProxyDataToPoint(aggregatedPoint, proxyId, downloadSum, uploadSum);
    }
    
    // Add aggregated point to target window
    targetData.data.push(aggregatedPoint);
    
    // Update stats for this window
    this.updateStats(windowSize);
  }
  
  trimChartData() {
    const limits = {
      '1min': 60,
      '5min': 60,
      '10min': 60
    };
    
    for (const windowSize in this.trafficData) {
      const limit = limits[windowSize];
      const windowData = this.trafficData[windowSize];
      
      if (windowData.data.length > limit) {
        // Trim data points
        windowData.data = windowData.data.slice(-limit);
        
        // Force full recalculation after trimming
        this.recalculateAllStats(windowSize);
      }
    }
  }
  
  broadcastUpdate() {
    try {
      // Create shallow copies of the data
      const updates = {};
      
      for (const windowSize in this.trafficData) {
        const windowData = this.trafficData[windowSize];
        
        // Only send last 3 data points for incremental updates
        const recentData = this.getLatestPoints(windowData.data, 3);
        
        updates[windowSize] = {
          data: recentData,
          stats: {...windowData.stats},
          meta: {...windowData.meta}
        };
      }
      
      // Send optimized message
      const message = {
        action: MESSAGE_ACTIONS.TRAFFIC_UPDATE,
        updates
      };
      
      // Send via runtime for extension pages
      browser.runtime.sendMessage(message).catch(() => {
        // Ignore broadcast errors
      });
    } catch (e) {
      // Ignore errors
    }
  }
  
  /**
   * Get the most recent N points from an array of data points
   */
  getLatestPoints(points, count) {
    if (!points || points.length === 0) return [];
    if (points.length <= count) return [...points];
    return points.slice(points.length - count);
  }
  
  getTrafficData(windowSize) {
    // Return the requested window data
    if (!this.trafficData[windowSize]) {
      return createEmptyTrafficData(
        windowSize,
        windowSize === '1min' ? 1000 : windowSize === '5min' ? 5000 : 10000
      );
    }
    
    // For aggregated views, ensure we have built full historical data
    if (windowSize === '5min' || windowSize === '10min') {
      this.buildHistoricalAggregatedData(windowSize);
    }
    
    // Return a copy to avoid external modification
    const windowData = this.trafficData[windowSize];
    
    return {
      data: [...windowData.data],
      stats: JSON.parse(JSON.stringify(windowData.stats)),
      meta: {...windowData.meta}
    };
  }
  
  buildHistoricalAggregatedData(windowSize) {
    const factor = windowSize === '5min' ? 5 : 10;
    const sourceData = this.trafficData['1min'];
    const targetData = this.trafficData[windowSize];
    
    // Only rebuild if we have significantly more source data than aggregated data
    const expectedAggregatedPoints = Math.floor(sourceData.data.length / factor);
    const currentAggregatedPoints = targetData.data.length;
    
    // If we're missing more than 1 aggregated point, rebuild the entire history
    if (expectedAggregatedPoints > currentAggregatedPoints + 1) {
      // Clear existing data
      targetData.data = [];
      
      // Build aggregated points from all available 1-minute data
      for (let i = factor - 1; i < sourceData.data.length; i += factor) {
        const startIdx = i - factor + 1;
        const endIdx = i + 1;
        const pointsToAggregate = sourceData.data.slice(startIdx, endIdx);
        
        if (pointsToAggregate.length === factor) {
          // Use the timestamp of the last point in the group
          const timestamp = pointsToAggregate[pointsToAggregate.length - 1].timestamp;
          
          // Create aggregated data point
          const aggregatedPoint = createEmptyDataPoint(timestamp);
          
          // Aggregate totals
          aggregatedPoint.download_total = pointsToAggregate.reduce((sum, pt) => sum + pt.download_total, 0);
          aggregatedPoint.upload_total = pointsToAggregate.reduce((sum, pt) => sum + pt.upload_total, 0);
          
          // Aggregate direct and unmatched traffic
          aggregatedPoint.download_direct = pointsToAggregate.reduce((sum, pt) => sum + (pt.download_direct || 0), 0);
          aggregatedPoint.upload_direct = pointsToAggregate.reduce((sum, pt) => sum + (pt.upload_direct || 0), 0);
          aggregatedPoint.download_others = pointsToAggregate.reduce((sum, pt) => sum + (pt.download_others || 0), 0);
          aggregatedPoint.upload_others = pointsToAggregate.reduce((sum, pt) => sum + (pt.upload_others || 0), 0);
          
          // Get all proxy IDs
          const proxyIds = new Set();
          if (this.enabledProxies) {
            for (const proxy of this.enabledProxies) {
              proxyIds.add(proxy.id);
            }
          }
          
          // Also include any proxy IDs found in the data
          pointsToAggregate.forEach(point => {
            getProxyIdsFromDataPoint(point).forEach(id => proxyIds.add(id));
          });
          
          // Aggregate per-proxy data
          for (const proxyId of proxyIds) {
            const downloadKey = `download_${proxyId}`;
            const uploadKey = `upload_${proxyId}`;
            
            const downloadSum = pointsToAggregate.reduce((sum, pt) => sum + (pt[downloadKey] || 0), 0);
            const uploadSum = pointsToAggregate.reduce((sum, pt) => sum + (pt[uploadKey] || 0), 0);
            
            addProxyDataToPoint(aggregatedPoint, proxyId, downloadSum, uploadSum);
          }
          
          targetData.data.push(aggregatedPoint);
        }
      }
      
      // Update stats after rebuilding
      this.updateStats(windowSize);
    }
  }
  
  hasDataToSample() {
    return this.currentSample.download > 0 || 
           this.currentSample.upload > 0 ||
           this.currentSample.proxyDownload.size > 0 ||
           this.currentSample.proxyUpload.size > 0;
  }
  
  getAllTrafficSources(enabledProxies = []) {
    const allSources = [];
    
    // Build proxy key map if not already built
    if (this.proxyResolver.proxyKeyMap.size === 0 && enabledProxies.length > 0) {
      const config = { proxies: enabledProxies };
      const configVersion = this.proxyResolver.generateConfigVersion(config);
      this.proxyResolver.buildProxyKeyMap(enabledProxies, configVersion);
    }
    
    // Get all aggregation keys and their grouped proxies
    const processedKeys = new Set();
    
    for (const [aggregationKey, groupInfo] of this.proxyResolver.proxyKeyMap) {
      if (!processedKeys.has(aggregationKey)) {
        allSources.push({
          id: aggregationKey,
          name: groupInfo.displayName,
          color: groupInfo.color,
          isAggregated: true,
          proxies: groupInfo.proxies
        });
        processedKeys.add(aggregationKey);
      }
    }
    
    // Firefox: Show both Direct and Unmatched
    if (browserCapabilities.webRequest.hasProxyInfoInDetails) {
      allSources.push({
        id: 'direct',
        name: 'Direct',
        color: SPECIAL_TRAFFIC_COLORS.DIRECT,
        isSpecial: true
      });
    }
    
    // Chrome + Firefox + Fallback: Always show Unmatched
    allSources.push({
      id: 'others', 
      name: 'Others',
      color: SPECIAL_TRAFFIC_COLORS.OTHERS,
      isSpecial: true
    });
    
    return allSources;
  }
}

export default TrafficMonitor;