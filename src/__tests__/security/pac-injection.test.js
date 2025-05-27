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
      expect(pacScript).toContain(JSON.stringify([{
        patterns: [maliciousPattern],
        proxyString: 'SOCKS5 proxy.test.com:8080',
        priority: 1
      }]));
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
      expect(pacScript).toContain(JSON.stringify(maliciousPattern));
      
      // Verify the PAC script itself doesn't contain unescaped script tags
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      const configData = JSON.parse(configMatch[1]);
      expect(configData[0].patterns[0]).toBe(maliciousPattern);
    });

    it('should prevent template literal injection', () => {
      const maliciousPattern = '${alert("XSS")}';
      const proxy = createMaliciousProxy(maliciousPattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      // The pattern should be safely JSON-escaped in the data, not executable
      expect(pacScript).toContain('var proxyConfigurations = ');
      expect(pacScript).toContain(JSON.stringify(maliciousPattern));
      
      // Verify the pattern is properly stored in the JSON data
      const configMatch = pacScript.match(/var proxyConfigurations = (.+?);/);
      expect(configMatch).toBeTruthy();
      const configData = JSON.parse(configMatch[1]);
      expect(configData[0].patterns[0]).toBe(maliciousPattern);
    });

    it('should handle complex regex patterns safely', () => {
      const complexPattern = '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$';
      const proxy = createMaliciousProxy(complexPattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).toContain('var proxyConfigurations = ');
      expect(pacScript).toContain(JSON.stringify(complexPattern));
    });

    it('should handle Unicode characters safely', () => {
      const unicodePattern = 'tëst\\.cöm|测试\\.com';
      const proxy = createMaliciousProxy(unicodePattern);
      proxyManager.enabledProxies = [proxy];
      
      const pacScript = proxyManager.generatePacScript();
      
      expect(pacScript).toContain('var proxyConfigurations = ');
      expect(pacScript).toContain(JSON.stringify(unicodePattern));
    });

    it('should prevent injection through proxy credentials', () => {
      const proxy = {
        id: 'test-proxy',
        name: 'Test Proxy',
        host: 'proxy.test.com',
        port: 8080,
        username: 'user"; alert("XSS"); //',
        password: 'pass"; console.log("PWNED"); //',
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
      expect(pacScript).toContain('function findMatchingProxies(hostname, ipAddress)');
      
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
  });

  describe('JSON Data Security', () => {
    it('should properly serialize complex proxy configurations', () => {
      // Mock browserCapabilities to allow auth credentials in PAC script
      const mockBrowserCapabilities = require('../../utils/feature-detection');
      mockBrowserCapabilities.default.proxy.hasProxyRequestListener = false;
      
      const proxy = {
        id: 'complex-proxy',
        name: 'Complex Proxy',
        host: 'proxy.test.com',
        port: 8080,
        username: 'testuser',
        password: 'testpass',
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
    });
  });
});