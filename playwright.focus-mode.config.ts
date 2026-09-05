import { defineConfig, devices } from "@playwright/test";

import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: /focus-mode-(?:student|lifecycle)\.spec\.ts$/,
  outputDir: "artifacts/focus-mode-device-tests",
  projects: [
    { name: "focus-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "focus-android", use: { ...devices["Pixel 7"] } },
    { name: "focus-safari", use: { ...devices["iPhone 14"] } },
  ],
});
