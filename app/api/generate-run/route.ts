import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import {
  formatGradeLevelsForPrompt,
  GRADE_LEVEL_OPTIONS,
  getGradeLevelRange,
  normalizeGradeLevels,
} from "@/utils/gradeLevels";

export const maxDuration = 300;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_COUNTS = [5, 10, 15, 20] as const;
const DEFAULT_COUNT = 10;
const OPENAI_TIMEOUT_MS = 45_000;
const MAX_TOPIC_LENGTH = 150;
const MAX_SUBJECT_LENGTH = 80;
const MAX_SOURCE_TEXT_LENGTH = 18000;
const MAX_IMAGE_DATA_LENGTH = 6_000_000;
const MAX_REQUEST_BODY_BYTES = 12_000_000;
const MAX_IMAGE_COUNT = 5;

type GenerateRunPayload = {
  topic?: unknown;
  sourceText?: unknown;
  imageBase64List?: unknown;
  subject?: unknown;
  gradeLevels?: unknown;
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
    options: z.array(z.string().trim().min(1)),
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

function asTrimmedStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.floor(value) as (typeof ALLOWED_COUNTS)[number];
    if (ALLOWED_COUNTS.includes(normalized)) {
      return normalized;
    }
  }

  return DEFAULT_COUNT;
}

