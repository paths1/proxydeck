// jest.setup.js

// Mock Chrome extension API manually since jest-chrome has compatibility issues
global.chrome = {
  runtime: {
    sendMessage: jest.fn().mockResolvedValue({}),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getManifest: jest.fn().mockReturnValue({ manifest_version: 3, name: 'Test Extension', version: '1.0.0' }),
    getURL: jest.fn(path => `chrome-extension://test-extension-id/${path}`),
    id: 'test-extension-id',
    lastError: undefined,
    openOptionsPage: jest.fn().mockResolvedValue(undefined)
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined)
    },
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined)
    }
  },
  action: {
    setIcon: jest.fn(),
    setTitle: jest.fn(),
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setBadgeTextColor: jest.fn()
  },
  webRequest: {
    onBeforeRequest: { addListener: jest.fn(), removeListener: jest.fn() },
    onCompleted: { addListener: jest.fn(), removeListener: jest.fn() },
    onErrorOccurred: { addListener: jest.fn(), removeListener: jest.fn() },
    onAuthRequired: { addListener: jest.fn(), removeListener: jest.fn() }
  },
  proxy: {
    settings: {
      get: jest.fn().mockResolvedValue({ value: { mode: 'direct' }, levelOfControl: 'controlled_by_this_extension' }),
      set: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined)
    },
    onError: { addListener: jest.fn(), removeListener: jest.fn() },
    onRequest: { addListener: jest.fn(), removeListener: jest.fn() }
  },
  declarativeNetRequest: {
    getDynamicRules: jest.fn().mockResolvedValue([]),
    updateDynamicRules: jest.fn().mockResolvedValue(undefined)
  },
  notifications: {
    create: jest.fn().mockResolvedValue("mock-notification-id")
  },
  contextMenus: {
    create: jest.fn(),
    remove: jest.fn(),
    removeAll: jest.fn()
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    reload: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({})
  },
  permissions: {
    contains: jest.fn().mockResolvedValue(true),
    request: jest.fn().mockResolvedValue(true)
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: { addListener: jest.fn(), removeListener: jest.fn() }
  },
  identity: {
    getProfileUserInfo: jest.fn().mockResolvedValue({ email: 'test@example.com', id: '123' })
  }
};



// --- Global Mocks ---

// Mock global.fetch (example, if your extension uses it directly)
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 204, // Simulate successful HEAD request for testConnection
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  })
);

// Mock URL (jsdom usually provides this, but good to be explicit if needed elsewhere)
// global.URL = require('url').URL; // Or use the URL class from the 'url' module

// Mock for performance.now() if needed for precise timing tests
// global.performance = {
//   now: jest.fn().mockReturnValue(Date.now()), // Or a fixed sequence of numbers
// };

// You can add other global mocks or configurations here.
// For example, if you use timers and want to control them:
// jest.useFakeTimers(); // If you want to use fake timers by default for all tests

console.error = jest.fn(); // Suppress console.error for cleaner test output, or customize
console.warn = jest.fn();  // Suppress console.warn
// console.log = jest.fn(); // If you want to suppress console.log too

// Add testing library DOM matchers
import '@testing-library/jest-dom';

// Mock Recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => children,
  AreaChart: ({ children }) => children,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// Reset all mocks before each test automatically
// This is generally good practice, but `jest.config.js` can also set `clearMocks: true`
// beforeEach(() => {
//   jest.clearAllMocks();
//   if (chrome.runtime && chrome.runtime.lastError !== undefined) {
//     chrome.runtime.lastError = undefined; // Reset lastError
//   }
// });