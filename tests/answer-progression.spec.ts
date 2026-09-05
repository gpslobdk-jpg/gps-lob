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
  postOrderMode?: "fixed" | "distributed_circular";
  startOffset?: number;
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
  const answeredPostIndexes = new Set<number>();
  const routeOrder = Array.from(
    { length: config.questions.length },
    (_, index) =>
      config.postOrderMode === "distributed_circular"
        ? ((config.startOffset ?? 0) + index) % config.questions.length
        : index
  );
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
        startOffset: config.startOffset ?? 0,
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
        postOrderMode: config.postOrderMode,
        usesStandardStudentLocationExperience:
          config.raceType === "quiz",
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
      body: JSON.stringify({ error: "Deltageren findes ikke." }),
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
    const submittedPayload = body.payloads?.[0] ?? {};
    state.submitPayloads.push(submittedPayload);
    const answeredPostIndex = Number(submittedPayload.question_index);
    if (Number.isInteger(answeredPostIndex) && answeredPostIndex >= 0) {
      answeredPostIndexes.add(answeredPostIndex);
    }
    const expectedPostIndex =
      routeOrder.find((postIndex) => !answeredPostIndexes.has(postIndex)) ?? null;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        inserted: true,
        awardedPoints: submittedPayload.awarded_points ?? 0,
        serverCorrectness: {
          checked: true,
          isCorrect: submittedPayload.is_correct === true,
        },
        answeredPostIndexes: [...answeredPostIndexes].sort((a, b) => a - b),
        expectedPostIndex,
        isFinished: expectedPostIndex === null,
      }),
    });
  });
}

