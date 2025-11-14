/**
 * Test fixtures for V2 configuration structure
 *
 * These represent real-world V2 configurations that should always be valid.
 * Any changes that break these fixtures represent BREAKING CHANGES to V2.
 */

/**
 * Empty V2 configuration (fresh install)
 */
export const emptyV2Config = {
  version: 2,
  proxies: [],
  proxyEnabled: true
};

/**
 * Single SOCKS5 proxy configuration (Chrome - no auth)
 */
export const singleSocks5ChromeConfig = {
  version: 2,
  proxies: [
    {
      id: 'proxy_1234567890',
      name: 'Default Proxy',
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

/**
 * Single SOCKS5 proxy with authentication (Firefox)
 */
export const singleSocks5FirefoxConfig = {
  version: 2,
  proxies: [
    {
      id: 'proxy_firefox_123',
      name: 'Authenticated Proxy',
      host: 'proxy.example.com',
      port: 1080,
      proxyType: 'socks5',
      auth: {
        username: 'testuser',
        password: 'testpass'
      },
      enabled: true,
      priority: 0,
      color: 'hsl(348, 83%, 62%)',
      routingConfig: {
        useContainerMode: false,
        patterns: ['example\\.com', '.*\\.google\\.com'],
        containers: []
      }
    }
  ],
  proxyEnabled: true
};

/**
 * Multiple proxies with different types (Chrome)
 */
export const multipleProxiesChromeConfig = {
  version: 2,
  proxies: [
    {
      id: 'proxy_http_001',
      name: 'HTTP Proxy',
      host: 'http.proxy.local',
      port: 8080,
      proxyType: 'http',
      enabled: true,
      priority: 0,
      color: 'hsl(348, 83%, 62%)',
      routingConfig: {
        useContainerMode: false,
        patterns: ['example\\.com'],
        containers: []
      }
    },
    {
      id: 'proxy_https_002',
      name: 'HTTPS Proxy',
      host: 'https.proxy.local',
      port: 3128,
      proxyType: 'https',
      enabled: true,
      priority: 1,
      color: 'hsl(28, 87%, 58%)',
      routingConfig: {
        useContainerMode: false,
        patterns: ['secure\\..*'],
        containers: []
      }
    },
    {
      id: 'proxy_socks4_003',
      name: 'SOCKS4 Proxy',
      host: '192.168.1.100',
      port: 1080,
      proxyType: 'socks4',
      enabled: false,
      priority: 2,
      color: 'hsl(48, 89%, 58%)',
      routingConfig: {
        useContainerMode: false,
        patterns: [],
        containers: []
      }
    }
  ],
  proxyEnabled: true
};

/**
 * Firefox configuration with container routing
 */
export const firefoxContainerConfig = {
  version: 2,
  proxies: [
    {
      id: 'proxy_container_work',
      name: 'Work Proxy',
      host: 'work.proxy.com',
      port: 8080,
      proxyType: 'http',
      auth: {
        username: 'workuser',
        password: 'workpass'
      },
      enabled: true,
      priority: 0,
      color: 'hsl(348, 83%, 62%)',
      routingConfig: {
        useContainerMode: true,
        patterns: [],
        containers: ['firefox-container-1', 'firefox-container-2']
      }
    },
    {
      id: 'proxy_container_personal',
      name: 'Personal Proxy',
      host: 'personal.proxy.com',
      port: 3128,
      proxyType: 'https',
      auth: {
        username: 'personaluser',
        password: 'personalpass'
      },
      enabled: true,
      priority: 1,
      color: 'hsl(28, 87%, 58%)',
      routingConfig: {
        useContainerMode: true,
        patterns: [],
        containers: ['firefox-container-3']
      }
    }
  ],
  proxyEnabled: true
};

/**
 * Configuration with maximum allowed proxies (10)
 */
export const maxProxiesConfig = {
  version: 2,
  proxies: [
    {
      id: 'proxy_001',
      name: 'Proxy 1',
      host: 'proxy1.local',
      port: 8001,
      proxyType: 'socks5',
      enabled: true,
      priority: 0,
      color: 'hsl(348, 83%, 62%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    },
    {
      id: 'proxy_002',
      name: 'Proxy 2',
      host: 'proxy2.local',
      port: 8002,
      proxyType: 'socks5',
      enabled: true,
      priority: 1,
      color: 'hsl(28, 87%, 58%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    },
    {
      id: 'proxy_003',
      name: 'Proxy 3',
      host: 'proxy3.local',
      port: 8003,
      proxyType: 'socks5',
      enabled: true,
      priority: 2,
      color: 'hsl(48, 89%, 58%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    },
    {
      id: 'proxy_004',
      name: 'Proxy 4',
      host: 'proxy4.local',
      port: 8004,
      proxyType: 'socks5',
      enabled: true,
      priority: 3,
      color: 'hsl(88, 65%, 52%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    },
    {
      id: 'proxy_005',
      name: 'Proxy 5',
      host: 'proxy5.local',
      port: 8005,
      proxyType: 'socks5',
      enabled: true,
      priority: 4,
      color: 'hsl(142, 52%, 52%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    },
    {
      id: 'proxy_006',
      name: 'Proxy 6',
      host: 'proxy6.local',
      port: 8006,
      proxyType: 'socks5',
      enabled: true,
      priority: 5,
      color: 'hsl(180, 65%, 48%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    },
    {
      id: 'proxy_007',
      name: 'Proxy 7',
      host: 'proxy7.local',
      port: 8007,
      proxyType: 'socks5',
      enabled: true,
      priority: 6,
      color: 'hsl(211, 74%, 56%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    },
    {
      id: 'proxy_008',
      name: 'Proxy 8',
      host: 'proxy8.local',
      port: 8008,
      proxyType: 'socks5',
      enabled: true,
      priority: 7,
      color: 'hsl(248, 70%, 58%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    },
    {
      id: 'proxy_009',
      name: 'Proxy 9',
      host: 'proxy9.local',
      port: 8009,
      proxyType: 'socks5',
      enabled: true,
      priority: 8,
      color: 'hsl(285, 60%, 55%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    },
    {
      id: 'proxy_010',
      name: 'Proxy 10',
      host: 'proxy10.local',
      port: 8010,
      proxyType: 'socks5',
      enabled: true,
      priority: 9,
      color: 'hsl(228, 28%, 52%)',
      routingConfig: { useContainerMode: false, patterns: [], containers: [] }
    }
  ],
  proxyEnabled: true
};

/**
 * Configuration with complex routing patterns
 */
export const complexRoutingConfig = {
  version: 2,
  proxies: [
    {
      id: 'proxy_pattern_001',
      name: 'Pattern Matching Proxy',
      host: 'pattern.proxy.local',
      port: 8080,
      proxyType: 'http',
      enabled: true,
      priority: 0,
      color: 'hsl(348, 83%, 62%)',
      routingConfig: {
        useContainerMode: false,
        patterns: [
          '.*\\.google\\.com',
          '.*\\.youtube\\.com',
          'github\\.com',
          '.*\\.github\\.io',
          'stackoverflow\\.com',
          '.*\\.stackexchange\\.com'
        ],
        containers: []
      }
    }
  ],
  proxyEnabled: true
};

/**
 * Configuration with proxy disabled globally
 */
export const proxyDisabledConfig = {
  version: 2,
  proxies: [
    {
      id: 'proxy_disabled_001',
      name: 'Inactive Proxy',
      host: 'inactive.proxy.local',
      port: 8080,
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
  proxyEnabled: false
};

/**
 * Configuration with mixed enabled/disabled proxies
 */
export const mixedEnabledConfig = {
  version: 2,
  proxies: [
    {
      id: 'proxy_enabled_001',
      name: 'Active Proxy',
      host: 'active.proxy.local',
      port: 8080,
      proxyType: 'socks5',
      enabled: true,
      priority: 0,
      color: 'hsl(348, 83%, 62%)',
      routingConfig: {
        useContainerMode: false,
        patterns: ['.*'],
        containers: []
      }
    },
    {
      id: 'proxy_disabled_002',
      name: 'Inactive Proxy',
      host: 'inactive.proxy.local',
      port: 8081,
      proxyType: 'http',
      enabled: false,
      priority: 1,
      color: 'hsl(28, 87%, 58%)',
      routingConfig: {
        useContainerMode: false,
        patterns: [],
        containers: []
      }
    }
  ],
  proxyEnabled: true
};

/**
 * All test fixtures
 */
export const allV2Fixtures = {
  emptyV2Config,
  singleSocks5ChromeConfig,
  singleSocks5FirefoxConfig,
  multipleProxiesChromeConfig,
  firefoxContainerConfig,
  maxProxiesConfig,
  complexRoutingConfig,
  proxyDisabledConfig,
  mixedEnabledConfig
};
