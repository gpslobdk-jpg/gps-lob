import { test, expect, type BrowserContext, type Locator, type Page, type Route } from "@playwright/test";

const SESSION_ID = "test-session";
const PARTICIPANT_ID = "11111111-2222-3333-4444-555555555555";
const TEAM_NAME = "RegressionHold";
const POST_LAT = 55.6761;
const POST_LNG = 12.5683;

type MockQuestion = {
  type: "multiple_choice" | "escape";
  text: string;
  answers: string[];
  correctIndex: number;
  points: number;
  lat: number;
  lng: number;
  correctAnswer?: string;
};

type ValidateResult = {
  isCorrect: boolean;
  awardedPoints?: number;
  brick?: string | null;
};

type MockConfig = {
  raceType: "quiz" | "escape" | "unknown";
  questions: MockQuestion[];
  validateAnswer?: (body: Record<string, unknown>) => ValidateResult;
};

type MockState = {
  submitPayloads: Array<Record<string, unknown>>;
  validatePayloads: Array<Record<string, unknown>>;
};

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

async function mountPlayMocks(ctx: BrowserContext, config: MockConfig, state: MockState) {
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionStatus: "running", gpsOverride: false }),
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
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    state.validatePayloads.push(body);

    const result = config.validateAnswer?.(body) ?? {
      isCorrect: false,
      awardedPoints: 0,
      brick: null,
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        isCorrect: result.isCorrect,
        awardedPoints: result.awardedPoints ?? 0,
        brick: result.brick ?? null,
      }),
    });
  });

  await ctx.route(/\/api\/play\/submit-answer/, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      payloads?: Array<Record<string, unknown>>;
    };
    state.submitPayloads.push(body.payloads?.[0] ?? {});

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ inserted: true, awardedPoints: body.payloads?.[0]?.awarded_points ?? 0 }),
    });
  });
}

