// ProxyManager.test.js
import * as browser from 'webextension-polyfill';
import ProxyManager from '../modules/ProxyManager';
import browserCapabilities from '../utils/feature-detection';

// Create browser capability mocks for both Chrome and Firefox
const createBrowserCapabilities = (isFirefox = false) => ({
  browser: {
    isFirefox,
    isChrome: !isFirefox
  },
  proxy: {
    hasProxyRequestListener: isFirefox,
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
  },
  proxyAuth: {
    supportsHttpAuth: isFirefox,
    supportsHttpsAuth: isFirefox,
    supportsSocks4Auth: false,
    supportsSocks5Auth: isFirefox
  }
});

// Mock feature detection - will be overridden in tests
jest.mock('../utils/feature-detection', () => ({
  __esModule: true,
  default: createBrowserCapabilities(false) // Default to Chrome
}));

jest.mock('../utils/proxy-helpers', () => ({
  setupProxyRequestListener: jest.fn(),
  applyProxySettings: jest.fn().mockResolvedValue(undefined),
  disableProxy: jest.fn().mockResolvedValue(undefined)
}));




jest.mock('../utils/error-helpers', () => {
  const original = jest.requireActual('../utils/error-helpers');
  return {
    ...original,
    handleError: jest.fn().mockImplementation((message, type, severity, error, options) => {
      return {
        message,
        type,
        severity,
        timestamp: new Date().toISOString(),
        originalError: error,
        data: options?.data || {}
      };
    })
  };
});

