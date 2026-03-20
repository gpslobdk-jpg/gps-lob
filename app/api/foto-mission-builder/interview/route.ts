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
    count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional().default(DEFAULT_COUNT),
  })
  .strict();

function createGeneratedRunSchema(desiredCount: number) {
  return z
    .object({
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      missions: z.array(z.string().trim().min(1)).length(desiredCount),
    })
    .strict();
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /timed out|timeout|aborted/i.test(error.message))
  );
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

    const systemPrompt = `Du er en dansk senior-redaktør og pædagogisk designer for GPSLØB.
Du bygger komplette foto-missionsløb til foto-builderen.

Du SKAL altid følge disse regler:
- Alt indhold skal være på dansk.
- Returner kun gyldigt JSON, der matcher schemaet.
- Returner præcis ${count} missioner.
- Du må under ingen omstændigheder returnere færre eller flere end ${count} missioner.
- Hver mission skal være fysisk mulig at fotografere i virkeligheden.
- Ingen mission må handle om rene abstraktioner, usynlige processer eller ting, der ikke kan dokumenteres tydeligt med et foto.
- Hvis emnet er abstrakt, skal du omsætte det til noget visuelt beviseligt i omgivelserne. Brug konkrete, synlige spor, eksempler eller fænomener.
- Missionerne skal passe til en udendørs GPS-oplevelse og være realistiske at finde i almindelige omgivelser som skole, by, park, natur eller lokalmiljø.
- Undgå missioner, der kræver sjældne genstande, privat adgang, farlige situationer eller specialudstyr.
- Hver mission skal være en kort, klar instruktion i én sætning.
- Hver mission skal helst begynde med "Find ..." og nævne det konkrete mål tidligt i sætningen, før formuleringer som "og tag et tydeligt billede".
- Missionerne må ikke være dubletter eller næsten ens.
- Titel skal være fængende, motiverende og brugbar i arkivet.
- Beskrivelse skal være engagerende, indbydende og forklare løbets idé i 1-2 sætninger, så deltagerne får lyst til at gå i gang.
- Tonen skal afspejle brugerens valg uden at gøre missionerne uklare eller useriøse.
- Hvis tonen er "Faglig", skal missionerne tænke ud af boksen og pege på synlige beviser for faglige begreber.
- Ved faglig tone er "Find et eksempel på oxidation eller rust" bedre end "Find noget brunt".
- Tag målgruppen seriøst:
  - Indskoling: brug meget konkrete ting, farver, former, materialer eller tydelige hverdagsobjekter.
  - Mellemtrin: brug konkrete observationer med lidt mere fagligt indhold og variation.
  - Udskoling: brug synlige tegn på begreber, strukturer, mønstre eller fænomener, som skal bevises visuelt.
  - Voksne: brug præcise, udfordrende og reflekterede missioner med tydelig faglig eller tematisk skarphed.`;

    const prompt = [
      `Tema: ${topic}.`,
      subjectLine,
      `Målgruppe: ${audience}.`,
      `Tone: ${tone}.`,
      `Antal missioner: ${count}.`,
      `KRITISK: Returner præcis ${count} missioner. Ikke flere og ikke færre.`,
      "Missionerne skal være tydeligt fotograférbare og kunne løses i praksis.",
      "Hvis emnet er fagligt eller abstrakt, skal missionerne omsætte det til synlige og dokumenterbare eksempler.",
      "Skriv missionerne som korte instruktioner, gerne i formatet: 'Find ... og tag et tydeligt billede af det.'",
      "Byg nu et komplet foto-løb med titel, beskrivelse og missioner.",
    ].join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: "FotoMissionBuilderInterviewRun",
      schemaDescription:
        "Et komplet foto-missionsløb med titel, beskrivelse og mission-tekster til foto-builderen.",
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

    return NextResponse.json({
      title: object.title.trim(),
      description: object.description.trim(),
      missions: object.missions.map((mission) => mission.trim()),
    });
  } catch (error) {
    console.error("Fejl i foto-mission-builder/interview:", error);

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "AI'en var for længe om at svare. Prøv igen." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Kunne ikke bygge foto-løbet lige nu. Prøv igen om et øjeblik." },
      { status: 500 }
    );
  }
}
