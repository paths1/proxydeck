import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DownloadIcon, UploadIcon } from '../../components/shared/icons';
import { useProxyToggle } from '../../hooks/useProxyToggle';

/**
 * ProxyPopupItem component.
 * Displays information about a single proxy and allows toggling its enabled state.
 * Shows proxy status, matching status for current tab, and traffic data.
 * @param {object} props - The component's props.
 * @param {object} props.proxy - The proxy data object.
 * @param {boolean} props.isActive - Indicates if this proxy is currently active for the tab.
 * @param {boolean} props.matchesTab - Indicates if this proxy matches the current tab URL.
 * @param {object} props.traffic - Traffic data for this proxy with download and upload values.
 * @param {string} props.priorityColor - The color for the status indicator based on priority.
 * @param {function} props.onToggle - Callback function invoked when the proxy's enabled state is changed.
 * @returns {JSX.Element} The rendered ProxyPopupItem component.
 */
const ProxyPopupItem = ({ 
  proxy, 
  isActive, 
  matchesTab,
  traffic, 
  priorityColor, 
  onToggle 
}) => {
  // Component for rendering proxy item
  const { handleToggle, isToggling } = useProxyToggle(proxy, onToggle);

  // Determine visual styling based on proxy status
  const getStyles = () => {
    
    // If proxy is active, use bold border width and subtle background
    if (isActive) {
      return {
        border: "border-l-[7px]", // Bolder border for active proxy
        borderColor: priorityColor,
        background: "bg-card",
        textOpacity: "",
        fontWeight: "font-medium"
      };
    }
    
    // If proxy matches the tab but isn't active
    if (matchesTab) {
      return {
        border: "border-l-4",
        borderColor: priorityColor,
        background: "bg-card",
        textOpacity: "",
        fontWeight: "font-medium"
      };
    }
    
    // If proxy is enabled but not matching or active
    if (proxy.enabled) {
      return {
        border: "border-l-4",
        borderColor: priorityColor,
        background: "bg-card",
        textOpacity: "",
        fontWeight: "font-medium"
      };
    }
    
    // Disabled proxy styling
    return {
      border: "border-l-4 border-muted",
      background: "bg-muted/30",
      textOpacity: "opacity-60",
      fontWeight: "font-medium"
    };
  };
  
  const styles = getStyles();

  // Apply priority color to the component
  
  return (
    <Card 
      className={`p-3 hover:bg-muted/30 transition-colors ${styles.border} ${styles.background} ${styles.textOpacity} ${isActive ? 'shadow-md' : ''}`}
      style={{ borderLeftColor: priorityColor }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col flex-grow mr-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${styles.fontWeight} truncate ${!proxy.enabled ? "text-muted-foreground italic" : ""}`}>
              {proxy.name}
            </span>
            {/* Status indicators */}
            <div className="flex gap-1">
              {isActive ? (
                <Badge size="sm" className="font-semibold">
                  Active
                </Badge>
              ) : (
                matchesTab && (
                  <Badge variant="secondary" size="sm" className="font-medium">
                    Matches
                  </Badge>
                )
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 min-w-[70px]">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-2">
              {/* Traffic data displayed horizontally, to the left of the switch */}
              <div className="flex flex-row items-center text-xs gap-2">
                <span className="flex items-center gap-1">
                  <DownloadIcon width={12} height={12} className="text-muted-foreground" />
                  <span className="bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5 font-medium">
                    {traffic?.download ? traffic.download : '0 B'}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <UploadIcon width={12} height={12} className="text-muted-foreground" />
                  <span className="bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5 font-medium">
                    {traffic?.upload ? traffic.upload : '0 B'}
                  </span>
                </span>
              </div>
              <Switch
                checked={proxy.enabled}
                onCheckedChange={handleToggle}
                disabled={isToggling}
                aria-label={`Toggle proxy ${proxy.name}`}
                className="scale-75"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProxyPopupItem;