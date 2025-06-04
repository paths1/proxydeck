/**
 * Utility functions for the SOCKS Proxy Manager
 * 
 * This module provides common utility functions for the extension.
 */


// Import defaultPatternMatcher for validation purposes only
import { defaultPatternMatcher } from './modules/PatternMatcher.js';
import { DEFAULT_PROXY_CONFIG } from './common/constants.js';
import browserCapabilities from './utils/feature-detection.js';

/**
 * Validates an IP address
 * @param {string} ip - IP address to validate
 * @returns {boolean} - Whether the IP is valid
 */
export function isValidIp(ip) {
  // Basic IP validation
  const parts = ip.split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && part === num.toString();
  });
}

/**
 * Formats traffic or data sizes in human-readable form
 * @param {number} bytes - Bytes to format
 * @param {number} [decimals=1] - Number of decimal places to show (0 for none)
 * @returns {string} - Formatted size string in appropriate units
 */
export function formatTraffic(bytes, decimals = 1) {
  // Efficient implementation with configurable decimal places
  if (bytes === 0) return '0 B';
  if (bytes < 1) return bytes.toFixed(decimals) + ' B';
  
  // Use pre-calculated thresholds instead of logarithm calculations
  if (bytes < 1000) {
    // For B range, use provided decimal places (or none if decimals=0)
    return decimals === 0 ? Math.floor(bytes) + ' B' : bytes.toFixed(decimals) + ' B';
  } else if (bytes < 1000000) {
    // For KB range
    return (bytes / 1000).toFixed(decimals) + ' KB';
  } else if (bytes < 1000000000) {
    // For MB range
    return (bytes / 1000000).toFixed(decimals) + ' MB';
  } else if (bytes < 1000000000000) {
    // For GB range
    return (bytes / 1000000000).toFixed(decimals) + ' GB';
  } else {
    // For TB range
    return (bytes / 1000000000000).toFixed(decimals) + ' TB';
  }
}

/**
 * Validates a hostname
 * @param {string} hostname - Hostname to validate
 * @returns {boolean} - Whether the hostname is valid
 */
export function isValidHostname(hostname) {
  // Basic hostname validation (simplified)
  return /^[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9](\.[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9])*$/.test(hostname);
}


/**
 * Generates a unique ID for proxy configurations
 * @returns {string} - Unique ID
 */
function generateUniqueId() {
  return 'proxy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Creates a new proxy configuration with default values
 * @param {string} name - Name for the new proxy
 * @returns {Object} - New proxy configuration object
 */
export function createProxyConfig(name = 'New Proxy') {
  const config = {
    ...DEFAULT_PROXY_CONFIG,
    id: generateUniqueId(),
    name: name
  };
  
  // Remove auth fields for Chrome
  if (!browserCapabilities.browser.isFirefox) {
    delete config.auth;
  }
  
  return config;
}

/**
 * Validates a proxy configuration object
 * @param {Object} proxyConfig - The proxy configuration to validate
 * @returns {Object} - Object with validation result and error messages
 */
export function validateProxyConfig(proxyConfig) {
  const errors = [];

  // Check required fields
  if (!proxyConfig.name || proxyConfig.name.trim() === '') {
    errors.push('Proxy name is required');
  }

  if (!proxyConfig.host || proxyConfig.host.trim() === '') {
    errors.push('Proxy host is required');
  }

  if (!proxyConfig.port || isNaN(proxyConfig.port)) {
    errors.push('Valid port number is required');
  } else if (proxyConfig.port < 1 || proxyConfig.port > 65535) {
    errors.push('Port must be between 1 and 65535');
  }

  // Check routing configuration
  if (!proxyConfig.routingConfig) {
    errors.push('Routing configuration is missing');
  } else {
    if (proxyConfig.routingConfig.useContainerMode) {
      // Container mode should have at least one container
      if (!Array.isArray(proxyConfig.routingConfig.containers) ||
          proxyConfig.routingConfig.containers.length === 0) {
        errors.push('At least one container must be selected for container-based routing');
      }
    } else {
      // Pattern mode should have valid patterns
      if (Array.isArray(proxyConfig.routingConfig.patterns)) {
        for (const pattern of proxyConfig.routingConfig.patterns) {
          if (!defaultPatternMatcher.isValidRoutingPattern(pattern)) {
            errors.push(`Invalid routing pattern: ${pattern}`);
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Gets the appropriate proxy for a container
 * @param {Array} proxies - Array of proxy configurations
 * @param {string} containerId - Firefox container ID
 * @returns {Object|null} - Proxy configured for the container, or null if none
 */
function resolveProxyForContainer(proxies, containerId) {
  if (!Array.isArray(proxies) || proxies.length === 0 || !containerId) {
    return null;
  }

  // Find enabled proxies that have the container in their configuration
  const matchingProxies = proxies.filter(proxy =>
    proxy.enabled &&
    proxy.routingConfig.useContainerMode &&
    Array.isArray(proxy.routingConfig.containers) &&
    proxy.routingConfig.containers.includes(containerId)
  );

  if (matchingProxies.length === 0) {
    return null;
  }

  // Sort by priority (lower number = higher priority)
  matchingProxies.sort((a, b) => a.priority - b.priority);

  // Return the highest priority match
  return matchingProxies[0];
}

// For Chrome extension environment, make functions available globally
if (typeof window !== 'undefined') {
  window.utils = {
    // Utility functions
    isValidIp,
    isValidHostname,
    formatTraffic,
    createProxyConfig,
    validateProxyConfig,
    resolveProxyForContainer
  };
}

// For Node.js environment (test files)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Utility functions
    isValidIp,
    isValidHostname,
    formatTraffic,
    createProxyConfig,
    validateProxyConfig,
    resolveProxyForContainer
  };
}