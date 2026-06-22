#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.occi.clipboard_helper"
BINARY="$SCRIPT_DIR/native-host/clipboard_helper"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

if [ ! -f "$BINARY" ]; then
  echo "Building native helper..."
  swiftc -O -o "$BINARY" "$SCRIPT_DIR/native-host/clipboard_helper.swift"
fi

# Get extension ID from argument, or prompt
EXT_ID="${1:-}"
if [ -z "$EXT_ID" ]; then
  echo ""
  echo "To find your extension ID:"
  echo "  1. Open chrome://extensions"
  echo "  2. Find 'One-Click Copy Image'"
  echo "  3. Copy the ID (e.g. abcdefghijklmnop...)"
  echo ""
  read -p "Enter extension ID: " EXT_ID
fi

if [ -z "$EXT_ID" ]; then
  echo "Error: extension ID is required"
  exit 1
fi

mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/$HOST_NAME.json" << MANIFEST
{
  "name": "$HOST_NAME",
  "description": "Clipboard helper for One-Click Copy Image",
  "path": "$BINARY",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
MANIFEST

echo "Native messaging host installed."
echo "  Manifest: $MANIFEST_DIR/$HOST_NAME.json"
echo "  Binary:   $BINARY"
echo "  Extension: $EXT_ID"
echo ""
echo "Restart Chrome to pick up the change."
