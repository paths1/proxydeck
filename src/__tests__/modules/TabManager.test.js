import * as browser from 'webextension-polyfill';
import TabManager from '../../modules/TabManager.js';
import eventManager from '../../modules/EventManager.js';

// Mock dependencies
jest.mock('webextension-polyfill', () => ({
  tabs: {
    get: jest.fn(),
    query: jest.fn(),
    onActivated: { addListener: jest.fn(), removeListener: jest.fn() },
    onUpdated: { addListener: jest.fn(), removeListener: jest.fn() },
    onRemoved: { addListener: jest.fn(), removeListener: jest.fn() }
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setTitle: jest.fn()
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: { addListener: jest.fn(), removeListener: jest.fn() }
  },
  runtime: {
    onMessage: { addListener: jest.fn(), removeListener: jest.fn() }
  }
}));

jest.mock('../../modules/EventManager.js', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}));

describe('TabManager', () => {
  let tabManager;
  let mockProxyManager;
  let mockPatternMatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockProxyManager = {
      getProxyForTab: jest.fn()
    };
    
    mockPatternMatcher = {
      matchesAnyPattern: jest.fn()
    };
    
    tabManager = new TabManager({
      proxyManager: mockProxyManager,
      patternMatcher: mockPatternMatcher
    });
  });

  describe('Tab lifecycle management', () => {
    it('should register tab event listeners on initialization', () => {
      expect(eventManager.addEventListener).toHaveBeenCalledWith(
        'tab',
        'tab_activated',
        browser.tabs,
        'onActivated',
        expect.any(Function)
      );
      
      expect(eventManager.addEventListener).toHaveBeenCalledWith(
        'tab',
        'tab_updated',
        browser.tabs,
        'onUpdated',
        expect.any(Function)
      );
      
      expect(eventManager.addEventListener).toHaveBeenCalledWith(
        'tab',
        'tab_removed',
        browser.tabs,
        'onRemoved',
        expect.any(Function)
      );
    });

    it('should register configuration message listener on initialization', () => {
      expect(eventManager.addEventListener).toHaveBeenCalledWith(
        'message',
        'tab_manager_config_update',
        browser.runtime,
        'onMessage',
        expect.any(Function)
      );
    });

    it('should clean up tab data when tab is removed', () => {
      const tabId = 123;
      
      // Add some data for the tab
      tabManager.tabProxyMap.set(tabId, { proxyId: 'proxy1' });
      tabManager.tabUpdateQueue.set(tabId, { url: 'https://example.com' });
      tabManager.currentTabId = tabId;
      tabManager.currentTabUrl = 'https://example.com';
      
      // Simulate tab removal
      tabManager.handleTabRemoved(tabId);
      
      // Verify cleanup
      expect(tabManager.tabProxyMap.has(tabId)).toBe(false);
      expect(tabManager.tabUpdateQueue.has(tabId)).toBe(false);
      expect(tabManager.currentTabId).toBe(null);
      expect(tabManager.currentTabUrl).toBe(null);
    });

    it('should not clear current tab info when a different tab is removed', () => {
      const currentTabId = 123;
      const removedTabId = 456;
      
      // Set current tab
      tabManager.currentTabId = currentTabId;
      tabManager.currentTabUrl = 'https://example.com';
      
      // Add data for both tabs
      tabManager.tabProxyMap.set(currentTabId, { proxyId: 'proxy1' });
      tabManager.tabProxyMap.set(removedTabId, { proxyId: 'proxy2' });
      
      // Remove different tab
      tabManager.handleTabRemoved(removedTabId);
      
      // Current tab info should remain
      expect(tabManager.currentTabId).toBe(currentTabId);
      expect(tabManager.currentTabUrl).toBe('https://example.com');
      expect(tabManager.tabProxyMap.has(currentTabId)).toBe(true);
      expect(tabManager.tabProxyMap.has(removedTabId)).toBe(false);
    });
  });

  describe('cleanup method', () => {
    it('should remove all event listeners', () => {
      tabManager.cleanup();
      
      expect(eventManager.removeEventListener).toHaveBeenCalledWith('tab', 'tab_activated');
      expect(eventManager.removeEventListener).toHaveBeenCalledWith('tab', 'tab_updated');
      expect(eventManager.removeEventListener).toHaveBeenCalledWith('tab', 'tab_removed');
      expect(eventManager.removeEventListener).toHaveBeenCalledWith('alarm', 'tab_manager_alarms');
      expect(eventManager.removeEventListener).toHaveBeenCalledWith('message', 'tab_manager_config_update');
    });

    it('should clear all maps and state', () => {
      // Add some data
      tabManager.tabProxyMap.set(1, { proxyId: 'proxy1' });
      tabManager.tabProxyMap.set(2, { proxyId: 'proxy2' });
      tabManager.tabUpdateQueue.set(1, { url: 'https://example.com' });
      
      tabManager.cleanup();
      
      expect(tabManager.tabProxyMap.size).toBe(0);
      expect(tabManager.tabUpdateQueue.size).toBe(0);
      expect(browser.alarms.clear).toHaveBeenCalledWith(tabManager.ALARM_PERIODIC_CHECK);
      expect(browser.alarms.clear).toHaveBeenCalledWith(tabManager.ALARM_PROCESS_TAB_UPDATES);
    });
  });

  describe('Memory leak prevention', () => {
    it('should not accumulate entries for closed tabs', () => {
      // Simulate multiple tabs being opened and closed
      for (let i = 0; i < 100; i++) {
        const tabId = i;
        
        // Tab activated
        tabManager.tabProxyMap.set(tabId, { proxyId: `proxy${i}` });
        tabManager.tabUpdateQueue.set(tabId, { url: `https://example${i}.com` });
        
        // Tab removed
        tabManager.handleTabRemoved(tabId);
      }
      
      // Maps should be empty after all tabs are removed
      expect(tabManager.tabProxyMap.size).toBe(0);
      expect(tabManager.tabUpdateQueue.size).toBe(0);
    });

    it('should deduplicate tab updates in queue', () => {
      const tabId = 123;
      
      // Queue multiple updates for same tab
      tabManager.queueTabUpdate(tabId, 'https://example.com/page1', false);
      tabManager.queueTabUpdate(tabId, 'https://example.com/page2', false);
      tabManager.queueTabUpdate(tabId, 'https://example.com/page3', true);
      
      // Should only have the latest update
      expect(tabManager.tabUpdateQueue.size).toBe(1);
      expect(tabManager.tabUpdateQueue.get(tabId).url).toBe('https://example.com/page3');
      expect(tabManager.tabUpdateQueue.get(tabId).isActive).toBe(true);
    });
  });
});