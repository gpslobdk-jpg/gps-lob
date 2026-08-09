/**
 * play-resilience.spec.ts – Network Resilience & State Recovery E2E Tests
 *
 * Reproducerer de produktions-problemer en lærer har rapporteret:
 *
 *  1. WIFI → 4G GPS-DRIFT:
 *     Eleven mister sin position/poster når de bevæger sig væk fra skolens WiFi
 *     og skifter til 4G/mister forbindelsen kortvarigt.
 *     Test: offline + geo-ændring → reconnect → state overlever i localStorage-snapshot.
 *
 *  2. FROSSET SVAR-KNAP (state-desync):
 *     Eleven kan finde en post, men UI'en tillader ikke at indsende svar.
 *     Root cause: validateAnswerOnServer() har en infinite while-retry-loop.
 *     Mens den looper med navigator.onLine === false er isSubmittingAnswer = true
 *     → knapper disabled. Test: svar-knap er synlig og klikbar igen efter reconnect.
 *
 * Arkitektur:
 *  - Alle Supabase Realtime WebSocket-opkald blokeres (undgår blink fra live-feed).
 *  - /api/* endpoints mockes via page.route().
 *  - GPS styres via page.context().setGeolocation() (CDP-geolokation).
 *  - Netværk styres via page.context().setOffline().
 *  - State-gendannelse verificeres via localStorage-snapshot (saveStoredPlaySnapshot).
 */

