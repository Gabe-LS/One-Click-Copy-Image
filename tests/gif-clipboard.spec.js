const { test, expect, chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const EXTENSION_PATH = path.join(__dirname, "..", "extension");
const USER_DATA_DIR = path.join(__dirname, "..", ".chrome-profile");
const INSTALL_SCRIPT = path.join(__dirname, "..", "install-native-host.sh");

test("GIF copied to clipboard via native helper", async () => {
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

  // Discover the extension ID
  const extPage = await context.newPage();
  await extPage.goto("chrome://extensions/");
  await extPage.waitForTimeout(2000);

  const extId = await extPage.evaluate(() => {
    const manager = document.querySelector("extensions-manager");
    if (!manager?.shadowRoot) return null;
    const list = manager.shadowRoot.querySelector("extensions-item-list");
    if (!list?.shadowRoot) return null;
    const items = list.shadowRoot.querySelectorAll("extensions-item");
    for (const item of items) {
      const name = item.shadowRoot?.querySelector("#name")?.textContent?.trim();
      if (name === "One-Click Copy Image") {
        return item.id;
      }
    }
    return null;
  });

  console.log("Extension ID:", extId);
  await extPage.close();

  if (extId) {
    // Install native host for this extension ID
    try {
      execSync(`bash "${INSTALL_SCRIPT}" "${extId}"`, { stdio: "pipe" });
      console.log("Native host installed for", extId);
    } catch (err) {
      console.log("Failed to install native host:", err.message);
    }
  }

  page.on("console", (msg) => {
    if (msg.text().includes("One-Click Copy Image")) {
      console.log("EXT:", msg.text());
    }
  });

  // Search for animated GIFs
  await page.goto(
    "https://www.google.com/search?q=funny+cat+gif&udm=2&tbs=itp:animated"
  );
  await page.waitForLoadState("domcontentloaded");

  const consentBtn = page.locator(
    'button:has-text("Accept all"), button:has-text("Accetta tutto"), button:has-text("I agree"), button[id="L2AGLb"]'
  );
  if (await consentBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consentBtn.first().click();
    await page.waitForTimeout(1000);
    await page.goto(
      "https://www.google.com/search?q=funny+cat+gif&udm=2&tbs=itp:animated"
    );
  }

  await page.waitForSelector("img", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const gridImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll("img");
    const results = [];
    imgs.forEach((img) => {
      const rect = img.getBoundingClientRect();
      if (rect.width > 80 && rect.height > 80 && rect.x >= 0 && rect.x < 800 && rect.y >= 200) {
        results.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      }
    });
    return results;
  });

  expect(gridImages.length).toBeGreaterThan(0);

  const target = gridImages[Math.min(2, gridImages.length - 1)];
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(3000);

  const copyBtn = page.locator(".occi-copy-btn.occi-visible").first();
  await expect(copyBtn).toBeVisible({ timeout: 5000 });

  await copyBtn.click();

  await page.waitForFunction(
    () => document.querySelector(".occi-copy-btn.occi-success") !== null,
    { timeout: 15000 }
  );

  console.log("Button turned green — GIF copy/save succeeded");

  await page.waitForTimeout(2000);
  await context.close();
});
