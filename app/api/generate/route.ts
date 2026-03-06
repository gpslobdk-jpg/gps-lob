import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_COUNT = 5;

type GeneratePayload = {
  subject?: unknown;
  topic?: unknown;
  grade?: unknown;
  count?: unknown;
  prompt?: unknown;
  pedagogicalContext?: unknown;
};

type GeneratedQuestion = {
  text: string;
  answers: [string, string, string, string];
  correctIndex: number;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_COUNT;
  return Math.min(20, Math.max(1, Math.floor(value)));
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

function normalizeQuestions(rawData: unknown, desiredCount: number): GeneratedQuestion[] {
  if (!rawData || typeof rawData !== "object") return [];

  const maybeQuestions = (rawData as { questions?: unknown }).questions;
  if (!Array.isArray(maybeQuestions)) return [];

  const normalized = maybeQuestions
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const record = item as {
        text?: unknown;
        answers?: unknown;
        correctIndex?: unknown;
      };

      const text = asTrimmedString(record.text);
      if (!text) return null;
      if (!Array.isArray(record.answers)) return null;

      const answers = record.answers
        .filter((answer): answer is string => typeof answer === "string")
        .map((answer) => answer.trim())
        .filter(Boolean)
        .slice(0, 4);

      if (answers.length !== 4) return null;

      if (
        typeof record.correctIndex !== "number" ||
        !Number.isInteger(record.correctIndex) ||
        record.correctIndex < 0 ||
        record.correctIndex > 3
      ) {
        return null;
      }

      return {
        text,
        answers: [
          answers[0] ?? "",
          answers[1] ?? "",
          answers[2] ?? "",
          answers[3] ?? "",
        ] as [string, string, string, string],
        correctIndex: record.correctIndex,
      };
    })
    .filter((question): question is GeneratedQuestion => question !== null)
    .slice(0, desiredCount);

  return normalized;
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as GeneratePayload;
    const subject = asTrimmedString(payload.subject);
    const topic = asTrimmedString(payload.topic);
    const grade = asTrimmedString(payload.grade);
    const extraPrompt = asTrimmedString(payload.prompt);
    const count = asCount(payload.count);

    if (!subject || !topic) {
      return NextResponse.json({ error: "Fag og emne mangler." }, { status: 400 });
    }

    const contextualPrompt =
      asTrimmedString(payload.pedagogicalContext) ||
      [
        `Du er en pædagogisk konsulent. Generer ${count} GPS-løb poster til ${grade || "det valgte klassetrin"} i faget ${subject} om emnet ${topic}.`,
        extraPrompt.length > 0
          ? extraPrompt.endsWith(".")
            ? extraPrompt
            : `${extraPrompt}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

    const levelInstruction = getLevelInstruction(grade);

    const systemPrompt = `Du er en pædagogisk konsulent, der designer spørgsmål til GPS-løb i undervisning.
${contextualPrompt}
Målgruppe: ${grade || "ikke angivet"}.
Strikte niveauregler:
- Hvis niveauet er Indskoling, skal sproget være ekstremt simpelt og legende.
- Hvis niveauet er Gymnasialt eller Ungdomsuddannelse, skal indholdet være fagligt udfordrende og komplekst.
- For øvrige niveauer skal sværhedsgrad og sprog være alderssvarende.
Aktiv niveautolkning til dette kald: ${levelInstruction}

Krav til output:
- Returner KUN valid JSON (ingen markdown, ingen forklaringer).
- JSON skal have denne præcise struktur:
{
  "questions": [
    {
      "text": "Selve spørgsmålet",
      "answers": ["Svar A", "Svar B", "Svar C", "Svar D"],
      "correctIndex": 0
    }
  ]
}
- "questions" skal indeholde præcis ${count} objekter.
- Hvert spørgsmål skal have præcis 4 svarmuligheder.
- "correctIndex" skal altid være et heltal fra 0 til 3.
- Hele indholdet skal være på dansk.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Returner nu kun JSON." },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      return NextResponse.json({ error: "AI returnerede tomt svar." }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return NextResponse.json({ error: "AI returnerede ugyldigt JSON-format." }, { status: 502 });
    }

    const normalizedQuestions = normalizeQuestions(parsed, count);
    if (normalizedQuestions.length !== count) {
      return NextResponse.json(
        { error: "AI returnerede ikke det ønskede antal gyldige spørgsmål." },
        { status: 502 }
      );
    }

    return NextResponse.json({ questions: normalizedQuestions });
  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ error: "Fejl ved generering." }, { status: 500 });
  }
}
