/**
 * student-flow-contract.spec.ts — Kleine kontrakt-tests for elevflowets basale garantier.
 *
 * Formål:
 *   Hvert test guard'er én konkret kontrakt i elevflowet. Testene er små,
 *   mock-baserede og fokuserede — de skal fange simple logiske fejl som
 *   correctIndex-buggen FØR de rammer produktion.
 *
 * Dækkede kontrakter:
 *   1. parseQuestion null→0 regression:
 *      Hvis /api/play/session returnerer correctIndex: null for en quiz-post,
 *      skal INGEN svarmulighed vises som korrekt (ikke silently behandle A som korrekt).
 *
 *   2. Session 410 (afsluttet løb) viser fejlskærm, ikke evig spinner.
 *
 *   3. Session 404 (manglende løb) viser fejlskærm, ikke evig spinner.
 *
 *   4. Quiz correctIndex: 0 (A) fungerer korrekt efter parseQuestion-fix.
 *      (Verificerer at rettelsen ikke brød det normale correctIndex:0-tilfælde.)
 *
 *   5. previewUrl bevares i session-svaret til klienten (musikquiz-kontrakt).
 *      Testen mockes på samme måde som den rigtige route og verificerer at
 *      audio-afspilleren vises når previewUrl er til stede.
 *
 * Bemærk:
 *   Testene 1-4 mockes fuldt ud og kræver ingen rigtig DB.
 *   Test 5 testes via UI-mock; previewUrl-bevaringen på server-siden er
 *   allerede dækket af musicquiz.spec.ts test E.
 */

import { test, expect, type BrowserContext, type Locator, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Konstanter
// ---------------------------------------------------------------------------

const SESSION_ID = "contract-test-session";
const PARTICIPANT_ID = "cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa";
const TEAM_NAME = "KontraktHold";
const POST_LAT = 55.6761;
const POST_LNG = 12.5683;

// ---------------------------------------------------------------------------
// Hjælpefunktioner (genbrugt fra answer-progression.spec.ts-mønster)
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
      const cls = typeof el.className === "string" ? el.className : "";
      if (!cls.includes("fixed") || !cls.includes("inset-0")) {
        return;
      }
      const text = el.textContent ?? "";
      if (text.includes("lukke siden ned") || text.includes("Vi holder pause")) {
        el.remove();
      }
    });
  });
}

type MockConfig = {
  questions: unknown[];
  raceType: string;
  joinStatus?: number;
  sessionStatus?: number;
};

async function mountContractMocks(ctx: BrowserContext, config: MockConfig) {
  await ctx.routeWebSocket(/webpack-hmr/, (ws) => {
    ws.close();
  });

  await ctx.route(/supabase.*realtime|realtime\/v1\/websocket/i, async (route: Route) => {
    await route.abort("connectionrefused");
  });

  await ctx.route(/\/api\/join/, async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    const statusCode = config.joinStatus ?? 200;

    if (statusCode !== 200) {
      await route.fulfill({
        status: statusCode,
        contentType: "application/json",
        body: JSON.stringify({
          error: statusCode === 410
            ? "Løbet er afsluttet."
            : "Løbet findes ikke.",
        }),
      });
      return;
    }

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

  await ctx.route(/\/api\/play\/session/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: config.questions,
        raceType: config.raceType,
        radius: 50,
        gpsOverride: false,
      }),
    });
  });

  await ctx.route(/\/api\/play\/status/, async (route: Route) => {
    const statusCode = config.sessionStatus ?? 200;
    await route.fulfill({
      status: statusCode,
      contentType: "application/json",
      body: JSON.stringify(
        statusCode === 410
          ? { exists: true, status: "finished", sessionStatus: "finished" }
          : { sessionStatus: "running", gpsOverride: false }
      ),
    });
  });

  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found" }),
    });
  });

  await ctx.route(/\/api\/play\/placements/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ placements: [] }),
    });
  });

  await ctx.route(/\/api\/play\/location/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await ctx.route(/\/api\/play\/auth\/refresh/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await ctx.route(/\/api\/play\/validate-answer/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isCorrect: false, awardedPoints: 0, brick: null }),
    });
  });

  await ctx.route(/\/api\/play\/submit-answer/, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      payloads?: Array<Record<string, unknown>>;
    };
    const awarded = Number(body.payloads?.[0]?.awarded_points) || 0;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ inserted: true, awardedPoints: awarded }),
    });
  });
}

