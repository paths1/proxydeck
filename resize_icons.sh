#!/bin/bash

# Unified Icon Resizer Script for ProxyDeck Browser Extension
# Generates light and dark theme icons in required sizes
# Automatically detects and uses available image processing tool

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICONS_DIR="$SCRIPT_DIR/icons"

SOURCE_LIGHT="$ICONS_DIR/light.png"
SOURCE_DARK="$ICONS_DIR/dark.png"

# Standard sizes required for browser extensions
SIZES=(16 32 48 128)

echo "🎨 ProxyDeck Icon Resizer"
echo "========================"

# Check if source files exist
if [[ ! -f "$SOURCE_LIGHT" ]]; then
    echo "❌ Error: $SOURCE_LIGHT not found!"
    exit 1
fi

if [[ ! -f "$SOURCE_DARK" ]]; then
    echo "❌ Error: $SOURCE_DARK not found!"
    exit 1
fi

# Detect available image processing tool
TOOL=""
if command -v magick &> /dev/null; then
    TOOL="imagemagick7"
    echo "✅ Using ImageMagick v7 for icon generation"
elif command -v convert &> /dev/null; then
    TOOL="imagemagick"
    echo "✅ Using ImageMagick for icon generation"
elif command -v sips &> /dev/null; then
    TOOL="sips"
    echo "✅ Using macOS sips for icon generation"
else
    echo "❌ Error: No image processing tool found!"
    echo "   Please install ImageMagick:"
    echo "   - macOS: brew install imagemagick"
    echo "   - Linux: sudo apt install imagemagick"
    echo "   Or use this script on macOS which has sips built-in."
    exit 1
fi

echo "📁 Source files found:"
echo "   Light: $SOURCE_LIGHT"
echo "   Dark:  $SOURCE_DARK"
echo

# Function to resize image
resize_image() {
    local source="$1"
    local output="$2"
    local size="$3"
    
    if [ "$TOOL" = "imagemagick7" ]; then
        magick "$source" -resize "${size}x${size}" "$output"
    elif [ "$TOOL" = "imagemagick" ]; then
        convert "$source" -resize "${size}x${size}" "$output"
    else
        sips -z "$size" "$size" "$source" --out "$output" >/dev/null 2>&1
    fi
}

# Generate light theme icons
echo "🔧 Generating light theme icons..."
for size in "${SIZES[@]}"; do
    output_file="$ICONS_DIR/icon${size}-light.png"
    resize_image "$SOURCE_LIGHT" "$output_file" "$size"
    echo "   ✅ icon${size}-light.png"
done

echo

# Generate dark theme icons
echo "🔧 Generating dark theme icons..."
for size in "${SIZES[@]}"; do
    output_file="$ICONS_DIR/icon${size}-dark.png"
    resize_image "$SOURCE_DARK" "$output_file" "$size"
    echo "   ✅ icon${size}-dark.png"
done

echo
echo "🎉 Icon generation complete!"
echo

echo "📋 Generated files:"
for size in "${SIZES[@]}"; do
    echo "   icons/icon${size}-light.png"
    echo "   icons/icon${size}-dark.png"
done