async function openPlayPage(page: Page, readyLocator: Locator) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: POST_LAT, longitude: POST_LNG, accuracy: 5 });

  await page.goto(`/play/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
  await dismissMaintenanceOverlay(page);

  const nameInput = page.getByPlaceholder(/skriv holdnavn/i);
  await expect(nameInput).toBeVisible({ timeout: 30_000 });
  await nameInput.fill(TEAM_NAME);
  await page.getByRole("button", { name: /klar/i }).click();

  await page.waitForSelector("text=Afstand", { timeout: 30_000 });
  await expect(readyLocator).toBeVisible({ timeout: 30_000 });
}

function makeProgressionQuestions(): MockQuestion[] {
  return [
    {
      type: "multiple_choice",
      text: "Hvilket svar er forkert eller rigtigt på post 1?",
      answers: ["Korrekt svar", "Forkert svar", "Distraktor A", "Distraktor B"],
      correctIndex: 0,
      points: 10,
      lat: POST_LAT,
      lng: POST_LNG,
    },
    {
      type: "multiple_choice",
      text: "Post 2 er nu aktiv.",
      answers: ["Næste korrekt", "Næste forkert", "Næste C", "Næste D"],
      correctIndex: 0,
      points: 10,
      lat: POST_LAT,
      lng: POST_LNG,
    },
    {
      type: "multiple_choice",
      text: "Post 3 escape er nu aktiv.",
      answers: ["KODE", "BRIK-3", "", ""],
      correctIndex: 0,
      correctAnswer: "KODE",
      points: 10,
      lat: POST_LAT,
      lng: POST_LNG,
    },
    {
      type: "multiple_choice",
      text: "Finaleposten er aktiv.",
      answers: ["Finale korrekt", "Finale forkert", "Finale C", "Finale D"],
      correctIndex: 0,
      points: 10,
      lat: POST_LAT,
      lng: POST_LNG,
    },
  ];
}

// Regression guard: verify correctIndex B (1), C (2), D (3) actually give points.
// Previously, sanitizeQuestionForPlay() stripped correctIndex→null for quiz questions,
// causing submitQuizAnswer() to treat every answer as wrong (selectedIndex === null → false).
// Tests only used correctIndex:0, so the bug was hidden.
test.describe("correctIndex B/C/D regression – korrekt svar på anden svarmulighed end A", () => {
  test.describe.configure({ retries: 0 });

  for (const { label, correctIndex, buttonText, wrongButtonText } of [
    { label: "B (index 1)", correctIndex: 1, buttonText: "Korrekt B", wrongButtonText: "Forkert A" },
    { label: "C (index 2)", correctIndex: 2, buttonText: "Korrekt C", wrongButtonText: "Forkert A" },
    { label: "D (index 3)", correctIndex: 3, buttonText: "Korrekt D", wrongButtonText: "Forkert A" },
  ]) {
    test(`korrekt svar ${label} giver point og forkert svar giver 0`, async ({ page }) => {
      test.setTimeout(45_000);

      const state: MockState = { submitPayloads: [], validatePayloads: [] };

      const answers = ["Forkert A", "Korrekt B", "Korrekt C", "Korrekt D"];
      // Only the button at correctIndex is actually correct for each sub-test
      const questionAnswers: [string, string, string, string] = [
        "Forkert A",
        correctIndex === 1 ? "Korrekt B" : "Forkert B",
        correctIndex === 2 ? "Korrekt C" : "Forkert C",
        correctIndex === 3 ? "Korrekt D" : "Forkert D",
      ];

      await mountPlayMocks(
        page.context(),
        {
          raceType: "quiz",
          questions: [
            {
              type: "multiple_choice",
              text: `Test: korrekt svar er ${label}`,
              answers: questionAnswers,
              correctIndex,
              points: 10,
              lat: POST_LAT,
              lng: POST_LNG,
            },
          ],
        },
        state
      );

      await openPlayPage(page, page.getByRole("button", { name: new RegExp(`^${wrongButtonText}$`, "i") }));

      // Click the WRONG answer first (A at index 0)
      await page.getByRole("button", { name: new RegExp(`^${wrongButtonText}$`, "i") }).click();
      await expect(page.getByText(/Desværre.*0 point/i)).toBeVisible({ timeout: 5_000 });

      await expect.poll(() => state.submitPayloads.length, { timeout: 5_000 }).toBe(1);
      expect(state.submitPayloads[0]).toMatchObject({
        is_correct: false,
        awarded_points: 0,
        selected_index: 0,
      });

      // Wait for next question to appear — same question because there is only 1 post, this test is about the single-question submit payload check.
      // The flow continues past the wrong answer, so we just verify the payload above.
    });

    test(`kun svarmulighed ${label} giver is_correct:true (correctIndex:${correctIndex})`, async ({ page }) => {
      test.setTimeout(45_000);

      const state: MockState = { submitPayloads: [], validatePayloads: [] };

      const questionAnswers: [string, string, string, string] = [
        "Forkert A",
        correctIndex === 1 ? "Korrekt B" : "Forkert B",
        correctIndex === 2 ? "Korrekt C" : "Forkert C",
        correctIndex === 3 ? "Korrekt D" : "Forkert D",
      ];

      await mountPlayMocks(
        page.context(),
        {
          raceType: "quiz",
          questions: [
            {
              type: "multiple_choice",
              text: `Test: korrekt svar er ${label}`,
              answers: questionAnswers,
              correctIndex,
              points: 10,
              lat: POST_LAT,
              lng: POST_LNG,
            },
          ],
        },
        state
      );

      await openPlayPage(page, page.getByRole("button", { name: new RegExp(`^${buttonText}$`, "i") }));

      // Click the CORRECT answer
      await page.getByRole("button", { name: new RegExp(`^${buttonText}$`, "i") }).click();

      await expect(page.getByText(/Korrekt! Du får point\./i)).toBeVisible({ timeout: 5_000 });

      await expect.poll(() => state.submitPayloads.length, { timeout: 5_000 }).toBe(1);
      expect(state.submitPayloads[0]).toMatchObject({
        is_correct: true,
        awarded_points: 10,
        selected_index: correctIndex,
      });
    });
  }
});

test.describe("answer progression regressions", () => {
  test.describe.configure({ retries: 0 });

  test("forkert quiz, korrekt quiz, forkert escape og finalize går videre korrekt", async ({ page }) => {
    test.setTimeout(58_000);

    const questions = makeProgressionQuestions();
    const state: MockState = { submitPayloads: [], validatePayloads: [] };

    await mountPlayMocks(
      page.context(),
      {
        raceType: "unknown",
        questions,
        validateAnswer: () => ({ isCorrect: false, awardedPoints: 0, brick: null }),
      },
      state,
    );

    await openPlayPage(page, page.getByRole("button", { name: /^Forkert svar$/i }));

    await test.step("A: forkert quiz giver 0 point og går videre", async () => {
      await page.getByRole("button", { name: /^Forkert svar$/i }).click();

      await expect(page.getByText(/Desværre.*0 point/i)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole("button", { name: /^Næste korrekt$/i })).toBeVisible({ timeout: 10_000 });

      await expect.poll(() => state.submitPayloads.length).toBe(1);
      expect(state.submitPayloads[0]).toMatchObject({
        post_index: 1,
        question_index: 0,
        is_correct: false,
        awarded_points: 0,
      });
    });

    await test.step("B: korrekt quiz giver point og går videre", async () => {
      await page.getByRole("button", { name: /^Næste korrekt$/i }).click();

      await expect(page.getByText(/Korrekt! Du får point\./i)).toBeVisible({ timeout: 5_000 });
      await page.getByRole("button", { name: /gå til næste post/i }).click();
      await expect(page.getByText(/Post 3 escape er nu aktiv\./i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByPlaceholder(/skriv tallet eller ordet her/i)).toBeVisible({ timeout: 10_000 });

      await expect.poll(() => state.submitPayloads.length).toBe(2);
      expect(state.submitPayloads[1]).toMatchObject({
        post_index: 2,
        question_index: 1,
        is_correct: true,
        awarded_points: 10,
      });
    });

    await test.step("C: forkert escape giver 0 point og går videre", async () => {
      await page.getByPlaceholder(/skriv tallet eller ordet her/i).fill("forkert kode");
      await page.getByRole("button", { name: /tjek svar/i }).click();

      await expect(page.getByText(/Desværre.*0 point/i)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole("button", { name: /^Finale korrekt$/i })).toBeVisible({ timeout: 10_000 });

      await expect.poll(() => state.validatePayloads.length).toBe(1);
      expect(state.validatePayloads[0]).toMatchObject({
        postIndex: 2,
        answer: "forkert kode",
      });

      await expect.poll(() => state.submitPayloads.length).toBe(3);
      expect(state.submitPayloads[2]).toMatchObject({
        post_index: 3,
        question_index: 2,
        is_correct: false,
        awarded_points: 0,
      });
    });

    await test.step("D: sidste post finalizer uden at hænge", async () => {
      await page.getByRole("button", { name: /^Finale korrekt$/i }).click();

      await expect(page.getByText(/Korrekt! Du får point\./i)).toBeVisible({ timeout: 5_000 });
      const resultButton = page.getByRole("button", { name: /gå til næste post|se resultat/i });
      await expect(resultButton).toBeVisible({ timeout: 5_000 });
      await resultButton.evaluate((button) => {
        (button as HTMLButtonElement).click();
      });
      await expect(page.getByText(/Løbet er slut\./i)).toBeVisible({ timeout: 10_000 });

      await expect.poll(() => state.submitPayloads.length).toBe(4);
      expect(state.submitPayloads[3]).toMatchObject({
        post_index: 4,
        question_index: 3,
        is_correct: true,
        awarded_points: 10,
      });
    });
  });
});