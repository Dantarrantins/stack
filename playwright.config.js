// Smoke tests: build to dist/, serve it, and tap through the core flows on a phone-sized screen.
const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "tests",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 390, height: 844 },
    ...(process.env.CHROME ? { launchOptions: { executablePath: process.env.CHROME } } : {})
  },
  webServer: { command: "python3 -m http.server 4173 --directory dist", port: 4173, reuseExistingServer: !process.env.CI, stdout: "ignore", stderr: "ignore" }
});
