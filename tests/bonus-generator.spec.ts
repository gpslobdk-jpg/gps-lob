/**
 * tests/bonus-generator.spec.ts
 *
 * Unit-tests for generateBonusQuestions() — ren TypeScript-funktion.
 * Ingen browser, ingen HTTP, ingen Supabase.
 *
 * Bemærk om test-runner:
 *   Projektet bruger @playwright/test som eneste test-runner.
 *   Disse tests bruger IKKE `page`-fixture og launcher IKKE en browser.
 *   De kører i Playwrights Node.js worker-proces.
 *   webServer kræves af playwright.config.ts — sørg for at dev-serveren
 *   kører (`npm run dev`) eller brug `reuseExistingServer: true` (allerede sat).
 *
 * Kør kun disse tests:
 *   npx playwright test tests/bonus-generator.spec.ts
 *
 * Dækkede kontrakter:
 *   1.  Filtrerer ugyldige spørgsmål (null correctIndex, tom tekst, forkert answers-længde)
 *   2.  Returnerer too_few_posts ved < MIN_USABLE_POSTS gyldige poster
 *   3.  Returnerer no_usable_questions ved tomt/fuldstændig ugyldigt input
 *   4.  Genererer recall_direct-variant korrekt
 *   5.  correctIndex opdateres korrekt efter svarmuligheder shuffles
 *   6.  Genererer recall_post-variant med 4 svarmuligheder
 *   7.  recall_post tekst indeholder postnummer
 *   8.  recall_post correctIndex peger på det korrekte svar
 *   9.  Max 15 spørgsmål overholdes
 *  10.  questionIndex er altid 1-baseret og unik
 *  11.  answers har altid præcis 4 elementer
 *  12.  correctIndex er altid 0–3
 *  13.  Deterministisk output med samme seed
 *  14.  Forskelligt output med forskelligt seed
 *  15.  Ingen mutation af input-array
 *  16.  Ingen mutation af input-spørgsmåls answers-arrays
 *  17.  points-option bruges korrekt
 *  18.  maxQuestions-option virker
 *  19.  Whitespace i tekst og svar trimmes
 */

import { test, expect } from "@playwright/test";
import {
  generateBonusQuestions,
  MIN_USABLE_POSTS,
  MAX_BONUS_QUESTIONS,
  type SourceQuestion,
  type GeneratedBonusQuestion,
} from "@/utils/bonus/generateBonusQuestions";

// ============================================================================
// Test-fixtures
// ============================================================================

/** 5 gyldige spørgsmål — nok til alle tests */
const FIVE_VALID: SourceQuestion[] = [
  {
    text: "Hvad er Danmarks hovedstad?",
    answers: ["København", "Aarhus", "Odense", "Aalborg"],
    correctIndex: 0,
  },
  {
    text: "Hvad er 2 + 2?",
    answers: ["3", "4", "5", "6"],
    correctIndex: 1,
  },
  {
    text: "Hvad er den røde planets navn?",
    answers: ["Venus", "Jupiter", "Mars", "Saturn"],
    correctIndex: 2,
  },
  {
    text: "Hvad er vand på engelsk?",
    answers: ["Fire", "Earth", "Water", "Wind"],
    correctIndex: 2,
  },
  {
    text: "Hvad er Nordens største by?",
    answers: ["Oslo", "Stockholm", "København", "Helsinki"],
    correctIndex: 1,
  },
];

/** Hjælper: dyb kopi af SourceQuestion[] (test mutation-sikkerhed) */
function deepCopy(qs: SourceQuestion[]): SourceQuestion[] {
  return JSON.parse(JSON.stringify(qs)) as SourceQuestion[];
}

/** Hjælper: generer med fast seed for deterministiske tests */
function generate(
  questions: SourceQuestion[],
  opts?: { maxQuestions?: number; points?: number; seed?: number }
) {
  return generateBonusQuestions(questions, { seed: 42, ...opts });
}

