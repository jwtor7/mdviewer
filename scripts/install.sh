#!/bin/bash
# mdviewer Install Script
# Uninstall and reinstall mdviewer from the build output

set -e

APP_NAME="mdviewer"
BUILD_PATH="/Users/true/dev/mdviewer/out/mdviewer-darwin-arm64/mdviewer.app"
INSTALL_PATH="/Applications/mdviewer.app"

echo "=== mdviewer Install Script ==="

# Check if build exists
if [ ! -d "$BUILD_PATH" ]; then
    echo "Error: Build not found at $BUILD_PATH"
    echo "Run 'npm run make' first"
    exit 1
fi

# Kill running instances
echo "Closing any running instances..."
pkill -f "mdviewer" 2>/dev/null || true
sleep 1

# Uninstall old version
if [ -d "$INSTALL_PATH" ]; then
    echo "Removing old version from $INSTALL_PATH..."
    rm -rf "$INSTALL_PATH"
fi

# Install new version
echo "Installing new version..."
cp -R "$BUILD_PATH" "$INSTALL_PATH"

# Get version from Info.plist
VERSION=$(defaults read "$INSTALL_PATH/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo "unknown")
echo "=== Installed mdviewer v$VERSION ==="

# Open the app
echo "Launching mdviewer..."
open "$INSTALL_PATH"
