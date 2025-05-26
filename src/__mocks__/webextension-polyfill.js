/**
 * Mock implementation of the WebExtension Polyfill (browser.* APIs)
 *
 * This manual mock is used by Jest to replace the actual webextension-polyfill
 * during tests. It provides standardized mock implementations of browser APIs.
 */

// Helper to create a mock for event objects (addListener, removeListener, etc.)
const createMockEvent = () => ({
  addListener: jest.fn(),
  removeListener: jest.fn(),
  hasListener: jest.fn().mockReturnValue(false),
  dispatch: jest.fn(), // Helper for tests to simulate event firing
});

// Helper to create a mock for Promise-based APIs
const createMockPromiseAPI = (defaultReturnValue = {}) => {
  return jest.fn().mockResolvedValue(defaultReturnValue);
};

const browser = {
  // Action API (covers browserAction and pageAction for MV2/MV3)
  action: {
    setIcon: createMockPromiseAPI(undefined),
    setTitle: createMockPromiseAPI(undefined),
    setBadgeText: createMockPromiseAPI(undefined),
    getBadgeText: createMockPromiseAPI({text: ''}),
    setBadgeBackgroundColor: createMockPromiseAPI(undefined),
    getBadgeBackgroundColor: createMockPromiseAPI({color: '#000000'}),
    setBadgeTextColor: createMockPromiseAPI(undefined), // MV3 specific
    // getBadgeTextColor: createMockPromiseAPI({color: '#FFFFFF'}), // If needed
    setPopup: createMockPromiseAPI(undefined),
    getPopup: createMockPromiseAPI({popup: ''}),
    enable: createMockPromiseAPI(undefined),
    disable: createMockPromiseAPI(undefined),
    onClicked: createMockEvent(),
  },

  // Alarms API
  alarms: {
    create: jest.fn(), // Not promise-based by default
    get: createMockPromiseAPI(undefined),
    getAll: createMockPromiseAPI([]),
    clear: createMockPromiseAPI(true),
    clearAll: createMockPromiseAPI(true),
    onAlarm: createMockEvent(),
  },

  // Commands API
  commands: {
    getAll: createMockPromiseAPI([]),
    onCommand: createMockEvent(),
  },

  // ContextualIdentities API (Firefox-specific)
  contextualIdentities: {
    create: createMockPromiseAPI({ cookieStoreId: 'firefox-container-new' }),
    get: createMockPromiseAPI({ cookieStoreId: 'firefox-container-1', name: 'Test Container', color: 'blue', icon: 'fingerprint' }),
    query: createMockPromiseAPI([{ cookieStoreId: 'firefox-container-1', name: 'Test Container' }]),
    update: createMockPromiseAPI({ cookieStoreId: 'firefox-container-1' }),
    remove: createMockPromiseAPI(undefined),
    onCreated: createMockEvent(),
    onRemoved: createMockEvent(),
    onUpdated: createMockEvent(),
  },

  // Cookies API
  cookies: {
    get: createMockPromiseAPI(null), // Can return null if not found
    getAll: createMockPromiseAPI([]),
    set: createMockPromiseAPI({}),
    remove: createMockPromiseAPI({}),
    getAllCookieStores: createMockPromiseAPI([{ id: 'firefox-default', tabIds: [] }]),
    onChanged: createMockEvent(),
  },

  // DeclarativeNetRequest API
  declarativeNetRequest: {
    MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 5000,
    getDynamicRules: createMockPromiseAPI([]),
    updateDynamicRules: createMockPromiseAPI(undefined),
    getSessionRules: createMockPromiseAPI([]),
    updateSessionRules: createMockPromiseAPI(undefined),
    isRegexSupported: createMockPromiseAPI({isSupported: true}),
    onRuleMatchedDebug: createMockEvent(), // For MV3 debug
    // For older versions or different structures, you might need:
    // updateDynamicRules: jest.fn((options, callback) => {
    //   if (callback) callback();
    //   return Promise.resolve();
    // }),
    // getDynamicRules: jest.fn(callback => {
    //   if (callback) callback([]);
    //   return Promise.resolve([]);
    // }),
  },

  // Extension API
  extension: {
    getURL: jest.fn(path => `moz-extension://test-extension-id/${path}`), // or chrome-extension://
    getBackgroundPage: createMockPromiseAPI(window), // or null
    getViews: createMockPromiseAPI([]),
    isAllowedFileSchemeAccess: createMockPromiseAPI(true),
    isAllowedIncognitoAccess: createMockPromiseAPI(true),
    // sendRequest: jest.fn(), // Deprecated, use runtime.sendMessage
  },

  // i18n API
  i18n: {
    getMessage: jest.fn(messageName => messageName),
    getAcceptLanguages: createMockPromiseAPI(['en-US', 'en']),
    getUILanguage: jest.fn(() => 'en-US'),
    detectLanguage: createMockPromiseAPI({ languages: [] }),
  },

  // Notifications API
  notifications: {
    create: createMockPromiseAPI('notificationId'),
    update: createMockPromiseAPI(true),
    clear: createMockPromiseAPI(true),
    getAll: createMockPromiseAPI({}),
    getPermissionLevel: createMockPromiseAPI('granted'),
    onClosed: createMockEvent(),
    onClicked: createMockEvent(),
    onButtonClicked: createMockEvent(),
    // onPermissionLevelChanged: createMockEvent(), // If needed
    // onShowSettings: createMockEvent(), // If needed
  },

  // Permissions API
  permissions: {
    contains: createMockPromiseAPI(true),
    getAll: createMockPromiseAPI({ origins: [], permissions: [] }),
    request: createMockPromiseAPI(true),
    remove: createMockPromiseAPI(true),
    onAdded: createMockEvent(),
    onRemoved: createMockEvent(),
  },

  // Proxy API
  proxy: {
    settings: {
      get: createMockPromiseAPI({ value: { mode: 'direct' }, levelOfControl: 'controlled_by_this_extension' }),
      set: createMockPromiseAPI(undefined),
      clear: createMockPromiseAPI(undefined),
      onChange: createMockEvent(), // Note: This is `proxy.onProxyConfigChanged` in some docs. Polyfill maps to `settings.onChange`.
    },
    onRequest: createMockEvent(), // Firefox-specific for dynamic proxying
    onError: createMockEvent(),
  },

  // Runtime API
  runtime: {
    id: 'test-extension-id',
    getManifest: jest.fn().mockReturnValue({ manifest_version: 3, name: 'Test Extension', version: '1.0.0' }),
    getURL: jest.fn(path => `moz-extension://test-extension-id/${path}`),
    setUninstallURL: createMockPromiseAPI(undefined),
    reload: jest.fn(),
    requestUpdateCheck: createMockPromiseAPI({ status: 'no_update' }),
    openOptionsPage: createMockPromiseAPI(undefined),
    getPlatformInfo: createMockPromiseAPI({ os: 'mac', arch: 'x86-64', nacl_arch: 'x86-64' }), // Example values
    getPackageDirectoryEntry: createMockPromiseAPI(undefined), // Or a mock DirectoryEntry

    // Messaging
    sendMessage: createMockPromiseAPI({}), // For messages to other parts of the extension
    sendNativeMessage: createMockPromiseAPI({}), // For native messaging
    connect: jest.fn().mockReturnValue({ // For long-lived connections
      name: 'test-port',
      postMessage: jest.fn(),
      disconnect: jest.fn(),
      onMessage: createMockEvent(),
      onDisconnect: createMockEvent(),
    }),
    onConnect: createMockEvent(),
    onMessage: createMockEvent(),
    onMessageExternal: createMockEvent(), // For messages from other extensions/web pages
    onConnectExternal: createMockEvent(),

    // Lifecycle events
    onInstalled: createMockEvent(),
    onStartup: createMockEvent(),
    onUpdateAvailable: createMockEvent(),
    onBrowserUpdateAvailable: createMockEvent(),
    onRestartRequired: createMockEvent(),
    onSuspend: createMockEvent(),
    onSuspendCanceled: createMockEvent(),

    // Error handling
    lastError: undefined, // Can be set by tests to simulate errors
  },

  // Scripting API (MV3)
  scripting: {
    executeScript: createMockPromiseAPI([{ result: undefined }]),
    insertCSS: createMockPromiseAPI(undefined),
    removeCSS: createMockPromiseAPI(undefined),
    registerContentScripts: createMockPromiseAPI(undefined),
    getRegisteredContentScripts: createMockPromiseAPI([]),
    unregisterContentScripts: createMockPromiseAPI(undefined),
    // updateContentScripts: createMockPromiseAPI(undefined), // If needed
  },

  // Storage API
  storage: {
    local: {
      get: createMockPromiseAPI({}),
      set: createMockPromiseAPI(undefined),
      remove: createMockPromiseAPI(undefined),
      clear: createMockPromiseAPI(undefined),
      getBytesInUse: createMockPromiseAPI(0),
    },
    sync: {
      get: createMockPromiseAPI({}),
      set: createMockPromiseAPI(undefined),
      remove: createMockPromiseAPI(undefined),
      clear: createMockPromiseAPI(undefined),
      getBytesInUse: createMockPromiseAPI(0),
    },
    managed: {
      get: createMockPromiseAPI({}),
      // set, remove, clear are not typically available for managed storage
      getBytesInUse: createMockPromiseAPI(0),
    },
    session: { // MV3 specific
      get: createMockPromiseAPI({}),
      set: createMockPromiseAPI(undefined),
      remove: createMockPromiseAPI(undefined),
      clear: createMockPromiseAPI(undefined),
      getBytesInUse: createMockPromiseAPI(0),
    },
    onChanged: createMockEvent(),
  },

  // Tabs API
  tabs: {
    get: createMockPromiseAPI({ id: 1, url: 'https://example.com', active: true, windowId: 1 }),
    getCurrent: createMockPromiseAPI({ id: 1, url: 'https://example.com', active: true, windowId: 1 }), // Usually used in popups/options
    connect: jest.fn((tabId, connectInfo) => ({ // For messaging to content scripts
      name: connectInfo?.name || 'test-tab-port',
      postMessage: jest.fn(),
      disconnect: jest.fn(),
      onMessage: createMockEvent(),
      onDisconnect: createMockEvent(),
      sender: { tab: { id: tabId } },
    })),
    // sendRequest: jest.fn(), // Deprecated
    sendMessage: createMockPromiseAPI({}), // For messaging to content scripts in a specific tab

    create: createMockPromiseAPI({ id: 2, url: 'https://newtab.com', active: true, windowId: 1 }),
    duplicate: createMockPromiseAPI({ id: 3 }),
    query: createMockPromiseAPI([]), // Default to empty array
    highlight: createMockPromiseAPI({ windowId: 1, tabIds: [1] }),
    update: createMockPromiseAPI({ id: 1, url: 'https://updated.com' }),
    move: createMockPromiseAPI(undefined), // or the moved tab(s)
    reload: createMockPromiseAPI(undefined),
    remove: createMockPromiseAPI(undefined),
    detectLanguage: createMockPromiseAPI('en'),
    captureVisibleTab: createMockPromiseAPI('data:image/jpeg;base64,...'),
    executeScript: createMockPromiseAPI([undefined]), // For MV2; MV3 uses browser.scripting
    insertCSS: createMockPromiseAPI(undefined),      // For MV2; MV3 uses browser.scripting
    removeCSS: createMockPromiseAPI(undefined),      // For MV2; MV3 uses browser.scripting
    setZoom: createMockPromiseAPI(undefined),
    getZoom: createMockPromiseAPI(1),
    setZoomSettings: createMockPromiseAPI(undefined),
    getZoomSettings: createMockPromiseAPI({ mode: 'automatic', defaultZoomFactor: 1, scope: 'per-origin'}),
    discard: createMockPromiseAPI(undefined), // MV3 specific

    // Events
    onActivated: createMockEvent(),
    onAttached: createMockEvent(),
    onCreated: createMockEvent(),
    onDetached: createMockEvent(),
    onHighlighted: createMockEvent(),
    onMoved: createMockEvent(),
    onRemoved: createMockEvent(),
    onReplaced: createMockEvent(),
    onUpdated: createMockEvent(),
    onZoomChange: createMockEvent(),
  },

  // WebNavigation API
  webNavigation: {
    getFrame: createMockPromiseAPI(null),
    getAllFrames: createMockPromiseAPI([]),
    onBeforeNavigate: createMockEvent(),
    onCommitted: createMockEvent(),
    onDOMContentLoaded: createMockEvent(),
    onCompleted: createMockEvent(),
    onErrorOccurred: createMockEvent(),
    onCreatedNavigationTarget: createMockEvent(),
    onReferenceFragmentUpdated: createMockEvent(),
    onTabReplaced: createMockEvent(),
    onHistoryStateUpdated: createMockEvent(),
  },

  // WebRequest API
  webRequest: {
    // These are all event objects
    onBeforeRequest: createMockEvent(),
    onBeforeSendHeaders: createMockEvent(),
    onSendHeaders: createMockEvent(),
    onHeadersReceived: createMockEvent(),
    onAuthRequired: createMockEvent(),
    onResponseStarted: createMockEvent(),
    onBeforeRedirect: createMockEvent(),
    onCompleted: createMockEvent(),
    onErrorOccurred: createMockEvent(),
    // handlerBehaviorChanged: createMockPromiseAPI(undefined), // If you use this
  },

  // Windows API
  windows: {
    get: createMockPromiseAPI({ id: 1, focused: true, type: 'normal', state: 'normal' }),
    getCurrent: createMockPromiseAPI({ id: 1, focused: true, type: 'normal', state: 'normal' }),
    getLastFocused: createMockPromiseAPI({ id: 1, focused: true, type: 'normal', state: 'normal' }),
    getAll: createMockPromiseAPI([]),
    create: createMockPromiseAPI({ id: 2 }),
    update: createMockPromiseAPI({ id: 1 }),
    remove: createMockPromiseAPI(undefined),
    onCreated: createMockEvent(),
    onFocusChanged: createMockEvent(),
    onRemoved: createMockEvent(),
    // onBoundsChanged: createMockEvent(), // If needed
  },
  
  // Add other APIs as needed by your extension
  // Example:
  // topSites: {
  //   get: createMockPromiseAPI([])
  // },
  // history: {
  //   search: createMockPromiseAPI([])
  // },
  // bookmarks: {
  //   getTree: createMockPromiseAPI([])
  // },
};

module.exports = browser;