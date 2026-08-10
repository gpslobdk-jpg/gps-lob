/**
 * musicquiz.spec.ts - Malrettede Playwright-tests for Musikquiz-feature
 *
 * Daekker:
 *   A. Musikquiz-kortet er synligt pa valg-siden (/dashboard/opret/valg)
 *   B. Arkiv-filteret indeholder "Musikquiz"
 *   C. Builder: musiksoegning -> sporvalg -> svar A og audio saettes
 *   D. Builder: laererens egne svar overskrives ikke ved sporvalg
 *   E. Elevview: audio vises, sangtitel/kunstner/artwork skjules
 *   F. Forkert svar pa musikquiz-post gaar videre
 *
 * Vigtige begraensninger:
 *   - Ingen rigtig DB-koersel (alle Supabase/API-kald mockes)
 *   - Ingen push til main; kun pa branch feature/musikquiz
 *   - DB-migration 202605050001_add_musikquiz_race_type er IKKE koert endnu
 *
 * Auth-strategi for dashboard-sider (A, B, C, D):
 *   DashboardAuthGate bruger useAuth() -> supabase.auth.getSession() som
 *   laeses fra cookies (createBrowserClient fra @supabase/ssr bruger cookies).
 *   Vi saetter cookie "sb-xodrzahqdgbsssntupjt-auth-token" via ctx.addCookies()
 *   foer navigation og mocker Supabase REST/auth-endpoints.
 */

import { test, expect, type BrowserContext, type Locator, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Konstanter
// ---------------------------------------------------------------------------

const SESSION_ID = "musicquiz-test-session";
const PARTICIPANT_ID = "aaaabbbb-1111-2222-3333-ccccddddeeee";
const TEAM_NAME = "MusicTestHold";
const POST_LAT = 55.6761;
const POST_LNG = 12.5683;

// Supabase projekt-ref: xodrzahqdgbsssntupjt (fra NEXT_PUBLIC_SUPABASE_URL)
const SUPABASE_COOKIE_NAME = "sb-xodrzahqdgbsssntupjt-auth-token";

/** Mock-musikresultat som /api/music/search returnerer */
const MOCK_MUSIC_RESULT = {
  provider: "itunes",
  trackId: "123",
  trackName: "Test Song",
  artistName: "Test Artist",
  collectionName: "Test Album",
  previewUrl: "https://example.com/test-preview.m4a",
  artworkUrl100: "https://example.com/cover.jpg",
};

/** Fake bruger til Supabase-session */
const FAKE_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "playwright-test@example.com",
  email_confirmed_at: "2024-01-01T00:00:00.000Z",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  user_metadata: {},
  app_metadata: { provider: "email", providers: ["email"] },
};

// ---------------------------------------------------------------------------
// Hjælpefunktioner
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
      if (!cls.includes("fixed") || !cls.includes("inset-0")) return;
      const text = el.textContent ?? "";
      if (text.includes("lukke siden ned") || text.includes("Vi holder pause")) {
        el.remove();
      }
    });
  });
}

type MockState = {
  submitPayloads: Array<Record<string, unknown>>;
};

/** Monterer /api/play/* mocks – genbrug fra answer-progression.spec.ts */
async function mountPlayMocks(
  ctx: BrowserContext,
  questions: unknown[],
  state: MockState,
) {
  await ctx.routeWebSocket(/webpack-hmr/, (ws) => { ws.close(); });

  await ctx.route(/supabase.*realtime|realtime\/v1\/websocket/i, async (route: Route) => {
    await route.abort("connectionrefused");
  });

  await ctx.route(/\/api\/join/, async (route: Route) => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    await route.fulfill({
      status: 200, contentType: "application/json",
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
      status: 200, contentType: "application/json",
      body: JSON.stringify({ questions, raceType: "quiz", radius: 50, gpsOverride: true }),
    });
  });

  await ctx.route(/\/api\/play\/status/, async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ sessionStatus: "running", gpsOverride: true }),
    });
  });

  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });

  await ctx.route(/\/api\/play\/placements/, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ placements: [] }) });
  });

  await ctx.route(/\/api\/play\/location/, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await ctx.route(/\/api\/play\/auth\/refresh/, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await ctx.route(/\/api\/play\/validate-answer/, async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ isCorrect: false, awardedPoints: 0, brick: null }),
    });
  });

  await ctx.route(/\/api\/play\/submit-answer/, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      payloads?: Array<Record<string, unknown>>;
    };
    state.submitPayloads.push(body.payloads?.[0] ?? {});
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ inserted: true, awardedPoints: 0 }),
    });
  });
}

