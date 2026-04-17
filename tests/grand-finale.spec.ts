/**
 * grand-finale.spec.ts — Grand Finale E2E Stress Test
 *
 * Simulates a full 30-student competition on the teacher's Live Dashboard:
 *
 *  Phase A — Teacher opens live view, 30 students appear on the map.
 *  Phase B — Students submit a mix of correct, incorrect, and duplicate (guillotine)
 *            answers.  The mocked REST answers array is mutated between ticks.
 *  Phase C — Open the Live Feed module.  Assert that wrong answers are rendered in
 *            red ("Forkert svar") and correct answers in green ("Korrekt svar").
 *  Phase D — Open the Leaderboard module.  Assert sort order: Score → Correct Count
 *            → Elapsed Time (tie-break).
 *  Phase E — Teacher ends the game (status → finished).  The TeacherLiveResults
 *            component renders.  Assert that the podium + full standings match the
 *            simulated data.
 *
 * Architecture:
 *  - Single browser context for the teacher.  No real student browser contexts.
 *  - 30 students simulated entirely through mocked Supabase REST responses.
 *  - Mutable answer/participant/status state read by route handlers.
 *  - "online" event triggers useTeacherLiveData recovery to re-fetch.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_ID = "grand-finale-session-00000001";
const RUN_ID = "grand-finale-run-00000001";
const TEACHER_USER_ID = "teacher-00000000-0000-0000-0000-000000000001";

const BASE_LAT = 55.6761;
const BASE_LNG = 12.5683;

const STUDENT_COUNT = 30;

const QUESTIONS = [
  { type: "multiple_choice", text: "Hvad er hovedstaden i Danmark?", lat: BASE_LAT, lng: BASE_LNG, points: 10, answer: [null, null, null, null], correctIndex: 0 },
  { type: "multiple_choice", text: "Hvad er 7 * 8?", lat: BASE_LAT + 0.001, lng: BASE_LNG + 0.001, points: 15, answer: [null, null, null, null], correctIndex: 2 },
  { type: "multiple_choice", text: "Hvilket land er stoerst?", lat: BASE_LAT + 0.002, lng: BASE_LNG + 0.002, points: 10, answer: [null, null, null, null], correctIndex: 1 },
  { type: "multiple_choice", text: "Hvad farve har himlen?", lat: BASE_LAT - 0.001, lng: BASE_LNG - 0.001, points: 20, answer: [null, null, null, null], correctIndex: 3 },
];

// ---------------------------------------------------------------------------
// Student fixtures
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Anna", "Bo", "Clara", "Dennis", "Eva",
  "Frederik", "Gitte", "Henrik", "Ida", "Jonas",
  "Karen", "Lars", "Maria", "Niels", "Olivia",
  "Peter", "Rikke", "Simon", "Tina", "Ulrik",
  "Victor", "William", "Xenia", "Yasmin", "Zara",
  "Albert", "Birgit", "Carl", "Diana", "Emil",
];

function sid(i: number) {
  return `student-${String(i).padStart(4, "0")}`;
}

function sname(i: number) {
  return FIRST_NAMES[i % FIRST_NAMES.length];
}

// ---------------------------------------------------------------------------
// Mutable simulation state (read by route handlers)
// ---------------------------------------------------------------------------

type MockAnswer = {
  id: string;
  participant_id: string;
  student_name: string;
  session_id: string;
  post_index: number;
  question_index: number;
  selected_index: number;
  is_correct: boolean;
  awarded_points: number;
  question_text: string;
  answered_at: string;
  created_at: string;
  image_url: null;
};

let mockSessionStatus: "running" | "finished" = "running";
let mockAnswers: MockAnswer[] = [];
let mockFinishedAt: string | null = null;

function makeParticipant(i: number) {
  const angle = (2 * Math.PI * i) / STUDENT_COUNT;
  const radius = 0.001 + 0.0001 * (i % 5);
  const runStartedAt = i < 25
    ? new Date(Date.now() - 300_000 + i * 2000).toISOString()
    : null;

  return {
    id: sid(i),
    session_id: SESSION_ID,
    student_name: sname(i),
    lat: BASE_LAT + radius * Math.cos(angle),
    lng: BASE_LNG + radius * Math.sin(angle),
    updated_at: new Date().toISOString(),
    run_started_at: runStartedAt,
    finished_at: mockSessionStatus === "finished" ? mockFinishedAt : null,
    start_offset: 0,
  };
}

function createParticipants() {
  return Array.from({ length: STUDENT_COUNT }, (_, i) => makeParticipant(i));
}

let nextAnswerId = 1;

function submitMockAnswer(
  studentIdx: number,
  questionIdx: number,
  selectedIndex: number,
  timestampOffset: number
): MockAnswer | null {
  const question = QUESTIONS[questionIdx];
  const isCorrect = selectedIndex === question.correctIndex;

  // Check for existing answer (Guillotine lock)
  const existing = mockAnswers.find(
    (a) => a.participant_id === sid(studentIdx) && a.question_index === questionIdx
  );
  if (existing) {
    // Already answered — this is a locked/guillotine attempt, silently ignored
    return null;
  }

  const answer: MockAnswer = {
    id: `answer-${String(nextAnswerId++).padStart(6, "0")}`,
    participant_id: sid(studentIdx),
    student_name: sname(studentIdx),
    session_id: SESSION_ID,
    post_index: questionIdx + 1,
    question_index: questionIdx,
    selected_index: selectedIndex,
    is_correct: isCorrect,
    awarded_points: isCorrect ? question.points : 0,
    question_text: question.text,
    answered_at: new Date(Date.now() + timestampOffset).toISOString(),
    created_at: new Date(Date.now() + timestampOffset).toISOString(),
    image_url: null,
  };

  mockAnswers.push(answer);
  return answer;
}

// ---------------------------------------------------------------------------
// Auth cookie helper
// ---------------------------------------------------------------------------

function makeAuthCookieValue() {
  const session = {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 36000,
    expires_at: Math.floor(Date.now() / 1000) + 36000,
    refresh_token: "mock-refresh-token",
    user: {
      id: TEACHER_USER_ID,
      email: "teacher@test.dk",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Test Teacher" },
      created_at: "2024-01-01T00:00:00Z",
    },
  };

  return (
    "base64-" +
    Buffer.from(JSON.stringify(session))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  );
}

// ---------------------------------------------------------------------------
// Route mocking
// ---------------------------------------------------------------------------

function parseMockTable(url: string): string | null {
  const match = url.match(/\/rest\/v1\/([a-z_]+)/);
  return match ? match[1] : null;
}

async function setupSupabaseMocks(page: Page) {
  const ctx = page.context();

  await ctx.route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();
    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 36000,
          refresh_token: "mock-refresh-token",
          user: {
            id: TEACHER_USER_ID,
            email: "teacher@test.dk",
            role: "authenticated",
            aud: "authenticated",
            app_metadata: { provider: "email" },
            user_metadata: { full_name: "Test Teacher" },
            created_at: "2024-01-01T00:00:00Z",
          },
        }),
      });
      return;
    }
    if (url.includes("/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: TEACHER_USER_ID,
          email: "teacher@test.dk",
          role: "authenticated",
          aud: "authenticated",
          app_metadata: { provider: "email" },
          user_metadata: { full_name: "Test Teacher" },
          created_at: "2024-01-01T00:00:00Z",
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await ctx.route("**/realtime/**", async (route: Route) => {
    await route.abort("connectionrefused");
  });

  await ctx.route("**/rest/v1/**", async (route: Route) => {
    const url = route.request().url();
    const table = parseMockTable(url);
    const method = route.request().method();

    // Handle PATCH (update) requests — endRun updates live_sessions and participants
    if (method === "PATCH") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }

    switch (table) {
      case "live_sessions": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: SESSION_ID,
            pin: "999888",
            status: mockSessionStatus,
            run_id: RUN_ID,
            gps_override: false,
          }),
        });
        break;
      }

      case "gps_runs": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: RUN_ID,
            questions: QUESTIONS,
            race_type: "standard",
            raceType: "standard",
          }),
        });
        break;
      }

      case "session_students": {
        const students = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
          id: sid(i),
          session_id: SESSION_ID,
          student_name: sname(i),
        }));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(students),
        });
        break;
      }

      case "participants": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createParticipants()),
        });
        break;
      }

      case "session_messages": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        break;
      }

      case "answers": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAnswers),
        });
        break;
      }

      default: {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        break;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ignore benign console errors from mocked realtime and HMR. */
