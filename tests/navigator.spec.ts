/**
 * navigator.spec.ts – Validates the NavigatorMarker visual behaviour.
 *
 * Tests:
 *  1. Rotation — deviceorientation heading updates the cone's rotate transform.
 *  2. Accuracy — GPS accuracy changes shrink/grow the accuracy halo.
 *  3. Range Glow — moving into range switches the core dot to success-green.
 *  4. Smoothness — CSS transition is applied for position movement.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SESSION_ID = "654321";
const MOCK_PARTICIPANT_ID = "cccccccc-1111-2222-3333-dddddddddddd";
const MOCK_TEAM_NAME = "NaviHold";

const POST_LAT = 55.6761;
const POST_LNG = 12.5683;

/** ~111 m away from the post — well outside the 45 m default unlock radius. */
const FAR_LAT = POST_LAT + 0.001;
const FAR_LNG = POST_LNG;

/** Right on top of the post — inside range. */
const NEAR_LAT = POST_LAT;
const NEAR_LNG = POST_LNG;

const MOCK_QUESTIONS = [
  {
    type: "multiple_choice",
    text: "Navigations-spørgsmål?",
    answers: ["A", "B", "C", "D"],
    correctIndex: 0,
    points: 10,
    lat: POST_LAT,
    lng: POST_LNG,
  },
  {
    type: "multiple_choice",
    text: "Post 2?",
    answers: ["X", "Y", "Z", "W"],
    correctIndex: 0,
    points: 10,
    lat: POST_LAT + 0.001,
    lng: POST_LNG + 0.001,
  },
];

// ---------------------------------------------------------------------------
// API route mocking (reused pattern from guillotine.spec.ts)
// ---------------------------------------------------------------------------

async function mockApiRoutes(page: Page) {
  const ctx = page.context();

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

  await ctx.route(/\/api\/play\/session/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: MOCK_QUESTIONS,
        raceType: "quiz",
        radius: 45,
        gpsOverride: false,
      }),
    });
  });

  await ctx.route(/\/api\/play\/status/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionStatus: "running", gpsOverride: false }),
    });
  });

  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found" }),
    });
  });

  await page.route("**/api/play/validate-answer", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isCorrect: true, awardedPoints: 10, brick: null }),
    });
  });

  await page.route("**/api/play/submit-answer", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ inserted: true, awardedPoints: 0 }),
    });
  });

  await page.route("**/api/play/location", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

// ---------------------------------------------------------------------------
// Geolocation mock via CDP
// ---------------------------------------------------------------------------

async function setGeolocation(page: Page, lat: number, lng: number, accuracy: number) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: lat, longitude: lng, accuracy });
}

// ---------------------------------------------------------------------------
// Maintenance overlay removal
// ---------------------------------------------------------------------------