async function openPlayPage(page: Page, readyLocator: Locator) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: POST_LAT, longitude: POST_LNG, accuracy: 5 });

  await page.goto(`/play/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
  await dismissMaintenanceOverlay(page);

  const nameInput = page.getByPlaceholder(/skriv holdnavn/i);
  await expect(nameInput).toBeVisible({ timeout: 40_000 });
  await nameInput.fill(TEAM_NAME);
  await page.getByRole("button", { name: /klar/i }).click();

  await page.waitForSelector("text=Afstand", { timeout: 30_000 });
  const openPostButton = page.getByRole("button", { name: /^åbn post/i });
  await expect(readyLocator.or(openPostButton).first()).toBeVisible({
    timeout: 30_000,
  });
  if (!(await readyLocator.isVisible())) {
    await openPostButton.click();
  }
  await expect(readyLocator).toBeVisible({ timeout: 30_000 });
}

/**
 * Klaergoer en BrowserContext til dashboard-sider:
 *  1. Saetter Supabase auth-cookie (createBrowserClient fra @supabase/ssr bruger cookies)
 *  2. Mocker Supabase auth REST-endpoints
 *  3. Blokerer HMR og Realtime WebSockets
 *  4. Mocker Supabase REST (returnerer tom liste — ingen rigtig DB)
 */
async function setupDashboardContext(ctx: BrowserContext) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  const fakeSession = {
    access_token: "fake-test-access-token-xxxxxxxxxxxxxxxx",
    refresh_token: "fake-test-refresh-token-xxxxxxxxxxxxxxxx",
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: "bearer",
    user: FAKE_USER,
  };

  // @supabase/ssr createBrowserClient gemmer session i cookie
  // Cookie-vaerdi er URI-encoded JSON (som document.cookie-vaerdier)
  const cookieValue = encodeURIComponent(JSON.stringify(fakeSession));

  await ctx.addCookies([
    {
      name: SUPABASE_COOKIE_NAME,
      value: cookieValue,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Blok HMR WebSocket
  await ctx.routeWebSocket(/webpack-hmr/, (ws) => { ws.close(); });

  // Blok Supabase Realtime
  await ctx.route(/supabase.*realtime|realtime\/v1\/websocket/i, async (route: Route) => {
    await route.abort("connectionrefused");
  });

  // Mock Supabase auth token-endpoint (auto-refresh)
  await ctx.route(/xodrzahqdgbsssntupjt\.supabase\.co.*\/auth\/v1\/token/, async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ...fakeSession, expires_at: expiresAt }),
    });
  });

  // Mock Supabase getUser endpoint
  await ctx.route(/xodrzahqdgbsssntupjt\.supabase\.co.*\/auth\/v1\/user/, async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(FAKE_USER),
    });
  });

  // Mock Supabase REST API (gpsRuns, live_sessions osv.) — returnerer tom liste
  await ctx.route(/xodrzahqdgbsssntupjt\.supabase\.co.*\/rest\/v1\//, async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Musikquiz – malrettede tests", () => {
  test.describe.configure({ retries: 0 });

  // =========================================================================
  // Test A: Musikquiz er synlig pa valg-siden
  // =========================================================================
  test("A: Musikquiz-kortet vises pa /dashboard/opret/valg", async ({ page }) => {
    test.setTimeout(35_000);

    await setupDashboardContext(page.context());
    await page.goto("/dashboard/opret/valg", { waitUntil: "domcontentloaded" });

    // Bekraeft at "Musikquiz" titlen vises (AuthGate maa vaere passeret)
    await expect(page.getByText("Musikquiz").first()).toBeVisible({ timeout: 20_000 });

    // Bekraeft at beskrivelsesteksten indeholder "musikklip"
    await expect(
      page.getByText(/Lad eleverne lytte til musikklip/i),
    ).toBeVisible({ timeout: 5_000 });

    // Bekraeft at kortet linker til /dashboard/opret/musikquiz
    await expect(
      page.locator('a[href="/dashboard/opret/musikquiz"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  // =========================================================================
  // Test B: Arkivfilter har Musikquiz
  // =========================================================================
  test("B: Arkiv-filterlisten indeholder Musikquiz", async ({ page }) => {
    test.setTimeout(35_000);

    await setupDashboardContext(page.context());
    await page.goto("/dashboard/arkiv", { waitUntil: "domcontentloaded" });

    // RACE_TYPE_FILTER_OPTIONS har { value: "musikquiz", label: "Musikquiz" }
    // <option>-elementer i en collapsed <select> er teknisk "hidden" i Playwright,
    // brug toBeAttached() for at bekraeftes at option-elementet eksisterer i DOM
    await expect(page.locator('option[value="musikquiz"]')).toBeAttached({ timeout: 20_000 });
  });

  // =========================================================================
  // Test C: Builder – musiksoegning og sporvalg
  // =========================================================================
  test("C: Builder – soeg og vaelg sang saetter svar A og audio-element", async ({ page }) => {
    test.setTimeout(40_000);

    await setupDashboardContext(page.context());

    // Mock /api/music/search
    await page.context().route(/\/api\/music\/search/, async (route: Route) => {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ results: [MOCK_MUSIC_RESULT] }),
      });
    });

    await page.goto("/dashboard/opret/musikquiz", { waitUntil: "domcontentloaded" });

    const searchInput = page.getByPlaceholder(/søg efter sang eller kunstner/i);
    await expect(searchInput).toBeVisible({ timeout: 25_000 });

    await searchInput.fill("test");
    await page.getByRole("button", { name: /^søg$/i }).click();

    // Bekraeft soegeresultat vises
    await expect(page.getByText("Test Song").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Test Artist").first()).toBeVisible({ timeout: 5_000 });

    // Klik "Vaelg" pa det foerste resultat
    await page.getByRole("button", { name: /^vælg$/i }).first().click();

    // Bekraeft at valgt spor nu vises
    await expect(page.getByText("Test Song").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Test Artist").first()).toBeVisible({ timeout: 5_000 });

    // Bekraeft audio-element med korrekt preview-URL er i DOM
    await expect(
      page.locator('audio[src="https://example.com/test-preview.m4a"]'),
    ).toBeAttached({ timeout: 5_000 });

    // Bekraeft at svar A (placeholder "Svar 1") er sat til sangtitlen
    await expect(page.getByPlaceholder("Svar 1")).toHaveValue("Test Song", { timeout: 5_000 });
  });

  // =========================================================================
  // Test D: Builder bevarer laererens egne svar
  // =========================================================================
  test("D: Builder overskriver IKKE svar A naar laereren allerede har udfyldt det", async ({ page }) => {
    test.setTimeout(40_000);

    await setupDashboardContext(page.context());
    await page.context().route(/\/api\/music\/search/, async (route: Route) => {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ results: [MOCK_MUSIC_RESULT] }),
      });
    });

    await page.goto("/dashboard/opret/musikquiz", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByPlaceholder(/søg efter sang eller kunstner/i),
    ).toBeVisible({ timeout: 25_000 });

    // Skriv eget svar A
    const svar1 = page.getByPlaceholder("Svar 1");
    await svar1.fill("Mit eget A");
    await expect(svar1).toHaveValue("Mit eget A");

    // Soeg og vaelg sang
    await page.getByPlaceholder(/søg efter sang eller kunstner/i).fill("test");
    await page.getByRole("button", { name: /^søg$/i }).click();
    await expect(page.getByText("Test Song").first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /^vælg$/i }).first().click();

    // Svar A maa IKKE overskrives — handleSelectTrack() tjekker answerAIsEmpty
    await expect(svar1).toHaveValue("Mit eget A", { timeout: 5_000 });
  });

  // =========================================================================
  // Test E: Elevview viser audio men skjuler metadata
  // =========================================================================
  test("E: Elevview – audio vises, sangtitel/kunstner/artwork skjules for eleven", async ({ page }) => {
    test.setTimeout(55_000);

    const musikQuizQuestion = {
      type: "multiple_choice",
      text: "Hvad hedder sangen?",
      answers: ["Svar A", "Svar B", "Svar C", "Svar D"],
      correctIndex: 0,
      points: 10,
      lat: POST_LAT,
      lng: POST_LNG,
      previewUrl: "https://example.com/test-preview.m4a",
      trackName: "Secret Song Title",
      musicArtist: "Secret Artist",
      artworkUrl: "https://example.com/cover.jpg",
    };

    const state: MockState = { submitPayloads: [] };
    await mountPlayMocks(page.context(), [musikQuizQuestion], state);
    await openPlayPage(page, page.getByRole("button", { name: /^Svar A$/i }));

    // Bekraeft at "Lyt til musikklippet"-etiketten vises
    await expect(page.getByText(/Lyt til musikklippet/i)).toBeVisible({ timeout: 10_000 });

    // Bekraeft at audio-elementet med preview-URL er til stede
    await expect(
      page.locator('audio[src*="test-preview.m4a"]'),
    ).toBeAttached({ timeout: 5_000 });

    // Bekraeft at sangtitlen IKKE er synlig for eleven
    await expect(page.getByText("Secret Song Title")).not.toBeVisible({ timeout: 3_000 });

    // Bekraeft at kunstnernavnet IKKE er synligt
    await expect(page.getByText("Secret Artist")).not.toBeVisible({ timeout: 3_000 });

    // Bekraeft at artwork-billede IKKE er synligt for eleven
    await expect(page.locator('img[src*="cover.jpg"]')).toHaveCount(0, { timeout: 3_000 });
  });

  // =========================================================================
  // Test F: Musikquiz forkert svar gaar videre
  // =========================================================================
  test("F: Forkert svar pa musikquiz-post – 0 point – naeste post vises", async ({ page }) => {
    test.setTimeout(60_000);

    const questions = [
      {
        type: "multiple_choice",
        text: "Hvad hedder sangen?",
        answers: ["Rigtigt svar", "Forkert svar", "Distraktor C", "Distraktor D"],
        correctIndex: 0,
        points: 10,
        lat: POST_LAT,
        lng: POST_LNG,
        previewUrl: "https://example.com/test-preview.m4a",
        trackName: "Secret Song Title",
        musicArtist: "Secret Artist",
      },
      {
        type: "multiple_choice",
        text: "Post 2 er aktiv nu.",
        answers: ["Post2 svar", "Post2 forkert", "Post2 C", "Post2 D"],
        correctIndex: 0,
        points: 10,
        lat: POST_LAT,
        lng: POST_LNG,
      },
    ];

    const state: MockState = { submitPayloads: [] };
    await mountPlayMocks(page.context(), questions, state);
    await openPlayPage(page, page.getByRole("button", { name: /^Rigtigt svar$/i }));

    // Bekraeft at musikklip-labelen vises pa foerste post
    await expect(page.getByText(/Lyt til musikklippet/i)).toBeVisible({ timeout: 10_000 });

    // Klik forkert svar
    await page.getByRole("button", { name: /^Forkert svar$/i }).click();

    // Bekraeft "Desvaerre ... 0 point"
    await expect(page.getByText(/Desværre.*0 point/i)).toBeVisible({ timeout: 5_000 });

    // Bekraeft at appen gaar videre og viser naeste post
    await page.context().setGeolocation({
      latitude: POST_LAT,
      longitude: POST_LNG,
      accuracy: 5,
    });
    const nextAnswer = page.getByRole("button", { name: /^Post2 svar$/i });
    const nextOpenButton = page.getByRole("button", { name: /^åbn post/i });
    await expect(nextAnswer.or(nextOpenButton).first()).toBeVisible({
      timeout: 30_000,
    });
    if (!(await nextAnswer.isVisible())) {
      await nextOpenButton.click();
    }
    await expect(nextAnswer).toBeVisible({ timeout: 10_000 });

    // Bekraeft submit-payload
    await expect.poll(() => state.submitPayloads.length).toBe(1);
    expect(state.submitPayloads[0]).toMatchObject({
      post_index: 1,
      question_index: 0,
      is_correct: false,
      awarded_points: 0,
    });
  });
});