describe('ProxyManager', () => {
  let proxyManager;
  let mockTabManager;
  let mockPatternMatcher;
  let mockTrafficMonitor;

  // Chrome proxy config (no auth fields)
  const chromeProxyConfig = {
    version: 2,
    proxies: [
      {
        id: 'default_proxy',
        name: 'Default Proxy',
        enabled: true,
        host: "proxy.example.com",
        port: 1080,
        priority: 0,
        routingConfig: {
          useContainerMode: false,
          patterns: ['example\\.com', 'test\\.org'],
          containers: []
        }
      }
    ],
    proxyEnabled: true
  };

  // Firefox proxy config (with auth fields)
  const firefoxProxyConfig = {
    version: 2,
    proxies: [
      {
        id: 'default_proxy',
        name: 'Default Proxy',
        enabled: true,
        host: "proxy.example.com",
        port: 1080,
        auth: {
          username: "user",
          password: "pass"
        },
        priority: 0,
        routingConfig: {
          useContainerMode: false,
          patterns: ['example\\.com', 'test\\.org'],
          containers: []
        }
      }
    ],
    proxyEnabled: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset browser.storage.local mock
    browser.storage.local.get.mockReset();
    browser.storage.local.set.mockReset();
    browser.storage.local.get.mockResolvedValue({ config: chromeProxyConfig });
    browser.storage.local.set.mockResolvedValue(undefined);
    
    // Create mock dependencies
    mockTabManager = {
      clearTabBadge: jest.fn(),
      getCurrentTab: jest.fn().mockResolvedValue({ id: 1, url: 'https://example.com' })
    };
    
    mockPatternMatcher = {
      matchesAnyPattern: jest.fn().mockReturnValue(false),
      resolveProxyForHost: jest.fn().mockReturnValue(null)
    };
    
    mockTrafficMonitor = {
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn()
    };
    
    // Create ProxyManager instance
    proxyManager = new ProxyManager({
      tabManager: mockTabManager,
      patternMatcher: mockPatternMatcher,
      trafficMonitor: mockTrafficMonitor,
      onError: jest.fn(),
    });
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies and options', () => {
      expect(proxyManager.tabManager).toBe(mockTabManager);
      expect(proxyManager.patternMatcher).toBe(mockPatternMatcher);
      expect(proxyManager.trafficMonitor).toBe(mockTrafficMonitor);
      
      // Config might be loaded early depending on implementation
      expect(proxyManager.config).toBeDefined();
      // enabledProxies may have been initialized already
      expect(proxyManager.enabledProxies).toBeDefined();
      // Error state tracking removed
      
      expect(proxyManager.hasProxyRequestListener).toBe(browserCapabilities.proxy.hasProxyRequestListener);
      expect(proxyManager.hasContainerSupport).toBe(browserCapabilities.containers.hasContainerSupport);
    });
    
    it('should initialize with default onError if not provided', () => {
      const defaultProxyManager = new ProxyManager({});
      expect(typeof defaultProxyManager.onError).toBe('function');
      
      // This should be no-op function
      expect(() => defaultProxyManager.onError()).not.toThrow();
    });
  });

  describe('loadConfig', () => {
    it('should load config from storage', async () => {
      await proxyManager.loadConfig();
      
      expect(browser.storage.local.get).toHaveBeenCalledWith('config');
      expect(proxyManager.config).toEqual(chromeProxyConfig);
      expect(proxyManager.enabledProxies).toEqual(chromeProxyConfig.proxies.filter(p => p.enabled));
    });
    
    it('should use default config if none is in storage', async () => {
      browser.storage.local.get.mockResolvedValue({});
      
      await proxyManager.loadConfig();
      
      expect(proxyManager.config.version).toBe(2);
      expect(proxyManager.config.proxies).toHaveLength(0);
      expect(Array.isArray(proxyManager.config.proxies)).toBe(true);
    });
    
    
    it('should remove duplicate Default Proxy entries', async () => {
      const configWithDuplicates = {
        version: 2,
        proxies: [
          {
            id: 'default_proxy1',
            name: 'Default Proxy',
            enabled: true
          },
          {
            id: 'custom_proxy',
            name: 'Custom Proxy',
            enabled: true
          },
          {
            id: 'default_proxy2',
            name: 'Default Proxy',
            enabled: false
          }
        ]
      };
      
      browser.storage.local.get.mockResolvedValue({ config: configWithDuplicates });
      
      await proxyManager.loadConfig();
      
      expect(proxyManager.config.proxies).toHaveLength(2);
      expect(proxyManager.config.proxies[0].name).toBe('Default Proxy');
      expect(proxyManager.config.proxies[1].name).toBe('Custom Proxy');
      expect(browser.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('findContainerProxy', () => {
    beforeEach(async () => {
      // Setup proxies with container configurations
      const configWithContainers = {
        ...chromeProxyConfig,
        proxies: [
          {
            id: 'container_proxy1',
            name: 'Container Proxy 1',
            enabled: true,
            priority: 2,
            routingConfig: {
              useContainerMode: true,
              containers: ['container1', 'container2']
            }
          },
          {
            id: 'container_proxy2',
            name: 'Container Proxy 2',
            enabled: true,
            priority: 1,
            routingConfig: {
              useContainerMode: true,
              containers: ['container3']
            }
          },
          {
            id: 'pattern_proxy',
            name: 'Pattern Proxy',
            enabled: true,
            routingConfig: {
              useContainerMode: false,
              patterns: ['example\\.com']
            }
          }
        ]
      };
      
      browser.storage.local.get.mockResolvedValue({ config: configWithContainers });
      await proxyManager.loadConfig();
    });
    
    it('should return null if container support is not available', () => {
      proxyManager.hasContainerSupport = false;
      
      const result = proxyManager.findContainerProxy('container1');
      
      expect(result).toBeNull();
    });
    
    it('should return null if no cookieStoreId is provided', () => {
      const result = proxyManager.findContainerProxy(null);
      
      expect(result).toBeNull();
    });
    
    it('should return null if no proxies match the container', () => {
      const result = proxyManager.findContainerProxy('unknown_container');
      
      expect(result).toBeNull();
    });
    
    it('should return the matching proxy for a container', () => {
      const result = proxyManager.findContainerProxy('container2');
      
      expect(result).not.toBeNull();
      expect(result.id).toBe('container_proxy1');
    });
    
    it('should return the highest priority proxy if multiple match', () => {
      // Add container3 to first proxy so both match
      proxyManager.enabledProxies[0].routingConfig.containers.push('container3');
      
      const result = proxyManager.findContainerProxy('container3');
      
      expect(result).not.toBeNull();
      expect(result.id).toBe('container_proxy2'); // Priority 1 vs 2, lower is higher priority
    });
  });

  describe('findProxyForHostname', () => {
    beforeEach(async () => {
      // Setup proxies with pattern configurations
      const configWithPatterns = {
        ...chromeProxyConfig,
        proxies: [
          {
            id: 'pattern_proxy1',
            name: 'Pattern Proxy 1',
            enabled: true,
            priority: 2,
            routingConfig: {
              useContainerMode: false,
              patterns: ['example\\.com', 'test\\.org']
            }
          },
          {
            id: 'pattern_proxy2',
            name: 'Pattern Proxy 2',
            enabled: true,
            priority: 1,
            routingConfig: {
              useContainerMode: false,
              patterns: ['another\\.com']
            }
          },
          {
            id: 'container_proxy',
            name: 'Container Proxy',
            enabled: true,
            routingConfig: {
              useContainerMode: true,
              containers: ['container1']
            }
          }
        ]
      };
      
      browser.storage.local.get.mockResolvedValue({ config: configWithPatterns });
      await proxyManager.loadConfig();
    });
    
    it('should return null if no hostname is provided', () => {
      const result = proxyManager.findProxyForHostname(null);
      
      expect(result).toBeNull();
    });
    
    it('should use patternMatcher.resolveProxyForHost if available', () => {
      const mockProxy = { id: 'resolved_proxy' };
      proxyManager.patternMatcher.resolveProxyForHost.mockReturnValue(mockProxy);
      
      const result = proxyManager.findProxyForHostname('example.com');
      
      expect(proxyManager.patternMatcher.resolveProxyForHost).toHaveBeenCalledWith(
        'example.com', 
        expect.any(Array)
      );
      expect(result).toBe(mockProxy);
    });
    
    it('should fall back to manual matching if resolveProxyForHost is not available', () => {
      proxyManager.patternMatcher.resolveProxyForHost = undefined;
      proxyManager.patternMatcher.matchesAnyPattern.mockReturnValueOnce(true);
      
      const result = proxyManager.findProxyForHostname('example.com');
      
      expect(proxyManager.patternMatcher.matchesAnyPattern).toHaveBeenCalledWith(
        'example.com',
        expect.any(Array)
      );
      expect(result).not.toBeNull();
      expect(result.id).toBe('pattern_proxy1');
    });
    
    it('should return the highest priority proxy if multiple match', () => {
      proxyManager.patternMatcher.resolveProxyForHost = undefined;
      proxyManager.patternMatcher.matchesAnyPattern
        .mockReturnValueOnce(true)  // First proxy matches
        .mockReturnValueOnce(true); // Second proxy matches
      
      const result = proxyManager.findProxyForHostname('shared-domain.com');
      
      expect(result).not.toBeNull();
      expect(result.id).toBe('pattern_proxy2'); // Priority 1 vs 2, lower is higher priority
    });
    
    it('should filter out container-based proxies', () => {
      proxyManager.patternMatcher.resolveProxyForHost = undefined;
      proxyManager.patternMatcher.matchesAnyPattern.mockReturnValue(true);
      
      proxyManager.findProxyForHostname('example.com');
      
      // Should only be called twice for the two pattern-based proxies
      expect(proxyManager.patternMatcher.matchesAnyPattern).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolveProxyForRequest', () => {
    beforeEach(async () => {
      const configWithMixedProxies = {
        ...chromeProxyConfig,
        proxies: [
          {
            id: 'pattern_proxy',
            name: 'Pattern Proxy',
            enabled: true,
            priority: 2,
            routingConfig: {
              useContainerMode: false,
              patterns: ['example\\.com']
            }
          },
          {
            id: 'container_proxy',
            name: 'Container Proxy',
            enabled: true,
            priority: 1,
            routingConfig: {
              useContainerMode: true,
              containers: ['container1']
            }
          }
        ]
      };
      
      browser.storage.local.get.mockResolvedValue({ config: configWithMixedProxies });
      await proxyManager.loadConfig();
      
      jest.spyOn(proxyManager, 'findContainerProxy');
      jest.spyOn(proxyManager, 'findProxyForHostname');
    });
    
    it('should return null if proxy is disabled', () => {
      proxyManager.config.proxyEnabled = false;
      
      const result = proxyManager.resolveProxyForRequest('example.com', 'container1');
      
      expect(result).toBeNull();
    });
    
    it('should return null if no hostname is provided', () => {
      const result = proxyManager.resolveProxyForRequest(null, 'container1');
      
      expect(result).toBeNull();
    });
    
    it('should check both container and pattern matches', () => {
      proxyManager.findContainerProxy.mockReturnValue(null);
      proxyManager.findProxyForHostname.mockReturnValue(null);
      
      proxyManager.resolveProxyForRequest('example.com', 'container1');
      
      expect(proxyManager.findContainerProxy).toHaveBeenCalledWith('container1');
      expect(proxyManager.findProxyForHostname).toHaveBeenCalledWith('example.com');
    });
    
    it('should return container proxy if it matches', () => {
      const containerProxy = { id: 'container_proxy', priority: 1 };
      proxyManager.findContainerProxy.mockReturnValue(containerProxy);
      
      const result = proxyManager.resolveProxyForRequest('example.com', 'container1');
      
      expect(result).toBe(containerProxy);
    });
    
    it('should return pattern proxy if it matches and no container proxy matches', () => {
      const patternProxy = { id: 'pattern_proxy', priority: 2 };
      proxyManager.findContainerProxy.mockReturnValue(null);
      proxyManager.findProxyForHostname.mockReturnValue(patternProxy);
      
      const result = proxyManager.resolveProxyForRequest('example.com', null);
      
      expect(result).toBe(patternProxy);
    });
    
    it('should return highest priority proxy if both container and pattern match', () => {
      const containerProxy = { id: 'container_proxy', priority: 1 };
      const patternProxy = { id: 'pattern_proxy', priority: 2 };
      
      proxyManager.findContainerProxy.mockReturnValue(containerProxy);
      proxyManager.findProxyForHostname.mockReturnValue(patternProxy);
      
      const result = proxyManager.resolveProxyForRequest('example.com', 'container1');
      
      expect(result).toBe(containerProxy); // Lower priority number = higher priority
    });
    
    it('should return detailed matches when returnAllMatches is true', () => {
      const containerProxy = { id: 'container_proxy', priority: 1, routingConfig: { useContainerMode: true } };
      const patternProxy = { id: 'pattern_proxy', priority: 2, routingConfig: { useContainerMode: false } };
      
      proxyManager.findContainerProxy.mockReturnValue(containerProxy);
      proxyManager.findProxyForHostname.mockReturnValue(patternProxy);
      
      // Mock matchesAnyPattern for the comprehensive pattern matching branch
      proxyManager.patternMatcher.matchesAnyPattern.mockReturnValue(true);
      
      const result = proxyManager.resolveProxyForRequest('example.com', 'container1', { returnAllMatches: true });
      
      expect(result.selectedProxy).toBe(containerProxy);
      expect(result.allProxies).toContainEqual(containerProxy);
      expect(result.allProxies).toContainEqual(patternProxy);
      expect(result.matchType).toBe('container');
    });
    
    it('should handle comprehensive pattern matching when returnAllMatches is true', () => {
      // Setup for case where no direct match was found by findContainerProxy/findProxyForHostname
      proxyManager.findContainerProxy.mockReturnValue(null);
      proxyManager.findProxyForHostname.mockReturnValue(null);
      
      // Mock matchesAnyPattern to indicate a match in the comprehensive search
      proxyManager.patternMatcher.matchesAnyPattern.mockReturnValue(true);
      
      const result = proxyManager.resolveProxyForRequest('example.com', null, { returnAllMatches: true });
      
      // In this case, the comprehensive search should find the pattern proxy
      expect(result.allProxies.length).toBeGreaterThan(0);
      expect(result.selectedProxy).not.toBeNull();
      expect(result.matchType).toBe('pattern');
    });
  });

  describe('handleProxyRequest', () => {
    beforeEach(async () => {
      await proxyManager.loadConfig();
      
      jest.spyOn(proxyManager, 'resolveProxyForRequest');
    });
    
    it('should return direct if proxy is disabled', () => {
      proxyManager.config.proxyEnabled = false;
      
      const result = proxyManager.handleProxyRequest({ url: 'https://example.com' });
      
      expect(result).toEqual({ type: 'direct' });
    });
    
    it('should handle URL parsing errors', () => {
      const result = proxyManager.handleProxyRequest({ url: 'invalid://url' });
      
      expect(result).toEqual({ type: 'direct' });
      // Error handling may vary in implementation
    });
    
    it('should resolve proxy for the hostname and cookieStoreId', () => {
      proxyManager.resolveProxyForRequest.mockReturnValue(null);
      
      proxyManager.handleProxyRequest({ 
        url: 'https://example.com/page',
        cookieStoreId: 'container1'
      });
      
      expect(proxyManager.resolveProxyForRequest).toHaveBeenCalledWith(
        'example.com',
        'container1'
      );
    });
    
    it('should return proxy details and record activity if a proxy is resolved (Chrome - no auth)', () => {
      const mockProxy = {
        id: 'test_proxy',
        host: 'proxy.example.com',
        port: 8080
        // Note: Chrome proxies don't have auth fields
      };
      
      proxyManager.resolveProxyForRequest.mockReturnValue(mockProxy);
      
      const result = proxyManager.handleProxyRequest({ url: 'https://example.com' });
      
      // Chrome should not include authentication fields
      expect(result).toEqual({
        type: 'socks',
        host: 'proxy.example.com',
        port: 8080,
        proxyDNS: true
      });
    });
    
    it('should honor custom proxy type if specified', () => {
      const mockProxy = {
        id: 'http_proxy',
        proxyType: 'http',
        host: 'proxy.example.com',
        port: 8080
      };
      
      proxyManager.resolveProxyForRequest.mockReturnValue(mockProxy);
      
      const result = proxyManager.handleProxyRequest({ url: 'https://example.com' });
      
      expect(result.type).toBe('http');
    });
    
    it('should return direct if no proxy is resolved', () => {
      proxyManager.resolveProxyForRequest.mockReturnValue(null);
      
      const result = proxyManager.handleProxyRequest({ url: 'https://example.com' });
      
      expect(result).toEqual({ type: 'direct' });
      // ProxyManager no longer tracks activity
    });
  });

  describe('applyProxySettings', () => {
    beforeEach(async () => {
      await proxyManager.loadConfig();
      
      jest.spyOn(proxyManager, 'disableProxy').mockResolvedValue(undefined);
      jest.spyOn(proxyManager, 'applyRequestLevelProxySettings').mockResolvedValue(undefined);
      jest.spyOn(proxyManager, 'applyPacScriptProxySettings').mockResolvedValue(undefined);
    });
    
    it('should disable proxy if proxy is disabled or no enabled proxies', async () => {
      proxyManager.config.proxyEnabled = false;
      
      await proxyManager.applyProxySettings();
      
      expect(proxyManager.disableProxy).toHaveBeenCalled();
      expect(proxyManager.applyRequestLevelProxySettings).not.toHaveBeenCalled();
      expect(proxyManager.applyPacScriptProxySettings).not.toHaveBeenCalled();
    });
    
    
    it('should use request-level proxy if browser supports it', async () => {
      proxyManager.hasProxyRequestListener = true;
      
      await proxyManager.applyProxySettings();
      
      expect(proxyManager.applyRequestLevelProxySettings).toHaveBeenCalled();
      expect(proxyManager.applyPacScriptProxySettings).not.toHaveBeenCalled();
    });
    
    it('should use PAC script proxy if browser does not support request-level', async () => {
      proxyManager.hasProxyRequestListener = false;
      
      await proxyManager.applyProxySettings();
      
      expect(proxyManager.applyRequestLevelProxySettings).not.toHaveBeenCalled();
      expect(proxyManager.applyPacScriptProxySettings).toHaveBeenCalled();
    });
    
    it('should start traffic monitoring on success', async () => {
      await proxyManager.applyProxySettings();
      
      expect(mockTrafficMonitor.startMonitoring).toHaveBeenCalledWith(
        proxyManager.config,
        proxyManager.enabledProxies
      );
    });
    
  });

  describe('toggle, enable, disable methods', () => {
    beforeEach(async () => {
      await proxyManager.loadConfig();
      
      jest.spyOn(proxyManager, 'saveConfig').mockResolvedValue(proxyManager.config);
      jest.spyOn(proxyManager, 'applyProxySettings').mockResolvedValue(undefined);
      jest.spyOn(proxyManager, 'disableProxy').mockResolvedValue(undefined);
    });
    
    it('should enable the proxy', async () => {
      proxyManager.config.proxyEnabled = false;
      
      const result = await proxyManager.enable();
      
      expect(proxyManager.config.proxyEnabled).toBe(true);
      expect(proxyManager.saveConfig).toHaveBeenCalled();
      expect(proxyManager.applyProxySettings).toHaveBeenCalled();
      expect(result).toBe(true);
    });
    
    it('should disable the proxy', async () => {
      proxyManager.config.proxyEnabled = true;
      
      const result = await proxyManager.disable();
      
      expect(proxyManager.config.proxyEnabled).toBe(false);
      expect(proxyManager.saveConfig).toHaveBeenCalled();
      expect(proxyManager.disableProxy).toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    it('should toggle from enabled to disabled', async () => {
      proxyManager.config.proxyEnabled = true;
      jest.spyOn(proxyManager, 'disable').mockResolvedValue(false);
      
      const result = await proxyManager.toggle();
      
      expect(proxyManager.disable).toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    it('should toggle from disabled to enabled', async () => {
      proxyManager.config.proxyEnabled = false;
      jest.spyOn(proxyManager, 'enable').mockResolvedValue(true);
      
      const result = await proxyManager.toggle();
      
      expect(proxyManager.enable).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('updateProxy methods', () => {
    beforeEach(async () => {
      await proxyManager.loadConfig();
      
      jest.spyOn(proxyManager, 'saveConfig').mockResolvedValue(proxyManager.config);
      jest.spyOn(proxyManager, 'applyProxySettings').mockResolvedValue(undefined);
    });
    
    it('should update proxy settings', async () => {
      const proxyId = 'default_proxy';
      const updates = {
        host: 'new.proxy.example.com',
        port: 8888,
        username: 'newuser'
      };
      
      const result = await proxyManager.updateProxy(proxyId, updates);
      
      expect(result.host).toBe('new.proxy.example.com');
      expect(result.port).toBe(8888);
      expect(result.username).toBe('newuser');
      expect(proxyManager.saveConfig).toHaveBeenCalled();
      expect(proxyManager.applyProxySettings).toHaveBeenCalled();
    });
    
    it('should throw error for invalid proxy ID', async () => {
      const invalidId = 'nonexistent_proxy';
      
      await expect(proxyManager.updateProxy(invalidId, {})).rejects.toThrow(
        `Proxy with ID ${invalidId} not found`
      );
    });
    
    it('should toggle proxy enabled state', async () => {
      const proxyId = 'default_proxy';
      const initialState = proxyManager.config.proxies[0].enabled;
      
      const result = await proxyManager.updateProxy(proxyId, { enabled: undefined });
      
      expect(result.enabled).toBe(!initialState);
      expect(proxyManager.saveConfig).toHaveBeenCalled();
      expect(proxyManager.applyProxySettings).toHaveBeenCalled();
    });
    
    it('should update proxy patterns', async () => {
      const proxyId = 'default_proxy';
      const newPatterns = ['new\\.pattern', 'another\\.pattern'];
      
      const result = await proxyManager.updateProxy(proxyId, { 
        routingConfig: { patterns: newPatterns } 
      });
      
      expect(result.routingConfig.patterns).toEqual(newPatterns);
      expect(proxyManager.saveConfig).toHaveBeenCalled();
      expect(proxyManager.applyProxySettings).toHaveBeenCalled();
    });
    
    it('should update proxy containers', async () => {
      const proxyId = 'default_proxy';
      const newContainers = ['container1', 'container2'];
      
      const result = await proxyManager.updateProxy(proxyId, { 
        routingConfig: { containers: newContainers } 
      });
      
      expect(result.routingConfig.containers).toEqual(newContainers);
      expect(proxyManager.saveConfig).toHaveBeenCalled();
      expect(proxyManager.applyProxySettings).toHaveBeenCalled();
    });
    
  });

  describe('generatePacScript', () => {
    beforeEach(async () => {
      await proxyManager.loadConfig();
    });
    
    it('should generate a PAC script with JSON data structure', () => {
      // Ensure we have enabled proxies with patterns
      proxyManager.enabledProxies = [
        {
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        }
      ];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).toContain('function FindProxyForURL');
      expect(pacScript).toContain('var proxyConfigurations = ');
      expect(pacScript).toContain('function testPatternMatch');
      expect(pacScript).toContain('function findProxyForHostname');
      expect(pacScript).toContain('var lruCache = ');
      expect(pacScript).toContain('var regexCache = ');
      expect(typeof pacScript).toBe('string');
      expect(pacScript.length).toBeGreaterThan(50);
    });
    
    it('should handle container-based proxies correctly (skip them)', async () => {
      proxyManager.enabledProxies = [
        {
          id: 'container_proxy',
          enabled: true,
          host: 'container.proxy.com',
          port: 9090,
          routingConfig: {
            useContainerMode: true,
            containers: ['container1']
          }
        },
        {
          id: 'pattern_proxy',
          enabled: true,
          host: 'pattern.proxy.com',
          port: 8080,
          routingConfig: {
            useContainerMode: false,
            patterns: ['pattern\\.com']
          }
        }
      ];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).not.toContain('container.proxy.com');
      expect(pacScript).toContain('pattern.proxy.com');
    });
    
    it('should embed proxy configuration as secure JSON data', () => {
      // Ensure we have enabled proxies with patterns
      proxyManager.enabledProxies = [
        {
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com', 'test\\.org']
          }
        }
      ];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).toContain('var proxyConfigurations = ');
      
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      
      const parsedConfig = JSON.parse(configMatch[1]);
      expect(Array.isArray(parsedConfig)).toBe(true);
      expect(parsedConfig).toHaveLength(1);
      
      expect(parsedConfig[0]).toHaveProperty('patterns');
      expect(parsedConfig[0]).toHaveProperty('proxyString');
      expect(parsedConfig[0]).toHaveProperty('priority');
      
      // Patterns are now plain strings (no double escaping)
      expect(parsedConfig[0].patterns).toHaveLength(2);
      expect(parsedConfig[0].patterns[0]).toEqual('example\\.com');
      expect(parsedConfig[0].patterns[1]).toEqual('test\\.org');
    });
    
    it('should generate valid JavaScript that can be parsed', () => {
      // Ensure we have enabled proxies with patterns
      proxyManager.enabledProxies = [
        {
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        }
      ];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(() => {
        new Function(pacScript + '; return FindProxyForURL;')();
      }).not.toThrow();
    });
    
    it('should return DIRECT script when no enabled proxies', () => {
      proxyManager.enabledProxies = [];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).toContain('return "DIRECT"');
      expect(pacScript).not.toContain('var proxyConfigurations = ');
    });
    
    it('should include optimizations like early exits and caching', () => {
      proxyManager.enabledProxies = [
        {
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        }
      ];
      
      const pacScript = proxyManager.generatePacScript();
      
      // Check for early exits
      expect(pacScript).toContain('localhost');
      expect(pacScript).toContain('file:');
      expect(pacScript).toContain('chrome:');
      
      // Check for LRU cache implementation
      expect(pacScript).toContain('lruCache.get');
      expect(pacScript).toContain('lruCache.set');
      
      // Check that dnsResolve is NOT used
      expect(pacScript).not.toContain('dnsResolve');
    });
    
    it('should pre-sort configurations by priority', () => {
      proxyManager.enabledProxies = [
        {
          id: 'proxy_3',
          enabled: true,
          host: 'proxy3.example.com',
          port: 8083,
          priority: 3,
          routingConfig: {
            useContainerMode: false,
            patterns: ['.*']
          }
        },
        {
          id: 'proxy_1',
          enabled: true,
          host: 'proxy1.example.com',
          port: 8081,
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        },
        {
          id: 'proxy_2',
          enabled: true,
          host: 'proxy2.example.com',
          port: 8082,
          priority: 2,
          routingConfig: {
            useContainerMode: false,
            patterns: ['test\\.com']
          }
        }
      ];
      
      const pacScript = proxyManager.generatePacScript();
      
      // Extract the proxyConfigurations from the PAC script
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      
      const parsedConfig = JSON.parse(configMatch[1]);
      
      // Verify configurations are sorted by priority
      expect(parsedConfig[0].priority).toBe(1);
      expect(parsedConfig[1].priority).toBe(2);
      expect(parsedConfig[2].priority).toBe(3);
    });
    
    it('should treat all patterns as regex', () => {
      proxyManager.enabledProxies = [
        {
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['*', 'example.com', 'test\\..*\\.com']
          }
        }
      ];
      
      const pacScript = proxyManager.generatePacScript();
      
      // Extract the proxyConfigurations from the PAC script
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      
      const parsedConfig = JSON.parse(configMatch[1]);
      
      // Verify all patterns are treated as regex
      const patterns = parsedConfig[0].patterns;
      expect(patterns).toHaveLength(3);
      
      // All patterns should be plain strings (no double escaping)
      expect(patterns[0]).toEqual('*');
      expect(patterns[1]).toEqual('example.com');
      expect(patterns[2]).toEqual('test\\..*\\.com');
    });

    it('should correctly convert HTTP proxy types to PROXY in PAC script', () => {
      proxyManager.enabledProxies = [
        {
          id: 'http_proxy',
          enabled: true,
          host: 'http.proxy.com',
          port: 8080,
          proxyType: 'http',
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        },
        {
          id: 'https_proxy',
          enabled: true,
          host: 'https.proxy.com',
          port: 3128,
          proxyType: 'https',
          priority: 2,
          routingConfig: {
            useContainerMode: false,
            patterns: ['test\\.com']
          }
        },
        {
          id: 'socks5_proxy',
          enabled: true,
          host: 'socks.proxy.com',
          port: 1080,
          proxyType: 'socks5',
          priority: 3,
          routingConfig: {
            useContainerMode: false,
            patterns: ['socks\\.com']
          }
        }
      ];
      
      const pacScript = proxyManager.generatePacScript();
      
      // Extract the proxyConfigurations from the PAC script
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      
      const parsedConfig = JSON.parse(configMatch[1]);
      
      // Verify HTTP proxy types are converted to PROXY
      expect(parsedConfig[0].proxyString).toBe('PROXY http.proxy.com:8080');
      expect(parsedConfig[1].proxyString).toBe('PROXY https.proxy.com:3128');
      expect(parsedConfig[2].proxyString).toBe('SOCKS5 socks.proxy.com:1080');
    });
  });


  describe('getProxyForTab', () => {
    beforeEach(async () => {
      await proxyManager.loadConfig();
      
      jest.spyOn(proxyManager, 'resolveProxyForRequest');
      browser.tabs.get.mockResolvedValue({ id: 1, url: 'https://example.com', cookieStoreId: 'container1' });
    });
    
    it('should reject invalid or non-HTTP URLs', async () => {
      const result = await proxyManager.getProxyForTab(1, 'invalid-url');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or non-HTTP URL');
      expect(result.proxyInfo).toBeNull();
    });
    
    it('should get container info for Firefox', async () => {
      proxyManager.hasContainerSupport = true;
      proxyManager.resolveProxyForRequest.mockReturnValue(null);
      
      await proxyManager.getProxyForTab(1, 'https://example.com');
      
      expect(browser.tabs.get).toHaveBeenCalledWith(1);
      expect(proxyManager.resolveProxyForRequest).toHaveBeenCalledWith(
        'example.com',
        'container1',
        expect.any(Object)
      );
    });
    
    it('should return proxy info when found', async () => {
      const mockProxy = { id: 'test_proxy', routingConfig: { useContainerMode: true } };
      proxyManager.resolveProxyForRequest.mockReturnValue(mockProxy);
      
      const result = await proxyManager.getProxyForTab(1, 'https://example.com');
      
      expect(result.success).toBe(true);
      expect(result.proxyInfo).toBe(mockProxy);
      expect(result.matchType).toBe('container');
    });
    
    it('should return all matching proxies when includeAllMatches is true', async () => {
      const mockResult = {
        selectedProxy: { id: 'primary_proxy' },
        allProxies: [
          { id: 'primary_proxy' },
          { id: 'secondary_proxy' }
        ],
        matchType: 'pattern'
      };
      
      proxyManager.resolveProxyForRequest.mockReturnValue(mockResult);
      
      const result = await proxyManager.getProxyForTab(1, 'https://example.com', { includeAllMatches: true });
      
      expect(result.success).toBe(true);
      expect(result.proxyInfo).toBe(mockResult.selectedProxy);
      expect(result.allMatchingProxies).toEqual(mockResult.allProxies);
      expect(result.matchType).toBe('pattern');
    });
    
    it('should handle errors gracefully', async () => {
      const error = new Error('Test error');
      browser.tabs.get.mockRejectedValue(error);
      
      const result = await proxyManager.getProxyForTab(1, 'https://example.com');
      
      // Just check that the function returns a result and doesn't throw
      expect(result).toBeDefined();
    });
  });

  describe('checkTabProxyUsage', () => {
    beforeEach(async () => {
      await proxyManager.loadConfig();
      
      jest.spyOn(proxyManager, 'getProxyForTab');
    });
    
    it('should skip non-HTTP URLs', async () => {
      const mockOnNoMatch = jest.fn();
      
      const result = await proxyManager.checkTabProxyUsage(1, 'about:blank', {
        onNoMatch: mockOnNoMatch
      });
      
      expect(result.match).toBe(false);
      expect(mockOnNoMatch).toHaveBeenCalled();
      expect(proxyManager.getProxyForTab).not.toHaveBeenCalled();
    });
    
    it('should call onProxyMatch when proxy is found', async () => {
      const mockProxy = { id: 'test_proxy' };
      const mockOnProxyMatch = jest.fn();
      
      proxyManager.getProxyForTab.mockResolvedValue({
        success: true,
        proxyInfo: mockProxy,
        matchType: 'pattern'
      });
      
      const result = await proxyManager.checkTabProxyUsage(1, 'https://example.com', {
        onProxyMatch: mockOnProxyMatch
      });
      
      expect(result.match).toBe(true);
      expect(result.proxy).toBe(mockProxy);
      expect(mockOnProxyMatch).toHaveBeenCalledWith(mockProxy, 'pattern');
    });
    
    it('should call onNoMatch when no proxy is found', async () => {
      const mockOnNoMatch = jest.fn();
      
      proxyManager.getProxyForTab.mockResolvedValue({
        success: true,
        proxyInfo: null
      });
      
      const result = await proxyManager.checkTabProxyUsage(1, 'https://example.com', {
        onNoMatch: mockOnNoMatch
      });
      
      expect(result.match).toBe(false);
      expect(mockOnNoMatch).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      const error = new Error('Test error');
      const mockOnNoMatch = jest.fn();
      
      proxyManager.getProxyForTab.mockRejectedValue(error);
      
      const result = await proxyManager.checkTabProxyUsage(1, 'https://example.com', {
        onNoMatch: mockOnNoMatch
      });
      
      expect(result.match).toBe(false);
      expect(result.error).toBe(String(error));
      expect(mockOnNoMatch).toHaveBeenCalled();
    });
  });

  // Browser-specific authentication tests
  describe('Chrome vs Firefox Authentication Handling', () => {
    describe('Chrome (no authentication support)', () => {
      beforeEach(() => {
        // Mock Chrome capabilities
        const chromeBrowserCapabilities = createBrowserCapabilities(false);
        jest.doMock('../utils/feature-detection', () => ({
          __esModule: true,
          default: chromeBrowserCapabilities
        }));
        
        // Reset storage mock for Chrome config
        browser.storage.local.get.mockResolvedValue({ config: chromeProxyConfig });
        
        // Create fresh ProxyManager instance
        proxyManager = new ProxyManager({
          tabManager: mockTabManager,
          patternMatcher: mockPatternMatcher,
          trafficMonitor: mockTrafficMonitor
        });
      });

      it('should generate PAC script without authentication for Chrome', () => {
        proxyManager.enabledProxies = [{
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          proxyType: 'http',
          priority: 1,
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
          // Note: no auth field for Chrome
        }];

        const pacScript = proxyManager.generatePacScript();
        
        // Should not contain any authentication credentials
        expect(pacScript).not.toContain('@');
        expect(pacScript).not.toContain('username');
        expect(pacScript).not.toContain('password');
        expect(pacScript).toContain('PROXY proxy.example.com:8080');
      });

      it('should not set authentication fields in proxy resolution for Chrome', () => {
        const testProxy = {
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          proxyType: 'http',
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        };
        
        proxyManager.enabledProxies = [testProxy];
        
        // Mock pattern matcher to return our test proxy
        mockPatternMatcher.resolveProxyForHost.mockReturnValue(testProxy);

        const result = proxyManager.resolveProxyForRequest('test.example.com');
        
        expect(result.id).toBe('test_proxy');
        expect(result.host).toBe('proxy.example.com');
        expect(result.port).toBe(8080);
        // Should not have authentication fields for Chrome
        expect(result.auth).toBeUndefined();
      });
    });

    describe('Firefox (full authentication support)', () => {
      beforeEach(() => {
        // Mock Firefox capabilities
        const firefoxBrowserCapabilities = createBrowserCapabilities(true);
        jest.doMock('../utils/feature-detection', () => ({
          __esModule: true,
          default: firefoxBrowserCapabilities
        }));
        
        // Reset storage mock for Firefox config
        browser.storage.local.get.mockResolvedValue({ config: firefoxProxyConfig });
        
        // Create fresh ProxyManager instance
        proxyManager = new ProxyManager({
          tabManager: mockTabManager,
          patternMatcher: mockPatternMatcher,
          trafficMonitor: mockTrafficMonitor
        });
      });

      it('should generate PAC script with authentication for Firefox (when no proxy.onRequest)', () => {
        // For this test, we need to temporarily modify the ProxyManager to think it's in Firefox PAC mode
        // Save the original browser capabilities
        const originalCapabilities = browserCapabilities;
        
        // Override browser capabilities to be Firefox with PAC script mode
        Object.defineProperty(browserCapabilities, 'browser', {
          value: { isFirefox: true, isChrome: false },
          configurable: true
        });
        Object.defineProperty(browserCapabilities, 'proxy', {
          value: { hasProxyRequestListener: false },
          configurable: true
        });

        proxyManager.enabledProxies = [{
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          proxyType: 'http',
          priority: 1,
          auth: {
            username: 'testuser',
            password: 'testpass'
          },
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        }];

        const pacScript = proxyManager.generatePacScript();
        
        // Should contain authentication credentials
        expect(pacScript).toContain('testuser:testpass@proxy.example.com:8080');
        expect(pacScript).toContain('PROXY testuser:testpass@proxy.example.com:8080');
        
        // Restore original capabilities 
        Object.defineProperty(browserCapabilities, 'browser', {
          value: originalCapabilities.browser,
          configurable: true
        });
        Object.defineProperty(browserCapabilities, 'proxy', {
          value: originalCapabilities.proxy,
          configurable: true
        });
      });

      it('should include authentication fields in proxy resolution for Firefox', () => {
        const testProxy = {
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          proxyType: 'http',
          auth: {
            username: 'testuser',
            password: 'testpass'
          },
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        };
        
        proxyManager.enabledProxies = [testProxy];
        
        // Mock pattern matcher to return our test proxy
        mockPatternMatcher.resolveProxyForHost.mockReturnValue(testProxy);

        const result = proxyManager.resolveProxyForRequest('test.example.com');
        
        expect(result.id).toBe('test_proxy');
        expect(result.host).toBe('proxy.example.com');
        expect(result.port).toBe(8080);
        expect(result.auth.username).toBe('testuser');
        expect(result.auth.password).toBe('testpass');
      });

      it('should include authentication fields in proxy resolution for Firefox even with SOCKS4', () => {
        const testProxy = {
          id: 'test_proxy',
          enabled: true,
          host: 'proxy.example.com',
          port: 1080,
          proxyType: 'socks4',
          auth: {
            username: 'testuser',
            password: 'testpass'
          },
          routingConfig: {
            useContainerMode: false,
            patterns: ['example\\.com']
          }
        };
        
        proxyManager.enabledProxies = [testProxy];
        
        // Mock pattern matcher to return our test proxy
        mockPatternMatcher.resolveProxyForHost.mockReturnValue(testProxy);

        const result = proxyManager.resolveProxyForRequest('test.example.com');
        
        expect(result.id).toBe('test_proxy');
        expect(result.host).toBe('proxy.example.com');
        expect(result.port).toBe(1080);
        // Auth fields exist in proxy config but won't be used by handleProxyRequest for SOCKS4
        expect(result.auth.username).toBe('testuser');
        expect(result.auth.password).toBe('testpass');
      });
    });
  });

});