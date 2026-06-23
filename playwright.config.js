const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    headless: false,
    viewport: { width: 1440, height: 900 },
  },
});
