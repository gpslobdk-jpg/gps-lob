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

const manualInterviewPayloadSchema = z
  .object({
    builderType: z.literal("manual").optional().default("manual"),
    topic: z.string().trim().min(1).max(180),
    subject: z.string().trim().max(80).optional().default(""),
    audience: z.string().trim().min(1).max(80),
    tone: z.string().trim().min(1).max(80),
    count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional().default(DEFAULT_COUNT),
  })
  .strict();

const mathInterviewPayloadSchema = z
  .object({
    builderType: z.literal("matematik"),
    subject: z.string().trim().max(80).optional().default("Matematik"),
    gradeLevel: z.string().trim().min(1).max(80),
    mathTopic: z.string().trim().min(1).max(180),
    count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional().default(DEFAULT_COUNT),
  })
  .strict();

const danishInterviewPayloadSchema = z
  .object({
    builderType: z.literal("dansk"),
    subject: z.string().trim().max(80).optional().default("Dansk"),
    gradeLevel: z.string().trim().min(1).max(80),
    danishTopic: z.string().trim().min(1).max(180),
    count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional().default(DEFAULT_COUNT),
  })
  .strict();

const interviewPayloadSchema = z.union([
  manualInterviewPayloadSchema,
  mathInterviewPayloadSchema,
  danishInterviewPayloadSchema,
]);

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
      questions: z.array(generatedQuestionSchema).length(desiredCount),
    })
    .strict();
}

function createManualPrompt(input: z.infer<typeof manualInterviewPayloadSchema>) {
  const { topic, subject, audience, tone, count } = input;
  const subjectLine = subject ? `Fag eller kategori: ${subject}.` : "Fag eller kategori: Ikke angivet.";

  return {
    schemaName: "ManualBuilderInterviewRun",
    schemaDescription: "Et komplet multiple-choice løb til den manuelle builder med titel og spørgsmål.",
    systemPrompt: `Du er en dansk senior-redaktør og quizdesigner for GPSLØB.
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
- Spørgsmålene skal passe til en udendørs GPS-quiz og være lette at placere på et kort bagefter.
- Svarmulighederne skal være troværdige, men tydeligt adskilte, så der kun er ét korrekt svar.
- Tonen skal afspejle brugerens valg uden at gøre spørgsmålene useriøse eller uklare.`,
    prompt: [
      `Tema: ${topic}.`,
      subjectLine,
      `Målgruppe: ${audience}.`,
      `Tone: ${tone}.`,
      `Antal spørgsmål: ${count}.`,
      `KRITISK: Returner præcis ${count} spørgsmål. Ikke 4, ikke 6, ikke 8, ikke flere og ikke færre.`,
      "Faglig kvalitet er afgørende: spørgsmålene skal undervise, udfordre og være faktuelt solide.",
      "Svarmulighederne skal være realistiske distractors, så det korrekte svar ikke bliver åbenlyst.",
      "Titel skal gøre løbet indbydende og motivere deltagerne til at komme i gang.",
      "Byg nu et komplet quiz-løb med titel og spørgsmål.",
      "Spørgsmålene må gerne variere i vinkel, men de skal alle tydeligt høre til samme løb.",
    ].join("\n"),
  };
}

