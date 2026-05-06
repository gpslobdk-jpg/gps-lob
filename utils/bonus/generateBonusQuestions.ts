/**
 * utils/bonus/generateBonusQuestions.ts
 *
 * Ren, deterministisk TypeScript-generator der omdanner gps_runs.questions
 * til op til 15 bonusspørgsmål.
 *
 * Garantier:
 *  - Ingen Supabase-kald, ingen HTTP, ingen side-effects
 *  - Muterer aldrig input-arrays
 *  - Kaster aldrig fejl ved ugyldig input — filtrerer blot ugyldige poster
 *  - Returnerer altid præcis 4 svarmuligheder pr. spørgsmål
 *  - correctIndex er altid 0–3 og peger på det rigtige svar
 *  - Determinatistisk output med valgfrit seed
 */

// ============================================================================
// Typer
// ============================================================================

/** Et spørgsmål fra gps_runs.questions (relevante felter for bonusgenerering) */
export type SourceQuestion = {
  text: string;
  answers: unknown;        // valideres internt — input kan være arbitrary JSON
  correctIndex: unknown;   // valideres internt
};

/** Et gyldigt, valideret kilde-spørgsmål (efter filterering) */
type ValidSourceQuestion = {
  text: string;
  answers: [string, string, string, string];
  correctIndex: number;         // 0–3
  /** 1-baseret positionsnummer i den validerede liste (bruges til "post X" tekst) */
  postNumber: number;
};

/** Et genereret bonusspørgsmål klar til INSERT i bonus_questions */
export type GeneratedBonusQuestion = {
  questionIndex: number;                          // 1-baseret, 1..max
  sourcePostIndex: number;                        // 1-baseret kildepost-nummer
  variant: "recall_direct" | "recall_post";
  questionText: string;
  answers: [string, string, string, string];      // præcis 4 svarmuligheder
  correctIndex: number;                           // 0–3
  points: number;
};

export type GenerateBonusQuestionsOptions = {
  /** Max antal output-spørgsmål. Default: 15 */
  maxQuestions?: number;
  /** Point pr. rigtigt svar. Default: 10 */
  points?: number;
  /**
   * Seed til deterministisk shuffle. Udelad for tilfældig shuffling.
   * Samme seed + samme input → samme output (bruges i tests).
   */
  seed?: number;
};

export type GenerateBonusQuestionsResult =
  | { ok: true; questions: GeneratedBonusQuestion[] }
  | { ok: false; reason: "no_usable_questions" | "too_few_posts" };

// ============================================================================
// Konstanter
// ============================================================================

/** Minimum antal brugbare poster for at aktivere bonusspil */
export const MIN_USABLE_POSTS = 3;

/** Absolut maksimum for question_index (matcher DB-constraint) */
export const MAX_BONUS_QUESTIONS = 15;

// ============================================================================
// Deterministisk PRNG (Mulberry32)
// ============================================================================

/**
 * Returnerer en deterministisk pseudo-random number generator (PRNG)
 * baseret på Mulberry32-algoritmen.
 * Output: tal i [0, 1).
 */
