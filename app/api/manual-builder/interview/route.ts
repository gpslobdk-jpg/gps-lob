import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  formatGradeLevelsForPrompt,
  GRADE_LEVEL_OPTIONS,
  getGradeLevelRange,
} from "@/utils/gradeLevels";
import {
  createLynbyggerReviewSchema,
  createLynbyggerReviewerPrompt,
  createLynbyggerRewritePrompt,
  createStrictLynbyggerGeneratorRules,
  LYNBYGGER_GENERATOR_MODEL,
  LynbyggerQualityError,
  LYNBYGGER_REVIEWER_SYSTEM_PROMPT,
  LYNBYGGER_REVIEW_MODEL,
  runLynbyggerQualityPipeline,
} from "@/lib/lynbyggerAiQuality";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const maxDuration = 300;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_COUNT = 10;
const OPENAI_TIMEOUT_MS = 45_000;

const manualInterviewPayloadSchema = z
  .object({
    builderType: z.literal("manual").optional().default("manual"),
    qualityMode: z.literal("strict").optional(),
    subject: z.string().trim().max(80).optional().default(""),
    gradeLevels: z.array(z.enum(GRADE_LEVEL_OPTIONS)).min(1).max(GRADE_LEVEL_OPTIONS.length),
    manualTopic: z.string().trim().min(1).max(180),
    tone: z.string().trim().min(1).max(80).optional().default("balanceret"),
    count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional().default(DEFAULT_COUNT),
  })
  .strict();

const mathInterviewPayloadSchema = z
  .object({
    builderType: z.literal("matematik"),
    subject: z.string().trim().max(80).optional().default("Matematik"),
    gradeLevels: z.array(z.enum(GRADE_LEVEL_OPTIONS)).min(1).max(GRADE_LEVEL_OPTIONS.length),
    mathTopic: z.string().trim().min(1).max(180),
    count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional().default(DEFAULT_COUNT),
  })
  .strict();

const danishInterviewPayloadSchema = z
  .object({
    builderType: z.literal("dansk"),
    subject: z.string().trim().max(80).optional().default("Dansk"),
    gradeLevels: z.array(z.enum(GRADE_LEVEL_OPTIONS)).min(1).max(GRADE_LEVEL_OPTIONS.length),
    danishTopic: z.string().trim().min(1).max(180),
    count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional().default(DEFAULT_COUNT),
  })
  .strict();

const englishInterviewPayloadSchema = z
  .object({
    builderType: z.literal("engelsk"),
    subject: z.string().trim().max(80).optional().default("Engelsk"),
    gradeLevels: z.array(z.enum(GRADE_LEVEL_OPTIONS)).min(1).max(GRADE_LEVEL_OPTIONS.length),
    englishTopic: z.string().trim().min(1).max(180),
    count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional().default(DEFAULT_COUNT),
  })
  .strict();

