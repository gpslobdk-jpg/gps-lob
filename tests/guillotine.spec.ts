/**
 * guillotine.spec.ts – Validates the synchronous guillotine pattern.
 *
 * The "guillotine" means: when a student clicks an answer, buttons are removed
 * from the DOM **synchronously** in the same React render tick. A second click
 * on any other answer must be impossible because the buttons no longer exist.
 *
 * This test:
 *  1. Navigates to the v2 play interface.
 *  2. Mocks all API routes so the game loads instantly.
 *  3. Mocks the Geolocation API so the student is at Post 1.
 *  4. Joins a game and enters a team name.
 *  5. Clicks a wrong answer.
 *  6. Immediately attempts to click another answer.
 *  7. Asserts:  buttons gone, "Sender svar…" visible, no double-submit.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SESSION_ID = "123456";
const MOCK_PARTICIPANT_ID = "aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb";
const MOCK_TEAM_NAME = "TestHold";

/** Post 1 location — the geolocation mock uses the same coordinates. */
const POST_LAT = 55.6761;
const POST_LNG = 12.5683;

const MOCK_QUESTIONS = [
  {
    type: "multiple_choice",
    text: "Hvad er 2+2?",
    answers: ["3", "4", "5", "6"],
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
  let validateCallCount = 0;
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

  // GET /api/play/session — use context.route to intercept service worker requests
  await ctx.route(/\/api\/play\/session/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: MOCK_QUESTIONS,
        raceType: "quiz",
        radius: 50,
        gpsOverride: false,
      }),
    });
  });

  // GET /api/play/status — use context.route to intercept service worker requests
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

  // GET /api/play/participant — use context.route to intercept service worker requests
  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found" }),
    });
  });

  // POST /api/play/validate-answer — delays response to keep SUBMITTING state visible
  await page.route("**/api/play/validate-answer", async (route: Route) => {
    validateCallCount++;
    await new Promise((r) => setTimeout(r, 1500));
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

  // POST /api/play/submit-answer → success
  await page.route("**/api/play/submit-answer", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ inserted: true, awardedPoints: 0 }),
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

  return {
    getValidateCallCount: () => validateCallCount,
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
// Maintenance overlay removal – survives React re-renders
// ---------------------------------------------------------------------------

/**
 * Remove the maintenance overlay AFTER navigation.
 * Uses two approaches: CSS to hide it + JS to remove it from DOM.
 */
async function dismissMaintenanceOverlay(page: Page) {
  // CSS approach: broad selector to hide the fixed overlay.
  await page.addStyleTag({
    content: `
      div[class*="fixed"][class*="inset-0"][class*="z-"] {
        display: none !important;
        pointer-events: none !important;
      }
    `,
  });
  // JS approach: forcefully remove the overlay element.
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
// Shared setup: join game and enter team name
// ---------------------------------------------------------------------------

async function joinAndEnterName(page: Page) {
  // Gateway screen — enter PIN
  const pinInput = page.locator('input[inputmode="numeric"]');
  await expect(pinInput).toBeVisible({ timeout: 15_000 });
  await pinInput.fill(MOCK_SESSION_ID);
  await page.getByRole("button", { name: /start mission/i }).click();

  // Name gate — enter team name
  const nameInput = page.locator('input[placeholder="Holdnavn"]');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  await nameInput.fill(MOCK_TEAM_NAME);
  await page.getByRole("button", { name: /klar til start/i }).click();
}

// ---------------------------------------------------------------------------
// Wait for the question to appear
// ---------------------------------------------------------------------------

async function waitForQuestion(page: Page, questionText: string) {
  const questionHeading = page.locator("h2", { hasText: questionText });
  await expect(questionHeading).toBeVisible({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("Synchronous Guillotine Pattern", () => {
  test("clicking an answer immediately removes all buttons and shows submitting state", async ({
    page,
  }) => {
    // ---- Setup ----
    const api = await mockApiRoutes(page);
    await mockGeolocation(page);

    // ---- Step 1: Navigate to v2 test page ----
    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);

    // ---- Step 2-3: Join + name ----
    await joinAndEnterName(page);

    // ---- Step 4: Wait for the active game screen → question ----
    await waitForQuestion(page, "Hvad er 2+2?");

    // ---- Step 5: Verify answer buttons exist ----
    // The answer container has buttons with "text-left" in their class.
    const quizButtons = page.locator('button.text-left');
    await expect(quizButtons).toHaveCount(4, { timeout: 10_000 });

    // Locate button A (index 0 — wrong answer) and button B (index 1).
    const buttonA = quizButtons.nth(0);
    const buttonB = quizButtons.nth(1);
    await expect(buttonA).toBeVisible();
    await expect(buttonB).toBeVisible();

    // ---- Step 6: THE GUILLOTINE TEST ----
    // Click the wrong answer (A).
    await buttonA.click();

    // Assert: no answer buttons remain in the DOM.
    await expect(quizButtons).toHaveCount(0, { timeout: 1_000 });

    // Assert: "Sender svar…" loading state is visible.
    const submittingText = page.locator("text=Sender svar");
    await expect(submittingText).toBeVisible({ timeout: 1_000 });

    // Attempt the spam-click — this should be a no-op because buttons are gone.
    const spamClicked = await buttonB.isVisible().catch(() => false);
    expect(spamClicked).toBe(false);

    // ---- Step 7: Wait for RESOLVED state ----
    // The mocked validate-answer delays 1.5 s, after which RESOLVED appears.
    const resolvedText = page.locator("text=Desværre, forkert svar");
    await expect(resolvedText).toBeVisible({ timeout: 5_000 });

    // Assert: the validate-answer API was called exactly ONCE (no double-submit).
    expect(api.getValidateCallCount()).toBe(1);

    // Assert: the "Videre" button is now visible.
    const continueButton = page.getByRole("button", { name: /videre/i });
    await expect(continueButton).toBeVisible();
  });

  test("rapid double-click on two different answers only submits once", async ({
    page,
  }) => {
    // ---- Setup ----
    const api = await mockApiRoutes(page);
    await mockGeolocation(page);

    // ---- Navigate + join + name ----
    await page.goto("/play/v2-test");
    await dismissMaintenanceOverlay(page);
    await joinAndEnterName(page);

    // ---- Wait for question ----
    await waitForQuestion(page, "Hvad er 2+2?");

    const answerButtons2 = page.locator('button.text-left');
    await expect(answerButtons2).toHaveCount(4, { timeout: 10_000 });

    // ---- Rapid fire: click A then immediately dispatchEvent on B ----
    // Use page.evaluate to perform BOTH clicks synchronously in the browser,
    // simulating a rapid double-tap.
    const doubleSubmitResult = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btnA = buttons.find((b) => b.textContent?.trim().startsWith("A"));
      const btnB = buttons.find((b) => b.textContent?.trim().startsWith("B"));
      if (!btnA || !btnB) return { error: "buttons not found" };

      // Click A.
      btnA.click();

      // Immediately try to click B.
      // React's synchronous guillotine should have already removed B from the DOM.
      const bStillInDom = document.body.contains(btnB);
      btnB.click(); // this should be a no-op

      return { bStillInDom };
    });

    // B should be detached from DOM after A's click handler ran.
    expect(doubleSubmitResult).toEqual({ bStillInDom: false });

    // "Sender svar…" should be showing.
    const submittingText = page.locator("text=Sender svar");
    await expect(submittingText).toBeVisible({ timeout: 1_000 });

    // Wait for RESOLVED.
    const resolvedText = page.locator("text=Desværre, forkert svar");
    await expect(resolvedText).toBeVisible({ timeout: 5_000 });

    // Only ONE validate-answer call.
    expect(api.getValidateCallCount()).toBe(1);
  });
});