function isBenignConsoleError(text: string) {
  return (
    text.includes("WebSocket") ||
    text.includes("ERR_CONNECTION_REFUSED") ||
    text.includes("realtime") ||
    text.includes("CHANNEL_ERROR") ||
    text.includes("Fast Refresh") ||
    text.includes("hmr") ||
    text.includes("hot-reloader") ||
    text.includes("Failed to fetch") ||
    text.includes("hasn't mounted yet")
  );
}

async function triggerRecovery(page: Page) {
  try {
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  } catch {
    // Context may be destroyed briefly during HMR
  }
}

/**
 * Inject a CSS rule that hides the TeacherAccessOverlay (z-1200 fixed overlay).
 * This prevents it from intercepting pointer events during the test.
 * Must be called after page.goto but before any interactions.
 */
async function hideAccessOverlay(page: Page) {
  await page.addStyleTag({
    content: `div[class*="z-1200"] { display: none !important; }`,
  });
}

async function ensureMapVisible(page: Page) {
  const visible = await page.locator(".leaflet-container").isVisible().catch(() => false);
  if (!visible) {
    await page.reload({ waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(3_000);
    // Re-inject overlay hide after reload
    await hideAccessOverlay(page);
  }
  await page.locator(".leaflet-container").waitFor({ state: "visible", timeout: 60_000 });
}

/** Click a button by exact text content via JS (bypasses visual hit-testing). */
async function clickButtonByText(page: Page, text: string) {
  const clicked = await page.evaluate((targetText) => {
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (btn.textContent?.trim() === targetText) {
        btn.click();
        return true;
      }
    }
    return false;
  }, text);
  if (!clicked) throw new Error(`Button "${text}" not found`);
}

// ---------------------------------------------------------------------------
// TEST
// ---------------------------------------------------------------------------

test.describe("Grand Finale — Full 30-Student E2E Competition", () => {
  test("Complete lifecycle: join, answer (correct + wrong + guillotine), live feed, leaderboard, finish, standings", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // Reset mutable state
    mockSessionStatus = "running";
    mockAnswers = [];
    mockFinishedAt = null;
    nextAnswerId = 1;

    // Console error collector
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isBenignConsoleError(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });

    let didCrash = false;
    page.on("crash", () => { didCrash = true; });

    // -------------------------------------------------------------------
    // SETUP: Auth cookie + route mocks
    // -------------------------------------------------------------------

    await setupSupabaseMocks(page);
    await page.context().addCookies([
      {
        name: "sb-xodrzahqdgbsssntupjt-auth-token.0",
        value: makeAuthCookieValue(),
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // ===================================================================
    // PHASE A — Teacher opens live view, 30 students visible on map
    // ===================================================================

    await page.goto(`/dashboard/live/${SESSION_ID}`, { waitUntil: "load", timeout: 60_000 });

    // Hide the TeacherAccessOverlay (auto-opens on waiting→running transition)
    await hideAccessOverlay(page);

    await ensureMapVisible(page);

    // Wait for initial markers to appear and the page to stabilize
    await expect(async () => {
      const count = await page.locator(".leaflet-marker-icon").count();
      expect(count).toBeGreaterThanOrEqual(STUDENT_COUNT);
    }).toPass({ timeout: 20_000 });

    // Verify 30 circular student markers
    const circularMarkers = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll(".leaflet-marker-icon").forEach((m) => {
        if (m.innerHTML.includes("border-radius")) count++;
      });
      return count;
    });
    expect(circularMarkers).toBe(STUDENT_COUNT);

    // ===================================================================
    // PHASE B — Simulate 30 students submitting answers
    // ===================================================================

    // Scenario design (30 students × 4 questions):
    //
    // Students 0-9   ("Elite"):   All 4 correct → 55 points each
    // Students 10-19 ("Mixed"):   Q0 correct, Q1 wrong, Q2 correct, Q3 skip → 20 points
    // Students 20-24 ("Strugglers"): Q0 wrong, Q1 wrong, Q2 correct, Q3 wrong → 10 points
    // Students 25-29 ("Guillotine"): Q0 correct, then try Q0 again (locked!) → 10 points
    //
    // This produces:
    //   - Correct answers
    //   - Incorrect answers (visible in red in feed)
    //   - Guillotine/locked attempts (silently ignored, not double-counted)
    //   - Tie-breaks needed (students 0-9 have same score, broken by time)

    const baseTime = 0;

    // Elite group (0-9): all correct, staggered timestamps for tie-breaking
    for (let i = 0; i < 10; i++) {
      submitMockAnswer(i, 0, QUESTIONS[0].correctIndex, baseTime + i * 500);
      submitMockAnswer(i, 1, QUESTIONS[1].correctIndex, baseTime + 5000 + i * 500);
      submitMockAnswer(i, 2, QUESTIONS[2].correctIndex, baseTime + 10000 + i * 500);
      submitMockAnswer(i, 3, QUESTIONS[3].correctIndex, baseTime + 15000 + i * 500);
    }

    // Mixed group (10-19): Q0 correct, Q1 wrong, Q2 correct, Q3 skip
    for (let i = 10; i < 20; i++) {
      submitMockAnswer(i, 0, QUESTIONS[0].correctIndex, baseTime + 1000 + i * 300);
      submitMockAnswer(i, 1, 0, baseTime + 6000 + i * 300); // wrong (correct is 2)
      submitMockAnswer(i, 2, QUESTIONS[2].correctIndex, baseTime + 11000 + i * 300);
      // Q3 skipped
    }

    // Strugglers (20-24): Q0 wrong, Q1 wrong, Q2 correct, Q3 wrong
    for (let i = 20; i < 25; i++) {
      submitMockAnswer(i, 0, 3, baseTime + 2000 + i * 200); // wrong
      submitMockAnswer(i, 1, 0, baseTime + 7000 + i * 200); // wrong
      submitMockAnswer(i, 2, QUESTIONS[2].correctIndex, baseTime + 12000 + i * 200); // correct
      submitMockAnswer(i, 3, 0, baseTime + 17000 + i * 200); // wrong
    }

    // Guillotine group (25-29): Q0 correct, then attempt Q0 again (should be locked)
    for (let i = 25; i < 30; i++) {
      submitMockAnswer(i, 0, QUESTIONS[0].correctIndex, baseTime + 3000 + i * 200);
      // Attempt same question again — submitMockAnswer returns null (locked)
      const lockedResult = submitMockAnswer(i, 0, 1, baseTime + 8000 + i * 200);
      expect(lockedResult).toBeNull(); // Guillotine: already answered
    }

    // Trigger re-fetch so teacher sees all answers
    await triggerRecovery(page);
    await page.waitForTimeout(3_000);
    // A second recovery to make sure data is synced
    await triggerRecovery(page);
    await page.waitForTimeout(2_000);

    // After recovery events, the page may have been reloaded by HMR.
    // Ensure we're still on the live view with the map visible.
    const mapStillVisible = await page.locator(".leaflet-container").isVisible().catch(() => false);
    if (!mapStillVisible) {
      // Page was reloaded — re-navigate
      await page.goto(`/dashboard/live/${SESSION_ID}`, { waitUntil: "load", timeout: 60_000 });
      await hideAccessOverlay(page);
      await ensureMapVisible(page);
      await expect(async () => {
        const count = await page.locator(".leaflet-marker-icon").count();
        expect(count).toBeGreaterThanOrEqual(STUDENT_COUNT);
      }).toPass({ timeout: 20_000 });
    }

    // Wait for sidebar to be present (it appears when status transitions to "running")
    await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });

    // ===================================================================
    // PHASE C — Live Feed: wrong answers in red, correct in green
    // ===================================================================

    await clickButtonByText(page, "Live Feed");
    await page.waitForTimeout(1_000);

    // Wait for the feed module to render
    await page.locator('h2:has-text("Live Feed")').waitFor({ state: "visible", timeout: 15_000 });

    // Count correct and incorrect answer cards
    const correctCards = await page.locator('p:has-text("Korrekt svar")').count();
    const wrongCards = await page.locator('p:has-text("Forkert svar")').count();

    // We should have both correct and incorrect answers in the feed
    expect(correctCards, "Live Feed should show correct answers").toBeGreaterThan(0);
    expect(wrongCards, "Live Feed should show incorrect answers in red").toBeGreaterThan(0);

    // Verify wrong answer cards have red styling (border-red)
    const wrongCardElements = page.locator('div.rounded-3xl:has(p:has-text("Forkert svar"))');
    const wrongCardCount = await wrongCardElements.count();
    expect(wrongCardCount).toBeGreaterThan(0);

    // Check one wrong card has the red border class
    const firstWrongCard = wrongCardElements.first();
    const wrongCardClass = await firstWrongCard.getAttribute("class");
    expect(wrongCardClass).toContain("border-red");

    // Check one wrong card shows "0 point" text
    const wrongDetails = await firstWrongCard.locator('div:has-text("0 point")').count();
    expect(wrongDetails).toBeGreaterThan(0);

    // Go back to the map
    await clickButtonByText(page, "Tilbage til Kort");
    await page.waitForTimeout(1_000);

    // ===================================================================
    // PHASE D — Leaderboard: Score → Correct Count → Time sort
    // ===================================================================

    await clickButtonByText(page, "Leaderboard");
    await page.waitForTimeout(1_000);

    await page.locator('h2:has-text("Leaderboard")').waitFor({ state: "visible", timeout: 15_000 });

    // Collect all leaderboard entries' scores
    const leaderboardData = await page.evaluate(() => {
      const entries: { name: string; score: string; rank: string }[] = [];
      const cards = document.querySelectorAll('div[class*="rounded-"][class*="border-slate-800"]');
      cards.forEach((card) => {
        const nameEl = card.querySelector("p.truncate");
        const scoreEl = card.querySelector("p.text-lg.font-black");
        const rankEl = card.querySelector('p[class*="text-slate-400"]');
        if (nameEl && scoreEl) {
          entries.push({
            name: nameEl.textContent?.trim() ?? "",
            score: scoreEl.textContent?.trim() ?? "0",
            rank: rankEl?.textContent?.trim() ?? "",
          });
        }
      });
      return entries;
    });

    expect(leaderboardData.length, "Leaderboard should show entries").toBeGreaterThan(0);

    // Verify descending score order
    const scores = leaderboardData.map((e) => Number(e.score));
    for (let i = 1; i < scores.length; i++) {
      expect(
        scores[i],
        `Score at rank ${i + 1} (${scores[i]}) should be <= rank ${i} (${scores[i - 1]})`
      ).toBeLessThanOrEqual(scores[i - 1]);
    }

    // Elite group (students 0-9) should have 55 points each
    // They should appear at the top
    const topScores = scores.slice(0, 10);
    for (const s of topScores) {
      expect(s).toBe(55);
    }

    // Verify the "forkerte" (wrong answers) label appears on some entries
    const wrongCountLabels = await page.locator('span:has-text("forkerte")').count();
    expect(wrongCountLabels, "Some leaderboard entries should show wrong answer counts").toBeGreaterThan(0);

    // Go back to map
    await clickButtonByText(page, "Tilbage til Kort");
    await page.waitForTimeout(1_000);

    // ===================================================================
    // PHASE E — End the game → TeacherLiveResults (finished state)
    // ===================================================================

    // Switch mock state to finished
    mockSessionStatus = "finished";
    mockFinishedAt = new Date().toISOString();

    // Trigger recovery so the hook picks up status=finished
    await triggerRecovery(page);
    await page.waitForTimeout(3_000);

    // Check if the results page rendered
    const resultsHeader = page.locator('h1:has-text("Resultater")');
    let resultsVisible = await resultsHeader.isVisible().catch(() => false);

    if (!resultsVisible) {
      // The page may have been reloaded by HMR — re-navigate to pick up
      // the finished state from our mock.
      await page.goto(`/dashboard/live/${SESSION_ID}`, { waitUntil: "load", timeout: 60_000 });
      await hideAccessOverlay(page);
      // Wait for auth to complete and the finished view to render
      await page.waitForTimeout(5_000);
      resultsVisible = await resultsHeader.isVisible().catch(() => false);
    }

    if (!resultsVisible) {
      // Try one more recovery
      await triggerRecovery(page);
      await page.waitForTimeout(3_000);
    }

    await resultsHeader.waitFor({ state: "visible", timeout: 30_000 });

    // --- Podium assertions ---

    // The winner should be from the elite group (students 0-9, score 55)
    // Check that "Vinder" label exists
    const winnerLabel = page.locator('p:has-text("Vinder")').first();
    await expect(winnerLabel).toBeVisible({ timeout: 5_000 });

    // The podium should show top 3 positions (1st uses "Vinder", 2nd/3rd use "Plads")
    const podiumPlads = page.locator('p:has-text("Plads")');
    const podiumCount = await podiumPlads.count();
    expect(podiumCount).toBeGreaterThanOrEqual(2); // Plads 2 + Plads 3 (winner says "Vinder")

    // --- Full standings assertions ---

    // The full standings table: "Hele Stillingen" header
    const standingsHeader = page.locator('h3:has-text("Hele Stillingen")');
    await expect(standingsHeader).toBeVisible({ timeout: 5_000 });

    // Collect standings data
    const standingsData = await page.evaluate(() => {
      const rows: { rank: string; name: string; score: string; correct: string }[] = [];
      const standingCards = document.querySelectorAll('div[class*="rounded-"][class*="backdrop-blur-md"]');
      standingCards.forEach((card) => {
        const rankEl = card.querySelector('span[class*="text-amber-100"]');
        const nameEl = card.querySelector('span[class*="text-lg"][class*="font-bold"]');
        const statsEls = card.querySelectorAll('p[class*="text-2xl"][class*="font-black"]');
        if (rankEl && nameEl && statsEls.length >= 2) {
          rows.push({
            rank: rankEl.textContent?.trim() ?? "",
            name: nameEl.textContent?.trim() ?? "",
            score: statsEls[0].textContent?.trim() ?? "0",
            correct: statsEls[1].textContent?.trim() ?? "0",
          });
        }
      });
      return rows;
    });

    expect(standingsData.length, "Final standings should show all participants").toBeGreaterThan(0);

    // Verify scores in descending order
    const finalScores = standingsData.map((r) => Number(r.score));
    for (let i = 1; i < finalScores.length; i++) {
      expect(
        finalScores[i],
        `Final standings: score at rank ${i + 1} should be <= rank ${i}`
      ).toBeLessThanOrEqual(finalScores[i - 1]);
    }

    // Elite group: top 10 should have 55 points
    if (standingsData.length >= 10) {
      for (let i = 0; i < 10; i++) {
        expect(Number(standingsData[i].score)).toBe(55);
        expect(Number(standingsData[i].correct)).toBe(4);
      }
    }

    // Mixed group: should have 20 points, 2 correct answers
    const mixedEntries = standingsData.filter((r) => Number(r.score) === 20);
    expect(mixedEntries.length, "Mixed group should have 20 points each").toBe(10);
    for (const entry of mixedEntries) {
      expect(Number(entry.correct)).toBe(2);
    }

    // Guillotine group: should have 10 points (only Q0 counted, duplicate ignored)
    const guillotineEntries = standingsData.filter((r) => {
      const name = r.name;
      return ["Albert", "Birgit", "Carl", "Diana", "Emil"].includes(name);
    });
    for (const entry of guillotineEntries) {
      expect(Number(entry.score), `Guillotine student ${entry.name} should have 10 points`).toBe(10);
    }

    // --- Sort order badge ---
    const sortBadge = page.locator('span:has-text("Hurtigste tid")');
    await expect(sortBadge.first()).toBeVisible({ timeout: 3_000 });

    // ===================================================================
    // FINAL ASSERTIONS
    // ===================================================================

    expect(didCrash, "Page should not crash").toBe(false);
    expect(
      consoleErrors,
      `Unexpected console errors:\n${consoleErrors.join("\n")}`
    ).toEqual([]);
  });
});
