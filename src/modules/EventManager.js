import * as browser from 'webextension-polyfill';
import browserCapabilities from '../utils/feature-detection.js';

class EventManager {
  constructor() {
    this.registeredListeners = new Map();
    
    this.webRequestListeners = {
      onCompleted: new Map(),
      onErrorOccurred: new Map(),
      onBeforeRequest: new Map()
    };
    
    this.boundHandlers = {
      onCompleted: this.handleWebRequestCompleted.bind(this),
      onErrorOccurred: this.handleWebRequestError.bind(this),
      onBeforeRequest: this.handleWebRequestBefore.bind(this)
    };
    
    this.initWebRequestListeners();
  }
  
  initWebRequestListeners() {
    if (!browser.webRequest) {
      console.warn('[EventManager] webRequest API not available');
      return;
    }
    
    if (browserCapabilities.webRequest.hasOnCompleted) {
      browser.webRequest.onCompleted.addListener(
        this.boundHandlers.onCompleted,
        { urls: ["<all_urls>"] },
        ["responseHeaders"]
      );
    }
    
    if (browserCapabilities.webRequest.hasOnErrorOccurred) {
      browser.webRequest.onErrorOccurred.addListener(
        this.boundHandlers.onErrorOccurred,
        { urls: ["<all_urls>"] }
      );
    }
    
    if (browserCapabilities.webRequest.hasOnBeforeRequest && 
        browserCapabilities.webRequest.hasRequestBodyAccess) {
      browser.webRequest.onBeforeRequest.addListener(
        this.boundHandlers.onBeforeRequest,
        { urls: ["<all_urls>"] },
        ["requestBody"]
      );
    }
  }
  
  handleWebRequestCompleted(details) {
    const listeners = this.webRequestListeners.onCompleted;
    
    for (const [id, callback] of listeners) {
      try {
        callback(details);
      } catch (error) {
        console.error(`[EventManager] Error in onCompleted listener ${id}:`, error);
      }
    }
  }
  
  handleWebRequestError(details) {
    const listeners = this.webRequestListeners.onErrorOccurred;
    
    for (const [id, callback] of listeners) {
      try {
        callback(details);
      } catch (error) {
        console.error(`[EventManager] Error in onErrorOccurred listener ${id}:`, error);
      }
    }
  }
  
  handleWebRequestBefore(details) {
    const listeners = this.webRequestListeners.onBeforeRequest;
    
    for (const [id, callback] of listeners) {
      try {
        const result = callback(details);
        if (result && (result.cancel || result.redirectUrl)) {
          return result;
        }
      } catch (error) {
        console.error(`[EventManager] Error in onBeforeRequest listener ${id}:`, error);
      }
    }
    
    return null;
  }
  
  addWebRequestListener(type, id, callback) {
    if (!this.webRequestListeners[type]) {
      console.error(`[EventManager] Unknown webRequest event type: ${type}`);
      return false;
    }
    
    this.webRequestListeners[type].set(id, callback);
    
    return true;
  }
  
  removeWebRequestListener(type, id) {
    if (!this.webRequestListeners[type]) {
      console.error(`[EventManager] Unknown webRequest event type: ${type}`);
      return false;
    }
    
    return this.webRequestListeners[type].delete(id);
  }
  
  addEventListener(type, id, target, event, callback) {
    const key = `${type}_${id}`;
    
    this.registeredListeners.set(key, {
      target,
      event,
      callback
    });
    
    target[event].addListener(callback);
    
    return true;
  }
  
  removeEventListener(type, id) {
    const key = `${type}_${id}`;
    
    const listener = this.registeredListeners.get(key);
    if (!listener) {
      return false;
    }
    
    try {
      if (listener.target && 
          listener.event && 
          listener.target[listener.event] && 
          typeof listener.target[listener.event].removeListener === 'function') {
        listener.target[listener.event].removeListener(listener.callback);
      }
    } catch (error) {
      console.error(`[EventManager] Error removing listener ${key}:`, error);
    }
    
    this.registeredListeners.delete(key);
    
    return true;
  }
  
  cleanupAllListeners() {
    Object.keys(this.webRequestListeners).forEach(type => {
      this.webRequestListeners[type].clear();
      
      try {
        if (browser.webRequest && browser.webRequest[type]) {
          browser.webRequest[type].removeListener(this.boundHandlers[type]);
        }
      } catch (error) {
        console.error(`[EventManager] Error removing ${type} listener:`, error);
      }
    });
    
    this.registeredListeners.forEach((listener, key) => {
      try {
        listener.target[listener.event].removeListener(listener.callback);
      } catch (error) {
        console.error(`[EventManager] Error removing listener ${key}:`, error);
      }
    });
    
    this.registeredListeners.clear();
  }
}

export const eventManager = new EventManager();

export default eventManager;