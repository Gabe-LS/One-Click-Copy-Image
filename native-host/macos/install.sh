#!/bin/bash
set -euo pipefail

HOST_NAME="com.occi.clipboard_helper"
INSTALL_DIR="$HOME/.occi"
HELPER="$INSTALL_DIR/clipboard_helper.sh"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$SCRIPT_DIR/clipboard_helper.sh"

BROWSERS=(
  "Google/Chrome:Chrome"
  "Google/Chrome Canary:Chrome Canary"
  "BraveSoftware/Brave-Browser:Brave"
  "Microsoft Edge:Edge"
  "Vivaldi:Vivaldi"
  "Arc/User Data:Arc"
  "Chromium:Chromium"
)

uninstall() {
  echo "Uninstalling One-Click Copy Image native helper..."
  local removed=0

  for entry in "${BROWSERS[@]}"; do
    local dir_suffix="${entry%%:*}"
    local manifest="$HOME/Library/Application Support/$dir_suffix/NativeMessagingHosts/$HOST_NAME.json"
    if [ -f "$manifest" ]; then
      rm -f "$manifest"
      removed=$((removed + 1))
    fi
  done

  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    removed=$((removed + 1))
  fi

  if [ "$removed" -gt 0 ]; then
    echo "Removed. Restart your browser."
  else
    echo "Nothing to remove."
  fi
}

install() {
  local ext_id="${1:-}"

  if [ -z "$ext_id" ]; then
    echo ""
    echo "To find your extension ID:"
    echo "  1. Open chrome://extensions or brave://extensions"
    echo "  2. Find 'One-Click Copy Image'"
    echo "  3. Copy the ID (32 lowercase letters)"
    echo ""
    read -rp "Extension ID: " ext_id
  fi

  if ! [[ "$ext_id" =~ ^[a-z]{32}$ ]]; then
    echo "Error: extension ID must be 32 lowercase letters"
    exit 1
  fi

  if [ ! -f "$SOURCE" ]; then
    echo "Error: $SOURCE not found"
    exit 1
  fi

  mkdir -p "$INSTALL_DIR"
  cp "$SOURCE" "$HELPER"
  chmod +x "$HELPER"

  local manifest="{
  \"name\": \"$HOST_NAME\",
  \"description\": \"Clipboard helper for One-Click Copy Image\",
  \"path\": \"$HELPER\",
  \"type\": \"stdio\",
  \"allowed_origins\": [
    \"chrome-extension://$ext_id/\"
  ]
}"

  local installed=0
  for entry in "${BROWSERS[@]}"; do
    local dir_suffix="${entry%%:*}"
    local label="${entry##*:}"
    local browser_dir="$HOME/Library/Application Support/$dir_suffix"

    if [ -d "$browser_dir" ]; then
      local manifest_dir="$browser_dir/NativeMessagingHosts"
      mkdir -p "$manifest_dir"
      echo "$manifest" > "$manifest_dir/$HOST_NAME.json"
      echo "  Installed for $label"
      installed=$((installed + 1))
    fi
  done

  if [ "$installed" -eq 0 ]; then
    local manifest_dir="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    mkdir -p "$manifest_dir"
    echo "$manifest" > "$manifest_dir/$HOST_NAME.json"
    echo "  Installed for Chrome (default)"
  fi

  echo ""
  echo "Helper: $HELPER"
  echo "Extension ID: $ext_id"
  echo ""
  echo "Restart your browser to activate."
}

case "${1:-}" in
  --uninstall) uninstall ;;
  --help|-h)
    echo "Usage:"
    echo "  ./install.sh <extension-id>    Install native helper"
    echo "  ./install.sh --uninstall       Remove native helper"
    ;;
  *) install "${1:-}" ;;
esac
