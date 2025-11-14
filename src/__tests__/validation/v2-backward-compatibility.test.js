/**
 * Backward Compatibility Tests for V2 Configuration
 *
 * These tests ensure that all existing V2 configurations remain valid.
 * Any test failure here indicates a BREAKING CHANGE to the V2 schema.
 *
 * CRITICAL: If any of these tests fail, you MUST:
 * 1. Revert the schema change, OR
 * 2. Implement a migration path, OR
 * 3. Get explicit approval for the breaking change
 */

import { validateConfig, isValidV2Config } from '../../validation/config-schema.js';
import {
  allV2Fixtures,
  emptyV2Config,
  singleSocks5ChromeConfig,
  singleSocks5FirefoxConfig,
  multipleProxiesChromeConfig,
  firefoxContainerConfig,
  maxProxiesConfig,
  complexRoutingConfig,
  proxyDisabledConfig,
  mixedEnabledConfig
} from '../../test-fixtures/v2-configs.js';

describe('V2 Backward Compatibility', () => {
  describe('All V2 fixtures must remain valid', () => {
    // This is the most important test - ensures all fixtures are valid
    it('should validate all V2 test fixtures', () => {
      Object.entries(allV2Fixtures).forEach(([name, config]) => {
        const result = validateConfig(config);
        if (!result.success) {
          console.error(`Fixture "${name}" failed validation:`, result.error.issues);
        }
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Individual fixture validation', () => {
    it('should validate empty V2 config (fresh install)', () => {
      const result = validateConfig(emptyV2Config);
      expect(result.success).toBe(true);
      expect(isValidV2Config(emptyV2Config)).toBe(true);
    });

    it('should validate single SOCKS5 proxy (Chrome - no auth)', () => {
      const result = validateConfig(singleSocks5ChromeConfig);
      expect(result.success).toBe(true);
      expect(result.data.proxies).toHaveLength(1);
      expect(result.data.proxies[0].proxyType).toBe('socks5');
      expect(result.data.proxies[0].auth).toBeUndefined();
    });

    it('should validate single SOCKS5 proxy with auth (Firefox)', () => {
      const result = validateConfig(singleSocks5FirefoxConfig);
      expect(result.success).toBe(true);
      expect(result.data.proxies).toHaveLength(1);
      expect(result.data.proxies[0].auth).toBeDefined();
      expect(result.data.proxies[0].auth.username).toBe('testuser');
    });

    it('should validate multiple proxies with different types (Chrome)', () => {
      const result = validateConfig(multipleProxiesChromeConfig);
      expect(result.success).toBe(true);
      expect(result.data.proxies).toHaveLength(3);

      // Verify all proxy types are present
      const types = result.data.proxies.map(p => p.proxyType);
      expect(types).toContain('http');
      expect(types).toContain('https');
      expect(types).toContain('socks4');
    });

    it('should validate Firefox container configuration', () => {
      const result = validateConfig(firefoxContainerConfig);
      expect(result.success).toBe(true);
      expect(result.data.proxies).toHaveLength(2);

      // Verify container mode is enabled
      expect(result.data.proxies[0].routingConfig.useContainerMode).toBe(true);
      expect(result.data.proxies[0].routingConfig.containers.length).toBeGreaterThan(0);
    });

    it('should validate config with maximum allowed proxies (10)', () => {
      const result = validateConfig(maxProxiesConfig);
      expect(result.success).toBe(true);
      expect(result.data.proxies).toHaveLength(10);

      // Verify priorities are correct
      result.data.proxies.forEach((proxy, index) => {
        expect(proxy.priority).toBe(index);
      });
    });

    it('should validate complex routing pattern configuration', () => {
      const result = validateConfig(complexRoutingConfig);
      expect(result.success).toBe(true);
      expect(result.data.proxies[0].routingConfig.patterns.length).toBe(6);

      // Verify pattern matching config
      const patterns = result.data.proxies[0].routingConfig.patterns;
      expect(patterns).toContain('.*\\.google\\.com');
      expect(patterns).toContain('github\\.com');
    });

    it('should validate config with proxy disabled globally', () => {
      const result = validateConfig(proxyDisabledConfig);
      expect(result.success).toBe(true);
      expect(result.data.proxyEnabled).toBe(false);
      expect(result.data.proxies).toHaveLength(1);
    });

    it('should validate config with mixed enabled/disabled proxies', () => {
      const result = validateConfig(mixedEnabledConfig);
      expect(result.success).toBe(true);
      expect(result.data.proxies).toHaveLength(2);

      const enabledProxy = result.data.proxies.find(p => p.enabled);
      const disabledProxy = result.data.proxies.find(p => !p.enabled);

      expect(enabledProxy).toBeDefined();
      expect(disabledProxy).toBeDefined();
    });
  });

  describe('V2 schema compatibility guarantees', () => {
    it('should allow null proxy ID (for new proxies)', () => {
      const configWithNullId = {
        version: 2,
        proxies: [
          {
            id: null, // Allowed for new proxies
            name: 'New Proxy',
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
          }
        ],
        proxyEnabled: true
      };

      const result = validateConfig(configWithNullId);
      expect(result.success).toBe(true);
    });

    it('should allow null color (before color assignment)', () => {
      const configWithNullColor = {
        version: 2,
        proxies: [
          {
            id: 'proxy_1',
            name: 'No Color Proxy',
            host: '127.0.0.1',
            port: 1080,
            proxyType: 'socks5',
            enabled: true,
            priority: 0,
            color: null, // Allowed before color assignment
            routingConfig: {
              useContainerMode: false,
              patterns: [],
              containers: []
            }
          }
        ],
        proxyEnabled: true
      };

      const result = validateConfig(configWithNullColor);
      expect(result.success).toBe(true);
    });

    it('should allow empty patterns and containers arrays', () => {
      const configWithEmptyArrays = {
        version: 2,
        proxies: [
          {
            id: 'proxy_1',
            name: 'Empty Arrays Proxy',
            host: '127.0.0.1',
            port: 1080,
            proxyType: 'socks5',
            enabled: true,
            priority: 0,
            color: 'hsl(348, 83%, 62%)',
            routingConfig: {
              useContainerMode: false,
              patterns: [], // Empty is valid
              containers: [] // Empty is valid
            }
          }
        ],
        proxyEnabled: true
      };

      const result = validateConfig(configWithEmptyArrays);
      expect(result.success).toBe(true);
    });

    it('should allow optional auth field (Chrome compatibility)', () => {
      const chromeConfig = {
        version: 2,
        proxies: [
          {
            id: 'chrome_proxy',
            name: 'Chrome Proxy',
            host: '127.0.0.1',
            port: 1080,
            proxyType: 'socks5',
            // No auth field - Chrome doesn't use it
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

      const result = validateConfig(chromeConfig);
      expect(result.success).toBe(true);
    });

    it('should support all documented proxy types', () => {
      const allProxyTypes = ['socks5', 'socks4', 'http', 'https'];

      allProxyTypes.forEach(type => {
        const config = {
          version: 2,
          proxies: [
            {
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
            }
          ],
          proxyEnabled: true
        };

        const result = validateConfig(config);
        expect(result.success).toBe(true);
      });
    });

    it('should support priority range 0-9 (for 10 proxies)', () => {
      const priorities = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

      priorities.forEach(priority => {
        const config = {
          version: 2,
          proxies: [
            {
              id: `proxy_${priority}`,
              name: `Priority ${priority} Proxy`,
              host: '127.0.0.1',
              port: 1080,
              proxyType: 'socks5',
              enabled: true,
              priority: priority,
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

        const result = validateConfig(config);
        expect(result.success).toBe(true);
      });
    });

    it('should support both container mode and pattern mode', () => {
      const containerMode = {
        version: 2,
        proxies: [
          {
            id: 'container_proxy',
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
              containers: ['container-1']
            }
          }
        ],
        proxyEnabled: true
      };

      const patternMode = {
        version: 2,
        proxies: [
          {
            id: 'pattern_proxy',
            name: 'Pattern Proxy',
            host: '127.0.0.1',
            port: 1080,
            proxyType: 'socks5',
            enabled: true,
            priority: 0,
            color: null,
            routingConfig: {
              useContainerMode: false,
              patterns: ['example\\.com'],
              containers: []
            }
          }
        ],
        proxyEnabled: true
      };

      expect(validateConfig(containerMode).success).toBe(true);
      expect(validateConfig(patternMode).success).toBe(true);
    });

    it('should support valid port range (1-65535)', () => {
      const testPorts = [1, 80, 443, 1080, 8080, 3128, 65535];

      testPorts.forEach(port => {
        const config = {
          version: 2,
          proxies: [
            {
              id: `proxy_${port}`,
              name: `Port ${port} Proxy`,
              host: '127.0.0.1',
              port: port,
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

        const result = validateConfig(config);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('V2 schema rejection tests (ensure strict validation)', () => {
    it('should reject version 1 configs', () => {
      const v1Config = {
        version: 1, // Wrong version
        proxies: [],
        proxyEnabled: true
      };

      const result = validateConfig(v1Config);
      expect(result.success).toBe(false);
    });

    it('should reject configs with more than 10 proxies', () => {
      const tooManyProxies = {
        version: 2,
        proxies: Array(11).fill(null).map((_, i) => ({
          id: `proxy_${i}`,
          name: `Proxy ${i}`,
          host: '127.0.0.1',
          port: 1080,
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

      const result = validateConfig(tooManyProxies);
      expect(result.success).toBe(false);
    });

    it('should reject configs with invalid ports', () => {
      const invalidPorts = [0, -1, 65536, 100000, 'invalid'];

      invalidPorts.forEach(port => {
        const config = {
          version: 2,
          proxies: [
            {
              id: 'bad_proxy',
              name: 'Bad Port Proxy',
              host: '127.0.0.1',
              port: port,
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

        const result = validateConfig(config);
        expect(result.success).toBe(false);
      });
    });

    it('should reject configs with extra fields (strict mode)', () => {
      const extraFieldsConfig = {
        version: 2,
        proxies: [],
        proxyEnabled: true,
        extraUnknownField: 'should not be here' // Extra field
      };

      const result = validateConfig(extraFieldsConfig);
      expect(result.success).toBe(false);
    });
  });
});
