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
    count: z
      .union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)])
      .optional()
      .default(DEFAULT_COUNT),
  })
  .strict();

const generatedPostSchema = z
  .object({
    characterName: z.string().trim().min(1).max(60),
    avatar: z.string().trim().min(1).max(40),
    message: z.string().trim().min(1).max(500),
    answer: z
      .string()
      .trim()
      .max(24)
      .refine((value) => value.split(/\s+/).filter(Boolean).length <= 2, {
        message: "Answer må højst være to ord.",
      })
      .optional(),
  })
  .strict();

function createGeneratedRunSchema(desiredCount: number) {
  return z
    .object({
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      posts: z.array(generatedPostSchema).length(desiredCount),
    })
    .strict();
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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
    const schema = createGeneratedRunSchema(count);
    const subjectLine = subject ? `Fag eller kategori: ${subject}.` : "Fag eller kategori: Ikke angivet.";

    const systemPrompt = `Du er en dansk seniorforfatter og pædagogisk scenedesigner for GPSLØB.
Du bygger komplette rollespils-løb til rollespil-builderen.

Du SKAL altid følge disse regler:
- Alt indhold skal være på dansk.
- Returner kun gyldigt JSON, der matcher schemaet.
- Returner præcis ${count} posts.
- Post 0 SKAL være en ren intro-post.
- Intro-posten må IKKE være et spørgsmål.
- Intro-posten må IKKE give en opgave.
- Intro-posten må IKKE kræve et svar.
- Intro-posten må IKKE have noget udfyldt i "answer".
- Intro-posten skal kun præsentere karakteren, situationen og historiens start.
- Alle efterfølgende poster skal være quiz- eller gådeposter med ét tydeligt facit i "answer".
- For post 1 og frem SKAL "answer" være ekstremt simpelt og let at skrive på mobil.
- Foretræk ét ord i "answer". Brug kun to ord hvis det er absolut nødvendigt.
- Brug konkrete og lette facitord som "konge", "sværd", "hest", "slot" eller lignende.
- Undgå lange facitsvar, hele sætninger, navne med titler og komplicerede formuleringer.
- Karakterens beskeder skal være levende, in-character og fortællende, men stadig korte nok til at fungere på mobil.
- Hver post skal have en tydelig karakter med navn og en enkel avatar, helst en emoji.
- Titel skal være fængende, motiverende og brugbar i arkivet.
- Beskrivelse skal være engagerende, indbydende og forklare løbets idé i 1-2 sætninger.
- Tilpas både sprog, sværhedsgrad og fortællestil til målgruppen "${audience}".
- Tag målgruppen seriøst:
  - Indskoling: brug meget enkel formulering, korte beskeder og helt konkrete svarord.
  - Mellemtrin: brug let forståelig fortælling med lidt mere variation, men stadig korte og tydelige svarord.
  - Udskoling: brug mere moden fortælling og lidt skarpere spørgsmål, men stadig meget lette facitsvar.
  - Voksne: brug mere præcis og stemningsfuld formulering, men hold stadig facitsvarene ekstremt enkle.
- Tonen "${tone}" må gerne præge historien, men må aldrig gøre facitsvarene lange eller uklare.
- Hele løbet skal opleves som én samlet historie med en tydelig begyndelse i intro-posten.`;

    const prompt = [
      `Tema: ${topic}.`,
      subjectLine,
      `Målgruppe: ${audience}.`,
      `Tone: ${tone}.`,
      `Antal poster i alt: ${count}.`,
      `KRITISK: Post 0 er altid introen og må ikke have answer.`,
      `KRITISK: Der skal være præcis ${Math.max(0, count - 1)} quiz- eller gådeposter efter introen.`,
      "Hver quiz-post efter introen skal have ét ekstremt simpelt facitsvar, helst ét ord.",
      "Byg nu et komplet rollespils-løb med title, description og posts.",
    ].join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: "RollespilBuilderInterviewRun",
      schemaDescription:
        "Et komplet rollespils-løb med titel, beskrivelse og karakterposter, hvor første post er intro.",
      system: systemPrompt,
      prompt,
      temperature: 0.8,
      timeout: OPENAI_TIMEOUT_MS,
      providerOptions: {
        openai: {
          strictJsonSchema: true,
        },
      },
    });

    const normalizedPosts = object.posts.map((post) => ({
      characterName: asTrimmedString(post.characterName),
      avatar: asTrimmedString(post.avatar),
      message: asTrimmedString(post.message),
      answer: asTrimmedString(post.answer),
    }));

    if (normalizedPosts.length !== count) {
      throw new Error("AI'en returnerede et forkert antal rolleposter.");
    }

    const introPost = normalizedPosts[0];
    if (!introPost || !introPost.characterName || !introPost.avatar || !introPost.message) {
      throw new Error("AI'en returnerede en ugyldig intro-post.");
    }

    if (introPost.answer) {
      throw new Error("Intro-posten må ikke have et facitsvar.");
    }

    if (introPost.message.includes("?")) {
      throw new Error("Intro-posten må ikke være formuleret som et spørgsmål.");
    }

    const quizPosts = normalizedPosts.slice(1);
    if (quizPosts.some((post) => !post.characterName || !post.avatar || !post.message || !post.answer)) {
      throw new Error("AI'en returnerede en ugyldig quiz-post.");
    }

    if (quizPosts.some((post) => !hasSimpleAnswer(post.answer))) {
      throw new Error("AI'en returnerede et facitsvar, der ikke er simpelt nok.");
    }

    return NextResponse.json({
      title: object.title.trim(),
      description: object.description.trim(),
      posts: normalizedPosts.map((post, index) =>
        index === 0
          ? {
              characterName: post.characterName,
              avatar: post.avatar,
              message: post.message,
            }
          : {
              characterName: post.characterName,
              avatar: post.avatar,
              message: post.message,
              answer: post.answer,
            }
      ),
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
