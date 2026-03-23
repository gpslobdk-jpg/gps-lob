import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";

export const maxDuration = 300;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_COUNT = 10;
const OPENAI_TIMEOUT_MS = 45_000;

const interviewPayloadSchema = z
  .object({
    topic: z.string().trim().min(1).max(180),
    subject: z.string().trim().max(80).optional().default(""),
    audience: z.string().trim().min(1).max(80),
    tone: z.string().trim().min(1).max(80),
    forceFirstPerson: z.boolean().optional().default(false),
    count: z
      .union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)])
      .optional()
      .default(DEFAULT_COUNT),
  })
  .strict();

// Be permissive: accept partial or slightly different shapes from the AI and
// normalise afterwards. We'll expect the AI to return an object with a
// top-level title/description and a `posts` array, but keep validation loose
// to avoid 500s when the model deviates slightly.
const generatedPostSchema = z.object({
  characterName: z.string().optional(),
  introMessage: z.string().optional(),
  message: z.string().optional(),
  questionMessage: z.string().optional(),
  answers: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
  postType: z.string().optional(),
});

function createGeneratedRunSchema(desiredCount: number) {
  // Provide a permissive schema for the AI so it can still be guided, but
  // don't enforce exact lengths/strict fields here. We'll normalise and
  // provide safe defaults server-side after generation.
  return z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    posts: z.array(z.unknown()).optional(),
  });
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackCharacterName(index: number) {
  return `Karakter ${index + 1}`;
}

// avatar field removed from normalised output; keep no emoji defaults.

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /timed out|timeout|aborted/i.test(error.message))
  );
}

