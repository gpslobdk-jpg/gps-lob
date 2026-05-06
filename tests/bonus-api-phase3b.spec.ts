/**
 * tests/bonus-api-phase3b.spec.ts
 *
 * Unit-tests for rene hjælpefunktioner fra Fase 3B API-routes.
 * Ingen Supabase, ingen HTTP, ingen browser.
 *
 * Testede funktioner:
 *   - rankBonusLeaderboard() fra /api/bonus/leaderboard/route.ts
 *     (eksporteret som ren funktion — testbar uden DB)
 *
 * Hvad der IKKE kan unit-testes uden Supabase:
 *   - POST /api/bonus/answer — kræver bonus_questions.correct_index fra DB
 *   - POST /api/bonus/finish — kræver bonus_sessions fra DB
 *   - GET /api/bonus/leaderboard — selve DB-forespørgslen
 *   - duplicate-submit håndtering (23505) — kræver DB-constraint
 *
 * Playwright-integration tests (kræver kørende DB) er planlagt
 * til Fase 5 (Playwright end-to-end tests).
 */

import { test, expect } from "@playwright/test";
import { rankBonusLeaderboard } from "@/app/api/bonus/_shared";

// ============================================================================
// Fixtures
// ============================================================================

type LeaderboardRow = {
  id: string;
  student_name: string;
  score: number;
  total_questions: number;
  finished_at: string | null;
};

function makeRow(overrides: Partial<LeaderboardRow> & { student_name: string; score: number }): LeaderboardRow {
  return {
    id: `id-${overrides.student_name}`,
    total_questions: 8,
    finished_at: "2026-05-06T10:00:00.000Z",
    ...overrides,
  };
}

// ============================================================================
// rankBonusLeaderboard
// ============================================================================

