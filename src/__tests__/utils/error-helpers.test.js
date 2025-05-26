// error-helpers.test.js
import * as browser from 'webextension-polyfill';
import * as errorHelpers from '../../utils/error-helpers';

describe('Error Helpers', () => {
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation()
    };

    // Mock browser.storage.local
    browser.storage.local.get.mockImplementation(key => {
      if (key === 'errorHistory') {
        return Promise.resolve({ errorHistory: [{ message: 'Old error' }] });
      }
      return Promise.resolve({});
    });
    browser.storage.local.set.mockResolvedValue(undefined);
    browser.storage.local.remove.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
  });

  describe('createError', () => {
    it('should create a structured error object', () => {
      const originalError = new Error('Original error message');
      originalError.stack = 'Error stack trace';
      
      const result = errorHelpers.createError(
        'Test error message',
        errorHelpers.ErrorTypes.PROXY_CONFIG,
        errorHelpers.ErrorSeverity.ERROR,
        originalError,
        { additionalInfo: 'test-info' }
      );
      
      expect(result).toEqual({
        message: 'Test error message',
        type: errorHelpers.ErrorTypes.PROXY_CONFIG,
        severity: errorHelpers.ErrorSeverity.ERROR,
        timestamp: expect.any(String),
        originalError: {
          name: 'Error',
          message: 'Original error message',
          stack: 'Error stack trace'
        },
        data: { additionalInfo: 'test-info' }
      });
      
      // Verify timestamp is correctly formatted
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
    
    it('should handle missing original error', () => {
      const result = errorHelpers.createError(
        'Test error message',
        errorHelpers.ErrorTypes.PROXY_CONFIG,
        errorHelpers.ErrorSeverity.ERROR
      );
      
      expect(result.originalError).toBeNull();
    });
    
    it('should use empty object as default data', () => {
      const result = errorHelpers.createError(
        'Test error message',
        errorHelpers.ErrorTypes.PROXY_CONFIG,
        errorHelpers.ErrorSeverity.ERROR
      );
      
      expect(result.data).toEqual({});
    });
  });

  describe('logError', () => {
    it('should log warning for warning severity', () => {
      const errorObj = {
        message: 'Warning message',
        severity: errorHelpers.ErrorSeverity.WARNING,
        type: errorHelpers.ErrorTypes.NETWORK
      };
      
      errorHelpers.logError(errorObj);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[ProxyDeck WARNING] Warning message',
        errorObj
      );
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
    
    it('should log error for error severity', () => {
      const errorObj = {
        message: 'Error message',
        severity: errorHelpers.ErrorSeverity.ERROR,
        type: errorHelpers.ErrorTypes.BROWSER_API
      };
      
      errorHelpers.logError(errorObj);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[ProxyDeck ERROR] Error message',
        errorObj
      );
    });
    
    it('should log error for critical severity', () => {
      const errorObj = {
        message: 'Critical error',
        severity: errorHelpers.ErrorSeverity.CRITICAL,
        type: errorHelpers.ErrorTypes.INTERNAL
      };
      
      errorHelpers.logError(errorObj);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[ProxyDeck CRITICAL] Critical error',
        errorObj
      );
    });
    
    it('should store error in history indirectly', async () => {
      const errorObj = {
        message: 'Test error',
        severity: errorHelpers.ErrorSeverity.ERROR,
        type: errorHelpers.ErrorTypes.PROXY_CONFIG
      };
      
      errorHelpers.logError(errorObj);
      
      // Wait a tick for the async code to execute
      await new Promise(process.nextTick);
      
      // Verify the error was stored
      expect(browser.storage.local.get).toHaveBeenCalledWith('errorHistory');
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        errorHistory: expect.arrayContaining([errorObj])
      });
    });
  });

  describe('getErrorHistory', () => {
    it('should retrieve error history from storage', async () => {
      const mockHistory = [{ message: 'Error 1' }, { message: 'Error 2' }];
      browser.storage.local.get.mockResolvedValueOnce({ errorHistory: mockHistory });
      
      const result = await errorHelpers.getErrorHistory();
      
      expect(browser.storage.local.get).toHaveBeenCalledWith('errorHistory');
      expect(result).toEqual(mockHistory);
    });
    
    it('should return empty array if no history exists', async () => {
      browser.storage.local.get.mockResolvedValueOnce({});
      
      const result = await errorHelpers.getErrorHistory();
      
      expect(result).toEqual([]);
    });
    
    it('should handle storage errors', async () => {
      browser.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await errorHelpers.getErrorHistory();
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Failed to retrieve error history:',
        expect.any(Error)
      );
      expect(result).toEqual([]);
    });
  });

  describe('clearErrorHistory', () => {
    it('should remove error history from storage', async () => {
      await errorHelpers.clearErrorHistory();
      
      expect(browser.storage.local.remove).toHaveBeenCalledWith('errorHistory');
    });
    
    it('should handle storage errors', async () => {
      browser.storage.local.remove.mockRejectedValueOnce(new Error('Storage error'));
      
      await errorHelpers.clearErrorHistory();
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Failed to clear error history:',
        expect.any(Error)
      );
    });
  });

  describe('handleError', () => {
    it('should create and log error', () => {
      // Test that handleError properly creates and logs errors
      const originalError = new Error('Original error');
      
      // Since we can't easily mock internal functions, we'll directly test the return value
      const result = errorHelpers.handleError(
        'Test error message',
        errorHelpers.ErrorTypes.NETWORK,
        errorHelpers.ErrorSeverity.ERROR,
        originalError,
        { data: { testData: true } }
      );
      
      // Verify the error object structure
      expect(result).toEqual({
        message: 'Test error message',
        type: errorHelpers.ErrorTypes.NETWORK,
        severity: errorHelpers.ErrorSeverity.ERROR,
        timestamp: expect.any(String),
        originalError: expect.objectContaining({
          name: 'Error',
          message: 'Original error'
        }),
        data: { testData: true }
      });
    });
    
    it('should show notification when notify option is true', () => {
      // Mock notifications.create to verify it's called
      const notificationSpy = jest.spyOn(browser.notifications, 'create');
      
      errorHelpers.handleError(
        'Test error message',
        errorHelpers.ErrorTypes.NETWORK,
        errorHelpers.ErrorSeverity.ERROR,
        null,
        { notify: true }
      );
      
      // Verify notification was created
      expect(notificationSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'basic',
        message: 'Test error message'
      }));
    });
    
    it('should send message to UI when updateUI option is true', () => {
      errorHelpers.handleError(
        'Test error message',
        errorHelpers.ErrorTypes.NETWORK,
        errorHelpers.ErrorSeverity.ERROR,
        null,
        { updateUI: true }
      );
      
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'errorOccurred',
        error: expect.any(Object)
      });
    });
    
    it('should ignore messaging errors', () => {
      browser.runtime.sendMessage.mockRejectedValue(new Error('No receivers'));
      
      // Should not throw
      expect(() => {
        errorHelpers.handleError(
          'Test error message',
          errorHelpers.ErrorTypes.NETWORK,
          errorHelpers.ErrorSeverity.ERROR,
          null,
          { updateUI: true }
        );
      }).not.toThrow();
    });
  });

  describe('showErrorNotification', () => {
    it('should show notification with error details', () => {
      const errorObj = {
        message: 'Test error message',
        severity: errorHelpers.ErrorSeverity.ERROR
      };
      
      errorHelpers.showErrorNotification(errorObj);
      
      expect(browser.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: '/icons/icon48-dark.png',
        title: 'ProxyDeck Error',
        message: 'Test error message'
      });
    });
    
    it('should show warning notification for warning severity', () => {
      const errorObj = {
        message: 'Test warning message',
        severity: errorHelpers.ErrorSeverity.WARNING
      };
      
      errorHelpers.showErrorNotification(errorObj);
      
      expect(browser.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: '/icons/icon48-dark.png',
        title: 'ProxyDeck Warning',
        message: 'Test warning message'
      });
    });
    
    it('should handle notification errors', async () => {
      browser.notifications.create.mockRejectedValueOnce(new Error('Notification error'));
      
      errorHelpers.showErrorNotification({
        message: 'Test error',
        severity: errorHelpers.ErrorSeverity.ERROR
      });
      
      // Wait for promise rejection to be handled
      await new Promise(process.nextTick);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Failed to show notification:',
        expect.any(Error)
      );
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap function with error handling', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = errorHelpers.withErrorHandling(mockFn);
      
      const result = await wrappedFn('arg1', 'arg2');
      
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('success');
    });
    
    it('should handle errors in wrapped function', async () => {
      // Mock to verify the expected behavior - runtime.sendMessage is used inside handleError
      const sendMessageSpy = jest.spyOn(browser.runtime, 'sendMessage');
      
      const mockError = new Error('Function error');
      const mockFn = jest.fn().mockRejectedValue(mockError);
      
      const wrappedFn = errorHelpers.withErrorHandling(mockFn, {
        message: 'Custom error message',
        updateUI: true // This will trigger sendMessage
      });
      
      // Execute the wrapped function that will fail
      await wrappedFn('arg1');
      
      // Verify the function was called
      expect(mockFn).toHaveBeenCalledWith('arg1');
      
      // Verify error handling was triggered via the sendMessage action
      expect(sendMessageSpy).toHaveBeenCalledWith(expect.objectContaining({ 
        action: 'errorOccurred',
        error: expect.any(Object)
      }));
    });
    
    it('should use default values for error options', async () => {
      // Use a console spy to detect default error logging
      const consoleSpy = jest.spyOn(console, 'error');
      
      const mockError = new Error('Function error');
      const mockFn = jest.fn().mockRejectedValue(mockError);
      
      const wrappedFn = errorHelpers.withErrorHandling(mockFn);
      
      await wrappedFn();
      
      // Verify error was handled via console.error being called somewhere in the chain
      expect(consoleSpy).toHaveBeenCalled();
      
      // Restore original console.error
      consoleSpy.mockRestore();
    });
    
    it('should rethrow error when rethrow option is true', async () => {
      const mockError = new Error('Function error');
      const mockFn = jest.fn().mockRejectedValue(mockError);
      
      const wrappedFn = errorHelpers.withErrorHandling(mockFn, {
        rethrow: true
      });
      
      await expect(wrappedFn()).rejects.toThrow(mockError);
    });
    
    it('should return fallback value when provided', async () => {
      const mockError = new Error('Function error');
      const mockFn = jest.fn().mockRejectedValue(mockError);
      
      const wrappedFn = errorHelpers.withErrorHandling(mockFn, {
        fallbackValue: 'fallback'
      });
      
      const result = await wrappedFn();
      
      expect(result).toBe('fallback');
    });
  });
});