function hasSimpleAnswer(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.split(/\s+/).filter(Boolean).length <= 2 && trimmed.length <= 24;
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY mangler i miljøet." }, { status: 500 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Du skal være logget ind for at bruge AI-værktøjet." },
        { status: 401 }
      );
    }

    const parsedPayload = interviewPayloadSchema.safeParse(await req.json());
    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: "Interview-data mangler eller har et ugyldigt format." },
        { status: 400 }
      );
    }

    const { topic, subject, audience, tone, count } = parsedPayload.data;
    const forceFirstPerson = parsedPayload.data.forceFirstPerson === true;
    const schema = createGeneratedRunSchema(count);
    const subjectLine = subject ? `Fag eller kategori: ${subject}.` : "";

    const systemPrompt = `Du er en specialiseret generator til pædagogiske, narrative rollespilsforløb. Dit mål er at skabe et komplet, læringsorienteret rollespil centreret omkring én karakter eller tema — skrevet som en jeg-fortæller.

Regel 1 — Introen (Post 1):
Den første post (index 0) SKAL være en informationsfyldt introduktion skrevet i første person ("jeg"). Introen præsenterer karakterens navn, baggrund, tid og mission, og indeholder al den viden som efterfølgende spørgsmål må trække på. Introen må ikke indeholde spørgsmål eller opfordringer til handling — den er udelukkende fortælling og fakta.

Regel 2 — Spørgsmålene (Post 2+):
Alle efterfølgende poster (index 1 og frem) MÅ KUN være korte quiz-spørgsmål der er udledt EKSKLUSIVT af informationen i Post 1. Hver quiz-post skal indeholde præcis 4 svarmuligheder (array) hvor det første element (index 0) er det korrekte svar. De tre øvrige svar skal være plausible, men forkerte muligheder.

Format- og sprogkrav:
- Returner udelukkende ét JSON-objekt (ingen markdown, ingen forklaringer, ingen emojis).
- Alt tekst SKAL være på dansk.
- Fjern eller undlad felter som "avatar" eller emojis — UI'en viser kun navn + intro og senere spørgsmål med svarmuligheder.
- Struktur: { roll_title, roll_desc, fag, questions: [ { id, postType: "intro", characterName, introMessage }, { id, postType: "quiz", questionMessage, answers:["korrekt","forkert1","forkert2","forkert3"] }, ... ] }

KRITISK: Følg disse regler strengt. Post 1 = jeg-fortæller med fakta. Post 2+ = 4-valgs quizspørgsmål udelukkende udledt af Post 1.`;

    const prompt = [
      `Tema: ${topic}.`,
      subjectLine,
      `Målgruppe: ${audience}.`,
      `Tone: ${tone}.`,
      `Antal poster i alt: ${count}.`,
      `Skriv alt på dansk. Ingen emojis eller ekstra felter.`,
      `KRITISK: Post 1 SKAL være i første person (jeg) og indeholde al nødvendig information.`,
      `KRITISK: Alle efterfølgende poster skal være quiz-spørgsmål med præcis 4 svarmuligheder hvor index 0 er korrekt, og som udelukkende er udledt af Post 1.`,
      `Returner kun det JSON-objekt der matcher det specificerede format.`,
    ].join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: "RollespilBuilderInterviewRun",
      schemaDescription: "Et komplet rollespils-løb i nyt intro+quiz-format.",
      system: systemPrompt,
      prompt,
      temperature: 0.6,
      timeout: OPENAI_TIMEOUT_MS,
      providerOptions: {
        openai: {
          strictJsonSchema: false,
        },
      },
    });

    // Normalise output and provide sensible fallbacks instead of throwing.
    const rawPosts = Array.isArray(object.posts) ? object.posts : [];

    const fallbackAnswers = ["konge", "slot", "sværd", "hest", "skat", "nøgle", "lys", "bog"];

    const normalizedPosts = Array.from({ length: count }).map((_, i) => {
      const raw = rawPosts[i] ?? {};
      const characterName =
        asTrimmedString((raw as any).characterName) || fallbackCharacterName(i);

      // Intro post: prefer explicit fields introMessage / message
      if (i === 0) {
        const introMessage =
          asTrimmedString((raw as any).introMessage) || asTrimmedString((raw as any).message) || "";
        const safeIntro = introMessage || `${characterName} præsenterer sig.`;
        return {
          id: String(i + 1),
          postType: "intro",
          characterName,
          introMessage: safeIntro.replace(/\?/g, "."),
        } as const;
      }

      // Quiz posts: extract question and answers/options
      const questionMessage =
        asTrimmedString((raw as any).questionMessage) || asTrimmedString((raw as any).question) || asTrimmedString((raw as any).message) || "";
      let answers: string[] = Array.isArray((raw as any).answers)
        ? (raw as any).answers.map((a: unknown) => asTrimmedString(a)).filter(Boolean)
        : Array.isArray((raw as any).options)
        ? (raw as any).options.map((a: unknown) => asTrimmedString(a)).filter(Boolean)
        : [];

      // If the AI provided a single 'answer' value, ensure it's the first item.
      const explicitAnswer = asTrimmedString((raw as any).answer);
      if (explicitAnswer && !answers.includes(explicitAnswer)) {
        answers = [explicitAnswer, ...answers];
      }

      // Fill to exactly 4 options, prefer keeping provided ones
      const resultOptions: string[] = [];
      for (const a of answers) {
        if (a && !resultOptions.includes(a)) resultOptions.push(a);
        if (resultOptions.length === 4) break;
      }
      let fillIndex = 0;
      while (resultOptions.length < 4) {
        const candidate = fallbackAnswers[(i + fillIndex) % fallbackAnswers.length];
        if (!resultOptions.includes(candidate)) resultOptions.push(candidate);
        fillIndex += 1;
      }

      // Ensure the declared correct answer (if any) is at index 0.
      const correct = explicitAnswer || resultOptions[0] || fallbackAnswers[i % fallbackAnswers.length];
      // Move correct to index 0
      const deduped = Array.from(new Set([correct, ...resultOptions]));
      const finalAnswers = deduped.slice(0, 4);

      return {
        id: String(i + 1),
        postType: "quiz",
        questionMessage: questionMessage || `${characterName} stiller et spørgsmål.`,
        answers: finalAnswers,
      } as const;
    });

    const roll_title = asTrimmedString((object as any).title) || `${topic} — Rollespil`;
    const roll_desc = asTrimmedString((object as any).description) || `Et kort rollespil om ${topic}.`;
    const fag = subject || "";

    return NextResponse.json({
      roll_title,
      roll_desc,
      fag,
      questions: normalizedPosts.map((p) => {
        if ((p as any).postType === "intro") {
          return {
            id: (p as any).id,
            postType: "intro",
            characterName: (p as any).characterName,
            introMessage: (p as any).introMessage,
          };
        }

        return {
          id: (p as any).id,
          postType: "quiz",
          questionMessage: (p as any).questionMessage,
          answers: (p as any).answers,
        };
      }),
    });
  } catch (error) {
    console.error("Fejl i rollespil-builder/interview:", error);

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "AI'en var for længe om at svare. Prøv igen." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Kunne ikke bygge rollespillet lige nu. Prøv igen om et øjeblik." },
      { status: 500 }
    );
  }
}
