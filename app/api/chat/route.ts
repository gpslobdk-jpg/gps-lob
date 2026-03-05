import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT =
  "Du er GPSLØB-guiden. Du hjælper brugere med at skabe interaktive GPS-løb. Vær venlig, hjælpsom og kortfattet. Du ved at man kan oprette løb på 'opret'-siden, se sine løb i 'arkivet', og at deltagere skal bruge en kode for at være med.";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY mangler i miljøet." },
        { status: 500 }
      );
    }

    const { messages } = (await req.json()) as { messages?: UIMessage[] };
    const uiMessages = Array.isArray(messages) ? messages : [];

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(uiMessages),
      temperature: 0.4,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API-fejl:", error);
    return NextResponse.json(
      { error: "Kunne ikke hente svar fra AI-guiden." },
      { status: 500 }
    );
  }
}
