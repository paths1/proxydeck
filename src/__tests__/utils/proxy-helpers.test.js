// proxy-helpers.test.js
import * as browser from 'webextension-polyfill';
import * as proxyHelpers from '../../utils/proxy-helpers';
import browserCapabilities from '../../utils/feature-detection';

// Mock webextension-polyfill
jest.mock('webextension-polyfill', () => ({
  proxy: {
    onRequest: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn()
    },
    onError: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn()
    },
    settings: {
      get: jest.fn().mockResolvedValue({ value: { mode: 'direct' } }),
      set: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      onChange: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn()
      }
    }
  }
}));

// Mock browser capabilities
jest.mock('../../utils/feature-detection', () => ({
  __esModule: true,
  default: {
    proxy: {
      hasProxyRequestListener: false,
      hasProxySettings: true
    }
  }
}));

describe('Proxy Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Don't delete browser.proxy after tests - just reset its mocks
    jest.resetAllMocks();
  });

  describe('adaptProxySettingsForFirefox', () => {
    it('should adapt direct mode settings', () => {
      const chromeSettings = {
        value: {
          mode: 'direct'
        }
      };
      
      const result = proxyHelpers.adaptProxySettingsForFirefox(chromeSettings);
      
      expect(result.value).toEqual({
        proxyType: 'none'
      });
    });
    
    it('should adapt PAC script settings with data', () => {
      const chromeSettings = {
        value: {
          mode: 'pac_script',
          pacScript: {
            data: 'function FindProxyForURL(url, host) { return "DIRECT"; }'
          }
        }
      };
      
      const result = proxyHelpers.adaptProxySettingsForFirefox(chromeSettings);
      
      expect(result.value).toEqual({
        proxyType: 'autoConfig',
        autoConfigUrl: '',
        autoConfigData: 'function FindProxyForURL(url, host) { return "DIRECT"; }'
      });
    });
    
    it('should adapt PAC script settings with URL', () => {
      const chromeSettings = {
        value: {
          mode: 'pac_script',
          pacScript: {
            url: 'https://example.com/proxy.pac'
          }
        }
      };
      
      const result = proxyHelpers.adaptProxySettingsForFirefox(chromeSettings);
      
      expect(result.value).toEqual({
        proxyType: 'autoConfig',
        autoConfigUrl: 'https://example.com/proxy.pac',
        autoConfigData: ''
      });
    });
    
    it('should adapt fixed server settings', () => {
      const chromeSettings = {
        value: {
          mode: 'fixed_servers',
          rules: {
            singleProxy: {
              host: 'proxy.example.com',
              port: 8080
            },
            bypassList: ['*.local', 'localhost']
          }
        }
      };
      
      const result = proxyHelpers.adaptProxySettingsForFirefox(chromeSettings);
      
      expect(result.value).toEqual({
        proxyType: 'manual',
        http: 'proxy.example.com',
        httpPort: 8080,
        ssl: 'proxy.example.com',
        sslPort: 8080,
        socks: 'proxy.example.com',
        socksPort: 8080,
        socksVersion: 5,
        passthrough: '*.local, localhost'
      });
    });
    
    it('should handle missing proxy rules gracefully', () => {
      const chromeSettings = {
        value: {
          mode: 'fixed_servers',
          // Missing rules
        }
      };
      
      const result = proxyHelpers.adaptProxySettingsForFirefox(chromeSettings);
      
      expect(result.value).toEqual({
        proxyType: 'manual',
        http: '',
        httpPort: 0,
        ssl: '',
        sslPort: 0,
        socks: '',
        socksPort: 0,
        socksVersion: 5,
        passthrough: ''
      });
    });
  });

  describe('setupProxyRequestListener', () => {
    it('should set up listener when capability exists', () => {
      // Override capability for this test
      browserCapabilities.proxy.hasProxyRequestListener = true;
      
      const handlerFunc = jest.fn();
      const result = proxyHelpers.setupProxyRequestListener(handlerFunc);
      
      expect(result).toBe(true);
      expect(browser.proxy.onRequest.addListener).toHaveBeenCalledWith(
        handlerFunc,
        { urls: ["<all_urls>"] }
      );
      expect(browser.proxy.onError.addListener).toHaveBeenCalled();
      
      // Reset capability
      browserCapabilities.proxy.hasProxyRequestListener = false;
    });
    
    it('should not set up listener when capability does not exist', () => {
      // Ensure capability is false
      browserCapabilities.proxy.hasProxyRequestListener = false;
      
      const handlerFunc = jest.fn();
      const result = proxyHelpers.setupProxyRequestListener(handlerFunc);
      
      expect(result).toBe(false);
      expect(browser.proxy.onRequest.addListener).not.toHaveBeenCalled();
      expect(browser.proxy.onError.addListener).not.toHaveBeenCalled();
    });
  });

  describe('applyProxySettings', () => {
    it('should clear settings when proxy request listener is available', async () => {
      // Override capability for this test
      browserCapabilities.proxy.hasProxyRequestListener = true;
      
      await proxyHelpers.applyProxySettings({});
      
      expect(browser.proxy.settings.clear).toHaveBeenCalledWith({});
      expect(browser.proxy.settings.set).not.toHaveBeenCalled();
      
      // Reset capability
      browserCapabilities.proxy.hasProxyRequestListener = false;
    });
    
    it('should set PAC script when proxy request listener is not available', async () => {
      // Ensure capability is false
      browserCapabilities.proxy.hasProxyRequestListener = false;
      
      const config = {
        pacScript: 'function FindProxyForURL(url, host) { return "DIRECT"; }'
      };
      
      await proxyHelpers.applyProxySettings(config);
      
      expect(browser.proxy.settings.set).toHaveBeenCalledWith({
        value: {
          mode: 'pac_script',
          pacScript: {
            data: config.pacScript
          }
        },
        scope: 'regular'
      });
      expect(browser.proxy.settings.clear).not.toHaveBeenCalled();
    });
    
    it('should handle API errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('API error');
      browser.proxy.settings.set.mockRejectedValue(error);
      
      await expect(proxyHelpers.applyProxySettings({})).rejects.toThrow(error);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error applying proxy settings'),
        error
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('disableProxy', () => {
    it('should set direct mode', async () => {
      await proxyHelpers.disableProxy();
      
      expect(browser.proxy.settings.set).toHaveBeenCalledWith({
        value: {
          mode: 'direct'
        },
        scope: 'regular'
      });
    });
    
    it('should handle API errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('API error');
      browser.proxy.settings.set.mockRejectedValue(error);
      
      await expect(proxyHelpers.disableProxy()).rejects.toThrow(error);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error disabling proxy'),
        error
      );
      
      consoleSpy.mockRestore();
    });
  });
});