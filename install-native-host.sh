#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.occi.clipboard_helper"
BINARY="$SCRIPT_DIR/native-host/clipboard_helper.py"

if [ ! -f "$BINARY" ]; then
  echo "Error: $BINARY not found"
  exit 1
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

if ! [[ "$EXT_ID" =~ ^[a-z]{32}$ ]]; then
  echo "Error: extension ID must be 32 lowercase letters"
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

BROWSERS=(
  "Google/Chrome:Google Chrome"
  "Google/Chrome Canary:Chrome Canary"
  "BraveSoftware/Brave-Browser:Brave"
  "Microsoft Edge:Edge"
  "Vivaldi:Vivaldi"
  "Arc/User Data:Arc"
  "Chromium:Chromium"
)

for entry in "${BROWSERS[@]}"; do
  DIR_SUFFIX="${entry%%:*}"
  LABEL="${entry##*:}"
  BROWSER_DIR="$HOME/Library/Application Support/$DIR_SUFFIX"

  if [ -d "$BROWSER_DIR" ]; then
    MANIFEST_DIR="$BROWSER_DIR/NativeMessagingHosts"
    mkdir -p "$MANIFEST_DIR"
    echo "$MANIFEST_CONTENT" > "$MANIFEST_DIR/$HOST_NAME.json"
    echo "  Installed for $LABEL"
    INSTALLED=$((INSTALLED + 1))
  fi
done

if [ "$INSTALLED" -eq 0 ]; then
  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  mkdir -p "$MANIFEST_DIR"
  echo "$MANIFEST_CONTENT" > "$MANIFEST_DIR/$HOST_NAME.json"
  echo "  Installed for Google Chrome (default)"
fi

echo ""
echo "Helper: $BINARY"
echo "Extension ID: $EXT_ID"
echo ""
echo "Restart your browser to pick up the change."
