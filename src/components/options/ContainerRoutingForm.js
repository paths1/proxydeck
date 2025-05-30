import { useState, useEffect } from 'preact/hooks';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { fetchFirefoxContainers } from '../../options/utils/containerUtils'; // Import the new utility


/**
 * @file ContainerRoutingForm.js
 * @description React component for configuring Firefox Multi-Account Container-based proxy routing.
 * Fetches available Firefox containers and allows users to select which ones should use the proxy.
 */

/**
 * ContainerRoutingForm component.
 * Provides a form for selecting Firefox containers to be routed through the proxy.
 * @param {object} props - The component's props.
 * @param {object} props.proxy - The proxy data object being configured.
 * @param {function} props.onChange - Callback function to update the parent proxy object
 *                                    when container selections change.
 * @returns {JSX.Element} The rendered ContainerRoutingForm component.
 */
const ContainerRoutingForm = ({ proxy, onChange, originalContainers, dirtyFields, updateFieldDirtyState }) => {
  const [availableContainers, setAvailableContainers] = useState([]);
  const [isLoadingContainers, setIsLoadingContainers] = useState(true);
  const [containerLoadError, setContainerLoadError] = useState(null);
  // Initialize selected containers from proxy data or as an empty array
  const [selectedContainers, setSelectedContainers] = useState(proxy?.containers || []);
  
  // Firefox container colors mapping
  const firefoxColorMap = {
    blue: '#37adff',
    turquoise: '#00c79a', 
    green: '#51cd00',
    yellow: '#ffcb00',
    orange: '#ff9f00',
    red: '#ff613d',
    pink: '#ff4bda',
    purple: '#af51f5',
    grey: '#818181'
  };

  useEffect(() => {
    const loadContainers = async () => {
      setIsLoadingContainers(true);
      setContainerLoadError(null);
      try {
        const fetchedContainers = await fetchFirefoxContainers();
        setAvailableContainers(fetchedContainers);
      } catch (error) {
        console.error("Failed to load Firefox containers:", error);
        setContainerLoadError("Failed to load Firefox containers. Please ensure you are on Firefox and the Multi-Account Containers extension might be needed.");
        setAvailableContainers([]); // Set to empty on error
      } finally {
        setIsLoadingContainers(false);
      }
    };

    loadContainers();
  }, []); // Empty dependency array to run once on mount

  useEffect(() => {
    // Update local state if proxy data changes externally
    // Ensure proxy.routingConfig.containers is an array before comparing
    const proxyContainers = Array.isArray(proxy?.routingConfig?.containers) ? proxy.routingConfig.containers : [];
    if (JSON.stringify(proxyContainers) !== JSON.stringify(selectedContainers)) {
      setSelectedContainers(proxyContainers);
    }
  }, [proxy?.routingConfig?.containers]);

  /**
   * Handles changes to the selection of a Firefox container.
   * Toggles the container's presence in the `selectedContainers` state and calls the onChange prop.
   * @param {string} containerId - The ID of the container whose selection state changed.
   */
  const handleContainerChange = (containerId) => {
    const newSelectedContainers = selectedContainers.includes(containerId)
      ? selectedContainers.filter(id => id !== containerId)
      : [...selectedContainers, containerId];
    
    setSelectedContainers(newSelectedContainers);

    if (onChange) {
      onChange(prevProxy => ({
        ...prevProxy,
        routingConfig: {
          ...prevProxy.routingConfig,
          containers: newSelectedContainers
        }
      }));
    }
    
    // Check if containers are dirty
    if (updateFieldDirtyState && originalContainers) {
      const originalContainersSorted = [...(originalContainers || [])].sort();
      const newContainersSorted = [...newSelectedContainers].sort();
      const isDirty = JSON.stringify(originalContainersSorted) !== JSON.stringify(newContainersSorted);
      updateFieldDirtyState('routingConfig.containers', isDirty);
    }
  };

  return (
    <div className="space-y-3">
    <Label htmlFor={`container-routing-${proxy?.id}`}>
      Select Firefox Containers to route through this proxy.
      {dirtyFields && dirtyFields['routingConfig.containers'] && (
        <Badge variant="default" size="sm" className="ml-2">
          Unsaved
        </Badge>
      )}
    </Label>
      {isLoadingContainers && <p className="text-sm text-muted-foreground">Loading containers...</p>}
      {containerLoadError && <p className="text-sm text-destructive">{containerLoadError}</p>}
      
      {!isLoadingContainers && !containerLoadError && availableContainers.length > 0 && (
        availableContainers.map(container => (
          <div key={container.id} className="flex items-center space-x-2">
            <Checkbox
              id={`container-${proxy?.id}-${container.id}`}
              checked={selectedContainers.includes(container.id)}
              onCheckedChange={() => handleContainerChange(container.id)}
            />
            {/* Container color circle */}
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: firefoxColorMap[container.color] || container.color || firefoxColorMap.grey }}
              title={`Container color: ${container.color}`}
            />
            <Label htmlFor={`container-${proxy?.id}-${container.id}`} className="font-normal">
              {container.name}
            </Label>
          </div>
        ))
      )}
      {!isLoadingContainers && !containerLoadError && availableContainers.length === 0 && (
         <p className="text-sm text-muted-foreground">No Firefox containers found or the API is not available.</p>
      )}
    </div>
  );
};

export default ContainerRoutingForm;