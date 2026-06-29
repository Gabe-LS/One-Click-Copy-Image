# One-Click Copy Image

A browser extension that adds a **Copy** button to Google Images. Click any image result, and a button appears on the preview — one click copies it to your clipboard, ready to paste.

**Static images** (JPEG, PNG, WebP) are copied instantly. **Animated GIFs** can be copied with animation preserved if you install a small optional helper (see below).

Works with Chrome, Brave, Edge, and other Chromium-based browsers.

## Installation

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/one-click-copy-image/linegepjibpagogcacmjfcpclppgjgmm).

## Usage

1. Go to [Google Images](https://images.google.com) and search for something
2. Click on any image result — a larger preview opens on the right
3. A **Copy** button appears on the preview image
4. Click it — a green progress bar fills the button while it works
5. The button turns solid green when the image is on your clipboard
6. Paste anywhere (Cmd+V / Ctrl+V)

**Alt+Click** the button to download the image to your Downloads folder instead of copying it.

**For animated GIFs:** Without the optional helper below, GIFs are saved to your Downloads folder instead of copied to the clipboard. The button still turns green — check your Downloads.

## Animated GIF clipboard support (optional)

By default, animated GIFs are downloaded because browsers can't copy them to the clipboard natively. To enable true clipboard copy (so you can paste animated GIFs directly), install a small helper.

### macOS

Open **Terminal** and run:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Gabe-LS/One-Click-Copy-Image/main/native-host/macos/install.sh) linegepjibpagogcacmjfcpclppgjgmm
```

### Windows

Open **PowerShell** and run:

```powershell
irm https://raw.githubusercontent.com/Gabe-LS/One-Click-Copy-Image/main/native-host/windows/install.ps1 -OutFile $env:TEMP\occi-install.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\occi-install.ps1 -ExtensionId linegepjibpagogcacmjfcpclppgjgmm; Remove-Item $env:TEMP\occi-install.ps1
```

No admin needed on either platform. On Windows, the helper is compiled from source during install using the built-in .NET compiler.

> **Note:** The extension ID above (`linegepjibpagogcacmjfcpclppgjgmm`) is for the Chrome Web Store version. If you loaded the extension unpacked in developer mode, your ID will be different — find it at `chrome://extensions`.

After installing, **restart your browser** (fully quit and reopen) to register the helper.

## Uninstall

### Remove the extension

1. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`)
2. Find **One-Click Copy Image**
3. Click **Remove**

### Remove the GIF helper (if installed)

**macOS** — open Terminal and run:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Gabe-LS/One-Click-Copy-Image/main/native-host/macos/install.sh) --uninstall
```

**Windows** — open PowerShell and run:

```powershell
irm https://raw.githubusercontent.com/Gabe-LS/One-Click-Copy-Image/main/native-host/windows/install.ps1 -OutFile $env:TEMP\occi-install.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\occi-install.ps1 -Uninstall; Remove-Item $env:TEMP\occi-install.ps1
```

Restart your browser after uninstalling.

## Development

```bash
npm install
npx playwright install chromium
npx playwright test
```

Tests use Playwright with a real Chromium instance and the extension loaded.

## Credits

Icon by [Tanah Basah](https://www.flaticon.com/free-icons/ui) — Flaticon
