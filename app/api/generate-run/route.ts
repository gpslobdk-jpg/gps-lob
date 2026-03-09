import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_COUNT = 5;
const MAX_SOURCE_TEXT_LENGTH = 18000;
const MAX_IMAGE_DATA_LENGTH = 6_000_000;

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

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(20, Math.max(3, Math.floor(value)));
  }

  return DEFAULT_COUNT;
}

function normalizeQuestions(value: unknown, desiredCount: number): NormalizedQuestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const questionRecord = item as {
        question?: unknown;
        options?: unknown;
        correctIndex?: unknown;
      };

      const question = asTrimmedString(questionRecord.question);
      if (!question) return null;
      if (!Array.isArray(questionRecord.options)) return null;

      const options = questionRecord.options
        .filter((option): option is string => typeof option === "string")
        .map((option) => option.trim())
        .filter(Boolean)
        .slice(0, 4);

      if (options.length !== 4) return null;

      if (
        typeof questionRecord.correctIndex !== "number" ||
        !Number.isInteger(questionRecord.correctIndex) ||
        questionRecord.correctIndex < 0 ||
        questionRecord.correctIndex > 3
      ) {
        return null;
      }

      return {
        question,
        options: [
          options[0] ?? "",
          options[1] ?? "",
          options[2] ?? "",
          options[3] ?? "",
        ] as [string, string, string, string],
        correctIndex: questionRecord.correctIndex,
        lat: null,
        lng: null,
      };
    })
    .filter((question): question is NormalizedQuestion => question !== null)
    .slice(0, desiredCount);
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY mangler i miljøet." },
        { status: 500 }
      );
    }

    const payload = (await req.json()) as GenerateRunPayload;
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

Læs følgende materiale grundigt. Generer et GPS-løb med 5 spørgsmål, hvor alle rigtige svar KAN FINDES DIREKTE I MATERIALET.

VIGTIGE REGLER:
- Du må KUN bruge oplysninger, der tydeligt findes i materialet.
- Du må IKKE opfinde fakta, som ikke kan læses direkte i materialet.
- Du må KUN returnere gyldigt JSON.
- Du må IKKE skrive forklaringer, markdown, kodeblokke eller ekstra tekst.
- Alt indhold skal være på dansk.
- Løbet skal passe til en udendørs quiz for skole eller undervisning.

Returner ALTID præcis denne struktur:
{
  "title": "Kort og fængende titel",
  "description": "Kort beskrivelse på 1-2 sætninger",
  "questions": [
    {
      "question": "Selve spørgsmålet",
      "options": ["Svar A", "Svar B", "Svar C", "Svar D"],
      "correctIndex": 0
    }
  ]
}

KRAV TIL JSON:
- "questions" skal indeholde præcis 5 objekter.
- Hvert spørgsmål skal have præcis 4 svarmuligheder.
- "correctIndex" skal være et heltal fra 0 til 3.
- Titlen skal være kort, tydelig og brugbar som løbsnavn.
- Beskrivelsen skal kort forklare, hvad læreren og eleverne møder.
- Det korrekte svar i hvert spørgsmål skal kunne findes direkte i materialet.`
      : `Du er en dansk AI-løbsbygger til GPSLØB.
Du hjælper lærere med at auto-generere komplette quiz-løb.

VIGTIGE REGLER:
- Du må KUN returnere gyldigt JSON.
- Du må IKKE skrive forklaringer, markdown, kodeblokke eller ekstra tekst.
- Alt indhold skal være på dansk.
- Løbet skal passe til en udendørs quiz for skole eller undervisning.

Returner ALTID præcis denne struktur:
{
  "title": "Kort og fængende titel",
  "description": "Kort beskrivelse på 1-2 sætninger",
  "questions": [
    {
      "question": "Selve spørgsmålet",
      "options": ["Svar A", "Svar B", "Svar C", "Svar D"],
      "correctIndex": 0
    }
  ]
}

KRAV TIL JSON:
- "questions" skal indeholde præcis ${count} objekter.
- Hvert spørgsmål skal have præcis 4 svarmuligheder.
- "correctIndex" skal være et heltal fra 0 til 3.
- Titlen skal være kort, tydelig og brugbar som løbsnavn.
- Beskrivelsen skal kort forklare, hvad læreren og eleverne møder.
- Svar og spørgsmål skal være konkrete, varierede og realistiske for et GPS-løb.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: hasMaterial
        ? [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    `Læs materialet grundigt og lav nu et GPS-løb med 5 spørgsmål, hvor alle rigtige svar kan findes direkte i materialet.` +
                    (sourceText
                      ? `\n\nMaterialetekst:\n${sourceText}`
                      : "\n\nBrug bogside-billedet som materiale.") +
                    "\n\nReturner kun gyldigt JSON.",
                },
                ...(imageBase64
                  ? [
                      {
                        type: "image_url" as const,
                        image_url: {
                          url: imageBase64,
                        },
                      },
                    ]
                  : []),
              ],
            },
          ]
        : [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Lav nu et komplet GPS-løb om dette emne: ${topic}

Husk at returnere præcis ${count} spørgsmål og kun gyldigt JSON.`,
            },
          ],
      temperature: hasMaterial ? 0.3 : 0.7,
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      return NextResponse.json(
        { error: "AI returnerede et tomt svar." },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return NextResponse.json(
        { error: "AI returnerede ugyldigt JSON-format." },
        { status: 502 }
      );
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { error: "AI returnerede et ugyldigt løbsformat." },
        { status: 502 }
      );
    }

    const record = parsed as {
      title?: unknown;
      description?: unknown;
      questions?: unknown;
    };

    const title = asTrimmedString(record.title);
    const description = asTrimmedString(record.description);
    const questions = normalizeQuestions(record.questions, count);

    if (!title || !description || questions.length !== count) {
      return NextResponse.json(
        { error: "AI leverede ikke et fuldt gyldigt løbsudkast." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      title,
      description,
      questions,
    });
  } catch (error) {
    console.error("Fejl i generate-run:", error);
    return NextResponse.json(
      { error: "Kunne ikke auto-generere løbet lige nu." },
      { status: 500 }
    );
  }
}