const interviewPayloadSchema = z.union([
  manualInterviewPayloadSchema,
  mathInterviewPayloadSchema,
  danishInterviewPayloadSchema,
  englishInterviewPayloadSchema,
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
  const { manualTopic, subject, gradeLevels, tone, count, qualityMode } = input;
  const gradeLevelLabel = formatGradeLevelsForPrompt(gradeLevels);
  const gradeLevelGuidance = createManualGradeLevelGuidance(gradeLevels);
  const subjectLine = subject ? `Fag eller kategori: ${subject}.` : "Fag eller kategori: Ikke angivet.";
  const strictQualityRules = qualityMode === "strict" ? createStrictLynbyggerGeneratorRules(count) : "";

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
- Tag klassetrinnet seriøst: tilpas sproget til alderen, men bevar et meningsfuldt fagligt niveau.
- Hvis klassetrinnet er lavt, skal sproget være simpelt uden at gøre spørgsmålene fordummende lette.
- Hvis klassetrinnet er højt, skal spørgsmålene være markant mere udfordrende og gerne kræve refleksion, præcis viden eller faglig forståelse.
- De forkerte svarmuligheder skal være intelligente og plausible distractors, så de virker realistiske i konteksten.
- Undgå joke-svar, fjollede svar og åbenlyst forkerte svarmuligheder, medmindre tonen tydeligt kræver noget mere legende. Selv ved en sjov tone skal svarene stadig være brugbare som reel quiz.
- Titel skal være fængende, motiverende og brugbar i arkivet.
- Spørgsmålene skal passe til en udendørs GPS-quiz og være lette at placere på et kort bagefter.
- Svarmulighederne skal være troværdige, men tydeligt adskilte, så der kun er ét korrekt svar.
- Tonen skal afspejle brugerens valg uden at gøre spørgsmålene useriøse eller uklare.
- Følg disse klassetrinskrav meget nøje:
${gradeLevelGuidance.map((line) => `- ${line}`).join("\n")}
${strictQualityRules ? `\nSærlige regler for Lynbyggerens strenge kvalitetstilstand:\n${strictQualityRules}` : ""}`,
    prompt: [
      `Tema eller emne: ${manualTopic}.`,
      subjectLine,
      `Klassetrin: ${gradeLevelLabel}.`,
      `Tone: ${tone}.`,
      `Antal spørgsmål: ${count}.`,
      `KRITISK: Returner præcis ${count} spørgsmål. Ikke 4, ikke 6, ikke 8, ikke flere og ikke færre.`,
      "Faglig kvalitet er afgørende: spørgsmålene skal undervise, udfordre og være faktuelt solide.",
      "Spørgsmålene skal tydeligt passe til både klassetrin og den valgte kategori, hvis en kategori er angivet.",
      "Svarmulighederne skal være realistiske distractors, så det korrekte svar ikke bliver åbenlyst.",
      "Titel skal gøre løbet indbydende og motivere deltagerne til at komme i gang.",
      ...gradeLevelGuidance,
      ...(strictQualityRules
        ? [
            "Prioritér faglig sikkerhed over kreativitet. Hvis en detalje eller et facit er usikkert, skal du vælge et enklere spørgsmål.",
            "Kontrollér internt hvert spørgsmål for faktuel korrekthed, præcis ét korrekt svar og fravær af opdigtede detaljer, før du returnerer JSON.",
          ]
        : []),
      "Byg nu et komplet quiz-løb med titel og spørgsmål.",
      "Spørgsmålene må gerne variere i vinkel, men de skal alle tydeligt høre til samme løb.",
    ].join("\n"),
  };
}

function createManualGradeLevelGuidance(gradeLevels: string[]) {
  const { lowestGrade, highestGrade } = getGradeLevelRange(gradeLevels);

  if (lowestGrade !== null && highestGrade !== null && lowestGrade !== highestGrade) {
    return [
      `Klassetrinskrav: Løbet skal fungere for flere klassetrin samtidig fra ${lowestGrade}. til ${highestGrade}. klasse.`,
      "Hold sproget tilgængeligt nok til de yngste, men byg stadig reel variation og faglig progression ind til de ældste.",
      "Lad sværhedsgraden ligge i en bred midte, så opgaverne kan løses i fællesskab uden at blive barnlige eller unødigt tunge.",
    ];
  }

  const gradeNumber = highestGrade;

  if (gradeNumber !== null && gradeNumber <= 2) {
    return [
      "Klassetrinskrav: Dette er indskoling. Spørgsmålene skal være meget konkrete, korte og hurtige at forstå.",
      "Brug tydelige ord, enkle situationer og lav abstraktionsgrad.",
      "Svarmulighederne skal være korte, realistiske og lette at afkode på mobil.",
    ];
  }

  if (gradeNumber !== null && gradeNumber <= 4) {
    return [
      "Klassetrinskrav: Dette er begyndende mellemtrin. Spørgsmålene skal stadig være konkrete og elevnære, men må gerne udfordre lidt mere.",
      "Brug velkendte situationer, korte cases og tydelige svarmuligheder.",
      "Hold fokus på forståelse, genkendelse og enkel anvendelse af viden.",
    ];
  }

  if (gradeNumber !== null && gradeNumber <= 6) {
    return [
      "Klassetrinskrav: Dette er mellemtrin. Spørgsmålene må gerne være tydeligt faglige, men de skal stadig være klare, korte og elevvenlige.",
      "Brug varierede vinkler, så løbet føles gennemarbejdet og undervisningsrelevant.",
      "Distraktorerne må gerne afspejle typiske elevmisforståelser eller nærliggende svar.",
    ];
  }

  return [
    "Klassetrinskrav: Dette er udskoling eller ældre elever. Spørgsmålene må gerne være klart mere krævende og kræve sikker viden, præcision og refleksion.",
    "Brug gerne mere udfordrende formuleringer og bedre distraktorer, men hold længden kort nok til mobilformat.",
    "Undgå overfladisk trivia og sats i stedet på relevante, meningsfulde og fagligt stærke spørgsmål.",
  ];
}

function createMathPrompt(input: z.infer<typeof mathInterviewPayloadSchema>) {
  const { count, gradeLevels, mathTopic } = input;
  const gradeLevelLabel = formatGradeLevelsForPrompt(gradeLevels);
  const mathPromptExamples = createMathPromptExamples(mathTopic, gradeLevels);
  const mathGradeLevelGuidance = createMathGradeLevelGuidance(gradeLevels);

  return {
    schemaName: "MathBuilderInterviewRun",
    schemaDescription: "Et komplet matematik-løb med titel og fagligt korrekte multiple-choice spørgsmål.",
    systemPrompt: `Du er en dygtig, erfaren og pædagogisk stærk matematiklærer-AI. Din opgave er at gøre matematikundervisningen tydelig, tryg, motiverende og fagligt præcis.
Du bygger komplette matematik-løb til skolebrug.

Du SKAL altid følge disse regler:
- Alt indhold skal være på dansk.
- Returner kun gyldigt JSON, der matcher schemaet.
- Returner præcis ${count} multiple-choice spørgsmål.
- Du må under ingen omstændigheder returnere færre eller flere end ${count} spørgsmål.
- Hvert spørgsmål skal have præcis 4 svarmuligheder i "options".
- "correctAnswer" skal matche én af de 4 svarmuligheder ordret.
- Du skal altid generere et løb baseret på brugerens input, uanset hvor generisk, bredt eller kortfattet emnet er.
- Alle spørgsmål skal være matematisk korrekte, fagligt præcise og passende til de angivne klassetrin.
- Niveauet SKAL ramme klassetrinnet meget præcist. Hvis klassetrinnet er lavt, skal spørgsmålene være markant lettere, kortere og mere konkrete.
- Det er vigtigere at ramme elevniveauet præcist end at virke avanceret.
- Regnefejl, upræcise formuleringer og tvetydige facit er ikke tilladt.
- De tre forkerte svar skal være plausible og realistiske fejltrin, ikke absurde joke-svar.
- De forkerte svar skal ligne typiske elevfejl, almindelige regnefejl eller nærliggende misforståelser, som passer til klassetrinnet.
- Skriv spørgsmålene med konkrete tal, korte hverdagssituationer eller tydelige regneeksempler, især på de lave klassetrin.
- Undgå unødigt abstrakte eller teksttunge opgaver på de lave klassetrin.
- Variér opgavetyperne inden for emnet, så løbet føles gennemarbejdet og undervisningsrelevant.
- Brug et klart og elevvenligt sprog, men uden at gøre opgaverne for lette.
- Titel skal være motiverende, konkret og brugbar i arkivet.
- Spørgsmålene skal fungere som poster i et udendørs GPS-løb, så de skal være korte nok til at kunne læses stående på en mobil.
- Hvis emnet lægger op til beregning, må du gerne bruge små konkrete regnestykker, men facit skal altid være entydigt.
- Undgå teksttunge forklaringer og hold fokus på faglig træfsikkerhed.
- Følg disse klassetrinsspecifikke krav meget nøje:
${mathGradeLevelGuidance.map((line) => `- ${line}`).join("\n")}
- Brug denne type mini-eksempler som kvalitetsniveau og form, ikke som faste spørgsmål:
${mathPromptExamples.map((example) => `- ${example}`).join("\n")}`,
    prompt: [
      `Fag: Matematik.`,
      `Klassetrin: ${gradeLevelLabel}.`,
      `Matematisk emne: ${mathTopic}.`,
      `Antal spørgsmål: ${count}.`,
      `KRITISK: Returner præcis ${count} spørgsmål. Ikke 4, ikke 6, ikke 8, ikke flere og ikke færre.`,
      "Spørgsmålene skal være matematisk korrekte og have ét entydigt facit.",
      "De forkerte svar skal ligne typiske elevfejl eller nærliggende misforståelser.",
      "Niveauet skal ramme klassetrinnet meget præcist. Ved 1.-2. klasse skal spørgsmålene være mærkbart lettere, kortere og mere konkrete end ved højere klassetrin.",
      ...mathGradeLevelGuidance,
      "Varier gerne mellem direkte beregning, begrebsforståelse og anvendelse, hvis emnet tillader det.",
      "Brug disse mini-eksempler som pejlemærker for format og kvalitet:",
      ...mathPromptExamples,
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

function createMathGradeLevelGuidance(gradeLevels: string[]) {
  const { lowestGrade, highestGrade } = getGradeLevelRange(gradeLevels);

  if (lowestGrade !== null && highestGrade !== null && lowestGrade !== highestGrade) {
    return [
      `Klassetrinskrav: Løbet skal fungere for flere klassetrin samtidig fra ${lowestGrade}. til ${highestGrade}. klasse.`,
      "Hold sproget og opgaveformen tilgængelig nok til de yngste, men byg stadig reel faglig progression og udfordring ind til de ældste.",
      "Lad sværhedsgraden ligge i en bred midte, og variér gerne spørgsmålene, så nogle er mere konkrete og andre lidt mere krævende.",
    ];
  }

  const gradeNumber = highestGrade;

  if (gradeNumber !== null && gradeNumber <= 2) {
    return [
      "Klassetrinskrav: Dette er indskoling. Opgaverne skal være meget lette, meget konkrete og hurtige at afkode.",
      "Brug små tal, enkle regnearter, tydelige mønstre og helt korte spørgsmål.",
      "Undgå lange tekstopgaver, flere regnetrin, abstrakte begreber og avanceret matematisk sprog.",
      "Fokusér på helt grundlæggende talforståelse, tælling, plus, minus, simple former, enkle mønstre og meget let problemløsning.",
      "Svarmulighederne skal være korte og lette at læse.",
    ];
  }

  if (gradeNumber !== null && gradeNumber <= 4) {
    return [
      "Klassetrinskrav: Dette er begyndende mellemtrin. Opgaverne skal stadig være konkrete, overskuelige og forholdsvis lette.",
      "Brug velkendte tal, enkle hverdagssituationer og korte opgaver med ét tydeligt fokus.",
      "Fokusér på sikkerhed i de grundlæggende regnearter, simple tekststykker og begyndende forståelse af matematiske begreber.",
    ];
  }

  if (gradeNumber !== null && gradeNumber <= 6) {
    return [
      "Klassetrinskrav: Dette er mellemtrin. Opgaverne må gerne udfordre, men de skal være klare, elevnære og uden unødig sproglig kompleksitet.",
      "Brug konkrete eksempler, korte tekststykker og tydelige regnesituationer.",
      "Fokusér på anvendelse, forståelse og sikre mellemregninger frem for ren udenadslære.",
    ];
  }

  return [
    "Klassetrinskrav: Dette er udskoling eller ældre elever. Opgaverne må gerne være tydeligt mere krævende og kræve præcision, flertrinsforståelse og stærkere begrebsforståelse.",
    "Brug gerne mere komplekse regnesituationer, men hold stadig formuleringerne korte nok til mobilformat.",
    "Fokusér på korrekthed, metodeforståelse og realistiske elevmisforståelser i distraktorerne.",
  ];
}

function createMathPromptExamples(mathTopic: string, gradeLevels: string[]) {
  const normalizedTopic = normalizeDanishText(mathTopic);
  const { representativeGrade } = getGradeLevelRange(gradeLevels);
  const gradeNumber = representativeGrade;

  if (gradeNumber !== null && gradeNumber <= 2) {
    return [
      "Mini-eksempel: Hvad er 3 + 2?",
      "Mini-eksempel: Emil har 4 æbler og får 1 mere. Hvor mange har han nu?",
      "Mini-eksempel: Hvilket tal mangler: 2, 3, 4, __ ?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["plus", "minus", "regneart", "talforståelse", "tæl", "tael"])) {
    return [
      "Mini-eksempel: Hvad er 46 + 17?",
      "Mini-eksempel: Alma har 72 kr. og bruger 15 kr. Hvor mange kroner har hun tilbage?",
      "Mini-eksempel: Hvilket svar viser den rigtige udregning af 63 - 28?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["gange", "division", "tabeller", "multiplikation", "divider"])) {
    return [
      "Mini-eksempel: Hvad er 6 · 4?",
      "Mini-eksempel: 24 kager deles ligeligt mellem 6 børn. Hvor mange får hver?",
      "Mini-eksempel: Hvilket regnestykke passer til 8 grupper med 3 i hver?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["brøk", "brok", "procent", "decimal"])) {
    return [
      "Mini-eksempel: Hvilken brøk viser 3 ud af 4 lige store dele?",
      "Mini-eksempel: Hvad er 50 % af 20?",
      "Mini-eksempel: Hvilket decimaltal svarer til en halv?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["geometri", "former", "vinkel", "omkreds", "areal"])) {
    return [
      "Mini-eksempel: Hvor mange hjørner har et rektangel?",
      "Mini-eksempel: Hvad er omkredsen af et kvadrat med sidelængden 5 cm?",
      "Mini-eksempel: Hvilken figur har præcis tre sider?",
    ];
  }

  return [
    "Mini-eksempel: Hvilket svar er rigtigt, når man regner opgaven færdig?",
    "Mini-eksempel: Hvilket tal mangler i regnestykket?",
    "Mini-eksempel: Hvilken metode eller udregning passer bedst til situationen?",
  ];
}

function createDanskGradeLevelGuidance(gradeLevels: string[]) {
  const { lowestGrade, highestGrade } = getGradeLevelRange(gradeLevels);

  if (lowestGrade !== null && highestGrade !== null && lowestGrade !== highestGrade) {
    return [
      `Klassetrinskrav: Løbet skal fungere for flere klassetrin samtidig fra ${lowestGrade}. til ${highestGrade}. klasse.`,
      "Brug tydelige, elevnære formuleringer, så de yngste kan være med, men lad stadig nogle spørgsmål kræve lidt mere sikkerhed og refleksion for de ældste.",
      "Hold niveauet i en bred midte og undgå både meget barnlige opgaver og unødigt akademisk sprog.",
    ];
  }

  const gradeNumber = highestGrade;

  if (gradeNumber !== null && gradeNumber <= 2) {
    return [
      "Klassetrinskrav: Dette er indskoling. Spørgsmålene skal være meget lette at afkode, meget konkrete og have et lavt fagligt sprogniveau.",
      "Brug korte sætninger, meget tydelige eksempler og kun én tanke ad gangen.",
      "Undgå abstrakte analyseord som tema, symbolik, fortæller, komposition og fortolkning, medmindre de forklares helt konkret og børnenært.",
      "Fokusér på helt grundlæggende færdigheder som lyd, bogstav, rim, enkle ordklasser, let stavning, simple sætninger og helt kort læseforståelse.",
      "Svarmulighederne skal også være korte og lette at læse. Undgå lange forklarende svar.",
    ];
  }

  if (gradeNumber !== null && gradeNumber <= 4) {
    return [
      "Klassetrinskrav: Dette er mellem indskoling og begyndende mellemtrin. Spørgsmålene skal stadig være konkrete, tydelige og forholdsvis lette.",
      "Brug korte cases, simple tekstuddrag og velkendte ord. Hold fagbegreberne få og let forståelige.",
      "Fokusér på grundlæggende læseforståelse, stavning, ordklasser, enkle grammatiske mønstre og genkendelige litterære træk.",
    ];
  }

  if (gradeNumber !== null && gradeNumber <= 6) {
    return [
      "Klassetrinskrav: Dette er mellemtrin. Spørgsmålene må gerne udfordre, men de skal stadig være klare, konkrete og elevnære.",
      "Brug korte tekstuddrag, tydelige eksempler og begyndende analyse, men undgå unødigt akademisk sprog.",
      "Fokusér på anvendelse af danskfaglig viden frem for rene definitioner.",
    ];
  }

  return [
    "Klassetrinskrav: Dette er udskoling eller ældre elever. Spørgsmålene må gerne være tydeligt mere udfordrende og kræve præcis forståelse, refleksion og danskfaglig sikkerhed.",
    "Brug gerne korte tekstuddrag, fortolkning, analyse, sproglige nuancer og mere krævende fagbegreber, når det passer til emnet.",
    "Hold stadig spørgsmålene korte nok til mobilformat, men niveauet må være markant højere end på de lave klassetrin.",
  ];
}

function createDanskPrompt(input: z.infer<typeof danishInterviewPayloadSchema>) {
  const { count, danishTopic, gradeLevels } = input;
  const gradeLevelLabel = formatGradeLevelsForPrompt(gradeLevels);
  const miniExamples = createDanskPromptExamples(danishTopic);
  const gradeLevelGuidance = createDanskGradeLevelGuidance(gradeLevels);

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
- Du skal altid generere et løb baseret på brugerens input, uanset hvor generisk, bredt eller kortfattet emnet er.
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
- Niveauet SKAL ramme klassetrinnet meget præcist. Hvis klassetrinnet er lavt, skal spørgsmålene være tilsvarende lette, konkrete og forsigtige i sproget. Hvis klassetrinnet er højere, må niveauet gerne være mere udfordrende.
- Det er vigtigere at ramme elevniveauet præcist end at virke imponerende eller avanceret.
- Titel skal være motiverende, konkret og brugbar i arkivet.
- Spørgsmålene skal fungere som poster i et udendørs GPS-løb, så de skal være korte nok til at kunne læses stående på en mobil.
- Ved analyse- eller læsespørgsmål skal facit stadig være entydigt.
- Undgå tvetydige facit, upræcise formuleringer og sproglige fejl.
- Følg disse klassetrinsspecifikke krav meget nøje:
${gradeLevelGuidance.map((line) => `- ${line}`).join("\n")}
- Brug denne type mini-eksempler som kvalitetsniveau og form, ikke som faste spørgsmål:
${miniExamples.map((example) => `- ${example}`).join("\n")}`,
    prompt: [
      `Fag: Dansk.`,
      `Klassetrin: ${gradeLevelLabel}.`,
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
      "Niveauet skal ramme klassetrinnet meget præcist. Ved 1.-2. klasse skal spørgsmålene være mærkbart lettere, kortere og mere konkrete end ved mellemtrin og udskoling.",
      ...gradeLevelGuidance,
      "Variér gerne mellem læseforståelse, grammatik, stavning, ordkendskab og litteratur, hvis emnet tillader det.",
      "Brug disse mini-eksempler som pejlemærker for format og kvalitet:",
      ...miniExamples,
      "Byg nu et komplet dansk-løb med titel og spørgsmål.",
    ].join("\n"),
  };
}