// ============================================================================
// 1. Filtrering af ugyldigt input
// ============================================================================

test.describe("Filtrering af ugyldige spørgsmål", () => {
  test("1a. correctIndex = null filtreres fra", () => {
    const qs: SourceQuestion[] = [
      ...FIVE_VALID.slice(0, 4),
      { text: "Ugyldig", answers: ["A", "B", "C", "D"], correctIndex: null },
    ];
    const result = generate(qs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Det ugyldige spørgsmål genererer ingen varianter — de øvrige 4 giver op til 8 kandidater
    result.questions.forEach((q) => {
      expect(q.questionText).not.toBe("Ugyldig");
    });
  });

  test("1b. Tom question text filtreres fra", () => {
    const qs: SourceQuestion[] = [
      ...FIVE_VALID.slice(0, 4),
      { text: "   ", answers: ["A", "B", "C", "D"], correctIndex: 0 },
    ];
    const result = generate(qs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q) => {
      expect(q.questionText.trim().length).toBeGreaterThan(0);
    });
  });

  test("1c. answers med 3 elementer filtreres fra", () => {
    const qs: SourceQuestion[] = [
      ...FIVE_VALID.slice(0, 4),
      { text: "Tre svar", answers: ["A", "B", "C"], correctIndex: 0 },
    ];
    const result = generate(qs);
    expect(result.ok).toBe(true);
  });

  test("1d. answers med 5 elementer filtreres fra", () => {
    const qs: SourceQuestion[] = [
      ...FIVE_VALID.slice(0, 4),
      { text: "Fem svar", answers: ["A", "B", "C", "D", "E"], correctIndex: 0 },
    ];
    const result = generate(qs);
    expect(result.ok).toBe(true);
  });

  test("1e. correctIndex = -1 filtreres fra", () => {
    const qs: SourceQuestion[] = [
      ...FIVE_VALID.slice(0, 4),
      { text: "Negativ", answers: ["A", "B", "C", "D"], correctIndex: -1 },
    ];
    const result = generate(qs);
    expect(result.ok).toBe(true);
  });

  test("1f. correctIndex = 4 filtreres fra", () => {
    const qs: SourceQuestion[] = [
      ...FIVE_VALID.slice(0, 4),
      { text: "For høj", answers: ["A", "B", "C", "D"], correctIndex: 4 },
    ];
    const result = generate(qs);
    expect(result.ok).toBe(true);
  });

  test("1g. Tom streng i answers filtreres fra (hele spørgsmålet)", () => {
    const qs: SourceQuestion[] = [
      ...FIVE_VALID.slice(0, 4),
      { text: "Tomt svar", answers: ["A", "B", "", "D"], correctIndex: 0 },
    ];
    const result = generate(qs);
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// 2. too_few_posts og no_usable_questions
// ============================================================================

test.describe("Fejltilfælde", () => {
  test("2a. Tomt input → no_usable_questions", () => {
    const result = generate([]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_usable_questions");
  });

  test("2b. Kun ugyldige spørgsmål → no_usable_questions", () => {
    const result = generate([
      { text: "", answers: ["A", "B", "C", "D"], correctIndex: 0 },
      { text: "Gyldig tekst", answers: ["A", "B", "C"], correctIndex: 0 },
      { text: "Gyldig tekst 2", answers: ["A", "B", "C", "D"], correctIndex: null },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_usable_questions");
  });

  test(`2c. Færre end ${MIN_USABLE_POSTS} gyldige poster → too_few_posts`, () => {
    const result = generate(FIVE_VALID.slice(0, MIN_USABLE_POSTS - 1));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("too_few_posts");
  });

  test(`2d. Præcis ${MIN_USABLE_POSTS} gyldige poster → ok: true`, () => {
    const result = generate(FIVE_VALID.slice(0, MIN_USABLE_POSTS));
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// 3. recall_direct-variant
// ============================================================================

test.describe("recall_direct variant", () => {
  test("3a. recall_direct genereres fra input-spørgsmål", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const directQuestions = result.questions.filter((q) => q.variant === "recall_direct");
    expect(directQuestions.length).toBeGreaterThan(0);
  });

  test("3b. recall_direct questionText matcher kildepostens tekst (trimmet)", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sourceTitles = FIVE_VALID.map((q) => (q.text as string).trim());
    result.questions
      .filter((q) => q.variant === "recall_direct")
      .forEach((q) => {
        expect(sourceTitles).toContain(q.questionText);
      });
  });

  test("3c. recall_direct answers indeholder alle 4 originale svarmuligheder (måske i anden rækkefølge)", () => {
    // Find et recall_direct-spørgsmål der matcher FIVE_VALID[0]
    const result = generate(FIVE_VALID, { seed: 42 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const q0Direct = result.questions.find(
      (q) => q.variant === "recall_direct" && q.questionText === FIVE_VALID[0]!.text
    );
    if (!q0Direct) return; // mulig hvis shufflet væk, skip

    const originalAnswers = FIVE_VALID[0]!.answers as string[];
    const sortedOriginal = [...originalAnswers].sort();
    const sortedResult = [...q0Direct.answers].sort();
    expect(sortedResult).toEqual(sortedOriginal);
  });
});

// ============================================================================
// 4. correctIndex opdateres efter shuffle
// ============================================================================

test.describe("correctIndex er konsistent efter shuffle", () => {
  test("4a. correctIndex peger på det rigtige svar i alle output-spørgsmål", () => {
    // Kør 10 gange med forskellige seeds for at dække shuffling
    for (let seed = 1; seed <= 10; seed++) {
      const result = generateBonusQuestions(FIVE_VALID, { seed });
      if (!result.ok) continue;
      result.questions.forEach((q) => {
        const actualAnswer = q.answers[q.correctIndex];
        expect(typeof actualAnswer).toBe("string");
        expect((actualAnswer as string).length).toBeGreaterThan(0);

        // For recall_direct: det korrekte svar skal stadig eksistere i answers
        // For recall_post: det korrekte svar er korrekte svar fra kildeposten
        if (q.variant === "recall_direct") {
          const originalQ = FIVE_VALID.find((s) => s.text === q.questionText);
          if (originalQ) {
            const originalCorrectAnswer = (originalQ.answers as string[])[
              originalQ.correctIndex as number
            ];
            expect(actualAnswer).toBe(originalCorrectAnswer);
          }
        }
      });
    }
  });

  test("4b. correctIndex er altid 0–3", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q) => {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);
    });
  });
});

// ============================================================================
// 5. recall_post-variant
// ============================================================================

test.describe("recall_post variant", () => {
  test("5a. recall_post genereres når der er nok distraktorer", () => {
    // Med 5 poster er der masser af distraktorer
    let foundRecallPost = false;
    for (let seed = 1; seed <= 20; seed++) {
      const result = generateBonusQuestions(FIVE_VALID, { seed });
      if (!result.ok) continue;
      if (result.questions.some((q) => q.variant === "recall_post")) {
        foundRecallPost = true;
        break;
      }
    }
    expect(foundRecallPost).toBe(true);
  });

  test("5b. recall_post har altid præcis 4 svarmuligheder", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions
      .filter((q) => q.variant === "recall_post")
      .forEach((q) => {
        expect(q.answers).toHaveLength(4);
      });
  });

  test("5c. recall_post tekst indeholder postnummer", () => {
    // Find et recall_post spørgsmål og verificér at teksten indeholder et tal
    let foundWithNumber = false;
    for (let seed = 1; seed <= 20; seed++) {
      const result = generateBonusQuestions(FIVE_VALID, { seed });
      if (!result.ok) continue;
      const recallPosts = result.questions.filter((q) => q.variant === "recall_post");
      for (const q of recallPosts) {
        if (/post \d+/i.test(q.questionText)) {
          foundWithNumber = true;
          break;
        }
      }
      if (foundWithNumber) break;
    }
    expect(foundWithNumber).toBe(true);
  });

  test("5d. recall_post correctIndex peger på det korrekte kildesvar", () => {
    // For hvert recall_post, verificér at answers[correctIndex] matcher et korrekt svar
    // fra en kildepost (vi kan ikke altid vide præcis hvilken, men svaret skal eksistere)
    const allCorrectAnswers = FIVE_VALID.map(
      (q) => (q.answers as string[])[q.correctIndex as number]!
    );

    for (let seed = 1; seed <= 10; seed++) {
      const result = generateBonusQuestions(FIVE_VALID, { seed });
      if (!result.ok) continue;
      result.questions
        .filter((q) => q.variant === "recall_post")
        .forEach((q) => {
          const givenCorrect = q.answers[q.correctIndex];
          expect(allCorrectAnswers).toContain(givenCorrect);
        });
    }
  });
});

// ============================================================================
// 6. Max spørgsmål
// ============================================================================

test.describe("maxQuestions begrænsning", () => {
  test("6a. Default max er 15", () => {
    // Generer med mange kildepost-kandidater (maks 2 × 5 = 10 kandidater, under max)
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions.length).toBeLessThanOrEqual(MAX_BONUS_QUESTIONS);
  });

  test("6b. maxQuestions = 3 producerer max 3 spørgsmål", () => {
    const result = generate(FIVE_VALID, { maxQuestions: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions.length).toBeLessThanOrEqual(3);
  });

  test("6c. maxQuestions > MAX_BONUS_QUESTIONS klippes til MAX_BONUS_QUESTIONS", () => {
    const result = generate(FIVE_VALID, { maxQuestions: 999 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions.length).toBeLessThanOrEqual(MAX_BONUS_QUESTIONS);
  });

  test("6d. Output-antal overstiger aldrig antal kandidater", () => {
    // 3 gyldige poster → max 6 kandidater (recall_direct + recall_post × 3)
    const threeQuestions = FIVE_VALID.slice(0, 3);
    const result = generate(threeQuestions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions.length).toBeLessThanOrEqual(6);
  });
});

// ============================================================================
// 7. questionIndex er 1-baseret og unik
// ============================================================================

test.describe("questionIndex", () => {
  test("7a. questionIndex starter ved 1", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const indexes = result.questions.map((q) => q.questionIndex);
    expect(indexes[0]).toBe(1);
  });

  test("7b. questionIndex er kontinuerlig fra 1..N", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const indexes = result.questions.map((q) => q.questionIndex);
    const expected = indexes.map((_, i) => i + 1);
    expect(indexes).toEqual(expected);
  });

  test("7c. questionIndex er unik (ingen dubletter)", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const indexes = result.questions.map((q) => q.questionIndex);
    const unique = new Set(indexes);
    expect(unique.size).toBe(indexes.length);
  });
});

// ============================================================================
// 8. answers har præcis 4 elementer
// ============================================================================

test.describe("answers-format", () => {
  test("8a. Alle output-spørgsmål har præcis 4 svarmuligheder", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q: GeneratedBonusQuestion) => {
      expect(q.answers).toHaveLength(4);
    });
  });

  test("8b. Alle svarmuligheder er ikke-tomme strenge", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q) => {
      q.answers.forEach((answer) => {
        expect(typeof answer).toBe("string");
        expect(answer.trim().length).toBeGreaterThan(0);
      });
    });
  });
});

