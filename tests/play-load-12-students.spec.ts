/**
 * play-load-12-students.spec.ts – Race Condition: "post 2 dukkede aldrig op"
 *
 * Reproducerer den lærer-rapporterede fejl fra produktion:
 *
 *   "I en klasse på 12 elever oplevede alle, at post nr. 2 ikke dukkede op,
 *    naar de havde svaret på den første post. De kunne ikke komme videre.
 *    WiFi blev slaaet fra undervejs."
 *
 * ROOT CAUSE (identificeret ved kode-analyse):
 *  GameState.tsx `handleAnswer()`:
 *    1. `markAnsweredPostIndex(currentPostIndex)` saettes SYNKRONT (foer await)
 *       => `answeredPostIndexes[0] = true` => React re-render
 *       => `isCurrentPostAnswered = true`
 *    2. PlayInterface.tsx useEffect (linje 251):
 *       `if (showQuestion && isCurrentPostAnswered) { dismissCurrentPost() }`
 *       Spoergsmålet LUKKES automatisk, quizAnswerFeedback ryddes.
 *    3. `await insertAnswerRecord(...)` looper offline (WiFi er slukket)
 *    4. Naar online igen: `setSolvedPostIndexes` + `setQuizAnswerFeedback({tone:"success"})`
 *    5. MEN `isCurrentPostAnswered` er allerede `true` (fra trin 1)
 *       => `!isCurrentPostAnswered && hasActiveQuizSuccess` = false
 *       => "Gaa til naeste post"-knap vises ALDRIG
 *       => Eleven er fastlaast paa en tom skaerm
 */

import { test, expect, type Page, type Route, type BrowserContext } from "@playwright/test";

// Brug samme session-ID som global-setup præ-kompilerer
// (tests/global-setup.ts: WARMUP_URL = /play/resilience-session-001)
// så .next-chunks allerede er kompileret og "Afstand"-HUD vises inden for 20s.
const SESSION_ID = "resilience-session-001";
const PARTICIPANT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEAM_NAME = "TestElev";

const POST_1_LAT = 55.6761;
const POST_1_LNG = 12.5683;

const POST_2_LAT = 55.6772;
const POST_2_LNG = 12.5695;

const QUIZ_QUESTIONS = [
  {
    type: "multiple_choice",
    text: "Hvad er 3+3?",
    answers: ["4", "5", "6", "7"],
    correctIndex: 2,
    points: 10,
    lat: POST_1_LAT,
    lng: POST_1_LNG,
  },
  {
    type: "multiple_choice",
    text: "Hvad er 4+4?",
    answers: ["6", "7", "8", "9"],
    correctIndex: 2,
    points: 10,
    lat: POST_2_LAT,
    lng: POST_2_LNG,
  },
];

type MockState = { submitCallCount: number };

