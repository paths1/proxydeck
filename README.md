# ProxyDeck

A browser extension that routes web traffic through different proxy servers based on URL patterns.

## **Why ProxyDeck?**

When my job moved work resources behind a jump host, I needed a proxy extension for easier access—and I also didn't want to route my personal traffic through the corporate network. I tried half a dozen existing solutions, and they mostly fell into these categories:

- **Too complex**: The most popular extensions were overwhelming to configure. I could probably figure them out given enough time, but they weren't well-designed and some options didn't work as expected.
- **Too simple**: Many lacked the features I needed for proper traffic routing and management.
- **Hosted solutions**: The rest were VPN/proxy services that doesn't fit my needs.

What I wanted was straightforward:
- Easy to configure (yes, you need to know regex, but that's it)
- Easy identification through icon badges
- Easy verification of traffic routing with built-in monitoring

And thus ProxyDeck was born.

## Features

- **Pattern-Based Routing** - Use regex patterns to automatically route specific websites through designated proxies
- **Multiple Proxy Support** - Configure unlimited SOCKS4, SOCKS5, and HTTP proxies with authentication
- **Visual Indicators** - Tab badges show which proxy is active on each tab
- **Traffic Monitoring** - Track bandwidth usage in real-time across all proxies
- **Container Support** (Firefox) - Route different containers through different proxies
- **Priority System** - Control which proxy handles overlapping patterns

## Installation

### From Extension Stores
- **Chrome**: [Coming soon to Chrome Web Store]
- **Firefox**: [Coming soon to Firefox Add-ons]

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/patrickhsieh/proxy_switch.git
   cd proxy_switch
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   # For Chrome
   npm run build:chrome

   # For Firefox
   npm run build:firefox
   ```

4. Load the extension:
   - **Chrome**: Navigate to `chrome://extensions/`, enable Developer Mode, click "Load unpacked" and select the `dist/chrome` folder
   - **Firefox**: Navigate to `about:debugging`, click "This Firefox", click "Load Temporary Add-on" and select any file in the `dist/firefox` folder

## Usage

1. Click the ProxyDeck icon in your browser toolbar
2. Open Options to configure your proxies
3. Add proxy servers with host, port, and optional authentication
4. Create regex patterns to match URLs that should use each proxy
5. Set priorities to control which proxy handles overlapping patterns
6. Monitor your traffic in the Traffic Dashboard

## Development

```bash
# Run in development mode with hot reload
npm run dev:chrome  # For Chrome
npm run dev:firefox # For Firefox

# Run tests
npm test

# Package for distribution
npm run package
```

## Privacy

ProxyDeck respects your privacy:
- No data collection
- No external servers
- All settings stored locally
- Open source for transparency

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

## License

GPL-3.0 - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.