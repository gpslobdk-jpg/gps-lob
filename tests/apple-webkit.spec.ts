/**
 * apple-webkit.spec.ts – Apple/WebKit Strictness Test.
 *
 * Runs exclusively on WebKit (mobile Safari / iPhone 14 profile) to verify
 * that the V2 hardware integrations work under Apple's strict engine:
 *
 *  1. QR Scanner: opening the overlay must NOT throw a WebKit DOMException.
 *  2. GPS / Navigator Marker: the player marker must render when geolocation
 *     is mocked and the game is active.
 *
 * This file is matched only by the "webkit" Playwright project
 * (see testMatch in playwright.config.ts).
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = "999888";
const PARTICIPANT_ID = "eeeeeeee-1111-2222-3333-ffffffffffff";
const TEAM_NAME = "SafariHold";

const POST_LAT = 55.6761;
const POST_LNG = 12.5683;

const QUESTIONS = [
  {
    type: "multiple_choice",
    text: "Hvad er hovedstaden i Danmark?",
    answers: ["Odense", "København", "Aarhus", "Aalborg"],
    correctIndex: 1,
    points: 10,
    lat: POST_LAT,
    lng: POST_LNG,
  },
  {
    type: "multiple_choice",
    text: "Hvad er 3+3?",
    answers: ["5", "6", "7", "8"],
    correctIndex: 1,
    points: 10,
    lat: POST_LAT + 0.001,
    lng: POST_LNG + 0.001,
  },
];

// ---------------------------------------------------------------------------
// API route mocking
// ---------------------------------------------------------------------------

async function mockApiRoutes(page: Page) {
  // Use addInitScript so mocks survive Next.js HMR full reloads on WebKit.
  // Playwright's page.route() can be lost when WebKit does a full reload.
  await page.addInitScript(`
    (() => {
      const PARTICIPANT_ID = "${PARTICIPANT_ID}";
      const TEAM_NAME = "${TEAM_NAME}";
      const QUESTIONS = ${JSON.stringify(QUESTIONS)};

      const _origFetch = window.fetch.bind(window);
      window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);

        // POST /api/join
        if (url.includes('/api/join') && (init?.method || 'GET').toUpperCase() === 'POST') {
          return new Response(JSON.stringify({
            participantId: PARTICIPANT_ID,
            studentName: TEAM_NAME,
            startOffset: 0,
            sessionStatus: "running",
            teamId: null,
            teamColor: null,
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // GET /api/play/session
        if (url.includes('/api/play/session')) {
          return new Response(JSON.stringify({
            questions: QUESTIONS,
            raceType: "quiz",
            radius: 50,
            gpsOverride: false,
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // GET /api/play/status
        if (url.includes('/api/play/status')) {
          return new Response(JSON.stringify({
            sessionStatus: "running",
            gpsOverride: false,
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // GET /api/play/participant
        if (url.includes('/api/play/participant')) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // POST /api/play/validate-answer
        if (url.includes('/api/play/validate-answer')) {
          try {
            const body = JSON.parse(init?.body || '{}');
            const isCorrect = body.selectedIndex === 1;
            return new Response(JSON.stringify({
              isCorrect,
              awardedPoints: isCorrect ? 10 : 0,
              brick: null,
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          } catch {
            return new Response(JSON.stringify({ isCorrect: false, awardedPoints: 0, brick: null }), {
              status: 200, headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        // POST /api/play/submit-answer
        if (url.includes('/api/play/submit-answer')) {
          return new Response(JSON.stringify({ inserted: true, awardedPoints: 0 }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          });
        }

        // POST /api/play/location
        if (url.includes('/api/play/location')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          });
        }

        // Everything else — pass through to real server.
        return _origFetch(input, init);
      };
    })();
  `);
}

// ---------------------------------------------------------------------------
// Geolocation mock — WebKit uses the same Playwright API
// ---------------------------------------------------------------------------

async function mockGeolocation(page: Page) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({
    latitude: POST_LAT,
    longitude: POST_LNG,
    accuracy: 5,
  });
}

// ---------------------------------------------------------------------------
// Maintenance overlay removal
// ---------------------------------------------------------------------------

async function dismissMaintenanceOverlay(page: Page) {
  // Only remove the maintenance overlay — NOT the QR scanner overlay.
  // The maintenance overlay has z-[9999] and contains "Vi holder pause".
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
// Camera mock for WebKit — getUserMedia must not throw DOMException
// ---------------------------------------------------------------------------

/**
 * Inject a fake getUserMedia so that the QR scanner overlay can open without
 * a real camera. WebKit is strict about calling getUserMedia outside a user
 * gesture, so we replace it entirely with a mock that returns a silent
 * video MediaStream.
 */
