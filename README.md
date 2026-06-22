# One-Click Copy Image

A browser extension that adds a **Copy** button to Google Images. Click any image result, and a button appears on the preview — one click copies it to your clipboard, ready to paste.

**Static images** (JPEG, PNG, WebP) are copied instantly. **Animated GIFs** can be copied with animation preserved if you install a small optional helper (see below).

Works with Chrome, Brave, Edge, and other Chromium-based browsers.

## Installation

### Option 1: Download (easiest)

1. Go to the [latest release](https://github.com/Gabe-LS/One-Click-Copy-Image/releases/latest)
2. Download the **Source code (zip)** and unzip it
3. Open your browser's extensions page:
   - Chrome: type `chrome://extensions` in the address bar
   - Brave: type `brave://extensions`
   - Edge: type `edge://extensions`
4. Turn on **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked**
6. Select the `extension` folder inside the unzipped download

The extension icon should appear in your toolbar.

### Option 2: Clone with Git

```bash
git clone https://github.com/Gabe-LS/One-Click-Copy-Image.git
```

Then follow steps 3-6 above.

## Usage

1. Go to [Google Images](https://images.google.com) and search for something
2. Click on any image result — a larger preview opens on the right
3. A **Copy** button appears on the preview image
4. Click it — a green progress bar fills the button while it works
5. The button turns solid green when the image is on your clipboard
6. Paste anywhere (Cmd+V / Ctrl+V)

**For animated GIFs:** Without the optional helper below, GIFs are saved to your Downloads folder instead of copied to the clipboard. The button still turns green — check your Downloads.

## Animated GIF clipboard support (optional)

By default, animated GIFs are downloaded because browsers can't copy them to the clipboard natively. To enable true clipboard copy (so you can paste animated GIFs directly), install a small helper script.

### macOS

1. Download [occi-gif-helper-macos.zip](https://github.com/Gabe-LS/One-Click-Copy-Image/releases/latest/download/occi-gif-helper-macos.zip) and unzip it (double-click the zip file)
2. Open **Terminal** (search "Terminal" in Spotlight)
3. Type `cd ` (with a space after it), then drag the unzipped folder from Finder into the Terminal window — this fills in the path. Press Enter.
4. Run:

```bash
./install.sh YOUR_EXTENSION_ID
```

No admin password needed. To uninstall later:

```bash
~/.occi/uninstall.sh
```

### Windows

1. Download [occi-gif-helper-windows.zip](https://github.com/Gabe-LS/One-Click-Copy-Image/releases/latest/download/occi-gif-helper-windows.zip) and unzip it (right-click > Extract All)
2. Open the unzipped folder in File Explorer
3. Click the address bar, type `powershell`, and press Enter — this opens PowerShell in that folder
4. Run:

```powershell
.\install.ps1 -ExtensionId YOUR_EXTENSION_ID
```

No admin needed. To uninstall later:

```powershell
powershell "$env:LOCALAPPDATA\occi\uninstall.ps1"
```

### How to find your extension ID

1. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`)
2. Find **One-Click Copy Image** in the list
3. The **ID** is the long string of lowercase letters shown under the extension name (e.g. `abcdefghijklmnopqrstuvwxyzabcdef`)
4. Copy it and paste it in place of `YOUR_EXTENSION_ID` in the install command above

After installing the helper, **restart your browser** (fully quit and reopen) for it to take effect.

## Development

```bash
npm install
npx playwright install chromium
npx playwright test
```

Tests use Playwright with a real Chromium instance and the extension loaded.

## Credits

Icon by [Tanah Basah](https://www.flaticon.com/free-icons/ui) — Flaticon
