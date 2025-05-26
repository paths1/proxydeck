import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as browser from 'webextension-polyfill';
import { Button } from '@/components/ui/button';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import ProxyItem from './ProxyItem';
import { OptionsPageConfigManager } from '../../options/modules/OptionsPageConfigManager'; // Import the manager
import { KeyboardCode } from '@dnd-kit/core';
// Simple toast replacement for notifications
const toast = {
  success: (message) => console.log('✅', message),
  error: (message) => console.error('❌', message)
};
import { MESSAGE_ACTIONS } from '../../common/constants';


/**
 * @file ProxiesSection.js
 * @description React component for managing proxy configurations, including adding, deleting,
 * reordering (drag and drop), and editing individual proxy settings.
 * It uses `OptionsPageConfigManager` to handle the persistence of proxy data.
 */

/**
 * ProxiesSection component.
 * Manages the display and manipulation of proxy configurations.
 * @returns {JSX.Element} The rendered ProxiesSection component.
 */
const ProxiesSection = () => {
  const [proxies, setProxies] = useState([]);
  const [expandedProxyId, setExpandedProxyId] = useState(null); // Track which proxy is expanded
  const configManagerRef = useRef(null); // Use ref to hold the instance
  const newProxyIdRef = useRef(null); // Track newly created proxy
  
  // Use stored colors from proxy objects
  const getPriorityColor = useCallback((proxy) => {
    return proxy.color || 'hsl(210, 100%, 50%)'; // fallback to blue if color is missing
  }, []);
  
  // Common proxy refresh function
  const refreshProxies = useCallback(() => {
    if (configManagerRef.current) {
      setProxies(configManagerRef.current.getSortedProxies());
    }
  }, []);
  
  // Unified save handler with refresh
  const saveWithRefresh = useCallback(async (
    successMessage, 
    immediate = true
  ) => {
    try {
      await configManagerRef.current.saveConfiguration(() => {
        refreshProxies();
        toast.success(successMessage);
      }, immediate);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Save failed");
      refreshProxies(); // Ensure state consistency on error
    }
  }, [refreshProxies]);

  useEffect(() => {
    if (!configManagerRef.current) {
      configManagerRef.current = new OptionsPageConfigManager();
    }
    const loadConfig = async () => {
      try {
        await configManagerRef.current.loadConfiguration();
        refreshProxies();
      } catch (error) {
        console.error("Error loading proxy configuration:", error);
        toast.error("Failed to load proxy configuration.");
        // getSortedProxies will return default if load failed
        refreshProxies();
      }
    };
    loadConfig();
  }, [refreshProxies]); // Depend on refreshProxies
  
  // Listen for configuration updates from other sources (like popup)
  useEffect(() => {
    const messageListener = (message) => {
      if (message.action === MESSAGE_ACTIONS.CONFIGURATION_UPDATED) {
        // Update local state with new configuration
        if (message.config && message.config.proxies) {
          // Update the config manager's state
          if (configManagerRef.current) {
            configManagerRef.current.currentConfig = message.config;
            // Get sorted proxies and update UI
            refreshProxies();
          }
        }
      }
    };

    // Add listener
    browser.runtime.onMessage.addListener(messageListener);

    // Cleanup on unmount
    return () => {
      browser.runtime.onMessage.removeListener(messageListener);
    };
  }, [refreshProxies]);

  // Effect to scroll to any expanded proxy
  useEffect(() => {
    if (expandedProxyId) {
      // Small timeout to ensure DOM is updated
      setTimeout(() => {
        const proxyElement = document.querySelector(`[data-proxy-id="${expandedProxyId}"]`);
        if (proxyElement) {
          proxyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Clear newProxyIdRef after scrolling if it matches current expanded proxy
        if (newProxyIdRef.current === expandedProxyId) {
          newProxyIdRef.current = null;
        }
      }, 100);
    }
  }, [expandedProxyId]);

  // Handle immediate keyboard reordering
  const handleKeyboardReorder = useCallback(async (activeId, direction) => {
    if (!configManagerRef.current) return;
    
    const currentIndex = proxies.findIndex(proxy => proxy.id === activeId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= proxies.length) return;
    
    // Optimistically update UI
    const reorderedItems = arrayMove([...proxies], currentIndex, newIndex);
    const updatedPriorityItems = reorderedItems.map((item, index) => ({ ...item, priority: index }));
    setProxies(updatedPriorityItems);

    try {
      // Update config manager state
      configManagerRef.current.updateCurrentConfig({
        ...configManagerRef.current.getCurrentConfig(),
        proxies: updatedPriorityItems,
      });
      
      await saveWithRefresh("", false); // Silent save for keyboard reordering
    } catch (error) {
      console.error("Error saving proxy order:", error);
      toast.error("Failed to save proxy order. Reverting.");
      // Revert optimistic update if save fails
      refreshProxies();
    }
  }, [proxies, saveWithRefresh, refreshProxies]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: [KeyboardCode.Down, KeyboardCode.Up], // Start on arrow keys instead of space
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Enter, KeyboardCode.Space], // End with enter or space
      },
    })
  );

  /**
   * Handles adding a new proxy definition to the configuration.
   * Saves the configuration immediately after adding.
   */
  const handleAddProxy = useCallback(async () => {
    if (!configManagerRef.current) return;
    try {
      // Create new proxy and get its ID
      const newProxy = configManagerRef.current.addNewProxyDefinition('New Proxy');
      newProxyIdRef.current = newProxy.id; // Store the new proxy ID
      setExpandedProxyId(newProxy.id); // Expand the new proxy
      
      await saveWithRefresh("New proxy added and configuration saved.", true);
    } catch (error) {
      console.error("Error adding new proxy:", error);
      toast.error("Failed to add new proxy.");
    }
  }, [saveWithRefresh]);

  /**
   * Handles deleting a proxy from the configuration.
   * Saves the configuration immediately after deletion.
   * @param {string} proxyId - The ID of the proxy to delete.
   */
  const handleDeleteProxy = useCallback(async (proxyId) => {
    if (!configManagerRef.current) return;
    try {
      // Delete the proxy
      configManagerRef.current.deleteProxyFromCurrentConfig(proxyId);
      
      // Re-prioritize remaining proxies
      const sortedProxies = configManagerRef.current.getSortedProxies();
      sortedProxies.forEach((proxy, index) => {
        // Update priority directly on the proxy object in currentConfig
        const proxyInConfig = configManagerRef.current.currentConfig.proxies.find(p => p.id === proxy.id);
        if (proxyInConfig) {
          proxyInConfig.priority = index;
        }
      });
      
      // Save configuration with updated priorities
      await saveWithRefresh("Proxy deleted and priorities updated.", true);
    } catch (error) {
      console.error("Error deleting proxy:", error);
      toast.error("Failed to delete proxy.");
    }
  }, [saveWithRefresh]);

  /**
   * Handles the end of a drag-and-drop operation for reordering proxies.
   * Updates proxy priorities based on the new order and saves the configuration.
   * @param {object} event - The drag end event object from @dnd-kit.
   */
  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) {
      return;
    }
    if (!configManagerRef.current) return;

    const oldIndex = proxies.findIndex((item) => item.id === active.id);
    const newIndex = proxies.findIndex((item) => item.id === over.id);
    
    // Optimistically update UI
    const reorderedItems = arrayMove([...proxies], oldIndex, newIndex);
    const updatedPriorityItems = reorderedItems.map((item, index) => ({ ...item, priority: index }));
    setProxies(updatedPriorityItems);

    try {
      // Update config manager state
      configManagerRef.current.updateCurrentConfig({
        ...configManagerRef.current.getCurrentConfig(),
        proxies: updatedPriorityItems,
      });
      
      await saveWithRefresh("Proxy order saved.", false); // Debounced save for reordering
    } catch (error) {
      console.error("Error saving proxy order:", error);
      toast.error("Failed to save proxy order. Reverting.");
      // Revert optimistic update if save fails
      refreshProxies();
    }
  }, [proxies, saveWithRefresh, refreshProxies]); // Updated dependencies

  /**
   * Handles saving changes to an individual proxy's configuration.
   * Commits the draft changes from the form to the main configuration and saves.
   * @param {object} updatedProxyData - The updated proxy data object from the ProxyForm.
   */
  const handleSaveProxy = useCallback(async (updatedProxyData) => {
    if (!configManagerRef.current) return;
    try {
      // Select the proxy in the manager to make it the current draft
      configManagerRef.current.selectProxy(updatedProxyData.id);
      
      // Update all fields of the draft proxy
      // Note: OptionsPageConfigManager's updateDraftProxyField might need to be more flexible
      // or we directly manipulate the draftProxy object if selectProxy returns a reference.
      // For now, let's assume we update the config manager's internal draft.
      // A more robust way would be for selectProxy to set the draft, and then we apply changes.
      
      const draft = configManagerRef.current.getCurrentDraftProxy();
      if (draft && draft.id === updatedProxyData.id) {
        // Directly update the draft object obtained from the manager
        Object.keys(updatedProxyData).forEach(key => {
          draft[key] = updatedProxyData[key];
        });
      } else {
        // Fallback: update field by field if getCurrentDraftProxy isn't the one or direct update isn't possible
        Object.keys(updatedProxyData).forEach(key => {
          if (key !== 'id') { // Don't try to update ID itself via field update
            configManagerRef.current.updateDraftProxyField(key, updatedProxyData[key]);
          }
        });
      }

      configManagerRef.current.commitDraftToCurrentConfig();
      await saveWithRefresh(`Proxy "${updatedProxyData.name}" saved successfully.`, true);
    } catch (error) {
      console.error("Error saving proxy:", error);
      toast.error(`Failed to save proxy "${updatedProxyData.name}".`);
    }
  }, [saveWithRefresh]);


  /**
   * Handles undoing changes made to a proxy in the form.
   * Reverts the draft proxy in the configuration manager to its last saved state.
   * @param {string} proxyId - The ID of the proxy whose changes are to be undone.
   */
  const handleUndoProxy = useCallback((proxyId) => {
    if (!configManagerRef.current) return;
    try {
      // The ProxyForm itself handles resetting its local state to initialProxyData.
      // This handler is more for global state if needed, or for triggering a re-fetch/re-render.
      // If OptionsPageConfigManager maintained a distinct "original" for the draft, we'd use it.
      // For now, we ensure the list is fresh from the manager, which reflects last saved state.
      configManagerRef.current.revertDraftFromCurrentConfig(); // This should reset the draft in manager
      refreshProxies();
      const proxyName = proxies.find(p => p.id === proxyId)?.name || 'Proxy';
      toast.success(`Changes to "${proxyName}" undone.`);
    } catch (error) {
      console.error("Error undoing proxy changes:", error);
      toast.error("Failed to undo proxy changes.");
    }
  }, [proxies, refreshProxies]); // Updated dependencies

  const renderProxyItems = () => {
    if (!proxies || proxies.length === 0) {
      return <p className="text-sm text-muted-foreground mt-4">No proxies configured. Click "Add Proxy" to get started.</p>;
    }
    return proxies.map((proxy) => (
      <ProxyItem
        key={proxy.id}
        proxy={proxy}
        priorityColor={proxy.color || 'hsl(210, 100%, 50%)'}
        isExpanded={expandedProxyId === proxy.id}
        onToggle={() => setExpandedProxyId(expandedProxyId === proxy.id ? null : proxy.id)}
        onSave={handleSaveProxy}
        onUndo={handleUndoProxy}
        onDelete={handleDeleteProxy}
        onKeyboardReorder={handleKeyboardReorder}
        autoFocusName={newProxyIdRef.current === proxy.id}
        existingProxies={proxies}
      />
    ));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Proxies Configuration</h2>
        <Button onClick={handleAddProxy}>Add Proxy</Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={proxies.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {renderProxyItems()}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default ProxiesSection;