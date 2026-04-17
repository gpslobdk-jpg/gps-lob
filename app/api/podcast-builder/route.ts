import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import {
  formatGradeLevelsForPrompt,
  getGradeLevelRange,
  normalizeGradeLevels,
} from "@/utils/gradeLevels";

export const maxDuration = 120;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_TIMEOUT_MS = 90_000;
const QUESTION_COUNT = 8;

type PodcastBuilderPayload = {
  title?: unknown;
  description?: unknown;
  transcript?: unknown;
  gradeLevels?: unknown;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolvePodcastGradeLevelGuidance(gradeLevels: readonly string[]): string {
  const { lowestGrade, highestGrade } = getGradeLevelRange(gradeLevels);

  if (lowestGrade !== null && highestGrade !== null && lowestGrade !== highestGrade) {
    return `Tilpas sprogligt niveau så det er tilgængeligt for ${lowestGrade}. klasse, men byg faglig progression ind til ${highestGrade}. klasse. Variér sværhedsgraden.`;
  }

  const gradeNumber = highestGrade;

  if (gradeNumber !== null && gradeNumber <= 2) {
    return "Brug meget enkelt, kort og konkret sprog. Korte sætninger, dagligdags ord, ingen fagtermer. Svarmulighederne skal være korte (1-3 ord). Spørgsmålene skal være meget konkrete.";
  }

  if (gradeNumber !== null && gradeNumber <= 4) {
    return "Brug klart, overskueligt sprog med korte sætninger. Enkle fagbegreber er okay. Spørgsmålene skal kræve simpel forståelse og genkendelse.";
  }

  if (gradeNumber !== null && gradeNumber <= 6) {
    return "Brug klart og alderssvarende sprog med lidt mere variation og faglig dybde. Spørgsmålene skal kræve let logisk tænkning og refleksion.";
  }

  if (gradeNumber !== null && gradeNumber <= 9) {
    return "Brug præcist, udfordrende sprog med fagtermer. Spørgsmålene må gerne kræve analyse, perspektivering og kildekritisk tænkning. Højt fagligt niveau.";
  }

  return "Brug klart og alderssvarende sprog med lidt mere variation og faglig dybde.";
}

const podcastQuestionSchema = z.object({
  question: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).length(4),
  answer: z.string().trim().min(1),
});

const podcastRunSchema = z.object({
  questions: z.array(podcastQuestionSchema).length(QUESTION_COUNT),
});

export async function POST(request: NextRequest) {
  let payload: PodcastBuilderPayload;
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    payload = (await request.json()) as PodcastBuilderPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const title = asTrimmedString(payload.title);
  const description = asTrimmedString(payload.description);
  const transcript = asTrimmedString(payload.transcript);
  const gradeLevels = normalizeGradeLevels(payload.gradeLevels);
  const gradeLevelLabel = gradeLevels.length > 0 ? formatGradeLevelsForPrompt(gradeLevels) : "Mellemtrin (4.–6. klasse)";
  const gradeLevelGuidance = resolvePodcastGradeLevelGuidance(gradeLevels);

  if (!title && !description && !transcript) {
    return NextResponse.json(
      { success: false, error: "Podcast-data mangler (titel, resumé eller udskrift)." },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    await logHandledServerError({
      requestPath,
      route: requestPath,
      method: "POST",
      context: "podcast_builder_missing_openai_key",
      status: 500,
      error: "OPENAI_API_KEY mangler i miljøet.",
    });
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY mangler i miljøet." },
      { status: 500 }
    );
  }

  const contentSections: string[] = [];
  if (title) contentSections.push(`Titel: ${title}`);
  if (description) contentSections.push(`Resumé: ${description}`);
  if (transcript) {
    // Truncate transcript to stay within token limits (~12 000 chars ≈ ~3 000 tokens)
    const truncated = transcript.length > 12000 ? transcript.slice(0, 12000) + "…" : transcript;
    contentSections.push(`Udskrift:\n${truncated}`);
  }

  const contentBlock = contentSections.join("\n\n");

  const systemPrompt = `Du er en kreativ underviser, der specialiserer sig i at lave GPS-løb til skoler og fritidsaktiviteter.
Din opgave er at bygge præcis ${QUESTION_COUNT} multiple-choice spørgsmål baseret på indholdet af en podcast.
Regler:
- Hvert spørgsmål skal have præcis 4 svarmuligheder (options).
- Feltet "answer" skal indeholde den præcis korrekte svarmulighed – ordret som den optræder i "options".
- Spørgsmålene skal teste forståelse og nysgerrighed, ikke blot hukommelse.
- Skriv på dansk, medmindre podcasten er på et andet sprog.
- Klassetrin: ${gradeLevelLabel}.
- ${gradeLevelGuidance}
- Returner KUN det valide JSON-objekt. Ingen forklaringer.`;

  const prompt = `Her er podcast-informationen:\n\n${contentBlock}\n\nByg nu ${QUESTION_COUNT} spørgsmål.`;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: podcastRunSchema,
      schemaName: "PodcastRun",
      schemaDescription: "Et GPS-løb baseret på en podcast",
      system: systemPrompt,
      prompt,
      temperature: 0.7,
      timeout: OPENAI_TIMEOUT_MS,
      providerOptions: {
        openai: { strictJsonSchema: true },
      },
    });

    return NextResponse.json({ success: true, questions: object.questions });
  } catch (error) {
    console.error("Podcast-builder AI fejl:", error);
    const message =
      error instanceof Error && error.message.includes("timed out")
        ? "AI'en var for længe om at svare. Prøv igen."
        : "Kunne ikke bygge løbet lige nu. Prøv igen om et øjeblik.";
    await logHandledServerError({
      route: "/api/podcast-builder",
      method: "POST",
      status: error instanceof Error && error.message.includes("timed out") ? 504 : 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
