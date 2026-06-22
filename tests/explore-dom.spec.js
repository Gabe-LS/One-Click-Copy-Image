const { test, expect, chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const EXTENSION_PATH = path.join(__dirname, "..", "extension");
const USER_DATA_DIR = path.join(__dirname, "..", ".chrome-profile");

test("extension copies image from Google Images preview", async () => {
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
      "--disable-default-apps",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    viewport: { width: 1440, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  page.on("console", (msg) => {
    if (msg.text().includes("One-Click Copy Image")) {
      console.log("EXT:", msg.text());
    }
  });

  await page.goto("https://www.google.com/search?q=cats&udm=2");
  await page.waitForLoadState("domcontentloaded");

  // Handle cookie consent
  const consentBtn = page.locator(
    'button:has-text("Accept all"), button:has-text("Accetta tutto"), button:has-text("I agree"), button[id="L2AGLb"]'
  );
  if (await consentBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consentBtn.first().click();
    await page.waitForTimeout(1000);
    await page.goto("https://www.google.com/search?q=cats&udm=2");
  }

  await page.waitForSelector("img.YQ4gaf", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Find clickable grid images
  const gridImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll("img");
    const results = [];
    imgs.forEach((img) => {
      const rect = img.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 100 && rect.x >= 0 && rect.x < 800 && rect.y >= 200) {
        results.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      }
    });
    return results;
  });

  expect(gridImages.length).toBeGreaterThan(2);

  // Test 1: Click an image and copy it
  const target = gridImages[Math.min(2, gridImages.length - 1)];
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "screenshots/01-preview-panel.png" });

  // Verify copy button appears
  const copyBtn = page.locator(".occi-copy-btn.occi-visible").first();
  await expect(copyBtn).toBeVisible({ timeout: 5000 });

  // Click copy and verify success
  await copyBtn.click();
  await page.waitForFunction(
    () => document.querySelector(".occi-copy-btn.occi-success") !== null,
    { timeout: 15000 }
  );

  await page.screenshot({ path: "screenshots/02-copied.png" });

  const btnText = await copyBtn.textContent();
  expect(btnText).toBe("Copied!");

  // Verify clipboard
  const hasImage = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes("image/png")) return true;
    }
    return false;
  });
  expect(hasImage).toBe(true);

  console.log("Image successfully copied to clipboard!");

  // Test 2: Click a different image and copy that too
  const target2 = gridImages[Math.min(5, gridImages.length - 1)];
  await page.mouse.click(target2.x, target2.y);
  await page.waitForTimeout(3000);

  const copyBtn2 = page.locator(".occi-copy-btn.occi-visible").first();
  if (await copyBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await copyBtn2.click();
    await page.waitForFunction(
      () => document.querySelector(".occi-copy-btn.occi-success") !== null,
      { timeout: 15000 }
    ).catch(() => {});

    const btn2Text = await copyBtn2.textContent().catch(() => "?");
    console.log(`Second image copy result: "${btn2Text}"`);
  }

  await page.screenshot({ path: "screenshots/03-second-image.png" });

  await page.waitForTimeout(3000);
  await context.close();
});