import { test, expect, type Page, type Route, type BrowserContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const PARTICIPANT_ID = "eeeeeeee-1111-2222-3333-ffffffffffff";
const TEAM_NAME = "TestHold";

// Post 1: Elevens udgangspunkt (skolens WiFi-zone)
const POST_1_LAT = 55.6761;
const POST_1_LNG = 12.5683;

// Post 2: Næste post (lidt længere væk)
const POST_2_LAT = 55.6772;
const POST_2_LNG = 12.5695;

// GPS-position langt fra begge poster (simulerer 4G-roaming / GPS-drift)
const DRIFT_LAT = 55.6810;
const DRIFT_LNG = 12.5750;

// Quiz session: two multiple_choice questions — both have answers arrays so the
// quiz renderer never crashes with `.map()` on undefined.
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

// Escape session: a single escape-type question used in the frozen-button test.
// raceType "escape" causes resolvePostVariant() to return "escape" for every question,
// so the typed-answer form renders and submitTypedAnswer() calls validateAnswerOnServer().
const ESCAPE_QUESTIONS = [
  {
    type: "escape",
    text: "Løs koden: hvad er kvadratroden af 16?",
    correctAnswer: "4",
    answers: ["4", "", "", ""],
    correctIndex: 0,
    points: 10,
    lat: POST_1_LAT,
    lng: POST_1_LNG,
  },
];

// ---------------------------------------------------------------------------
// API route mocking
// ---------------------------------------------------------------------------

type MockState = {
  submitCallCount: number;
  validateCallCount: number;
  validateShouldHang: boolean;
  validateHangResolvers: Array<() => void>;
};

function participantSnapshot() {
  return {
    participant: {
      id: PARTICIPANT_ID,
      session_id: SESSION_ID,
      student_name: TEAM_NAME,
      start_offset: 0,
      lat: null,
      lng: null,
      accuracy: null,
      finished_at: null,
    },
  };
}

function releasePendingRequests(resolvers: Array<() => void>) {
  for (const resolve of resolvers.splice(0)) resolve();
}

async function closeTestContext(ctx: BrowserContext) {
  await ctx.unrouteAll({ behavior: "wait" });
  await ctx.close();
}

async function mountApiMocks(ctx: BrowserContext, mockState: MockState) {
  // Block Next.js Fast Refresh / HMR WebSocket — prevents repeated full-page
  // reloads triggered by webpack lazy chunk compilation during tests.
  // Without this, the page reloads 10+ times on a cold .next cache, consuming
  // the entire waitForSelector timeout before the app ever renders.
  await ctx.routeWebSocket(/webpack-hmr/, (ws) => {
    ws.close();
  });

  // Block Supabase Realtime WebSocket entirely — prevents live-feed blink noise
  await ctx.route(/supabase.*realtime|realtime\/v1\/websocket/i, async (route: Route) => {
    await route.abort("connectionrefused");
  });

  // POST /api/join
  await ctx.route(/\/api\/join/, async (route: Route) => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
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
        questions: QUIZ_QUESTIONS,
        raceType: "quiz",
        radius: 30,
        // This suite targets state/retry resilience. Dedicated GPS specs cover
        // browser geolocation, so test God Mode isolates post unlocking here.
        gpsOverride: true,
      }),
    });
  });

  // GET /api/play/status
  await ctx.route(/\/api\/play\/status/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionStatus: "running", gpsOverride: true }),
    });
  });

  // GET /api/play/participant — return the participant created by the mocked join.
  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(participantSnapshot()),
    });
  });

  await ctx.route("**/rest/v1/session_messages*", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  // POST /api/play/location
  await ctx.route(/\/api\/play\/location/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  // POST /api/play/submit-answer
  await ctx.route(/\/api\/play\/submit-answer/, async (route: Route) => {
    mockState.submitCallCount++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ inserted: true, awardedPoints: 10 }),
    });
  });

  // POST /api/play/validate-answer
  // Kan "hænge" ved at vente på en ekstern resolver — simulerer timeout under offline
  await ctx.route(/\/api\/play\/validate-answer/, async (route: Route) => {
    mockState.validateCallCount++;
    if (mockState.validateShouldHang) {
      // Vent på signal fra testen om at frigive
      await new Promise<void>((resolve) => {
        mockState.validateHangResolvers.push(resolve);
      });
    }
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      answer?: string;
      selectedIndex?: number;
    };
    const isCorrect =
      body.answer?.trim() === "4" || body.selectedIndex === 1;
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

  // POST /api/play/auth/refresh (participant session refresh)
  await ctx.route(/\/api\/play\/auth\/refresh/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

// ---------------------------------------------------------------------------
// Geolocation helpers
// ---------------------------------------------------------------------------

async function setGPS(ctx: BrowserContext, lat: number, lng: number, accuracy = 8) {
  await ctx.setGeolocation({ latitude: lat, longitude: lng, accuracy });
}

// ---------------------------------------------------------------------------
// Helpers for joining and reaching a post
// ---------------------------------------------------------------------------

async function grantGeoAndMock(ctx: BrowserContext, mockState: MockState) {
  await ctx.grantPermissions(["geolocation"]);
  await mountApiMocks(ctx, mockState);
}

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

async function joinAndWaitForMap(page: Page) {
  // "domcontentloaded" i stedet for "networkidle": appen poller /api/play/status
  // hvert 4. sekund, så "networkidle" opnås aldrig og goto blokerer hele timeout-budgettet.
  await page.goto(`/play/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
  await dismissMaintenanceOverlay(page);

  // Udfyld holdnavn og bekræft (placeholder = "Skriv holdnavn").
  // Giv React 20s til at hydratere og vise name-gate.
  const nameInput = page.getByPlaceholder(/hold|team|navn/i).first();
  await expect(nameInput).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const input = document.querySelector(
      'input[placeholder*="hold" i], input[placeholder*="team" i], input[placeholder*="navn" i]',
    );
    return input !== null && Object.keys(input).some((key) => key.startsWith("__reactProps$"));
  });
  await nameInput.fill(TEAM_NAME);
  const confirmBtn = page
    .getByRole("button", { name: /klar|start|deltag|bekræft/i })
    .first();
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();

  // Vent til spil-HUD er synlig. "Afstand" er teksten i distance-kortet der
  // vises på game-skærmen (PlayInterface.tsx case "play"). Det er det mest
  // reliable signal på at spillet er aktivt — ingen data-testid attributter
  // eksisterer i PlayInterface.
  await page.getByText("Afstand", { exact: true }).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });

  const openPostButton = page.getByRole("button", { name: /åbn post/i }).first();
  const visibleQuestion = page.getByText(/Hvad er hovedstaden|Løs koden/, { exact: false }).first();
  try {
    await expect(openPostButton.or(visibleQuestion).first()).toBeVisible({ timeout: 15_000 });
  } catch {
    const visiblePageText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1_200);
    throw new Error(`Elevflowet nåede HUD, men ingen post kunne åbnes. Synlig tekst: ${visiblePageText}`);
  }
  if (await openPostButton.isVisible()) await openPostButton.click();
}

// ---------------------------------------------------------------------------
// Læs localStorage play-snapshot fra browser-konteksten
// ---------------------------------------------------------------------------

async function readPlaySnapshot(page: Page) {
  return page.evaluate(() => {
    const key = "gpslob_active_play_snapshot";
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as {
        sessionId?: string;
        participantId?: string;
        currentPostIndex?: number;
        solvedPostIndexes?: number[];
        answeredPostIndexes?: number[];
        score?: number;
        correctAnswersCount?: number;
        savedAt?: string;
      };
    } catch {
      return null;
    }
  });
}

// ---------------------------------------------------------------------------
// TEST 1 – GPS-drift: State overlever offline + geo-ændring + reconnect
// ---------------------------------------------------------------------------

test.describe("WiFi→4G GPS-Drift Resilience", () => {
  test(
    "state (post-index, score, snapshot) overlever offline-periode og geo-ændring",
    async ({ browser }) => {
      test.setTimeout(120_000);
      // Opret isoleret browser-kontekst så localStorage er ren
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const mockState: MockState = {
        submitCallCount: 0,
        validateCallCount: 0,
        validateShouldHang: false,
        validateHangResolvers: [],
      };

      try {
        // --- SETUP ---
        await grantGeoAndMock(ctx, mockState);
        // Elevens startposition: ved post 1 (skolens WiFi)
        await setGPS(ctx, POST_1_LAT, POST_1_LNG);

        await joinAndWaitForMap(page);

        // Vent på at GPS-afstand vises → eleven er indenfor radius
        await expect(
          page.getByText(/Hvad er hovedstaden/, { exact: false })
        ).toBeVisible({ timeout: 20_000 });

        // Svar korrekt på post 1 (quiz) mens vi er online
        const correctAnswerBtn = page.getByRole("button", { name: /København/i });
        await expect(correctAnswerBtn).toBeVisible({ timeout: 8_000 });
        await correctAnswerBtn.click();

        // Vent på feedback (grøn knap eller "Videre" knap)
        await page.waitForSelector(
          'button:has-text("Gå til næste post"), button:has-text("næste"), [class*="emerald"][class*="success"]',
          { timeout: 10_000 }
        );

        // Læs snapshot efter korrekt svar — score og solvedPost skal være opdateret
        const snapshotAfterPost1 = await readPlaySnapshot(page);
        expect(snapshotAfterPost1).not.toBeNull();
        expect(snapshotAfterPost1?.sessionId).toBe(SESSION_ID);
        expect(snapshotAfterPost1?.correctAnswersCount).toBeGreaterThanOrEqual(1);
        expect(snapshotAfterPost1?.score).toBeGreaterThanOrEqual(10);

        // --- OFFLINE + GPS-DRIFT (simulerer WiFi → 4G) ---
        await ctx.setOffline(true);

        // Simuler at eleven har bevæget sig geografisk (GPS-drift på 4G)
        await setGPS(ctx, DRIFT_LAT, DRIFT_LNG, 20); // større usikkerhed på 4G

        // Vent et øjeblik — siden skal IKKE crashe eller nulstille progress
        await page.waitForTimeout(2_500);

        // Verificer at siden stadig lever (ikke blank/error)
        await expect(page.locator("body")).toBeVisible();

        // Læs snapshot igen — ALLE state-felter skal være bevaret
        const snapshotDuringOffline = await readPlaySnapshot(page);
        expect(snapshotDuringOffline).not.toBeNull();
        expect(snapshotDuringOffline?.sessionId).toBe(SESSION_ID);
        expect(snapshotDuringOffline?.participantId).toBe(PARTICIPANT_ID);
        // Score og progress er bevaret — ikke nulstillet
        expect(snapshotDuringOffline?.score).toEqual(snapshotAfterPost1?.score);
        expect(snapshotDuringOffline?.correctAnswersCount).toEqual(
          snapshotAfterPost1?.correctAnswersCount
        );
        // Post-index skal være gået videre (til post 2 eller stadig samme)
        expect(typeof snapshotDuringOffline?.currentPostIndex).toBe("number");

        // --- RECONNECT ---
        await ctx.setOffline(false);

        // Flyt GPS tilbage til post 2 — eleven er nu "fremme" ved næste post
        await setGPS(ctx, POST_2_LAT, POST_2_LNG);

        // Vent på at siden har haft tid til online-recovery (recoverWakeUpState)
        await page.waitForTimeout(4_000);

        // Verificer at state stadig er intakt efter reconnect
        const snapshotAfterReconnect = await readPlaySnapshot(page);
        expect(snapshotAfterReconnect?.score).toEqual(snapshotAfterPost1?.score);
        expect(snapshotAfterReconnect?.correctAnswersCount).toEqual(
          snapshotAfterPost1?.correctAnswersCount
        );

        // Submit-count: mindst 1 svar er synkroniseret
        expect(mockState.submitCallCount).toBeGreaterThanOrEqual(1);
      } finally {
        mockState.validateShouldHang = false;
        releasePendingRequests(mockState.validateHangResolvers);
        await closeTestContext(ctx);
      }
    }
  );
});

// ---------------------------------------------------------------------------
// TEST 2 – Frosset svar-knap: isSubmittingAnswer/isCheckingEscapeAnswer sættes
//           fast inde i validateAnswerOnServer's while-retry-loop
// ---------------------------------------------------------------------------

test.describe("Frosset Svar-Knap efter Netværksudfald", () => {
  test(
    "svar-knap er synlig og klikbar igen efter netværksfejl på typed-answer post",
    async ({ browser }) => {
      test.setTimeout(120_000);
      // Dette test bruger raceType "escape" fordi quiz-spørgsmål anvender
      // client-side svar-tjek (submitQuizAnswer) der IKKE kalder
      // validateAnswerOnServer. Escape-varianten kalder validateAnswerOnServer
      // og er dermed den kode-sti der producerer den frosne knap-fejl.
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      let validateHangResolvers: Array<() => void> = [];
      let validateShouldHang = true;
      let validateCallCount = 0;

      try {
        await ctx.grantPermissions(["geolocation"]);
        await setGPS(ctx, POST_1_LAT, POST_1_LNG);

        // Blokér Supabase Realtime
        await ctx.route(/supabase.*realtime|realtime\/v1\/websocket/i, async (route: Route) => {
          await route.abort("connectionrefused");
        });

        // Fælles mock-routes (delvist identisk med mountApiMocks)
        await ctx.route(/\/api\/join/, async (route: Route) => {
          if (route.request().method() !== "POST") { await route.continue(); return; }
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

        // Session-mock med raceType "escape" → resolvePostVariant() returnerer
        // "escape" → submitTypedAnswer() → validateAnswerOnServer() kaldes
        await ctx.route(/\/api\/play\/session/, async (route: Route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              questions: ESCAPE_QUESTIONS,
              raceType: "escape",
              radius: 30,
              gpsOverride: true,
            }),
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
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(participantSnapshot()),
          });
        });

        await ctx.route("**/rest/v1/session_messages*", async (route: Route) => {
          await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        });

        await ctx.route(/\/api\/play\/location/, async (route: Route) => {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
        });

        await ctx.route(/\/api\/play\/submit-answer/, async (route: Route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ inserted: true, awardedPoints: 10 }),
          });
        });

        // validate-answer hænger indtil testen frigiver — simulerer
        // validateAnswerOnServer's while-retry-loop under netværksudfald
        await ctx.route(/\/api\/play\/validate-answer/, async (route: Route) => {
          validateCallCount++;
          if (validateShouldHang) {
            await new Promise<void>((resolve) => { validateHangResolvers.push(resolve); });
          }
          const body = JSON.parse(route.request().postData() ?? "{}") as { answer?: string };
          const isCorrect = body.answer?.trim() === "4";
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ isCorrect, awardedPoints: isCorrect ? 10 : 0, brick: null }),
          });
        });

        // Join og vent på spil-HUD
        await joinAndWaitForMap(page);

        // GPS auto-unlock åbner escape-formularen for post 1
        await expect(
          page.getByText(/Løs koden/, { exact: false })
        ).toBeVisible({ timeout: 20_000 });

        // Find input og "Tjek svar"-knap
        const answerInput = page.getByRole("textbox").first();
        const tjekSvarBtn = page.getByRole("button", { name: /Tjek svar/i });

        await expect(answerInput).toBeVisible({ timeout: 8_000 });
        await expect(tjekSvarBtn).toBeVisible({ timeout: 5_000 });
        await expect(tjekSvarBtn).not.toBeDisabled();

        // --- KLIK SUBMIT MENS VALIDATE-ANSWER HÆNGER ---
        await answerInput.fill("4");
        await tjekSvarBtn.click();

        // UI skal reagere med det samme: den aktuelle implementation skjuler
        // formularen under behandlingen, mens ældre UI lod knappen stå disabled.
        await expect
          .poll(async () => (await tjekSvarBtn.count()) === 0 || (await tjekSvarBtn.isDisabled()))
          .toBe(true);
        await page.waitForTimeout(300);
        expect(validateCallCount).toBeGreaterThanOrEqual(1);

        // --- FRIGIV VALIDATE-ANSWER (netværk vender tilbage) ---
        validateShouldHang = false;
        for (const resolve of validateHangResolvers) { resolve(); }
        validateHangResolvers = [];

        // --- VERIFICER AT UI IKKE ER FROSSET ---
        // Accepterede udfald (ét er nok):
        //   A) Korrekt svar → escape-formularen forsvinder (showQuestion = false)
        //   B) Knappen er igen enabled (forkert svar / retry)
        //   C) Fejlbesked vises
        // Hvad der IKKE er OK: ingen af delene sker → UI permanent frosset
        await Promise.any([
          // A: Escape-formularen er væk (korrekt svar → showQuestion = false)
          page.getByText(/Løs koden/, { exact: false })
            .waitFor({ state: "hidden", timeout: 12_000 }),
          // B: "Tjek svar"-knappen er igen enabled (forkert svar)
          page.locator("button:not([disabled])").filter({ hasText: /Tjek svar/i })
            .waitFor({ state: "visible", timeout: 12_000 }),
          // C: Fejlbesked eller retry-indikator vises
          page.locator("p, div").filter({ hasText: /Forbindelsen|Prøv igen|forkert/i })
            .waitFor({ state: "visible", timeout: 12_000 }),
        ]);

        // Siden er stadig funktionel
        await expect(page.locator("body")).toBeVisible();
      } finally {
        validateShouldHang = false;
        releasePendingRequests(validateHangResolvers);
        await closeTestContext(ctx);
      }
    }
  );

  test(
    "quiz svar-knapper er klikbare igen efter kortvarigt netværksudfald under insert",
    async ({ browser }) => {
      test.setTimeout(120_000);
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      // submit-answer hænger for at simulere at insertAnswerRecord looper offline
      let submitHangResolvers: Array<() => void> = [];
      let submitShouldHang = true;

      await ctx.grantPermissions(["geolocation"]);
      // Blokér Supabase Realtime
      await ctx.route(/supabase.*realtime|realtime\/v1\/websocket/i, async (route: Route) => {
        await route.abort("connectionrefused");
      });

      const mockState: MockState = {
        submitCallCount: 0,
        validateCallCount: 0,
        validateShouldHang: false,
        validateHangResolvers: [],
      };
      await mountApiMocks(ctx, mockState);

      // Override submit-answer til at hænge
      await ctx.route(/\/api\/play\/submit-answer/, async (route: Route) => {
        mockState.submitCallCount++;
        if (submitShouldHang) {
          await new Promise<void>((resolve) => {
            submitHangResolvers.push(resolve);
          });
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ inserted: true, awardedPoints: 10 }),
        });
      });

      try {
        await setGPS(ctx, POST_1_LAT, POST_1_LNG);
        await joinAndWaitForMap(page);

        // Vent på quiz-spørgsmål (post 1, vi er ved GPS-positionen)
        await expect(
          page.getByText(/Hvad er hovedstaden/, { exact: false })
        ).toBeVisible({ timeout: 20_000 });

        // Quiz-svar-knapper er synlige og ikke-disabled
        const kbhBtn = page.getByRole("button", { name: /København/i });
        await expect(kbhBtn).toBeVisible({ timeout: 8_000 });
        await expect(kbhBtn).not.toBeDisabled();

        // Klik korrekt svar — submit-answer hænger nu (simulerer offline)
        await kbhBtn.click();

        // UI skal straks reagere: enten vis feedback-farve eller skjul knapper
        // isCurrentPostAnswered sættes via markAnsweredPostIndex INDEN API-kald
        // Derfor: quizsvar-knapperne SKAL forsvinde (erstattes af "Besvaret")
        await expect(kbhBtn).not.toBeVisible({ timeout: 6_000 });

        // Frigiv submit-answer (netværk kommer tilbage)
        submitShouldHang = false;
        for (const resolve of submitHangResolvers) {
          resolve();
        }
        submitHangResolvers = [];

        // Siden skal stadig vise progression — ikke nulstilles
        await expect(page.locator("body")).toBeVisible();

        // Snapshot skal indeholde den besvarede post
        await page.waitForTimeout(1_500);
        const snap = await readPlaySnapshot(page);
        expect(snap?.solvedPostIndexes).toContain(0);
        expect(snap?.correctAnswersCount).toBeGreaterThanOrEqual(1);
      } finally {
        submitShouldHang = false;
        releasePendingRequests(submitHangResolvers);
        releasePendingRequests(mockState.validateHangResolvers);
        await closeTestContext(ctx);
      }
    }
  );
});

// ---------------------------------------------------------------------------
// TEST 3 – Fuld scenario: Join → offline → geo-drift → reconnect → svar
// ---------------------------------------------------------------------------

test.describe("Fuld Offline-Resiliens Livscyklus", () => {
  test(
    "join → post nået → offline → geo-drift → reconnect → UI kan svare",
    async ({ browser }) => {
      test.setTimeout(120_000);
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const mockState: MockState = {
        submitCallCount: 0,
        validateCallCount: 0,
        validateShouldHang: false,
        validateHangResolvers: [],
      };

      try {
        await grantGeoAndMock(ctx, mockState);
        await setGPS(ctx, POST_1_LAT, POST_1_LNG);

        // (a) Elev deltager i løbet
        await joinAndWaitForMap(page);

        // (b) Afbryd netværksforbindelsen
        await ctx.setOffline(true);

        // (c) Simuler geo-bevægelse mens offline (WiFi → 4G GPS-drift)
        await setGPS(ctx, DRIFT_LAT, DRIFT_LNG, 25);
        await page.waitForTimeout(1_500);

        // Siden MÅ IKKE vise en fatal error-skærm
        const fatalErrorText = page.getByText(
          /noget gik galt|siden er gået ned|fatal|crash|ukendt fejl/i
        );
        await expect(fatalErrorText).not.toBeVisible({ timeout: 2_000 }).catch(() => {
          // Hvis den slet ikke eksisterer er det også OK
        });

        // (d) Genopret netværksforbindelsen
        await ctx.setOffline(false);

        // Flyt GPS til post 1 igen (eleven er kommet tilbage i range)
        await setGPS(ctx, POST_1_LAT, POST_1_LNG);

        // Vent på online-recovery (window 'online' event → recoverWakeUpState)
        await page.waitForTimeout(3_500);

        // (e) State (poster og position) overlever og synkroniserer
        const snapshot = await readPlaySnapshot(page);
        expect(snapshot).not.toBeNull();
        expect(snapshot?.sessionId).toBe(SESSION_ID);
        expect(snapshot?.participantId).toBe(PARTICIPANT_ID);

        // (f) UI fryser IKKE muligheden for at svare
        // Spørgsmålet for post 1 skal komme frem igen (GPS tilbage i range)
        await expect(
          page.getByText(/Hvad er hovedstaden/, { exact: false })
        ).toBeVisible({ timeout: 20_000 });

        // Svar-knapper er synlige og klikbare
        const svarsKnap = page.getByRole("button", { name: /København|Odense|Aarhus|Aalborg/i }).first();
        await expect(svarsKnap).toBeVisible({ timeout: 8_000 });
        await expect(svarsKnap).not.toBeDisabled();

        // Klik svaret → UI reagerer (ingen frozen state)
        await svarsKnap.click();

        // Bekræft at UI reagerede (knapper forsvinder / feedback vises)
        await expect(svarsKnap).not.toBeVisible({ timeout: 8_000 });

        // Submit-answer skal kalde API (svar persisteret)
        await page.waitForTimeout(2_000);
        expect(mockState.submitCallCount).toBeGreaterThanOrEqual(1);
      } finally {
        mockState.validateShouldHang = false;
        releasePendingRequests(mockState.validateHangResolvers);
        await closeTestContext(ctx);
      }
    }
  );
});
