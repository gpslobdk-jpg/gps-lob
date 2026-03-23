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

    const systemPrompt = `You are a special-purpose generator for narrative-driven educational roleplay games. Your task is to create a complete game structure for a specified character or theme, using a first-person perspective.

Critical Rule 1 (Post 1: The Intro):
The first element (questions[0]) is ALWAYS the character introduction. This must be a captivating, information-dense first-person ("jeg") narrative. In this post, the character introduces themselves and provides all necessary facts and information about who they are, their life, their mission, etc. This text is the SOLE source of information for all following questions. The character must speak directly to the students, e.g., "Goddag unge mennesker! Jeg hedder Kong Christian IV..."

Critical Rule 2 (Post 2+: The Derived Quiz):
All subsequent elements (Post 2+) are simple quiz questions with four answer options. These questions must be derived strictly and solely from the information presented in the Post 1 intro text. Each question must have one correct answer (index 0) and three plausible incorrect ones. The goal is to test students on what the character just told them.

Formatting:
The entire response must be a single JSON object. Do not include markdown or emojis. Use clean Danish.

{ roll_title: "Faglig titel på løbet", roll_desc: "Kort beskrivelse", fag: "Relevant dansk fag", questions: [ { id: "1", postType: "intro", characterName: "Navn på rollen", introMessage: "Førstepersonsfortælling..." }, { id: "2", postType: "quiz", questionMessage: "Simple quiz-spørgsmål 1...", answers: ["Korrekt svar", "Svar B", "Svar C", "Svar D"] }, { id: "3", postType: "quiz", questionMessage: "Simple quiz-spørgsmål 2...", answers: ["Korrekt svar", "Svar B", "Svar C", "Svar D"] } ] }`;

    // Ensure AI generates Danish text and no emojis in labels or content.
    const languageNote = "Skriv altid på dansk. Ingen emojis."

    const prompt = [
      `Tema: ${topic}.`,
      subjectLine,
      `Målgruppe: ${audience}.`,
      `Tone: ${tone}.`,
      `Antal poster i alt: ${count}.`,
      languageNote,
      forceFirstPerson ? "KRITISK: Post 1 (index 0) SKAL være i første person (jeg) og tale direkte til eleven." : "KRITISK: Post 1 (index 0) SKAL være intro og indeholde al nødvendig information.",
      `KRITISK: Alle quiz-spørgsmål efter introen skal udelukkende være udledt af introens indhold og have 4 svarmuligheder hvor index 0 er korrekt.`,
      "Returner kun gyldigt JSON i det angivne format. Ingen ekstra felter som avatar eller emojis.",
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