async function mountApiMocks(ctx: BrowserContext, mockState: MockState) {
  // Clear localStorage before navigation to prevent stale restore loops from prior test runs.
  await ctx.addInitScript(() => { localStorage.clear(); });

  await ctx.routeWebSocket(/webpack-hmr/, (ws) => { ws.close(); });
  await ctx.route(/supabase.*realtime|realtime\/v1\/websocket/i, async (route: Route) => {
    await route.abort("connectionrefused");
  });
  // Stub all Supabase REST/auth calls to avoid hangs when Supabase is unreachable.
  await ctx.route(/supabase\.co\/(auth|rest)\//i, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
  // Supabase REST API queries (e.g. from("answers").select) – return empty array.
  await ctx.route(/xodrzahqdgbsssntupjt\.supabase\.co\/rest\//i, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
  // Supabase Auth API calls – return null session so auth doesn't block rendering.
  await ctx.route(/xodrzahqdgbsssntupjt\.supabase\.co\/auth\//i, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: null, session: null, user: null }) });
  });
  await ctx.route(/\/api\/join/, async (route: Route) => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ participantId: PARTICIPANT_ID, studentName: TEAM_NAME, startOffset: 0, sessionStatus: "running", teamId: null, teamColor: null }),
    });
  });
  await ctx.route(/\/api\/play\/session/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ questions: QUIZ_QUESTIONS, raceType: "quiz", radius: 30, gpsOverride: true }),
    });
  });
  await ctx.route(/\/api\/play\/status/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionStatus: "running", gpsOverride: true }),
    });
  });
  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    // Return a valid (fresh) participant so the restore flow completes cleanly.
    // 404 here causes scheduleRestoreRetry() → isRestoringParticipant=true forever.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participant: {
          id: PARTICIPANT_ID,
          session_id: SESSION_ID,
          student_name: TEAM_NAME,
          lat: POST_1_LAT,
          lng: POST_1_LNG,
          accuracy: 8,
          finished_at: null,
          start_offset: 0,
          run_started_at: null,
        },
      }),
    });
  });
  await ctx.route(/\/api\/play\/location/, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await ctx.route(/\/api\/play\/submit-answer/, async (route: Route) => {
    mockState.submitCallCount++;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ inserted: true, awardedPoints: 10 }) });
  });
  await ctx.route(/\/api\/play\/validate-answer/, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isCorrect: true, awardedPoints: 10, brick: null }) });
  });
  await ctx.route(/\/api\/play\/auth\/refresh/, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

async function setGPS(ctx: BrowserContext, lat: number, lng: number, accuracy = 8) {
  await ctx.setGeolocation({ latitude: lat, longitude: lng, accuracy });
}

async function dismissMaintenanceOverlay(page: Page): Promise<void> {
  await page.addStyleTag({ content: `div[class*="fixed"][class*="inset-0"][class*="z-"] { display: none !important; pointer-events: none !important; }` });
  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((el) => {
      const cls = typeof el.className === "string" ? el.className : "";
      if (cls.includes("fixed") && cls.includes("inset-0")) {
        const text = el.textContent ?? "";
        if (text.includes("lukke siden ned") || text.includes("Vi holder pause")) el.remove();
      }
    });
  });
}

