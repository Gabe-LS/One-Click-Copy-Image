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

  function looksLikeGif(src) {
    try { return new URL(src).pathname.toLowerCase().endsWith(".gif"); }
    catch { return false; }
  }

  // --- Find the preview image inside a panel ---
  // The preview image sits inside an <a role="link"> that points to the
  // source website. Related/similar images below use role="button" instead.
  // This structural difference is reliable across image sizes.

  function findPreviewImageInPanel(panel) {
    for (const link of panel.querySelectorAll('a[role="link"]')) {
      for (const img of link.querySelectorAll("img")) {
        if (!img.src || img.naturalWidth === 0) continue;
        const r = img.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) continue;
        if (!img.closest(".occi-has-btn")) return img;
      }
    }
    return null;
  }

  function findPreviewImage() {
    // Strategy 1: find the preview image inside a data-viewer-type panel
    for (const panel of document.querySelectorAll("[data-viewer-type]")) {
      const r = panel.getBoundingClientRect();
      if (r.width < 100 || r.height < 100) continue;

      const img = findPreviewImageInPanel(panel);
      if (img) return img;
    }

    // Strategy 2: structural fallback — largest right-side image
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
    let scope = btn.parentElement;
    for (let i = 0; i < 4 && scope; i++) {
      if (scope.hasAttribute?.("data-viewer-type")) break;
      scope = scope.parentElement;
    }
    if (!scope) scope = btn.parentElement;

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

  // --- Stale button cleanup ---

  function cleanupStaleButtons() {
    for (const el of document.querySelectorAll(".occi-has-btn")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || !el.isConnected) {
        el.classList.remove("occi-has-btn");
        const btn = el.querySelector(".occi-copy-btn");
        if (btn) btn.remove();
      }
    }
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
    btn.classList.remove("occi-loading", "occi-success", "occi-error");
    if (state === "loading") {
      void btn.offsetWidth;
      btn.classList.add("occi-loading");
    } else if (state) {
      btn.classList.add(state === "success" ? "occi-success" : "occi-error");
    }
    clearTimeout(btn._resetTimer);
    if (state && state !== "loading") {
      btn._resetTimer = setTimeout(() => showButtonState(btn, null), 2000);
    }
  }

  // --- Canvas-based copy (instant, no network) ---

  async function tryCanvasCopy(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    if (!blob) throw new Error("toBlob failed");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
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
    const img = btn._targetImg;
    const src = findBestImageSrc(btn);

    if (!src) {
      showButtonState(btn, "error");
      busy = false;
      return;
    }

    showButtonState(btn, "loading");

    try {
      if (img?.complete && img.naturalWidth > 0 && !looksLikeGif(src) && !isProxyUrl(img.src)) {
        try {
          await tryCanvasCopy(img);
          showButtonState(btn, "success");
          return;
        } catch {}
      }

      const response = await chrome.runtime.sendMessage({ action: "fetchImage", src });

      if (!response?.success) throw new Error(response?.error || "Fetch failed");

      if (response.isGif) {
        if (!response.copied && !response.downloaded) {
          throw new Error(response.error || "GIF copy/download failed");
        }
      } else {
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
    cleanupStaleButtons();
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

  const root = document.body || document.documentElement;
  observer.observe(root, { childList: true, subtree: true });
  scanAndAttach();
})();
