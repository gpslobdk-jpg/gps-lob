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

const generatedMissionSchema = z
  .object({
    instruction: z.string().trim().min(1),
    backgroundTarget: z.string().trim().min(1).max(32),
  })
  .strict();

function createGeneratedRunSchema(desiredCount: number) {
  return z
    .object({
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      missions: z.array(generatedMissionSchema).length(desiredCount),
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
Du bygger komplette selfie-jagter til selfie-builderen.

Du SKAL altid følge disse regler:
- Alt indhold skal være på dansk.
- Returner kun gyldigt JSON, der matcher schemaet.
- Returner præcis ${count} missioner.
- Du må under ingen omstændigheder returnere færre eller flere end ${count} missioner.
- Hver mission skal have to felter: "instruction" og "backgroundTarget".
- "instruction" er den synlige tekst til eleverne. Den må gerne være sjov, levende, specifik og lokations-fokuseret.
- "instruction" må gerne nævne konkrete steder, stemninger, positurer, ansigtsudtryk eller små udfordringer.
- "backgroundTarget" er IKKE den samme tekst som instruction.
- "backgroundTarget" skal være ekstremt generisk, tilgivende og let for billedanalysen at godkende.
- GPS'en sikrer allerede, at holdet står det rigtige sted. Derfor må backgroundTarget aldrig være lige så specifikt som instruction.
- Brug korte, brede kategorier i backgroundTarget, typisk 1-3 ord.
- Foretrukne typer af backgroundTarget er fx: "ansigter", "personer", "en gruppe", "smilende mennesker", "træ", "natur", "vand", "bygning", "mur", "legeplads" eller lignende brede motivkategorier.
- Brug aldrig egennavne, museumsnavne, gadenavne, historiske bygningstitler eller meget smalle beskrivelser i backgroundTarget.
- Hvis instruction handler om en specifik lokation, skal backgroundTarget oversætte det til en bred visuel kategori.
- Eksempel: Hvis instruction nævner "det store gamle museum", skal backgroundTarget være noget i retning af "bygning" eller "personer" - ikke "det gamle museum".
- Eksempel: Hvis instruction nævner "det ældste træ I kan finde", skal backgroundTarget være "træ" eller "natur".
- Eksempel: Hvis instruction primært handler om pose eller stemning, må backgroundTarget gerne være "ansigter", "personer" eller "en gruppe".
- BackgroundTarget skal være så tilgivende, at missionen stadig kan bestås, selv hvis ansigterne fylder meget af billedet og kun et hint af motivet kan ses.
- Titel skal være fængende, motiverende og brugbar i arkivet.
- Beskrivelse skal være engagerende, indbydende og forklare løbets idé i 1-2 sætninger.
- Tag målgruppen seriøst:
  - Indskoling: korte, tydelige og legende missioner med meget konkrete steder eller motiver.
  - Mellemtrin: sjove og klare missioner med lidt mere variation og samarbejde.
  - Udskoling: mere kreative og selvsikre missioner med tydelig stemning og mere selvstændig fortolkning.
  - Voksne: mere elegante, skarpe og stemningsfulde missioner uden at blive for interne eller pinlige.
- Tonen skal afspejle brugerens valg uden at gøre missionerne uklare eller svære at udføre.`;

    const prompt = [
      `Tema: ${topic}.`,
      subjectLine,
      `Målgruppe: ${audience}.`,
      `Tone: ${tone}.`,
      `Antal missioner: ${count}.`,
      `KRITISK: Returner præcis ${count} missioner. Ikke flere og ikke færre.`,
      "Instruction skal være specifik, sjov og stednær.",
      "BackgroundTarget skal være bredt, kort og meget tilgivende.",
      "BackgroundTarget må aldrig være så specifikt som instruction.",
      "Byg nu et komplet selfie-løb med title, description og missions.",
    ].join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: "SelfieBuilderInterviewRun",
      schemaDescription:
        "Et komplet selfie-løb med titel, beskrivelse og missions med instruction og backgroundTarget.",
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
      missions: object.missions.map((mission) => ({
        instruction: asTrimmedString(mission.instruction),
        backgroundTarget: asTrimmedString(mission.backgroundTarget),
      })),
    });
  } catch (error) {
    console.error("Fejl i selfie-builder/interview:", error);

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "AI'en var for længe om at svare. Prøv igen." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Kunne ikke bygge selfie-jagten lige nu. Prøv igen om et øjeblik." },
      { status: 500 }
    );
  }
}
