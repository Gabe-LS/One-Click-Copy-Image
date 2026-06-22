# One-Click Copy Image

Chrome/Brave/Edge extension that adds a **Copy** button to Google Images preview panels. Click it to copy the full-resolution image to your clipboard.

- **Static images** (JPEG, PNG, WebP) are copied as PNG
- **Animated GIFs** are copied with animation preserved (requires a small native helper) or downloaded as a fallback

Works on 48 Google country domains.

## Install the extension

1. Clone this repo
2. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `extension/` folder

## Animated GIF clipboard support (optional)

The browser Clipboard API only supports static `image/png`. To copy animated GIFs to the clipboard with animation preserved, install the native helper for your platform.

### macOS

```bash
./install-macos.sh <extension-id>
```

Uses `bash` + `osascript` (built into every Mac). Installs to `~/.occi/`. No compilation, no sudo.

To uninstall:

```bash
./install-macos.sh --uninstall
```

### Windows

```powershell
.\install-windows.ps1 -ExtensionId <extension-id>
```

Uses PowerShell + .NET (built into Windows 10+). Installs to `%LOCALAPPDATA%\occi\`. No admin.

To uninstall:

```powershell
.\install-windows.ps1 -Uninstall
```

### Finding your extension ID

1. Open `chrome://extensions` (or your browser's equivalent)
2. Find **One-Click Copy Image**
3. The ID is the 32-character string under the name

## How it works

- **Content script** (`content.js`) detects Google Images preview panels via `[data-viewer-type]` with a structural fallback, injects a Copy button on the largest preview image
- **Background service worker** (`background.js`) fetches images cross-origin, converts to PNG, or routes GIFs through the native helper
- **Native helper** writes GIF data to the system clipboard as `com.compuserve.gif` (macOS) or via .NET `Clipboard` (Windows) — the same format browsers use for right-click "Copy Image"
- If the native helper isn't installed, GIFs are downloaded to the Downloads folder instead

## Development

```bash
npm install
npx playwright test
```

Tests use Playwright with a real Chromium instance and the extension loaded.
