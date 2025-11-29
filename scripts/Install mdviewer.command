#!/bin/bash
# mdviewer Install/Upgrade Script
# Uninstalls current version and installs the latest build

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "mdviewer Installer"
echo "=================="
echo ""
echo "Project directory: $PROJECT_DIR"
echo ""

# Step 1: Uninstall current version
echo "Step 1: Removing existing installation..."
echo ""

APP_PATH="/Applications/mdviewer.app"
APP_SUPPORT="$HOME/Library/Application Support/mdviewer"
PREFERENCES="$HOME/Library/Preferences/com.electron.mdviewer.plist"
CACHES="$HOME/Library/Caches/com.electron.mdviewer"
LOGS="$HOME/Library/Logs/mdviewer"
SAVED_STATE="$HOME/Library/Saved Application State/com.electron.mdviewer.savedState"

[ -e "$APP_PATH" ] && rm -rf "$APP_PATH" && echo "✓ Removed old app"
[ -e "$APP_SUPPORT" ] && rm -rf "$APP_SUPPORT" && echo "✓ Removed app data"
[ -e "$PREFERENCES" ] && rm -rf "$PREFERENCES" && echo "✓ Removed preferences"
[ -e "$CACHES" ] && rm -rf "$CACHES" && echo "✓ Removed caches"
[ -e "$LOGS" ] && rm -rf "$LOGS" && echo "✓ Removed logs"
[ -e "$SAVED_STATE" ] && rm -rf "$SAVED_STATE" && echo "✓ Removed saved state"

echo ""

# Step 2: Build the app
echo "Step 2: Building mdviewer..."
echo ""

cd "$PROJECT_DIR"

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the app
npm run make

echo ""

# Step 3: Install the new version
echo "Step 3: Installing mdviewer to /Applications..."
echo ""

# Find the built app (handles both arm64 and x64)
BUILT_APP=$(find "$PROJECT_DIR/out" -name "mdviewer.app" -type d | head -1)

if [ -z "$BUILT_APP" ]; then
    echo "✗ Error: Could not find built app in out/ directory"
    exit 1
fi

cp -R "$BUILT_APP" /Applications/
echo "✓ Installed mdviewer.app to /Applications"

echo ""
echo "=================="
echo "Installation Complete!"
echo ""
echo "You can now:"
echo "  • Open mdviewer from /Applications"
echo "  • Double-click any .md file to open with mdviewer"
echo "  • Drag .md files onto the mdviewer icon"
echo ""
