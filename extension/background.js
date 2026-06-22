chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchImage") {
    fetchImage(message.src)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === "downloadGif") {
    downloadGif(message.src, message.filename)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

const MAX_DIMENSION = 4096;
const FETCH_TIMEOUT_MS = 30000;
const DOWNLOAD_TIMEOUT_MS = 60000;

async function fetchImage(src) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(src, { signal: controller.signal });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const contentType = response.headers.get("content-type") || "";
    const resolvedUrl = response.url;
    const blob = await response.blob();
    const isGif = blob.type === "image/gif" || contentType.includes("image/gif");

    if (isGif) {
      return {
        success: true,
        isGif: true,
        resolvedUrl,
        filename: sanitizeFilename(resolvedUrl, "gif"),
      };
    }

    const bitmap = await createImageBitmap(blob);
    let w = bitmap.width;
    let h = bitmap.height;
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const pngBlob = await canvas.convertToBlob({ type: "image/png" });
    const buf = await pngBlob.arrayBuffer();

    return { success: true, isGif: false, pngBase64: arrayBufferToBase64(buf) };
  } finally {
    clearTimeout(timer);
  }
}

async function downloadGif(src, filename) {
  const id = await chrome.downloads.download({
    url: src,
    filename: filename || "image.gif",
    conflictAction: "uniquify",
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.downloads.onChanged.removeListener(listener);
      resolve({ success: false, error: "Download timed out" });
    }, DOWNLOAD_TIMEOUT_MS);

    function listener(delta) {
      if (delta.id !== id) return;
      if (delta.state?.current === "complete") {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);
        resolve({ success: true });
      } else if (delta.error) {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);
        resolve({ success: false, error: delta.error.current });
      }
    }

    chrome.downloads.onChanged.addListener(listener);
  });
}

function sanitizeFilename(url, defaultExt) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop();
    if (last) {
      // Strip query-like suffixes, keep only safe chars
      const clean = last.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 200);
      if (clean.includes(".")) return clean;
      return clean + "." + defaultExt;
    }
  } catch {}
  return "image." + defaultExt;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
