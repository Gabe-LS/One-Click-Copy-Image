(() => {
  "use strict";

  const COPY_ICON = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

  function isGoogleImagesPage() {
    const params = new URLSearchParams(window.location.search);
    return params.get("udm") === "2" || params.get("tbm") === "isch";
  }

  function createCopyButton() {
    const btn = document.createElement("button");
    btn.className = "occi-copy-btn";
    btn.innerHTML = COPY_ICON + "<span>Copy</span>";
    btn.title = "Copy image to clipboard (GIFs are saved to Downloads)";
    btn.addEventListener("click", handleCopyClick);
    return btn;
  }

  function showButtonState(btn, state) {
    btn.classList.remove("occi-success", "occi-error");
    if (state === "success") {
      btn.classList.add("occi-success");
    } else if (state === "error") {
      btn.classList.add("occi-error");
    }
    clearTimeout(btn._resetTimer);
    if (state) {
      btn._resetTimer = setTimeout(() => showButtonState(btn, null), 2000);
    }
  }

  function findPreviewImage(panel) {
    const fullImg = panel.querySelector('img[jsname="kn3ccd"]');
    if (fullImg && fullImg.src && !fullImg.src.startsWith("data:") && fullImg.naturalWidth > 0) {
      return fullImg;
    }

    const thumbImg = panel.querySelector('img[jsname="JuXqh"]');
    if (thumbImg && thumbImg.src && thumbImg.naturalWidth > 0) {
      return thumbImg;
    }

    const candidates = panel.querySelectorAll("img.sFlh5c");
    for (const img of candidates) {
      if (img.naturalWidth > 0 && img.src) return img;
    }

    return null;
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function handleCopyClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const btn = e.currentTarget;
    const panel = btn.closest('div[jsname="H9tDt"], div.hh1Ztf') || btn.parentElement;
    const img = findPreviewImage(panel);

    if (!img) {
      showButtonState(btn, "error");
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
          filename: response.filename || "image.gif",
        });

        if (!dlResult?.success) {
          throw new Error(dlResult?.error || "Download failed");
        }
      } else {
        const pngBytes = base64ToBytes(response.pngBase64);
        const pngBlob = new Blob([pngBytes], { type: "image/png" });

        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
      }

      showButtonState(btn, "success");
    } catch (err) {
      console.error("[One-Click Copy Image]", err);
      showButtonState(btn, "error");
    }
  }

  function attachButtonToPanel(panel) {
    if (panel.querySelector(".occi-copy-btn")) return;

    const imgContainer = panel.querySelector('div[jsname="figiqf"], div.p7sI2');
    if (!imgContainer) return;

    const computed = window.getComputedStyle(imgContainer);
    if (computed.position === "static") {
      imgContainer.style.position = "relative";
    }

    const btn = createCopyButton();
    imgContainer.appendChild(btn);
    btn.classList.add("occi-visible");
  }

  function scanAndAttach() {
    if (!isGoogleImagesPage()) return;

    const panels = document.querySelectorAll(
      'div[jsname="H9tDt"][data-viewer-type], div.hh1Ztf[data-viewer-type]'
    );

    panels.forEach((panel) => {
      const rect = panel.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 100) {
        attachButtonToPanel(panel);
      }
    });
  }

  let scanTimer = null;
  const observer = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = requestAnimationFrame(() => {
      scanTimer = null;
      scanAndAttach();
    });
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    scanAndAttach();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
      scanAndAttach();
    });
  }
})();
