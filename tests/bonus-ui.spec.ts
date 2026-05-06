/**
 * tests/bonus-ui.spec.ts
 *
 * Playwright E2E tests for /play/[sessionId]/bonus
 *
 * Alle bonus-API-kald er mocket med én enkelt page.route(/\/api\/bonus\//) per test
 * — ingen rigtig Supabase, ingen login, ingen production migration krævet.
 *
 * Strategi: brug ÉN catch-all route-handler per test for alle /api/bonus/* kald.
 * Det undgår problemer med multipel route-registrering i parallelle test-runs.
 *
 * Dækker:
 *   1.  Intro-skærm viser korrekt indhold
 *   2.  Start bonusquiz → første spørgsmål
 *   3.  Rigtigt svar → feedback med point
 *   3b. Næste spørgsmål vises efter rigtigt svar
 *   4.  Forkert svar → feedback + eleven går videre (ikke låst fast)
 *   5.  Sidste spørgsmål → finished-skærm
 *   6.  Leaderboard vises med rank og navne
 *   7.  403 bonus_disabled → rolig besked
 *   8.  422 too_few_posts → passende besked
 *   9.  Answer API-fejl → Spring over → næste spørgsmål (aldrig låst fast)
 *   10. Session allerede finished → finished-skærm direkte
 *   11. correctIndex er aldrig tilgængeligt på klienten
 */

import { test, expect, type Page } from "@playwright/test";

// ── Konstanter ────────────────────────────────────────────────────────────────

const SESSION_ID = "test-bonus-session";
const NAME = "Alberte";
const BONUS_URL = `/play/${SESSION_ID}/bonus?name=${encodeURIComponent(NAME)}`;
const BONUS_SESSION_ID = "bonus-sess-abc123";

// ── Mock-data ─────────────────────────────────────────────────────────────────

const Q1 = {
  id: "q-1",
  questionIndex: 1,
  questionText: "Hvad er 2 + 2?",
  answers: ["3", "4", "5", "6"],
  points: 10,
  mediaUrl: null,
  // NB: correctIndex er IKKE inkluderet — det returneres aldrig til klienten
};

const Q2 = {
  id: "q-2",
  questionIndex: 2,
  questionText: "Hvad er Jordens form?",
  answers: ["Flad", "Trekantet", "Rund", "Firkantet"],
  points: 10,
  mediaUrl: null,
};

const SESSION_ACTIVE = {
  bonusSessionId: BONUS_SESSION_ID,
  status: "active",
  currentIndex: 0,
  score: 0,
  totalQuestions: 2,
  isFinished: false,
  startedAt: "2026-05-06T10:00:00.000Z",
  finishedAt: null,
};

const SESSION_FINISHED = {
  bonusSessionId: BONUS_SESSION_ID,
  status: "finished",
  currentIndex: 2,
  score: 20,
  totalQuestions: 2,
  isFinished: true,
  startedAt: "2026-05-06T10:00:00.000Z",
  finishedAt: "2026-05-06T10:05:00.000Z",
};

const QUESTIONS_RESP = {
  questions: [Q1, Q2],
  totalQuestions: 2,
};

const FINISH_RESP = {
  status: "finished",
  score: 20,
  totalQuestions: 2,
  finishedAt: "2026-05-06T10:05:00.000Z",
};

const LEADERBOARD_RESP = {
  leaderboard: [
    {
      rank: 1,
      studentName: NAME,
      score: 20,
      totalQuestions: 2,
      finishedAt: "2026-05-06T10:05:00.000Z",
    },
    {
      rank: 2,
      studentName: "Anders",
      score: 10,
      totalQuestions: 2,
      finishedAt: "2026-05-06T10:06:00.000Z",
    },
  ],
  totalParticipants: 2,
};

// ── Route-mock hjælper ────────────────────────────────────────────────────────

type RouteResp = { status: number; body: unknown };
type AnswerFn = (callCount: number) => RouteResp;

interface BonusApiConfig {
  /** POST /api/bonus/session — response payload */
  session?: unknown;
  sessionStatus?: number;
  /** GET /api/bonus/questions */
  questions?: unknown;
  questionsStatus?: number;
  /** POST /api/bonus/answer — static payload or dynamic function(callCount) */
  answer?: unknown | AnswerFn;
  /** POST /api/bonus/finish */
  finish?: unknown;
  /** GET /api/bonus/leaderboard */
  leaderboard?: unknown;
  /** Intercept POST /api/bonus/answer for side-effects (e.g. leak detection) */
  onAnswerRequest?: (body: Record<string, unknown>) => void;
}

/**
 * Registrer ÉN catch-all route-handler for alle /api/bonus/* kald.
 * Undgår race conditions der kan opstå ved multipel page.route()-registrering
 * i parallelle Playwright-tests.
 */
