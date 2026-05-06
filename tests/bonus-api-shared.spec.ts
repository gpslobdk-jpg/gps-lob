/**
 * tests/bonus-api-shared.spec.ts
 *
 * Unit-tests for rene hjælpefunktioner i app/api/bonus/_shared.ts.
 * Ingen Supabase, ingen HTTP, ingen browser.
 *
 * Funktioner der testes:
 *   - toClientSafeQuestion()  — security boundary (correct_index aldrig ud)
 *   - runIdToSeed()           — deterministisk seed fra UUID
 *   - asTrimmedString()       — input-validering
 *
 * Kritisk kontrakt:
 *   toClientSafeQuestion() er det ENESTE sted correct_index strippes.
 *   Disse tests verificerer at kontrakten holder under alle edge cases.
 */

import { test, expect } from "@playwright/test";
import {
  toClientSafeQuestion,
  runIdToSeed,
  asTrimmedString,
  type BonusQuestionRow,
  type BonusQuestionClientSafe,
} from "@/app/api/bonus/_shared";

// ============================================================================
// Fixtures
// ============================================================================

/** En komplet BonusQuestionRow (som den kommer fra DB — indeholder correct_index) */
function makeDbRow(overrides?: Partial<BonusQuestionRow>): BonusQuestionRow {
  return {
    id: "aaaabbbb-1111-2222-3333-ccccddddeeee",
    gps_run_id: "run-id-0000-0000-0000-000000000000",
    question_index: 3,
    source_post_index: 2,
    variant: "recall_direct",
    question_text: "Hvad er Danmarks hovedstad?",
    answers: ["København", "Aarhus", "Odense", "Aalborg"],
    correct_index: 0,   // ← dette felt MÅ ALDRIG returneres til klienten
    points: 10,
    media_url: null,
    created_at: "2026-05-06T10:00:00.000Z",
    ...overrides,
  };
}

// ============================================================================
// 1. toClientSafeQuestion — core security tests
// ============================================================================

test.describe("toClientSafeQuestion — security boundary", () => {
  test("1a. correct_index er IKKE i output-objektet", () => {
    const row = makeDbRow({ correct_index: 2 });
    const result = toClientSafeQuestion(row);

    // Primær sikkerhedstest: correct_index må ikke eksistere som key
    expect(Object.keys(result)).not.toContain("correct_index");
    expect(Object.keys(result)).not.toContain("correctIndex");

    // Også: resultatet skal ikke have en 'correct_index' property på nogen form
    const asAny = result as Record<string, unknown>;
    expect(asAny["correct_index"]).toBeUndefined();
    expect(asAny["correctIndex"]).toBeUndefined();
  });

  test("1b. correct_index = 0 lækker ikke (edge case: falsy value)", () => {
    const row = makeDbRow({ correct_index: 0 });
    const result = toClientSafeQuestion(row);
    const asAny = result as Record<string, unknown>;
    expect(asAny["correct_index"]).toBeUndefined();
    expect(asAny["correctIndex"]).toBeUndefined();
  });

  test("1c. correct_index = 3 lækker ikke (edge case: max value)", () => {
    const row = makeDbRow({ correct_index: 3 });
    const result = toClientSafeQuestion(row);
    const asAny = result as Record<string, unknown>;
    expect(asAny["correct_index"]).toBeUndefined();
  });

  test("1d. Output indeholder kun de forventede client-safe nøgler", () => {
    const row = makeDbRow();
    const result = toClientSafeQuestion(row);
    const keys = Object.keys(result).sort();

    // Præcis disse felter — ikke mere, ikke mindre
    const expectedKeys: (keyof BonusQuestionClientSafe)[] = [
      "id",
      "questionIndex",
      "sourcePostIndex",
      "variant",
      "questionText",
      "answers",
      "points",
      "mediaUrl",
    ];
    expect(keys).toEqual(expectedKeys.sort());
  });

  test("1e. gps_run_id lækker ikke (intern felt)", () => {
    const row = makeDbRow();
    const result = toClientSafeQuestion(row);
    const asAny = result as Record<string, unknown>;
    expect(asAny["gps_run_id"]).toBeUndefined();
    expect(asAny["gpsRunId"]).toBeUndefined();
  });

  test("1f. created_at lækker ikke (intern felt)", () => {
    const row = makeDbRow();
    const result = toClientSafeQuestion(row);
    const asAny = result as Record<string, unknown>;
    expect(asAny["created_at"]).toBeUndefined();
    expect(asAny["createdAt"]).toBeUndefined();
  });
});

