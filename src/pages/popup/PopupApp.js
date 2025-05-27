import React, { useState, useEffect, useCallback } from 'react';
import * as browser from 'webextension-polyfill';
import { Button } from "@/components/ui/button";
import { MESSAGE_ACTIONS } from '../../common/constants';
import { formatTraffic } from '../../utils';
import ProxyPopupItem from '../../components/popup/ProxyPopupItem';
import { DownloadIcon, UploadIcon } from '../../components/shared/icons';
import { useThemeIcon } from '../../hooks/useThemeIcon';


/**
 * Main application component for the extension's popup.
 * Displays a list of available proxies, their status, and total traffic usage.
 * Shows which proxies match the current tab and which proxy is active.
 * Allows users to toggle proxies and open the options page.
 */
const PopupApp = () => {
  const [proxies, setProxies] = useState([]);
  const [activeProxyStatus, setActiveProxyStatus] = useState(null);
  const [matchingProxies, setMatchingProxies] = useState([]);
  const [currentTraffic, setCurrentTraffic] = useState(null);
  const [perProxyTraffic, setPerProxyTraffic] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState('');

  // Hook to update extension icon based on theme
  useThemeIcon();

  // Note: Theme detection is now handled by the global theme-detector.js script
  // This approach is consistent with the Options page

  // Handler for traffic updates
  const handleTrafficUpdate = useCallback((message) => {
    if (message.action === MESSAGE_ACTIONS.TRAFFIC_UPDATE && message.updates) {
      const windowSize = '1min'; // Default window size
      const windowData = message.updates[windowSize];
      
      if (windowData && windowData.stats) {
        // Update current traffic
        const downloadBytes = windowData.stats.download.current || 0;
        const uploadBytes = windowData.stats.upload.current || 0;
        
        setCurrentTraffic({
          download: formatTraffic(downloadBytes),
          upload: formatTraffic(uploadBytes),
          raw: {
            download: downloadBytes,
            upload: uploadBytes
          }
        });
        
        // Update per-proxy traffic
        if (windowData.stats.perProxy) {
          setPerProxyTraffic(prevTraffic => {
            const updatedTraffic = {...prevTraffic};
            
            Object.entries(windowData.stats.perProxy).forEach(([proxyId, stats]) => {
              updatedTraffic[proxyId] = {
                download: formatTraffic(stats.download.current || 0),
                upload: formatTraffic(stats.upload.current || 0),
                raw: {
                  download: stats.download.current || 0,
                  upload: stats.upload.current || 0
                }
              };
            });
            
            return updatedTraffic;
          });
        }
      }
    }
  }, []);

  // Set up message listener for traffic updates
  useEffect(() => {
    const messageListener = (message) => {
      if (message.action === MESSAGE_ACTIONS.TRAFFIC_UPDATE) {
        handleTrafficUpdate(message);
        return true;
      }
      return false;
    };
    
    browser.runtime.onMessage.addListener(messageListener);
    
    return () => {
      browser.runtime.onMessage.removeListener(messageListener);
    };
  }, [handleTrafficUpdate]);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch current tab info first
        const currentTabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = currentTabs[0];
        if (tab?.id && tab?.url) {
          setCurrentUrl(tab.url);
        
          // Get both active proxy and matching proxies for this tab in one request
          const proxyResponse = await browser.runtime.sendMessage({ 
            action: MESSAGE_ACTIONS.GET_PROXY_FOR_TAB, 
            tabId: tab.id,
            url: tab.url,
            includeAllMatches: true // Request all matching proxies
          });
          
          // Process the response
          
          // Handle active proxy
          // Use proxyInfo or proxy for backward compatibility
          const activeProxy = proxyResponse.success && (proxyResponse.proxyInfo || proxyResponse.proxy);
          if (activeProxy) {
            setActiveProxyStatus({
              proxyId: activeProxy.id,
              proxy: activeProxy
            });
          } else {
            setActiveProxyStatus(null);
          }
          
          // Handle matching proxies
          if (proxyResponse.success && proxyResponse.allMatchingProxies) {
            setMatchingProxies(proxyResponse.allMatchingProxies.map(p => p.id));
          }
        }
        
        // Fetch proxy configuration
        const configResponse = await browser.runtime.sendMessage({ 
          action: MESSAGE_ACTIONS.GET_CONFIG 
        });
        const proxiesList = configResponse.config?.proxies || [];
        setProxies(proxiesList);
        
        // Initialize empty traffic data for all proxies
        const initialTraffic = {};
        proxiesList.forEach(proxy => {
          initialTraffic[proxy.id] = {
            download: '0 B',
            upload: '0 B',
            raw: {
              download: 0,
              upload: 0
            }
          };
        });
        setPerProxyTraffic(initialTraffic);

        // Fetch traffic data
        const trafficResponse = await browser.runtime.sendMessage({ 
          action: MESSAGE_ACTIONS.GET_TRAFFIC_DATA 
        });
        
        if (trafficResponse && trafficResponse.trafficData) {
          // Get stats directly from response
          let currentDownloadBytes = 0;
          let currentUploadBytes = 0;
          
          // Get stats from response - use current values instead of total
          if (trafficResponse.trafficData.stats) {
            currentDownloadBytes = trafficResponse.trafficData.stats.download.current || 0;
            currentUploadBytes = trafficResponse.trafficData.stats.upload.current || 0;
          }
          
          setCurrentTraffic({
            download: formatTraffic(currentDownloadBytes),
            upload: formatTraffic(currentUploadBytes),
            raw: {
              download: currentDownloadBytes,
              upload: currentUploadBytes
            }
          });
          
          // Process per-proxy traffic data
          if (trafficResponse.trafficData.stats?.perProxy) {
            setPerProxyTraffic(prevTraffic => {
              const updatedTraffic = {...prevTraffic};
              
              Object.entries(trafficResponse.trafficData.stats.perProxy).forEach(([proxyId, stats]) => {
                updatedTraffic[proxyId] = {
                  download: formatTraffic(stats.download.current || 0),
                  upload: formatTraffic(stats.upload.current || 0),
                  raw: {
                    download: stats.download.current || 0,
                    upload: stats.upload.current || 0
                  }
                };
              });
              
              return updatedTraffic;
            });
          }
        }

        setError(null);
      } catch (err) {
        // Set a user-friendly error message
        setError("Failed to load data");
        setProxies([]);
        setActiveProxyStatus(null);
        setCurrentTraffic(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /**
   * Opens the extension's options page in a new tab.
   */
  const openOptionsPage = () => {
    browser.runtime.openOptionsPage();
  };

  /**
   * Handles the toggling of a proxy's enabled state.
   * Refetches proxy status and list after a toggle.
   * @param {string} proxyId - The ID of the proxy being toggled.
   * @param {boolean} enabled - The new enabled state of the proxy.
   */
  const handleProxyToggle = () => {
    const fetchStatus = async () => {
      try {
        const currentTabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = currentTabs[0];
        if (tab?.id && tab?.url) {
          // Re-fetch both active proxy and matching proxies in one request
          const proxyResponse = await browser.runtime.sendMessage({ 
            action: MESSAGE_ACTIONS.GET_PROXY_FOR_TAB, 
            tabId: tab.id,
            url: tab.url,
            includeAllMatches: true // Request all matching proxies
          });
          
          // Handle the response
          
          // Handle active proxy
          // Use proxyInfo or proxy for backward compatibility
          const activeProxy = proxyResponse.success && (proxyResponse.proxyInfo || proxyResponse.proxy);
          if (activeProxy) {
            setActiveProxyStatus({
              proxyId: activeProxy.id,
              proxy: activeProxy
            });
          } else {
            setActiveProxyStatus(null);
          }
          
          // Handle matching proxies
          if (proxyResponse.success && proxyResponse.allMatchingProxies) {
            setMatchingProxies(proxyResponse.allMatchingProxies.map(p => p.id));
          }
        }
        
        // Re-fetch proxy list
        const configResponse = await browser.runtime.sendMessage({ 
          action: MESSAGE_ACTIONS.GET_CONFIG 
        });
        setProxies(configResponse.config?.proxies || []);
      } catch (err) {
        // Handle error silently
      }
    };
    fetchStatus();
  };

  // Sort proxies by priority only (lower priority value = higher precedence)
  const sortedProxies = [...proxies].sort((a, b) => {
    // Sort by priority (lower number = higher priority)
    return a.priority - b.priority;
  });

  return (
    <div className="w-[400px] p-4 bg-background text-foreground">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <img 
            src="icons/icon128-light.png" 
            alt="ProxyDeck" 
            className="w-5 h-5 dark:hidden"
          />
          <img 
            src="icons/icon128-dark.png" 
            alt="ProxyDeck" 
            className="w-5 h-5 hidden dark:block"
          />
          ProxyDeck
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="flex items-center gap-1">
              <DownloadIcon width={12} height={12} />
              {currentTraffic ? currentTraffic.download : '0 B'}
            </span>
            <span className="flex items-center gap-1">
              <UploadIcon width={12} height={12} />
              {currentTraffic ? currentTraffic.upload : '0 B'}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={openOptionsPage} aria-label="Settings">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09c0 .66.38 1.26 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82c.23.63.85 1.05 1.51 1.05H21a2 2 0 0 1 0 4h-.09c-.66 0-1.26.38-1.51 1z"/>
            </svg>
          </Button>
        </div>
      </header>
      
      {error && (
        <div className="p-2 mb-4 border border-destructive bg-destructive/10 text-destructive-foreground rounded-md text-sm">
          {error}
        </div>
      )}
      
      <main>
        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading proxies...</p>
          ) : sortedProxies.length > 0 ? (
            sortedProxies.map(proxy => (
              <ProxyPopupItem
                key={proxy.id}
                proxy={proxy}
                isActive={activeProxyStatus && activeProxyStatus.proxyId === proxy.id}
                matchesTab={matchingProxies.includes(proxy.id)}
                traffic={perProxyTraffic[proxy.id]}
                priorityColor={proxy.color || 'hsl(210, 100%, 50%)'}
                onToggle={handleProxyToggle}
              />
            ))
          ) : (
            <div className="p-4 border border-dashed border-border rounded-md text-center text-muted-foreground">
              No proxies configured.
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={openOptionsPage}>
                  Configure Proxies
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {!loading && currentUrl && (
        <div className="mt-4 pt-3 border-t border-border text-sm text-muted-foreground truncate">
          Current URL: <span className="font-medium">{currentUrl}</span>
        </div>
      )}
    </div>
  );
};

export default PopupApp;