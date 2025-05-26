import React, { useState, useEffect, Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// Lazy load routing forms
const RegexRoutingForm = React.lazy(() => import(/* webpackChunkName: "regex-routing-form" */ './RegexRoutingForm'));
const ContainerRoutingForm = React.lazy(() => import(/* webpackChunkName: "container-routing-form" */ './ContainerRoutingForm'));

/**
 * @file RoutingConfiguratorCondensed.js
 * @description React component that provides a condensed inline tabbed interface for configuring
 * different proxy routing modes (e.g., Regex-based, Container-based).
 */

/**
 * RoutingConfiguratorCondensed Component.
 * Allows selection and configuration of proxy routing modes with tabs inline with the header.
 * @param {object} props - The component's props.
 * @param {object} props.proxy - The proxy data object being configured.
 * @param {function} props.onChange - Callback function to update the parent proxy object
 *                                    when routing configuration changes.
 * @returns {JSX.Element} The rendered RoutingConfiguratorCondensed component.
 */
const RoutingConfiguratorCondensed = ({ proxy, onChange, originalRoutingConfig, dirtyFields, updateFieldDirtyState }) => {
  // Determine initial tab based on proxy.routingConfig.useContainerMode
  const [activeTab, setActiveTab] = useState(proxy?.routingConfig?.useContainerMode ? 'container' : 'regex');

  useEffect(() => {
    // Update activeTab if proxy.routingConfig.useContainerMode changes externally
    if (proxy?.routingConfig) {
      const newActiveTab = proxy.routingConfig.useContainerMode ? 'container' : 'regex';
      if (newActiveTab !== activeTab) {
        setActiveTab(newActiveTab);
      }
    }
  }, [proxy?.routingConfig?.useContainerMode]);

  /**
   * Handles changes to the active routing mode tab.
   * Updates the local active tab state and calls the onChange prop to update the parent.
   * @param {string} newTabValue - The value of the newly selected tab (e.g., 'regex', 'container').
   */
  const handleTabChange = (newTabValue) => {
    setActiveTab(newTabValue);
    const newUseContainerMode = newTabValue === 'container';
    
    // Call onChange to update the parent proxy object's routingConfig.useContainerMode
    if (onChange) {
      onChange(prevProxy => ({
        ...prevProxy,
        routingConfig: {
          ...prevProxy.routingConfig,
          useContainerMode: newUseContainerMode
        }
      }));
      
      // Update dirty state
      if (updateFieldDirtyState) {
        const isDirty = newUseContainerMode !== (originalRoutingConfig?.useContainerMode || false);
        updateFieldDirtyState('routingConfig.useContainerMode', isDirty);
      }
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">
            Routing Configuration
            {dirtyFields['routingConfig.useContainerMode'] && (
              <Badge variant="default" size="sm" className="ml-2">
                Unsaved
              </Badge>
            )}
          </h3>
          <div className="flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => handleTabChange('regex')}
              className={`px-3 py-1 rounded-l-md transition-colors ${
                activeTab === 'regex' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Regex-based
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('container')}
              className={`px-3 py-1 rounded-r-md transition-colors ${
                activeTab === 'container' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Container-based
            </button>
          </div>
        </div>
        
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span className="ml-3 text-sm text-muted-foreground">Loading routing configuration...</span>
          </div>
        }>
          {activeTab === 'regex' ? (
            <RegexRoutingForm 
              proxy={proxy}
              onChange={onChange}
              originalPatterns={originalRoutingConfig?.patterns}
              dirtyFields={dirtyFields}
              updateFieldDirtyState={updateFieldDirtyState}
            />
          ) : (
            <ContainerRoutingForm 
              proxy={proxy}
              onChange={onChange}
              originalRoutingConfig={originalRoutingConfig}
              dirtyFields={dirtyFields}
              updateFieldDirtyState={updateFieldDirtyState}
            />
          )}
        </Suspense>
      </CardContent>
    </Card>
  );
};

export default RoutingConfiguratorCondensed;