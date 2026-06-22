# One-Click Copy Image

Chrome extension (Manifest V3) that copies images from Google Images.

## Architecture

```
extension/
  content.js      Content script — injects Copy button, handles clipboard write
  background.js   Service worker — fetches images cross-origin, routes GIFs to native helper
  styles.css      Button styles with progress bar animation
  manifest.json   MV3 manifest, 48 Google TLDs

native-host/
  macos/clipboard_helper.sh    Bash+JXA — writes GIF to NSPasteboard
  windows/clipboard_helper.ps1 PowerShell — writes GIF via .NET Clipboard

install-macos.sh     Installs helper to ~/.occi/, writes browser manifests
install-windows.ps1  Installs helper to %LOCALAPPDATA%\occi\, writes HKCU registry

tests/               Playwright tests (Chromium + extension loaded)
```

## Key design decisions

- **No obfuscated selectors.** Content script uses `[data-viewer-type]` (behavioral attribute, stable) with a structural fallback (largest image on right side of viewport). No jsname/class dependencies.
- **Canvas fast path.** Tries canvas.toBlob first (zero network). Falls back to background fetch on cross-origin taint. Skipped for GIF URLs (canvas freezes animation).
- **Single button.** Only one Copy button at a time — attached to the single largest preview image, not grid thumbnails.
- **GIF flow stays in background.** Fetch → detect GIF → native clipboard → download fallback all happen in the service worker. GIF bytes never travel through content↔background messaging.
- **Native helper uses only OS built-ins.** macOS: bash + osascript. Windows: PowerShell + .NET. No compilation, no third-party deps.
- **Brave reads Chrome's NativeMessagingHosts directory.** Install script writes manifests to all browser directories.

## Testing

```bash
npm install
npx playwright install chromium
npx playwright test
```

Tests need a headed Chromium instance (not headless — extensions require it).

## Gotchas

- Google's thumbnail proxy (`encrypted-tbn*.gstatic.com`) converts GIFs to static PNG. The content script resolves the original source URL at click time via `findBestImageSrc`.
- `navigator.clipboard.write` only accepts `image/png`. Animated GIF clipboard requires the native messaging helper.
- The progress bar is a fixed CSS animation (8s ease-out), not tied to real download progress.
- Brave requires a full quit+reopen (not just tab close) to reload native messaging host manifests.