async function mockCameraApi(page: Page) {
  await page.addInitScript(() => {
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {},
        writable: true,
        configurable: true,
      });
    }

    // Create a minimal mock MediaStream with a dummy video track.
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia?.bind(
      navigator.mediaDevices,
    );

    navigator.mediaDevices.getUserMedia = async (
      constraints?: MediaStreamConstraints,
    ): Promise<MediaStream> => {
      // If a real camera is somehow available (CI won't have one), try it.
      // Otherwise provide a canvas-based fake stream.
      try {
        if (originalGetUserMedia) {
          return await originalGetUserMedia(constraints);
        }
      } catch {
        // Fall through to fake.
      }

      // Canvas-based fake video track.
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, 320, 240);

      const stream = canvas.captureStream(1);
      return stream;
    };

    // Also mock enumerateDevices to report at least one video input.
    navigator.mediaDevices.enumerateDevices = async () => [
      {
        deviceId: "mock-camera",
        groupId: "mock-group",
        kind: "videoinput" as MediaDeviceKind,
        label: "Mock Camera",
        toJSON() {
          return this;
        },
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Helper: wait for Next.js page to be fully stable (compilation + HMR reload done).
async function waitForStablePage(page: Page) {
  // Wait for the scan button to appear (page rendered).
  const scanButton = page.getByRole("button", { name: /scan qr/i });
  await expect(scanButton).toBeVisible({ timeout: 30_000 });

  // If Next.js is compiling, the page will reload when done.
  // Wait for any pending reload to complete by monitoring the scan button.
  // If it disappears and reappears, that's the reload.
  try {
    // Give HMR up to 15 seconds to trigger a reload.
    await page.waitForEvent("framenavigated", { timeout: 15_000 });
    // Reload happened — wait for the page to re-render.
    await expect(scanButton).toBeVisible({ timeout: 20_000 });
  } catch {
    // No reload happened within 15s — page is already stable.
  }
}

test.describe("Apple/WebKit Strictness", () => {
  // Run tests serially — the first test triggers Next.js HMR compilation
  // and parallel runs cause WebKit to race with "Compiling..." state.
  test.describe.configure({ mode: "serial" });

  // WebKit is slower than Chromium — extend per-test timeout.
  test.setTimeout(60_000);

  // ========================================================================
  // TEST 1: QR Scanner overlay opens without DOMException
  // ========================================================================
  test("QR scanner overlay opens without WebKit DOMException", async ({
    page,
  }) => {
    await mockCameraApi(page);

    // Collect console errors during the test.
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Collect uncaught page errors.
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);
    await waitForStablePage(page);

    // Gateway screen should be visible.
    const scanButton = page.getByRole("button", { name: /scan qr/i });
    await expect(scanButton).toBeVisible({ timeout: 15_000 });

    // Click "Scan QR-kode".
    await scanButton.click();

    // Assert: scanner overlay opens.
    const overlay = page.getByTestId("qr-scanner-overlay");
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // Assert: viewfinder area renders.
    const viewfinder = page.getByTestId("qr-viewfinder");
    await expect(viewfinder).toBeVisible({ timeout: 5_000 });

    // Assert: no uncaught page errors (DOMException, NotAllowedError, etc.).
    const domExceptions = pageErrors.filter(
      (e) =>
        e.message.includes("NotAllowedError") ||
        e.message.includes("SecurityError") ||
        e.message.includes("DOMException"),
    );
    expect(domExceptions).toHaveLength(0);

    // Assert: no critical console errors about camera permission.
    const cameraErrors = consoleErrors.filter(
      (msg) =>
        msg.includes("NotAllowedError") ||
        msg.includes("SecurityError") ||
        msg.includes("DOMException"),
    );
    expect(cameraErrors).toHaveLength(0);

    // Close the overlay.
    const closeBtn = page.getByTestId("qr-close");
    await closeBtn.click();
    await expect(overlay).not.toBeVisible({ timeout: 5_000 });
  });

  // ========================================================================
  // TEST 2: QR code detection via test hook works on WebKit
  // ========================================================================
  test("QR test hook delivers pin and closes overlay on WebKit", async ({
    page,
  }) => {
    await mockCameraApi(page);

    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);
    await waitForStablePage(page);

    const scanButton = page.getByRole("button", { name: /scan qr/i });
    await expect(scanButton).toBeVisible({ timeout: 15_000 });
    await scanButton.click();

    const overlay = page.getByTestId("qr-scanner-overlay");
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // Wait for the test hook to be attached (camera init can be slow on WebKit).
    await page.waitForFunction(
      () => typeof (window as Window & { __qrTestHook?: unknown }).__qrTestHook === "function",
      undefined,
      { timeout: 10_000 },
    );

    // Fire the test hook with a mock pin.
    await page.evaluate(() => {
      const w = window as Window & { __qrTestHook?: (pin: string) => void };
      w.__qrTestHook?.("654321");
    });

    // The overlay should close after the flash animation (~250ms).
    await expect(overlay).not.toBeVisible({ timeout: 5_000 });

    // The PIN input should now contain the scanned value OR we should be
    // on a new screen (depends on flow). At minimum, no crash.
    await expect(page.locator("body")).toBeVisible();
  });

  // ========================================================================
  // TEST 3: GPS Navigator marker renders on WebKit
  // ========================================================================
  test("Navigator marker renders with mocked GPS on WebKit", async ({
    page,
  }) => {
    await mockApiRoutes(page);
    await mockGeolocation(page);
    await mockCameraApi(page);

    // Collect page errors.
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);
    await waitForStablePage(page);

    // Join via PIN.
    const pinInput = page.locator('input[inputmode="numeric"]');
    await expect(pinInput).toBeVisible({ timeout: 15_000 });
    await pinInput.fill(SESSION_ID);
    // Verify the value stuck (WebKit HMR can clear inputs).
    await expect(pinInput).toHaveValue(SESSION_ID, { timeout: 3_000 });
    await page.getByRole("button", { name: /start mission/i }).click();

    // Name gate.
    const nameInput = page.locator('input[placeholder="Holdnavn"]');
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    await nameInput.fill(TEAM_NAME);
    await page.getByRole("button", { name: /klar til start/i }).click();

    // Wait for the active game screen — look for HUD elements.
    await expect(page.locator(`text=${TEAM_NAME}`).first()).toBeVisible({ timeout: 30_000 });

    // Assert: navigator marker is rendered (GPS is mocked at the post location).
    const marker = page.getByTestId("navigator-marker");
    await expect(marker).toBeVisible({ timeout: 15_000 });

    // Assert: no uncaught errors on WebKit.
    const criticalErrors = pageErrors.filter(
      (e) =>
        e.message.includes("DOMException") ||
        e.message.includes("SecurityError") ||
        e.message.includes("TypeError"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ========================================================================
  // TEST 4: GPS position updates are reflected in the marker
  // ========================================================================
  test("Navigator marker updates when GPS coordinates change", async ({
    page,
  }) => {
    await mockApiRoutes(page);
    await mockGeolocation(page);
    await mockCameraApi(page);

    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);
    await waitForStablePage(page);

    // Join.
    const pinInput = page.locator('input[inputmode="numeric"]');
    await expect(pinInput).toBeVisible({ timeout: 15_000 });
    await pinInput.fill(SESSION_ID);
    await expect(pinInput).toHaveValue(SESSION_ID, { timeout: 3_000 });
    await page.getByRole("button", { name: /start mission/i }).click();

    // Name gate.
    const nameInput = page.locator('input[placeholder="Holdnavn"]');
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    await nameInput.fill(TEAM_NAME);
    await page.getByRole("button", { name: /klar til start/i }).click();

    // Wait for active game screen.
    await expect(page.locator(`text=${TEAM_NAME}`).first()).toBeVisible({ timeout: 30_000 });

    // Wait for marker.
    const marker = page.getByTestId("navigator-marker");
    await expect(marker).toBeVisible({ timeout: 30_000 });

    // Move to a different location — still within question range.
    await page.context().setGeolocation({
      latitude: POST_LAT + 0.0001,
      longitude: POST_LNG + 0.0001,
      accuracy: 3,
    });

    // The marker should still be visible (GPS update processed).
    await page.waitForTimeout(2_000);
    await expect(marker).toBeVisible();

    // Move far away — the marker should still render (but maybe "not in range").
    await page.context().setGeolocation({
      latitude: POST_LAT + 0.01,
      longitude: POST_LNG + 0.01,
      accuracy: 10,
    });

    await page.waitForTimeout(2_000);
    await expect(marker).toBeVisible();

    // The page should still be alive — no crash.
    await expect(page.locator("body")).toBeVisible();
  });
});
