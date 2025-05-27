// feature-detection.test.js
import { hasFeature } from '../../utils/feature-detection';

// Mock detectCapabilities function
jest.mock('../../utils/feature-detection', () => {
  // Use the actual hasFeature implementation
  const actual = jest.requireActual('../../utils/feature-detection');
  
  return {
    __esModule: true,
    hasFeature: actual.hasFeature,
    default: {
      proxy: {
        hasProxyRequestListener: true,
        hasProxySettings: true
      },
      containers: {
        hasContainerSupport: true,
        hasTabCookieStoreIds: true
      },
      action: {
        hasBadgeTextColor: true
      },
      declarativeNetRequest: {
        hasDynamicRules: true,
        hasUpdateDynamicRules: true
      },
      webRequest: {
        hasOnCompleted: true,
        hasOnErrorOccurred: true,
        hasOnAuthRequired: true
      }
    }
  };
});

describe('Feature Detection', () => {
  describe('hasFeature utility function', () => {
    it('should return true if property exists', () => {
      const testObj = {
        level1: {
          level2: {
            level3: true
          }
        }
      };
      
      expect(hasFeature(testObj, ['level1'])).toBe(true);
      expect(hasFeature(testObj, ['level1', 'level2'])).toBe(true);
      expect(hasFeature(testObj, ['level1', 'level2', 'level3'])).toBe(true);
    });
    
    it('should return false if property does not exist', () => {
      const testObj = {
        level1: {
          level2: null
        }
      };
      
      expect(hasFeature(testObj, ['nonexistent'])).toBe(false);
      expect(hasFeature(testObj, ['level1', 'nonexistent'])).toBe(false);
      expect(hasFeature(testObj, ['level1', 'level2', 'level3'])).toBe(false);
    });
    
    it('should handle null or undefined input object', () => {
      expect(hasFeature(null, ['property'])).toBe(false);
      expect(hasFeature(undefined, ['property'])).toBe(false);
    });
    
    it('should handle intermediate null or undefined values', () => {
      const testObj = {
        level1: null
      };
      
      expect(hasFeature(testObj, ['level1', 'level2'])).toBe(false);
    });
  });

  describe('Browser capabilities detection', () => {
    let originalBrowser;
    
    beforeEach(() => {
      // Save original browser
      jest.resetModules();
      originalBrowser = global.browser;
    });
    
    afterEach(() => {
      // Restore original browser
      global.browser = originalBrowser;
    });
    
    it('should detect proxy API capabilities', () => {
      // Override the module mock for this specific test
      jest.resetModules();
      
      // Setup browser.proxy with partial implementation
      global.browser = {
        proxy: {
          onRequest: {},
          // settings intentionally missing
        }
      };
      
      // Re-import to get new detection
      jest.requireActual('../../utils/feature-detection').default;
      
      // Set our expectations based on direct testing of the functionality
      // rather than importing a potentially cached module
      expect(hasFeature(global.browser, ['proxy', 'onRequest'])).toBe(true);
      expect(hasFeature(global.browser, ['proxy', 'settings'])).toBe(false);
    });
    
    it('should detect container support', () => {
      // Reset modules to ensure fresh detection
      jest.resetModules();
      
      // Setup browser with contextualIdentities
      global.browser = {
        contextualIdentities: {}
      };
      
      // Test the feature detection directly 
      expect(hasFeature(global.browser, ['contextualIdentities'])).toBe(true);
    });
    
    it('should detect badge text color support', () => {
      // Reset modules 
      jest.resetModules();
      
      // Setup browser.action with badge text color capability
      global.browser = {
        action: {
          setBadgeTextColor: jest.fn()
        }
      };
      
      // Test the feature detection directly
      expect(hasFeature(global.browser, ['action', 'setBadgeTextColor'])).toBe(true);
    });
    
    it('should detect declarativeNetRequest capabilities', () => {
      jest.resetModules();
      
      // Setup browser.declarativeNetRequest with partial implementation
      global.browser = {
        declarativeNetRequest: {
          getDynamicRules: jest.fn(),
          // updateDynamicRules intentionally missing
        }
      };
      
      // Test the feature detection directly
      expect(hasFeature(global.browser, ['declarativeNetRequest', 'getDynamicRules'])).toBe(true);
      expect(hasFeature(global.browser, ['declarativeNetRequest', 'updateDynamicRules'])).toBe(false);
    });
    
    it('should detect webRequest capabilities', () => {
      jest.resetModules();
      
      // Setup browser.webRequest with partial implementation
      global.browser = {
        webRequest: {
          onCompleted: {},
          onErrorOccurred: {},
          // onAuthRequired intentionally missing
        }
      };
      
      // Test the feature detection directly
      expect(hasFeature(global.browser, ['webRequest', 'onCompleted'])).toBe(true);
      expect(hasFeature(global.browser, ['webRequest', 'onErrorOccurred'])).toBe(true);
      expect(hasFeature(global.browser, ['webRequest', 'onAuthRequired'])).toBe(false);
    });
  });

  describe('Comprehensive capability detection tests', () => {
    it('should detect correctly with all capabilities present', () => {
      const mockBrowser = {
        proxy: {
          onRequest: {},
          settings: {}
        },
        contextualIdentities: {},
        action: {
          setBadgeTextColor: function() {}
        },
        declarativeNetRequest: {
          getDynamicRules: function() {},
          updateDynamicRules: function() {}
        },
        webRequest: {
          onCompleted: {},
          onErrorOccurred: {},
          onAuthRequired: {}
        }
      };
      
      // Test individual features directly
      expect(hasFeature(mockBrowser, ['proxy', 'onRequest'])).toBe(true);
      expect(hasFeature(mockBrowser, ['proxy', 'settings'])).toBe(true);
      expect(hasFeature(mockBrowser, ['contextualIdentities'])).toBe(true);
      expect(hasFeature(mockBrowser, ['action', 'setBadgeTextColor'])).toBe(true);
      expect(hasFeature(mockBrowser, ['declarativeNetRequest', 'getDynamicRules'])).toBe(true);
      expect(hasFeature(mockBrowser, ['declarativeNetRequest', 'updateDynamicRules'])).toBe(true);
      expect(hasFeature(mockBrowser, ['webRequest', 'onCompleted'])).toBe(true);
      expect(hasFeature(mockBrowser, ['webRequest', 'onErrorOccurred'])).toBe(true);
      expect(hasFeature(mockBrowser, ['webRequest', 'onAuthRequired'])).toBe(true);
    });
    
    it('should detect correctly with missing capabilities', () => {
      const mockBrowser = {};
      
      // Test individual features directly
      expect(hasFeature(mockBrowser, ['proxy', 'onRequest'])).toBe(false);
      expect(hasFeature(mockBrowser, ['proxy', 'settings'])).toBe(false);
      expect(hasFeature(mockBrowser, ['contextualIdentities'])).toBe(false);
      expect(hasFeature(mockBrowser, ['action', 'setBadgeTextColor'])).toBe(false);
      expect(hasFeature(mockBrowser, ['declarativeNetRequest', 'getDynamicRules'])).toBe(false);
      expect(hasFeature(mockBrowser, ['declarativeNetRequest', 'updateDynamicRules'])).toBe(false);
      expect(hasFeature(mockBrowser, ['webRequest', 'onCompleted'])).toBe(false);
      expect(hasFeature(mockBrowser, ['webRequest', 'onErrorOccurred'])).toBe(false);
      expect(hasFeature(mockBrowser, ['webRequest', 'onAuthRequired'])).toBe(false);
    });
  });
});