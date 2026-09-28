import { defineConfig } from "@playwright/test";

// End-to-end acceptance test. Needs a running app connected to a TEST Supabase
// project and an approved user:
//   E2E_BASE_URL=http://localhost:3000 E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e
// Optionally PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium.
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    timezoneId: "Asia/Kolkata",
    permissions: ["clipboard-read", "clipboard-write"],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
    actionTimeout: 20_000,
    trace: "retain-on-failure",
  },
});