async function openCurrentPost(
  page: Page,
  readyLocator: Locator,
  expectedProgressLabel?: RegExp
) {
  if (expectedProgressLabel) {
    await expect(
      page.getByText(expectedProgressLabel).first(),
      "Forventede at progressionen skiftede til den korrekte rutepost før GPS-opdateringen."
    ).toBeVisible({ timeout: 30_000 });
  }

  await page.context().setGeolocation({ latitude: POST_LAT, longitude: POST_LNG, accuracy: 5 });

  const arrivedCard = page.getByRole("status").filter({ hasText: "Du er fremme!" });
  const legacyOpenButton = page.getByRole("button", { name: /^åbn post$/i });
  await expect(
    readyLocator.or(arrivedCard).or(legacyOpenButton).first(),
    "Forventede enten den aktuelle posts svar eller knappen “Åbn post” ved 0 meter."
  ).toBeVisible({ timeout: 30_000 });

  if (await readyLocator.isVisible()) {
    return;
  }

  if (await legacyOpenButton.isVisible()) {
    await legacyOpenButton.click();
    await expect(
      readyLocator,
      "Forventede den aktuelle posts svar efter ét klik på “Åbn post”."
    ).toBeVisible({ timeout: 30_000 });
    return;
  }

  await expect(
    arrivedCard,
    "Eleven var 0 meter fra posten, men hverken svarmuligheder eller knappen “Åbn post” var synlig."
  ).toBeVisible({ timeout: 30_000 });
  await arrivedCard.getByRole("button", { name: /^åbn post$/i }).click();
  await expect(
    readyLocator,
    "Forventede den aktuelle posts svar efter ét klik på “Åbn post”."
  ).toBeVisible({ timeout: 30_000 });
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

  await openCurrentPost(page, readyLocator);
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

      // Fire two synchronous taps. The submission ref lock must keep this at one
      // logical operation even before React has rendered the disabled state.
      await page.evaluate(
        ({ firstText, secondText }) => {
          const buttons = Array.from(
            document.querySelectorAll<HTMLButtonElement>("button")
          );
          const first = buttons.find(
            (button) =>
              button.getAttribute("aria-label") === firstText ||
              button.textContent?.trim() === firstText
          );
          const second = buttons.find(
            (button) =>
              button.getAttribute("aria-label") === secondText ||
              button.textContent?.trim() === secondText
          );
          if (!first || !second) {
            throw new Error("Svarmulighederne kunne ikke findes.");
          }
          first.click();
          second.click();
        },
        { firstText: wrongButtonText, secondText: buttonText }
      );
      await expect(
        page.getByText(/Desværre.*0 point|Det var ikke det rigtige svar/i),
      ).toBeVisible({ timeout: 5_000 });

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
      await openCurrentPost(
        page,
        page.getByRole("button", { name: /^Næste korrekt$/i }),
        /^(?:Find )?post 2 af 4$/i
      );
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
      await openCurrentPost(
        page,
        page.getByText(/Post 3 escape er nu aktiv\./i),
        /^(?:Find )?post 3 af 4$/i
      );
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
      await openCurrentPost(
        page,
        page.getByRole("button", { name: /^Finale korrekt$/i }),
        /^(?:Find )?post 4 af 4$/i
      );
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

// ---------------------------------------------------------------------------
// Regression guard: auth-rebind MUST NOT reset currentPostIndex to post 1
// ---------------------------------------------------------------------------
//
// Root cause (Failure Point A from audit):
//   registerParticipantIdentity() — called during auth-rebind (visibility_resume
//   → recoverWakeUpState → recoverParticipantAuthSession → rebind path) — contained
//   an unconditional setCurrentPostIndex(initialRouteOrder[0] ?? 0) that reset
//   every student's UI to post 1 whenever their phone screen was woken between posts.
//
// Fix: guard with answeredPostIndexesRef.current.length === 0 so only a genuine
//   first join (no answers yet) sets the initial post; auth-rebind during active
//   play is ignored.
//
// Trigger mechanism in test:
//   In the test browser context there is no real Supabase auth session, so
//   supabase.auth.refreshSession() immediately returns no user. This causes
//   recoverParticipantAuthSession() to fall through to the rebind path and call
//   registerParticipantIdentity() — exactly the production failure scenario.
//   Dispatching a 'visibilitychange' event fires the recoverWakeUpState handler
//   and kicks off the chain.

test.describe("auth-rebind resetter ikke currentPostIndex under aktiv session", () => {
  test.describe.configure({ retries: 0 });

  test(
    "currentPostIndex forbliver 1 (post 2) efter visibility-resume auth-rebind — regression for Failure Point A",
    async ({ page }) => {
      test.setTimeout(60_000);

      const state: MockState = { submitPayloads: [], validatePayloads: [] };

      await mountPlayMocks(
        page.context(),
        {
          raceType: "quiz",
          questions: [
            {
              type: "multiple_choice",
              text: "Post 1: Hvad er 1+1?",
              answers: ["Korrekt post1", "Forkert B1", "Forkert C1", "Forkert D1"],
              correctIndex: 0,
              points: 10,
              lat: POST_LAT,
              lng: POST_LNG,
            },
            {
              type: "multiple_choice",
              text: "Post 2: Hvad er 2+2?",
              answers: ["Korrekt post2", "Forkert B2", "Forkert C2", "Forkert D2"],
              correctIndex: 0,
              points: 10,
              lat: POST_LAT,
              lng: POST_LNG,
            },
          ],
        },
        state
      );

      // GPS sættes til postens koordinater → auto-unlock åbner spørgsmål automatisk
      await openPlayPage(page, page.getByRole("button", { name: /^Korrekt post1$/i }));

      // Besvar post 1 korrekt
      await page.getByRole("button", { name: /^Korrekt post1$/i }).click();
      await expect(page.getByText(/Korrekt! Du får point\./i)).toBeVisible({ timeout: 5_000 });

      // Naviger til post 2
      await page
        .getByRole("button", { name: /gå til næste post/i })
        .click();

      // Vent på at React gemmer snapshot med currentPostIndex: 1 i localStorage.
      // Det bekræfter at staten faktisk er nået til post 2 inden vi trigrer rebind.
      await expect
        .poll(
          async () => {
            const raw = await page.evaluate(() =>
              localStorage.getItem("gpslob_active_play_snapshot")
            );
            if (!raw) return null;
            try {
              return (JSON.parse(raw) as { currentPostIndex?: number })
                .currentPostIndex;
            } catch {
              return null;
            }
          },
          { timeout: 8_000 }
        )
        .toBe(1);

      // Trigger auth-rebind:
      // Promise.all starter lytteren FØR eventen dispatches, så vi ikke misser svaret.
      // I test-browseren er der ingen Supabase-auth-session, så refreshSession() fejler
      // øjeblikkeligt → registerParticipantIdentity() → ny /api/join-request.
      const [_rebindResponse] = await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes("/api/join") &&
            resp.request().method() === "POST",
          { timeout: 15_000 }
        ),
        page.evaluate(() => {
          document.dispatchEvent(new Event("visibilitychange"));
        }),
      ]);

      // Giv React tid til at behandle eventuelle state-opdateringer fra rebind
      await page.waitForTimeout(500);

      // ── KRITISK ASSERTION ──────────────────────────────────────────────────
      // currentPostIndex MÅ IKKE resettes til 0 (post 1).
      // Før fix: registerParticipantIdentity() kaldte setCurrentPostIndex(0)
      //           → snapshot gemte currentPostIndex: 0 → eleven returnerede til post 1.
      // Efter fix: answeredPostIndexesRef.current.length === 1 → guard blokerer → ingen reset.
      const snapshotAfterRebind = await page.evaluate(() => {
        const raw = localStorage.getItem("gpslob_active_play_snapshot");
        if (!raw) return null;
        try {
          return JSON.parse(raw) as { currentPostIndex?: number };
        } catch {
          return null;
        }
      });

      expect(
        snapshotAfterRebind?.currentPostIndex,
        "currentPostIndex must remain 1 (post 2) after auth-rebind — must not reset to 0 (post 1)"
      ).toBe(1);
    }
  );
});

