#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "=== ProxyDeck: Package for Chrome Web Store ==="
echo ""

# Check for clean dist directory
if [ ! -d "dist" ]; then
  echo "Error: 'dist' directory not found!"
  echo "Please run 'npm run build' first to create the dist directory."
  exit 1
fi

# Check for manifest.json in dist/chrome
if [ ! -f "dist/chrome/manifest.json" ]; then
  echo "Error: manifest.json not found in 'dist/chrome' directory!"
  echo "Please run 'npm run build' to generate a complete build."
  exit 1
fi
if [ ! -f "dist/firefox/manifest.json" ]; then
  echo "Error: manifest.json not found in 'dist/firefox' directory!"
  echo "Please run 'npm run build' to generate a complete build."
  exit 1
fi

# Extract version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' dist/chrome/manifest.json | cut -d'"' -f4)
echo "Detected extension version: $VERSION"
echo ""
if [ -z "$VERSION" ]; then
  echo "Error: Version not found in manifest.json!"
  exit 1
fi


for browser in "chrome" "firefox"; do
  dir="dist/${browser}"
  # Check if the directory exists
  if [ ! -d "$dir" ]; then
    echo "Error: Directory $dir not found!"
    exit 1
  fi

  # Check if manifest.json exists in the directory
  if [ ! -f "$dir/manifest.json" ]; then
    echo "Error: manifest.json not found in $dir!"
    exit 1
  fi

  # Remove existing ZIP file if it oexists
  ZIP_FILE="dist/proxydeck-${VERSION}-${browser}.zip"
  if [ -f "$ZIP_FILE" ]; then
    echo "Removing existing ZIP file: $ZIP_FILE"
    rm "$ZIP_FILE"
  fi
  # Create ZIP file
  echo "Creating ZIP file: $ZIP_FILE"
  (cd "dist/${browser}" && zip -r "../../$ZIP_FILE" *)

  # Check if ZIP was created
  if [ -f "$ZIP_FILE" ]; then
    # Get file size
    FILE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
    echo "File: $ZIP_FILE" 
    echo "Size: $FILE_SIZE"
  fi
done

for browser in "chrome" "firefox"; do
  if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ Error: Failed to create ZIP file!"
    echo "Error: ZIP file not found!"
    exit 1
  fi
done

echo ""
echo "✅ Packages created successfully!"
