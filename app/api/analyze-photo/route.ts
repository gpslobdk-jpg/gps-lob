import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type AnalyzePhotoPayload = {
  image?: unknown;
  targetObject?: unknown;
};

type AnalyzePhotoResult = {
  isMatch: boolean;
  message: string;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAnalysisResult(raw: unknown): AnalyzePhotoResult | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  const isMatch = candidate.isMatch;
  const message = candidate.message;

  if (typeof isMatch !== "boolean") return null;
  if (typeof message !== "string" || message.trim().length === 0) return null;

  return {
    isMatch,
    message: message.trim(),
  };
}

export async function POST(req: Request) {
  let payload: AnalyzePhotoPayload;

  try {
    payload = (await req.json()) as AnalyzePhotoPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  try {
    const image = asTrimmedString(payload.image);
    const targetObject = asTrimmedString(payload.targetObject);

    if (!image || !targetObject) {
      return NextResponse.json({ error: "Billede eller mål-objekt mangler." }, { status: 400 });
    }

    if (!image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Billedet skal være et base64 data-URI." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY mangler i miljøet." }, { status: 500 });
    }

    const systemPrompt = `Du er en sjov og opmuntrende dommer i et udendørs GPS-løb for børn og voksne. Din opgave er at vurdere, om det uploadede billede indeholder det anmodede motiv: ${targetObject}.
Returner KUN et validt JSON-objekt med dette format:
{
  "isMatch": boolean,
  "message": string
}
Regler:
- "isMatch" skal være true hvis motivet tydeligt er på billedet, ellers false.
- Svar altid på dansk.
- "message" skal være en kort, opmuntrende kommentar på højst 2 sætninger.
- Svar kun med valid JSON. Ingen markdown, ingen forklaringer uden for JSON.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Vurder om billedet matcher dette motiv: ${targetObject}.`,
            },
            {
              type: "image_url",
              image_url: {
                url: image,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("AI returnerede tomt svar.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error("AI returnerede ugyldigt JSON-format.");
    }

    const result = normalizeAnalysisResult(parsed);
    if (!result) {
      throw new Error("AI returnerede ugyldig billedanalyse.");
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Analyze photo API-fejl:", error);
    return NextResponse.json({ error: "Kunne ikke analysere billedet lige nu." }, { status: 500 });
  }
}
