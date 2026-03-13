import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 300;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_COUNT = 5;
const OPENAI_TIMEOUT_MS = 45_000;

type GeneratePayload = {
  subject?: unknown;
  topic?: unknown;
  grade?: unknown;
  count?: unknown;
  prompt?: unknown;
  pedagogicalContext?: unknown;
  systemContext?: unknown;
  builderContext?: unknown;
};

type GeneratedQuestion = {
  text: string;
  answers: [string, string, string, string];
  correctIndex: number;
};

const generatedQuestionSchema = z
  .object({
    text: z.string().trim().min(1),
    answers: z.array(z.string().trim().min(1)),
    correctIndex: z.number().int().min(0).max(3),
  })
  .strict();

function createGeneratedResponseSchema(desiredCount: number) {
  return z
    .object({
      questions: z.array(generatedQuestionSchema).length(desiredCount),
    })
    .strict();
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_COUNT;
  return Math.min(20, Math.max(1, Math.floor(value)));
}

function joinPromptSections(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

function getLevelInstruction(grade: string): string {
  const normalizedGrade = grade.toLowerCase();

  if (normalizedGrade.includes("indskoling")) {
    return "Hvis niveauet er Indskoling, skal sproget være ekstremt simpelt, legende og meget let at forstå.";
  }

  if (normalizedGrade.includes("gymnasialt") || normalizedGrade.includes("ungdomsuddannelse")) {
    return "Hvis niveauet er Gymnasialt, skal opgaverne være fagligt udfordrende, analytiske og komplekse.";
  }

  return "Tilpas sprog, faglighed og sværhedsgrad tydeligt til det valgte klassetrin.";
}

function normalizeQuestions(questions: z.infer<typeof generatedQuestionSchema>[]): GeneratedQuestion[] {
  return questions.map((question) => ({
    text: question.text,
    answers: [
      question.answers[0],
      question.answers[1],
      question.answers[2],
      question.answers[3],
    ],
    correctIndex: question.correctIndex,
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
      return NextResponse.json({ error: "OPENAI_API_KEY mangler i miljøet." }, { status: 500 });
    }

    const payload = (await req.json()) as GeneratePayload;
    const subject = asTrimmedString(payload.subject);
    const topic = asTrimmedString(payload.topic);
    const grade = asTrimmedString(payload.grade);
    const extraPrompt = asTrimmedString(payload.prompt);
    const providedSystemContext = asTrimmedString(payload.systemContext);
    const providedBuilderContext = asTrimmedString(payload.builderContext);
    const count = asCount(payload.count);

    if (!subject || !topic) {
      return NextResponse.json({ error: "Fag og emne mangler." }, { status: 400 });
    }

    const contextualPrompt =
      asTrimmedString(payload.pedagogicalContext) ||
      [
        `Du er en pædagogisk konsulent. Generer ${count} GPS-løbsposter til ${grade || "det valgte klassetrin"} i faget ${subject} om emnet ${topic}.`,
        extraPrompt.length > 0
          ? extraPrompt.endsWith(".")
            ? extraPrompt
            : `${extraPrompt}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

    const levelInstruction = getLevelInstruction(grade);

    const fallbackSystemContext = `Du er en pædagogisk konsulent, der designer spørgsmål til GPS-løb i undervisning.
${contextualPrompt}
Målgruppe: ${grade || "ikke angivet"}.
Strikte niveauregler:
- Hvis niveauet er Indskoling, skal sproget være ekstremt simpelt og legende.
- Hvis niveauet er Gymnasialt eller Ungdomsuddannelse, skal indholdet være fagligt udfordrende og komplekst.
- For øvrige niveauer skal sværhedsgrad og sprog være alderssvarende.
Aktiv niveautolkning til dette kald: ${levelInstruction}`;

    const fallbackBuilderContext = `Krav til output:
- Returner kun valid JSON, der matcher schemaet.
- "questions" skal indeholde præcis ${count} objekter.
- Hvert spørgsmål skal have præcis 4 svarmuligheder.
- "correctIndex" skal altid være et heltal fra 0 til 3.
- Hele indholdet skal være på dansk.`;

    const systemPrompt = joinPromptSections([
      providedSystemContext || fallbackSystemContext,
      providedBuilderContext || fallbackBuilderContext,
    ]);

    const userPrompt = joinPromptSections([
      `Brugerens emne: ${topic}.`,
      `Fag eller kontekst: ${subject}.`,
      grade ? `Målgruppe eller niveau: ${grade}.` : null,
      `Ønsket antal poster: ${count}.`,
      extraPrompt
        ? extraPrompt.endsWith(".")
          ? `Brugerens ønske: ${extraPrompt}`
          : `Brugerens ønske: ${extraPrompt}.`
        : "Brugerens ønske: Lav indhold, der matcher emnet, målgruppen og GPS-konteksten.",
      "Returner nu kun det strukturerede output.",
    ]);

    const schema = createGeneratedResponseSchema(count);

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: "ManualBuilderQuizQuestions",
      schemaDescription:
        "Et sæt multiple choice-spørgsmål til den manuelle GPS-bygger.",
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      timeout: OPENAI_TIMEOUT_MS,
      providerOptions: {
        openai: {
          strictJsonSchema: true,
        },
      },
    });

    return NextResponse.json({
      questions: normalizeQuestions(object.questions),
    });
  } catch (error) {
    console.error("AI Error:", error);

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "AI'en var for længe om at svare. Prøv igen." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Kunne ikke generere spørgsmål lige nu." },
      { status: 500 }
    );
  }
}
