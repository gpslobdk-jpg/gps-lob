/**
 * offline-survival.spec.ts – The "Dead Forest" Resilience Test.
 *
 * Proves that gpslob.dk survives connectivity dropouts:
 *  1. Student joins a game and reaches a post.
 *  2. Network goes offline (page.context().setOffline(true)).
 *  3. Student clicks a correct answer → no crash, "Venter på sync" shown.
 *  4. Network recovers (setOffline(false)).
 *  5. The queued answer is automatically flushed to /api/play/submit-answer.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = "654321";
const PARTICIPANT_ID = "cccccccc-1111-2222-3333-dddddddddddd";
const TEAM_NAME = "SkovHold";

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
    text: "Hvad er 5+5?",
    answers: ["8", "9", "10", "11"],
    correctIndex: 2,
    points: 10,
    lat: POST_LAT + 0.001,
    lng: POST_LNG + 0.001,
  },
];

// ---------------------------------------------------------------------------
// API route mocking
// ---------------------------------------------------------------------------

async function mockApiRoutes(page: Page) {
  let submitCallCount = 0;
  const submitBodies: unknown[] = [];
  const ctx = page.context();

  // POST /api/join
  await page.route("**/api/join", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participantId: PARTICIPANT_ID,
        studentName: TEAM_NAME,
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
        questions: QUESTIONS,
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

  // GET /api/play/participant
  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found" }),
    });
  });

  // POST /api/play/validate-answer — this will fail when offline
  await page.route("**/api/play/validate-answer", async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    const isCorrect = body.selectedIndex === 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        isCorrect,
        awardedPoints: isCorrect ? 10 : 0,
        brick: null,
      }),
    });
  });

  // POST /api/play/submit-answer — tracks calls for assertion after recovery
  await page.route("**/api/play/submit-answer", async (route: Route) => {
    submitCallCount++;
    const raw = route.request().postData();
    if (raw) submitBodies.push(JSON.parse(raw));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ inserted: true, awardedPoints: 0 }),
    });
  });

  // POST /api/play/location
  await page.route("**/api/play/location", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  return {
    getSubmitCallCount: () => submitCallCount,
    getSubmitBodies: () => submitBodies,
  };
}

// ---------------------------------------------------------------------------
// Geolocation mock
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
// Join + navigate to active game
// ---------------------------------------------------------------------------

async function joinAndReachPost(page: Page) {
  await page.goto(`/play/${SESSION_ID}`, { waitUntil: "networkidle" });
  await dismissMaintenanceOverlay(page);

  // Wait for name gate — enter team name and confirm
  const nameInput = page.getByPlaceholder(/hold|team|navn/i).first();
  if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await nameInput.fill(TEAM_NAME);
    const confirmBtn = page.getByRole("button", { name: /klar|start|deltag|bekræft/i }).first();
    await confirmBtn.click();
  }

  // Wait for game screen — question should appear since GPS puts us in range
  await page.waitForSelector("text=Hvad er hovedstaden", { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("Offline Survival (Dead Forest)", () => {
  test("queues answer while offline and syncs on recovery", async ({ page }) => {
    const mocks = await mockApiRoutes(page);
    await mockGeolocation(page);

    // Step 1: Join and navigate to post
    await joinAndReachPost(page);

    // Assert we can see the answer buttons (OPEN phase)
    const answerB = page.getByRole("button", { name: /København/i });
    await expect(answerB).toBeVisible({ timeout: 5_000 });

    // Step 2: Go offline
    await page.context().setOffline(true);

    // Step 3: Click the correct answer while offline
    await answerB.click();

    // Assert: no crash occurred — the page is still alive
    await expect(page.locator("body")).toBeVisible();

    // Assert: "Venter på sync" message is shown (offline feedback)
    const syncMessage = page.getByTestId("offline-sync-message");
    await expect(syncMessage).toBeVisible({ timeout: 10_000 });
    await expect(syncMessage).toContainText(/sync|gemt lokalt/i);

    // Assert: the submit-answer API was NOT called while offline
    expect(mocks.getSubmitCallCount()).toBe(0);

    // Step 4: Go back online — advance past the RESOLVED overlay first
    const continueBtn = page.getByRole("button", { name: /videre/i });
    await expect(continueBtn).toBeVisible({ timeout: 5_000 });
    await continueBtn.click();

    await page.context().setOffline(false);

    // Step 5: Wait for the offline sync loop to flush (polls every 10s, but
    // also fires on 'online' event — should be near-instant).
    await page.waitForTimeout(3_000);

    // Assert: the queued answer was synced
    expect(mocks.getSubmitCallCount()).toBeGreaterThanOrEqual(1);

    // Assert: the payload includes the right session and post info
    const bodies = mocks.getSubmitBodies() as Array<{ payloads?: Array<{ session_id?: string }> }>;
    expect(bodies.length).toBeGreaterThanOrEqual(1);
    const firstPayload = bodies[0]?.payloads?.[0];
    expect(firstPayload?.session_id).toBe(SESSION_ID);
  });

  test("shows offline indicator badge in HUD when answers are pending", async ({ page }) => {
    await mockApiRoutes(page);
    await mockGeolocation(page);

    await joinAndReachPost(page);

    // No offline indicator initially
    const indicator = page.getByTestId("offline-indicator");
    await expect(indicator).not.toBeVisible({ timeout: 3_000 });

    // Go offline and submit
    await page.context().setOffline(true);
    const answerB = page.getByRole("button", { name: /København/i });
    await answerB.click();

    // Advance past resolved overlay
    const continueBtn = page.getByRole("button", { name: /videre/i });
    await expect(continueBtn).toBeVisible({ timeout: 10_000 });
    await continueBtn.click();

    // The offline indicator should now be visible in the HUD
    await expect(indicator).toBeVisible({ timeout: 5_000 });

    // Recover — indicator should disappear after sync
    await page.context().setOffline(false);
    await expect(indicator).not.toBeVisible({ timeout: 15_000 });
  });
});
