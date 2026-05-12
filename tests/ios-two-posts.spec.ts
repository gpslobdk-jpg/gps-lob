/**
 * ios-two-posts.spec.ts – iPhone 14 WebKit: elev completes post 1 → post 2
 *
 * Mirrors the apple-webkit.spec.ts "GPS marker" pattern but on the real
 * production /play/[sessionId] page instead of the /play/v2-test harness.
 *
 * Flow:
 *  1. Grant + set geolocation to post 1 coords before navigation.
 *  2. Navigate to /play/[sessionId] with NO ?name= param so the name gate
 *     always appears (hasConfirmedName = false until explicit confirmation).
 *  3. Fill "Holdnavn" input and click "Klar til start" to register.
 *     POST /api/join is mocked and returns a participantId, which sets
 *     hasConfirmedName = true → isTrackingEnabled = true → GPSManager starts.
 *  4. Q1 auto-unlocks (GPS at post 1, distance = 0 < radius = 50 m).
 *  5. Click correct answer ("København").
 *  6. Wait for answer to process (no fragile Q1-disappear assertion).
 *  7. Move GPS to post 2.
 *  8. Q2 auto-unlocks.
 *  9. Click correct answer ("4").
 * 10. Assert no uncaught critical JS errors.
 *
 * addInitScript is used for all fetch mocks so they survive WebKit HMR
 * full reloads (page.route() can be lost on a WebKit reload).
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

test.use({ serviceWorkers: "block" });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = "ios-two-posts-session";
const PARTICIPANT_ID = "bbbbcccc-0001-0002-0003-dddddddddddd";
const TEAM_NAME = "ToPostsHold";

const POST_1_LAT = 55.6761;
const POST_1_LNG = 12.5683;
const POST_2_LAT = 55.6772;
const POST_2_LNG = 12.5695;

const QUIZ_QUESTIONS = [
  {
    type: "multiple_choice",
    text: "Hvad er hovedstaden i Danmark?",
    answers: ["Odense", "København", "Aarhus", "Aalborg"],
    correctIndex: 1,
    points: 10,
    lat: POST_1_LAT,
    lng: POST_1_LNG,
  },
  {
    type: "multiple_choice",
    text: "Hvad er 2+2?",
    answers: ["2", "3", "4", "5"],
    correctIndex: 2,
    points: 10,
    lat: POST_2_LAT,
    lng: POST_2_LNG,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inject all /api/* fetch mocks via addInitScript (WebKit/HMR-proof).
 *
 * NOTE: We do NOT seed localStorage here. The test deliberately lets the
 * name gate appear so the registration flow (POST /api/join) sets up the
 * participantId and makes isTrackingEnabled = true — the same sequence that
 * makes apple-webkit.spec.ts test 3 reliably show the GPS marker.
 */