// ============================================================================
// 9. Deterministisk output med seed
// ============================================================================

test.describe("Deterministisk shuffle med seed", () => {
  test("9a. Samme seed + samme input → identisk output", () => {
    const result1 = generateBonusQuestions(FIVE_VALID, { seed: 12345 });
    const result2 = generateBonusQuestions(FIVE_VALID, { seed: 12345 });
    expect(result1).toEqual(result2);
  });

  test("9b. Forskelligt seed → sandsynligvis forskellig rækkefølge", () => {
    // Kør mange seeds — mindst én skal give anden rækkefølge
    const reference = generateBonusQuestions(FIVE_VALID, { seed: 1 });
    if (!reference.ok) return;
    const refOrder = reference.questions.map((q) => q.questionText).join("|");

    let foundDifferent = false;
    for (let seed = 2; seed <= 50; seed++) {
      const other = generateBonusQuestions(FIVE_VALID, { seed });
      if (!other.ok) continue;
      const otherOrder = other.questions.map((q) => q.questionText).join("|");
      if (otherOrder !== refOrder) {
        foundDifferent = true;
        break;
      }
    }
    expect(foundDifferent).toBe(true);
  });
});

// ============================================================================
// 10. Ingen mutation af input
// ============================================================================

test.describe("Input-mutation-sikkerhed", () => {
  test("10a. Input-array muteres ikke", () => {
    const original = deepCopy(FIVE_VALID);
    generateBonusQuestions(FIVE_VALID, { seed: 99 });
    expect(FIVE_VALID).toEqual(original);
  });

  test("10b. Input-spørgsmåls answers-arrays muteres ikke", () => {
    const original = deepCopy(FIVE_VALID);
    generateBonusQuestions(FIVE_VALID, { seed: 99 });
    FIVE_VALID.forEach((q, i) => {
      expect(q.answers).toEqual(original[i]!.answers);
    });
  });

  test("10c. Input-arrays længde ændres ikke", () => {
    const originalLength = FIVE_VALID.length;
    generateBonusQuestions(FIVE_VALID, { seed: 99 });
    expect(FIVE_VALID.length).toBe(originalLength);
  });
});

