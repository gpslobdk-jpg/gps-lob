/**
 * ai-pedagogy-baseline.spec.ts — Pedagogical Grade-Level Differentiation Test
 *
 * Calls the OpenAI API directly (same model + prompt as /api/stjerneloeb-generate)
 * with IDENTICAL topic & subject but different grade levels:
 *
 *   Run A: "Solsystemet", Natur/Teknologi, gradeLevels: ["2. klasse"]
 *   Run B: "Solsystemet", Natur/Teknologi, gradeLevels: ["9. klasse"]
 *
 * Then measures:
 *   1. Average Sentence Length (words per sentence)
 *   2. Average Word Complexity (characters per word)
 *   3. Vocabulary richness (unique-to-total word ratio)
 *
 * Strict assertions test whether the gold-standard prompt actually forces
 * measurable pedagogical differentiation between the two grade levels.
 *
 * NOTE: This test calls the real OpenAI API (gpt-4o-mini) and requires
 * OPENAI_API_KEY in the environment. Each run costs ~$0.01. Skipped if missing.
 */

import { test, expect } from "@playwright/test";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Load OPENAI_API_KEY from .env.local if not already in process.env
if (!process.env.OPENAI_API_KEY) {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^OPENAI_API_KEY=["']?([^"'\r\n]+)/m);
    if (match) process.env.OPENAI_API_KEY = match[1];
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TOPIC = "Solsystemet";
const SUBJECT = "Natur/Teknologi";
const COUNT = 4;

// ---------------------------------------------------------------------------
// Zod schema (exact copy from the API route — classic mode)
// ---------------------------------------------------------------------------

const postSchema = z
  .object({
    title: z.string().trim().min(1),
    body_text: z.string().trim().min(1),
    image_prompt: z.string().trim().min(1),
    question: z.string().trim(),
    options: z.array(z.string().trim()).length(4),
    correct_index: z.number().int().min(0).max(3),
  })
  .strict();

const runSchema = z
  .object({
    title: z.string().trim().min(1),
    posts: z.array(postSchema).length(COUNT),
  })
  .strict();

// ---------------------------------------------------------------------------
// Grade-band pedagogical rules (mirrors route.ts resolveStjerneloebGradeLevelGuidance)
// ---------------------------------------------------------------------------

function resolveStjerneloebGradeLevelGuidance(gradeLevels: string[]): string {
  const gradeNumbers = gradeLevels
    .map((gl) => {
      const m = gl.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n): n is number => n !== null && n >= 1 && n <= 9)
    .sort((a, b) => a - b);

  const lowestGrade = gradeNumbers.length > 0 ? gradeNumbers[0] : null;
  const highestGrade = gradeNumbers.length > 0 ? gradeNumbers[gradeNumbers.length - 1] : null;
  const gradeLevelLabel = gradeLevels.join(", ");

  if (lowestGrade !== null && highestGrade !== null && lowestGrade !== highestGrade) {
    return `Målgruppe: ${gradeLevelLabel} (flere klassetrin, ${lowestGrade}.-${highestGrade}. klasse).
Pædagogiske regler — SKAL overholdes strengt:
- Hold sproget tilgængeligt nok til de yngste, men byg faglig progression og udfordring ind til de ældste.
- Brødteksten skal være kort nok til at de yngste kan læse den, men fagligt stærk nok til at de ældste får udbytte.
- Spørgsmålene skal variere i sværhedsgrad, så der er noget for alle niveauer.
- Tonen skal være engageret, klar og alderssvarende for den brede gruppe.`;
  }

  const gradeNumber = highestGrade;

  if (gradeNumber !== null && gradeNumber <= 2) {
    return `Målgruppe: Indskoling (${gradeLevelLabel}, 6-8 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal være meget kort med korte, enkle sætninger. Brug kun hovedsætninger, ingen bisætninger.
- Brug kun dagligdags, konkrete ord som barnet kender fra hverdagen. Undgå alle fremmedord, fagtermer og abstrakte begreber.
- Spørgsmålene skal være meget konkrete, enkle og lette at afkode. Svarmulighederne skal være korte (1-3 ord).
- Tonen skal være varm, nysgerrig og opmuntrende, som en venlig voksen der fortæller.`;
  }

  if (gradeNumber !== null && gradeNumber <= 4) {
    return `Målgruppe: Begyndende mellemtrin (${gradeLevelLabel}, 9-10 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal være kort og overskuelig med tydelige sætninger.
- Brug velkendte situationer, korte cases og tydelige formuleringer.
- Du må gerne bruge enkle fagbegreber, men de skal forklares kort i selve teksten.
- Spørgsmålene skal kræve simpel forståelse og genkendelse. Svarmulighederne skal være korte og realistiske.
- Tonen skal være engageret og informativ.`;
  }

  if (gradeNumber !== null && gradeNumber <= 6) {
    return `Målgruppe: Mellemtrin (${gradeLevelLabel}, 10-12 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal være informativ med klare sætninger og lidt mere faglig dybde.
- Du må gerne bruge fagbegreber, men de skal forklares kort i selve teksten første gang de bruges.
- Spørgsmålene skal kræve let logisk tænkning — ikke bare direkte aflæsning, men kort refleksion over teksten.
- Tonen skal være engageret og informativ, som en god lærebog.`;
  }

  if (gradeNumber !== null && gradeNumber <= 9) {
    return `Målgruppe: Udskoling (${gradeLevelLabel}, 13-16 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal have et højt fagligt niveau med præcise, sammensatte sætninger.
- Brug præcise fagtermer, videnskabelige begreber og abstrakte koncepter frit uden at forklare dem.
- Spørgsmålene må gerne kræve analyse, perspektivering, sammenligning eller kildekritisk tænkning.
- Tonen skal være saglig, akademisk og udfordrende, som et fagligt opslagsværk.`;
  }

  return `Målgruppe: Mellemtrin (generelt niveau, 10-12 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal være informativ med klare sætninger og lidt mere faglig dybde.
- Du må gerne bruge fagbegreber, men de skal forklares kort i selve teksten første gang de bruges.
- Spørgsmålene skal kræve let logisk tænkning — ikke bare direkte aflæsning, men kort refleksion over teksten.
- Tonen skal være engageret og informativ, som en god lærebog.`;
}

// ---------------------------------------------------------------------------
// Prompt builder (mirrors the upgraded route)
// ---------------------------------------------------------------------------

function buildSystemPrompt(gradeLevels: string[]): string {
  const pedagogicalRules = resolveStjerneloebGradeLevelGuidance(gradeLevels);
  const subjectLine = `- Brug faget "${SUBJECT}" som faglig ramme for alle poster.`;

  const imageDirectionLine = `- Alle billedprompts skal følge layout-retningen "Standard": clear educational illustration, friendly realistic detail, readable composition, school-safe, no text overlay, no watermark.`;
  const imagePurposeLine = `- Billedprompts skal især fremhæve en umiddelbart forståelig scene, der hjælper eleverne ind i emnet.`;

  return `Du er en dansk lærer, der laver et analogt stjerneløb til udendørs undervisning.
Et stjerneløb er en serie af laminerede A4-post-kort, der hænges rundt i skolegården.
Elever vandrer fra post til post, læser teksten, ser på billedet og besvarer spørgsmålet.

${pedagogicalRules}

Vigtige regler:
- Alt indhold skal være på dansk.
- Lav præcis ${COUNT} poster.
- Hver post skal have: en kort overskrift, en læsbar brødtekst (se sætningskrav ovenfor), et billedprompt på ENGELSK til en AI-billedgenerator, et fagligt spørgsmål og præcis 4 svarmuligheder.
- Kun ét svar er korrekt (correct_index 0-3).
- Brødteksten skal indeholde svaret på spørgsmålet, så elever kan finde det ved at læse.
- Billedprompt på engelsk: én enkel prompt på naturligt engelsk, uden citationstegn eller punktform, og den skal passe direkte til posten.
${imageDirectionLine}
${imagePurposeLine}
- Giv løbet en samlet titel.
${subjectLine}`;
}

// ---------------------------------------------------------------------------
// Text-analysis utilities
// ---------------------------------------------------------------------------

/** Split Danish text into sentences on . ! ? (ignoring abbreviations like "bl.a.") */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function splitWords(text: string): string[] {
  return text
    .replace(/["""''«»—–\-()[\]{},;:!?\.…]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function averageSentenceLength(text: string): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 0;
  const totalWords = sentences.reduce((sum, s) => sum + splitWords(s).length, 0);
  return totalWords / sentences.length;
}

function averageWordLength(text: string): number {
  const words = splitWords(text);
  if (words.length === 0) return 0;
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  return totalChars / words.length;
}

function vocabularyRichness(text: string): number {
  const words = splitWords(text).map((w) => w.toLowerCase());
  if (words.length === 0) return 0;
  return new Set(words).size / words.length;
}

type TextMetrics = {
  totalWords: number;
  totalSentences: number;
  avgSentenceLength: number;
  avgWordLength: number;
  vocabRichness: number;
};

function analyzeText(text: string): TextMetrics {
  const words = splitWords(text);
  const sentences = splitSentences(text);
  return {
    totalWords: words.length,
    totalSentences: sentences.length,
    avgSentenceLength: averageSentenceLength(text),
    avgWordLength: averageWordLength(text),
    vocabRichness: vocabularyRichness(text),
  };
}

function analyzeAllPosts(
  posts: Array<{ title: string; body_text: string; question?: string }>
): TextMetrics {
  // Combine all body_text + question text for aggregate analysis
  const combined = posts
    .map((p) => [p.body_text, p.question ?? ""].join(" "))
    .join(" ");
  return analyzeText(combined);
}

// ---------------------------------------------------------------------------
// AI generation helper
// ---------------------------------------------------------------------------

async function generateStjerneloeb(gradeLevels: string[], apiKey: string) {
  const openai = createOpenAI({ apiKey });

  const response = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: runSchema,
    system: buildSystemPrompt(gradeLevels),
    prompt: `Lav et stjerneløb om emnet: "${TOPIC}".`,
  });

  return response.object;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("AI Pedagogy Baseline — Grade-level differentiation", () => {
  test("2. klasse vs 9. klasse: text complexity metrics", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    test.skip(!apiKey, "OPENAI_API_KEY not set — skipping real AI test");

    // Two AI calls ≈ 20-60 seconds total
    test.setTimeout(180_000);

    // ------------------------------------------------------------------
    // Generate both runs
    // ------------------------------------------------------------------
    console.log("\n🎓 Generating 2. klasse run…");
    const run2 = await generateStjerneloeb(["2. klasse"], apiKey!);
    console.log(`   ✓ "${run2.title}" — ${run2.posts.length} posts`);

    console.log("🎓 Generating 9. klasse run…");
    const run9 = await generateStjerneloeb(["9. klasse"], apiKey!);
    console.log(`   ✓ "${run9.title}" — ${run9.posts.length} posts`);

    // ------------------------------------------------------------------
    // Analyze text metrics
    // ------------------------------------------------------------------
    const metrics2 = analyzeAllPosts(run2.posts);
    const metrics9 = analyzeAllPosts(run9.posts);

    // Per-post breakdown
    const postMetrics2 = run2.posts.map((p, i) => ({
      post: i + 1,
      bodyTextPreview: p.body_text.slice(0, 80) + "…",
      ...analyzeText(p.body_text),
    }));
    const postMetrics9 = run9.posts.map((p, i) => ({
      post: i + 1,
      bodyTextPreview: p.body_text.slice(0, 80) + "…",
      ...analyzeText(p.body_text),
    }));

    // ------------------------------------------------------------------
    // Report
    // ------------------------------------------------------------------
    const sentenceLengthDelta =
      ((metrics9.avgSentenceLength - metrics2.avgSentenceLength) /
        metrics2.avgSentenceLength) *
      100;
    const wordLengthDelta =
      ((metrics9.avgWordLength - metrics2.avgWordLength) /
        metrics2.avgWordLength) *
      100;

    const report = {
      topic: TOPIC,
      subject: SUBJECT,
      count: COUNT,
      grade2: {
        title: run2.title,
        aggregate: metrics2,
        perPost: postMetrics2,
        sampleBodyTexts: run2.posts.map((p) => p.body_text),
        sampleQuestions: run2.posts.map((p) => p.question ?? "—"),
      },
      grade9: {
        title: run9.title,
        aggregate: metrics9,
        perPost: postMetrics9,
        sampleBodyTexts: run9.posts.map((p) => p.body_text),
        sampleQuestions: run9.posts.map((p) => p.question ?? "—"),
      },
      deltas: {
        sentenceLengthDeltaPercent: +sentenceLengthDelta.toFixed(1),
        wordLengthDeltaPercent: +wordLengthDelta.toFixed(1),
      },
    };

    // Write to file for inspection
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(
      "test-results/ai-pedagogy-baseline.json",
      JSON.stringify(report, null, 2),
      "utf-8"
    );

    // Pretty-print summary
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║          AI PEDAGOGY BASELINE — RAW METRICS            ║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(`║ Topic: ${TOPIC.padEnd(48)} ║`);
    console.log(`║ Subject: ${SUBJECT.padEnd(46)} ║`);
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log("║               2. KLASSE          9. KLASSE             ║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(
      `║ Avg sentence len:   ${metrics2.avgSentenceLength.toFixed(1).padStart(6)}  words     ${metrics9.avgSentenceLength.toFixed(1).padStart(6)}  words    ║`
    );
    console.log(
      `║ Avg word len:       ${metrics2.avgWordLength.toFixed(2).padStart(6)}  chars     ${metrics9.avgWordLength.toFixed(2).padStart(6)}  chars    ║`
    );
    console.log(
      `║ Vocab richness:     ${(metrics2.vocabRichness * 100).toFixed(1).padStart(5)}%            ${(metrics9.vocabRichness * 100).toFixed(1).padStart(5)}%           ║`
    );
    console.log(
      `║ Total words:        ${String(metrics2.totalWords).padStart(6)}            ${String(metrics9.totalWords).padStart(6)}            ║`
    );
    console.log(
      `║ Total sentences:    ${String(metrics2.totalSentences).padStart(6)}            ${String(metrics9.totalSentences).padStart(6)}            ║`
    );
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(
      `║ Sentence len delta: ${sentenceLengthDelta >= 0 ? "+" : ""}${sentenceLengthDelta.toFixed(1)}%`.padEnd(57) + "║"
    );
    console.log(
      `║ Word len delta:     ${wordLengthDelta >= 0 ? "+" : ""}${wordLengthDelta.toFixed(1)}%`.padEnd(57) + "║"
    );
    console.log("╚══════════════════════════════════════════════════════════╝");

    // ------------------------------------------------------------------
    // Print sample texts side-by-side
    // ------------------------------------------------------------------
    console.log("\n── 2. KLASSE body texts ──────────────────────────────");
    for (const p of run2.posts) {
      console.log(`  Post ${run2.posts.indexOf(p) + 1}: ${p.body_text}\n`);
    }
    console.log("── 9. KLASSE body texts ──────────────────────────────");
    for (const p of run9.posts) {
      console.log(`  Post ${run9.posts.indexOf(p) + 1}: ${p.body_text}\n`);
    }

    // ------------------------------------------------------------------
    // Strict pedagogical assertions
    // ------------------------------------------------------------------

    // 1. 9. klasse sentences should be at least 30% longer than 2. klasse
    expect(
      metrics9.avgSentenceLength,
      `9. klasse avg sentence length (${metrics9.avgSentenceLength.toFixed(1)}) should be ≥ 30% longer than 2. klasse (${metrics2.avgSentenceLength.toFixed(1)})`
    ).toBeGreaterThan(metrics2.avgSentenceLength * 1.3);

    // 2. 9. klasse words should be at least 5% longer (complex vocabulary)
    expect(
      metrics9.avgWordLength,
      `9. klasse avg word length (${metrics9.avgWordLength.toFixed(2)}) should be ≥ 5% longer than 2. klasse (${metrics2.avgWordLength.toFixed(2)})`
    ).toBeGreaterThan(metrics2.avgWordLength * 1.05);

    // 3. 2. klasse should have short sentences (< 10 words avg)
    expect(
      metrics2.avgSentenceLength,
      `2. klasse avg sentence length (${metrics2.avgSentenceLength.toFixed(1)}) should be < 10 words for young readers`
    ).toBeLessThan(10);

    // 4. 9. klasse should have meaningfully longer sentences (> 14 words avg)
    expect(
      metrics9.avgSentenceLength,
      `9. klasse avg sentence length (${metrics9.avgSentenceLength.toFixed(1)}) should be > 14 words for advanced readers`
    ).toBeGreaterThan(14);
  });
});
