import * as browser from 'webextension-polyfill';

/**
 * Safe feature check helper - avoids errors when checking deep properties
 * @param {Object} obj - The object to check
 * @param {Array<string>} path - Path of properties to check
 * @returns {boolean} True if the property exists
 */
export function hasFeature(obj, path) {
  let current = obj;
  for (const prop of path) {
    if (!current || typeof current[prop] === 'undefined') {
      return false;
    }
    current = current[prop];
  }
  return true;
}

/**
 * Detects available browser capabilities
 * @returns {Object} Object containing capability flags
 */
function detectCapabilities() {
  const isFirefox = hasFeature(browser, ['runtime', 'getBrowserInfo']);
  
  return {
    browser: {
      isFirefox,
      isChrome: !isFirefox
    },
    
    proxy: {
      hasProxyRequestListener: hasFeature(browser, ['proxy', 'onRequest']),
      hasProxySettings: hasFeature(browser, ['proxy', 'settings']),
      hasPerProxyTraffic: hasFeature(browser, ['proxy', 'onRequest']) // Firefox-only feature
    },
    
    containers: {
      hasContainerSupport: hasFeature(browser, ['contextualIdentities']),
      hasTabCookieStoreIds: true // Both browsers have this through the polyfill
    },
    
    action: {
      hasBadgeTextColor: hasFeature(browser, ['action', 'setBadgeTextColor'])
    },
    
    declarativeNetRequest: {
      hasDynamicRules: hasFeature(browser, ['declarativeNetRequest', 'getDynamicRules']),
      hasUpdateDynamicRules: hasFeature(browser, ['declarativeNetRequest', 'updateDynamicRules'])
    },
    
    webRequest: {
      hasOnCompleted: hasFeature(browser, ['webRequest', 'onCompleted']),
      hasOnErrorOccurred: hasFeature(browser, ['webRequest', 'onErrorOccurred']),
      hasOnAuthRequired: hasFeature(browser, ['webRequest', 'onAuthRequired']),
      hasOnBeforeRequest: hasFeature(browser, ['webRequest', 'onBeforeRequest']),
      hasRequestBodyAccess: hasFeature(browser, ['webRequest', 'onBeforeRequest']),
      hasProxyInfoInDetails: isFirefox // Firefox provides proxyInfo in webRequest details
    },
    
    proxyAuth: {
      supportsHttpAuth: true,
      supportsHttpsAuth: true,
      supportsSocks4Auth: false,
      supportsSocks5Auth: hasFeature(browser, ['proxy', 'onRequest'])
    }
  };
}

const browserCapabilities = detectCapabilities();
export default browserCapabilities;