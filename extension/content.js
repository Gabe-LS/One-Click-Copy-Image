(() => {
  "use strict";

  const COPY_ICON = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

  const PROXY_HOSTS = new Set(["encrypted-tbn0.gstatic.com", "encrypted-tbn1.gstatic.com", "encrypted-tbn2.gstatic.com", "encrypted-tbn3.gstatic.com"]);

  function isGoogleImagesPage() {
    const params = new URLSearchParams(window.location.search);
    return params.get("udm") === "2" || params.get("tbm") === "isch";
  }

  function isProxyUrl(src) {
    try { return PROXY_HOSTS.has(new URL(src).hostname); }
    catch { return false; }
  }

  // --- Find the single preview image to attach a button to ---

  function largestImage(container) {
    let best = null;
    let bestArea = 0;
    for (const img of container.querySelectorAll("img")) {
      if (!img.src || img.naturalWidth === 0) continue;
      const r = img.getBoundingClientRect();
      if (r.width < 100 || r.height < 100) continue;
      const area = r.width * r.height;
      if (area > bestArea) { best = img; bestArea = area; }
    }
    return best;
  }

  function findPreviewImage() {
    // Strategy 1: data-viewer-type is a behavioral attribute Google uses
    // for the preview panel. Find the visible one and pick its largest image.
    for (const panel of document.querySelectorAll("[data-viewer-type]")) {
      const r = panel.getBoundingClientRect();
      if (r.width < 200 || r.height < 200) continue;

      const img = largestImage(panel);
      if (img && !img.closest(".occi-has-btn")) return img;
    }

    // Strategy 2: structural fallback — find the single largest image
    // in the right portion of the viewport (the preview panel area).
    const rightThreshold = window.innerWidth * 0.55;
    const vh = window.innerHeight;
    let best = null;
    let bestArea = 0;

    for (const img of document.querySelectorAll("img")) {
      if (img.closest(".occi-has-btn")) continue;
      if (!img.src || img.naturalWidth === 0) continue;

      const r = img.getBoundingClientRect();
      if (r.width < 300 || r.height < 200) continue;
      if (r.left < rightThreshold) continue;
      if (r.bottom < 0 || r.top > vh) continue;

      const area = r.width * r.height;
      if (area > bestArea) { best = img; bestArea = area; }
    }

    return best;
  }

  // --- Find a suitable positioned ancestor to anchor the button ---

  function findImageContainer(img) {
    const imgRect = img.getBoundingClientRect();
    let el = img.parentElement;

    for (let i = 0; i < 5 && el; i++) {
      const r = el.getBoundingClientRect();
      if (Math.abs(r.width - imgRect.width) < 40 && Math.abs(r.height - imgRect.height) < 40) {
        return el;
      }
      const pos = getComputedStyle(el).position;
      if (pos === "relative" || pos === "absolute") {
        return el;
      }
      el = el.parentElement;
    }

    return img.parentElement;
  }

  // --- At click time, find the original (non-proxy) image URL ---

  function findBestImageSrc(btn) {
    const scope = btn.parentElement?.parentElement || btn.parentElement;
    if (!scope) return btn._targetImg?.src || null;

    let bestReal = null;
    let bestProxy = null;

    for (const img of scope.querySelectorAll("img")) {
      if (!img.src || img.naturalWidth === 0 || img.src.startsWith("data:")) continue;

      if (isProxyUrl(img.src)) {
        bestProxy ??= img.src;
      } else {
        bestReal = img.src;
      }
    }

    return bestReal || bestProxy || btn._targetImg?.src || null;
  }

  // --- Button ---

  function createCopyButton() {
    const btn = document.createElement("button");
    btn.className = "occi-copy-btn";
    btn.innerHTML = COPY_ICON + "<span>Copy</span>";
    btn.title = "Copy image to clipboard";
    btn.addEventListener("click", handleCopyClick);
    return btn;
  }

  function showButtonState(btn, state) {
    btn.classList.remove("occi-success", "occi-error");
    if (state) btn.classList.add(state === "success" ? "occi-success" : "occi-error");
    clearTimeout(btn._resetTimer);
    if (state) {
      btn._resetTimer = setTimeout(() => showButtonState(btn, null), 2000);
    }
  }

  // --- Click handler ---

  let busy = false;

  async function handleCopyClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (busy) return;
    busy = true;

    const btn = e.currentTarget;
    const src = findBestImageSrc(btn);

    if (!src) {
      showButtonState(btn, "error");
      busy = false;
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ action: "fetchImage", src });

      if (!response?.success) throw new Error(response?.error || "Fetch failed");

      if (response.isGif && !response.copied) {
        const dlResult = await chrome.runtime.sendMessage({
          action: "downloadGif",
          src: response.resolvedUrl || src,
          filename: response.filename,
        });
        if (!dlResult?.success) throw new Error(dlResult?.error || "Download failed");
      }

      if (!response.isGif) {
        const raw = atob(response.pngBase64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": new Blob([bytes], { type: "image/png" }) }),
        ]);
      }

      showButtonState(btn, "success");
    } catch (err) {
      console.error("[One-Click Copy Image]", err);
      showButtonState(btn, "error");
    } finally {
      busy = false;
    }
  }

  // --- Inject button on the preview image ---

  function attachButton(img) {
    const container = findImageContainer(img);
    if (!container) return;

    const pos = getComputedStyle(container).position;
    if (pos === "static") container.style.position = "relative";

    container.classList.add("occi-has-btn");

    const btn = createCopyButton();
    btn._targetImg = img;
    container.appendChild(btn);
    btn.classList.add("occi-visible");
  }

  function scanAndAttach() {
    if (!isGoogleImagesPage()) return;
    const img = findPreviewImage();
    if (img) attachButton(img);
  }

  // --- Throttled MutationObserver ---

  let scanTimer = null;
  const observer = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = requestAnimationFrame(() => {
      scanTimer = null;
      scanAndAttach();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  scanAndAttach();
})();
