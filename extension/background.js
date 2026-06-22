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

async function fetchImage(src) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

  const contentType = response.headers.get("content-type") || "";
  const resolvedUrl = response.url;
  const blob = await response.blob();
  const isGif = blob.type === "image/gif" || contentType.includes("image/gif");

  if (isGif) {
    const filename = filenameFromUrl(resolvedUrl, "gif") || "image.gif";
    return { success: true, isGif: true, resolvedUrl, filename };
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

  return {
    success: true,
    isGif: false,
    pngBase64: arrayBufferToBase64(buf),
  };
}

async function downloadGif(src, filename) {
  const id = await chrome.downloads.download({
    url: src,
    filename: filename,
    conflictAction: "uniquify",
  });

  return new Promise((resolve) => {
    chrome.downloads.onChanged.addListener(function listener(delta) {
      if (delta.id !== id) return;
      if (delta.state?.current === "complete") {
        chrome.downloads.onChanged.removeListener(listener);
        resolve({ success: true });
      } else if (delta.error) {
        chrome.downloads.onChanged.removeListener(listener);
        resolve({ success: false, error: delta.error.current });
      }
    });
  });
}

function filenameFromUrl(url, defaultExt) {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/");
    const last = segments[segments.length - 1];
    if (last && last.includes(".")) return last;
    if (last) return last + "." + defaultExt;
  } catch {}
  return null;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