async function mountPlayMocks(page: Page) {
  await page.addInitScript(
    ({ participantId, sessionId, teamName, questions }) => {
      const _origFetch = window.fetch.bind(window);
      window.fetch = async function (input, init) {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;
        const method = ((init?.method as string) || "GET").toUpperCase();

        // POST /api/join — name gate registration OR auth-recovery
        if (url.includes("/api/join") && method === "POST") {
          return new Response(
            JSON.stringify({
              participantId,
              sessionId,
              studentName: teamName,
              sessionStatus: "running",
              teamId: null,
              teamName: null,
              teamColor: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // GET /api/play/session
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

        // GET /api/play/status
        if (url.includes("/api/play/status")) {
          return new Response(
            JSON.stringify({ sessionStatus: "running", gpsOverride: false }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // GET /api/play/participant — 404 is the safe default
        if (url.includes("/api/play/participant")) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // POST /api/play/validate-answer — always correct
        if (url.includes("/api/play/validate-answer")) {
          return new Response(
            JSON.stringify({ isCorrect: true, awardedPoints: 10, brick: null }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // POST /api/play/submit-answer
        if (url.includes("/api/play/submit-answer")) {
          return new Response(
            JSON.stringify({ inserted: true, awardedPoints: 0 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // POST /api/play/location — fire-and-forget
        if (url.includes("/api/play/location")) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
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
    {
      participantId: PARTICIPANT_ID,
      sessionId: SESSION_ID,
      teamName: TEAM_NAME,
      questions: QUIZ_QUESTIONS,
    },
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

test.describe("iOS two-post flow", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(150_000);

  test("elev completes post 1 then post 2 without JS errors", async ({ page }) => {
    await mountPlayMocks(page);

    // Grant and set geolocation to post 1 BEFORE navigation.
    // GPSManager receives the position as soon as watchPosition starts.
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({
      latitude: POST_1_LAT,
      longitude: POST_1_LNG,
      accuracy: 5,
    });

    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    // Navigate WITHOUT ?name= param so hasConfirmedName = false and the
    // name gate always appears, triggering the registration flow that sets
    // participantId → isTrackingEnabled = true → GPSManager starts.
    await page.goto(`/play/${SESSION_ID}`);
    await dismissMaintenanceOverlay(page);

    // ── Step 1: Name gate — always appears when no stored/URL name ────
    // PlayInterface renders StudentNameGateView with:
    //   placeholder="Skriv holdnavn"   submitLabel="Klar"
    // Filling it and clicking "Klar" calls POST /api/join → mock returns
    // participantId → hasConfirmedName = true → game becomes active.
    const nameGateInput = page.locator('input[placeholder="Skriv holdnavn"]');
    await expect(nameGateInput).toBeVisible({ timeout: 35_000 });
    await nameGateInput.fill(TEAM_NAME);
    // Verify the value stuck (WebKit HMR can clear inputs)
    await expect(nameGateInput).toHaveValue(TEAM_NAME, { timeout: 3_000 });
    await page.getByRole("button", { name: /^klar$/i }).click();

    // ── Step 2: Q1 auto-unlocks ───────────────────────────────────────
    // GPS is at post 1 coords (distance = 0 < radius = 50 m).
    // GPSManager calls onAutoUnlock → showQuestion = true → Q1 renders.
    await expect(
      page.getByText("Hvad er hovedstaden i Danmark?"),
    ).toBeVisible({ timeout: 40_000 });

    // ── Step 3: Answer Q1 ─────────────────────────────────────────────
    await page.locator("button").filter({ hasText: "København" }).click();

    // ── Step 4: Advance to post 2 ─────────────────────────────────────
    // For raceType "quiz", a correct answer shows a "Korrekt!" feedback
    // panel with a MANUAL "Gå til næste post" button — it does NOT
    // auto-dismiss. This is the key step: clicking it advances
    // currentPostIndex from 0 → 1 so GPS proximity to post 2 can fire.
    const nextPostButton = page.getByRole("button", { name: /gå til næste post/i });
    await expect(nextPostButton).toBeVisible({ timeout: 15_000 });
    await nextPostButton.click();

    // ── Steps 5-6 combined: GPS loop until Q2 auto-unlocks ───────────
    //
    // AUTO_UNLOCK_CONFIRMATION_HITS = 2: two consecutive in-range GPS
    // hits are needed before onAutoUnlock fires.
    // The confirmation counter is reset:
    //   a) when showQuestion = true  (feedback overlay still showing)
    //   b) when currentPostIndex changes  (useEffect in GPSManager)
    //
    // A fixed-count jitter loop sometimes misses the "2 consecutive hits
    // after all guards are clear" window. The robust fix: keep re-firing
    // setGeolocation near POST_2 every 1 s until Q2 appears (up to 50 s).
    // As soon as the feedback dismisses AND currentPostIndex = 1, the next
    // two 1-second ticks accumulate confirmationRef to 2 → onAutoUnlock.
    //
    // Micro-jitter (0.000001°≈0.11m) ensures watchPosition fires on each
    // call even if the browser considers coordinates "unchanged".
    const q2Text = page.getByText(/Hvad er 2\+2/);
    for (let tick = 0; tick < 50; tick++) {
      const jitter = tick % 2 === 0 ? 0 : 0.000001;
      await page.context().setGeolocation({
        latitude: POST_2_LAT + jitter,
        longitude: POST_2_LNG + jitter,
        accuracy: 5,
      });
      if (await q2Text.isVisible().catch(() => false)) break;
      await page.waitForTimeout(1_000);
    }

    // ── Step 6: Q2 visible (final assertion) ──────────────────────────
    await expect(q2Text).toBeVisible({ timeout: 5_000 });

    // ── Step 7: Answer Q2 ─────────────────────────────────────────────
    await page.locator("button").filter({ hasText: /^4$/ }).first().click();
    await page.waitForTimeout(2_000);

    // ── Assert no critical uncaught errors ────────────────────────────
    const criticalErrors = pageErrors.filter(
      (e) =>
        e.message.includes("TypeError") ||
        e.message.includes("Cannot read properties") ||
        e.message.includes("DOMException") ||
        e.message.includes("SecurityError"),
    );
    expect(
      criticalErrors,
      `Uncaught errors: ${criticalErrors.map((e) => e.message).join("; ")}`,
    ).toHaveLength(0);

    // Page must still be alive after two posts.
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.trim().length, "Page body blank after two posts").toBeGreaterThan(10);
  });
});
