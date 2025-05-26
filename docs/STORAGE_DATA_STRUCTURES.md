# Browser Storage Data Structures

This document describes all data structures used in browser storage by the ProxyDeck extension.

## Primary Configuration Object

The main configuration is stored under the key `config` in `browser.storage.local`.

```javascript
{
  "config": {
    "version": 2,                    // Configuration version
    "proxyEnabled": true,           // Global proxy feature state (always true in current implementation)
    "proxies": [                    // Array of proxy configurations
      {
        "id": "default_proxy",      // Unique identifier (string)
        "name": "Default Proxy",    // Display name
        "enabled": true,            // Whether this proxy is enabled
        "host": "proxy.example.com", // Proxy server hostname
        "port": 1080,               // Proxy server port
        "username": "",             // Authentication username (optional)
        "password": "",             // Authentication password (optional)
        "priority": 0,              // Priority order (lower number = higher priority)
        "color": "hsl(210, 100%, 50%)", // Display color (calculated from priority)
        "auth": {                   // Authentication object (newer format)
          "username": "",
          "password": ""
        },
        "routingConfig": {          // Routing configuration
          "useContainerMode": false, // Use container-based routing (Firefox only)
          "patterns": [],           // Regex patterns for URL matching
          "containers": []          // Container names for routing (Firefox only)
        }
      }
    ]
  }
}
```

## Proxy Object Schema

Each proxy in the `proxies` array contains:

### Required Fields
- `id` (string): Unique identifier for the proxy
- `name` (string): Display name
- `enabled` (boolean): Whether the proxy is enabled
- `host` (string): Proxy server hostname or IP
- `port` (number): Proxy server port
- `priority` (number): Priority order (0 is highest)
- `color` (string): HSL color string for UI display

### Authentication
- `auth` (object): Authentication details
  - `username` (string): Username for proxy authentication
  - `password` (string): Password for proxy authentication

### Routing Configuration
- `routingConfig` (object): Routing rules
  - `useContainerMode` (boolean): Use container-based routing (Firefox only)
  - `patterns` (array of strings): Regex patterns for URL matching
  - `containers` (array of strings): Container names for routing

## Field Details

### Priority System
- Proxies are ordered by priority (lower number = higher priority)
- Priority 0 is the highest priority
- When multiple proxies match a URL, the one with lowest priority number is used

### Color System
- Colors are automatically calculated based on proxy priority
- Color range: Blue (high priority) to Orange/Red (low priority)
- Format: HSL color string, e.g., "hsl(210, 100%, 50%)"
- Colors are recalculated whenever proxy priorities change

### Container Mode (Firefox Only)
- When `useContainerMode` is true, proxy routing is based on Firefox containers
- `containers` array contains container names that should use this proxy
- Requires the `contextualIdentities` permission in Firefox

### Pattern Matching
- `patterns` array contains regex patterns for URL matching
- Each pattern is tested against the full URL
- Patterns use JavaScript regex syntax
- Empty patterns array means no URL-based routing

## Migration Notes

### Version 2 Features
- Added `routingConfig` object structure
- Separated container and pattern-based routing
- Added color field for UI consistency
- Migrated from direct username/password to auth object

### Legacy Support
- Old configs with `username`/`password` fields are migrated to `auth` object
- Missing `auth` objects are created with empty credentials
- Missing `color` fields are calculated on load

## Storage Operations

### Loading Configuration
```javascript
const result = await browser.storage.local.get('config');
const config = result.config || getDefaultConfig();
```

### Saving Configuration
```javascript
await browser.storage.local.set({ config: updatedConfig });
```

### Default Configuration
When no config exists, the extension creates a default with one proxy:
- ID: "default_proxy"
- Name: "Default Proxy"
- Enabled: true
- Priority: 0
- Empty host/port
- No authentication
- No routing patterns

## Related Storage Items

While not documented in detail here, the extension may also store:
- Traffic tracking data
- Temporary state information
- Cache data for performance

These are managed by their respective modules and are not part of the core configuration structure.