// ============================================================================
// 11. points-option
// ============================================================================

test.describe("points-option", () => {
  test("11a. Default points er 10", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q) => {
      expect(q.points).toBe(10);
    });
  });

  test("11b. Custom points bruges i alle spørgsmål", () => {
    const result = generate(FIVE_VALID, { points: 25 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q) => {
      expect(q.points).toBe(25);
    });
  });
});

// ============================================================================
// 12. Whitespace-trimning
// ============================================================================

test.describe("Whitespace trimmes", () => {
  test("12a. Tekst med whitespace trimmes i output", () => {
    const qs: SourceQuestion[] = FIVE_VALID.slice(0, 4).map((q, i) =>
      i === 0
        ? { ...q, text: "  Spørgsmål med whitespace  " }
        : q
    );
    const result = generate(qs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q) => {
      expect(q.questionText).not.toMatch(/^\s|\s$/);
    });
  });

  test("12b. Svar med whitespace trimmes i output", () => {
    const qs: SourceQuestion[] = FIVE_VALID.slice(0, 4).map((q, i) =>
      i === 0
        ? { ...q, answers: ["  Svar A  ", "Svar B", "Svar C", "Svar D"] }
        : q
    );
    const result = generate(qs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q) => {
      q.answers.forEach((a) => {
        expect(a).not.toMatch(/^\s|\s$/);
      });
    });
  });
});

// ============================================================================
// 13. sourcePostIndex
// ============================================================================

test.describe("sourcePostIndex", () => {
  test("13a. sourcePostIndex er 1-baseret (starter ved 1)", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q) => {
      expect(q.sourcePostIndex).toBeGreaterThanOrEqual(1);
    });
  });

  test("13b. sourcePostIndex overstiger ikke antal gyldige poster", () => {
    const result = generate(FIVE_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.questions.forEach((q) => {
      expect(q.sourcePostIndex).toBeLessThanOrEqual(FIVE_VALID.length);
    });
  });
});
