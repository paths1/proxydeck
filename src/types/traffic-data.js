/**
 * Data structure definitions for Recharts-compatible traffic monitoring
 * 
 * This replaces the Chart.js point-based format with Recharts record-based format
 * for better performance and UI integration.
 */

/**
 * Recharts format: Single record with all data for a timestamp
 * @typedef {Object} TrafficDataPoint
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {number} download_total - Total download bytes for this timestamp
 * @property {number} upload_total - Total upload bytes for this timestamp
 * @property {number} [download_proxyId] - Download bytes for specific proxy
 * @property {number} [upload_proxyId] - Upload bytes for specific proxy
 * @property {number} download_direct - Download bytes for direct traffic (no proxy)
 * @property {number} upload_direct - Upload bytes for direct traffic (no proxy)
 * @property {number} download_others - Download bytes for unmatched proxies
 * @property {number} upload_others - Upload bytes for unmatched proxies
 */

/**
 * Complete traffic data structure for a time window
 * @typedef {Object} TrafficWindowData
 * @property {TrafficDataPoint[]} data - Array of data points in Recharts format
 * @property {TrafficStats} stats - Calculated statistics
 * @property {TrafficMeta} meta - Metadata about the window
 */

/**
 * Traffic statistics data structure
 * @typedef {Object} TrafficStats
 * @property {StatGroup} download - Download statistics
 * @property {StatGroup} upload - Upload statistics
 * @property {Object<string, ProxyStats>} perProxy - Per-proxy statistics
 */

/**
 * Statistics for a traffic type
 * @typedef {Object} StatGroup
 * @property {number} current - Current value (latest data point)
 * @property {number} peak - Peak value in the window
 * @property {number} total - Sum of all values
 * @property {number} average - Average value
 */

/**
 * Statistics for a specific proxy
 * @typedef {Object} ProxyStats
 * @property {StatGroup} download - Download statistics for this proxy
 * @property {StatGroup} upload - Upload statistics for this proxy
 */

/**
 * Metadata about a traffic window
 * @typedef {Object} TrafficMeta
 * @property {string} windowSize - '1min', '5min', or '10min'
 * @property {number} sampleInterval - Interval between samples in ms
 * @property {number} pointCount - Number of data points
 * @property {number} updateTimestamp - Last update timestamp
 * @property {TimeRange} timeRange - Start and end timestamps
 */

/**
 * Time range for a data window
 * @typedef {Object} TimeRange
 * @property {number} start - Start timestamp
 * @property {number} end - End timestamp
 */

/**
 * Creates an empty traffic data structure
 * @param {string} windowSize - The window size ('1min', '5min', '10min')
 * @param {number} sampleInterval - Interval between samples in ms
 * @returns {TrafficWindowData}
 */
export function createEmptyTrafficData(windowSize, sampleInterval) {
  return {
    data: [],
    stats: {
      download: { current: 0, peak: 0, total: 0, average: 0 },
      upload: { current: 0, peak: 0, total: 0, average: 0 },
      perProxy: {}
    },
    meta: {
      windowSize,
      sampleInterval,
      pointCount: 0,
      updateTimestamp: Date.now(),
      timeRange: { start: Date.now(), end: Date.now() }
    }
  };
}

/**
 * Creates an empty data point
 * @param {number} timestamp - The timestamp for this data point
 * @returns {TrafficDataPoint}
 */
export function createEmptyDataPoint(timestamp) {
  return {
    timestamp,
    download_total: 0,
    upload_total: 0,
    download_direct: 0,
    upload_direct: 0,
    download_others: 0,
    upload_others: 0
  };
}

/**
 * Adds proxy data to a data point
 * @param {TrafficDataPoint} dataPoint - The data point to modify
 * @param {string} proxyId - The proxy ID
 * @param {number} downloadBytes - Download bytes for this proxy
 * @param {number} uploadBytes - Upload bytes for this proxy
 */
export function addProxyDataToPoint(dataPoint, proxyId, downloadBytes, uploadBytes) {
  dataPoint[`download_${proxyId}`] = downloadBytes;
  dataPoint[`upload_${proxyId}`] = uploadBytes;
}

/**
 * Gets all proxy IDs from a data point
 * @param {TrafficDataPoint} dataPoint - The data point to analyze
 * @returns {string[]} Array of proxy IDs
 */
export function getProxyIdsFromDataPoint(dataPoint) {
  const proxyIds = new Set();
  
  for (const key in dataPoint) {
    if (key.startsWith('download_') && 
        key !== 'download_total' && 
        key !== 'download_direct' && 
        key !== 'download_others') {
      proxyIds.add(key.replace('download_', ''));
    }
  }
  
  return Array.from(proxyIds);
}

/**
 * Converts Chart.js format to Recharts format
 * @param {Object} chartJsData - Data in Chart.js format
 * @returns {TrafficWindowData} Data in Recharts format
 */
export function convertFromChartJsFormat(chartJsData) {
  const { series, stats, meta } = chartJsData;
  
  // Find all timestamps from the total series
  const downloadTotal = series.download_total || [];
  const uploadTotal = series.upload_total || [];
  
  // Create timestamp-indexed data
  const dataByTimestamp = new Map();
  
  // Process total download data
  downloadTotal.forEach(point => {
    if (!dataByTimestamp.has(point.x)) {
      dataByTimestamp.set(point.x, createEmptyDataPoint(point.x));
    }
    dataByTimestamp.get(point.x).download_total = point.y;
  });
  
  // Process total upload data
  uploadTotal.forEach(point => {
    if (!dataByTimestamp.has(point.x)) {
      dataByTimestamp.set(point.x, createEmptyDataPoint(point.x));
    }
    dataByTimestamp.get(point.x).upload_total = point.y;
  });
  
  // Process per-proxy data
  for (const seriesKey in series) {
    if (seriesKey.startsWith('download_') && seriesKey !== 'download_total') {
      const proxyId = seriesKey.replace('download_', '');
      const downloadSeries = series[seriesKey] || [];
      const uploadSeries = series[`upload_${proxyId}`] || [];
      
      downloadSeries.forEach(point => {
        if (!dataByTimestamp.has(point.x)) {
          dataByTimestamp.set(point.x, createEmptyDataPoint(point.x));
        }
        dataByTimestamp.get(point.x)[`download_${proxyId}`] = point.y;
      });
      
      uploadSeries.forEach(point => {
        if (!dataByTimestamp.has(point.x)) {
          dataByTimestamp.set(point.x, createEmptyDataPoint(point.x));
        }
        dataByTimestamp.get(point.x)[`upload_${proxyId}`] = point.y;
      });
    }
  }
  
  // Convert to sorted array
  const data = Array.from(dataByTimestamp.values())
    .sort((a, b) => a.timestamp - b.timestamp);
  
  return {
    data,
    stats: stats || {
      download: { current: 0, peak: 0, total: 0, average: 0 },
      upload: { current: 0, peak: 0, total: 0, average: 0 },
      perProxy: {}
    },
    meta: meta || {
      windowSize: '1min',
      sampleInterval: 1000,
      pointCount: data.length,
      updateTimestamp: Date.now(),
      timeRange: {
        start: data.length > 0 ? data[0].timestamp : Date.now(),
        end: data.length > 0 ? data[data.length - 1].timestamp : Date.now()
      }
    }
  };
}