test.describe("rankBonusLeaderboard — ren funktion", () => {
  test("1a. Tom liste returnerer tom rangliste", () => {
    expect(rankBonusLeaderboard([])).toEqual([]);
  });

  test("1b. Én deltager får rank 1", () => {
    const result = rankBonusLeaderboard([
      makeRow({ student_name: "Hold A", score: 50 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.rank).toBe(1);
    expect(result[0]!.studentName).toBe("Hold A");
    expect(result[0]!.score).toBe(50);
  });

  test("1c. Rang er 1-baseret og kontinuerlig", () => {
    const rows = [
      makeRow({ student_name: "Hold A", score: 80 }),
      makeRow({ student_name: "Hold B", score: 60 }),
      makeRow({ student_name: "Hold C", score: 40 }),
    ];
    const result = rankBonusLeaderboard(rows);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  test("1d. studentName mapper fra student_name", () => {
    const rows = [makeRow({ student_name: "MagicTeam", score: 70 })];
    expect(rankBonusLeaderboard(rows)[0]!.studentName).toBe("MagicTeam");
  });

  test("1e. totalQuestions mapper fra total_questions", () => {
    const rows = [makeRow({ student_name: "A", score: 10, total_questions: 12 })];
    expect(rankBonusLeaderboard(rows)[0]!.totalQuestions).toBe(12);
  });

  test("1f. finishedAt mapper fra finished_at", () => {
    const ts = "2026-05-06T11:30:00.000Z";
    const rows = [makeRow({ student_name: "A", score: 10, finished_at: ts })];
    expect(rankBonusLeaderboard(rows)[0]!.finishedAt).toBe(ts);
  });

  test("1g. finishedAt er null når finished_at er null", () => {
    const rows = [makeRow({ student_name: "A", score: 10, finished_at: null })];
    expect(rankBonusLeaderboard(rows)[0]!.finishedAt).toBeNull();
  });

  test("1h. Rækkefølge er bevaret (pre-sorteret input)", () => {
    // rankBonusLeaderboard sorterer IKKE selv — det er DBs ansvar
    // Test at rækkefølgen bevares nøjagtigt som input
    const rows = [
      makeRow({ student_name: "Første", score: 80 }),
      makeRow({ student_name: "Anden", score: 60 }),
      makeRow({ student_name: "Tredje", score: 60 }),
    ];
    const result = rankBonusLeaderboard(rows);
    expect(result[0]!.studentName).toBe("Første");
    expect(result[1]!.studentName).toBe("Anden");
    expect(result[2]!.studentName).toBe("Tredje");
  });

  test("1i. Ingen mutation af input-array", () => {
    const rows = [
      makeRow({ student_name: "Hold A", score: 80 }),
      makeRow({ student_name: "Hold B", score: 60 }),
    ];
    const originalLength = rows.length;
    rankBonusLeaderboard(rows);
    expect(rows.length).toBe(originalLength);
    expect(rows[0]!.student_name).toBe("Hold A");
  });

  test("1j. Output-felter er i camelCase (ikke snake_case)", () => {
    const result = rankBonusLeaderboard([makeRow({ student_name: "A", score: 10 })]);
    const entry = result[0]!;
    const asAny = entry as Record<string, unknown>;

    // camelCase keys
    expect(entry.studentName).toBeDefined();
    expect(entry.totalQuestions).toBeDefined();
    expect(entry.finishedAt).toBeDefined();

    // snake_case keys IKKE til stede
    expect(asAny["student_name"]).toBeUndefined();
    expect(asAny["total_questions"]).toBeUndefined();
    expect(asAny["finished_at"]).toBeUndefined();
  });

  test("1k. JSON-serialisering indeholder ikke snake_case felter", () => {
    const result = rankBonusLeaderboard([makeRow({ student_name: "A", score: 10 })]);
    const json = JSON.stringify({ leaderboard: result });
    expect(json).not.toContain("student_name");
    expect(json).not.toContain("total_questions");
    expect(json).not.toContain("finished_at");
  });

  test("1l. 15 deltagere giver rang 1..15", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      makeRow({ student_name: `Hold ${i + 1}`, score: (15 - i) * 10 })
    );
    const result = rankBonusLeaderboard(rows);
    expect(result).toHaveLength(15);
    result.forEach((entry, i) => {
      expect(entry.rank).toBe(i + 1);
    });
  });
});

// ============================================================================
// Svar-validering: rene funktioner (hjælper-logik fra answer route)
// ============================================================================

test.describe("Bonus-svar beregningslogik (rene funktioner)", () => {
  // Disse tests verificerer den logik der bruges i POST /api/bonus/answer
  // uden at kræve DB-adgang. Vi tester dem som ren JavaScript.

  function calcPointsAwarded(isCorrect: boolean, questionPoints: number): number {
    return isCorrect ? questionPoints : 0;
  }

  function calcNewCurrentIndex(
    currentIndex: number,
    questionIndex: number,
    totalQuestions: number
  ): number {
    return Math.min(Math.max(currentIndex, questionIndex), totalQuestions);
  }

  function calcIsFinished(currentIndex: number, totalQuestions: number): boolean {
    return currentIndex >= totalQuestions;
  }

  test("2a. Rigtigt svar giver question.points", () => {
    expect(calcPointsAwarded(true, 10)).toBe(10);
    expect(calcPointsAwarded(true, 20)).toBe(20);
  });

  test("2b. Forkert svar giver 0 point", () => {
    expect(calcPointsAwarded(false, 10)).toBe(0);
    expect(calcPointsAwarded(false, 20)).toBe(0);
  });

  test("2c. current_index går fremad", () => {
    expect(calcNewCurrentIndex(2, 3, 8)).toBe(3);
    expect(calcNewCurrentIndex(5, 6, 8)).toBe(6);
  });

  test("2d. current_index går aldrig tilbage", () => {
    // Hvis eleven på en eller anden måde sender svar på spørgsmål 2 efter at have besvaret 5
    expect(calcNewCurrentIndex(5, 2, 8)).toBe(5);
  });

  test("2e. current_index overstiger aldrig total_questions", () => {
    expect(calcNewCurrentIndex(7, 8, 8)).toBe(8);
    expect(calcNewCurrentIndex(8, 9, 8)).toBe(8); // ikke muligt men robust
  });

  test("2f. isFinished er true når current_index == total_questions", () => {
    expect(calcIsFinished(8, 8)).toBe(true);
  });

  test("2g. isFinished er false når der er spørgsmål tilbage", () => {
    expect(calcIsFinished(7, 8)).toBe(false);
    expect(calcIsFinished(0, 8)).toBe(false);
  });

  test("2h. isFinished er true ved current_index > total_questions (edge case)", () => {
    expect(calcIsFinished(9, 8)).toBe(true);
  });
});
