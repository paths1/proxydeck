import React, { useState, useEffect, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import ProxiesSection from '../../components/options/ProxiesSection';
import { useThemeIcon } from '../../hooks/useThemeIcon';

// Lazy load the TrafficDashboard to reduce initial bundle size
const TrafficDashboard = React.lazy(() => import(/* webpackChunkName: "traffic-dashboard" */ '../../components/options/TrafficDashboard'));

const OptionsApp = () => {
  const [showTitle, setShowTitle] = useState(false);
  
  // Hook to update extension icon based on theme
  useThemeIcon();
  
  useEffect(() => {
    // Check if we're opened in a tab vs inline
    const checkIfOpenedInTab = () => {
      // Check if we're in an iframe (inline options)
      const isInIframe = window.self !== window.top;
      
      // Check if we're in Firefox
      const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
      
      // Show title only when opened in a tab (not in iframe) and not in Firefox
      setShowTitle(!isInIframe && !isFirefox);
    };
    
    checkIfOpenedInTab();
  }, []);
  
  return (
    <main className="container mx-auto p-4 max-w-[800px]">
      {showTitle && (
        <h1 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <img 
            src="icons/icon128-light.png" 
            alt="ProxyDeck" 
            className="w-6 h-6 dark:hidden"
          />
          <img 
            src="icons/icon128-dark.png" 
            alt="ProxyDeck" 
            className="w-6 h-6 hidden dark:block"
          />
          ProxyDeck Options
        </h1>
      )}
      <Tabs defaultValue="proxies" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="proxies">Proxies</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
        </TabsList>
        <TabsContent value="proxies" tabIndex={-1} className="mt-4">
          <ProxiesSection />
        </TabsContent>
        <TabsContent value="traffic" tabIndex={-1} className="mt-4">
          <Suspense fallback={
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Traffic Monitor</h2>
                <div className="h-8 w-24 bg-muted rounded animate-pulse"></div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Monitor real-time traffic volume across all connections or per proxy.
              </p>
              <Card>
                <CardContent className="text-center py-8">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground"></div>
                    <p className="text-muted-foreground">Loading traffic dashboard...</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          }>
            <TrafficDashboard />
          </Suspense>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default OptionsApp;