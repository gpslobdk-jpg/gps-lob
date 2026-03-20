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

const generatedPuzzleSchema = z
  .object({
    riddle: z.string().trim().min(1),
    answer: z.string().trim().min(1).max(40),
  })
  .strict();

function createGeneratedRunSchema(desiredCount: number) {
  return z
    .object({
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      masterCode: z.string().regex(new RegExp(`^[A-Z0-9]{${desiredCount}}$`)),
      puzzles: z.array(generatedPuzzleSchema).length(desiredCount),
    })
    .strict();
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMasterCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
Du bygger komplette escape room-løb til escape-builderen.

Du SKAL altid følge disse regler:
- Alt indhold skal være på dansk.
- Returner kun gyldigt JSON, der matcher schemaet.
- Returner præcis ${count} gåder.
- Du må under ingen omstændigheder returnere færre eller flere end ${count} gåder.
- Hver gåde skal være en selvstændig logik-, matematik- eller mønsteropgave med ét entydigt korrekt svar.
- Gåderne skal kunne løses ud fra selve teksten, enkel ræsonnering og almindelig skoleviden. Undgå nicheviden og tilfældige trivia-spørgsmål.
- FORBUDT: ordspil, rim, anagrammer, skjulte ord, bogstavlege, sproglige finurligheder, kryptiske ledetråde og andre sprogbaserede tricks.
- KRÆV: matematik, mønstergenkendelse, sekvenser, logisk deduktion, elimination, regler, relationer, sammenligninger og systematisk problemløsning.
- Tonen må gerne farve fortællingen og stemningen, men selve gådemekanikken skal stadig være matematisk eller logisk.
- Hver gåde skal have ét præcist svar i "answer". Svar skal være korte, tydelige og lette at validere.
- Titel skal være fængende, motiverende og brugbar i arkivet.
- Beskrivelse skal være engagerende, indbydende og forklare løbets idé i 1-2 sætninger.
- MasterCode skal være præcis ${count} tegn lang.
- MasterCode må kun bestå af store bogstaver A-Z og tal 0-9.
- MasterCode må ikke indeholde mellemrum, bindestreger eller andre symboler.
- Hver post giver ét tegn i master-koden. Derfor skal master-koden have præcis samme længde som antallet af poster.
- Tag målgruppen seriøst:
  - Indskoling: brug enkel formulering og konkrete tal, former, mønstre eller tydelige regler, men uden at gøre gåderne fordummende lette.
  - Mellemtrin: brug klare logiske regler, regnestykker, sekvenser og mønstre med lidt mere variation og flere mellemregninger.
  - Udskoling: brug tydelig, men markant mere udfordrende logik, algebraisk tænkning, deduktion og præcise mønsterbrud.
  - Voksne: brug stramme, velkonstruerede gåder med høj logisk kvalitet, flere trin eller mere sofistikeret ræsonnement.
- Gåderne skal være varierede, men stadig opleves som ét samlet escape room-løb.`;

    const prompt = [
      `Tema: ${topic}.`,
      subjectLine,
      `Målgruppe: ${audience}.`,
      `Tone: ${tone}.`,
      `Antal poster: ${count}.`,
      `KRITISK: Returner præcis ${count} gåder og en master-kode på præcis ${count} tegn.`,
      "Gåderne må kun bruge matematik, mønstre og logik. Ingen ordspil eller sproglige tricks.",
      "Lav gåderne som korte, skarpe poster, der kan placeres på et GPS-løb.",
      "Hver gåde skal have ét entydigt korrekt svar og må ikke være tvetydig.",
      "Titel og beskrivelse skal gøre løbet spændende og indbydende for eleverne.",
      "Byg nu et komplet escape room-løb med title, description, masterCode og puzzles.",
    ].join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: "EscapeBuilderInterviewRun",
      schemaDescription:
        "Et komplet escape room-løb med titel, beskrivelse, master-kode og logiske gåder.",
      system: systemPrompt,
      prompt,
      temperature: 0.7,
      timeout: OPENAI_TIMEOUT_MS,
      providerOptions: {
        openai: {
          strictJsonSchema: true,
        },
      },
    });

    const normalizedMasterCode = normalizeMasterCode(object.masterCode);
    if (normalizedMasterCode.length !== count) {
      throw new Error("AI'en returnerede en master-kode med forkert længde.");
    }

    return NextResponse.json({
      title: object.title.trim(),
      description: object.description.trim(),
      masterCode: normalizedMasterCode,
      puzzles: object.puzzles.map((puzzle) => ({
        riddle: asTrimmedString(puzzle.riddle),
        answer: asTrimmedString(puzzle.answer),
      })),
    });
  } catch (error) {
    console.error("Fejl i escape-builder/interview:", error);

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "AI'en var for længe om at svare. Prøv igen." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Kunne ikke bygge escape roomet lige nu. Prøv igen om et øjeblik." },
      { status: 500 }
    );
  }
}
