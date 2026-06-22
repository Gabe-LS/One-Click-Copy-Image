const NATIVE_HOST = "com.occi.clipboard_helper";
const MAX_DIMENSION = 4096;
const FETCH_TIMEOUT_MS = 30000;
const DOWNLOAD_TIMEOUT_MS = 60000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message.action];
  if (!handler) return;
  handler(message)
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ success: false, error: err.message }));
  return true;
});

const handlers = {
  fetchImage: (msg) => fetchImage(msg.src),
  downloadGif: (msg) => downloadGif(msg.src, msg.filename),
};

async function fetchImage(src) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(src, { signal: controller.signal });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const contentType = response.headers.get("content-type") || "";
    const blob = await response.blob();
    const isGif = blob.type === "image/gif" || contentType.includes("image/gif");

    if (isGif) {
      const base64 = arrayBufferToBase64(await blob.arrayBuffer());
      const nativeResult = await copyGifNative(base64);

      if (nativeResult.success) {
        return { success: true, isGif: true, copied: true };
      }

      return {
        success: true,
        isGif: true,
        copied: false,
        resolvedUrl: response.url,
        filename: sanitizeFilename(response.url, "gif"),
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
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const pngBuf = await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer();
    return { success: true, isGif: false, pngBase64: arrayBufferToBase64(pngBuf) };
  } finally {
    clearTimeout(timer);
  }
}

function copyGifNative(base64) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(
        NATIVE_HOST,
        { action: "copyGif", base64 },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false, error: "No response" });
          }
        }
      );
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
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
    const last = new URL(url).pathname.split("/").pop();
    if (last) {
      const clean = last.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+|\.+$/g, "").substring(0, 200);
      if (clean && clean.includes(".")) return clean;
      if (clean) return clean + "." + defaultExt;
    }
  } catch {}
  return "image." + defaultExt;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}
