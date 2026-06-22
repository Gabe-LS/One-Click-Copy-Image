#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.occi.clipboard_helper"
BINARY="$SCRIPT_DIR/native-host/clipboard_helper"

if [ ! -f "$BINARY" ]; then
  echo "Building native helper..."
  swiftc -O -o "$BINARY" "$SCRIPT_DIR/native-host/clipboard_helper.swift"
fi

EXT_ID="${1:-}"
if [ -z "$EXT_ID" ]; then
  echo ""
  echo "To find your extension ID:"
  echo "  1. Open chrome://extensions or brave://extensions"
  echo "  2. Find 'One-Click Copy Image'"
  echo "  3. Copy the ID (e.g. abcdefghijklmnop...)"
  echo ""
  read -p "Enter extension ID: " EXT_ID
fi

if [ -z "$EXT_ID" ]; then
  echo "Error: extension ID is required"
  exit 1
fi

MANIFEST_CONTENT="{
  \"name\": \"$HOST_NAME\",
  \"description\": \"Clipboard helper for One-Click Copy Image\",
  \"path\": \"$BINARY\",
  \"type\": \"stdio\",
  \"allowed_origins\": [
    \"chrome-extension://$EXT_ID/\"
  ]
}"

INSTALLED=0

# Install for every Chromium browser found on the system
BROWSERS=(
  "Google/Chrome:Google Chrome"
  "Google/Chrome Canary:Chrome Canary"
  "BraveSoftware/Brave-Browser:Brave"
  "Microsoft Edge:Edge"
  "Vivaldi:Vivaldi"
  "Arc/User Data:Arc"
)

for entry in "${BROWSERS[@]}"; do
  DIR_SUFFIX="${entry%%:*}"
  LABEL="${entry##*:}"
  MANIFEST_DIR="$HOME/Library/Application Support/$DIR_SUFFIX/NativeMessagingHosts"

  # Only install if the browser's Application Support dir exists
  BROWSER_DIR="$HOME/Library/Application Support/$DIR_SUFFIX"
  if [ -d "$BROWSER_DIR" ]; then
    mkdir -p "$MANIFEST_DIR"
    echo "$MANIFEST_CONTENT" > "$MANIFEST_DIR/$HOST_NAME.json"
    echo "  Installed for $LABEL"
    INSTALLED=$((INSTALLED + 1))
  fi
done

# Chromium (generic)
CHROMIUM_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
if [ -d "$HOME/Library/Application Support/Chromium" ]; then
  mkdir -p "$CHROMIUM_DIR"
  echo "$MANIFEST_CONTENT" > "$CHROMIUM_DIR/$HOST_NAME.json"
  echo "  Installed for Chromium"
  INSTALLED=$((INSTALLED + 1))
fi

if [ "$INSTALLED" -eq 0 ]; then
  echo "No supported browsers found. Installing for Chrome by default."
  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  mkdir -p "$MANIFEST_DIR"
  echo "$MANIFEST_CONTENT" > "$MANIFEST_DIR/$HOST_NAME.json"
  echo "  Installed for Google Chrome"
fi

echo ""
echo "Binary: $BINARY"
echo "Extension ID: $EXT_ID"
echo ""
echo "Restart your browser to pick up the change."
