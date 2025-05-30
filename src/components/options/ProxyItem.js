import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
// Replaced Lucide with inline SVG for smaller bundle
const GripVertical = ({ className, ...props }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="9" cy="12" r="1"/>
    <circle cx="9" cy="5" r="1"/>
    <circle cx="9" cy="19" r="1"/>
    <circle cx="15" cy="12" r="1"/>
    <circle cx="15" cy="5" r="1"/>
    <circle cx="15" cy="19" r="1"/>
  </svg>
);

import ProxyForm from './ProxyForm';
import { useProxyToggle } from '../../hooks/useProxyToggle';

/**
 * @file ProxyItem.js
 * @description React component representing a single proxy item in the list.
 * It's sortable (drag and drop) and contains an accordion to show/hide the `ProxyForm` for editing.
 */

/**
 * ProxyItem component.
 * Displays a single proxy's details and provides an interface for editing it via `ProxyForm`.
 * @param {object} props - The component's props.
 * @param {object} props.proxy - The proxy data object.
 * @param {string} props.priorityColor - The color assigned based on priority.
 * @param {function} props.onSave - Callback function to save proxy changes.
 * @param {function} props.onUndo - Callback function to undo proxy changes.
 * @param {function} props.onDelete - Callback function to delete the proxy.
 * @returns {JSX.Element} The rendered ProxyItem component.
 */
const ProxyItem = ({ proxy, priorityColor, isExpanded, onToggle, onSave, onUndo, onDelete, onKeyboardReorder, autoFocusName = false, existingProxies = [] }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: proxy.id });
  
  const toast = {
    success: (message) => console.log('✅', message),
    error: (message) => console.error('❌', message)
  };
  
  const { handleToggle: handleProxyToggle, isToggling } = useProxyToggle(
    proxy,
    null,
    {
      showErrorToast: true,
      showSuccessToast: true,
      toastHandler: toast
    }
  );

  // Auto-collapse when dragging starts
  React.useEffect(() => {
    if (isDragging && isExpanded) {
      onToggle();
    }
  }, [isDragging, isExpanded, onToggle]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined, // Ensure dragging item is on top
    opacity: isDragging ? 0.8 : 1,
  };

  const statusColor = priorityColor || 'bg-muted';

  // Prevent click propagation when clicking drag handle
  const handleDragClick = (e) => {
    e.stopPropagation();
  };

  // Handle keyboard reordering
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      onKeyboardReorder(proxy.id, 'up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      onKeyboardReorder(proxy.id, 'down');
    }
  };

  // Handle keyboard reordering on accordion trigger
  const handleAccordionKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      onKeyboardReorder(proxy.id, 'up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      onKeyboardReorder(proxy.id, 'down');
    }
    // Let other keys (like Enter, Space) pass through for normal accordion behavior
  };

  // Disable dragging when expanded
  const dragButtonProps = isExpanded
    ? {
        className: "p-1 mr-2 opacity-50 cursor-not-allowed touch-none",
        onClick: handleDragClick,
        "aria-label": "Dragging disabled while expanded",
        title: "Collapse the proxy to enable dragging",
        tabIndex: -1,
      }
    : {
        ...listeners,
        className: "p-1 mr-2 cursor-grab active:cursor-grabbing hover:bg-accent hover:text-accent-foreground rounded transition-colors touch-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        onClick: handleDragClick,
        onKeyDown: handleKeyDown,
        "aria-label": "Drag to reorder proxy",
        title: "Drag to reorder (use arrow keys to move immediately)",
        tabIndex: -1,
        role: "button",
      };

  return (
    <div ref={setNodeRef} style={style} {...attributes} tabIndex={-1} className="mb-3" data-proxy-id={proxy.id}>
      <Accordion type="single" collapsible value={isExpanded ? proxy.id : ''} onValueChange={onToggle} className="w-full border rounded-lg shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-[1.01]">
        <AccordionItem value={proxy.id} className="border-b-0">
          <AccordionTrigger 
            className="p-4 hover:no-underline focus:no-underline data-[state=open]:border-b"
            onKeyDown={handleAccordionKeyDown}
            title="Click to expand/collapse proxy settings. Use arrow keys to reorder."
          >
            <div className="flex items-center w-full">
              <button {...dragButtonProps}>
                <GripVertical 
                  size={20} 
                  className={`transition-all duration-300 ${isExpanded ? "text-muted-foreground/40" : "text-muted-foreground"}`} 
                />
              </button>
              <span 
                className={`w-4 h-4 rounded-sm mr-2 flex-shrink-0 ${!proxy.enabled ? 'opacity-40' : ''}`}
                style={{ backgroundColor: statusColor }}
              ></span>
              <div className="flex-grow text-left">
                <span className={`font-medium ${!proxy.enabled ? 'text-muted-foreground italic' : ''}`}>
                  {proxy.name || 'Unnamed Proxy'}
                </span>
                <span className={`text-sm text-muted-foreground ml-2 ${!proxy.enabled ? 'opacity-60' : ''}`}>
                  ({proxy.host || 'No Host'}:{proxy.port || 'No Port'})
                </span>
              </div>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full mr-2">
                Priority: {proxy.priority}
              </span>
              <div className="flex items-center mr-4">
                <Switch
                  id={`enabled-${proxy.id}`}
                  checked={proxy.enabled}
                  onCheckedChange={handleProxyToggle}
                  disabled={isToggling}
                  aria-label={`Toggle proxy ${proxy.name}`}
                  onClick={(e) => e.stopPropagation()} 
                  className="scale-90"
                />
              </div>
              {/* AccordionTrigger automatically adds the chevron icon */}
            </div>
          </AccordionTrigger>
          <AccordionContent className="transition-colors duration-500 ease-in-out bg-transparent">
            <div className="p-4 pb-4">
              <ProxyForm
                proxy={proxy}
                onSave={onSave} // Pass save handler from ProxiesSection
                onUndo={onUndo} // Pass undo handler
                onDelete={() => onDelete(proxy.id)} // onDelete is already passed
                autoFocusName={autoFocusName}
                existingProxies={existingProxies}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default ProxyItem;