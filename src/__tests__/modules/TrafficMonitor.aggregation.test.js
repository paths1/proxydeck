import TrafficMonitor from '../../modules/TrafficMonitor.js';
import { createEmptyDataPoint, addProxyDataToPoint } from '../../types/traffic-data.js';

// Mock dependencies
jest.mock('webextension-polyfill', () => ({
  alarms: {
    create: jest.fn(),
    clear: jest.fn()
  }
}));

jest.mock('../../modules/EventManager.js', () => ({
  addEventListener: jest.fn(),
  addWebRequestListener: jest.fn(),
  removeWebRequestListener: jest.fn()
}));

jest.mock('../../utils/feature-detection.js', () => ({
  webRequest: {
    hasProxyInfoInDetails: false
  }
}));

describe('TrafficMonitor Aggregation', () => {
  let trafficMonitor;
  
  beforeEach(() => {
    jest.clearAllMocks();
    trafficMonitor = new TrafficMonitor();
    
    // Set up sample counter to trigger aggregation
    trafficMonitor.sampleCounter = 0;
  });

  describe('aggregateWindow', () => {
    beforeEach(() => {
      // Set up 1-minute data with direct and others traffic
      const now = Date.now();
      const data1min = [];
      
      // Create 5 data points for aggregation
      for (let i = 0; i < 5; i++) {
        const point = createEmptyDataPoint(now - (4 - i) * 60000);
        point.download_total = (i + 1) * 100;
        point.upload_total = (i + 1) * 50;
        point.download_direct = (i + 1) * 20;
        point.upload_direct = (i + 1) * 10;
        point.download_others = (i + 1) * 30;
        point.upload_others = (i + 1) * 15;
        
        // Add proxy data
        addProxyDataToPoint(point, 'proxy1', (i + 1) * 40, (i + 1) * 20);
        
        data1min.push(point);
      }
      
      trafficMonitor.trafficData['1min'].data = data1min;
    });

    it('should aggregate direct and others traffic for 5-minute window', () => {
      const timestamp = Date.now();
      
      trafficMonitor.aggregateWindow('5min', 5, timestamp);
      
      const aggregatedData = trafficMonitor.trafficData['5min'].data;
      expect(aggregatedData).toHaveLength(1);
      
      const aggregatedPoint = aggregatedData[0];
      
      // Check that direct traffic is aggregated correctly
      // Sum of [20, 40, 60, 80, 100] = 300
      expect(aggregatedPoint.download_direct).toBe(300);
      // Sum of [10, 20, 30, 40, 50] = 150
      expect(aggregatedPoint.upload_direct).toBe(150);
      
      // Check that others traffic is aggregated correctly
      // Sum of [30, 60, 90, 120, 150] = 450
      expect(aggregatedPoint.download_others).toBe(450);
      // Sum of [15, 30, 45, 60, 75] = 225
      expect(aggregatedPoint.upload_others).toBe(225);
      
      // Check totals are also aggregated
      // Sum of [100, 200, 300, 400, 500] = 1500
      expect(aggregatedPoint.download_total).toBe(1500);
      // Sum of [50, 100, 150, 200, 250] = 750
      expect(aggregatedPoint.upload_total).toBe(750);
      
      // Check proxy data is aggregated
      // Sum of [40, 80, 120, 160, 200] = 600
      expect(aggregatedPoint.download_proxy1).toBe(600);
      // Sum of [20, 40, 60, 80, 100] = 300
      expect(aggregatedPoint.upload_proxy1).toBe(300);
    });

    it('should aggregate direct and others traffic for 10-minute window', () => {
      // Add more data to make 10 points
      const now = Date.now();
      const data1min = [...trafficMonitor.trafficData['1min'].data];
      
      for (let i = 5; i < 10; i++) {
        const point = createEmptyDataPoint(now - (9 - i) * 60000);
        point.download_total = (i + 1) * 100;
        point.upload_total = (i + 1) * 50;
        point.download_direct = (i + 1) * 20;
        point.upload_direct = (i + 1) * 10;
        point.download_others = (i + 1) * 30;
        point.upload_others = (i + 1) * 15;
        
        addProxyDataToPoint(point, 'proxy1', (i + 1) * 40, (i + 1) * 20);
        
        data1min.push(point);
      }
      
      trafficMonitor.trafficData['1min'].data = data1min;
      
      const timestamp = Date.now();
      trafficMonitor.aggregateWindow('10min', 10, timestamp);
      
      const aggregatedData = trafficMonitor.trafficData['10min'].data;
      expect(aggregatedData).toHaveLength(1);
      
      const aggregatedPoint = aggregatedData[0];
      
      // Check that direct traffic is aggregated correctly for 10 points
      // Sum of [20, 40, 60, 80, 100, 120, 140, 160, 180, 200] = 1100
      expect(aggregatedPoint.download_direct).toBe(1100);
      // Sum of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] = 550
      expect(aggregatedPoint.upload_direct).toBe(550);
      
      // Check that others traffic is aggregated correctly for 10 points
      // Sum of [30, 60, 90, 120, 150, 180, 210, 240, 270, 300] = 1650
      expect(aggregatedPoint.download_others).toBe(1650);
      // Sum of [15, 30, 45, 60, 75, 90, 105, 120, 135, 150] = 825
      expect(aggregatedPoint.upload_others).toBe(825);
    });

    it('should handle missing direct/unmatched data gracefully', () => {
      // Create data points without direct/unmatched fields
      const now = Date.now();
      const data1min = [];
      
      for (let i = 0; i < 5; i++) {
        const point = createEmptyDataPoint(now - (4 - i) * 60000);
        point.download_total = (i + 1) * 100;
        point.upload_total = (i + 1) * 50;
        // Note: no direct/unmatched fields added
        
        addProxyDataToPoint(point, 'proxy1', (i + 1) * 40, (i + 1) * 20);
        
        data1min.push(point);
      }
      
      trafficMonitor.trafficData['1min'].data = data1min;
      
      const timestamp = Date.now();
      trafficMonitor.aggregateWindow('5min', 5, timestamp);
      
      const aggregatedData = trafficMonitor.trafficData['5min'].data;
      const aggregatedPoint = aggregatedData[0];
      
      // Should default to 0 for missing fields
      expect(aggregatedPoint.download_direct).toBe(0);
      expect(aggregatedPoint.upload_direct).toBe(0);
      expect(aggregatedPoint.download_others).toBe(0);
      expect(aggregatedPoint.upload_others).toBe(0);
      
      // Other data should still be aggregated
      expect(aggregatedPoint.download_total).toBe(1500);
      expect(aggregatedPoint.upload_total).toBe(750);
    });

    it('should not aggregate when insufficient data', () => {
      // Clear the data to have less than factor points
      trafficMonitor.trafficData['1min'].data = [];
      
      const originalLength = trafficMonitor.trafficData['5min'].data.length;
      
      const timestamp = Date.now();
      trafficMonitor.aggregateWindow('5min', 5, timestamp);
      
      // Should not add any aggregated points
      expect(trafficMonitor.trafficData['5min'].data).toHaveLength(originalLength);
    });
  });

  describe('data integrity across time windows', () => {
    it('should maintain consistency between 1min and aggregated windows', () => {
      // Set up test data
      const now = Date.now();
      const data1min = [];
      
      for (let i = 0; i < 10; i++) {
        const point = createEmptyDataPoint(now - (9 - i) * 60000);
        point.download_total = 100;
        point.upload_total = 50;
        point.download_direct = 20;
        point.upload_direct = 10;
        point.download_others = 30;
        point.upload_others = 15;
        
        addProxyDataToPoint(point, 'proxy1', 40, 20);
        
        data1min.push(point);
      }
      
      trafficMonitor.trafficData['1min'].data = data1min;
      
      // Aggregate both windows
      trafficMonitor.aggregateWindow('5min', 5, now);
      trafficMonitor.aggregateWindow('10min', 10, now);
      
      const aggregated5min = trafficMonitor.trafficData['5min'].data[0];
      const aggregated10min = trafficMonitor.trafficData['10min'].data[0];
      
      // 5-minute aggregated data should be half of 10-minute data
      expect(aggregated5min.download_direct * 2).toBe(aggregated10min.download_direct);
      expect(aggregated5min.upload_direct * 2).toBe(aggregated10min.upload_direct);
      expect(aggregated5min.download_others * 2).toBe(aggregated10min.download_others);
      expect(aggregated5min.upload_others * 2).toBe(aggregated10min.upload_others);
      
      // Verify the exact values
      expect(aggregated5min.download_direct).toBe(100); // 5 * 20
      expect(aggregated5min.upload_direct).toBe(50); // 5 * 10
      expect(aggregated5min.download_others).toBe(150); // 5 * 30
      expect(aggregated5min.upload_others).toBe(75); // 5 * 15
      
      expect(aggregated10min.download_direct).toBe(200); // 10 * 20
      expect(aggregated10min.upload_direct).toBe(100); // 10 * 10
      expect(aggregated10min.download_others).toBe(300); // 10 * 30
      expect(aggregated10min.upload_others).toBe(150); // 10 * 15
    });
  });
});