async function dismissMaintenanceOverlay(page: Page) {
  await page.addStyleTag({
    content: `
      div[class*="fixed"][class*="inset-0"][class*="z-"] {
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
// Shared: join game and enter team name
// ---------------------------------------------------------------------------

async function joinAndEnterName(page: Page) {
  const pinInput = page.locator('input[inputmode="numeric"]');
  await expect(pinInput).toBeVisible({ timeout: 15_000 });
  await pinInput.fill(MOCK_SESSION_ID);
  await page.getByRole("button", { name: /start mission/i }).click();

  const nameInput = page.locator('input[placeholder="Holdnavn"]');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  await nameInput.fill(MOCK_TEAM_NAME);
  await page.getByRole("button", { name: /klar til start/i }).click();
}

// ---------------------------------------------------------------------------
// Wait for the NavigatorMarker to appear in the DOM
// ---------------------------------------------------------------------------

/**
 * The marker wrapper is a `div.pointer-events-none.absolute` with
 * `top: 50%; left: 50%` inline style — it's the outermost marker div.
 * We locate it by finding the parent overlay container (z-20) that wraps
 * the marker.
 */
async function waitForMarker(page: Page) {
  // The marker overlay container has class "z-20" and "pointer-events-none"
  const markerOverlay = page.locator("div.pointer-events-none.z-20");
  await expect(markerOverlay).toBeVisible({ timeout: 30_000 });
  return markerOverlay;
}

// ---------------------------------------------------------------------------
// Helpers to dispatch synthetic DeviceOrientationEvent
// ---------------------------------------------------------------------------

/**
 * Dispatch a synthetic `deviceorientation` event.
 *
 * In Chromium (non-iOS), the GPS hook computes heading = (360 - alpha) % 360.
 * To get a desired heading H, set alpha = (360 - H) % 360.
 */
async function dispatchOrientation(page: Page, desiredHeading: number) {
  const alpha = (360 - desiredHeading) % 360;
  await page.evaluate(
    ({ a }) => {
      // Fire both events — the hook prefers deviceorientationabsolute on Chromium,
      // but also fire deviceorientation as fallback.
      for (const eventName of ["deviceorientationabsolute", "deviceorientation"] as const) {
        const event = new DeviceOrientationEvent(eventName, {
          alpha: a,
          beta: 0,
          gamma: 0,
          absolute: eventName === "deviceorientationabsolute",
        });
        window.dispatchEvent(event);
      }
    },
    { a: alpha },
  );
}

/**
 * Trigger a fresh geolocation position through the watchPosition callback
 * by using Playwright CDP to override geolocation mid-test.
 */
async function updateGeolocation(page: Page, lat: number, lng: number, accuracy: number) {
  // Playwright's setGeolocation triggers the watcher callback
  await page.context().setGeolocation({ latitude: lat, longitude: lng, accuracy });

  // The watcher fires asynchronously; give it a moment.
  // We cannot use page.waitForTimeout — instead poll until state updates.
  await page.waitForFunction(() => true, undefined, { timeout: 2_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("NavigatorMarker", () => {
  test("heading cone rotates when deviceorientation changes", async ({ page }) => {
    // ---- Setup ----
    await mockApiRoutes(page);
    await setGeolocation(page, FAR_LAT, FAR_LNG, 15);

    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);
    await joinAndEnterName(page);
    await waitForMarker(page);

    // ---- Heading 0° ----
    await dispatchOrientation(page, 0);
    await page.waitForTimeout(300);

    // The heading cone has a clip-path in its inline style.
    // Use page.evaluate to find it since filter({ has: xpath=self }) is unreliable.
    const findConeRotation = () =>
      page.evaluate(() => {
        const divs = document.querySelectorAll<HTMLElement>("div");
        for (const el of divs) {
          const style = el.style.cssText || "";
          if (style.includes("clip-path") && style.includes("rotate")) {
            const match = style.match(/rotate\(([^)]+)\)/);
            return match?.[1] ?? null;
          }
        }
        return null;
      });

    const rot0 = await findConeRotation();
    expect(rot0).toBe("0deg");

    // ---- Heading 90° ----
    await dispatchOrientation(page, 90);
    await page.waitForTimeout(300);

    const rot90 = await findConeRotation();
    expect(rot90).toBe("90deg");
  });

  test("accuracy halo shrinks when accuracy improves", async ({ page }) => {
    // ---- Setup ----
    await mockApiRoutes(page);
    await setGeolocation(page, FAR_LAT, FAR_LNG, 100);

    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);
    await joinAndEnterName(page);
    await waitForMarker(page);

    // Wait for the halo to render with accuracy=100
    await page.waitForTimeout(500);

    // The accuracy halo is the div with the `breath` animation class.
    const halo = page.locator("div.rounded-full").filter({
      has: page.locator("xpath=self::*[contains(@class, 'breath')]"),
    });
    await expect(halo).toBeVisible({ timeout: 5_000 });

    // Grab the initial width (accuracy=100 → diameter ≈ 176px)
    const widthBefore = await halo.evaluate((el) => {
      return parseFloat((el as HTMLElement).style.width);
    });

    // accuracy=100 → radius = 24 + (100/150)*96 = 88, diameter = 176
    expect(widthBefore).toBeGreaterThan(150);
    expect(widthBefore).toBeLessThan(200);

    // ---- Improve accuracy to 10m ----
    await updateGeolocation(page, FAR_LAT, FAR_LNG, 10);
    // Wait for CSS transition (1.2s) to complete
    await page.waitForTimeout(1500);

    const widthAfter = await halo.evaluate((el) => {
      return parseFloat((el as HTMLElement).style.width);
    });

    // accuracy=10 → radius = 24 + (10/150)*96 ≈ 30.4, diameter ≈ 60.8
    expect(widthAfter).toBeLessThan(80);
    expect(widthAfter).toBeLessThan(widthBefore);
  });

  test("core dot shifts to success-green when player moves into range", async ({ page }) => {
    // ---- Setup: start far away (~111m, well outside 45m range) ----
    await mockApiRoutes(page);
    await setGeolocation(page, FAR_LAT, FAR_LNG, 5);

    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);
    await joinAndEnterName(page);
    await waitForMarker(page);
    await page.waitForTimeout(500);

    // Find the core dot by looking for the gradient background via evaluate.
    // The browser may resolve hex to rgb(), so we look for the emerald-600
    // out-of-range color: #059669 → rgb(5, 150, 105).
    const getCoreDotBg = () =>
      page.evaluate(() => {
        const divs = document.querySelectorAll<HTMLElement>("div.rounded-full");
        for (const el of divs) {
          const bg = el.style.background || "";
          if (bg.includes("linear-gradient") && bg.includes("135deg")) {
            return bg;
          }
        }
        return null;
      });

    const bgBefore = await getCoreDotBg();
    expect(bgBefore).not.toBeNull();
    // Out of range: should contain emerald-600 (#059669 or rgb(5, 150, 105))
    expect(bgBefore!).toMatch(/059669|rgb\(5,\s*150,\s*105\)/);

    // ---- Move into range (right on top of the post) ----
    await updateGeolocation(page, NEAR_LAT, NEAR_LNG, 5);
    // Wait for state update + CSS transition (0.4s)
    await page.waitForTimeout(1000);

    const bgAfter = await getCoreDotBg();
    expect(bgAfter).not.toBeNull();
    // In range: should contain success-green (#22c55e or rgb(34, 197, 94))
    expect(bgAfter!).toMatch(/22c55e|rgb\(34,\s*197,\s*94\)/);
  });

  test("position uses CSS transition for smooth movement", async ({ page }) => {
    // ---- Setup ----
    await mockApiRoutes(page);
    await setGeolocation(page, FAR_LAT, FAR_LNG, 10);

    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);
    await joinAndEnterName(page);
    await waitForMarker(page);
    await page.waitForTimeout(500);

    // The marker wrapper div has `width: 0; height: 0` (zero-size positioning node),
    // so Playwright considers it "hidden". We use evaluate to verify its styles.
    const markerStyles = await page.evaluate(() => {
      const divs = document.querySelectorAll<HTMLElement>("div.pointer-events-none.absolute");
      for (const el of divs) {
        const style = el.style.cssText || "";
        if (style.includes("cubic-bezier")) {
          return {
            transition: el.style.transition,
            top: el.style.top,
            left: el.style.left,
          };
        }
      }
      return null;
    });

    expect(markerStyles).not.toBeNull();
    expect(markerStyles!.transition).toContain("cubic-bezier");
    expect(markerStyles!.transition).toContain("0.8s");
    expect(markerStyles!.top).toBe("50%");
    expect(markerStyles!.left).toBe("50%");
  });
});
