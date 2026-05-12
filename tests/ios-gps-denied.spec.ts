/**
 * ios-gps-denied.spec.ts – iPhone 14 WebKit: GPS permission denied shows guard overlay
 *
 * Seeds a complete game session in localStorage so the name/avatar gates are
 * skipped. Overrides navigator.geolocation via addInitScript to always call
 * the error callback with code 1 (PERMISSION_DENIED). Asserts:
 *
 *  1. GpsGuardOverlay appears with the Danish "GPS er blokeret" heading.
 *  2. The "GPS-guide" label is visible (correct component rendered).
 *  3. The retry button ("Prøv igen") is tappable.
 *  4. The page body is not blank — no white screen of death.
 *  5. No uncaught page errors / TypeError crashes.
 *
 * The GpsGuardOverlay only renders when isTrackingEnabled is true, which
 * requires questions to be loaded and hasCompletedAvatarGate to be true.
 * Both are satisfied by the localStorage seed + session API mock.
 *
 * addInitScript is used for all mocks so they survive Next.js HMR full
 * reloads on WebKit (page.route() can be lost on a reload).
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

test.use({ serviceWorkers: "block" });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = "ios-gps-denied-session";
const PARTICIPANT_ID = "aaaabbbb-0001-0002-0003-cccccccccccc";
const TEAM_NAME = "GPS-TestHold";

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

/** Stored participant that passes all auth gates (hasCompletedAvatarGate: true). */
const STORED_PARTICIPANT = {
  participantId: PARTICIPANT_ID,
  sessionId: SESSION_ID,
  studentName: TEAM_NAME,
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

/** Inject all mocks via addInitScript (WebKit/HMR-proof):
 *  - Seeds localStorage with a valid stored participant
 *  - Overrides navigator.geolocation to always fire PERMISSION_DENIED
 *  - Mocks all /api/play/* fetch calls
 */
async function mountGpsDeniedMocks(page: Page) {
  await page.addInitScript(
    ({ stored, questions }) => {
      // ── Seed localStorage ───────────────────────────────────────────────
      window.localStorage.setItem("gpslob_active_participant", JSON.stringify(stored));

      // ── Override geolocation to always return PERMISSION_DENIED ─────────
      // GPSManager calls watchPosition / getCurrentPosition when enabled.
      // Returning code 1 triggers the onGpsErrorChange(true) callback which
      // makes GpsGuardOverlay visible.
      if ("geolocation" in navigator) {
        const geoError = {
          code: 1,
          message: "User denied Geolocation",
          PERMISSION_DENIED: 1 as const,
          POSITION_UNAVAILABLE: 2 as const,
          TIMEOUT: 3 as const,
        };

        navigator.geolocation.getCurrentPosition = function (_ok, error) {
          if (error) setTimeout(() => error(geoError as GeolocationPositionError), 80);
        };

        navigator.geolocation.watchPosition = function (_ok, error) {
          if (error) setTimeout(() => error(geoError as GeolocationPositionError), 80);
          return 9999;
        };

        navigator.geolocation.clearWatch = function () {
          /* no-op */
        };
      }

      // ── Fetch mock ────────────────────────────────────────────────────
      const _origFetch = window.fetch.bind(window);
      window.fetch = async function (input, init) {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;

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

        // GET /api/play/participant — 404 is the safe default (no team data)
        if (url.includes("/api/play/participant")) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // POST /api/play/location — fire-and-forget
        if (url.includes("/api/play/location")) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Absorb telemetry and Supabase realtime silently.
        if (url.includes("/api/telemetry") || url.includes("supabase") || url.includes("realtime")) {
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

test.describe("iOS GPS permission denied", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test("GpsGuardOverlay renders 'GPS er blokeret' and is not a blank page", async ({ page }) => {
    await mountGpsDeniedMocks(page);

    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto(`/play/${SESSION_ID}?name=${encodeURIComponent(TEAM_NAME)}`);
    await dismissMaintenanceOverlay(page);

    // Wait for the GPS guard overlay — requires tracking to be enabled and
    // GPS to have fired the PERMISSION_DENIED error.
    // The flow is: session loads → isTrackingEnabled becomes true →
    // GPSManager starts watchPosition → error fires → GpsGuardOverlay shows.
    await expect(page.getByText("GPS er blokeret")).toBeVisible({ timeout: 35_000 });

    // "GPS-guide" label confirms the correct overlay component rendered.
    await expect(page.getByText(/GPS-guide/i)).toBeVisible();

    // Retry button exists and is not disabled.
    const retryButton = page.getByRole("button", { name: /prøv igen/i });
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();

    // The page body is not blank — real content is present.
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.trim().length, "Page body appears blank").toBeGreaterThan(10);

    // No critical uncaught errors (DOMException, TypeError, SecurityError).
    const criticalErrors = pageErrors.filter(
      (e) =>
        e.message.includes("DOMException") ||
        e.message.includes("SecurityError") ||
        e.message.includes("TypeError: Cannot read"),
    );
    expect(
      criticalErrors,
      `Uncaught errors: ${criticalErrors.map((e) => e.message).join("; ")}`,
    ).toHaveLength(0);
  });
});
