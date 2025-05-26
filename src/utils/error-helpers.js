import * as browser from 'webextension-polyfill';

export const ErrorTypes = {
  PROXY_CONFIG: 'proxy_config',
  PATTERN_MATCHING: 'pattern_matching',
  BROWSER_API: 'browser_api',
  NETWORK: 'network',
  PERMISSION: 'permission',
  INTERNAL: 'internal'
};

export const ErrorSeverity = {
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Creates a structured error object with additional metadata
 * @param {string} message - Human-readable error message
 * @param {string} type - Error category from ErrorTypes
 * @param {string} severity - Error severity from ErrorSeverity
 * @param {Error|null} originalError - Original error object if available
 * @param {Object} data - Additional contextual data
 * @returns {Object} Structured error object
 */
export function createError(message, type, severity, originalError = null, data = {}) {
  return {
    message,
    type,
    severity,
    timestamp: new Date().toISOString(),
    originalError: originalError ? {
      name: originalError.name,
      message: originalError.message,
      stack: originalError.stack
    } : null,
    data
  };
}

/**
 * Logs an error to the console with consistent formatting
 * @param {Object} errorObj - Error object created with createError
 */
export function logError(errorObj) {
  const prefix = `[ProxyDeck ${errorObj.severity.toUpperCase()}]`;
  
  if (errorObj.severity === ErrorSeverity.WARNING) {
    console.warn(`${prefix} ${errorObj.message}`, errorObj);
  } else if (errorObj.severity === ErrorSeverity.CRITICAL) {
    console.error(`${prefix} ${errorObj.message}`, errorObj);
  } else {
    console.error(`${prefix} ${errorObj.message}`, errorObj);
  }
  
  storeErrorInHistory(errorObj);
}

/**
 * Stores error in browser storage for history/debugging
 * @param {Object} errorObj - Error object to store
 */
async function storeErrorInHistory(errorObj) {
  try {
    const result = await browser.storage.local.get('errorHistory');
    const errorHistory = result.errorHistory || [];
    
    errorHistory.unshift(errorObj);
    if (errorHistory.length > 20) {
      errorHistory.pop();
    }
    
    await browser.storage.local.set({ errorHistory });
  } catch (err) {
    console.error('Failed to store error history:', err);
  }
}

/**
 * Gets the error history from browser storage
 * @returns {Promise<Array>} Array of error objects
 */
export async function getErrorHistory() {
  try {
    const result = await browser.storage.local.get('errorHistory');
    return result.errorHistory || [];
  } catch (err) {
    console.error('Failed to retrieve error history:', err);
    return [];
  }
}

/**
 * Clears the error history
 * @returns {Promise<void>}
 */
export async function clearErrorHistory() {
  try {
    await browser.storage.local.remove('errorHistory');
  } catch (err) {
    console.error('Failed to clear error history:', err);
  }
}

/**
 * Handles an error by logging it and optionally notifying the user
 * @param {string} message - Error message
 * @param {string} type - Error type from ErrorTypes
 * @param {string} severity - Error severity from ErrorSeverity
 * @param {Error|null} originalError - Original error if available
 * @param {Object} options - Additional options
 * @returns {Object} The created error object
 */
export function handleError(message, type, severity, originalError = null, options = {}) {
  const errorObj = createError(message, type, severity, originalError, options.data || {});
  
  logError(errorObj);
  
  if (options.notify) {
    showErrorNotification(errorObj);
  }
  
  if (options.updateUI) {
    browser.runtime.sendMessage({
      action: 'errorOccurred',
      error: errorObj
    }).catch(() => {
    });
  }
  
  return errorObj;
}

/**
 * Shows an error notification to the user
 * @param {Object} errorObj - Error object to show
 */
export function showErrorNotification(errorObj) {
  browser.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon48-dark.png',
    title: `ProxyDeck ${errorObj.severity === ErrorSeverity.WARNING ? 'Warning' : 'Error'}`,
    message: errorObj.message
  }).catch(err => {
    console.error('Failed to show notification:', err);
  });
}

/**
 * Wraps an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} errorOptions - Options for error handling
 * @returns {Function} Wrapped function with error handling
 */
export function withErrorHandling(fn, errorOptions = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const type = errorOptions.type || ErrorTypes.INTERNAL;
      const severity = errorOptions.severity || ErrorSeverity.ERROR;
      const message = errorOptions.message || 'An error occurred';
      
      handleError(message, type, severity, error, {
        data: { functionName: fn.name, arguments: args },
        notify: errorOptions.notify,
        updateUI: errorOptions.updateUI
      });
      
      if (errorOptions.rethrow) {
        throw error;
      }
      
      return errorOptions.fallbackValue;
    }
  };
}