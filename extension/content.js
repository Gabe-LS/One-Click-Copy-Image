(() => {
  "use strict";

  const COPY_ICON = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

  function isGoogleImagesPage() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("udm") === "2" || params.get("tbm") === "isch") return true;
    return (
      window.location.hostname.startsWith("www.google.") &&
      window.location.pathname === "/search" &&
      document.querySelectorAll("img").length > 20
    );
  }

  // --- Find preview images worth adding a button to ---
  // Instead of detecting "panels", find large images on the right side of the
  // viewport that look like Google Images preview images.

  function findPreviewImages() {
    const vw = window.innerWidth;
    const rightThreshold = vw * 0.45;
    const results = [];

    document.querySelectorAll("img").forEach((img) => {
      if (img.closest(".occi-has-btn")) return;
      if (!img.src || img.naturalWidth === 0) return;

      const r = img.getBoundingClientRect();
      if (r.width < 200 || r.height < 200) return;
      if (r.left < rightThreshold) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;

      results.push(img);
    });

    // If nothing on the right, fall back to any large image inside a
    // container with data-viewer-type (the one stable behavioral attribute).
    if (results.length === 0) {
      document.querySelectorAll("[data-viewer-type] img").forEach((img) => {
        if (img.closest(".occi-has-btn")) return;
        if (!img.src || img.naturalWidth === 0) return;
        const r = img.getBoundingClientRect();
        if (r.width < 150 || r.height < 150) return;
        results.push(img);
      });
    }

    return results;
  }

  // --- Find a suitable parent to anchor the button ---

  function findImageContainer(img) {
    let el = img.parentElement;
    const imgRect = img.getBoundingClientRect();

    for (let i = 0; i < 5 && el; i++) {
      const r = el.getBoundingClientRect();
      const sameWidth = Math.abs(r.width - imgRect.width) < 40;
      const sameHeight = Math.abs(r.height - imgRect.height) < 40;
      if (sameWidth && sameHeight) return el;

      const pos = window.getComputedStyle(el).position;
      if (pos === "relative" || pos === "absolute") return el;

      el = el.parentElement;
    }

    return img.parentElement;
  }

  // --- Button creation & state ---

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

  // --- Copy / download handler ---

  let busy = false;

  async function handleCopyClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (busy) return;
    busy = true;

    const btn = e.currentTarget;

    // The button's _targetImg holds a reference to the image it was created for.
    // Re-resolve in case the src updated (Google lazy-loads the full-res image).
    const img = btn._targetImg;
    if (!img || !img.src || !img.isConnected) {
      showButtonState(btn, "error");
      busy = false;
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "fetchImage",
        src: img.src,
      });

      if (!response?.success) {
        throw new Error(response?.error || "Fetch failed");
      }

      if (response.isGif) {
        const dlResult = await chrome.runtime.sendMessage({
          action: "downloadGif",
          src: response.resolvedUrl || img.src,
          filename: response.filename,
        });

        if (!dlResult?.success) {
          throw new Error(dlResult?.error || "Download failed");
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

  // --- Inject buttons ---

  function attachButton(img) {
    const container = findImageContainer(img);
    if (!container) return;

    const pos = window.getComputedStyle(container).position;
    if (pos === "static") container.style.position = "relative";

    container.classList.add("occi-has-btn");

    const btn = createCopyButton();
    btn._targetImg = img;
    container.appendChild(btn);
    btn.classList.add("occi-visible");
  }

  function scanAndAttach() {
    if (!isGoogleImagesPage()) return;

    for (const img of findPreviewImages()) {
      attachButton(img);
    }
  }

  // --- MutationObserver (throttled) ---

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
