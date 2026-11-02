# Privacy Policy — One-Click Copy Image

**Last updated:** November 2026

## Data Collection

One-Click Copy Image does **not** collect, store, transmit, or share any personal data or browsing activity.

## What the extension accesses

The extension operates exclusively on Google Images search pages. It reads:

- **Image URLs** — from the currently displayed preview panel, to fetch and copy the image to your clipboard.
- **Instagram post links** — when the preview is an Instagram post, the extension reads the post's ID from the panel's link and loads that post's public embed page from instagram.com to find the full-resolution image. This request is sent without your Instagram cookies or login.

This information is used only to copy the image locally. It is never sent to any analytics service or third party; the only requests made are to the servers hosting the image you copy (and instagram.com, as described above).

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

The extension does not communicate with any developer-run or analytics server. Its only network requests fetch the image you chose to copy from the site hosting it. It does not include analytics, telemetry, or tracking of any kind.

## Contact

For questions about this policy, open an issue at [github.com/Gabe-LS/One-Click-Copy-Image](https://github.com/Gabe-LS/One-Click-Copy-Image).
