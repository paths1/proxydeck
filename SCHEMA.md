# ProxyDeck V2 Configuration Schema

**Version**: 2 (Current)
**Status**: Stable - No breaking changes planned
**Last Updated**: 2025-11-13

This document defines the official V2 configuration schema for ProxyDeck. The schema is enforced by automated tests in `src/__tests__/validation/` which will fail if any breaking changes are introduced.

## Table of Contents

- [Overview](#overview)
- [Top-Level Configuration](#top-level-configuration)
- [Proxy Configuration](#proxy-configuration)
- [Routing Configuration](#routing-configuration)
- [Authentication](#authentication)
- [Constraints and Limits](#constraints-and-limits)
- [Browser-Specific Behavior](#browser-specific-behavior)
- [Examples](#examples)
- [Validation](#validation)
- [Migration Notes](#migration-notes)

## Overview

ProxyDeck uses a structured JSON configuration stored in `chrome.storage.local` under the key `config`. The configuration consists of:

- A version identifier (always `2` for this schema)
- An array of proxy configurations (0-10 proxies)
- A global enable/disable flag

## Top-Level Configuration

```typescript
{
  version: 2,                    // Required: Schema version (literal 2)
  proxies: ProxyConfig[],        // Required: Array of proxy configurations (max 10)
  proxyEnabled: boolean          // Required: Global proxy enable/disable
}
```

### Fields

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `version` | `number` | ✅ Yes | Schema version identifier | Must be exactly `2` |
| `proxies` | `ProxyConfig[]` | ✅ Yes | Array of proxy configurations | 0-10 items |
| `proxyEnabled` | `boolean` | ✅ Yes | Global proxy toggle | `true` or `false` |

### Example

```json
{
  "version": 2,
  "proxies": [],
  "proxyEnabled": true
}
```

## Proxy Configuration

Each proxy in the `proxies` array has the following structure:

```typescript
{
  id: string | null,             // Unique identifier or null for new proxies
  name: string,                  // Display name
  host: string,                  // Proxy server hostname/IP
  port: number,                  // Proxy server port (1-65535)
  proxyType: ProxyType,          // Protocol type
  auth?: {                       // Optional: Authentication (Firefox only)
    username: string,
    password: string
  },
  enabled: boolean,              // Individual proxy enable/disable
  priority: number,              // Routing priority (0-9, lower = higher priority)
  color: string | null,          // HSL color string or null
  routingConfig: RoutingConfig   // Routing rules
}
```

### Fields

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `id` | `string \| null` | ✅ Yes | Unique proxy identifier | Format: `proxy_<timestamp>_<random>` or `null` |
| `name` | `string` | ✅ Yes | Human-readable proxy name | Non-empty string |
| `host` | `string` | ✅ Yes | Proxy server address | Non-empty string, hostname or IP |
| `port` | `number` | ✅ Yes | Proxy server port | Integer, 1-65535 |
| `proxyType` | `string` | ✅ Yes | Protocol type | One of: `socks5`, `socks4`, `http`, `https` |
| `auth` | `object` | ❌ No | Authentication credentials | Firefox only, see [Authentication](#authentication) |
| `enabled` | `boolean` | ✅ Yes | Proxy enable state | `true` or `false` |
| `priority` | `number` | ✅ Yes | Routing priority | Integer, 0-9 (0 = highest priority) |
| `color` | `string \| null` | ✅ Yes | Visual indicator color | HSL format or `null` before assignment |
| `routingConfig` | `object` | ✅ Yes | Routing rules | See [Routing Configuration](#routing-configuration) |

### Proxy Types

The following proxy types are supported:

| Type | Description | Supported Browsers |
|------|-------------|-------------------|
| `socks5` | SOCKS5 proxy with DNS resolution | Chrome, Firefox |
| `socks4` | SOCKS4 proxy | Chrome, Firefox |
| `http` | HTTP proxy | Chrome, Firefox |
| `https` | HTTPS proxy | Chrome, Firefox |

### ID Format

- **New proxies**: `null` until assigned an ID
- **Existing proxies**: `proxy_<timestamp>_<random>` (e.g., `proxy_1234567890_abc123`)

### Color Format

- **Assigned**: HSL color string (e.g., `hsl(348, 83%, 62%)`)
- **Unassigned**: `null` (colors are auto-assigned by priority)

### Priority System

Priorities range from 0-9, where:
- `0` = Highest priority (checked first for routing)
- `9` = Lowest priority (checked last for routing)
- Used to determine which proxy handles a request when multiple proxies match

## Routing Configuration

Each proxy has a `routingConfig` object that defines how traffic is routed:

```typescript
{
  useContainerMode: boolean,     // Use Firefox container-based routing
  patterns: string[],            // Array of regex patterns
  containers: string[]           // Array of Firefox container IDs
}
```

### Fields

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `useContainerMode` | `boolean` | ✅ Yes | Enable container-based routing | Firefox only feature |
| `patterns` | `string[]` | ✅ Yes | Regex patterns for hostname matching | Valid regex strings |
| `containers` | `string[]` | ✅ Yes | Firefox container IDs | Firefox only |

### Routing Modes

**Pattern Mode** (`useContainerMode: false`):
```json
{
  "useContainerMode": false,
  "patterns": ["example\\.com", ".*\\.google\\.com"],
  "containers": []
}
```
- Matches requests based on hostname regex patterns
- Works in both Chrome and Firefox

**Container Mode** (`useContainerMode: true`):
```json
{
  "useContainerMode": true,
  "patterns": [],
  "containers": ["firefox-container-1", "firefox-container-2"]
}
```
- Matches requests from specific Firefox containers
- Firefox only (ignored in Chrome)

### Pattern Syntax

Patterns are JavaScript regular expressions:
- `example\\.com` - Matches `example.com` exactly
- `.*\\.google\\.com` - Matches any subdomain of `google.com`
- `github\\.com` - Matches `github.com`
- `.*` - Matches all hostnames

**Note**: Backslashes must be escaped in JSON (`\.` becomes `\\.`)

## Authentication

Authentication credentials are optional and **only supported in Firefox**.

```typescript
{
  username: string,              // Username for proxy authentication
  password: string               // Password for proxy authentication
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | `string` | ✅ Yes (if auth present) | Proxy username |
| `password` | `string` | ✅ Yes (if auth present) | Proxy password |

### Browser Support

| Browser | SOCKS4 Auth | SOCKS5 Auth | HTTP Auth | HTTPS Auth |
|---------|-------------|-------------|-----------|------------|
| Chrome | ❌ No | ❌ No | ❌ No | ❌ No |
| Firefox | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |

**Important**: Chrome configurations should **not** include the `auth` field.

## Constraints and Limits

### Hard Limits

| Constraint | Limit | Enforced By |
|------------|-------|-------------|
| Maximum proxies | 10 | Runtime + Tests |
| Port range | 1-65535 | Tests |
| Priority range | 0-9 | Convention |
| Schema version | 2 (literal) | Tests |

### Field Requirements

**Required fields** (must be present and non-empty):
- All top-level fields (`version`, `proxies`, `proxyEnabled`)
- All proxy fields except `auth`
- All routing config fields

**Optional fields**:
- `auth` object (Firefox only)

**Nullable fields**:
- `id` (null for new proxies)
- `color` (null before auto-assignment)

### String Constraints

- `name`: Must be non-empty
- `host`: Must be non-empty
- `patterns`: Must be valid regex strings

## Browser-Specific Behavior

### Chrome Configuration

```json
{
  "id": "proxy_1",
  "name": "Chrome Proxy",
  "host": "proxy.example.com",
  "port": 8080,
  "proxyType": "socks5",
  "enabled": true,
  "priority": 0,
  "color": "hsl(348, 83%, 62%)",
  "routingConfig": {
    "useContainerMode": false,
    "patterns": ["example\\.com"],
    "containers": []
  }
}
```

**Note**: No `auth` field - Chrome doesn't support proxy authentication.

### Firefox Configuration

```json
{
  "id": "proxy_1",
  "name": "Firefox Proxy",
  "host": "proxy.example.com",
  "port": 1080,
  "proxyType": "socks5",
  "auth": {
    "username": "user",
    "password": "pass"
  },
  "enabled": true,
  "priority": 0,
  "color": "hsl(348, 83%, 62%)",
  "routingConfig": {
    "useContainerMode": true,
    "patterns": [],
    "containers": ["firefox-container-1"]
  }
}
```

**Note**: Includes optional `auth` field and can use container-based routing.

## Examples

### Empty Configuration (Fresh Install)

```json
{
  "version": 2,
  "proxies": [],
  "proxyEnabled": true
}
```

### Single SOCKS5 Proxy (Chrome)

```json
{
  "version": 2,
  "proxies": [
    {
      "id": "proxy_1234567890_abc",
      "name": "My Proxy",
      "host": "127.0.0.1",
      "port": 1080,
      "proxyType": "socks5",
      "enabled": true,
      "priority": 0,
      "color": "hsl(348, 83%, 62%)",
      "routingConfig": {
        "useContainerMode": false,
        "patterns": [".*"],
        "containers": []
      }
    }
  ],
  "proxyEnabled": true
}
```

### Multiple Proxies with Patterns

```json
{
  "version": 2,
  "proxies": [
    {
      "id": "proxy_http",
      "name": "HTTP Proxy",
      "host": "http.proxy.local",
      "port": 8080,
      "proxyType": "http",
      "enabled": true,
      "priority": 0,
      "color": "hsl(348, 83%, 62%)",
      "routingConfig": {
        "useContainerMode": false,
        "patterns": ["example\\.com", ".*\\.example\\.com"],
        "containers": []
      }
    },
    {
      "id": "proxy_socks",
      "name": "SOCKS5 Proxy",
      "host": "socks.proxy.local",
      "port": 1080,
      "proxyType": "socks5",
      "enabled": true,
      "priority": 1,
      "color": "hsl(28, 87%, 58%)",
      "routingConfig": {
        "useContainerMode": false,
        "patterns": ["github\\.com"],
        "containers": []
      }
    }
  ],
  "proxyEnabled": true
}
```

### Firefox with Authentication and Containers

```json
{
  "version": 2,
  "proxies": [
    {
      "id": "proxy_work",
      "name": "Work Proxy",
      "host": "work.proxy.com",
      "port": 8080,
      "proxyType": "http",
      "auth": {
        "username": "employee",
        "password": "secret123"
      },
      "enabled": true,
      "priority": 0,
      "color": "hsl(348, 83%, 62%)",
      "routingConfig": {
        "useContainerMode": true,
        "patterns": [],
        "containers": ["firefox-container-1", "firefox-container-2"]
      }
    }
  ],
  "proxyEnabled": true
}
```

### Disabled Proxy Configuration

```json
{
  "version": 2,
  "proxies": [
    {
      "id": "proxy_1",
      "name": "Inactive Proxy",
      "host": "inactive.proxy.local",
      "port": 8080,
      "proxyType": "socks5",
      "enabled": true,
      "priority": 0,
      "color": "hsl(348, 83%, 62%)",
      "routingConfig": {
        "useContainerMode": false,
        "patterns": [],
        "containers": []
      }
    }
  ],
  "proxyEnabled": false
}
```

**Note**: Even though the proxy is enabled, the global `proxyEnabled: false` disables all proxies.

## Validation

### Automated Testing

The V2 schema is protected by automated tests in:
- `src/__tests__/validation/config-schema.test.js` - Schema validation tests
- `src/__tests__/validation/v2-backward-compatibility.test.js` - Compatibility tests

**Test Coverage**:
- ✅ 47 schema validation tests
- ✅ 47 backward compatibility tests
- ✅ 9 real-world V2 configuration fixtures

### Schema Definition

The schema is formally defined using Zod in `src/validation/config-schema.js`:

```javascript
import { z } from 'zod';

export const ConfigV2Schema = z.object({
  version: z.literal(2),
  proxies: z.array(ProxyConfigSchema).max(10),
  proxyEnabled: z.boolean()
}).strict();
```

### Validation Rules

1. **Strict Mode**: Extra fields are rejected
2. **Required Fields**: All required fields must be present
3. **Type Checking**: Values must match specified types
4. **Range Validation**: Ports must be 1-65535
5. **Array Limits**: Maximum 10 proxies
6. **Enum Validation**: `proxyType` must be one of the valid types

### Breaking Changes

Any change that causes these tests to fail is considered a **BREAKING CHANGE** and requires:
1. Version bump (V2 → V3)
2. Migration strategy for existing users
3. Explicit approval and documentation

## Migration Notes

### From V1 to V2

The V2 schema introduced:
- Multi-proxy support (up to 10 proxies)
- Priority-based routing
- Container-based routing (Firefox)
- Auto-assigned colors
- Structured routing configuration

**V1 configs are automatically migrated to V2** on first load.

### Future Versions

If V3 is needed in the future:
1. Update `version` field to `3`
2. Implement migration logic in `ProxyManager.loadConfig()`
3. Update schema definition in `src/validation/config-schema.js`
4. Add V3 test fixtures and validation tests
5. Document changes in this file

## Backward Compatibility Guarantees

While V2 is the current schema:

✅ **Guaranteed Compatible**:
- Adding optional fields to proxy config
- Adding new proxy types
- Relaxing constraints (e.g., increasing max proxies)
- Adding new routing modes

❌ **Breaking Changes**:
- Removing required fields
- Changing field types
- Adding required fields without defaults
- Changing field names
- Tightening constraints
- Changing the version number

## Testing Your Changes

Before making any schema changes:

1. **Run validation tests**:
   ```bash
   npm test -- --testPathPattern=validation
   ```

2. **Check all tests pass**:
   ```bash
   npm test
   ```

3. **Review test failures** - If backward compatibility tests fail, you're making a breaking change!

## Questions or Issues?

If you need to make changes to the schema:

1. Check if your change is backward compatible (see above)
2. If breaking, plan a V3 migration strategy
3. Update this documentation
4. Add/update test fixtures
5. Ensure all tests pass

---

**Document Version**: 1.0
**Schema Version**: 2
**Maintained By**: ProxyDeck Development Team
