#!/bin/bash
set -euo pipefail

HOST_NAME="com.occi.clipboard_helper"
INSTALL_DIR="$HOME/.occi"
HELPER="$INSTALL_DIR/clipboard_helper.sh"
REMOTE_URL="https://raw.githubusercontent.com/Gabe-LS/One-Click-Copy-Image/main/native-host/macos/clipboard_helper.sh"
SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo "")"
SOURCE="${SCRIPT_DIR:+$SCRIPT_DIR/clipboard_helper.sh}"

BROWSERS=(
  "Google/Chrome:Chrome"
  "Google/Chrome Canary:Chrome Canary"
  "BraveSoftware/Brave-Browser:Brave"
  "Microsoft Edge:Edge"
  "Vivaldi:Vivaldi"
  "Arc/User Data:Arc"
  "Chromium:Chromium"
)

confirm() {
  local prompt="$1"
  read -rp "$prompt [y/N] " answer
  case "$answer" in
    [yY]) return 0 ;;
    *) return 1 ;;
  esac
}

uninstall() {
  echo ""
  echo "One-Click Copy Image — Uninstall GIF Helper"
  echo "---------------------------------------------"
  echo ""
  echo "This will remove the GIF clipboard helper from your Mac."
  echo ""
  echo "What will be removed:"

  local found=0

  for entry in "${BROWSERS[@]}"; do
    local dir_suffix="${entry%%:*}"
    local label="${entry##*:}"
    local manifest="$HOME/Library/Application Support/$dir_suffix/NativeMessagingHosts/$HOST_NAME.json"
    if [ -f "$manifest" ]; then
      echo "  - $label browser registration"
      found=1
    fi
  done

  if [ -d "$INSTALL_DIR" ]; then
    echo "  - Helper files in $INSTALL_DIR"
    found=1
  fi

  if [ "$found" -eq 0 ]; then
    echo ""
    echo "Nothing to remove — the helper is not installed."
    exit 0
  fi

  echo ""
  echo "The extension itself will not be affected. You can reinstall"
  echo "the helper at any time by running this script again."
  echo ""

  if ! confirm "Remove the helper?"; then
    echo "Cancelled — nothing was changed."
    exit 0
  fi

  echo ""

  for entry in "${BROWSERS[@]}"; do
    local dir_suffix="${entry%%:*}"
    local label="${entry##*:}"
    local manifest="$HOME/Library/Application Support/$dir_suffix/NativeMessagingHosts/$HOST_NAME.json"
    if [ -f "$manifest" ]; then
      rm -f "$manifest"
      echo "  Removed $label registration"
    fi
  done

  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "  Removed $INSTALL_DIR"
  fi

  echo ""
  echo "All done! Restart your browser to finish."
}

install() {
  local ext_id="${1:-}"

  echo ""
  echo "One-Click Copy Image — GIF Helper Setup"
  echo "-----------------------------------------"
  echo ""
  echo "Welcome! This installs a small helper that lets the extension"
  echo "copy animated GIFs to your clipboard. Without it, GIFs are"
  echo "saved to your Downloads folder instead."
  echo ""
  echo "The helper:"
  echo "  - Runs only when you click Copy on a GIF"
  echo "  - Uses only built-in macOS tools (no extra software)"
  echo "  - Stays in your home folder (no admin password needed)"
  echo "  - Is easy to remove — just run: ./install.sh --uninstall"
  echo ""

  if [ -z "$ext_id" ]; then
    echo "To find your extension ID:"
    echo "  1. Open chrome://extensions (or brave://extensions)"
    echo "  2. Find 'One-Click Copy Image'"
    echo "  3. Copy the ID (32 lowercase letters)"
    echo ""
    read -rp "Extension ID: " ext_id
  fi

  if ! [[ "$ext_id" =~ ^[a-z]{32}$ ]]; then
    echo ""
    echo "That doesn't look like a valid extension ID."
    echo "It should be exactly 32 lowercase letters, like: linegepjibpagogcacmjfcpclppgjgmm"
    exit 1
  fi

  local detected_browsers=()
  for entry in "${BROWSERS[@]}"; do
    local dir_suffix="${entry%%:*}"
    local label="${entry##*:}"
    local browser_dir="$HOME/Library/Application Support/$dir_suffix"
    if [ -d "$browser_dir" ]; then
      detected_browsers+=("$label")
    fi
  done

  echo ""
  echo "Ready to install. Here's what will happen:"
  echo ""
  echo "  1. Copy the helper script to $INSTALL_DIR"
  echo "  2. Register it with: ${detected_browsers[*]:-Chrome}"
  echo ""

  if ! confirm "Continue?"; then
    echo "Cancelled — nothing was changed."
    exit 0
  fi

  echo ""

  mkdir -p "$INSTALL_DIR"
  if [ -n "$SOURCE" ] && [ -f "$SOURCE" ]; then
    cp "$SOURCE" "$HELPER"
  else
    echo "  Downloading helper..."
    curl -fsSL "$REMOTE_URL" -o "$HELPER" || { echo ""; echo "Download failed. Check your internet connection and try again."; exit 1; }
  fi
  chmod +x "$HELPER"
  echo "  Helper installed"

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
      echo "  Registered for $label"
      installed=$((installed + 1))
    fi
  done

  if [ "$installed" -eq 0 ]; then
    local manifest_dir="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    mkdir -p "$manifest_dir"
    echo "$manifest" > "$manifest_dir/$HOST_NAME.json"
    echo "  Registered for Chrome"
  fi

  echo ""
  echo "All done! Restart your browser, and GIF copying will work."
  echo ""
  echo "To remove the helper later, run:"
  echo "  ./install.sh --uninstall"
}

case "${1:-}" in
  --uninstall) uninstall ;;
  --help|-h)
    echo "Usage:"
    echo "  ./install.sh <extension-id>    Install the GIF clipboard helper"
    echo "  ./install.sh --uninstall       Remove the GIF clipboard helper"
    ;;
  *) install "${1:-}" ;;
esac
