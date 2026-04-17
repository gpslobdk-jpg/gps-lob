/**
 * qr-scanner.spec.ts – Validates the Instant-QR Scanner overlay.
 *
 * This test:
 *  1. Navigates to the v2 play test harness.
 *  2. Clicks "Scan QR-kode" to open the scanner overlay.
 *  3. Asserts the pulsing scan-frame is visible.
 *  4. Injects a fake QR detection via the `window.__qrTestHook` escape hatch.
 *  5. Asserts:
 *     - The flash overlay is triggered.
 *     - The scanner overlay is removed.
 *     - The UI transitions to the name_gate (team-name input visible).
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Chromium launch args — fake camera feed + auto-accept permissions
// ---------------------------------------------------------------------------

test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PIN = "123456";
const MOCK_PARTICIPANT_ID = "aaaaaaaa-1111-2222-3333-cccccccccccc";
const MOCK_TEAM_NAME = "ScanHold";

// ---------------------------------------------------------------------------
// API route mocking
// ---------------------------------------------------------------------------

async function mockApiRoutes(page: Page) {
  const ctx = page.context();

  // POST /api/join → provision participant
  await page.route("**/api/join", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participantId: MOCK_PARTICIPANT_ID,
        studentName: MOCK_TEAM_NAME,
        startOffset: 0,
        sessionStatus: "running",
        teamId: null,
        teamColor: null,
      }),
    });
  });

  // GET /api/play/session
  await ctx.route(/\/api\/play\/session/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: [
          {
            type: "multiple_choice",
            text: "Test-spørgsmål",
            answers: ["A", "B"],
            correctIndex: 0,
            points: 10,
            lat: 55.6761,
            lng: 12.5683,
          },
        ],
        raceType: "quiz",
        radius: 50,
        gpsOverride: false,
      }),
    });
  });

  // GET /api/play/status
  await ctx.route(/\/api\/play\/status/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionStatus: "running",
        gpsOverride: false,
      }),
    });
  });

  // GET /api/play/participant — 404 = new participant
  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found" }),
    });
  });

  // POST /api/play/location → 200
  await page.route("**/api/play/location", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

// ---------------------------------------------------------------------------
// Maintenance overlay removal
// ---------------------------------------------------------------------------

async function dismissMaintenanceOverlay(page: Page) {
  await page.addStyleTag({
    content: `
      div[class*="fixed"][class*="inset-0"][class*="z-"]:not([data-testid="qr-scanner-overlay"]):not([data-testid="qr-flash"]) {
        display: none !important;
        pointer-events: none !important;
      }
    `,
  });
  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((el) => {
      const cls = el.className || "";
      if (typeof cls === "string" && cls.includes("fixed") && cls.includes("inset-0")) {
        const text = el.textContent || "";
        if (text.includes("lukke siden ned") || text.includes("Vi holder pause")) {
          el.remove();
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("QR Scanner Overlay", () => {
  test("scan QR → flash → overlay closes → lands on name gate", async ({ page }) => {
    // ---- Setup ----
    await mockApiRoutes(page);
    await page.context().grantPermissions(["camera"]);

    // ---- Step 1: Navigate to test harness ----
    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);

    // ---- Step 2: Open the scanner ----
    const scanButton = page.getByRole("button", { name: /scan qr/i });
    await expect(scanButton).toBeVisible({ timeout: 15_000 });
    await scanButton.click();

    // ---- Step 3: Assert scanner overlay & pulsing frame ----
    const overlay = page.locator('[data-testid="qr-scanner-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    const scanFrame = page.locator('[data-testid="qr-scan-frame"]');
    await expect(scanFrame).toBeVisible({ timeout: 5_000 });

    // Verify the scan-pulse animation is applied via inline class.
    const hasPulseAnimation = await scanFrame.evaluate((el) => {
      const cls = el.className || "";
      return cls.includes("scan-pulse");
    });
    expect(hasPulseAnimation).toBe(true);

    // ---- Step 4: Wait for the camera to initialize ----
    // The test hook is only attached once the isOpen effect runs.
    await page.waitForFunction(
      () => typeof (window as Window & { __qrTestHook?: unknown }).__qrTestHook === "function",
      undefined,
      { timeout: 10_000 },
    );

    // ---- Step 5: Simulate QR detection via the test hook ----
    await page.evaluate((pin) => {
      (window as Window & { __qrTestHook?: (p: string) => void }).__qrTestHook!(pin);
    }, MOCK_PIN);

    // ---- Step 6: Assert the flash overlay appears ----
    const flash = page.locator('[data-testid="qr-flash"]');
    await expect(flash).toBeVisible({ timeout: 2_000 });

    // ---- Step 7: Assert the scanner overlay is removed ----
    await expect(overlay).toBeHidden({ timeout: 5_000 });

    // ---- Step 8: Assert we landed on the name gate ----
    const nameInput = page.locator('input[placeholder="Holdnavn"]');
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
  });

  test("close button dismisses scanner without navigation", async ({ page }) => {
    // ---- Setup ----
    await mockApiRoutes(page);
    await page.context().grantPermissions(["camera"]);

    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);

    // Open scanner.
    const scanButton = page.getByRole("button", { name: /scan qr/i });
    await expect(scanButton).toBeVisible({ timeout: 15_000 });
    await scanButton.click();

    const overlay = page.locator('[data-testid="qr-scanner-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    // Close via the X button.
    const closeBtn = page.locator('[data-testid="qr-close"]');
    await closeBtn.click();

    // Overlay gone.
    await expect(overlay).toBeHidden({ timeout: 3_000 });

    // Still on gateway — PIN input is visible.
    const pinInput = page.locator('input[inputmode="numeric"]');
    await expect(pinInput).toBeVisible({ timeout: 5_000 });
  });
});
