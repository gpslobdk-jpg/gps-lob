import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

  try {
    payload = (await request.json()) as PodcastBuilderPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const title = asTrimmedString(payload.title);
  const description = asTrimmedString(payload.description);
  const transcript = asTrimmedString(payload.transcript);

  if (!title && !description && !transcript) {
    return NextResponse.json(
      { success: false, error: "Podcast-data mangler (titel, resumé eller udskrift)." },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
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
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
