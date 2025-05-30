import { useEffect } from 'preact/hooks';
import * as browser from 'webextension-polyfill';
import { MESSAGE_ACTIONS } from '../common/constants';

/**
 * Hook to update the extension icon based on the current theme
 * Listens for system theme changes and sends messages to background script
 */
export const useThemeIcon = () => {
  useEffect(() => {
    const updateIcon = (isDark) => {
      // Send message to background script to update icon
      browser.runtime.sendMessage({
        action: MESSAGE_ACTIONS.UPDATE_ICON_THEME,
        isDark
      }).catch(error => {
        console.error('Failed to update icon theme:', error);
      });
    };

    // Get initial theme state
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    updateIcon(darkQuery.matches);

    // Listen for theme changes
    const handleThemeChange = (e) => {
      updateIcon(e.matches);
    };

    darkQuery.addEventListener('change', handleThemeChange);

    // Cleanup
    return () => {
      darkQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);
};