// ============================================================================
// 2. toClientSafeQuestion — korrekt mapping
// ============================================================================

test.describe("toClientSafeQuestion — korrekt dataMapping", () => {
  test("2a. Felter er i camelCase (ikke snake_case)", () => {
    const row = makeDbRow();
    const result = toClientSafeQuestion(row);

    expect(result.questionIndex).toBeDefined();
    expect(result.sourcePostIndex).toBeDefined();
    expect(result.questionText).toBeDefined();
    expect(result.mediaUrl).toBeDefined();

    const asAny = result as Record<string, unknown>;
    expect(asAny["question_index"]).toBeUndefined();
    expect(asAny["source_post_index"]).toBeUndefined();
    expect(asAny["question_text"]).toBeUndefined();
    expect(asAny["media_url"]).toBeUndefined();
  });

  test("2b. id bevares uændret", () => {
    const row = makeDbRow({ id: "test-id-1234" });
    expect(toClientSafeQuestion(row).id).toBe("test-id-1234");
  });

  test("2c. questionIndex mapper fra question_index", () => {
    const row = makeDbRow({ question_index: 7 });
    expect(toClientSafeQuestion(row).questionIndex).toBe(7);
  });

  test("2d. sourcePostIndex mapper fra source_post_index", () => {
    const row = makeDbRow({ source_post_index: 5 });
    expect(toClientSafeQuestion(row).sourcePostIndex).toBe(5);
  });

  test("2e. sourcePostIndex er null når source_post_index er null", () => {
    const row = makeDbRow({ source_post_index: null });
    expect(toClientSafeQuestion(row).sourcePostIndex).toBeNull();
  });

  test("2f. questionText mapper fra question_text", () => {
    const row = makeDbRow({ question_text: "Hvad er 2+2?" });
    expect(toClientSafeQuestion(row).questionText).toBe("Hvad er 2+2?");
  });

  test("2g. answers mapper korrekt som string[]", () => {
    const row = makeDbRow({ answers: ["A", "B", "C", "D"] });
    expect(toClientSafeQuestion(row).answers).toEqual(["A", "B", "C", "D"]);
  });

  test("2h. answers er tom array når jsonb ikke er array", () => {
    const row = makeDbRow({ answers: null });
    expect(toClientSafeQuestion(row).answers).toEqual([]);
  });

  test("2i. mediaUrl er null når media_url er null", () => {
    const row = makeDbRow({ media_url: null });
    expect(toClientSafeQuestion(row).mediaUrl).toBeNull();
  });

  test("2j. mediaUrl mapper fra media_url", () => {
    const row = makeDbRow({ media_url: "https://example.com/img.jpg" });
    expect(toClientSafeQuestion(row).mediaUrl).toBe("https://example.com/img.jpg");
  });

  test("2k. points bevares", () => {
    const row = makeDbRow({ points: 20 });
    expect(toClientSafeQuestion(row).points).toBe(20);
  });

  test("2l. variant bevares", () => {
    const row = makeDbRow({ variant: "recall_post" });
    expect(toClientSafeQuestion(row).variant).toBe("recall_post");
  });
});

// ============================================================================
// 3. toClientSafeQuestion — ingen mutation
// ============================================================================

test.describe("toClientSafeQuestion — ingen mutation af input", () => {
  test("3a. Input-rækken muteres ikke", () => {
    const row = makeDbRow({ correct_index: 1 });
    const originalCorrectIndex = row.correct_index;
    toClientSafeQuestion(row);
    expect(row.correct_index).toBe(originalCorrectIndex);
  });

  test("3b. Ændringer i output-answers påvirker ikke input", () => {
    const row = makeDbRow({ answers: ["A", "B", "C", "D"] });
    const result = toClientSafeQuestion(row);
    result.answers.push("E");
    expect(Array.isArray(row.answers) ? (row.answers as string[]).length : 4).toBe(4);
  });
});

// ============================================================================
// 4. runIdToSeed — deterministisk
// ============================================================================

