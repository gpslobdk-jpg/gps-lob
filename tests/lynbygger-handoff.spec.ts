import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

const TEACHER_USER_ID = "bbbbbbbb-1111-4222-8333-cccccccc0001";
const SUPABASE_COOKIE_NAMES = [
  "sb-localhost-auth-token",
  "sb-127-auth-token",
  "sb-xodrzahqdgbsssntupjt-auth-token",
];
const MANUEL_DRAFT_STORAGE_KEY = "draft_run_manuel";

type ManualDraftQuestion = {
  text?: unknown;
  answers?: unknown;
  correctIndex?: unknown;
  points?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type ManualDraftEnvelope = {
  data?: {
    title?: unknown;
    gradeLevels?: unknown;
    radius?: unknown;
    questions?: ManualDraftQuestion[];
    overrideRaceType?: unknown;
    lynbyggerPlacementStatus?: unknown;
    mapCenter?: unknown;
  };
};

function base64UrlEncode(value: unknown) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeSessionPayload() {
  return {
    access_token: "mock-lynbygger-access-token",
    token_type: "bearer",
    expires_in: 36000,
    expires_at: Math.floor(Date.now() / 1000) + 36000,
    refresh_token: "mock-lynbygger-refresh-token",
    user: {
      id: TEACHER_USER_ID,
      email: "lynbygger@test.dk",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Lynbygger Test Teacher" },
      created_at: "2024-01-01T00:00:00Z",
    },
  };
}

function makeAuthCookieValue() {
  return `base64-${base64UrlEncode(makeSessionPayload())}`;
}

function makeGeneratedRun(topic: string) {
  const questionTexts: Record<string, string[]> = {
    "Den Kolde Krig": [
      "Hvilken begivenhed blev et tydeligt symbol på Europas deling under Den Kolde Krig?",
      "Hvad var hovedformålet med NATO, da alliancen blev oprettet i 1949?",
      "Hvorfor blev Cubakrisen i 1962 særligt farlig?",
      "Hvad beskriver begrebet jerntæppet?",
      "Hvilken udvikling var med til at afslutte Den Kolde Krig?",
    ],
    Vulkaner: [
      "Hvad kaldes den smeltede stenmasse under Jordens overflade?",
      "Hvor opstår mange vulkaner?",
      "Hvad bliver magma kaldt, når det når Jordens overflade?",
      "Hvorfor kan aske fra vulkaner påvirke flytrafikken?",
      "Hvad er en skjoldvulkan kendt for?",
    ],
  };
  const questions = questionTexts[topic] ?? Array.from({ length: 5 }, (_, index) => `${topic}: fagligt spørgsmål ${index + 1}`);

  return {
    title: `Lynløb om ${topic}`,
    questions: questions.map((question, index) => ({
      question,
      options: [`Korrekt svar ${index + 1}`, "Svarmulighed B", "Svarmulighed C", "Svarmulighed D"],
      correctAnswer: `Korrekt svar ${index + 1}`,
    })),
  };
}

async function setupDashboardContext(ctx: BrowserContext) {
  const session = makeSessionPayload();
  const cookieValue = makeAuthCookieValue();

  await ctx.addCookies([
    ...SUPABASE_COOKIE_NAMES.flatMap((name) => [
      {
        name,
        value: cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      },
      {
        name: `${name}.0`,
        value: cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      },
    ]),
  ]);

  await ctx.addInitScript(() => {
    window.localStorage.setItem("gpslob_tour_finished", "true");
  });

  await ctx.routeWebSocket(/webpack-hmr/, (ws) => {
    ws.close();
  });

  await ctx.route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();

    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
      return;
    }

    if (url.includes("/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await ctx.route("**/realtime/**", async (route: Route) => {
    await route.abort("connectionrefused");
  });

  await ctx.route("**/rest/v1/**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: route.request().method() === "GET" ? "[]" : "{}",
    });
  });
}

async function readManualDraft(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ManualDraftEnvelope) : null;
  }, MANUEL_DRAFT_STORAGE_KEY);
}

async function openLynbygger(page: Page) {
  await page.goto("/dashboard/opret/lynbygger", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByTestId("lynbygger-page")).toBeVisible({ timeout: 20_000 });
}

test.use({ serviceWorkers: "block" });
test.use({ geolocation: { latitude: 55.4012, longitude: 11.3547 }, permissions: ["geolocation"] });

test.describe("Ultraenkel Lynbygger", () => {
  test.describe.configure({ retries: 0 });

  test.beforeEach(async ({ context }) => {
    await setupDashboardContext(context);
  });

  test("standardflowet viser kun emne, klassetrin og én generation-CTA", async ({ page }) => {
    await openLynbygger(page);

    await expect(page.getByLabel("Emne")).toBeVisible();
    await expect(page.getByLabel("Klassetrin")).toBeVisible();
    await expect(page.getByRole("button", { name: "⚡ Lav mit løb" })).toBeVisible();
    await expect(page.getByTestId("lynbygger-post-count")).toHaveCount(0);
    await expect(page.getByText(/breddegrad|længdegrad|lokal mvp|kladde-status/i)).toHaveCount(0);

    await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();
    await expect(page.getByTestId("lynbygger-error")).toHaveText("Skriv først, hvad eleverne skal arbejde med.");
    await expect(page.getByTestId("lynbygger-error")).toBeFocused();

    await page.getByLabel("Emne").fill("Vulkaner");
    await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();
    await expect(page.getByTestId("lynbygger-error")).toHaveText("Vælg klassetrin, før du laver løbet.");

    await expect(page.getByLabel("Klassetrin").locator("option")).toHaveCount(10);

    await page.route("**/api/manual-builder/interview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeGeneratedRun("Vulkaner")),
      });
    });
    await page.getByLabel("Klassetrin").selectOption("6. klasse");
    await page.getByLabel("Emne").press("Enter");
    await expect(page.getByTestId("lynbygger-placement-step")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AI-udkast – gennemgå spørgsmål og facit" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Lynbyggeren sparer dig tid, men AI kan tage fejl/),
    ).toBeVisible();
    await expect(page.locator('[data-testid^="lynbygger-draft-question-"]')).toHaveCount(5);
    await expect(page.getByTestId("lynbygger-teacher-approval")).not.toBeChecked();
    await expect(page.getByTestId("lynbygger-place-current")).toBeDisabled();
    await expect(page.getByTestId("lynbygger-place-manually")).toBeDisabled();
  });

  test("sender minimumsrequest, placerer fem poster og importerer kladden", async ({ page, context }) => {
    let capturedRequest: unknown = null;
    let savedRunPayload: Record<string, unknown> | null = null;
    const contentLeaks: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/Den Kolde Krig|Korrekt svar 1/u.test(text)) contentLeaks.push(`console:${text}`);
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
      // The configured run database is an intended destination. This exact POST
      // is intercepted below; content must still never reach telemetry/other URLs.
      const isExpectedRunSave = request.method() === "POST"
        && url.pathname === "/rest/v1/gps_runs"
        && url.hostname.endsWith(".supabase.co")
        && SUPABASE_COOKIE_NAMES.includes(`sb-${url.hostname.split(".")[0]}-auth-token`);
      const payload = `${request.url()} ${request.postData() ?? ""}`;
      if (!isLocal && !isExpectedRunSave && /Den Kolde Krig|Korrekt svar 1/u.test(payload)) {
        contentLeaks.push(`network:${url.hostname}`);
      }
    });
    await page.route("**/api/manual-builder/interview", async (route) => {
      capturedRequest = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeGeneratedRun("Den Kolde Krig")),
      });
    });
    await page.route("**/rest/v1/gps_runs**", async (route) => {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        savedRunPayload = Array.isArray(payload) ? (payload[0] as Record<string, unknown>) : payload;
        await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          savedRunPayload
            ? [
                {
                  id: "aaaaaaaa-2222-4333-8444-dddddddd0002",
                  user_id: TEACHER_USER_ID,
                  created_at: "2026-08-13T12:00:00.000Z",
                  ...savedRunPayload,
                },
              ]
            : [],
        ),
      });
    });
    await context.setGeolocation({ latitude: 55.4012, longitude: 11.3547, accuracy: 5 });

    await openLynbygger(page);
    await page.getByLabel("Emne").fill("  Den Kolde Krig  ");
    await page.getByLabel("Klassetrin").selectOption("8. klasse");
    await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();

    await expect(page.getByTestId("lynbygger-placement-step")).toBeVisible();
    await expect(page.locator('[data-testid^="lynbygger-draft-question-"]')).toHaveCount(5);
    expect(capturedRequest).toEqual({
      builderType: "manual",
      qualityMode: "strict",
      manualTopic: "Den Kolde Krig",
      gradeLevels: ["8. klasse"],
      count: 5,
    });

    const approval = page.getByTestId("lynbygger-teacher-approval");
    const firstDraftQuestion = page.getByTestId("lynbygger-draft-question-0");
    await expect(page.getByTestId("lynbygger-place-current")).toBeDisabled();
    await firstDraftQuestion.getByTestId("lynbygger-question-text-0").fill(
      "Hvilken by blev delt af en mur under Den Kolde Krig?",
    );
    await firstDraftQuestion.getByTestId("lynbygger-option-0-1").fill("Berlin");
    await firstDraftQuestion
      .getByRole("radio", { name: "Markér svar 2 som facit i spørgsmål 1" })
      .check();
    await approval.check();
    await expect(page.getByTestId("lynbygger-place-current")).toBeEnabled();

    await firstDraftQuestion.getByTestId("lynbygger-question-text-0").fill(
      "Hvilken by blev delt af Berlinmuren under Den Kolde Krig?",
    );
    await expect(approval).not.toBeChecked();
    await expect(page.getByTestId("lynbygger-place-current")).toBeDisabled();
    await approval.check();

    await page.getByTestId("lynbygger-place-current").click();
    await expect(page).toHaveURL(/\/dashboard\/opret\/manuel$/, { timeout: 45_000 });

    const importedDraft = await readManualDraft(page);
    const draft = importedDraft?.data;
    expect(draft?.title).toBe("Lynløb om Den Kolde Krig");
    expect(draft?.gradeLevels).toEqual(["8. klasse"]);
    expect(draft?.radius).toBe(15);
    expect(draft?.overrideRaceType).toBe("manuel");
    expect(draft?.lynbyggerPlacementStatus).toBe("placed");
    expect(draft?.questions).toHaveLength(5);

    for (const question of draft?.questions ?? []) {
      expect(Array.isArray(question.answers)).toBe(true);
      expect(question.answers).toHaveLength(4);
      expect(typeof question.correctIndex).toBe("number");
      expect(question.points).toBe(10);
      expect(typeof question.lat).toBe("number");
      expect(typeof question.lng).toBe("number");
      expect(Math.abs(Number(question.lat) - 55.4012)).toBeLessThan(0.002);
      expect(Math.abs(Number(question.lng) - 11.3547)).toBeLessThan(0.002);
    }

    await expect(page.locator('article[id^="manuel-post-"]')).toHaveCount(5, { timeout: 30_000 });
    await expect(page.getByTestId("lynbygger-placement-warning")).toHaveCount(0);

    await page.locator('input[placeholder*="store viden"]').first().fill("Den Kolde Krig – redigeret");
    await expect.poll(async () => (await readManualDraft(page))?.data?.title).toBe("Den Kolde Krig – redigeret");
    await expect.poll(async () => (await readManualDraft(page))?.data?.questions?.[0]).toMatchObject({
      text: "Hvilken by blev delt af Berlinmuren under Den Kolde Krig?",
      correctIndex: 1,
    });

    await page.getByRole("button", { name: "Gem løb i arkivet" }).click();
    await expect(page).toHaveURL(/\/dashboard\/arkiv$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "MIT LØBSARKIV" })).toBeVisible();
    await expect(page.getByText("Den Kolde Krig – redigeret")).toBeVisible();
    expect(savedRunPayload).toMatchObject({
      title: "Den Kolde Krig – redigeret",
      race_type: "manuel",
      radius: 15,
      questions: [
        expect.objectContaining({
          text: "Hvilken by blev delt af Berlinmuren under Den Kolde Krig?",
          answers: expect.arrayContaining(["Berlin"]),
          correctIndex: 1,
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
      ],
    });
    expect(contentLeaks).toEqual([]);
  });

  test("afvist geolocation åbner editoren uden København-default og med tydelig besked", async ({ page, context }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (
            _success: PositionCallback,
            error?: PositionErrorCallback | null,
          ) => error?.({ code: 1, message: "denied" } as GeolocationPositionError),
        },
      });
    });
    await page.route("**/api/manual-builder/interview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeGeneratedRun("Vulkaner")),
      });
    });
    await context.clearPermissions();

    await openLynbygger(page);
    await page.getByLabel("Emne").fill("Vulkaner");
    await page.getByLabel("Klassetrin").selectOption("6. klasse");
    await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();
    await expect(page.getByTestId("lynbygger-placement-step")).toBeVisible();
    await page.getByTestId("lynbygger-teacher-approval").check();
    await page.getByTestId("lynbygger-place-current").click();

    await expect(page).toHaveURL(/\/dashboard\/opret\/manuel$/, { timeout: 45_000 });
    const draft = (await readManualDraft(page))?.data;
    expect(draft?.lynbyggerPlacementStatus).toBe("missing");
    expect(draft?.mapCenter).toBeUndefined();
    for (const question of draft?.questions ?? []) {
      expect(question.lat).toBeNull();
      expect(question.lng).toBeNull();
    }

    await expect(page.getByTestId("lynbygger-placement-warning")).toContainText(
      "Placér hver post på kortet, før du gemmer.",
    );
  });

  test("manglende geolocation åbner også editoren uden placerede poster", async ({ page, context }) => {
    await context.clearPermissions();
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "geolocation", {
        configurable: true,
        value: undefined,
      });
    });
    await page.route("**/api/manual-builder/interview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeGeneratedRun("Brøker")),
      });
    });

    await openLynbygger(page);
    await page.getByLabel("Emne").fill("Brøker");
    await page.getByLabel("Klassetrin").selectOption("5. klasse");
    await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();
    await page.getByTestId("lynbygger-teacher-approval").check();
    await page.getByTestId("lynbygger-place-current").click();

    await expect(page).toHaveURL(/\/dashboard\/opret\/manuel$/, { timeout: 45_000 });
    const draft = (await readManualDraft(page))?.data;
    expect(draft?.lynbyggerPlacementStatus).toBe("missing");
    expect(draft?.mapCenter).toBeUndefined();
    expect(draft?.questions?.every((question) => question.lat === null && question.lng === null)).toBe(true);
    await expect(page.getByTestId("lynbygger-placement-warning")).toBeVisible();
  });

  test("loading låser dobbeltgenerering og serverfejl giver rolig retry", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/manual-builder/interview", async (route) => {
      requestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "internal_detail_must_not_reach_ui" }),
      });
    });

    await openLynbygger(page);
    await page.getByLabel("Emne").fill("Demokrati");
    await page.getByLabel("Klassetrin").selectOption("9. klasse");
    await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();

    await expect(page.getByRole("button", { name: /Laver dit løb om Demokrati/ })).toBeDisabled();
    await page.getByLabel("Emne").press("Enter");
    await expect(page.getByRole("status")).toContainText("fem spørgsmål");
    await expect(page.getByTestId("lynbygger-error")).toHaveText("Løbet kunne ikke laves lige nu. Prøv igen.");
    await expect(page.getByRole("button", { name: "Prøv igen" })).toBeEnabled();
    expect(requestCount).toBe(1);
    await expect(page.getByText("internal_detail_must_not_reach_ui")).toHaveCount(0);
  });

  test("usikker AI-generering afvises med en tydelig og rolig besked", async ({ page }) => {
    await page.route("**/api/manual-builder/interview", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: "internal_quality_detail_must_not_reach_ui" }),
      });
    });

    await openLynbygger(page);
    await page.getByLabel("Emne").fill("Eventyr");
    await page.getByLabel("Klassetrin").selectOption("4. klasse");
    await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();

    await expect(page.getByTestId("lynbygger-error")).toHaveText(
      "Løbet kunne ikke laves sikkert lige nu. Prøv igen.",
    );
    await expect(page.getByText("internal_quality_detail_must_not_reach_ui")).toHaveCount(0);
  });
  for (const failFocusSave of [false, true]) {
    test(failFocusSave ? "Fokusmode fejl afbryder ikke gemning af Lynbygger-løb" : "Fokusmode følger Lynbygger-kladden og gemmes efter løbet", async ({ page }) => {
      const runId = "aaaaaaaa-2222-4333-8444-dddddddd0012";
      let runSaved = false;
      let focusRequest: unknown = null;
      await page.route("**/api/manual-builder/interview", (route) => route.fulfill({ json: makeGeneratedRun("Vulkaner") }));
      await page.route("**/rest/v1/gps_runs**", async (route) => {
        if (route.request().method() === "POST") {
          runSaved = true;
          await route.fulfill({ status: 201, json: [{ id: runId }] });
        } else await route.fulfill({ json: [] });
      });
      await page.route("**/api/focus-mode/run**", async (route) => {
        expect(runSaved).toBe(true);
        focusRequest = route.request().postDataJSON();
        await route.fulfill({ status: failFocusSave ? 503 : 200, json: { available: !failFocusSave, enabled: !failFocusSave } });
      });
      await openLynbygger(page);
      await expect(page.getByRole("switch", { name: "Fokusmode" })).toHaveCount(0);
      await page.getByLabel("Emne").fill("Vulkaner");
      await page.getByLabel("Klassetrin").selectOption("6. klasse");
      await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();
      const toggle = page.getByRole("switch", { name: "Fokusmode" });
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await page.getByTestId("focus-mode-setting").locator("summary").click();
      await expect(page.getByText(/Vi kan ikke se, hvad eleven åbner eller besøger/)).toBeVisible();
      await expect(page.getByText(/Bed eleverne om kun at have én telefon/)).toBeVisible();
      await page.getByTestId("lynbygger-teacher-approval").check();
      await page.getByTestId("lynbygger-place-current").click();
      await expect(page).toHaveURL(/\/dashboard\/opret\/manuel$/, { timeout: 30_000 });
      await expect(page.getByRole("switch", { name: "Fokusmode" })).toHaveAttribute("aria-checked", "true");
      await page.getByRole("button", { name: "Gem løb i arkivet" }).click();
      await expect(page).toHaveURL(/\/dashboard\/arkiv$/, { timeout: 30_000 });
      expect(focusRequest).toEqual({ runId, enabled: true });
      if (failFocusSave) await expect(page.getByRole("status").filter({ hasText: "Løbet er gemt, men Fokusmode kunne ikke gemmes" })).toBeVisible();
      else await expect(page.getByText("Løbet er gemt, men Fokusmode kunne ikke gemmes", { exact: false })).toHaveCount(0);
    });
  }

  test("Fokusmode live viser neutrale tal, global toggle og individuel undtagelse", async ({ page }, testInfo) => {
    const sessionId = "aaaaaaaa-2222-4333-8444-dddddddd0022";
    const participantId = "aaaaaaaa-2222-4333-8444-dddddddd0023";
    const state = { available: true, enabled: false, participants: [{ participantId, displayName: "Testhold Blå", excluded: false, eventCount: 2, latestEventAt: "2026-09-05T08:00:00Z", latestDurationMs: 14000 }] };
    const changes: unknown[] = [];
    await page.route("**/api/focus-mode/session**", async (route) => {
      if (route.request().method() === "PATCH") {
        const change = route.request().postDataJSON();
        changes.push(change);
        if (typeof change.enabled === "boolean") state.enabled = change.enabled;
        if (change.participantId === participantId) state.participants[0].excluded = change.excluded;
      }
      await route.fulfill({ json: state });
    });
    await page.route("**/rest/v1/live_sessions**", (route) => route.fulfill({ json: { id: sessionId, status: "waiting", pin: "123456", run_id: null } }));
    await page.route("**/api/dashboard/live/theme**", (route) => route.fulfill({ json: { theme: null } }));
    await page.goto('/dashboard/live/' + sessionId, { waitUntil: "domcontentloaded" });
    const panel = page.getByRole("complementary", { name: "Fokusmode i livevisningen" });
    await panel.getByRole("button", { name: "Fokusmode: Fra", exact: true }).click();
    const toggle = panel.getByRole("switch", { name: "Fokusmode" });
    await expect(toggle).toBeEnabled();
    await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(panel.getByText("Forlod SkoleGPS 2 gange")).toBeVisible();
    await expect(panel.getByText("Senest: 14 sek.")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("focus-live-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    const panelBounds = await panel.boundingBox();
    expect(panelBounds).not.toBeNull();
    expect(panelBounds!.x).toBeGreaterThanOrEqual(0);
    expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath("focus-live-mobile.png") });
    const exemption = panel.getByRole("checkbox", { name: "Ignorér fokusregistrering for Testhold Blå" });
    await exemption.click();
    await expect(exemption).toBeChecked();
    await expect(panel.getByText("Fokusregistrering er undtaget")).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(changes).toEqual([{ sessionId, enabled: true }, { sessionId, participantId, excluded: true }, { sessionId, enabled: false }]);
  });

});
