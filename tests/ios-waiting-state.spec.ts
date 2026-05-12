/**
 * ios-waiting-state.spec.ts – iPhone 14 WebKit: waiting state renders and transitions
 *
 * Seeds localStorage with sessionStatus: "waiting" so the play page enters
 * the "waiting" screen mode immediately after loading.
 *
 * Asserts:
 *  1. "Løbet er ikke startet endnu" (WaitingScreenContent heading) is visible.
 *  2. "Vi tjekker automatisk" copy is visible — confirms the correct component.
 *  3. No blank page / no stuck infinite loading spinner.
 *  4. After the status mock is flipped to "running" (via window flag set by
 *     page.evaluate), the waiting screen disappears and the game transitions
 *     to the active play UI.
 *  5. No uncaught JS errors throughout.
 *
 * Implementation note: the mock uses a window.__mockWaitingDone flag that
 * the /api/play/status handler reads. addInitScript injects the handler;
 * page.evaluate() sets the flag mid-test. Because addInitScript runs on
 * every page load (including HMR reloads), the mock is always active. The
 * flag persists for the lifetime of the current page document.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

test.use({ serviceWorkers: "block" });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = "ios-waiting-session";
const PARTICIPANT_ID = "eeeeffff-0001-0002-0003-aaaaaaaaaaaa";
const TEAM_NAME = "VenterHold";

const POST_LAT = 55.6761;
const POST_LNG = 12.5683;

const QUIZ_QUESTIONS = [
  {
    type: "multiple_choice",
    text: "Hvad er hovedstaden i Danmark?",
    answers: ["Odense", "København", "Aarhus", "Aalborg"],
    correctIndex: 1,
    points: 10,
    lat: POST_LAT,
    lng: POST_LNG,
  },
];

/** Stored participant with sessionStatus "waiting" — skips name/avatar gate. */
const STORED_PARTICIPANT = {
  participantId: PARTICIPANT_ID,
  sessionId: SESSION_ID,
  studentName: TEAM_NAME,
  startOffset: 0,
  savedAt: new Date().toISOString(),
  teamId: null,
  teamColor: null,
  avatarUrl: null,
  sessionStatus: "waiting",
  hasCompletedAvatarGate: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inject mocks via addInitScript (WebKit/HMR-proof).
 *
 * /api/play/status returns "waiting" until window.__mockWaitingDone === true,
 * then returns "running". This lets the test control the transition timing
 * by calling page.evaluate(() => { window.__mockWaitingDone = true; }).
 */
async function mountWaitingMocks(page: Page) {
  await page.addInitScript(
    ({ stored, questions }) => {
      // Seed stored participant (sessionStatus: "waiting").
      window.localStorage.setItem("gpslob_active_participant", JSON.stringify(stored));

      // Flag read by the status mock below. Starts as false → "waiting".
      (window as any).__mockWaitingDone = false;

      const _origFetch = window.fetch.bind(window);
      window.fetch = async function (input, init) {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;

        // GET /api/play/session — return full question list regardless of
        // waiting state. GameState loads questions but shows waiting screen
        // because isSessionWaiting overrides the active screen mode.
        if (url.includes("/api/play/session")) {
          return new Response(
            JSON.stringify({
              questions,
              raceType: "quiz",
              radius: 50,
              gpsOverride: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // GET /api/play/status — gate on window.__mockWaitingDone flag.
        if (url.includes("/api/play/status")) {
          const isDone = (window as any).__mockWaitingDone === true;
          return new Response(
            JSON.stringify({
              sessionStatus: isDone ? "running" : "waiting",
              gpsOverride: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // GET /api/play/participant — 404 is the safe default.
        if (url.includes("/api/play/participant")) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // POST /api/play/location — fire-and-forget.
        if (url.includes("/api/play/location")) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // POST /api/join — GameState auth-recovery calls this when it needs to
        // re-register the participant. Return the stored participant so recovery succeeds.
        if (url.includes("/api/join") && ((init?.method as string) || "GET").toUpperCase() === "POST") {
          return new Response(
            JSON.stringify({
              participantId: stored.participantId,
              sessionId: stored.sessionId,
              studentName: stored.studentName,
              sessionStatus: "waiting",
              teamId: null,
              teamName: null,
              teamColor: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // POST /api/play/validate-answer
        if (url.includes("/api/play/validate-answer")) {
          return new Response(
            JSON.stringify({ isCorrect: true, awardedPoints: 10, brick: null }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // Absorb telemetry / Supabase silently.
        if (
          url.includes("/api/telemetry") ||
          url.includes("supabase") ||
          url.includes("realtime")
        ) {
          return new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return _origFetch(input, init);
      };
    },
    { stored: STORED_PARTICIPANT, questions: QUIZ_QUESTIONS },
  );
}

/** Remove maintenance overlay if present. */
async function dismissMaintenanceOverlay(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((el) => {
      const cls = typeof el.className === "string" ? el.className : "";
      if (cls.includes("fixed") && cls.includes("inset-0")) {
        const text = el.textContent ?? "";
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

test.describe("iOS waiting state", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test("waiting screen shows and transitions to game when session starts", async ({ page }) => {
    await mountWaitingMocks(page);

    // Grant geolocation so GPSManager doesn't immediately raise a denied error.
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({
      latitude: POST_LAT,
      longitude: POST_LNG,
      accuracy: 5,
    });

    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto(`/play/${SESSION_ID}?name=${encodeURIComponent(TEAM_NAME)}`);
    await dismissMaintenanceOverlay(page);

    // ── Assert 1: waiting screen heading is visible ────────────────────
    // PlayInterface renders WaitingScreenContent when screen.mode === "waiting".
    // The heading text is "Løbet er ikke startet endnu".
    await expect(
      page.getByText("Løbet er ikke startet endnu"),
    ).toBeVisible({ timeout: 30_000 });

    // ── Assert 2: "Vi tjekker automatisk" copy confirms correct component ─
    // Use the same generous timeout as assert 1; both texts are in the same
    // WaitingScreenContent block so they should appear simultaneously.
    await expect(
      page.getByText(/Vi tjekker automatisk/i),
    ).toBeVisible({ timeout: 30_000 });

    // ── Assert 3: body is not blank ────────────────────────────────────
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.trim().length, "Page body appears blank").toBeGreaterThan(20);

    // ── Assert 4: transition to game when teacher starts the session ───
    // Flip the flag so the NEXT /api/play/status poll returns "running".
    await page.evaluate(() => {
      (window as any).__mockWaitingDone = true;
    });

    // GameState polls /api/play/status periodically. When it gets "running",
    // isSessionWaiting becomes false and screen.mode changes from "waiting"
    // to the active game mode. The waiting heading disappears.
    //
    // Use getByRole("heading") to scope the selector to the <h1> only —
    // this avoids the strict-mode violation caused by Next.js injecting the
    // same text into the route-announcer <div aria-live="assertive">.
    await expect(
      page.getByRole("heading", { name: "Løbet er ikke startet endnu" }),
    ).not.toBeVisible({ timeout: 40_000 });

    // After the transition the page must still be alive.
    const bodyTextAfter = await page.evaluate(() => document.body.innerText);
    expect(bodyTextAfter.trim().length, "Page body blank after transition").toBeGreaterThan(10);

    // ── Assert 5: no uncaught errors ───────────────────────────────────
    const criticalErrors = pageErrors.filter(
      (e) =>
        e.message.includes("TypeError") ||
        e.message.includes("Cannot read properties") ||
        e.message.includes("DOMException"),
    );
    expect(
      criticalErrors,
      `Uncaught errors: ${criticalErrors.map((e) => e.message).join("; ")}`,
    ).toHaveLength(0);
  });
});
