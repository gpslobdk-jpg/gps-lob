import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_COUNT = 5;
const OPENAI_TIMEOUT_MS = 45_000;
const MAX_TOPIC_LENGTH = 150;
const MAX_SOURCE_TEXT_LENGTH = 18000;
const MAX_IMAGE_DATA_LENGTH = 6_000_000;
const MAX_REQUEST_BODY_BYTES = 5_000_000;

type GenerateRunPayload = {
  topic?: unknown;
  sourceText?: unknown;
  imageBase64?: unknown;
  count?: unknown;
};

type NormalizedQuestion = {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  lat: null;
  lng: null;
};

const generatedRunQuestionSchema = z
  .object({
    question: z.string().trim().min(1),
    options: z.tuple([
      z.string().trim().min(1),
      z.string().trim().min(1),
      z.string().trim().min(1),
      z.string().trim().min(1),
    ]),
    correctIndex: z.number().int().min(0).max(3),
    lat: z.null(),
    lng: z.null(),
  })
  .strict();

function createGeneratedRunSchema(desiredCount: number) {
  return z
    .object({
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      questions: z.array(generatedRunQuestionSchema).length(desiredCount),
    })
    .strict();
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(20, Math.max(3, Math.floor(value)));
  }

  return DEFAULT_COUNT;
}

function getContentLength(request: Request): number | null {
  const rawValue = request.headers.get("content-length")?.trim();
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeQuestions(
  questions: z.infer<typeof generatedRunQuestionSchema>[]
): NormalizedQuestion[] {
  return questions.map((question) => ({
    question: question.question,
    options: [
      question.options[0],
      question.options[1],
      question.options[2],
      question.options[3],
    ],
    correctIndex: question.correctIndex,
    lat: null,
    lng: null,
  }));
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      /timed out|timeout|aborted/i.test(error.message))
  );
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY mangler i miljøet." },
        { status: 500 }
      );
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

    const contentLength = getContentLength(req);
    if (contentLength !== null && contentLength > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        { error: "Materialet er for stort. Brug et mindre tekstudsnit eller billede." },
        { status: 413 }
      );
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        { error: "Materialet er for stort. Brug et mindre tekstudsnit eller billede." },
        { status: 413 }
      );
    }

    let payload: GenerateRunPayload;
    try {
      payload = JSON.parse(rawBody) as GenerateRunPayload;
    } catch {
      return NextResponse.json(
        { error: "Request-body skal være gyldigt JSON." },
        { status: 400 }
      );
    }

    const topic = asTrimmedString(payload.topic);
    const sourceText = asTrimmedString(payload.sourceText);
    const imageBase64 = asTrimmedString(payload.imageBase64);
    const hasMaterial = sourceText.length > 0 || imageBase64.length > 0;
    const count = hasMaterial ? 5 : asCount(payload.count);

    if (!topic && !hasMaterial) {
      return NextResponse.json(
        { error: "Send enten et emne eller noget materiale til AI'en." },
        { status: 400 }
      );
    }

    if (topic.length > MAX_TOPIC_LENGTH) {
      return NextResponse.json(
        { error: "Emnet er for langt. Hold det under 150 tegn." },
        { status: 400 }
      );
    }

    if (sourceText.length > MAX_SOURCE_TEXT_LENGTH) {
      return NextResponse.json(
        { error: "Materialeteksten er for lang. Kort den ned og prøv igen." },
        { status: 400 }
      );
    }

    if (imageBase64 && !imageBase64.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Billedet skal sendes som en gyldig data-URL." },
        { status: 400 }
      );
    }

    if (imageBase64.length > MAX_IMAGE_DATA_LENGTH) {
      return NextResponse.json(
        { error: "Billedet er for stort til AI-behandling. Prøv et mindre udsnit." },
        { status: 400 }
      );
    }

    const systemPrompt = hasMaterial
      ? `Du er en dansk AI-løbsbygger til GPSLØB.
Du hjælper lærere med at forvandle konkret undervisningsmateriale til et GPS-løb.

Læs følgende materiale grundigt. Generer et GPS-løb med 5 spørgsmål, hvor alle rigtige svar kan findes direkte i materialet.

Vigtige regler:
- Du må kun bruge oplysninger, der tydeligt findes i materialet.
- Du må ikke opfinde fakta, som ikke kan læses direkte i materialet.
- Alt indhold skal være på dansk.
- Løbet skal passe til en udendørs quiz for skole eller undervisning.
- Returner kun struktureret output, der matcher schemaet.
- Hver question skal have præcis 4 svarmuligheder.
- correctIndex skal være et heltal fra 0 til 3.
- lat og lng skal altid være null.`
      : `Du er en dansk AI-løbsbygger til GPSLØB.
Du hjælper lærere med at auto-generere komplette quiz-løb.

Vigtige regler:
- Alt indhold skal være på dansk.
- Løbet skal passe til en udendørs quiz for skole eller undervisning.
- Returner kun struktureret output, der matcher schemaet.
- "questions" skal indeholde præcis ${count} objekter.
- Hvert spørgsmål skal have præcis 4 svarmuligheder.
- correctIndex skal være et heltal fra 0 til 3.
- lat og lng skal altid være null.
- Titel og beskrivelse skal være korte, tydelige og brugbare i builderen.`;

    const schema = createGeneratedRunSchema(count);

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: "ManualBuilderGeneratedRun",
      schemaDescription:
        "Et komplet løbsudkast til den manuelle GPS-bygger med titel, beskrivelse og quizspørgsmål.",
      system: systemPrompt,
      ...(hasMaterial
        ? {
            messages: [
              {
                role: "user" as const,
                content: [
                  {
                    type: "text" as const,
                    text:
                      `Læs materialet grundigt og lav nu et GPS-løb med 5 spørgsmål, hvor alle rigtige svar kan findes direkte i materialet.` +
                      (sourceText
                        ? `\n\nMaterialetekst:\n${sourceText}`
                        : "\n\nBrug bogside-billedet som materiale.") +
                      "\n\nReturner kun det strukturerede output.",
                  },
                  ...(imageBase64
                    ? [
                        {
                          type: "image" as const,
                          image: imageBase64,
                          providerOptions: {
                            openai: { imageDetail: "low" },
                          },
                        },
                      ]
                    : []),
                ],
              },
            ],
            temperature: 0.3,
          }
        : {
            prompt: `Lav nu et komplet GPS-løb om dette emne: ${topic}

Husk at returnere præcis ${count} spørgsmål og kun det strukturerede output.`,
            temperature: 0.7,
          }),
      timeout: OPENAI_TIMEOUT_MS,
      providerOptions: {
        openai: {
          strictJsonSchema: true,
        },
      },
    });

    return NextResponse.json({
      title: object.title,
      description: object.description,
      questions: normalizeQuestions(object.questions),
    });
  } catch (error) {
    console.error("Fejl i generate-run:", error);

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "AI'en var for længe om at svare. Prøv igen." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Kunne ikke auto-generere løbet lige nu." },
      { status: 500 }
    );
  }
}
