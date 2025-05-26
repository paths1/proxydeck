import TrafficMonitor from '../../modules/TrafficMonitor.js';
import browserCapabilities from '../../utils/feature-detection.js';
import { SPECIAL_TRAFFIC_COLORS } from '../../common/constants.js';

// Mock browser capabilities
jest.mock('../../utils/feature-detection.js', () => ({
  webRequest: {
    hasProxyInfoInDetails: false
  }
}));

// Mock other dependencies
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

describe('TrafficMonitor Browser Behavior', () => {
  let trafficMonitor;
  
  beforeEach(() => {
    jest.clearAllMocks();
    trafficMonitor = new TrafficMonitor();
  });

  describe('Chrome Behavior', () => {
    beforeEach(() => {
      // Mock Chrome capabilities (no proxyInfo support)
      browserCapabilities.webRequest.hasProxyInfoInDetails = false;
    });

    describe('resolveProxyFromDetails', () => {
      it('should categorize traffic as others when no proxy matches', () => {
        const details = { url: 'https://example.com', requestId: '123' };
        
        // Mock resolveProxyForRequest to return null (no match)
        trafficMonitor.resolveProxyForRequest = jest.fn().mockReturnValue(null);
        
        const result = trafficMonitor.resolveProxyFromDetails(details);
        
        expect(result).toEqual({ type: 'others' });
        expect(trafficMonitor.resolveProxyForRequest).toHaveBeenCalledWith(details);
      });

      it('should categorize traffic as configured when proxy matches', () => {
        const details = { url: 'https://example.com', requestId: '123' };
        const mockProxyId = 'proxy1';
        
        // Mock resolveProxyForRequest to return a proxy ID
        trafficMonitor.resolveProxyForRequest = jest.fn().mockReturnValue(mockProxyId);
        
        const result = trafficMonitor.resolveProxyFromDetails(details);
        
        expect(result).toEqual({ type: 'configured', proxyId: mockProxyId });
        expect(trafficMonitor.resolveProxyForRequest).toHaveBeenCalledWith(details);
      });

      it('should not categorize traffic as direct', () => {
        const details = { url: 'https://example.com' };
        
        trafficMonitor.resolveProxyForRequest = jest.fn().mockReturnValue(null);
        
        const result = trafficMonitor.resolveProxyFromDetails(details);
        
        expect(result.type).not.toBe('direct');
      });
    });

    describe('getAllTrafficSources', () => {
      it('should include others but not direct traffic sources', () => {
        const enabledProxies = [
          { id: 'proxy1', name: 'Test Proxy 1', color: '#000000' }
        ];

        const result = trafficMonitor.getAllTrafficSources(enabledProxies);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(enabledProxies[0]);
        expect(result[1]).toEqual({
          id: 'others',
          name: 'Others',
          color: SPECIAL_TRAFFIC_COLORS.OTHERS,
          isSpecial: true
        });
        
        // Should not include direct
        expect(result.find(source => source.id === 'direct')).toBeUndefined();
      });

      it('should work with empty proxy list', () => {
        const result = trafficMonitor.getAllTrafficSources([]);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          id: 'others',
          name: 'Others',
          color: SPECIAL_TRAFFIC_COLORS.OTHERS,
          isSpecial: true
        });
      });
    });
  });

  describe('Firefox Behavior', () => {
    beforeEach(() => {
      // Mock Firefox capabilities (has proxyInfo support)
      browserCapabilities.webRequest.hasProxyInfoInDetails = true;
    });

    describe('resolveProxyFromDetails', () => {
      it('should use proxyInfo when available', () => {
        const details = { 
          url: 'https://example.com',
          proxyInfo: { type: 'socks', host: '127.0.0.1', port: 1080 }
        };
        
        // Mock resolveProxyFromProxyInfo
        trafficMonitor.resolveProxyFromProxyInfo = jest.fn().mockReturnValue({ type: 'configured', proxyId: 'proxy1' });
        
        const result = trafficMonitor.resolveProxyFromDetails(details);
        
        expect(trafficMonitor.resolveProxyFromProxyInfo).toHaveBeenCalledWith(details);
        expect(result).toEqual({ type: 'configured', proxyId: 'proxy1' });
      });

      it('should categorize as direct when no proxyInfo', () => {
        const details = { url: 'https://example.com' };
        
        const result = trafficMonitor.resolveProxyFromDetails(details);
        
        expect(result).toEqual({ type: 'direct' });
      });
    });

    describe('getAllTrafficSources', () => {
      it('should include both direct and others traffic sources', () => {
        const enabledProxies = [
          { id: 'proxy1', name: 'Test Proxy 1', color: '#000000' }
        ];

        const result = trafficMonitor.getAllTrafficSources(enabledProxies);

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual(enabledProxies[0]);
        expect(result[1]).toEqual({
          id: 'direct',
          name: 'Direct',
          color: SPECIAL_TRAFFIC_COLORS.DIRECT,
          isSpecial: true
        });
        expect(result[2]).toEqual({
          id: 'others',
          name: 'Others',
          color: SPECIAL_TRAFFIC_COLORS.OTHERS,
          isSpecial: true
        });
      });
    });
  });

  describe('Fallback Behavior', () => {
    beforeEach(() => {
      // Simulate browser detection failure
      browserCapabilities.webRequest.hasProxyInfoInDetails = undefined;
    });

    describe('getAllTrafficSources', () => {
      it('should default to showing others category', () => {
        const enabledProxies = [];

        const result = trafficMonitor.getAllTrafficSources(enabledProxies);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          id: 'others',
          name: 'Others',
          color: SPECIAL_TRAFFIC_COLORS.OTHERS,
          isSpecial: true
        });
        
        // Should not include direct
        expect(result.find(source => source.id === 'direct')).toBeUndefined();
      });
    });
  });
});