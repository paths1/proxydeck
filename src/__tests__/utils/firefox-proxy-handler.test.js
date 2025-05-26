// firefox-proxy-handler.test.js
import * as browser from 'webextension-polyfill';
import * as firefoxProxyHandler from '../../utils/firefox-proxy-handler';
import PatternMatcher from '../../modules/PatternMatcher';
import browserCapabilities from '../../utils/feature-detection';

// Mock dependencies
jest.mock('../../modules/PatternMatcher', () => {
  return jest.fn().mockImplementation(() => ({
    matchesAnyPattern: jest.fn(),
    resolveProxyForHost: jest.fn()
  }));
});

jest.mock('../../utils/feature-detection', () => ({
  __esModule: true,
  default: {
    containers: {
      hasContainerSupport: true
    },
    proxy: {
      hasProxyRequestListener: true
    }
  }
}));

// Mock browser API
global.browser = {
  proxy: {
    onRequest: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onError: {
      addListener: jest.fn()
    }
  }
};

describe('Firefox Proxy Handler', () => {
  let mockPatternMatcher;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocked browser API functions
    browser.proxy.onRequest.addListener.mockClear();
    browser.proxy.onRequest.removeListener.mockClear();
    browser.proxy.onError.addListener.mockClear();
    
    // Create a spy on console.error
    jest.spyOn(console, 'error').mockImplementation();
    
    // Create a new pattern matcher mock for each test
    mockPatternMatcher = {
      matchesAnyPattern: jest.fn(),
      resolveProxyForHost: jest.fn()
    };
    
    // Reset the PatternMatcher constructor mock
    PatternMatcher.mockClear();
    PatternMatcher.mockImplementation(() => mockPatternMatcher);
  });
  
  afterEach(() => {
    console.error.mockRestore();
  });

  describe('initializeProxyHandler', () => {
    it('should not set up listeners if proxy request listener capability is not available', () => {
      // Temporarily modify capability
      const originalCapability = browserCapabilities.proxy.hasProxyRequestListener;
      browserCapabilities.proxy.hasProxyRequestListener = false;
      
      firefoxProxyHandler.initializeProxyHandler({}, []);
      
      expect(browser.proxy.onRequest.addListener).not.toHaveBeenCalled();
      expect(browser.proxy.onError.addListener).not.toHaveBeenCalled();
      
      // Restore capability
      browserCapabilities.proxy.hasProxyRequestListener = originalCapability;
    });
    
    it('should set up proxy request and error listeners', () => {
      const config = { proxyEnabled: true };
      const proxies = [{ enabled: true }];
      
      firefoxProxyHandler.initializeProxyHandler(config, proxies);
      
      expect(browser.proxy.onRequest.addListener).toHaveBeenCalled();
      expect(browser.proxy.onError.addListener).toHaveBeenCalled();
    });
    
    it('should create a new PatternMatcher instance if not provided', () => {
      firefoxProxyHandler.initializeProxyHandler({}, []);
      
      expect(PatternMatcher).toHaveBeenCalled();
    });
    
    it('should use the provided PatternMatcher instance if available', () => {
      const customMatcher = new PatternMatcher();
      PatternMatcher.mockClear(); // Clear constructor calls
      
      firefoxProxyHandler.initializeProxyHandler({}, [], customMatcher);
      
      expect(PatternMatcher).not.toHaveBeenCalled();
    });
  });

  describe('handlingProxyRequests', () => {
    // Setup state for testing proxy request handling
    const setupProxyHandler = (config, proxies) => {
      firefoxProxyHandler.initializeProxyHandler(
        config || { proxyEnabled: true },
        proxies || [],
        mockPatternMatcher
      );
    };
    
    it('should return direct when proxy is disabled', () => {
      setupProxyHandler({ proxyEnabled: false }, []);
      
      const requestInfo = { url: 'https://example.com' };
      
      // Using our exported version directly
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      expect(result).toEqual({ type: 'direct' });
    });
    
    it('should return direct when no proxies are provided', () => {
      setupProxyHandler({ proxyEnabled: true }, []);
      
      const requestInfo = { url: 'https://example.com' };
      
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      expect(result).toEqual({ type: 'direct' });
    });
    
    it('should handle invalid URLs gracefully', () => {
      // Make sure proxy has proper structure to avoid errors in patternProxies.filter
      setupProxyHandler(
        { proxyEnabled: true }, 
        [{ 
          enabled: true,
          routingConfig: {
            useContainerMode: false,
            patterns: []
          }
        }]
      );
      
      const requestInfo = { url: 'invalid://url' };
      
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      expect(result).toEqual({ type: 'direct' });
      // Don't test for console.error since it's an implementation detail
    });
    
    it('should match container-based proxies', () => {
      const proxies = [
        {
          enabled: true,
          host: 'proxy1.example.com',
          port: 1080,
          username: 'user1',
          password: 'pass1',
          priority: 1,
          routingConfig: {
            useContainerMode: true,
            containers: ['container1', 'container2']
          }
        }
      ];
      
      setupProxyHandler({ proxyEnabled: true }, proxies);
      
      const requestInfo = {
        url: 'https://example.com',
        cookieStoreId: 'container1'
      };
      
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      expect(result).toEqual({
        type: 'socks',
        host: 'proxy1.example.com',
        port: 1080,
        proxyDNS: true,
        username: 'user1',
        password: 'pass1'
      });
    });
    
    it('should match pattern-based proxies', () => {
      const proxies = [
        {
          enabled: true,
          host: 'proxy2.example.com',
          port: 8080,
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com', 'test\\.org']
          }
        }
      ];
      
      mockPatternMatcher.resolveProxyForHost.mockReturnValue(proxies[0]);
      
      setupProxyHandler({ proxyEnabled: true }, proxies);
      
      const requestInfo = {
        url: 'https://example.com'
      };
      
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      expect(mockPatternMatcher.resolveProxyForHost).toHaveBeenCalledWith(
        'example.com',
        proxies
      );
      
      expect(result).toEqual({
        type: 'socks',
        host: 'proxy2.example.com',
        port: 8080,
        proxyDNS: true
      });
    });
    
    it('should prioritize proxies by priority', () => {
      const proxies = [
        {
          enabled: true,
          host: 'proxy1.example.com',
          port: 1080,
          priority: 2, // Lower priority (higher number)
          routingConfig: {
            useContainerMode: true,
            containers: ['container1']
          }
        },
        {
          enabled: true,
          host: 'proxy2.example.com',
          port: 8080,
          priority: 1, // Higher priority (lower number)
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        }
      ];
      
      // Return only the pattern proxy for resolveProxyForHost
      mockPatternMatcher.resolveProxyForHost.mockReturnValue(proxies[1]);
      
      setupProxyHandler({ proxyEnabled: true }, proxies);
      
      const requestInfo = {
        url: 'https://example.com',
        cookieStoreId: 'container1'
      };
      
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      // Should use proxy2 which has higher priority
      expect(result.host).toBe('proxy2.example.com');
    });
    
    it('should include credentials when provided', () => {
      const proxies = [
        {
          enabled: true,
          host: 'proxy.example.com',
          port: 1080,
          username: 'testuser',
          password: 'testpass',
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        }
      ];
      
      mockPatternMatcher.resolveProxyForHost.mockReturnValue(proxies[0]);
      
      setupProxyHandler({ proxyEnabled: true }, proxies);
      
      const requestInfo = {
        url: 'https://example.com'
      };
      
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      expect(result).toHaveProperty('username', 'testuser');
      expect(result).toHaveProperty('password', 'testpass');
    });
    
    it('should not include credentials when not provided', () => {
      const proxies = [
        {
          enabled: true,
          host: 'proxy.example.com',
          port: 1080,
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        }
      ];
      
      mockPatternMatcher.resolveProxyForHost.mockReturnValue(proxies[0]);
      
      setupProxyHandler({ proxyEnabled: true }, proxies);
      
      const requestInfo = {
        url: 'https://example.com'
      };
      
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      expect(result).not.toHaveProperty('username');
      expect(result).not.toHaveProperty('password');
    });
    
    it('should handle SOCKS4 proxy type correctly', () => {
      const proxies = [
        {
          enabled: true,
          host: 'socks4.example.com',
          port: 1080,
          proxyType: 'socks4',
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        }
      ];
      
      mockPatternMatcher.resolveProxyForHost.mockReturnValue(proxies[0]);
      
      setupProxyHandler({ proxyEnabled: true }, proxies);
      
      const requestInfo = {
        url: 'https://example.com'
      };
      
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      expect(result).toEqual({
        type: 'socks4',
        host: 'socks4.example.com',
        port: 1080,
        proxyDNS: true
      });
    });
    
    it('should return direct when no proxies match', () => {
      const proxies = [
        {
          enabled: true,
          host: 'proxy1.example.com',
          port: 1080,
          routingConfig: {
            useContainerMode: true,
            containers: ['container1']
          }
        },
        {
          enabled: true,
          host: 'proxy2.example.com',
          port: 8080,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        }
      ];
      
      mockPatternMatcher.resolveProxyForHost.mockReturnValue(null);
      
      setupProxyHandler({ proxyEnabled: true }, proxies);
      
      const requestInfo = {
        url: 'https://nomatch.com',
        cookieStoreId: 'other-container'
      };
      
      const result = firefoxProxyHandler._testExports.getHandlerForTests()(requestInfo);
      
      expect(result).toEqual({ type: 'direct' });
    });
  });

  describe('cleanupProxyHandler', () => {
    it('should remove the request listener if capability exists', () => {
      // Initialize first to ensure everything is set up
      firefoxProxyHandler.initializeProxyHandler({}, []);
      
      // Then clean up
      firefoxProxyHandler.cleanupProxyHandler();
      
      expect(browser.proxy.onRequest.removeListener).toHaveBeenCalled();
    });
    
    it('should do nothing if proxy request listener capability is not present', () => {
      // Temporarily modify capability
      const originalCapability = browserCapabilities.proxy.hasProxyRequestListener;
      browserCapabilities.proxy.hasProxyRequestListener = false;
      
      firefoxProxyHandler.cleanupProxyHandler();
      
      expect(browser.proxy.onRequest.removeListener).not.toHaveBeenCalled();
      
      // Restore capability
      browserCapabilities.proxy.hasProxyRequestListener = originalCapability;
    });
  });
});