import os from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.LYNBYGGER_TEST_BASE_URL ?? "http://localhost:3218";
const port = new URL(baseURL).port || "3218";
const localAuthUrl = process.env.LYNBYGGER_TEST_AUTH_URL ?? "http://127.0.0.1:54330";

if (process.env.LYNBYGGER_TEST_MODE !== "true") {
  throw new Error("Lynbygger-browsertesten kræver LYNBYGGER_TEST_MODE=true.");
}

if (!["localhost", "127.0.0.1", "::1"].includes(new URL(baseURL).hostname)) {
  throw new Error("Lynbygger-browsertesten må kun køre mod localhost.");
}
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(localAuthUrl).hostname)) {
  throw new Error("Lynbygger-auth-stubben må kun køre på localhost.");
}

export default defineConfig({
  testDir: "./tests",
  testMatch: /lynbygger-(contract|handoff|visual)\.spec\.ts$/,
  timeout: 90_000,
  globalTimeout: 10 * 60_000,
  outputDir: path.join(os.tmpdir(), "skolegps-lynbygger-playwright"),
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "node scripts/lynbygger/local-auth-stub.mjs",
      url: `${localAuthUrl}/health`,
      reuseExistingServer: false,
      timeout: 20_000,
      env: {
        ...process.env,
        LYNBYGGER_TEST_MODE: "true",
        LYNBYGGER_TEST_BASE_URL: baseURL,
      },
    },
    {
      command: `npm.cmd run start -- --port ${port}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        LYNBYGGER_TEST_MODE: "true",
        NEXT_PUBLIC_SUPABASE_URL: localAuthUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-lynbygger-test-anon-key",
        OPENAI_API_KEY: "local-lynbygger-test-placeholder",
      },
    },
  ],
});
