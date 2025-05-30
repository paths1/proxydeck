const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { DefinePlugin } = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ManifestPlugin = require('./webpack-plugins/manifest-plugin');

function getVersionFromGitTag() {
  try {
    const tags = execSync('git tag -l --sort=-version:refname', { encoding: 'utf8' })
      .trim()
      .split('\n');
    
    console.log('All tags:', tags.slice(0, 5));
    
    // Find the first tag that matches stable version pattern
    for (const tag of tags) {
      if (tag && tag.match(/^v?\d+\.\d+\.\d+$/)) {
        const version = tag.replace(/^v/, '');
        console.log(`Version from git tag: ${version}`);
        
        // Update package.json if version differs
        const packageJsonPath = path.resolve(__dirname, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (packageJson.version !== version) {
          packageJson.version = version;
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          console.log(`Updated package.json version to ${version}`);
        }
        
        return version;
      }
    }
  } catch (e) {
    // Git not available or no tags
  }
  
  // Fallback to package.json
  return require('./package.json').version;
}

module.exports = (env) => {
  const target = env.target || 'chrome';
  const version = getVersionFromGitTag();
  console.log(`Building for target: ${target}`);
  console.log(`Version: ${version}`);
  
  const outputPath = path.resolve(__dirname, target === 'firefox' ? 'dist/firefox' : 'dist/chrome');
  
  const copyPatterns = [
    // Copy HTML files
    { from: 'popup.html', to: 'popup.html' },
    { from: 'options.html', to: 'options.html' },
    // Copy icons directory
    { from: 'icons', to: 'icons' },
    // Copy webextension-polyfill
    {
      from: 'node_modules/webextension-polyfill/dist',
      to: 'node_modules/webextension-polyfill/dist'
    }
  ];
  
  
  return {
    // Default to production mode for builds
    mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
    entry: {
      background: './src/background.js',
      options: './src/options.js',
      popup: './src/popup.js',
      'theme-detector': './src/theme-detector.js',
    },
    output: {
      filename: '[name].js',
      chunkFilename: '[name].js',  // Remove hash from chunk filenames
      path: outputPath,
      clean: true,  // Set to true to clean output directory before build
      // Ensure compatibility with both Chrome and Firefox
      chunkFormat: 'array-push',
      environment: { module: false }
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            // Use babel.config.js instead of inline options
          },
        },
        {
          test: /\.css$/i,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  config: path.resolve(__dirname, 'postcss.config.js'), // Rely on postcss.config.js for plugins
                },
              },
            },
          ],
        },
      ],
    },
    // Only use source maps in development mode
    devtool: process.env.NODE_ENV === 'development' ? 'cheap-module-source-map' : false,
    externals: env.target === 'firefox' ? {'webextension-polyfill' : 'browser'} : {},
    resolve: {
      alias: {
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        // shadcn
        '@': path.resolve(__dirname, "src/"),
        // Use the WebExtension polyfill directly
        '@browser-polyfill': 'webextension-polyfill',
        '@/components': path.resolve(__dirname, 'src/components/'),
        '@/lib': path.resolve(__dirname, 'src/lib/'),
        // Additional Preact compatibility aliases (for dependencies that expect React)
        "react-dom/test-utils": "preact/test-utils",
        "react/jsx-runtime": "preact/jsx-runtime",
      },
      extensions: ['.js', '.jsx', '.json', '.wasm'] // Added .jsx
    },
    optimization: {
      usedExports: true,
      sideEffects: false,
      chunkIds: 'named',
      moduleIds: 'named',  // Use named module IDs instead of hashed
      splitChunks: {
        chunks: (chunk) => {
          // Don't split background script for Chrome service workers
          return chunk.name !== 'background';
        },
        // Use deterministic names without hashes
        name: false,  // Let each cache group define its own name
        cacheGroups: {
          // Core Preact - always needed
          preact: {
            test: /[\\/]node_modules[\\/](preact)[\\/]/,
            name: 'vendor-preact',
            chunks: (chunk) => chunk.name !== 'background',
            priority: 40,
            enforce: true
          },
          // Charts - only needed in options
          charts: {
            test: /[\\/]node_modules[\\/](recharts|d3-.*|lodash)[\\/]/,
            name: 'vendor-charts',
            chunks: (chunk) => chunk.name !== 'background' && chunk.name !== 'popup',
            priority: 30,
            enforce: true
          },
          // Drag and drop - only needed in options
          dndkit: {
            test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
            name: 'vendor-dnd',
            chunks: (chunk) => chunk.name !== 'background' && chunk.name !== 'popup',
            priority: 30,
            enforce: true
          },
          // UI components - shared but not critical for initial load
          radixui: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'vendor-ui',
            chunks: (chunk) => chunk.name !== 'background',
            priority: 20,
            reuseExistingChunk: true
          },
          // Other shared vendor code
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor-common',
            chunks: (chunk) => chunk.name !== 'background',
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true
          },
          // Shared components and utilities (exclude from background)
          shared: {
            test: /[\\/]src[\\/]/,
            name: 'shared-components',
            chunks: (chunk) => chunk.name !== 'background',
            priority: 5,
            minChunks: 2,
            reuseExistingChunk: true
          }
        }
      },
      minimize: true
    },
    plugins: [
      // Define build-time constants
      new DefinePlugin({
        'TARGET_BROWSER': JSON.stringify(target)
      }),
      // Extract CSS to separate files (exclude background script)
      new MiniCssExtractPlugin({
        filename: '[name].css',
        chunkFilename: '[name].css',
        ignoreOrder: true,
        runtime: false
      }),
      // Generate manifest during build
      new ManifestPlugin({
        browser: target,
        manifestDir: './manifest',
        version: version
      }),
      // Copy static assets
      new CopyWebpackPlugin({
        patterns: copyPatterns
      })
    ],
  };
};