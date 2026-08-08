import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: externalBaseUrl ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      use: { ...devices["iPhone 14"] },
      testMatch: /apple-webkit\.spec\.ts$/,
    },
    // Separate project for new iOS-readiness tests (ios-*.spec.ts).
    // Uses the same WebKit / iPhone 14 device profile as the webkit project
    // but matches a different set of files so both can coexist and be run
    // independently with --project=ios or --project=webkit.
    {
      name: "ios",
      use: { ...devices["iPhone 14"] },
      testMatch: /ios-.*\.spec\.ts$/,
    },
  ],
  webServer: externalBaseUrl ? undefined : {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
