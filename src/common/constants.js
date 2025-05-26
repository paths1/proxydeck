
export const MESSAGE_ACTIONS = {
  GET_CONFIG: 'getConfig',
  SAVE_CONFIG: 'saveConfig',
  UPDATE_PROXY_PATTERNS: 'updateProxyPatterns',
  UPDATE_PROXY_CONTAINERS: 'updateProxyContainers',
  UPDATE_PROXY_ROUTING_MODE: 'updateProxyRoutingMode',
  
  TOGGLE_PROXY_STATE: 'toggleProxyState',
  TOGGLE_PROXY: 'toggleProxy',
  
  GET_PROXY_FOR_TAB: 'getProxyForTab',
  GET_MATCHING_PROXIES: 'getMatchingProxies',
  
  
  GET_TRAFFIC_DATA: 'getTrafficData',
  GET_TRAFFIC_SOURCES: 'getTrafficSources',
  SET_TRAFFIC_WINDOW: 'setTrafficWindow',
  TRAFFIC_UPDATE: 'trafficUpdate',
  
  CONFIGURATION_UPDATED: 'configurationUpdated',
  
  UPDATE_ICON_THEME: 'updateIconTheme',
  
  PING: 'ping'
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

export default MESSAGE_ACTIONS;