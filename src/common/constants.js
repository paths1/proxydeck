
export const MESSAGE_ACTIONS = {
  GET_CONFIG: 'getConfig',
  SAVE_CONFIG: 'saveConfig',
  
  TOGGLE_PROXY_STATE: 'toggleProxyState',
  
  GET_PROXY_FOR_TAB: 'getProxyForTab',
  
  GET_TRAFFIC_DATA: 'getTrafficData',
  GET_TRAFFIC_SOURCES: 'getTrafficSources',
  TRAFFIC_UPDATE: 'trafficUpdate',
  
  CONFIGURATION_UPDATED: 'configurationUpdated',
  
  UPDATE_ICON_THEME: 'updateIconTheme'
};

export const ALARMS = {
  TAB_CHECK_AFTER_TOGGLE: 'tabCheckAfterToggle'
};

export const DEFAULT_PROXY_CONFIG = {
  id: null,
  name: 'New Proxy',
  host: '127.0.0.1',
  port: 1080,
  proxyType: 'socks5',
  auth: {
    username: '',
    password: '',
  },
  enabled: true,
  priority: 0,
  color: null,
  routingConfig: {
    useContainerMode: false,
    patterns: [],
    containers: []
  }
};

export const DEFAULT_SINGLE_PROXY_CONFIG = {
  proxyEnabled: true,
  proxyHost: "",
  proxyPort: 1080,
  username: "",
  password: "",
  routingPatterns: [],
  disableNetworks: [],
  useContainerMode: false,
  proxyContainers: []
};

export const DEFAULT_MULTI_PROXY_CONFIG = {
  proxies: [],
  version: 2
};

export const TRAFFIC_WINDOWS = {
  '1min': { size: 60, label: '60 sec' },
  '5min': { size: 300, label: '5 min' },
  '10min': { size: 600, label: '10 min' }
};

export const MODERN_PRIORITY_COLORS = [
  'hsl(348, 83%, 62%)', // Vibrant red-pink - Critical (Priority 0)
  'hsl(28, 87%, 58%)',  // Warm orange - High (Priority 1)
  'hsl(48, 89%, 58%)',  // Golden yellow - Medium-high (Priority 2)
  'hsl(88, 65%, 52%)',  // Lime green - Medium-high (Priority 3)
  'hsl(142, 52%, 52%)', // Forest green - Medium (Priority 4)
  'hsl(180, 65%, 48%)', // Teal - Medium (Priority 5)
  'hsl(211, 74%, 56%)', // Ocean blue - Low (Priority 6)
  'hsl(248, 70%, 58%)', // Purple - Low (Priority 7)
  'hsl(285, 60%, 55%)', // Magenta - Lower (Priority 8)
  'hsl(228, 28%, 52%)'  // Cool gray-blue - Lowest (Priority 9)
];

export const PROXY_COLORS = {
  0: { bg: 'rgba(99, 102, 241, 0.2)', border: 'rgba(99, 102, 241, 1)' },
  1: { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgba(236, 72, 153, 1)' },
  2: { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 1)' },
  3: { bg: 'rgba(251, 146, 60, 0.2)', border: 'rgba(251, 146, 60, 1)' },
  4: { bg: 'rgba(147, 51, 234, 0.2)', border: 'rgba(147, 51, 234, 1)' }
};

export const SPECIAL_TRAFFIC_COLORS = {
  DIRECT: 'hsl(0, 0%, 30%)',      // Dark gray for direct traffic
  OTHERS: 'hsl(0, 0%, 70%)'       // Light gray for unmatched proxies
};

// Cache configuration constants
export const CACHE_LIMITS = {
  PROXY_RESOLVER: 1000,           // Max entries in proxy resolution cache
  PROXY_RESOLVER_CLEANUP: 500,    // Entries to keep after cleanup (50%)
  TRAFFIC_MONITOR: 1000,          // Max entries in traffic monitor cache
  PATTERN_MATCHER: 500,           // Max entries in pattern matcher cache
  UNIFIED_CACHE: 1000             // Max entries in unified cache manager
};

// Timeout and interval constants (in milliseconds)
export const TIMEOUTS = {
  TAB_UPDATE_DELAY: 150,          // Delay before processing tab updates
  PROCESSING_INTERVAL: 25,        // Traffic monitor processing interval
  SAMPLE_INTERVAL: 1000,          // Traffic sampling interval (1 second)
  PERIODIC_TAB_CHECK: 8000,       // Periodic tab check interval (8 seconds)
  CACHE_TTL: 60000,               // Cache time-to-live (1 minute)
  FULL_RECALC_INTERVAL: 60000     // Stats full recalculation interval
};

// Queue and batch processing constants
export const QUEUE_LIMITS = {
  MAX_QUEUE_SIZE: 1000,           // Max requests in traffic monitor queue
  MAX_BATCH_SIZE: 100,            // Max requests to process per batch
  TAB_UPDATE_BATCH_SIZE: 5        // Max tabs to update per batch
};

// Traffic monitor constants
export const TRAFFIC_CONFIG = {
  MAX_HISTORY_POINTS: 60,         // Max data points to keep per window
  REQUEST_THROTTLE_MS: 100,       // Request throttling time
  MAX_PENDING_REQUESTS: 50,       // Max pending requests before throttling
  AGGREGATION_INTERVALS: {
    '5min': 5,                    // Aggregate every 5 samples for 5min view
    '10min': 10                   // Aggregate every 10 samples for 10min view
  }
};

// Proxy configuration limits
export const PROXY_LIMITS = {
  MAX_PROXIES: 10,                // Maximum number of proxies allowed
  MIN_PORT: 1,                    // Minimum valid port number
  MAX_PORT: 65535                 // Maximum valid port number
};

export default MESSAGE_ACTIONS;