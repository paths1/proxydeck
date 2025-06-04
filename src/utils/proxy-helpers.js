import * as browser from 'webextension-polyfill';
import browserCapabilities from './feature-detection.js';

/**
 * Helper function to adapt Chrome proxy settings to Firefox format
 * @param {Object} chromeSettings - Chrome proxy settings object
 * @returns {Object} - Firefox compatible proxy settings
 */
export function adaptProxySettingsForFirefox(chromeSettings) {
  const chromeConfig = chromeSettings.value;
  
  let firefoxConfig = {
    value: {}
  };
  
  if (chromeConfig.mode === 'direct') {
    firefoxConfig.value = { proxyType: 'none' };
  } 
  else if (chromeConfig.mode === 'pac_script') {
    firefoxConfig.value = {
      proxyType: 'autoConfig',
      autoConfigUrl: chromeConfig.pacScript.url || '',
      autoConfigData: chromeConfig.pacScript.data || ''
    };
  }
  else if (chromeConfig.mode === 'fixed_servers') {
    firefoxConfig.value = {
      proxyType: 'manual',
      autoLogin: true,
      http: chromeConfig.rules?.singleProxy?.host || '',
      httpPort: chromeConfig.rules?.singleProxy?.port || 0,
      ssl: chromeConfig.rules?.singleProxy?.host || '',
      sslPort: chromeConfig.rules?.singleProxy?.port || 0,
      socks: chromeConfig.rules?.singleProxy?.host || '',
      socksPort: chromeConfig.rules?.singleProxy?.port || 0,
      socksVersion: 5,
      passthrough: chromeConfig.rules?.bypassList?.join(', ') || ''
    };
  }
  
  return firefoxConfig;
}

/**
 * Sets up proxy request listener for Firefox, if the capability is available
 * @param {Function} handlerFunc - The function that will handle proxy requests
 * @returns {boolean} - Whether the listener was set up successfully
 */
export function setupProxyRequestListener(handlerFunc) {
  if (!browserCapabilities.proxy.hasProxyRequestListener) return false;
  
  browser.proxy.onRequest.addListener(handlerFunc, { urls: ["<all_urls>"] });
  
  browser.proxy.onError.addListener(error => {
    console.error("Proxy error:", error.message);
  });
  
  return true;
}

/**
 * Sets proxy settings for the browser (compatible with both Chrome and Firefox)
 * @param {Object} config - Proxy configuration
 * @returns {Promise} - Promise that resolves when settings are applied
 */
export async function applyProxySettings(config) {
  try {
    if (browserCapabilities.proxy.hasProxyRequestListener) {
      return await browser.proxy.settings.clear({});
    }
    
    return await browser.proxy.settings.set({
      value: {
        mode: "pac_script",
        pacScript: {
          data: config.pacScript
        }
      },
      scope: "regular"
    });
  } catch (error) {
    console.error("[Proxy Helpers] Error applying proxy settings:", error);
    throw error;
  }
}

/**
 * @returns {Promise} - Promise that resolves when proxy is disabled
 */
export async function disableProxy() {
  try {
    return await browser.proxy.settings.set({
      value: {
        mode: "direct"
      },
      scope: "regular"
    });
  } catch (error) {
    console.error("[Proxy Helpers] Error disabling proxy:", error);
    throw error;
  }
}