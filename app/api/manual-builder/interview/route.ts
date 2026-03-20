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

const generatedQuestionSchema = z
  .object({
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    correctAnswer: z.string().trim().min(1),
  })
  .strict();

function createGeneratedRunSchema(desiredCount: number) {
  return z
    .object({
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      questions: z.array(generatedQuestionSchema).length(desiredCount),
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

    const systemPrompt = `Du er en dansk senior-redaktør og quizdesigner for GPSLØB.
Du bygger komplette quiz-løb til den manuelle builder.

Du SKAL altid følge disse regler:
- Alt indhold skal være på dansk.
- Returner kun gyldigt JSON, der matcher schemaet.
- Returner præcis ${count} multiple-choice spørgsmål.
- Du må under ingen omstændigheder returnere færre eller flere end ${count} spørgsmål.
- Hvert spørgsmål skal have præcis 4 svarmuligheder i "options".
- "correctAnswer" skal matche én af de 4 svarmuligheder ordret.
- Generér kun klassiske quiz-poster. Ingen foto-opgaver, ingen rollespil, ingen gåder, ingen medieelementer.
- Spørgsmålene skal have høj faglig kvalitet: de skal være lærerige, indholdsrige og faktuelt korrekte.
- Undgå overfladiske banaliteter, trivielle standardspørgsmål og tom fyldtekst.
- Tag målgruppen seriøst: tilpas sproget til alderen, men bevar et meningsfuldt fagligt niveau.
- Hvis målgruppen er yngre børn, skal sproget være simpelt uden at gøre spørgsmålene fordummende lette.
- Hvis målgruppen er ældre elever eller voksne, skal spørgsmålene være markant mere udfordrende og gerne kræve refleksion, præcis viden eller faglig forståelse.
- De forkerte svarmuligheder skal være intelligente og plausible distractors, så de virker realistiske i konteksten.
- Undgå joke-svar, fjollede svar og åbenlyst forkerte svarmuligheder, medmindre tonen tydeligt kræver noget mere legende. Selv ved en sjov tone skal svarene stadig være brugbare som reel quiz.
- Titel skal være fængende, motiverende og brugbar i arkivet.
- Beskrivelse skal være engagerende, indbydende og forklare løbets stemning og fokus i 1-2 sætninger, så eleverne får lyst til at løbe turen.
- Spørgsmålene skal passe til en udendørs GPS-quiz og være lette at placere på et kort bagefter.
- Svarmulighederne skal være troværdige, men tydeligt adskilte, så der kun er ét korrekt svar.
- Tonen skal afspejle brugerens valg uden at gøre spørgsmålene useriøse eller uklare.`;

    const prompt = [
      `Tema: ${topic}.`,
      subjectLine,
      `Målgruppe: ${audience}.`,
      `Tone: ${tone}.`,
      `Antal spørgsmål: ${count}.`,
      `KRITISK: Returner præcis ${count} spørgsmål. Ikke 4, ikke 6, ikke 8, ikke flere og ikke færre.`,
      "Faglig kvalitet er afgørende: spørgsmålene skal undervise, udfordre og være faktuelt solide.",
      "Svarmulighederne skal være realistiske distractors, så det korrekte svar ikke bliver åbenlyst.",
      "Titel og beskrivelse skal gøre løbet indbydende og motivere deltagerne til at komme i gang.",
      "Byg nu et komplet quiz-løb med titel, beskrivelse og spørgsmål.",
      "Spørgsmålene må gerne variere i vinkel, men de skal alle tydeligt høre til samme løb.",
    ].join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: "ManualBuilderInterviewRun",
      schemaDescription:
        "Et komplet multiple-choice løb til den manuelle builder med titel, beskrivelse og spørgsmål.",
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

    const questions = object.questions.map((question) => {
      const options = question.options.map((option) => option.trim()).slice(0, 4);
      const paddedOptions = [...options];
      while (paddedOptions.length < 4) {
        paddedOptions.push("");
      }

      const safeOptions = [
        paddedOptions[0] ?? "",
        paddedOptions[1] ?? "",
        paddedOptions[2] ?? "",
        paddedOptions[3] ?? "",
      ] as [string, string, string, string];

      const normalizedCorrectAnswer = asTrimmedString(question.correctAnswer);
      const safeCorrectAnswer = safeOptions.includes(normalizedCorrectAnswer)
        ? normalizedCorrectAnswer
        : safeOptions[0];

      return {
        question: question.question.trim(),
        options: safeOptions,
        correctAnswer: safeCorrectAnswer,
      };
    });

    return NextResponse.json({
      title: object.title.trim(),
      description: object.description.trim(),
      questions,
    });
  } catch (error) {
    console.error("Fejl i manual-builder/interview:", error);

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "AI'en var for længe om at svare. Prøv igen." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Kunne ikke bygge løbet lige nu. Prøv igen om et øjeblik." },
      { status: 500 }
    );
  }
}