test.describe("runIdToSeed — deterministisk seed", () => {
  const RUN_ID_A = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const RUN_ID_B = "f9e8d7c6-b5a4-3210-fedc-ba9876543210";
  const RUN_ID_C = "00000000-0000-0000-0000-000000000001";

  test("4a. Samme UUID → samme seed (deterministisk)", () => {
    expect(runIdToSeed(RUN_ID_A)).toBe(runIdToSeed(RUN_ID_A));
  });

  test("4b. Samme UUID mange gange → altid identisk", () => {
    const seeds = Array.from({ length: 10 }, () => runIdToSeed(RUN_ID_A));
    const unique = new Set(seeds);
    expect(unique.size).toBe(1);
  });

  test("4c. Forskellige UUIDs → sandsynligvis forskellige seeds", () => {
    const seedA = runIdToSeed(RUN_ID_A);
    const seedB = runIdToSeed(RUN_ID_B);
    // Dette skal næsten altid holde (kun ens hvis hex-præfiks tilfældigvis matcher)
    expect(seedA).not.toBe(seedB);
  });

  test("4d. Output er et positivt heltal", () => {
    const seed = runIdToSeed(RUN_ID_A);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThan(0);
  });

  test("4e. Fallback til 42 ved ugyldig input", () => {
    expect(runIdToSeed("")).toBe(42);
    expect(runIdToSeed("ikke-et-uuid")).toBe(42);
  });

  test("4f. UUID med kun nuller bruger fallback 42", () => {
    // "00000000-..." → hex præfiks "00000000" → parseInt = 0 → fallback
    expect(runIdToSeed("00000000-0000-0000-0000-000000000000")).toBe(42);
  });

  test("4g. UUID C giver positivt seed", () => {
    const seed = runIdToSeed(RUN_ID_C);
    expect(seed).toBeGreaterThan(0);
    expect(Number.isInteger(seed)).toBe(true);
  });
});

// ============================================================================
// 5. asTrimmedString — input-validering
// ============================================================================

test.describe("asTrimmedString — input-validering", () => {
  test("5a. Trimmer whitespace fra begge ender", () => {
    expect(asTrimmedString("  hello  ")).toBe("hello");
  });

  test("5b. Returnerer tom streng ved null", () => {
    expect(asTrimmedString(null)).toBe("");
  });

  test("5c. Returnerer tom streng ved undefined", () => {
    expect(asTrimmedString(undefined)).toBe("");
  });

  test("5d. Returnerer tom streng ved tal", () => {
    expect(asTrimmedString(42)).toBe("");
  });

  test("5e. Returnerer tom streng ved objekt", () => {
    expect(asTrimmedString({ key: "value" })).toBe("");
  });

  test("5f. Returnerer tom streng ved array", () => {
    expect(asTrimmedString(["a", "b"])).toBe("");
  });

  test("5g. Bevarer ikke-whitespace indhold", () => {
    expect(asTrimmedString("MagicTeam")).toBe("MagicTeam");
  });

  test("5h. Tom streng forbliver tom", () => {
    expect(asTrimmedString("")).toBe("");
  });

  test("5i. Kun whitespace → tom streng", () => {
    expect(asTrimmedString("   \t\n  ")).toBe("");
  });
});

// ============================================================================
// 6. Security integration: simuler NextResponse.json med toClientSafeQuestion
// ============================================================================

test.describe("Security integration: JSON-serialisering lækker ikke correct_index", () => {
  test("6a. JSON.stringify af client-safe question indeholder ikke correct_index", () => {
    const row = makeDbRow({ correct_index: 2 });
    const clientSafe = toClientSafeQuestion(row);
    const json = JSON.stringify(clientSafe);

    // correct_index må ikke optræde i JSON-streng (hverken som snake_case eller camelCase)
    expect(json).not.toContain("correct_index");
    expect(json).not.toContain("correctIndex");
  });

  test("6b. JSON.stringify af liste af client-safe questions indeholder ikke correct_index", () => {
    const rows = [
      makeDbRow({ correct_index: 0 }),
      makeDbRow({ correct_index: 1, id: "bbbb-0000" }),
      makeDbRow({ correct_index: 3, id: "cccc-0000" }),
    ];
    const clientSafe = rows.map(toClientSafeQuestion);
    const json = JSON.stringify({ questions: clientSafe });

    expect(json).not.toContain("correct_index");
    expect(json).not.toContain("correctIndex");
  });

  test("6c. Spredt client-safe question indeholder ikke correct_index", () => {
    const row = makeDbRow({ correct_index: 1 });
    const spread = { ...toClientSafeQuestion(row) };
    const asAny = spread as Record<string, unknown>;

    expect(asAny["correct_index"]).toBeUndefined();
    expect(asAny["correctIndex"]).toBeUndefined();
  });
});