function createMathPrompt(input: z.infer<typeof mathInterviewPayloadSchema>) {
  const { count, gradeLevel, mathTopic } = input;

  return {
    schemaName: "MathBuilderInterviewRun",
    schemaDescription: "Et komplet matematik-løb med titel og fagligt korrekte multiple-choice spørgsmål.",
    systemPrompt: `Du er en dansk matematikfaglig redaktør, opgaveforfatter og kvalitetssikrer for GPSLØB.
Du bygger komplette matematik-løb til skolebrug.

Du SKAL altid følge disse regler:
- Alt indhold skal være på dansk.
- Returner kun gyldigt JSON, der matcher schemaet.
- Returner præcis ${count} multiple-choice spørgsmål.
- Du må under ingen omstændigheder returnere færre eller flere end ${count} spørgsmål.
- Hvert spørgsmål skal have præcis 4 svarmuligheder i "options".
- "correctAnswer" skal matche én af de 4 svarmuligheder ordret.
- Alle spørgsmål skal være matematisk korrekte, fagligt præcise og passende til det angivne klassetrin.
- Regnefejl, upræcise formuleringer og tvetydige facit er ikke tilladt.
- De tre forkerte svar skal være plausible og realistiske fejltrin, ikke absurde joke-svar.
- Variér opgavetyperne inden for emnet, så løbet føles gennemarbejdet og undervisningsrelevant.
- Brug et klart og elevvenligt sprog, men uden at gøre opgaverne for lette.
- Titel skal være motiverende, konkret og brugbar i arkivet.
- Spørgsmålene skal fungere som poster i et udendørs GPS-løb, så de skal være korte nok til at kunne læses stående på en mobil.
- Hvis emnet lægger op til beregning, må du gerne bruge små konkrete regnestykker, men facit skal altid være entydigt.
- Undgå teksttunge forklaringer og hold fokus på faglig træfsikkerhed.`,
    prompt: [
      `Fag: Matematik.`,
      `Klassetrin: ${gradeLevel}.`,
      `Matematisk emne: ${mathTopic}.`,
      `Antal spørgsmål: ${count}.`,
      `KRITISK: Returner præcis ${count} spørgsmål. Ikke 4, ikke 6, ikke 8, ikke flere og ikke færre.`,
      "Spørgsmålene skal være matematisk korrekte og have ét entydigt facit.",
      "De forkerte svar skal ligne typiske elevfejl eller nærliggende misforståelser.",
      "Varier gerne mellem direkte beregning, begrebsforståelse og anvendelse, hvis emnet tillader det.",
      "Byg nu et komplet matematik-løb med titel og spørgsmål.",
    ].join("\n"),
  };
}