function createEnglishGradeLevelGuidance(gradeLevels: string[]) {
  const { lowestGrade, highestGrade } = getGradeLevelRange(gradeLevels);

  if (lowestGrade !== null && highestGrade !== null && lowestGrade !== highestGrade) {
    return [
      `Grade-level requirement: the run must work across multiple grades from ${lowestGrade}. to ${highestGrade}. grade.`,
      "Keep the language accessible enough for the youngest learners while still including some questions that meaningfully stretch the oldest learners.",
      "Aim for a broad middle level with clear wording, concrete contexts, and a balanced spread of easier and slightly more demanding questions.",
    ];
  }

  const gradeNumber = highestGrade;

  if (gradeNumber !== null && gradeNumber <= 2) {
    return [
      "Grade-level requirement: early primary learners. Use very short English sentences, concrete vocabulary, and one clear idea at a time.",
      "Focus on high-frequency words, simple classroom English, very basic grammar, and easy meaning questions.",
      "Avoid abstract literary analysis, long reading passages, and advanced metalanguage.",
    ];
  }

  if (gradeNumber !== null && gradeNumber <= 4) {
    return [
      "Grade-level requirement: lower primary to early middle primary. Keep the English clear, concrete, and easy to decode.",
      "Use short sentences, familiar vocabulary, and direct comprehension or grammar tasks.",
      "Focus on simple grammar, everyday vocabulary, short reading prompts, and clear meaning questions.",
    ];
  }

  if (gradeNumber !== null && gradeNumber <= 6) {
    return [
      "Grade-level requirement: middle primary. Questions may be more challenging, but the language must still be clear and student-friendly.",
      "Use short text excerpts, focused grammar tasks, vocabulary in context, and accessible cultural references.",
      "Blend comprehension, grammar, vocabulary, and usage without becoming too academic.",
    ];
  }

  return [
    "Grade-level requirement: lower secondary or older learners. Questions may be meaningfully more demanding and require precision, nuance, and stronger language awareness.",
    "Use richer vocabulary, better distractors, and slightly more advanced reading or grammar contexts while keeping mobile-friendly length.",
    "Culture questions may include specific British or American references, but they must still be answerable and pedagogically relevant.",
  ];
}