async function joinAndWaitForMap(page: Page) {
  await page.goto(`/play/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
  await dismissMaintenanceOverlay(page);

  // waitForSelector retries (unlike isVisible which is point-in-time).
  // Cold .next compile can take 60-90s before React hydrates and name gate appears.
  const nameInputEl = await page
    .waitForSelector('[placeholder*="hold"],[placeholder*="team"],[placeholder*="navn"]', { timeout: 150_000 })
    .catch(async () => {
      await page.screenshot({ path: "test-results/debug-no-name-gate.png", fullPage: true });
      const bodyText = await page.locator("body").innerText().catch(() => "(failed)");
      throw new Error(`Name gate not visible within 150s. Page text: ${bodyText.slice(0, 500)}`);
    });
  await nameInputEl.fill(TEAM_NAME);
  await page.getByRole("button", { name: /klar|start|deltag|bekræft/i }).first().click();

  // Wait for the active HUD ("Afstand" card). Session fetch is mocked → near-instant.
  const afstandVisible = await page.waitForSelector("text=Afstand", { timeout: 30_000 }).then(() => true).catch(() => false);
  if (!afstandVisible) {
    await page.screenshot({ path: "test-results/debug-after-name-confirm.png", fullPage: true });
    const bodyText = await page.locator("body").innerText().catch(() => "(failed)");
    throw new Error(`"Afstand" not visible 30s after name confirm. Page text: ${bodyText.slice(0, 800)}`);
  }
}

async function readPlaySnapshot(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("gpslob_active_play_snapshot");
    if (!raw) return null;
    try { return JSON.parse(raw) as { sessionId?: string; currentPostIndex?: number; solvedPostIndexes?: number[]; answeredPostIndexes?: number[]; score?: number }; }
    catch { return null; }
  });
}

test.describe("Race condition: offline-svar paa post 1 => post 2 vises ikke", () => {
  test(
    "Gaa til naeste post-knap vises efter offline-svar paa post 1 (quiz race condition)",
    async ({ browser }) => {
      test.setTimeout(240_000);
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const mockState: MockState = { submitCallCount: 0 };

      try {
        await ctx.grantPermissions(["geolocation"]);
        await setGPS(ctx, POST_1_LAT, POST_1_LNG);
        await mountApiMocks(ctx, mockState);

        await joinAndWaitForMap(page);

        // Trigger GPS hits. Med gpsOverride=true vil unlockCurrentPost() lykkes
        // (den tjekker gpsOverride || distance>radius — gpsOverride bypasser GPS-kravet).
        // 2 hits kræves af AUTO_UNLOCK_CONFIRMATION_HITS.
        await setGPS(ctx, POST_1_LAT, POST_1_LNG);
        await page.waitForTimeout(300);
        await setGPS(ctx, POST_1_LAT, POST_1_LNG);

        // Fallback: med gpsOverride=true er "Åbn posten"-knappen synlig.
        // Klik den hvis GPS auto-unlock ikke trak inden for 3s.
        const questionAlreadyOpen = await page
          .waitForSelector('text=/Hvad er 3/', { timeout: 3_000 })
          .then(() => true).catch(() => false);
        if (!questionAlreadyOpen) {
          const openBtn = page.getByRole("button", { name: /åbn posten|åbn opgave|god mode|lås op/i }).first();
          if (await openBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await openBtn.click();
          }
        }

        // Vent paa GPS auto-unlock / manuelt åbnet spørgsmål
        await expect(page.getByText(/Hvad er 3\+3/, { exact: false })).toBeVisible({ timeout: 15_000 });

        // OFFLINE FØR SVAR
        await ctx.setOffline(true);

        const correctBtn = page.getByRole("button", { name: /^6$/i });
        await expect(correctBtn).toBeVisible({ timeout: 5_000 });
        await correctBtn.click();

        // 3 sekunder offline – insertAnswerRecord looper
        await page.waitForTimeout(3_000);

        // GENOPRET FORBINDELSEN
        await ctx.setOffline(false);
        await setGPS(ctx, POST_2_LAT, POST_2_LNG);

        // Vent paa at API-svar returnerer og UI opdateres
        await page.waitForTimeout(4_000);

        const snapshot = await readPlaySnapshot(page);
        console.log("Snapshot efter offline-svar:", JSON.stringify(snapshot));
        console.log("Submit-kald i alt:", mockState.submitCallCount);

        // ASSERTION: "Gaa til naeste post" knap synlig
        // Brug waitFor({ state: "visible" }) som retrier indtil knappen vises (eller timeout).
        const nextPostBtn = page.getByRole("button", { name: /gaa til naeste post|gå til næste post|næste post|se resultat/i });
        const btnVisible = await nextPostBtn.waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false);

        // Diagnostik: hvad er i DOM-en?
        const allButtons = await page.evaluate(() =>
          Array.from(document.querySelectorAll("button")).map(b => b.textContent?.trim())
        );
        console.log("Knapper i DOM:", JSON.stringify(allButtons));

        await page.screenshot({ path: `test-results/debug-btn-check-${Date.now()}.png`, fullPage: true });

        const snapshotAdvanced = typeof snapshot?.currentPostIndex === "number" && snapshot.currentPostIndex >= 1;

        console.log(`Knap synlig: ${btnVisible} | Snapshot avanceret: ${snapshotAdvanced} | submits: ${mockState.submitCallCount}`);

        expect(
          btnVisible || snapshotAdvanced,
          `RACE CONDITION BUG DETECTED:\n` +
          `"Gaa til naeste post"-knap: ${btnVisible}\n` +
          `snapshot.currentPostIndex: ${snapshot?.currentPostIndex ?? "null"}\n` +
          `submits: ${mockState.submitCallCount}\n\n` +
          `ROOT CAUSE: markAnsweredPostIndex() saettes synkront i handleAnswer() INDEN insertAnswerRecord() returnerer.\n` +
          `isCurrentPostAnswered=true trigges useEffect => dismissCurrentPost() => showQuestion=false.\n` +
          `Naar insertAnswerRecord returnerer, er showQuestion=false => "Gaa til naeste post" vises ALDRIG.\n\n` +
          `FIX: Se GameState.tsx handleAnswer() + PlayInterface.tsx useEffect linje 251.`
        ).toBe(true);

        expect(mockState.submitCallCount).toBeGreaterThanOrEqual(1);

        if (btnVisible) {
          await nextPostBtn.click();
          await page.waitForTimeout(2_000);
          const snapshotAfter = await readPlaySnapshot(page);
          expect(snapshotAfter?.currentPostIndex).toBeGreaterThanOrEqual(1);
        }
      } finally {
        await ctx.close();
      }
    }
  );
});