function normalizeDanishText(value: string) {
  return value
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function includesAnyKeyword(value: string, keywords: string[]) {
  const normalizedValue = normalizeDanishText(value);
  return keywords.some((keyword) => normalizedValue.includes(normalizeDanishText(keyword)));
}

function createDanskPromptExamples(danishTopic: string) {
  const normalizedTopic = normalizeDanishText(danishTopic);

  if (includesAnyKeyword(normalizedTopic, ["nutids-r", "grammatik", "stavning", "ordklasse", "verber"])) {
    return [
      "Mini-eksempel: I sætningen 'Sofie kører hver dag til skole', hvilken stavemåde er korrekt i nutid?",
      "Mini-eksempel: I sætningen 'Mikkel elsker at tegne', hvilket ord fungerer som udsagnsord?",
      "Mini-eksempel: Hvilken af disse sætninger viser den korrekte brug af nutids-r?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["læseforståelse", "lasning", "tekstforstaelse", "tekstforståelse"])) {
    return [
      "Mini-eksempel: I det korte uddrag 'Ida lukkede døren forsigtigt, selv om hun havde travlt', hvad kan man udlede om Ida?",
      "Mini-eksempel: Hvilket ord i teksten viser bedst personens følelse?",
      "Mini-eksempel: Hvad passer bedst som overskrift til det lille tekstuddrag?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["h.c. andersen", "andersen", "eventyr"])) {
    return [
      "Mini-eksempel: I 'Den grimme ælling', hvilket tema passer bedst til hovedpersonens udvikling?",
      "Mini-eksempel: Hvad kendetegner 'Kejserens nye klæder' som eventyr og satire?",
      "Mini-eksempel: Hvilket historisk eller biografisk udsagn om H.C. Andersen er korrekt?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["analyse", "novelle", "fortæller", "fortaeller", "tema", "komposition"])) {
    return [
      "Mini-eksempel: I uddraget 'Han svarede ikke, men så ned i jorden', hvad antyder personens reaktion?",
      "Mini-eksempel: Hvilket tema passer bedst til den beskrevne konflikt?",
      "Mini-eksempel: Hvilken fortællertype eller synsvinkel passer bedst til teksteksemplet?",
    ];
  }

  return [
    "Mini-eksempel: I sætningen eller teksten her, hvad viser ordvalget bedst?",
    "Mini-eksempel: Hvilket svar passer bedst til eksemplet og kræver reel danskfaglig forståelse?",
    "Mini-eksempel: Hvilken fortolkning eller sproglig vurdering er mest præcis i denne situation?",
  ];
}

function hasDanskContextSignal(question: string) {
  return [
    /i sætningen/i,
    /i teksten/i,
    /i uddraget/i,
    /hvilket ord/i,
    /hvilken sætning/i,
    /hvilken formulering/i,
    /hvilken stavemåde/i,
    /hvilken fortolkning/i,
    /hvilket tema/i,
    /hvad viser/i,
    /hvad kan man udlede/i,
    /[:"'“”]/,
  ].some((pattern) => pattern.test(question));
}

function isWeakDanskQuestion(question: string) {
  const trimmedQuestion = question.trim();

  if (trimmedQuestion.length < 24) {
    return true;
  }

  if (hasDanskContextSignal(trimmedQuestion)) {
    return false;
  }

  return [/^hvad er /i, /^hvad betyder /i, /^hvad kaldes /i, /^hvad hedder /i].some((pattern) =>
    pattern.test(trimmedQuestion)
  );
}

function isPlaceholderDistractor(option: string) {
  return [
    /^marker$/i,
    /^svar\s*\d+$/i,
    /^mulighed\s*[a-d1-4]$/i,
    /^andet$/i,
    /^ved ikke$/i,
    /^ukendt$/i,
  ].some((pattern) => pattern.test(option.trim()));
}

function validateDanskGeneratedRun(
  run: { title: string; questions: Array<{ question: string; options: [string, string, string, string]; correctAnswer: string }> },
  input: z.infer<typeof danishInterviewPayloadSchema>
) {
  const issues: string[] = [];
  const normalizedTopic = normalizeDanishText(input.danishTopic);
  const andersenKeywords = [
    "h.c. andersen",
    "andersen",
    "eventyr",
    "odense",
    "1805",
    "1800-tallet",
    "den lille havfrue",
    "den grimme ælling",
    "kejserens nye klæder",
    "prinsessen på ærten",
    "fyrtøjet",
    "snedronningen",
    "nattergalen",
    "klods-hans",
    "skyggen",
    "grantræet",
  ];

  if (run.title.trim().length < 6) {
    issues.push("Titlen er for kort eller for generisk.");
  }

  let contextualQuestionCount = 0;
  let andersenSpecificQuestionCount = 0;

  run.questions.forEach((question, index) => {
    const questionNumber = index + 1;
    const trimmedQuestion = question.question.trim();
    const normalizedOptions = question.options.map((option) => option.trim());
    const distinctOptionCount = new Set(normalizedOptions.map((option) => normalizeDanishText(option))).size;

    if (hasDanskContextSignal(trimmedQuestion)) {
      contextualQuestionCount += 1;
    }

    if (isWeakDanskQuestion(trimmedQuestion)) {
      issues.push(`Spørgsmål ${questionNumber} er for generisk og mangler en konkret case eller et tydeligt eksempel.`);
    }

    if (distinctOptionCount < 4) {
      issues.push(`Spørgsmål ${questionNumber} har ikke fire tydeligt forskellige svarmuligheder.`);
    }

    if (normalizedOptions.some((option) => option.length < 2 || isPlaceholderDistractor(option))) {
      issues.push(`Spørgsmål ${questionNumber} indeholder en placeholder eller en for svag svarmulighed.`);
    }

    if (!normalizedOptions.includes(question.correctAnswer.trim())) {
      issues.push(`Spørgsmål ${questionNumber} har et facit, der ikke matcher svarmulighederne præcist.`);
    }

    const combinedText = [trimmedQuestion, ...normalizedOptions].join(" ");
    if (includesAnyKeyword(normalizedTopic, ["h.c. andersen", "andersen", "eventyr"]) && includesAnyKeyword(combinedText, andersenKeywords)) {
      andersenSpecificQuestionCount += 1;
    }
  });

  const minimumContextualQuestions = Math.max(2, Math.ceil(run.questions.length * 0.6));
  if (contextualQuestionCount < minimumContextualQuestions) {
    issues.push("For mange spørgsmål er for abstrakte; mindst størstedelen skal være skrevet som cases, sætninger, uddrag eller konkrete eksempler.");
  }

  if (
    includesAnyKeyword(normalizedTopic, ["h.c. andersen", "andersen", "eventyr"]) &&
    andersenSpecificQuestionCount < Math.max(2, Math.ceil(run.questions.length / 3))
  ) {
    issues.push("Løbet om H.C. Andersen eller eventyr er ikke specifikt nok og mangler tydelige referencer til konkrete eventyr, temaer eller historiske forhold.");
  }

  if (issues.length > 0) {
    throw new Error(`Dansk-kvalitetskontrol fejlede: ${issues.slice(0, 4).join(" ")}`);
  }
}

function createDanskPrompt(input: z.infer<typeof danishInterviewPayloadSchema>) {
  const { count, danishTopic, gradeLevel } = input;
  const miniExamples = createDanskPromptExamples(danishTopic);

  return {
    schemaName: "DanskBuilderInterviewRun",
    schemaDescription: "Et komplet dansk-løb med titel og fagligt korrekte multiple-choice spørgsmål.",
    systemPrompt: `Du er en prisvindende danskkonsulent og pædagogisk ekspert. Din opgave er at gøre danskundervisningen levende, sjov og fagligt udfordrende.
Du bygger komplette dansk-løb til skolebrug.

Du SKAL altid følge disse regler:
- Alt indhold skal være på dansk.
- Returner kun gyldigt JSON, der matcher schemaet.
- Returner præcis ${count} multiple-choice spørgsmål.
- Du må under ingen omstændigheder returnere færre eller flere end ${count} spørgsmål.
- Hvert spørgsmål skal have præcis 4 svarmuligheder i "options".
- "correctAnswer" skal matche en af de 4 svarmuligheder ordret.
- Alle spørgsmål skal være danskfagligt korrekte, alderssvarende, motiverende og tydeligt knyttet til det angivne klassetrin.
- Fokus skal ligge på læsning, sprogforståelse, grammatik, stavning, litteratur eller analyse, alt efter emnet.
- Skriv spørgsmålene som små cases, konkrete sætninger, korte tekstuddrag eller tydelige eksempler. Undgå tørre definitionsspørgsmål uden kontekst.
- Brug derfor formuleringer som: "I sætningen ...", "I uddraget ...", "Hvilket ord ...", "Hvilket tema ser man ..." eller "Hvad viser dette eksempel ...".
- Brug ALDRIG placeholder-svar, tomme fyldord eller generiske svar som "Marker", "Svar 1" eller andre åbenlyst kunstige distraktorer.
- De forkerte svar skal være plausible, tænkevækkende og pædagogisk relevante. De skal ligne typiske elevfejl, sproglige misforståelser, nærliggende fortolkninger eller realistiske forvekslinger.
- Hvis emnet handler om grammatik eller stavning, skal de forkerte svar afspejle typiske fejl elever faktisk laver. Ved fx nutids-r skal distraktorer ligne former som elever ofte forveksler, fx infinitiv over for korrekt nutids-r.
- Hvis emnet handler om litteratur eller forfatterskab, skal spørgsmålene være konkrete og emnespecifikke. Ved fx H.C. Andersen skal spørgsmålene handle om bestemte eventyr, motiver, temaer, personer, fortællergreb eller historiske forhold, ikke blot generel litteratur.
- Variér spørgsmålstyperne inden for emnet, så løbet føles gennemarbejdet, levende og undervisningsrelevant.
- Brug et klart, opmuntrende og elevvenligt sprog uden at udvande det faglige niveau.
- Titel skal være motiverende, konkret og brugbar i arkivet.
- Spørgsmålene skal fungere som poster i et udendørs GPS-løb, så de skal være korte nok til at kunne læses stående på en mobil.
- Ved analyse- eller læsespørgsmål skal facit stadig være entydigt.
- Undgå tvetydige facit, upræcise formuleringer og sproglige fejl.
- Brug denne type mini-eksempler som kvalitetsniveau og form, ikke som faste spørgsmål:
${miniExamples.map((example) => `- ${example}`).join("\n")}`,
    prompt: [
      `Fag: Dansk.`,
      `Klassetrin: ${gradeLevel}.`,
      `Danskfagligt emne: ${danishTopic}.`,
      `Antal spørgsmål: ${count}.`,
      `KRITISK: Returner præcis ${count} spørgsmål. Ikke 4, ikke 6, ikke 8, ikke flere og ikke færre.`,
      "Spørgsmålene skal være danskfagligt skarpe, have et entydigt korrekt svar og være skrevet som konkrete cases eller tydelige eksempler.",
      "Undgå definitioner uden kontekst. Giv i stedet sætninger, små uddrag, ordvalg eller litterære situationer, som eleven skal tænke over.",
      "Alle fire svarmuligheder skal være meningsfulde. Ingen placeholders, ingen fyldord og ingen kunstige distraktorer.",
      "De forkerte svar skal ligne typiske elevfejl, nærliggende fortolkninger eller plausible sproglige forvekslinger.",
      "Hvis emnet er grammatik eller stavning, skal distraktorerne afspejle virkelige fejltyper fra undervisningen.",
      "Hvis emnet er H.C. Andersen eller litteratur, skal spørgsmålene være konkrete og handle om bestemte eventyr, temaer, personer eller historiske forhold.",
      "Tonen skal være opmuntrende, tydelig og alderssvarende for klassetrinnet.",
      "Variér gerne mellem læseforståelse, grammatik, stavning, ordkendskab og litteratur, hvis emnet tillader det.",
      "Brug disse mini-eksempler som pejlemærker for format og kvalitet:",
      ...miniExamples,
      "Byg nu et komplet dansk-løb med titel og spørgsmål.",
    ].join("\n"),
  };
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

    const promptConfig =
      parsedPayload.data.builderType === "matematik"
        ? createMathPrompt(parsedPayload.data)
        : parsedPayload.data.builderType === "dansk"
          ? createDanskPrompt(parsedPayload.data)
        : createManualPrompt(parsedPayload.data);

    const count = parsedPayload.data.count;

    const schema = createGeneratedRunSchema(count);

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema,
      schemaName: promptConfig.schemaName,
      schemaDescription: promptConfig.schemaDescription,
      system: promptConfig.systemPrompt,
      prompt: promptConfig.prompt,
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

    const normalizedRun = {
      title: object.title.trim(),
      questions,
    };

    if (parsedPayload.data.builderType === "dansk") {
      validateDanskGeneratedRun(normalizedRun, parsedPayload.data);
    }

    return NextResponse.json({
      title: normalizedRun.title,
      questions: normalizedRun.questions,
    });
  } catch (error) {
    console.error("Fejl i manual-builder/interview:", error);

    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "AI'en var for længe om at svare. Prøv igen." },
        { status: 504 }
      );
    }

    if (error instanceof Error && error.message.startsWith("Dansk-kvalitetskontrol fejlede:")) {
      return NextResponse.json(
        {
          error:
            "AI'en leverede danskspørgsmål, der var for generiske eller pædagogisk svage. Prøv igen, så beder vi modellen om et skarpere løb.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Kunne ikke bygge løbet lige nu. Prøv igen om et øjeblik." },
      { status: 500 }
    );
  }
}
