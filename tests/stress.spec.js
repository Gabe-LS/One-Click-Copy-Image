const { test, expect, chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const EXTENSION_PATH = path.join(__dirname, "..", "extension");
const USER_DATA_DIR = path.join(__dirname, "..", ".chrome-profile");

const SEARCHES = [
  "cats", "dogs", "sunset", "car", "guitar",
  "ocean", "mountain", "fish", "coffee", "butterfly",
];

function randomDelay(min, max) {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

test("button placement: 10 searches, 1 image each", async () => {
  test.setTimeout(300000);

  if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run", "--disable-default-apps",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    viewport: { width: 1440, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());

  // Close any unexpected tabs
  context.on("page", async (newPage) => {
    const url = newPage.url();
    console.log(`  NEW TAB DETECTED: ${url} — closing it`);
    await newPage.close();
  });

  // First load + consent
  await page.goto("https://www.google.com/search?q=cats&udm=2");
  await page.waitForLoadState("domcontentloaded");
  const consentBtn = page.locator(
    'button:has-text("Accept all"), button:has-text("Accetta tutto"), button:has-text("I agree"), button[id="L2AGLb"]'
  );
  if (await consentBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await consentBtn.first().click();
    await randomDelay(2000, 3000);
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < SEARCHES.length; i++) {
    const query = SEARCHES[i];
    console.log(`\n[${i + 1}/${SEARCHES.length}] "${query}"`);

    // Navigate by editing the URL in the same tab
    await page.evaluate((q) => {
      window.location.href = `/search?q=${encodeURIComponent(q)}&udm=2`;
    }, query);
    await page.waitForLoadState("domcontentloaded");

    // Wait for grid images
    const hasGrid = await page.waitForFunction(
      () => {
        const imgs = document.querySelectorAll("img");
        let count = 0;
        for (const img of imgs) {
          const r = img.getBoundingClientRect();
          if (r.width > 80 && r.height > 80 && r.x >= 0 && r.x < 800 && r.y >= 150) count++;
        }
        return count >= 5;
      },
      { timeout: 15000 }
    ).then(() => true).catch(() => false);

    if (!hasGrid) {
      console.log("  No grid — skipped");
      continue;
    }

    await randomDelay(2000, 4000);

    // Pick a random grid image (skip first 2 which are often special)
    const clickTarget = await page.evaluate(() => {
      const imgs = [];
      document.querySelectorAll("img").forEach((img) => {
        const r = img.getBoundingClientRect();
        if (r.width > 80 && r.height > 80 && r.x >= 0 && r.x < 800 && r.y >= 150) {
          imgs.push({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
        }
      });
      const start = Math.min(2, imgs.length - 1);
      const idx = start + Math.floor(Math.random() * Math.min(8, imgs.length - start));
      return imgs[idx] || imgs[start] || null;
    });

    if (!clickTarget) {
      console.log("  No clickable image — skipped");
      continue;
    }

    await page.mouse.click(clickTarget.x, clickTarget.y);
    await randomDelay(2000, 4000);

    // Verify: exactly 1 visible button, inside the right-side preview panel
    const result = await page.evaluate(() => {
      const allBtns = [...document.querySelectorAll(".occi-copy-btn")];
      const visible = allBtns.filter((b) => b.classList.contains("occi-visible"));

      if (visible.length === 0) return { status: "no_button" };
      if (visible.length > 1) return { status: "multiple", count: visible.length };

      const btn = visible[0];
      const panel = btn.closest("[data-viewer-type]");
      if (!panel) return { status: "not_in_panel" };

      const pr = panel.getBoundingClientRect();
      if (pr.left < window.innerWidth * 0.4) return { status: "panel_on_left" };

      return { status: "ok" };
    });

    if (result.status === "ok") {
      ok++;
      console.log("  OK");
    } else {
      fail++;
      console.log(`  FAIL: ${JSON.stringify(result)}`);
    }

    await randomDelay(2000, 5000);
  }

  console.log(`\n===== ${ok} ok / ${fail} fail / ${SEARCHES.length} total =====\n`);

  expect(fail).toBe(0);
  expect(ok).toBeGreaterThan(SEARCHES.length * 0.5);

  await context.close();
});
