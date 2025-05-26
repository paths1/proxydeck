import { useState, useCallback } from 'react';
import * as browser from 'webextension-polyfill';
import { MESSAGE_ACTIONS } from '../common/constants';

export const useProxyToggle = (proxy, onToggle, options = {}) => {
  const { 
    showErrorToast = false,
    showSuccessToast = false,
    toastHandler = null 
  } = options;
  
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState(null);

  const handleToggle = useCallback(async (enabled) => {
    if (isToggling || !proxy) return;
    
    setIsToggling(true);
    setError(null);
    
    try {
      await browser.runtime.sendMessage({
        action: MESSAGE_ACTIONS.TOGGLE_PROXY_STATE,
        proxyId: proxy.id,
        enabled: enabled,
      });
      
      if (showSuccessToast && toastHandler) {
        toastHandler.success(`Proxy "${proxy.name}" ${enabled ? 'enabled' : 'disabled'}.`);
      }
      
      if (onToggle) {
        onToggle(proxy.id, enabled);
      }
    } catch (err) {
      setError(err);
      
      if (showErrorToast && toastHandler) {
        toastHandler.error(`Failed to toggle proxy "${proxy.name}".`);
      }
    } finally {
      setIsToggling(false);
    }
  }, [proxy, onToggle, isToggling, showErrorToast, showSuccessToast, toastHandler]);

  return { 
    handleToggle, 
    isToggling, 
    error 
  };
};