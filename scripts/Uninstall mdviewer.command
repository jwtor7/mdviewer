#!/bin/bash
# mdviewer Uninstall Script
# Removes the application and all associated data

set -e

echo "mdviewer Uninstaller"
echo "===================="
echo ""

# Define paths to remove
APP_PATH="/Applications/mdviewer.app"
APP_SUPPORT="$HOME/Library/Application Support/mdviewer"
PREFERENCES="$HOME/Library/Preferences/com.electron.mdviewer.plist"
CACHES="$HOME/Library/Caches/com.electron.mdviewer"
LOGS="$HOME/Library/Logs/mdviewer"
SAVED_STATE="$HOME/Library/Saved Application State/com.electron.mdviewer.savedState"

# Track what was removed
removed=()
not_found=()

# Function to remove item
remove_item() {
    local path="$1"
    local desc="$2"
    if [ -e "$path" ]; then
        rm -rf "$path"
        removed+=("$desc: $path")
        echo "✓ Removed $desc"
    else
        not_found+=("$desc: $path")
    fi
}

echo "Removing mdviewer..."
echo ""

# Remove application
remove_item "$APP_PATH" "Application"

# Remove Application Support data (preferences, recent files, etc.)
remove_item "$APP_SUPPORT" "Application Support"

# Remove macOS preferences plist
remove_item "$PREFERENCES" "Preferences"

# Remove caches
remove_item "$CACHES" "Caches"

# Remove logs
remove_item "$LOGS" "Logs"

# Remove saved application state
remove_item "$SAVED_STATE" "Saved State"

echo ""
echo "===================="
echo "Uninstall Complete"
echo ""

if [ ${#removed[@]} -gt 0 ]; then
    echo "Removed:"
    for item in "${removed[@]}"; do
        echo "  - $item"
    done
fi

if [ ${#not_found[@]} -gt 0 ]; then
    echo ""
    echo "Not found (already removed or never existed):"
    for item in "${not_found[@]}"; do
        echo "  - $item"
    done
fi

echo ""
echo "mdviewer has been completely removed from your system."
