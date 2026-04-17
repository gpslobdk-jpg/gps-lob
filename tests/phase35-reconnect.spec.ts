/**
 * phase35-reconnect.spec.ts – Phase 35: Seamless Reconnect UX
 *
 * Verifies:
 *  1. When a returning participant hits a 401 on snapshot fetch, the
 *     ErrorScreen shows the reassuring Danish message.
 *  2. The button text reads "Fortsæt spillet" (not generic "Prøv igen").
 *  3. Clicking that button actually fires a retry network request — proving
 *     the circuit breaker is reset and the button is no longer dead.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// Block service workers so context.route() intercepts GET requests reliably.
test.use({ serviceWorkers: "block" });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SESSION_ID = "123456";
const MOCK_PARTICIPANT_ID = "aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb";
const MOCK_TEAM_NAME = "TestHold";

const STORED_PARTICIPANT = {
  participantId: MOCK_PARTICIPANT_ID,
  sessionId: MOCK_SESSION_ID,
  studentName: MOCK_TEAM_NAME,
  startOffset: 0,
  savedAt: new Date().toISOString(),
  teamId: null,
  teamColor: null,
  avatarUrl: null,
  sessionStatus: "running",
  hasCompletedAvatarGate: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed localStorage with a stored participant so the auth hook enters the
 * "restoring" flow instead of "name_gate".
 */
async function seedLocalStorage(page: Page) {
  await page.addInitScript((stored) => {
    window.localStorage.setItem("gpslob_active_participant", JSON.stringify(stored));
  }, STORED_PARTICIPANT);
}

/**
 * Set up API route mocks.
 *
 * Initial state:
 *  - /api/join           → 200 (rebind succeeds, used by recoverAuth fallback)
 *  - /api/play/participant → 401 (triggers circuit breaker in fetchSnapshot)
 *  - /api/play/status      → 200 running
 *  - /api/play/session     → 200 with empty questions (not needed for error path)
 *  - /api/play/location    → 200
 */
async function mockApiRoutes(page: Page) {
  const ctx = page.context();

  // POST /api/join → rebind success (recoverAuth fallback path uses this)
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

  // GET /api/play/participant → 401 (triggers circuit breaker)
  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Deltager-login mangler eller er udløbet.",
      }),
    });
  });

  // GET /api/play/status → running
  await ctx.route(/\/api\/play\/status/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionStatus: "running", gpsOverride: false }),
    });
  });

  // GET /api/play/session → minimal payload
  await ctx.route(/\/api\/play\/session/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: [],
        raceType: "quiz",
        radius: 50,
        gpsOverride: false,
      }),
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

/**
 * Remove the maintenance overlay that may block interactions.
 */
async function dismissMaintenanceOverlay(page: Page) {
  await page.addStyleTag({
    content: `
      div[class*="fixed"][class*="inset-0"][class*="z-"] {
        display: none !important;
        pointer-events: none !important;
      }
    `,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Phase 35 – Reconnect UX after 401", () => {
  // Warm up: navigate once to trigger Next.js compilation / HMR before tests.
  test.beforeEach(async ({ page }) => {
    await page.goto("/play/v2-test");
    // Wait for the Gateway PIN input to confirm compilation is done.
    await page.locator('input[inputmode="numeric"]').waitFor({ state: "visible", timeout: 30_000 });
  });

  test("shows reassuring message and working Fortsæt spillet button on auth expiry", async ({
    page,
  }) => {
    // 1. Seed localStorage with a stored participant BEFORE navigation.
    await seedLocalStorage(page);

    // 2. Set up API mocks (participant endpoint returns 401).
    await mockApiRoutes(page);

    // 3. Navigate to the v2 test harness (fresh load with seeded localStorage).
    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);

    // 4. Enter the session ID on the Gateway screen to trigger the auth flow.
    //    The gateway has a PIN input. Entering the mock session ID will set
    //    joinedSessionId → usePlayAuth fires → finds stored participant →
    //    restore flow → recoverAuth (Supabase refresh fails, /api/join fallback
    //    succeeds → authOk = true) → fetchSnapshot → 401 → circuit breaker.
    const pinInput = page.locator('input[inputmode="numeric"]');
    await pinInput.waitFor({ state: "visible", timeout: 15_000 });
    // Use pressSequentially for React controlled input (fill can miss onChange).
    await pinInput.pressSequentially(MOCK_SESSION_ID, { delay: 50 });
    // Click the submit button instead of relying on Enter.
    await page.getByRole("button", { name: "Start mission" }).click();

    // 5. Wait for the ErrorScreen to appear with the reassuring message.
    const errorMessage = page.locator("text=Hov! Forbindelsen blev afbrudt");
    await expect(errorMessage).toBeVisible({ timeout: 20_000 });

    // 6. Assert the full reassuring text is present.
    await expect(
      page.locator("text=alt dit fremskridt er gemt"),
    ).toBeVisible();

    // 7. Assert the button says "Fortsæt spillet" (not generic "Prøv igen").
    const retryButton = page.getByRole("button", { name: "Fortsæt spillet" });
    await expect(retryButton).toBeVisible();

    // Ensure the generic "Prøv igen" button is NOT visible.
    await expect(
      page.getByRole("button", { name: "Prøv igen" }),
    ).not.toBeVisible();

    // 8. Prepare to capture retry network traffic.
    //    After clicking "Fortsæt spillet", the circuit breaker should be reset
    //    and restoreParticipant should fire — which calls recoverAuth →
    //    /api/join (because Supabase refresh fails in test).
    //    If the circuit breaker was NOT reset, no request would be made at all.
    const retryRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/join") && req.method() === "POST",
      { timeout: 10_000 },
    );

    // 9. Click the retry button.
    await retryButton.click();

    // 10. Assert that a network request actually fired — proving the circuit
    //     breaker was successfully reset and the button is alive.
    const retryRequest = await retryRequestPromise;
    expect(retryRequest).toBeTruthy();
    expect(retryRequest.method()).toBe("POST");
  });
});
