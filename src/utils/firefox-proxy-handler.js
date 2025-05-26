/**
 * Proxy handler implementation for browsers that support request-level proxy API
 * This handles Firefox's different proxy API approach and can be used for any browser
 * that implements the onRequest listener capability
 * 
 * IMPORTANT LIMITATIONS:
 * 
 * 1. Hostname-to-IP Mappings: Firefox's WebExtension API doesn't provide a direct way
 *    to map hostnames to IPs like Chrome's declarativeNetRequest. While this extension
 *    allows storing hostnameToIpMappings in browser.storage.local, Firefox doesn't
 *    actually use these mappings in the proxy handler.
 * 
 * 2. Remote DNS Resolution: For hostname-to-IP mappings to work in Firefox, the SOCKS
 *    proxy server itself must support:
 *    - Remote DNS resolution (specified by the proxyDNS: true flag)
 *    - Custom hostname-to-IP resolution on the proxy server side
 * 
 * 3. HTTPS Certificate Warnings: When using hostname mappings with HTTPS sites, users
 *    will encounter certificate validation errors because the certificate domain
 *    won't match the requested hostname.
 */

import PatternMatcher from "../modules/PatternMatcher.js";
import browserCapabilities from "./feature-detection.js";
import * as browser from 'webextension-polyfill';

let currentConfig = null;
let enabledProxies = [];
let patternMatcher = null;
let proxyTrafficTracker = null;

// For testing purposes only - not included in production builds
if (process.env.NODE_ENV !== 'production') {
  exports._testExports = {
    getHandlerForTests: () => handleProxyRequest
  };
}

/**
 * Initialize the proxy handler with the given configuration
 * @param {Object} config - The proxy configuration
 * @param {Array} proxies - Enabled proxies
 * @param {Object} patternMatcherInstance - Optional PatternMatcher instance
 * @param {Object} trafficTracker - Optional ProxyTrafficTracker instance
 * 
 * Note: While this handler receives hostnameToIpMappings through the config,
 * browsers like Firefox do not actually apply these mappings at the browser level.
 * The mappings are stored but require proxy server-side support to work.
 */
export function initializeProxyHandler(config, proxies, patternMatcherInstance = null, trafficTracker = null) {
  if (!browserCapabilities.proxy.hasProxyRequestListener) {
    return;
  }

  currentConfig = config;
  enabledProxies = proxies || [];
  
  patternMatcher = patternMatcherInstance || new PatternMatcher();
  proxyTrafficTracker = trafficTracker;

  browser.proxy.onRequest.addListener(handleProxyRequest, { urls: ["<all_urls>"] });

  browser.proxy.onError.addListener(error => {
    console.error("[Proxy Handler] Error:", error.message);
  });

}

/**
 * Handle proxy requests in browsers that support request-level proxy
 * @param {Object} requestInfo - Information about the request
 * @returns {Object} - Browser proxy info
 */
export function handleProxyRequest(requestInfo) {
  if (!currentConfig || !currentConfig.proxyEnabled || !enabledProxies || enabledProxies.length === 0) {
    return { type: "direct" };
  }

  let url, hostname;
  try {
    url = new URL(requestInfo.url);
    hostname = url.hostname.toLowerCase();
  } catch (e) {
    console.error("[Proxy Handler] Failed to parse URL:", requestInfo.url);
    return { type: "direct" };
  }
  
  let selectedProxy = null;
  
  // Check for container-based matches first
  if (browserCapabilities.containers.hasContainerSupport && requestInfo.cookieStoreId) {
    const containerProxies = enabledProxies.filter(proxy =>
      proxy.routingConfig.useContainerMode &&
      Array.isArray(proxy.routingConfig.containers) &&
      proxy.routingConfig.containers.includes(requestInfo.cookieStoreId));
    
    if (containerProxies.length > 0) {
      // Sort by priority and select the highest priority (lowest number)
      containerProxies.sort((a, b) => a.priority - b.priority);
      selectedProxy = containerProxies[0];
    }
  }
  
  // Check for pattern-based matches using the optimized PatternMatcher
  const patternProxies = enabledProxies.filter(proxy =>
    !proxy.routingConfig.useContainerMode &&
    Array.isArray(proxy.routingConfig.patterns) &&
    proxy.routingConfig.patterns.length > 0);
  
  if (patternProxies.length > 0 && patternMatcher) {
    const patternProxy = patternMatcher.resolveProxyForHost(hostname, patternProxies);
    
    // If we found a pattern match, compare with container match (if any)
    if (patternProxy) {
      if (!selectedProxy || patternProxy.priority < selectedProxy.priority) {
        selectedProxy = patternProxy;
      }
    }
  }
  
  // If we have a selected proxy, return its configuration
  if (selectedProxy) {
    // Record the proxy selection for traffic tracking if tracker is available
    if (proxyTrafficTracker && requestInfo.requestId) {
      proxyTrafficTracker.recordProxyForRequest(
        requestInfo.requestId,
        selectedProxy.id
      );
    }
    
    const proxyType = selectedProxy.proxyType || 'socks5';
    const proxyInfo = {
      type: proxyType === 'socks5' ? 'socks' : proxyType,
      host: selectedProxy.host,
      port: parseInt(selectedProxy.port, 10),
      proxyDNS: proxyType.startsWith('socks')
    };
    
    if (selectedProxy.username && selectedProxy.password && proxyType !== 'socks4') {
      proxyInfo.username = selectedProxy.username;
      proxyInfo.password = selectedProxy.password;
    }
    
    return proxyInfo;
  }

  return { type: "direct" };
}


/**
 * Clean up the proxy handler
 */
export function cleanupProxyHandler() {
  if (browserCapabilities.proxy.hasProxyRequestListener) {
    browser.proxy.onRequest.removeListener(handleProxyRequest);
  }
}