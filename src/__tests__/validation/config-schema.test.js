/**
 * Tests for V2 configuration schema validation
 *
 * These tests ensure that:
 * 1. Valid V2 configurations pass validation
 * 2. Invalid configurations are rejected
 * 3. Schema changes are intentional and documented
 */

import {
  validateConfig,
  validateProxyConfig,
  validateConfigOrThrow,
  validateProxyConfigOrThrow,
  isValidV2Config,
  getValidationErrorMessages,
  ConfigV2Schema,
  ProxyConfigSchema
} from '../../validation/config-schema.js';

describe('V2 Configuration Schema Validation', () => {
  describe('ProxyConfigSchema', () => {
    it('should validate a complete valid proxy config', () => {
      const validProxy = {
        id: 'proxy_123',
        name: 'Test Proxy',
        host: '127.0.0.1',
        port: 1080,
        proxyType: 'socks5',
        auth: {
          username: 'user',
          password: 'pass'
        },
        enabled: true,
        priority: 0,
        color: 'hsl(348, 83%, 62%)',
        routingConfig: {
          useContainerMode: false,
          patterns: ['example\\.com'],
          containers: []
        }
      };

      const result = validateProxyConfig(validProxy);
      expect(result.success).toBe(true);
    });

    it('should validate proxy config without auth (Chrome)', () => {
      const chromeProxy = {
        id: 'proxy_chrome',
        name: 'Chrome Proxy',
        host: 'proxy.example.com',
        port: 8080,
        proxyType: 'http',
        enabled: true,
        priority: 0,
        color: null,
        routingConfig: {
          useContainerMode: false,
          patterns: [],
          containers: []
        }
      };

      const result = validateProxyConfig(chromeProxy);
      expect(result.success).toBe(true);
    });

    it('should reject proxy config with invalid port', () => {
      const invalidProxy = {
        id: 'proxy_bad',
        name: 'Bad Proxy',
        host: '127.0.0.1',
        port: 99999, // Invalid port
        proxyType: 'socks5',
        enabled: true,
        priority: 0,
        color: null,
        routingConfig: {
          useContainerMode: false,
          patterns: [],
          containers: []
        }
      };

      const result = validateProxyConfig(invalidProxy);
      expect(result.success).toBe(false);
      expect(result.error.issues.some(issue => issue.path.includes('port'))).toBe(true);
    });

    it('should reject proxy config with invalid proxyType', () => {
      const invalidProxy = {
        id: 'proxy_bad',
        name: 'Bad Proxy',
        host: '127.0.0.1',
        port: 1080,
        proxyType: 'invalid_type', // Invalid type
        enabled: true,
        priority: 0,
        color: null,
        routingConfig: {
          useContainerMode: false,
          patterns: [],
          containers: []
        }
      };

      const result = validateProxyConfig(invalidProxy);
      expect(result.success).toBe(false);
      expect(result.error.issues.some(issue => issue.path.includes('proxyType'))).toBe(true);
    });

    it('should reject proxy config with missing required fields', () => {
      const incompleteProxy = {
        id: 'proxy_incomplete',
        name: 'Incomplete Proxy'
        // Missing host, port, proxyType, etc.
      };

      const result = validateProxyConfig(incompleteProxy);
      expect(result.success).toBe(false);
      expect(result.error.issues.length).toBeGreaterThan(0);
    });

    it('should reject proxy config with extra fields (strict mode)', () => {
      const proxyWithExtraFields = {
        id: 'proxy_extra',
        name: 'Extra Fields Proxy',
        host: '127.0.0.1',
        port: 1080,
        proxyType: 'socks5',
        enabled: true,
        priority: 0,
        color: null,
        routingConfig: {
          useContainerMode: false,
          patterns: [],
          containers: []
        },
        extraField: 'should not be here' // Extra field
      };

      const result = validateProxyConfig(proxyWithExtraFields);
      expect(result.success).toBe(false);
    });

    it('should accept all valid proxy types', () => {
      const proxyTypes = ['socks5', 'socks4', 'http', 'https'];

      proxyTypes.forEach(type => {
        const proxy = {
          id: `proxy_${type}`,
          name: `${type.toUpperCase()} Proxy`,
          host: '127.0.0.1',
          port: 1080,
          proxyType: type,
          enabled: true,
          priority: 0,
          color: null,
          routingConfig: {
            useContainerMode: false,
            patterns: [],
            containers: []
          }
        };

        const result = validateProxyConfig(proxy);
        expect(result.success).toBe(true);
      });
    });

    it('should validate routing config patterns array', () => {
      const proxy = {
        id: 'proxy_patterns',
        name: 'Patterns Proxy',
        host: '127.0.0.1',
        port: 1080,
        proxyType: 'socks5',
        enabled: true,
        priority: 0,
        color: null,
        routingConfig: {
          useContainerMode: false,
          patterns: ['example\\.com', '.*\\.google\\.com', 'github\\.com'],
          containers: []
        }
      };

      const result = validateProxyConfig(proxy);
      expect(result.success).toBe(true);
    });

    it('should validate routing config containers array', () => {
      const proxy = {
        id: 'proxy_containers',
        name: 'Container Proxy',
        host: '127.0.0.1',
        port: 1080,
        proxyType: 'socks5',
        enabled: true,
        priority: 0,
        color: null,
        routingConfig: {
          useContainerMode: true,
          patterns: [],
          containers: ['firefox-container-1', 'firefox-container-2']
        }
      };

      const result = validateProxyConfig(proxy);
      expect(result.success).toBe(true);
    });
  });

  describe('ConfigV2Schema', () => {
    it('should validate empty config', () => {
      const emptyConfig = {
        version: 2,
        proxies: [],
        proxyEnabled: true
      };

      const result = validateConfig(emptyConfig);
      expect(result.success).toBe(true);
    });

    it('should validate config with single proxy', () => {
      const singleProxyConfig = {
        version: 2,
        proxies: [
          {
            id: 'proxy_1',
            name: 'Test Proxy',
            host: '127.0.0.1',
            port: 1080,
            proxyType: 'socks5',
            enabled: true,
            priority: 0,
            color: 'hsl(348, 83%, 62%)',
            routingConfig: {
              useContainerMode: false,
              patterns: [],
              containers: []
            }
          }
        ],
        proxyEnabled: true
      };

      const result = validateConfig(singleProxyConfig);
      expect(result.success).toBe(true);
    });

    it('should validate config with multiple proxies', () => {
      const multiProxyConfig = {
        version: 2,
        proxies: [
          {
            id: 'proxy_1',
            name: 'Proxy 1',
            host: '127.0.0.1',
            port: 1080,
            proxyType: 'socks5',
            enabled: true,
            priority: 0,
            color: 'hsl(348, 83%, 62%)',
            routingConfig: {
              useContainerMode: false,
              patterns: [],
              containers: []
            }
          },
          {
            id: 'proxy_2',
            name: 'Proxy 2',
            host: '192.168.1.1',
            port: 8080,
            proxyType: 'http',
            enabled: false,
            priority: 1,
            color: 'hsl(28, 87%, 58%)',
            routingConfig: {
              useContainerMode: false,
              patterns: ['example\\.com'],
              containers: []
            }
          }
        ],
        proxyEnabled: true
      };

      const result = validateConfig(multiProxyConfig);
      expect(result.success).toBe(true);
    });

    it('should reject config with wrong version', () => {
      const wrongVersionConfig = {
        version: 1, // Wrong version
        proxies: [],
        proxyEnabled: true
      };

      const result = validateConfig(wrongVersionConfig);
      expect(result.success).toBe(false);
      expect(result.error.issues.some(issue => issue.path.includes('version'))).toBe(true);
    });

    it('should reject config with more than 10 proxies', () => {
      const tooManyProxiesConfig = {
        version: 2,
        proxies: Array(11).fill(null).map((_, i) => ({
          id: `proxy_${i}`,
          name: `Proxy ${i}`,
          host: '127.0.0.1',
          port: 1080 + i,
          proxyType: 'socks5',
          enabled: true,
          priority: i,
          color: null,
          routingConfig: {
            useContainerMode: false,
            patterns: [],
            containers: []
          }
        })),
        proxyEnabled: true
      };

      const result = validateConfig(tooManyProxiesConfig);
      expect(result.success).toBe(false);
      expect(result.error.issues.some(issue => issue.path.includes('proxies'))).toBe(true);
    });

    it('should reject config with missing required fields', () => {
      const incompleteConfig = {
        version: 2
        // Missing proxies and proxyEnabled
      };

      const result = validateConfig(incompleteConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config with extra fields (strict mode)', () => {
      const extraFieldsConfig = {
        version: 2,
        proxies: [],
        proxyEnabled: true,
        extraField: 'should not be here'
      };

      const result = validateConfig(extraFieldsConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config with invalid proxy', () => {
      const invalidProxyConfig = {
        version: 2,
        proxies: [
          {
            id: 'bad_proxy',
            name: 'Bad Proxy',
            host: '127.0.0.1',
            port: 99999, // Invalid port
            proxyType: 'socks5',
            enabled: true,
            priority: 0,
            color: null,
            routingConfig: {
              useContainerMode: false,
              patterns: [],
              containers: []
            }
          }
        ],
        proxyEnabled: true
      };

      const result = validateConfig(invalidProxyConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('validateConfigOrThrow', () => {
    it('should return valid config without throwing', () => {
      const validConfig = {
        version: 2,
        proxies: [],
        proxyEnabled: true
      };

      expect(() => {
        const result = validateConfigOrThrow(validConfig);
        expect(result).toEqual(validConfig);
      }).not.toThrow();
    });

    it('should throw error for invalid config', () => {
      const invalidConfig = {
        version: 1, // Wrong version
        proxies: [],
        proxyEnabled: true
      };

      expect(() => {
        validateConfigOrThrow(invalidConfig);
      }).toThrow('Configuration validation failed');
    });

    it('should include error details in thrown error', () => {
      const invalidConfig = {
        version: 2,
        proxies: [],
        proxyEnabled: true,
        extraField: 'invalid'
      };

      try {
        validateConfigOrThrow(invalidConfig);
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('Configuration validation failed');
      }
    });
  });

  describe('validateProxyConfigOrThrow', () => {
    it('should return valid proxy without throwing', () => {
      const validProxy = {
        id: 'proxy_1',
        name: 'Test Proxy',
        host: '127.0.0.1',
        port: 1080,
        proxyType: 'socks5',
        enabled: true,
        priority: 0,
        color: null,
        routingConfig: {
          useContainerMode: false,
          patterns: [],
          containers: []
        }
      };

      expect(() => {
        const result = validateProxyConfigOrThrow(validProxy);
        expect(result).toEqual(validProxy);
      }).not.toThrow();
    });

    it('should throw error for invalid proxy', () => {
      const invalidProxy = {
        id: 'bad_proxy',
        name: 'Bad Proxy',
        host: '127.0.0.1',
        port: 99999, // Invalid port
        proxyType: 'socks5',
        enabled: true,
        priority: 0,
        color: null,
        routingConfig: {
          useContainerMode: false,
          patterns: [],
          containers: []
        }
      };

      expect(() => {
        validateProxyConfigOrThrow(invalidProxy);
      }).toThrow('Proxy configuration validation failed');
    });
  });

  describe('isValidV2Config', () => {
    it('should return true for valid config', () => {
      const validConfig = {
        version: 2,
        proxies: [],
        proxyEnabled: true
      };

      expect(isValidV2Config(validConfig)).toBe(true);
    });

    it('should return false for invalid config', () => {
      const invalidConfig = {
        version: 1,
        proxies: [],
        proxyEnabled: true
      };

      expect(isValidV2Config(invalidConfig)).toBe(false);
    });
  });

  describe('getValidationErrorMessages', () => {
    it('should format error messages', () => {
      const invalidConfig = {
        version: 1,
        proxies: 'not an array',
        proxyEnabled: 'not a boolean'
      };

      const result = validateConfig(invalidConfig);
      expect(result.success).toBe(false);

      const messages = getValidationErrorMessages(result.error);
      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.every(msg => typeof msg === 'string')).toBe(true);
    });
  });
});
