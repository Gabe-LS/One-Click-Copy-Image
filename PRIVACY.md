# Privacy Policy — One-Click Copy Image

**Last updated:** June 2026

## Data Collection

One-Click Copy Image does **not** collect, store, transmit, or share any personal data or browsing activity.

## What the extension accesses

The extension operates exclusively on Google Images search pages. It reads:

- **Image URLs** — from the currently displayed preview panel, to fetch and copy the image to your clipboard.

This information is used only to copy the image locally. It is never sent to any server, analytics service, or third party.

## Permissions

| Permission | Why |
|---|---|
| `clipboardWrite` | Write image data to your clipboard |
| `downloads` | Save animated GIFs to your Downloads folder when native clipboard is unavailable |
| `nativeMessaging` | Communicate with an optional local helper to copy animated GIFs to the clipboard with animation preserved |
| Host access (`<all_urls>`) | Fetch images from their original servers (Google Images links to images on any domain) |

## Native messaging helper (optional)

The optional GIF clipboard helper is a local script that runs on your computer. It communicates only with the extension via Chrome's native messaging protocol. It does not access the network or send data anywhere.

## Third parties

The extension does not communicate with any external server. It does not include analytics, telemetry, or tracking of any kind.

## Contact

For questions about this policy, open an issue at [github.com/Gabe-LS/One-Click-Copy-Image](https://github.com/Gabe-LS/One-Click-Copy-Image).