function resolveGenerateRunGradeLevelGuidance(gradeLevels: readonly string[]): string {
  const { lowestGrade, highestGrade } = getGradeLevelRange(gradeLevels);

  if (lowestGrade !== null && highestGrade !== null && lowestGrade !== highestGrade) {
    return `Hold sproget tilgængeligt nok til de yngste (${lowestGrade}. klasse), men byg faglig progression og udfordring ind til de ældste (${highestGrade}. klasse). Variér sværhedsgraden, så der er noget for alle niveauer.`;
  }

  const gradeNumber = highestGrade;

  if (gradeNumber !== null && gradeNumber <= 2) {
    return "Brug meget enkelt, kort og konkret sprog. Korte sætninger, dagligdags ord, ingen fagtermer. Spørgsmålene skal være meget konkrete og lette at afkode. Svarmulighederne skal være korte (1-3 ord).";
  }

  if (gradeNumber !== null && gradeNumber <= 4) {
    return "Brug klart, overskueligt sprog med korte sætninger og velkendte situationer. Du må bruge enkle fagbegreber, der forklares kort. Spørgsmålene skal kræve simpel forståelse og genkendelse.";
  }

  if (gradeNumber !== null && gradeNumber <= 6) {
    return "Brug klart og alderssvarende sprog med lidt mere variation og faglig dybde. Fagbegreber må bruges, men skal forklares kort. Spørgsmålene skal kræve let logisk tænkning og refleksion.";
  }

  if (gradeNumber !== null && gradeNumber <= 9) {
    return "Brug præcist, udfordrende sprog med fagtermer og komplekse sætninger. Spørgsmålene må gerne kræve analyse, perspektivering og kildekritisk tænkning. Højt fagligt niveau.";
  }

  return "Brug klart og alderssvarende sprog med lidt mere variation og faglig dybde.";
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

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  // Expect format: data:[<mediatype>][;base64],<data>
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return null;

  const base64 = dataUrl.substring(comma + 1);
  try {
    const buffer = Buffer.from(base64, "base64");
    return new Uint8Array(buffer);
  } catch (err) {
    return null;
  }
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      /timed out|timeout|aborted/i.test(error.message))
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
        context: "generate_run_missing_openai_key",
        status: 500,
        error: "OPENAI_API_KEY mangler i miljøet.",
      });
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
    const imageBase64List = asTrimmedStringArray(payload.imageBase64List);
    const subject = asTrimmedString(payload.subject);
    const gradeLevels = normalizeGradeLevels(payload.gradeLevels);
    const gradeLevelLabel = gradeLevels.length > 0 ? formatGradeLevelsForPrompt(gradeLevels) : "Mellemtrin (4.–6. klasse)";
    const gradeLevelGuidance = resolveGenerateRunGradeLevelGuidance(gradeLevels);
    const hasMaterial = sourceText.length > 0 || imageBase64List.length > 0;
    const count = asCount(payload.count);

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

    if (subject.length > MAX_SUBJECT_LENGTH) {
      return NextResponse.json(
        { error: "Faget er for langt. Hold det under 80 tegn." },
        { status: 400 }
      );
    }

    if (sourceText.length > MAX_SOURCE_TEXT_LENGTH) {
      return NextResponse.json(
        { error: "Materialeteksten er for lang. Kort den ned og prøv igen." },
        { status: 400 }
      );
    }

    if (imageBase64List.length > MAX_IMAGE_COUNT) {
      return NextResponse.json(
        { error: "Du kan maks sende 5 billeder ad gangen." },
        { status: 400 }
      );
    }

    for (const imageBase64 of imageBase64List) {
      if (!imageBase64.startsWith("data:image/")) {
        return NextResponse.json(
          { error: "Billederne skal sendes som gyldige data-URL'er." },
          { status: 400 }
        );
      }

      if (imageBase64.length > MAX_IMAGE_DATA_LENGTH) {
        return NextResponse.json(
          { error: "Et af billederne er for stort til AI-behandling. Prøv et mindre udsnit." },
          { status: 400 }
        );
      }
    }

    const audienceGuidance = gradeLevelGuidance;
    const subjectLine = subject
      ? `- Brug faget "${subject}" som tydelig faglig ramme for spørgsmålene.`
      : "- Hold spørgsmålene fagligt relevante for undervisning.";

    const systemPrompt = hasMaterial
      ? `Du er en dansk AI-løbsbygger til GPSLØB.
Du hjælper lærere med at forvandle konkret undervisningsmateriale til et GPS-løb.
Du er en dygtig lærer, der laver en sjov læseforståelses-quiz.

Læs materialet grundigt og generer et GPS-løb med præcis ${count} spørgsmål.

Vigtige regler:
- Alt indhold skal være på dansk.
- Løbet skal passe til en udendørs quiz for skole eller undervisning.
- Returner kun struktureret output, der matcher schemaet.
- "questions" skal indeholde præcis ${count} objekter.
- Hver question skal have præcis 4 svarmuligheder.
- correctIndex skal være et heltal fra 0 til 3.
- lat og lng skal altid være null.
- Titel og beskrivelse skal være korte, tydelige og brugbare i builderen.
- Tag stærkest muligt udgangspunkt i den vedlagte tekst eller de vedlagte billeder.
- Dine spørgsmål skal handle om det, der står på siderne, så du tester, om eleverne har læst og forstået indholdet.
- Sørg for, at de rigtige svar giver mening ud fra teksten og materialet.
- Spørgsmålene må gerne omformulere materialet, men de skal stadig føles tydeligt forankret i det, eleverne har læst.
- Hvis materialet er uklart et sted, så vælg hellere tydelige og sikre spor fra teksten eller billederne.
- Sprog og sværhedsgrad skal passe præcist til klassetrin: ${gradeLevelLabel}.
- ${audienceGuidance}
${subjectLine}`
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
- Titel og beskrivelse skal være korte, tydelige og brugbare i builderen.
- Sprog og sværhedsgrad skal passe præcist til klassetrin: ${gradeLevelLabel}.
- ${audienceGuidance}
${subjectLine}`;

    const schema = createGeneratedRunSchema(count);

    const imagePayloads: Uint8Array[] = [];
    for (const imageBase64 of imageBase64List) {
      const converted = dataUrlToUint8Array(imageBase64);
      if (!converted) {
        return NextResponse.json(
          { error: "Billederne skal sendes som gyldige data-URL'er." },
          { status: 400 }
        );
      }

      imagePayloads.push(converted);
    }

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
                      `Læs materialet grundigt og lav nu et GPS-løb med præcis ${count} spørgsmål.` +
                      `\n\nKlasetrin: ${gradeLevelLabel}` +
                      (subject ? `\nFag: ${subject}` : "") +
                      "\nTag stærkest muligt udgangspunkt i materialet og lav spørgsmål, der tester læseforståelse." +
                      "\nLad spørgsmål og rigtige svar give tydelig mening ud fra det, der står på siderne eller kan ses på billederne." +
                      (sourceText
                        ? `\n\nMaterialetekst:\n${sourceText}`
                        : "\n\nBrug bogside-billederne som materiale.") +
                      "\n\nReturner kun det strukturerede output.",
                  },
                  ...imagePayloads.map((imagePayload) => ({
                    type: "image" as const,
                    image: imagePayload,
                    providerOptions: {
                      openai: { imageDetail: "high" },
                    },
                  })),
                ],
              },
            ],
            temperature: 0.3,
          }
        : {
            prompt: `Lav nu et komplet GPS-løb om dette emne: ${topic}

Klasetrin: ${gradeLevelLabel}
${subject ? `Fag: ${subject}\n` : ""}Husk at returnere præcis ${count} spørgsmål og kun det strukturerede output.`,
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

    const status = isTimeoutError(error) ? 504 : 500;
    await logHandledServerError({
      route: "/api/generate-run",
      method: "POST",
      status,
      error,
      requestPath,
      routeType: "route",
    });

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
