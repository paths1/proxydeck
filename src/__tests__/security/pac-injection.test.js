import ProxyManager from '../../modules/ProxyManager';

describe('PAC Script Security Tests', () => {
  let proxyManager;
  
  beforeEach(() => {
    proxyManager = new ProxyManager();
    proxyManager.config = {
      version: 2,
      proxies: [],
      proxyEnabled: true
    };
  });

  describe('PAC Script Injection Prevention', () => {
    const createMaliciousProxy = (maliciousPattern) => ({
      id: 'test-proxy',
      name: 'Test Proxy',
      host: 'proxy.test.com',
      port: 8080,
      enabled: true,
      priority: 1,
      routingConfig: {
        useContainerMode: false,
        patterns: [{ value: maliciousPattern }]
      }
    });

    it('should prevent JavaScript injection via double quote escape', () => {
      const maliciousPattern = '"); alert("XSS"); //';
      const proxy = createMaliciousProxy(maliciousPattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).not.toContain('alert("XSS")');
      expect(pacScript).toContain('var proxyConfigurations = ');
      // Verify the pattern is safely embedded in the JSON configuration
      const expectedConfig = [{
        patterns: [maliciousPattern],
        proxyString: 'SOCKS5 proxy.test.com:8080',
        priority: 1
      }];
      expect(pacScript).toContain(JSON.stringify(expectedConfig));
    });

    it('should prevent JavaScript injection via backslash escapes', () => {
      const maliciousPattern = '\\"; console.log("PWNED"); //';
      const proxy = createMaliciousProxy(maliciousPattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).not.toContain('console.log("PWNED")');
      expect(pacScript).toContain('var proxyConfigurations = ');
    });

    it('should prevent JavaScript injection via newline characters', () => {
      const maliciousPattern = 'test.com\n"); eval("malicious code"); //';
      const proxy = createMaliciousProxy(maliciousPattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).not.toContain('eval("malicious code")');
      expect(pacScript).toContain('var proxyConfigurations = ');
    });

    it('should prevent function closure escape attempts', () => {
      const maliciousPattern = '}); return "PROXY evil.com:8080"; })(); (function(){//';
      const proxy = createMaliciousProxy(maliciousPattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).not.toContain('return "PROXY evil.com:8080"');
      expect(pacScript).toContain('var proxyConfigurations = ');
    });

    it('should prevent script tag injection', () => {
      const maliciousPattern = '</script><script>alert("XSS")</script>';
      const proxy = createMaliciousProxy(maliciousPattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      // The pattern should be safely JSON-escaped in the data, not executable
      expect(pacScript).toContain('var proxyConfigurations = ');
      
      // Verify the PAC script itself doesn't contain unescaped script tags
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      const configData = JSON.parse(configMatch[1]);
      expect(configData[0].patterns[0]).toEqual(maliciousPattern);
    });

    it('should prevent template literal injection', () => {
      const maliciousPattern = '${alert("XSS")}';
      const proxy = createMaliciousProxy(maliciousPattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      // The pattern should be safely JSON-escaped in the data, not executable
      expect(pacScript).toContain('var proxyConfigurations = ');
      
      // Verify the pattern is properly stored in the JSON data
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      const configData = JSON.parse(configMatch[1]);
      expect(configData[0].patterns[0]).toEqual(maliciousPattern);
    });

    it('should handle complex regex patterns safely', () => {
      const complexPattern = '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$';
      const proxy = createMaliciousProxy(complexPattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      // Verify the complex pattern is properly escaped and stored
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      const configData = JSON.parse(configMatch[1]);
      expect(configData[0].patterns[0]).toEqual(complexPattern);
    });

    it('should handle Unicode characters safely', () => {
      const unicodePattern = 'tëst\\.cöm|测试\\.com';
      const proxy = createMaliciousProxy(unicodePattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      // Verify the unicode pattern is properly escaped and stored
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      const configData = JSON.parse(configMatch[1]);
      expect(configData[0].patterns[0]).toEqual(unicodePattern);
    });

    it('should prevent injection through proxy credentials in Firefox', () => {
      // Mock Firefox browser capabilities to enable auth
      const originalBrowserCapabilities = require('../../utils/feature-detection').default;
      require('../../utils/feature-detection').default = {
        ...originalBrowserCapabilities,
        browser: { isFirefox: true, isChrome: false },
        proxy: { hasProxyRequestListener: false } // Force PAC script mode
      };

      const proxy = {
        id: 'test-proxy',
        name: 'Test Proxy',
        host: 'proxy.test.com',
        port: 8080,
        auth: {
          username: 'user"; alert("XSS"); //',
          password: 'pass"; console.log("PWNED"); //'
        },
        enabled: true,
        priority: 1,
        routingConfig: {
          useContainerMode: false,
          patterns: [{ value: 'test\\.com' }]
        }
      };
      
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).not.toContain('alert("XSS")');
      expect(pacScript).not.toContain('console.log("PWNED")');
      
      // Restore original capabilities
      require('../../utils/feature-detection').default = originalBrowserCapabilities;
    });

    it('should not include any credentials in Chrome PAC scripts', () => {
      // Mock Chrome browser capabilities to disable auth
      const originalBrowserCapabilities = require('../../utils/feature-detection').default;
      require('../../utils/feature-detection').default = {
        ...originalBrowserCapabilities,
        browser: { isFirefox: false, isChrome: true }
      };

      const proxy = {
        id: 'test-proxy',
        name: 'Test Proxy',
        host: 'proxy.test.com',
        port: 8080,
        // Note: Chrome proxies don't have auth fields
        enabled: true,
        priority: 1,
        routingConfig: {
          useContainerMode: false,
          patterns: [{ value: 'test\\.com' }]
        }
      };
      
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      // Chrome should never have credentials in PAC scripts
      expect(pacScript).not.toContain('@');
      expect(pacScript).not.toContain('username');
      expect(pacScript).not.toContain('password');
      expect(pacScript).toContain('SOCKS5 proxy.test.com:8080');
      
      // Restore original capabilities
      require('../../utils/feature-detection').default = originalBrowserCapabilities;
    });

    it('should prevent injection through proxy host/port', () => {
      const proxy = {
        id: 'test-proxy',
        name: 'Test Proxy',
        host: 'proxy.test.com"; alert("XSS"); //',
        port: '8080"; console.log("PWNED"); //',
        enabled: true,
        priority: 1,
        routingConfig: {
          useContainerMode: false,
          patterns: [{ value: 'test\\.com' }]
        }
      };
      
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).not.toContain('alert("XSS")');
      expect(pacScript).not.toContain('console.log("PWNED")');
    });
  });

  describe('PAC Script Functionality', () => {
    it('should generate valid JavaScript with legitimate patterns', () => {
      const proxy = {
        id: 'test-proxy',
        name: 'Test Proxy',
        host: 'proxy.test.com',
        port: 8080,
        enabled: true,
        priority: 1,
        routingConfig: {
          useContainerMode: false,
          patterns: [
            { value: 'example\\.com' },
            { value: '.*\\.test\\.com' }
          ]
        }
      };
      
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).toContain('function FindProxyForURL(url, host)');
      expect(pacScript).toContain('var proxyConfigurations = ');
      expect(pacScript).toContain('function testPatternMatch(hostname, pattern)');
      expect(pacScript).toContain('function findProxyForHostname(hostname)');
      
      expect(() => {
        new Function(pacScript + '; return FindProxyForURL;')();
      }).not.toThrow();
    });

    it('should return DIRECT when no proxies are enabled', () => {
      proxyManager.enabledProxies = [];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).toContain('return "DIRECT"');
      expect(pacScript).not.toContain('var proxyConfigurations = ');
    });

    it('should filter out container mode proxies', () => {
      const containerProxy = {
        id: 'container-proxy',
        name: 'Container Proxy',
        host: 'container.proxy.com',
        port: 8080,
        enabled: true,
        priority: 1,
        routingConfig: {
          useContainerMode: true,
          patterns: [{ value: 'container\\.com' }]
        }
      };
      
      const patternProxy = {
        id: 'pattern-proxy',
        name: 'Pattern Proxy',
        host: 'pattern.proxy.com',
        port: 8080,
        enabled: true,
        priority: 2,
        routingConfig: {
          useContainerMode: false,
          patterns: [{ value: 'pattern\\.com' }]
        }
      };
      
      proxyManager.enabledProxies = [containerProxy, patternProxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).not.toContain('container.proxy.com');
      expect(pacScript).toContain('pattern.proxy.com');
    });

    it('should match IP address pattern ^39\\.1\\..* against host 39.1.10.30', () => {
      const proxy = {
        id: 'ip-proxy',
        name: 'IP Proxy',
        host: 'proxy.test.com',
        port: 8080,
        enabled: true,
        priority: 1,
        routingConfig: {
          useContainerMode: false,
          patterns: [{ value: '^39\\.1\\..*' }]
        }
      };
      
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      // Create a test function to execute the PAC script
      const pacFunction = new Function(pacScript + '; return FindProxyForURL;')();
      
      // Test that the pattern correctly matches the IP address
      const result = pacFunction('http://39.1.10.30/test', '39.1.10.30');
      expect(result).toBe('SOCKS5 proxy.test.com:8080');
      
      // Test various IPs in the 39.1.x.x range
      expect(pacFunction('http://39.1.0.1/test', '39.1.0.1')).toBe('SOCKS5 proxy.test.com:8080');
      expect(pacFunction('http://39.1.255.255/test', '39.1.255.255')).toBe('SOCKS5 proxy.test.com:8080');
      
      // Test that non-matching IPs return DIRECT
      expect(pacFunction('http://40.1.10.30/test', '40.1.10.30')).toBe('DIRECT');
      expect(pacFunction('http://38.1.10.30/test', '38.1.10.30')).toBe('DIRECT');
      expect(pacFunction('http://39.2.10.30/test', '39.2.10.30')).toBe('DIRECT');
      
      // Test that the pattern doesn't match partial numbers
      expect(pacFunction('http://139.1.10.30/test', '139.1.10.30')).toBe('DIRECT');
      expect(pacFunction('http://39.11.10.30/test', '39.11.10.30')).toBe('DIRECT');
    });
  });

  describe('JSON Data Security', () => {
    it('should properly serialize complex proxy configurations for Firefox', () => {
      // Mock Firefox browserCapabilities to allow auth credentials in PAC script
      const originalBrowserCapabilities = require('../../utils/feature-detection').default;
      require('../../utils/feature-detection').default = {
        ...originalBrowserCapabilities,
        browser: { isFirefox: true, isChrome: false },
        proxy: { hasProxyRequestListener: false } // Force PAC script mode
      };
      
      const proxy = {
        id: 'complex-proxy',
        name: 'Complex Proxy',
        host: 'proxy.test.com',
        port: 8080,
        auth: {
          username: 'testuser',
          password: 'testpass'
        },
        enabled: true,
        priority: 1,
        routingConfig: {
          useContainerMode: false,
          patterns: [
            { value: '^https?://.*\\.example\\.com/' },
            { value: 'subdomain\\.test\\.org' }
          ]
        }
      };
      
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      
      expect(configMatch).toBeTruthy();
      
      const parsedConfig = JSON.parse(configMatch[1]);
      expect(parsedConfig).toHaveLength(1);
      expect(parsedConfig[0]).toEqual({
        patterns: [
          '^https?://.*\\.example\\.com/',
          'subdomain\\.test\\.org'
        ],
        proxyString: 'SOCKS5 testuser:testpass@proxy.test.com:8080',
        priority: 1
      });
      
      // Restore original capabilities
      require('../../utils/feature-detection').default = originalBrowserCapabilities;
    });
  });
});