async function setupBonusApiMock(page: Page, cfg: BonusApiConfig = {}) {
  let answerCallCount = 0;

  await page.route(/\/api\/bonus\//, (route) => {
    const urlObj = new URL(route.request().url());
    const path = urlObj.pathname;

    // ── /api/bonus/session ──────────────────────────────────────────────────
    if (path === "/api/bonus/session") {
      return route.fulfill({
        status: cfg.sessionStatus ?? 200,
        contentType: "application/json",
        body: JSON.stringify(cfg.session ?? SESSION_ACTIVE),
      });
    }

    // ── /api/bonus/questions ────────────────────────────────────────────────
    if (path === "/api/bonus/questions") {
      return route.fulfill({
        status: cfg.questionsStatus ?? 200,
        contentType: "application/json",
        body: JSON.stringify(cfg.questions ?? QUESTIONS_RESP),
      });
    }

    // ── /api/bonus/answer ───────────────────────────────────────────────────
    if (path === "/api/bonus/answer") {
      answerCallCount++;

      // Side-effect hook for correctIndex leak detection
      if (cfg.onAnswerRequest) {
        try {
          const body = route.request().postDataJSON() as Record<string, unknown>;
          cfg.onAnswerRequest(body);
        } catch {
          // postDataJSON can throw if body isn't JSON
        }
      }

      // Dynamic answer function
      if (typeof cfg.answer === "function") {
        const resp = (cfg.answer as AnswerFn)(answerCallCount);
        return route.fulfill({
          status: resp.status,
          contentType: "application/json",
          body: JSON.stringify(resp.body),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(cfg.answer ?? answerPayload(true, 10, false, 2)),
      });
    }

    // ── /api/bonus/finish ───────────────────────────────────────────────────
    if (path === "/api/bonus/finish") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(cfg.finish ?? FINISH_RESP),
      });
    }

    // ── /api/bonus/leaderboard ──────────────────────────────────────────────
    if (path === "/api/bonus/leaderboard") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(cfg.leaderboard ?? LEADERBOARD_RESP),
      });
    }

    // Ukendt bonus-route — lad den gå igennem
    return route.continue();
  });
}

// ── Rene hjælpefunktioner ─────────────────────────────────────────────────────

function answerPayload(
  isCorrect: boolean,
  score: number,
  isFinished: boolean,
  nextQuestionIndex: number
) {
  return {
    isCorrect,
    pointsAwarded: isCorrect ? 10 : 0,
    score,
    currentIndex: nextQuestionIndex - 1,
    isFinished,
    nextQuestionIndex,
  };
}

/** Naviger til bonus-siden og vent på at siden er loadet.
 *  Bruger "load" i stedet for "networkidle" — networkidle kan timeout
 *  når service workers er blokeret og Next.js Fast Refresh laver ekstra reload. */
async function gotoBonus(page: Page) {
  await page.goto(BONUS_URL, { waitUntil: "load" });
}