function createRng(seed: number): () => number {
  let s = seed >>> 0; // uint32
  return function mulberry32(): number {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ============================================================================
// Hjælpefunktioner
// ============================================================================

/**
 * Fisher-Yates shuffle — returnerer nyt array, muterer IKKE input.
 */
function shuffleArray<T>(arr: readonly T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    [result[i]!, result[j]!] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Shuffler svarmuligheder og opdaterer correctIndex korrekt.
 * Returnerer nyt objekt — muterer IKKE input.
 */
function shuffleOptions(
  answers: [string, string, string, string],
  correctIndex: number,
  rng: () => number
): { answers: [string, string, string, string]; correctIndex: number } {
  const correctAnswer = answers[correctIndex];
  const shuffled = shuffleArray(answers, rng) as [string, string, string, string];
  return {
    answers: shuffled,
    correctIndex: shuffled.indexOf(correctAnswer),
  };
}

/**
 * Validerer at et SourceQuestion er brugbart til bonusgenerering.
 * Et spørgsmål er brugbart hvis:
 *  - text er en ikke-tom streng
 *  - answers er et array med præcis 4 ikke-tomme strenge
 *  - correctIndex er et heltal 0–3
 */
function isValidSourceQuestion(q: SourceQuestion): q is SourceQuestion & {
  answers: [string, string, string, string];
  correctIndex: number;
} {
  if (typeof q.text !== "string" || q.text.trim().length === 0) return false;
  if (!Array.isArray(q.answers) || q.answers.length !== 4) return false;
  if (!(q.answers as unknown[]).every(
    (a) => typeof a === "string" && (a as string).trim().length > 0
  )) return false;
  if (
    typeof q.correctIndex !== "number" ||
    !Number.isInteger(q.correctIndex) ||
    q.correctIndex < 0 ||
    q.correctIndex > 3
  ) return false;
  return true;
}

/**
 * Finder op til 3 distraktorer til et recall_post spørgsmål.
 *
 * Strategi:
 *  1. Korrekte svar fra ANDRE poster (foretrukket — meningsfulde distraktorer)
 *  2. Forkerte svar fra andre poster som fallback
 *
 * Returnerer aldrig den korrekte svar-streng selv (case-insensitivt).
 * Deduplicerer baseret på lowercased trim.
 */
function getDistractors(
  correctAnswer: string,
  allValid: ValidSourceQuestion[],
  excludeIdx: number,
  rng: () => number
): string[] {
  const normalizedCorrect = correctAnswer.trim().toLowerCase();
  const seen = new Set<string>([normalizedCorrect]);
  const otherCorrects: string[] = [];
  const otherWrong: string[] = [];

  for (let i = 0; i < allValid.length; i++) {
    if (i === excludeIdx) continue;
    const q = allValid[i];
    if (!q) continue;

    for (let ai = 0; ai < 4; ai++) {
      const answer = q.answers[ai];
      if (!answer) continue;
      const normalized = answer.trim().toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      if (ai === q.correctIndex) {
        otherCorrects.push(answer.trim());
      } else {
        otherWrong.push(answer.trim());
      }
    }
  }

  // Byg pulje: foretruk korrekte svar fra andre poster
  const pool = [...otherCorrects, ...otherWrong];
  const shuffled = shuffleArray(pool, rng);
  return shuffled.slice(0, 3);
}

// ============================================================================
// Hoved-generator
// ============================================================================

/**
 * Genererer op til `maxQuestions` bonusspørgsmål fra et løbs kildepost-liste.
 *
 * Algoritme:
 *  1. Filtrér ugyldige poster (stille — kaster aldrig)
 *  2. Check minimumskrav (MIN_USABLE_POSTS)
 *  3. Generer kandidater: op til 2 pr. gyldig post (recall_direct + recall_post)
 *  4. Shuffle kandidater deterministisk
 *  5. Klip til maxQuestions
 *  6. Tildel 1-baseret questionIndex
 */
export function generateBonusQuestions(
  sourceQuestions: readonly SourceQuestion[],
  options?: GenerateBonusQuestionsOptions
): GenerateBonusQuestionsResult {
  const maxQuestions = Math.min(
    options?.maxQuestions ?? MAX_BONUS_QUESTIONS,
    MAX_BONUS_QUESTIONS
  );
  const points = options?.points ?? 10;
  const seed = options?.seed ?? Date.now();
  const rng = createRng(seed);

  // ── Trin 1: Validér og filtér ──────────────────────────────────────────────
  const valid: ValidSourceQuestion[] = sourceQuestions
    .filter(isValidSourceQuestion)
    .map((q, i) => ({
      text: (q.text as string).trim(),
      answers: (q.answers as string[]).map((a) => (a as string).trim()) as [
        string,
        string,
        string,
        string,
      ],
      correctIndex: q.correctIndex as number,
      postNumber: i + 1, // 1-baseret positionsnummer i den validerede liste
    }));

  // ── Trin 2: Minimumskrav ───────────────────────────────────────────────────
  if (valid.length === 0) {
    return { ok: false, reason: "no_usable_questions" };
  }
  if (valid.length < MIN_USABLE_POSTS) {
    return { ok: false, reason: "too_few_posts" };
  }

  // ── Trin 3: Generer kandidater ────────────────────────────────────────────
  type Candidate = Omit<GeneratedBonusQuestion, "questionIndex">;
  const candidates: Candidate[] = [];

  valid.forEach((q) => {
    const sourcePostIndex = q.postNumber; // 1-baseret (sat ved validering)

    // --- recall_direct: genbrug spørgsmålet direkte, shuffle svar ---
    const shuffled = shuffleOptions(q.answers, q.correctIndex, rng);
    candidates.push({
      sourcePostIndex,
      variant: "recall_direct",
      questionText: q.text,
      answers: shuffled.answers,
      correctIndex: shuffled.correctIndex,
      points,
    });

    // --- recall_post: "Hvad var svaret ved post X?" ---
    const correctAnswer = q.answers[q.correctIndex];
    if (!correctAnswer) return; // typeguard (kan ikke ske efter validering)

    const distractors = getDistractors(correctAnswer, valid, q.postNumber - 1, rng);
    if (distractors.length < 3) {
      // Ikke nok distraktorer — skip denne variant (eleven sidder aldrig fast)
      return;
    }

    const recallPool = shuffleArray(
      [correctAnswer, distractors[0]!, distractors[1]!, distractors[2]!],
      rng
    ) as [string, string, string, string];

    candidates.push({
      sourcePostIndex,
      variant: "recall_post",
      questionText: `Hvad var det rigtige svar, som I fandt ved post ${sourcePostIndex}?`,
      answers: recallPool,
      correctIndex: recallPool.indexOf(correctAnswer),
      points,
    });
  });

  // ── Trin 4–5: Shuffle og klip ─────────────────────────────────────────────
  const shuffledCandidates = shuffleArray(candidates, rng);
  const selected = shuffledCandidates.slice(0, maxQuestions);

  // ── Trin 6: Tildel questionIndex (1-baseret) ──────────────────────────────
  const questions: GeneratedBonusQuestion[] = selected.map((q, i) => ({
    ...q,
    questionIndex: i + 1,
  }));

  return { ok: true, questions };
}