async function navigateToPlayAndEnterName(page: Page, readyLocator: Locator) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: POST_LAT, longitude: POST_LNG, accuracy: 5 });

  await page.goto(`/play/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
  await dismissMaintenanceOverlay(page);

  const nameInput = page.getByPlaceholder(/skriv holdnavn/i);
  await expect(nameInput).toBeVisible({ timeout: 30_000 });
  await nameInput.fill(TEAM_NAME);
  await page.getByRole("button", { name: /klar/i }).click();

  await page.waitForSelector("text=Afstand", { timeout: 30_000 });
  const openPostButton = page.getByRole("button", { name: /bn post/i });
  await expect(openPostButton).toBeVisible({ timeout: 30_000 });
  await openPostButton.click();
  await expect(readyLocator).toBeVisible({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Test 1: parseQuestion null→0 regression
// ---------------------------------------------------------------------------

test.describe("parseQuestion null→0 regression — correctIndex: null må ikke give point til A", () => {
  test.describe.configure({ retries: 0 });

  /**
   * Root cause of the bug that was fixed:
   *   Number(null) === 0, and Number.isInteger(0) === true, so parseQuestion()
   *   was returning correctIndex: 0 when the server sent correctIndex: null.
   *
   * After the fix (candidate.correctIndex != null ? Number(...) : NaN),
   * null → NaN → correctIndex: null → isCorrect = (selectedIndex === null) → always false.
   *
   * This test verifies that selecting answer A (index 0) when correctIndex is null
   * shows wrong-answer feedback, NOT the "Korrekt!" message.
   */
  test("klik A når correctIndex er null giver forkert-svar-feedback (ikke Korrekt)", async ({ page }) => {
    test.setTimeout(45_000);

    await mountContractMocks(page.context(), {
      raceType: "quiz",
      questions: [
        {
          type: "multiple_choice",
          text: "Test: ukonfigureret correct-svar (correctIndex: null)",
          // correctIndex is intentionally NOT set (null, as could come from DB)
          correctIndex: null,
          answers: ["Svar A", "Svar B", "Svar C", "Svar D"],
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
        },
      ],
    });

    await navigateToPlayAndEnterName(page, page.getByRole("button", { name: /^Svar A$/i }));

    // Click answer A — if parseQuestion silently defaulted to 0, this would be "correct"
    await page.getByRole("button", { name: /^Svar A$/i }).click();

    // Expect WRONG-answer feedback (not "Korrekt!")
    await expect(page.getByText(/Desværre.*0 point/i)).toBeVisible({ timeout: 5_000 });

    // Ensure "Korrekt!" message does NOT appear
    await expect(page.getByText(/Korrekt! Du får point/i)).not.toBeVisible();
  });

  test("klik B/C/D når correctIndex er null giver forkert-svar-feedback", async ({ page }) => {
    test.setTimeout(45_000);

    await mountContractMocks(page.context(), {
      raceType: "quiz",
      questions: [
        {
          type: "multiple_choice",
          text: "Test: ukonfigureret correct-svar (null) — klik B",
          correctIndex: null,
          answers: ["Svar A", "Svar B", "Svar C", "Svar D"],
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
        },
      ],
    });

    await navigateToPlayAndEnterName(page, page.getByRole("button", { name: /^Svar B$/i }));

    await page.getByRole("button", { name: /^Svar B$/i }).click();

    await expect(page.getByText(/Desværre.*0 point/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Korrekt! Du får point/i)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test 2: correctIndex: 0 (A) virker stadig normalt efter fix
// ---------------------------------------------------------------------------

test.describe("correctIndex: 0 — A er det korrekte svar fungerer stadig", () => {
  test.describe.configure({ retries: 0 });

  /**
   * Verify the parseQuestion fix didn't break the normal case where index 0 IS correct.
   */
  test("klik A når correctIndex er 0 giver Korrekt! feedback", async ({ page }) => {
    test.setTimeout(45_000);

    await mountContractMocks(page.context(), {
      raceType: "quiz",
      questions: [
        {
          type: "multiple_choice",
          text: "Test: A er korrekt (correctIndex: 0)",
          correctIndex: 0,
          answers: ["Korrekt A", "Forkert B", "Forkert C", "Forkert D"],
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
        },
      ],
    });

    await navigateToPlayAndEnterName(page, page.getByRole("button", { name: /^Korrekt A$/i }));

    await page.getByRole("button", { name: /^Korrekt A$/i }).click();

    await expect(page.getByText(/Korrekt! Du får point/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Desværre.*0 point/i)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test 3: Session 410 → fejlskærm vises, ikke evig spinner
// ---------------------------------------------------------------------------

test.describe("Session 410/afsluttet — fejlskærm vises, ikke evig spinner", () => {
  test.describe.configure({ retries: 0 });

  /**
   * When /api/join returns HTTP 410 (session ended), the circuit breaker
   * should fire immediately and show an error screen instead of loading forever.
   */
  test("join 410 viser 'Løbet er afsluttet' fejlskærm", async ({ page }) => {
    test.setTimeout(45_000);

    await mountContractMocks(page.context(), {
      raceType: "quiz",
      joinStatus: 410,
      // questions must be non-empty so the play page loads the name gate normally
      questions: [
        {
          type: "multiple_choice",
          text: "Testpost til 410-scenario",
          correctIndex: 0,
          answers: ["A", "B", "C", "D"],
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
        },
      ],
    });

    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: POST_LAT, longitude: POST_LNG, accuracy: 5 });
    await page.goto(`/play/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
    await dismissMaintenanceOverlay(page);

    // Enter name and try to join
    const nameInput = page.getByPlaceholder(/skriv holdnavn/i);
    await expect(nameInput).toBeVisible({ timeout: 30_000 });
    await nameInput.fill(TEAM_NAME);
    await page.getByRole("button", { name: /klar/i }).click();

    // Expect error screen — circuit breaker must fire, showing the error heading
    // getByRole('heading') avoids strict-mode violation from multiple text matches
    await expect(
      page.getByRole("heading", { name: /afsluttet|Løbet er/i })
    ).toBeVisible({ timeout: 15_000 });

    // Ensure the play UI did NOT start (no "Afstand" shown)
    await expect(page.getByText("Afstand")).not.toBeVisible();
  });

  /**
   * When /api/join returns HTTP 404 (session not found), an error should
   * appear rather than an infinite loading spinner.
   */
  test("join 404 viser fejlskærm", async ({ page }) => {
    test.setTimeout(45_000);

    await mountContractMocks(page.context(), {
      raceType: "quiz",
      joinStatus: 404,
      questions: [
        {
          type: "multiple_choice",
          text: "Testpost til 404-scenario",
          correctIndex: 0,
          answers: ["A", "B", "C", "D"],
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
        },
      ],
    });

    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: POST_LAT, longitude: POST_LNG, accuracy: 5 });
    await page.goto(`/play/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
    await dismissMaintenanceOverlay(page);

    const nameInput = page.getByPlaceholder(/skriv holdnavn/i);
    await expect(nameInput).toBeVisible({ timeout: 30_000 });
    await nameInput.fill(TEAM_NAME);
    await page.getByRole("button", { name: /klar/i }).click();

    // Either "Løbet er muligvis afsluttet" heading or body text "Løbet findes ikke"
    // Use heading role to avoid strict-mode violation from multiple text matches
    await expect(
      page.getByRole("heading", { name: /afsluttet|Løbet er/i })
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Afstand")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test 4: previewUrl bevares for musikquiz → audio-afspiller vises
// ---------------------------------------------------------------------------

test.describe("Musikquiz previewUrl → audio-afspiller vises i elevflow", () => {
  test.describe.configure({ retries: 0 });

  /**
   * When /api/play/session returns a quiz question with previewUrl set,
   * the play UI must show an audio player element so the student can
   * hear the music clip and answer the question.
   *
   * This is the client-side contract: parseQuestion() must preserve previewUrl,
   * and the UI must render <audio> or a play button based on it.
   */
  test("previewUrl i session-svar fører til audio-element i UI", async ({ page }) => {
    test.setTimeout(45_000);

    const PREVIEW_URL = "https://audio.itunes.apple.com/test-preview.m4a";

    await mountContractMocks(page.context(), {
      raceType: "quiz",
      questions: [
        {
          type: "multiple_choice",
          text: "Hvad hedder sangen?",
          correctIndex: 1,
          answers: ["Forkert sang", "Rigtig sang", "Anden sang", "Tredje sang"],
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
          // musikquiz fields — server preserves these via { ...rawQuestion }
          previewUrl: PREVIEW_URL,
          artworkUrl: "https://example.com/cover.jpg",
          musicArtist: "Test Artist",
          musicProvider: "itunes",
          providerTrackId: "12345",
        },
      ],
    });

    await navigateToPlayAndEnterName(
      page,
      page.getByRole("button", { name: /^Forkert sang$/i })
    );

    // The play UI should render an audio element with the previewUrl as src
    const audioElement = page.locator("audio");
    await expect(audioElement).toBeAttached({ timeout: 10_000 });

    // The audio src should contain our previewUrl
    const audioSrc = await audioElement.getAttribute("src");
    expect(audioSrc).toBe(PREVIEW_URL);
  });
});