// ---------------------------------------------------------------------------
// Regression guard: start_offset = sidst mulige postindex må IKKE give
// for-tidlig færdigskærm (continueFromSolvedPost-bug)
// ---------------------------------------------------------------------------
//
// Bug: Med start_offset=3 og 4 poster er routeOrder=[3,0,1,2].
//      Eleven starter på post index 3. I den buggede version markerede
//      continueFromSolvedPost eleven færdig straks efter besvarelse af post 3,
//      fordi routeOrder (eller currentRouteStepIndex) ikke korrekt
//      afspejlede startOffset, og nextByLinearStep blev null.
//
// Fix: Safety net i continueFromSolvedPost tjekker nu, om alle poster i
//      routeOrder faktisk er besvaret, inden isFinished sættes til true.
//      Er de ikke alle besvaret, finder den næste ubesvarede post.
//
// Test-flow:
//   4 quiz-spørgsmål, start_offset=3 → routeOrder=[3,0,1,2]
//   1. Løs post 3 → IKKE færdig, næste = post 0
//   2. Løs post 0 → IKKE færdig, næste = post 1
//   3. Løs post 1 → IKKE færdig, næste = post 2
//   4. Løs post 2 → alle 4 besvaret → "Løbet er slut." vises
test.describe("start_offset=3 – sidst mulige startpost må ikke give for-tidlig færdigskærm", () => {
  test.describe.configure({ retries: 0 });

  test(
    "4 poster, start_offset=3: rute 3→0→1→2→færdig (regression: continueFromSolvedPost)",
    async ({ page }) => {
      test.setTimeout(90_000);

      const state: MockState = { submitPayloads: [], validatePayloads: [] };

      const questions: MockQuestion[] = [
        {
          type: "multiple_choice",
          text: "S3-Post0 er aktiv",
          answers: ["S3P0-Korrekt", "S3P0-F", "S3P0-G", "S3P0-H"],
          correctIndex: 0,
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
        },
        {
          type: "multiple_choice",
          text: "S3-Post1 er aktiv",
          answers: ["S3P1-Korrekt", "S3P1-F", "S3P1-G", "S3P1-H"],
          correctIndex: 0,
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
        },
        {
          type: "multiple_choice",
          text: "S3-Post2 er aktiv",
          answers: ["S3P2-Korrekt", "S3P2-F", "S3P2-G", "S3P2-H"],
          correctIndex: 0,
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
        },
        {
          type: "multiple_choice",
          text: "S3-Post3 starter her",
          answers: ["S3P3-Korrekt", "S3P3-F", "S3P3-G", "S3P3-H"],
          correctIndex: 0,
          points: 10,
          lat: POST_LAT,
          lng: POST_LNG,
        },
      ];

      await mountPlayMocks(
        page.context(),
        {
          raceType: "quiz",
          questions,
          postOrderMode: "distributed_circular",
          startOffset: 3,
        },
        state
      );

      // Override join-svar til start_offset=3.
      // Registreret EFTER mountPlayMocks → har forrang (Playwright LIFO-rækkefølge).
      await page.context().route(/\/api\/join/, async (route) => {
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
            startOffset: 3,
            sessionStatus: "running",
            teamId: null,
            teamColor: null,
          }),
        });
      });

      // routeOrder=[3,0,1,2] → startes på post index 3
      await openPlayPage(page, page.getByRole("button", { name: /^S3P3-Korrekt$/i }));

      await test.step("1: Løs post 3 → næste er post 0, IKKE færdigskærm", async () => {
        await page.getByRole("button", { name: /^S3P3-Korrekt$/i }).click();
        await expect(page.getByText(/Korrekt! Du får point\./i)).toBeVisible({ timeout: 5_000 });
        await page.getByRole("button", { name: /gå til næste post/i }).click();
        // Kritisk assertion: post 0 vises – IKKE "Løbet er slut."
        await openCurrentPost(
          page,
          page.getByText("S3-Post0 er aktiv"),
          /^(?:Find )?post 2 af 4$/i
        );
        await expect(page.getByText("S3-Post0 er aktiv")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/Løbet er slut\./i)).not.toBeVisible();
      });

      await test.step("2: Løs post 0 → næste er post 1, stadig ikke færdig", async () => {
        await page.getByRole("button", { name: /^S3P0-Korrekt$/i }).click();
        await expect(page.getByText(/Korrekt! Du får point\./i)).toBeVisible({ timeout: 5_000 });
        await page.getByRole("button", { name: /gå til næste post/i }).click();
        await openCurrentPost(
          page,
          page.getByText("S3-Post1 er aktiv"),
          /^(?:Find )?post 3 af 4$/i
        );
        await expect(page.getByText("S3-Post1 er aktiv")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/Løbet er slut\./i)).not.toBeVisible();
      });

      await test.step("3: Løs post 1 → næste er post 2, stadig ikke færdig", async () => {
        await page.getByRole("button", { name: /^S3P1-Korrekt$/i }).click();
        await expect(page.getByText(/Korrekt! Du får point\./i)).toBeVisible({ timeout: 5_000 });
        await page.getByRole("button", { name: /gå til næste post/i }).click();
        await openCurrentPost(
          page,
          page.getByText("S3-Post2 er aktiv"),
          /^(?:Find )?post 4 af 4$/i
        );
        await expect(page.getByText("S3-Post2 er aktiv")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/Løbet er slut\./i)).not.toBeVisible();
      });

      await test.step("4: Løs post 2 → alle 4 besvaret → færdigskærm vises", async () => {
        await page.getByRole("button", { name: /^S3P2-Korrekt$/i }).click();
        await expect(page.getByText(/Korrekt! Du får point\./i)).toBeVisible({ timeout: 5_000 });
        const resultButton = page.getByRole("button", { name: /gå til næste post|se resultat/i });
        await expect(resultButton).toBeVisible({ timeout: 5_000 });
        await resultButton.evaluate((button) => {
          (button as HTMLButtonElement).click();
        });
        await expect(page.getByText(/Løbet er slut\./i)).toBeVisible({ timeout: 10_000 });
      });
    }
  );
});
