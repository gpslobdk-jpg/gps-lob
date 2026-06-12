import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const maxDuration = 60;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_TIMEOUT_MS = 30_000;
const SUBJECT_OPTIONS = ["Generelt", "Dansk", "Tysk", "Engelsk", "Historie", "Samfundsfag", "Naturfag", "Matematik"] as const;
const AI_UNAVAILABLE_MESSAGE = "AI-forslag er ikke tilgængelige lige nu. Du kan stadig oprette spillet manuelt.";
const EMOJI_PATTERN = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

const suggestPayloadSchema = z
  .object({
    topic: z.string().trim().min(1).max(120),
    gradeLevel: z.string().trim().max(80).optional().default(""),
    extraWish: z.string().trim().max(220).optional().default(""),
  })
  .strict();

const suggestionSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    category: z.enum(SUBJECT_OPTIONS),
    secretWord: z.string().trim().min(1).max(50),
    teacherNote: z.string().trim().min(1).max(240),
    alternatives: z.array(z.string().trim().min(1).max(50)).min(3).max(6),
  })
  .strict();

function cleanText(value: string) {
  return value.replace(EMOJI_PATTERN, "").replace(/\s+/g, " ").trim();
}

function cleanAlternatives(values: string[], secretWord: string) {
  const seen = new Set<string>();
  const normalizedSecret = secretWord.toLowerCase();

  return values
    .map(cleanText)
    .filter((value) => value.length > 0)
    .filter((value) => {
      const key = value.toLowerCase();
      if (key === normalizedSecret || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /timed out|timeout|aborted/i.test(error.message))
  );
}

export async function POST(req: Request) {
  const requestPath = new URL(req.url).pathname;

  try {
    if (!process.env.OPENAI_API_KEY) {
      await logHandledServerError({
        requestPath,
        route: requestPath,
        method: "POST",
        context: "find_bedrageren_suggest_missing_openai_key",
        status: 503,
        error: "OPENAI_API_KEY mangler i miljøet.",
      });
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 503 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Du skal være logget ind for at bruge AI-forslag." },
        { status: 401 }
      );
    }

    const parsedPayload = suggestPayloadSchema.safeParse(await req.json());
    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: "Skriv et kort fag eller emne, før du beder om forslag." },
        { status: 400 }
      );
    }

    const { topic, gradeLevel, extraWish } = parsedPayload.data;
    const gradeLine = gradeLevel ? `Klassetrin eller målgruppe: ${gradeLevel}.` : "Klassetrin eller målgruppe: Ikke angivet.";
    const extraLine = extraWish ? `Ekstra ønske fra læreren: ${extraWish}.` : "Ekstra ønske fra læreren: Ikke angivet.";

    const systemPrompt = `Du er en dansk pædagogisk spilredaktør for GPSLøb.
Du hjælper en lærer med at udfylde builderen til spiltypen Find Bedrageren.

Spiltypen fungerer sådan:
- Læreren vælger et hemmeligt ord.
- Civile elever kender ordet.
- En eller flere bedragere kender ikke ordet og skal bluffe.
- Klassen giver hints og prøver at afsløre bedrageren.

Du SKAL følge disse regler:
- Skriv kun på dansk.
- Returner kun gyldigt JSON, der matcher schemaet.
- Brug ingen emojis eller symbolpynt.
- Vælg konkrete hemmelige ord, ikke brede ord som "samfund" eller "natur".
- Vælg skolevenlige ord, der kan give gode hints.
- Undgå følsomme, private, politisk ekstreme, seksuelle eller personrettede emner.
- Hold output kort og lærerrettet.
- Category skal være en af de tilladte kategorier i schemaet.
- TeacherNote skal forklare spillets ramme i højst to korte sætninger.
- Alternatives skal være konkrete alternative hemmelige ord.

Gode hemmelige ord kan være demokrati, vulkan, fotosyntese, procent, viking, eventyr, hovedstad eller energi.`;

    const prompt = [
      `Fag eller emne: ${topic}.`,
      gradeLine,
      extraLine,
      "Foreslå en titel, en kategori, et hemmeligt ord, en kort lærerforklaring og 3-6 alternative hemmelige ord.",
      "Indholdet skal fungere i Find Bedrageren, hvor civile kender ordet og bedrageren ikke gør.",
      "Returner nu kun det strukturerede JSON-output.",
    ].join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: suggestionSchema,
      schemaName: "FindBedragerenSuggestion",
      schemaDescription: "Et kort forslag til Find Bedrageren-builderen.",
      system: systemPrompt,
      prompt,
      temperature: 0.7,
      timeout: OPENAI_TIMEOUT_MS,
      providerOptions: {
        openai: {
          strictJsonSchema: true,
        },
      },
    });

    const secretWord = cleanText(object.secretWord);

    return NextResponse.json({
      title: cleanText(object.title),
      category: object.category,
      secretWord,
      teacherNote: cleanText(object.teacherNote),
      alternatives: cleanAlternatives(object.alternatives, secretWord),
    });
  } catch (error) {
    console.error("Fejl i Find Bedrageren AI-forslag:", error);

    const status = isTimeoutError(error) ? 504 : 500;
    await logHandledServerError({
      route: "/api/find-bedrageren/suggest",
      method: "POST",
      status,
      error,
      requestPath,
      routeType: "route",
    });

    return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status });
  }
}