function createEnglishPromptExamples(englishTopic: string) {
  const normalizedTopic = normalizeDanishText(englishTopic);

  if (includesAnyKeyword(normalizedTopic, ["grammar", "spelling", "tense", "verbs"])) {
    return [
      "Mini-example: In the sentence 'She walks to school every day', which verb form is correct?",
      "Mini-example: Which sentence uses the correct past tense?",
      "Mini-example: Which spelling is correct in this short sentence?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["vocabulary", "words", "word", "meaning"])) {
    return [
      "Mini-example: What does the word 'borrow' mean in this sentence?",
      "Mini-example: Which word best completes the sentence?",
      "Mini-example: Which option is the closest synonym for the highlighted word?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["reading", "comprehension", "text"])) {
    return [
      "Mini-example: In the text, why is the boy nervous before the match?",
      "Mini-example: Which heading fits the short text best?",
      "Mini-example: What can the reader infer from the final sentence?",
    ];
  }

  if (includesAnyKeyword(normalizedTopic, ["british", "american", "culture"])) {
    return [
      "Mini-example: Which food is most strongly associated with a traditional British breakfast?",
      "Mini-example: Which spelling is American English rather than British English?",
      "Mini-example: Which cultural fact about the UK or the USA is correct?",
    ];
  }

  return [
    "Mini-example: Which sentence is correct in English?",
    "Mini-example: Which word best fits the context?",
    "Mini-example: What is the best answer based on the short English text?",
  ];
}

function createEnglishPrompt(input: z.infer<typeof englishInterviewPayloadSchema>) {
  const { count, englishTopic, gradeLevels } = input;
  const gradeLevelLabel = formatGradeLevelsForPrompt(gradeLevels);
  const miniExamples = createEnglishPromptExamples(englishTopic);
  const gradeLevelGuidance = createEnglishGradeLevelGuidance(gradeLevels);

  return {
    schemaName: "EnglishBuilderInterviewRun",
    schemaDescription: "A complete English-language run with title and pedagogically strong multiple-choice questions.",
    systemPrompt: `You are an elite, pedagogically outstanding native English teacher and curriculum designer.
You create complete English runs for school use.

You MUST always follow these rules:
- Return only valid JSON matching the schema.
- Return exactly ${count} multiple-choice questions.
- Never return fewer or more than ${count} questions.
- Each question must have exactly 4 answer options in "options".
- "correctAnswer" must exactly match one of the 4 options.
- You must always generate a run based on the user's input, no matter how generic, broad, or brief the topic is.
- All generated questions, options, and correctAnswer values MUST be written in natural English.
- Do not write the actual question content in Danish.
- Every question must be age-appropriate, pedagogically strong, and clearly matched to the stated grade level.
- Use concrete learning contexts: short sentences, mini texts, vocabulary in context, grammar in context, reading comprehension, or precise culture prompts.
- Avoid generic filler, vague trivia, joke answers, and placeholders such as "Marker", "Option 1", or other artificial distractors.
- Distractors must be plausible and should reflect real grammar mistakes, vocabulary confusions, reading misunderstandings, or realistic culture mix-ups.
- If the topic is grammar or spelling, the wrong answers must look like mistakes students could actually make.
- If the topic is vocabulary, the wrong answers must be semantically close enough to be believable.
- If the topic is reading comprehension, use short readable texts with one clear correct inference or understanding.
- If the topic is British or American culture, use concrete and teachable facts rather than random trivia.
- Keep every question short enough to work on a phone during an outdoor GPS activity.
- The title may be in English or Danish, but it must be motivating and specific.
- Follow these grade-level requirements very closely:
${gradeLevelGuidance.map((line) => `- ${line}`).join("\n")}
- Use the following mini-examples as quality and style guides, not as fixed questions:
${miniExamples.map((example) => `- ${example}`).join("\n")}`,
    prompt: [
      `Subject: English.`,
      `Grade level: ${gradeLevelLabel}.`,
      `English topic: ${englishTopic}.`,
      `Question count: ${count}.`,
      `CRITICAL: Return exactly ${count} questions.`,
      "All actual question content must be in English.",
      "Make the distractors plausible and pedagogically useful.",
      "Use grammar, vocabulary, reading, or culture contexts that fit the topic precisely.",
      ...gradeLevelGuidance,
      "Use these mini-examples as quality markers:",
      ...miniExamples,
      "Now build the complete English run with title and questions.",
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

function normalizeGeneratedRun(
  object: { title: string; questions: Array<{ question: string; options: string[]; correctAnswer: string }> },
  normalization: { failClosed: boolean } = { failClosed: false },
) {
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
    const hasUniqueOptions =
      new Set(safeOptions.map((option) => option.toLocaleLowerCase("da-DK"))).size === 4;
    if (
      normalization.failClosed &&
      (!safeOptions.includes(normalizedCorrectAnswer) ||
        safeOptions.some((option) => !option) ||
        !hasUniqueOptions)
    ) {
      throw new LynbyggerQualityError("invalid_generated_output");
    }

    const safeCorrectAnswer = safeOptions.includes(normalizedCorrectAnswer)
      ? normalizedCorrectAnswer
      : safeOptions[0];

    return {
      question: question.question.trim(),
      options: safeOptions,
      correctAnswer: safeCorrectAnswer,
    };
  });

  return {
    title: object.title.trim(),
    questions,
  };
}

export async function POST(req: Request) {
  const requestPath = new URL(req.url).pathname;

  try {
    if (!process.env.OPENAI_API_KEY) {
      await logHandledServerError({
        requestPath,
        route: requestPath,
        method: "POST",
        context: "manual_builder_missing_openai_key",
        status: 500,
        error: "OPENAI_API_KEY mangler i miljøet.",
      });
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

    const basePromptConfig =
      parsedPayload.data.builderType === "matematik"
        ? createMathPrompt(parsedPayload.data)
        : parsedPayload.data.builderType === "dansk"
          ? createDanskPrompt(parsedPayload.data)
          : parsedPayload.data.builderType === "engelsk"
            ? createEnglishPrompt(parsedPayload.data)
            : createManualPrompt(parsedPayload.data);

    const count = parsedPayload.data.count;

    const schema = createGeneratedRunSchema(count);
    const strictLynbyggerInput =
      parsedPayload.data.builderType === "manual" && parsedPayload.data.qualityMode === "strict"
        ? parsedPayload.data
        : null;

    const generateRun = async (input: {
      modelId: string;
      prompt: string;
      systemPrompt: string;
      temperature?: number;
    }) => {
      const { object } = await generateObject({
        model: openai(input.modelId),
        schema,
        schemaName: basePromptConfig.schemaName,
        schemaDescription: basePromptConfig.schemaDescription,
        system: input.systemPrompt,
        prompt: input.prompt,
        ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
        timeout: OPENAI_TIMEOUT_MS,
        providerOptions: {
          openai: {
            strictJsonSchema: true,
            store: false,
          },
        },
      });

      return normalizeGeneratedRun(object, { failClosed: strictLynbyggerInput !== null });
    };

    let normalizedRun;
    let qualityRewriteRounds: number | null = null;
    if (strictLynbyggerInput) {
      const topic = strictLynbyggerInput.manualTopic;
      const gradeLevelLabel = formatGradeLevelsForPrompt(strictLynbyggerInput.gradeLevels);
      const qualityResult = await runLynbyggerQualityPipeline({
        questionCount: count,
        generate: () =>
          generateRun({
            modelId: LYNBYGGER_GENERATOR_MODEL,
            systemPrompt: basePromptConfig.systemPrompt,
            prompt: basePromptConfig.prompt,
            temperature: 0.2,
          }),
        review: async (run) => {
          const { object } = await generateObject({
            model: openai(LYNBYGGER_REVIEW_MODEL),
            schema: createLynbyggerReviewSchema(count),
            schemaName: "LynbyggerQuestionReview",
            schemaDescription: "En streng faglig vurdering af hvert quizspørgsmål.",
            system: LYNBYGGER_REVIEWER_SYSTEM_PROMPT,
            prompt: createLynbyggerReviewerPrompt({ topic, gradeLevelLabel, run }),
            timeout: OPENAI_TIMEOUT_MS,
            providerOptions: {
              openai: {
                strictJsonSchema: true,
                store: false,
              },
            },
          });

          return object;
        },
        rewrite: (run, review) =>
          generateRun({
            modelId: LYNBYGGER_REVIEW_MODEL,
            systemPrompt: basePromptConfig.systemPrompt,
            prompt: createLynbyggerRewritePrompt({ topic, gradeLevelLabel, run, review }),
          }),
      });

      normalizedRun = qualityResult.run;
      qualityRewriteRounds = qualityResult.rewriteRounds;
    } else {
      normalizedRun = await generateRun({
        modelId: LYNBYGGER_GENERATOR_MODEL,
        systemPrompt: basePromptConfig.systemPrompt,
        prompt: basePromptConfig.prompt,
        temperature: 0.7,
      });
    }

    return NextResponse.json(
      {
        title: normalizedRun.title,
        questions: normalizedRun.questions,
      },
      qualityRewriteRounds === null
        ? undefined
        : {
            headers: {
              "X-Lynbygger-Quality": "reviewed",
              "X-Lynbygger-Rewrite-Rounds": String(qualityRewriteRounds),
            },
          },
    );
  } catch (error) {
    if (error instanceof LynbyggerQualityError) {
      console.warn("Lynbyggerens faglige kvalitetstjek afviste et udkast.", {
        status: 422,
        code: error.code,
      });
      await logHandledServerError({
        route: "/api/manual-builder/interview",
        method: "POST",
        status: 422,
        error: error.code,
        requestPath,
        routeType: "route",
      });
      return NextResponse.json(
        { error: "Løbet kunne ikke laves sikkert lige nu. Prøv igen." },
        { status: 422 },
      );
    }

    const status = isTimeoutError(error) ? 504 : 500;
    console.error("Fejl i manual-builder/interview.", { status });
    await logHandledServerError({
      route: "/api/manual-builder/interview",
      method: "POST",
      status,
      error: status === 504 ? "manual_builder_generation_timeout" : "manual_builder_generation_failed",
      requestPath,
      routeType: "route",
    });

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