/** Klik på et svarknap der indeholder den givne tekst */
async function clickAnswer(page: Page, answerText: string) {
  await page.getByRole("button").filter({ hasText: answerText }).click();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Bonus UI — /play/[sessionId]/bonus", () => {
  // Blokér Next.js service worker (next-pwa) — den kan ellers intercepte fetch-kald
  // fra bonus-siden og forhindre Playwright's page.route() mocks i at virke.
  test.use({ serviceWorkers: "block" });

  // ── 1. Intro ───────────────────────────────────────────────────────────────

  test("1. Intro-skærm viser korrekt indhold", async ({ page }) => {
    await setupBonusApiMock(page);
    await gotoBonus(page);

    // Brug getByRole("heading") for at undgå match med Next.js route-announcer
    await expect(
      page.getByRole("heading", { name: "Færdig før de andre?" })
    ).toBeVisible();
    await expect(
      page.getByText(
        "Bonuspoint tæller ikke med i dit normale løbsresultat."
      )
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Start bonusquiz/i })
    ).toBeVisible();
    // Elevens navn vises i name-badge
    await expect(page.getByText(NAME).first()).toBeVisible();
    // Antal spørgsmål vises
    await expect(page.getByText(/2 spørgsmål/i)).toBeVisible();
  });

  // ── 2. Start quiz ──────────────────────────────────────────────────────────

  test("2. Klik Start bonusquiz → første spørgsmål vises", async ({ page }) => {
    await setupBonusApiMock(page);
    await gotoBonus(page);

    await page.getByRole("button", { name: /Start bonusquiz/i }).click();

    await expect(page.getByText(Q1.questionText)).toBeVisible();
    await expect(page.getByText(/Spørgsmål 1 af 2/i)).toBeVisible();
    // Alle 4 svarmuligheder vises som knapper
    for (const ans of Q1.answers) {
      await expect(
        page.getByRole("button").filter({ hasText: ans })
      ).toBeVisible();
    }
    // Score-pill vises (start: 0)
    await expect(page.getByText("⭐ 0")).toBeVisible();
  });

  // ── 3. Rigtigt svar ────────────────────────────────────────────────────────

  test("3. Rigtigt svar → feedback med point vises", async ({ page }) => {
    await setupBonusApiMock(page);
    await gotoBonus(page);

    await page.getByRole("button", { name: /Start bonusquiz/i }).click();
    await clickAnswer(page, "4");

    // FeedbackScreen viser "Rigtigt!" og "+10 point"
    await expect(page.getByText("Rigtigt!")).toBeVisible();
    await expect(page.getByText("+10 point")).toBeVisible();
  });

  // ── 3b. Næste spørgsmål ────────────────────────────────────────────────────

  test("3b. Efter rigtigt svar → næste spørgsmål vises", async ({ page }) => {
    await setupBonusApiMock(page);
    await gotoBonus(page);

    await page.getByRole("button", { name: /Start bonusquiz/i }).click();
    await clickAnswer(page, "4");
    await expect(page.getByText("Rigtigt!")).toBeVisible();

    await page.getByRole("button", { name: /næste spørgsmål/i }).click();

    await expect(page.getByText(Q2.questionText)).toBeVisible();
    await expect(page.getByText(/Spørgsmål 2 af 2/i)).toBeVisible();
  });

  // ── 4. Forkert svar ────────────────────────────────────────────────────────

  test("4. Forkert svar → feedback + eleven går videre (ikke låst)", async ({
    page,
  }) => {
    await setupBonusApiMock(page, {
      answer: answerPayload(false, 0, false, 2),
    });
    await gotoBonus(page);

    await page.getByRole("button", { name: /Start bonusquiz/i }).click();
    await clickAnswer(page, "3"); // klik forkert svar

    // Exact tekst — undgår strict mode match med running score "0 point"
    await expect(page.getByText("Ikke rigtigt")).toBeVisible();
    await expect(page.getByText("0 point denne gang")).toBeVisible();

    // Eleven er ikke låst fast — kan gå videre
    await page.getByRole("button", { name: /næste spørgsmål/i }).click();
    await expect(page.getByText(Q2.questionText)).toBeVisible();
  });

  // ── 5. Sidste spørgsmål afslutter ─────────────────────────────────────────

  test("5. Sidste spørgsmål → finished-skærm med score og rangliste-knap", async ({
    page,
  }) => {
    await setupBonusApiMock(page, {
      answer: (callCount: number) => ({
        status: 200,
        body: answerPayload(true, callCount * 10, callCount >= 2, callCount + 1),
      }),
    });
    await gotoBonus(page);

    // Q1
    await page.getByRole("button", { name: /Start bonusquiz/i }).click();
    await clickAnswer(page, "4");
    await expect(page.getByText("Rigtigt!")).toBeVisible();
    await page.getByRole("button", { name: /næste spørgsmål/i }).click();

    // Q2 (last)
    await expect(page.getByText(Q2.questionText)).toBeVisible();
    await clickAnswer(page, "Rund");
    await expect(page.getByText("Rigtigt!")).toBeVisible();

    // "Se dit resultat" vises i stedet for "Næste spørgsmål" på det sidste spørgsmål
    await expect(
      page.getByRole("button", { name: /Se dit resultat/i })
    ).toBeVisible();
    await page.getByRole("button", { name: /Se dit resultat/i }).click();

    // Finished screen
    await expect(page.getByText("Bonusspil slut!")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /rangliste/i })
    ).toBeVisible();
  });

  // ── 6. Leaderboard ─────────────────────────────────────────────────────────

  test("6. Leaderboard viser rank, medalje og elevnavne", async ({ page }) => {
    await setupBonusApiMock(page, {
      answer: (callCount: number) => ({
        status: 200,
        body: answerPayload(true, callCount * 10, callCount >= 2, callCount + 1),
      }),
    });
    await gotoBonus(page);

    // Gennemfør quiz
    await page.getByRole("button", { name: /Start bonusquiz/i }).click();
    await clickAnswer(page, "4");
    await page.getByRole("button", { name: /næste spørgsmål/i }).click();
    await clickAnswer(page, "Rund");
    await page.getByRole("button", { name: /Se dit resultat/i }).click();

    // Vis leaderboard
    await page.getByRole("button", { name: /rangliste/i }).click();

    await expect(page.getByText("🏅 Bonus-rangliste")).toBeVisible();
    // Rangliste-indhold (LEADERBOARD_RESP er default)
    await expect(page.getByText(NAME).first()).toBeVisible();
    await expect(page.getByText("Anders")).toBeVisible();
    await expect(page.getByText("🥇")).toBeVisible();
    await expect(page.getByText("🥈")).toBeVisible();
    // Opdatér-knap
    await expect(
      page.getByRole("button", { name: /Opdatér/i })
    ).toBeVisible();
  });

  // ── 7. 403 bonus_disabled ──────────────────────────────────────────────────

  test("7. 403 bonus_disabled → rolig besked + link tilbage til løbet", async ({
    page,
  }) => {
    await setupBonusApiMock(page, {
      session: { error: "Bonus er ikke aktiveret.", reason: "bonus_disabled" },
      sessionStatus: 403,
    });
    await gotoBonus(page);

    // Brug getByRole("heading") for at undgå Next.js route-announcer match
    await expect(
      page.getByRole("heading", { name: /Bonusspil utilgængeligt/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Bonusspillet er ikke slået til/i)
    ).toBeVisible();
    await expect(page.getByText(/Tilbage til løbet/i)).toBeVisible();
    // Ingen quiz-knap
    await expect(
      page.getByRole("button", { name: /Start bonusquiz/i })
    ).not.toBeVisible();
  });

  // ── 8. 422 too_few_posts ───────────────────────────────────────────────────

  test("8. 422 too_few_posts → passende fejl-besked", async ({ page }) => {
    await setupBonusApiMock(page, {
      session: { error: "For få poster.", reason: "too_few_posts" },
      sessionStatus: 422,
    });
    await gotoBonus(page);

    await expect(
      page.getByRole("heading", { name: /Bonusspil utilgængeligt/i })
    ).toBeVisible();
    await expect(page.getByText(/ikke nok spørgsmål/i)).toBeVisible();
    await expect(page.getByText(/Tilbage til løbet/i)).toBeVisible();
  });

  // ── 9. Answer API-fejl → Spring over ──────────────────────────────────────

  test("9. Answer API-fejl → Spring over → næste spørgsmål (aldrig låst)", async ({
    page,
  }) => {
    await setupBonusApiMock(page, {
      answer: (callCount: number) => {
        if (callCount === 1) {
          return { status: 500, body: { error: "Intern serverfejl" } };
        }
        return { status: 200, body: answerPayload(true, 10, false, 2) };
      },
    });
    await gotoBonus(page);

    await page.getByRole("button", { name: /Start bonusquiz/i }).click();
    await clickAnswer(page, "4"); // → første kald fejler med 500

    // Fejlpanel vises med "Prøv igen" og "Spring over"
    await expect(
      page.getByRole("button", { name: "Prøv igen" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Spring over/i })
    ).toBeVisible();

    // Klik "Spring over (0 point)"
    await page.getByRole("button", { name: /Spring over/i }).click();

    // Feedback: "Ikke rigtigt" er unique (undgår match med running score "0 point")
    await expect(page.getByText("Ikke rigtigt")).toBeVisible();

    // Klik næste
    await page.getByRole("button", { name: /næste spørgsmål/i }).click();

    // Q2 vises — eleven er IKKE låst fast ✅
    await expect(page.getByText(Q2.questionText)).toBeVisible();
  });

  // ── 10. Resume finished ────────────────────────────────────────────────────

  test("10. Session allerede finished → finished-skærm vises direkte", async ({
    page,
  }) => {
    await setupBonusApiMock(page, {
      session: SESSION_FINISHED,
    });
    await gotoBonus(page);

    // Ingen intro — finished-skærm direkte
    await expect(page.getByText("Bonusspil slut!")).toBeVisible();
    // Score fra SESSION_FINISHED.score = 20
    await expect(page.getByText("20")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /rangliste/i })
    ).toBeVisible();
  });

  // ── 11. correctIndex er aldrig eksponeret til klienten ────────────────────

  test("11. correctIndex er ikke tilgængeligt på klienten", async ({ page }) => {
    // Verifikation 1: mock-data har ikke correctIndex
    for (const q of QUESTIONS_RESP.questions) {
      const keys = Object.keys(q);
      expect(keys).not.toContain("correctIndex");
      expect(keys).not.toContain("correct_index");
    }

    // Verifikation 2: klienten sender aldrig correctIndex til /api/bonus/answer
    let correctIndexLeaked = false;
    await setupBonusApiMock(page, {
      onAnswerRequest: (body) => {
        if ("correctIndex" in body || "correct_index" in body) {
          correctIndexLeaked = true;
        }
      },
    });
    await gotoBonus(page);

    await page.getByRole("button", { name: /Start bonusquiz/i }).click();
    await clickAnswer(page, "4");
    await expect(page.getByText("Rigtigt!")).toBeVisible();

    // correctIndex er aldrig sendt til API ✅
    expect(correctIndexLeaked).toBe(false);
  });
});
