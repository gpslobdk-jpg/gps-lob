import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_TIMEOUT_MS = 45_000;

type RoleplayResponsePayload = {
  characterName?: unknown;
  characterPersonality?: unknown;
  question?: unknown;
  wrongAnswer?: unknown;
  correctAnswer?: unknown;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

    const payload = (await req.json()) as RoleplayResponsePayload;
    const characterName = asTrimmedString(payload.characterName);
    const characterPersonality = asTrimmedString(payload.characterPersonality);
    const question = asTrimmedString(payload.question);
    const wrongAnswer = asTrimmedString(payload.wrongAnswer);
    const correctAnswer = asTrimmedString(payload.correctAnswer);

    if (
      !characterName ||
      !characterPersonality ||
      !question ||
      !wrongAnswer ||
      !correctAnswer
    ) {
      return NextResponse.json(
        { error: "Der mangler data til rolle-svaret." },
        { status: 400 }
      );
    }

    const systemPrompt = `Du er karakteren: ${characterName}. Din personlighed er: ${characterPersonality}. Spilleren har lige fået spørgsmålet: "${question}" og svarede forkert med: "${wrongAnswer}". Det rigtige svar er "${correctAnswer}". Din opgave er at give et KORT, sjovt og in-character svar, hvor du reagerer på det forkerte svar og giver et lillebitte, kryptisk hint til det rigtige. Maks 2-3 sætninger. Afslør ALDRIG det præcise rigtige svar.

Vigtige regler:
- Svar altid på dansk.
- Hold dig i rollen.
- Vær kort, levende og lidt drillende.
- Returner kun gyldigt JSON i formatet { "message": "..." }.`;

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, OPENAI_TIMEOUT_MS);

    let response;
    try {
      response = await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content:
                "Skriv nu kun JSON med et kort rolle-svar og et kryptisk hint uden at afsløre facit.",
            },
          ],
          temperature: 0.8,
        },
        {
          signal: timeoutController.signal,
          timeout: OPENAI_TIMEOUT_MS,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      return NextResponse.json(
        { error: "AI returnerede et tomt rolle-svar." },
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

    const message = asTrimmedString((parsed as { message?: unknown } | null)?.message);
    if (!message) {
      return NextResponse.json(
        { error: "AI returnerede ikke noget brugbart rolle-svar." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Fejl i roleplay-response:", error);
    if (
      error instanceof OpenAI.APIConnectionTimeoutError ||
      error instanceof OpenAI.APIUserAbortError ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return NextResponse.json(
        { error: "AI'en var for længe om at svare. Prøv igen." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Kunne ikke hente et rolle-svar lige nu." },
      { status: 500 }
    );
  }
}
