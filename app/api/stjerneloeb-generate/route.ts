import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ImageGenerateParamsNonStreaming } from "openai/resources/images";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import {
  formatGradeLevelsForPrompt,
  getGradeLevelRange,
  normalizeGradeLevels,
} from "@/utils/gradeLevels";

export const maxDuration = 120;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Image model can be configured via env; default to gpt-image-2
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

const ALLOWED_COUNTS = [4, 6, 8, 10] as const;
const DEFAULT_COUNT = 6;
const OPENAI_TIMEOUT_MS = 60_000;
const MAX_TOPIC_LENGTH = 150;
const MAX_SUBJECT_LENGTH = 80;

type GeneratePayload = {
  topic?: unknown;
  subject?: unknown;
  gradeLevels?: unknown;
  count?: unknown;
  raceType?: unknown;
};

const postSchemaClassic = z
  .object({
    title: z.string().trim().min(1),
    body_text: z.string().trim().min(1),
    image_prompt: z.string().trim().min(1),
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    correct_index: z.number().int().min(0).max(3),
  })
  .strict();

const postSchemaCrossword = z
  .object({
    title: z.string().trim().min(1),
    body_text: z.string().trim().min(1),
    image_prompt: z.string().trim().min(1),
    hint: z.string().trim().min(1),
    answer_word: z.string().trim().max(12).regex(/^[A-ZÆØÅ0-9]+$/),
  })
  .strict();

function createSchema(count: number, raceType: "classic" | "crossword") {
  return z
    .object({
      title: z.string().trim().min(1),
      posts: z.array(raceType === "crossword" ? postSchemaCrossword : postSchemaClassic).length(count),
    })
    .strict();
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.floor(value) as (typeof ALLOWED_COUNTS)[number];
    if (ALLOWED_COUNTS.includes(n)) return n;
  }
  return DEFAULT_COUNT;
}

function buildPollinationsUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?nologo=true&model=flux&width=768&height=512&quality=high&enhance=false&nofeed=true`;
}

function composeDallePrompt(imagePrompt: string, artDirection: ImageArtDirection): string {
  return `${artDirection.promptRule}. ${imagePrompt}. I NEED to test how the tool works with extremely simple prompts. DO NOT add any text, letters, numbers, words, labels, captions, or watermarks to the image.`;
}

function buildImageGenerationParams(
  model: string,
  prompt: string,
): ImageGenerateParamsNonStreaming {
  const baseParams = {
    model,
    prompt,
    n: 1,
    size: "1024x1024" as const,
  };

  if (model === "dall-e-3") {
    return {
      ...baseParams,
      quality: "standard",
      style: "natural",
    };
  }

  if (model.startsWith("gpt-image")) {
    return {
      ...baseParams,
      quality: "medium",
    };
  }

  return {
    ...baseParams,
    quality: "auto",
  };
}

async function generateDalleImage(
  openaiClient: OpenAI,
  imagePrompt: string,
  artDirection: ImageArtDirection,
): Promise<string> {
  const response = await openaiClient.images.generate(
    buildImageGenerationParams(IMAGE_MODEL, composeDallePrompt(imagePrompt, artDirection)),
  );
  const data0 = response.data?.[0];
  const url = data0?.url ?? (data0?.b64_json ? `data:image/png;base64,${data0.b64_json}` : undefined);
  if (!url) throw new Error(`No image URL returned from OpenAI image model (${IMAGE_MODEL})`);
  return url;
}

async function generateImageUrl(
  openaiClient: OpenAI,
  imagePrompt: string,
  artDirection: ImageArtDirection,
): Promise<string> {
  try {
    return await generateDalleImage(openaiClient, imagePrompt, artDirection);
  } catch (err) {
    console.warn(
      "OpenAI image generation failed, falling back to Pollinations:",
      err instanceof Error ? err.message : err,
    );
    return buildPollinationsUrl(imagePrompt);
  }
}

type ImageArtDirection = {
  label: string;
  promptRule: string;
  emphasis: string;
};

function resolveImageArtDirection(subject: string): ImageArtDirection {
  const normalizedSubject = subject.trim().toLowerCase();

  if (normalizedSubject.includes("dansk")) {
    return {
      label: "Dansk Editorial",
      promptRule:
        "editorial literary illustration, warm Nordic tones, tactile paper feel, subtle symbolism, school-safe scene, no text overlay, no watermark, no text, no numbers, no captions, no chalkboards, no letters, no handwriting",
      emphasis: "læsescener, stemning og fortællende detaljer — ingen tekst i billedet",
    };
  }

  if (normalizedSubject.includes("matematik")) {
    return {
      label: "Matematik Grid",
      promptRule:
        "abstract 3D geometric composition, crystalline structures, architectural minimalism, soft color gradients, depth of field, clean studio lighting, school-safe, no text, no numbers, no captions, no chalkboards, no letters, no handwriting, no clipart, no watermark",
      emphasis: "abstrakte geometriske former i rum — ingen tal, ingen tekst, ingen tavle, ingen tegneserie-stil",
    };
  }

  if (normalizedSubject.includes("engelsk")) {
    return {
      label: "English Poster",
      promptRule:
        "bold classroom poster illustration, cinematic composition, energetic but school-safe, contemporary everyday scene, no text overlay, no watermark, no text, no numbers, no captions, no chalkboards, no letters, no handwriting",
      emphasis: "tydelige situationer, karakterer og handlingsøjeblikke, der giver mission-følelse — ingen tekst i billedet",
    };
  }

  if (normalizedSubject.includes("tysk")) {
    return {
      label: "Deutsch Klassisch",
      promptRule:
        "clean structured educational illustration, warm amber tones, Central European setting, school-safe, no text overlay, no watermark, no text, no numbers, no captions, no chalkboards, no letters, no handwriting",
      emphasis: "tydelige hverdagssituationer og genstande, der understøtter sprogindlæring — ingen tekst i billedet",
    };
  }

  if (normalizedSubject.includes("fysik") || normalizedSubject.includes("kemi")) {
    return {
      label: "Fysik/Kemi Grid",
      promptRule:
        "scientific laboratory illustration, clean composition, visible apparatus or chemical structures, violet and indigo tones, school-safe, no text overlay, no watermark, no text, no numbers, no captions, no chalkboards, no letters, no handwriting",
      emphasis: "eksperimenter, laboratorieudstyr, kemiske strukturer eller fysiske fænomener — ingen tekst i billedet",
    };
  }

  if (normalizedSubject.includes("geografi")) {
    return {
      label: "Geografi Klassisk",
      promptRule:
        "geographic illustration, aerial or landscape perspective, natural greens and earth tones, maps or terrain features, school-safe, no text overlay, no watermark, no text, no numbers, no captions, no chalkboards, no letters, no handwriting",
      emphasis: "landskaber, kort, klimazoner eller geografiske fænomener — ingen tekst i billedet",
    };
  }

  if (normalizedSubject.includes("biologi")) {
    return {
      label: "Biologi Editorial",
      promptRule:
        "natural science illustration, detailed botanical or biological subject, fresh greens, scientific observation style, school-safe, no text overlay, no watermark, no text, no numbers, no captions, no chalkboards, no letters, no handwriting",
      emphasis: "organismer, cellestrukturer, økosystemer eller biologiske processer — ingen tekst i billedet",
    };
  }

  return {
    label: "Standard",
    promptRule:
      "clear educational illustration, friendly realistic detail, readable composition, school-safe, no text overlay, no watermark, no text, no numbers, no captions, no chalkboards, no letters, no handwriting",
    emphasis: "en umiddelbart forståelig scene, der hjælper eleverne ind i emnet — ingen tekst i billedet",
  };
}

// ---------------------------------------------------------------------------
// Content mode system — three fundamental archetypes
// ---------------------------------------------------------------------------

type SubjectContentMode = "task" | "passage" | "inquiry";

function resolveSubjectContentMode(subject: string): SubjectContentMode {
  const key = subject.trim().toLowerCase();

  // TASK mode: body_text IS the problem, not an explanatory passage
  if (key.includes("matematik")) return "task";
  if (key.includes("fysik") || key.includes("kemi")) return "task";

  // PASSAGE mode: body_text is a reading passage, question tests comprehension
  if (key.includes("dansk")) return "passage";
  if (key.includes("engelsk")) return "passage";
  if (key.includes("tysk")) return "passage";
  if (key.includes("historie")) return "passage";

  // INQUIRY mode: body_text describes a phenomenon, question tests reasoning
  if (key.includes("geografi") || key.includes("samfund")) return "inquiry";
  if (key.includes("biologi") || key.includes("natur")) return "inquiry";

  return "passage";
}

function buildContentModeBlock(mode: SubjectContentMode): string {
  switch (mode) {
    case "task":
      return `INDHOLDSTILSTAND: OPGAVE
body_text er OPGAVEN — et kort scenarie, et regnestykke eller en eksperimentbeskrivelse. IKKE en forklarende tekst.
body_text skal være 1-3 sætninger. Start direkte med problemet. Ingen indledning.`;
    case "inquiry":
      return `INDHOLDSTILSTAND: UNDERSØGELSE
body_text beskriver et konkret fænomen, en observation eller et datasæt med fakta, enheder eller målbare størrelser.
Start direkte med fænomenet. Ingen generel introduktion til faget.`;
    case "passage":
    default:
      return `INDHOLDSTILSTAND: LÆSEPASSAGE
body_text er en selvstændig tekst, der kan læses og forstås. Spørgsmålet tester forståelse af teksten.
Start direkte med indholdet. Ingen meta-kommentarer om faget.`;
  }
}

// ---------------------------------------------------------------------------
// Subject-aware content rules (with hard anti-fluff blocks)
// ---------------------------------------------------------------------------

type SubjectContentRules = {
  contentDirective: string;
  questionFormat: string;
  forbiddenPatterns: string;
  antiFluff: string;
};

function resolveSubjectContentRules(subject: string, raceType: "classic" | "crossword"): SubjectContentRules {
  const key = subject.trim().toLowerCase();

  if (key.includes("matematik")) {
    return raceType === "crossword"
      ? {
          contentDirective:
            "body_text skal være et kort matematisk scenarie med konkrete tal (1-3 sætninger). Inkludér beregningen direkte i teksten.",
          questionFormat:
            "answer_word SKAL være resultatet af en beregning (fx et tal eller en matematisk term som AREAL, RADIUS). hint skal indeholde selve regnestykket.",
          forbiddenPatterns:
            "Generér ALDRIG generelle vidensspørgsmål om matematik. Alle poster SKAL indeholde et konkret regnestykke, som eleven løser for at finde answer_word.",
          antiFluff:
            `Det er FORBUDT at skrive indledende sætninger som "I matematik arbejder vi med…", "Multiplikation betyder…", "I dette regnestykke skal du…" eller "Matematik handler om…".
body_text SKAL starte direkte med scenariet eller regnestykket. Maks 2-3 sætninger.
Hvis læreren beder om "rene regnestykker", skal body_text KUN indeholde selve regnestykket (fx "15 × 4 + 23 = ?") — INGEN indpakning overhovedet.`,
        }
      : {
          contentDirective:
            "body_text skal være et kort matematisk scenarie med konkrete tal, mål eller geometriske figurer (1-3 sætninger). Inkludér altid mindst ét regnestykke, en ligning eller en talrelation.",
          questionFormat:
            "Spørgsmålet SKAL være en regneopgave med ét korrekt numerisk svar. Alle fire svarmuligheder SKAL være tal, mål eller matematiske udtryk — ALDRIG prosasvar. Eksempel: '12 cm²', '3/4', '56', '2π'.",
          forbiddenPatterns:
            "Generér ALDRIG spørgsmål som 'Hvad hedder denne form?', 'Hvem opfandt…' eller 'Hvad er forskellen mellem…'. Alle poster SKAL have et konkret regnestykke, og svarmulighederne SKAL være numeriske eller formelbaserede.",
          antiFluff:
            `Det er FORBUDT at skrive indledende sætninger som "I matematik arbejder vi med…", "Multiplikation betyder…", "I dette regnestykke skal du…" eller "Matematik handler om…".
body_text SKAL starte direkte med scenariet eller regnestykket. Maks 2-3 sætninger.
Hvis læreren beder om "rene regnestykker", skal body_text KUN indeholde selve regnestykket (fx "15 × 4 + 23 = ?") — INGEN indpakning overhovedet.
Alle 4 svarmuligheder SKAL være tal, enheder eller formler — ALDRIG tekst-svar som "Det ved man ikke" eller "Alle de ovenstående".`,
        };
  }

  if (key.includes("fysik") || key.includes("kemi") || key.includes("natur")) {
    return raceType === "crossword"
      ? {
          contentDirective:
            "body_text skal kort beskrive et eksperiment eller en fysisk/kemisk proces med rigtige enheder og størrelser (1-3 sætninger). Start direkte med eksperimentet.",
          questionFormat:
            "answer_word SKAL være en fagterm, en enhed eller et resultat (fx NEWTON, OXYGEN, CELSIUS). hint skal beskrive den videnskabelige sammenhæng.",
          forbiddenPatterns:
            "Undgå ren trivia. Posterne SKAL involvere konkret videnskabelig ræsonnering, enheder eller eksperimentelle observationer.",
          antiFluff:
            `Det er FORBUDT at skrive "Fysik handler om…", "I kemi lærer vi om…", "Videnskab er…" eller lignende indledninger.
body_text SKAL starte direkte med eksperimentet, processen eller beregningen. Maks 2-3 sætninger.
Fokusér på formler, enheder, målinger og observationer — ikke på at forklare, hvad faget er.`,
        }
      : {
          contentDirective:
            "body_text skal kort beskrive et eksperiment, en fysisk/kemisk proces eller et naturfænomen med rigtige enheder og størrelser (1-3 sætninger). Inkludér formler, enheder eller målbare observationer.",
          questionFormat:
            "Spørgsmålet SKAL teste forståelse af formler, enhedsomregninger, årsag-virkning eller observationer. Svarmulighederne skal indeholde enheder, tal eller præcise fagtermer.",
          forbiddenPatterns:
            "Undgå ren trivia eller 'hvem opdagede…'-spørgsmål. Fokusér på videnskabelig forståelse, beregninger og eksperimentelle resultater.",
          antiFluff:
            `Det er FORBUDT at skrive "Fysik handler om…", "I kemi lærer vi om…", "Videnskab er…" eller lignende indledninger.
body_text SKAL starte direkte med eksperimentet, processen eller beregningen. Maks 2-3 sætninger.
Fokusér på formler, enheder, målinger og observationer — ikke på at forklare, hvad faget er.
Svarmulighederne SKAL indeholde enheder, tal eller fagtermer — ikke vage prosasvar.`,
        };
  }

  if (key.includes("dansk")) {
    return {
      contentDirective:
        "body_text skal være et litterært uddrag, en læsepassage eller en sproglig tekst med tydelig opbygning og klart sprog. Teksten skal være lang nok til at give mening som læseoplevelse.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være et ord relateret til tekstens indhold, sprog eller analyse (fx METAFOR, TEMA, FORTÆLLER). hint skal pege på en sproglig eller indholdsmæssig detalje."
        : "Spørgsmålet skal teste læseforståelse, ordkendskab, tekstanalyse eller sproglig bevidsthed baseret på body_text.",
      forbiddenPatterns:
        "Undgå matematik- eller naturfagsspørgsmål. Hold fokus på læsning, sprog og tekstforståelse.",
      antiFluff:
        `Det er FORBUDT at skrive "Dansk er et fag hvor vi læser…", "Sprog handler om…" eller lignende meta-kommentarer.
Start direkte med teksten/uddraget. body_text ER læsepassagen — ikke en forklaring af, hvad eleven skal gøre.`,
    };
  }

  if (key.includes("engelsk")) {
    return {
      contentDirective:
        "body_text skal være på dansk men relatere til engelsk sprogindlæring. Inkludér engelske ord, udtryk eller sætninger, som eleven skal arbejde med.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være et engelsk ord (fx LIBRARY, PRESENT, COULD). hint skal være en dansk beskrivelse eller oversættelsesopgave."
        : "Spørgsmålet skal involvere oversættelse, ordforråd, grammatik eller udfyldningsopgaver mellem dansk og engelsk. Mindst én svarmulighed skal indeholde engelske ord.",
      forbiddenPatterns:
        "Alt indhold skal have en klar sproglig dimension. Undgå rene faktaspørgsmål uden sprogligt element.",
      antiFluff:
        `Det er FORBUDT at skrive "Engelsk er et vigtigt sprog…", "I engelsk lærer vi…" eller lignende.
Start direkte med den sproglige opgave eller tekst. Fokusér på konkret sprogarbejde.`,
    };
  }

  if (key.includes("tysk")) {
    return {
      contentDirective:
        "body_text skal være på dansk men relatere til tysk sprogindlæring. Inkludér tyske ord, udtryk, sætninger eller grammatiske strukturer, som eleven skal arbejde med.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være et tysk ord (fx SCHULE, BRUDER, KAUFEN). hint skal være en dansk beskrivelse eller oversættelsesopgave."
        : "Spørgsmålet skal involvere oversættelse, ordforråd, grammatik (fx kasus, verbøjning) eller udfyldningsopgaver mellem dansk og tysk. Mindst én svarmulighed skal indeholde tyske ord.",
      forbiddenPatterns:
        "Alt indhold skal have en klar sproglig dimension. Undgå rene faktaspørgsmål om Tyskland uden sprogligt element.",
      antiFluff:
        `Det er FORBUDT at skrive "Tysk er et sprog der tales i…", "I tyskundervisningen lærer vi…" eller lignende.
Start direkte med den sproglige opgave eller tekst. Fokusér på konkret sprogarbejde.`,
    };
  }

  if (key.includes("historie")) {
    return {
      contentDirective:
        "body_text skal beskrive en historisk begivenhed, periode eller person med konkrete årstal, steder og kontekst.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være et historisk nøgleord (fx REFORM, VIKING, REVOLUTION). hint skal referere til en specifik historisk kontekst."
        : "Spørgsmålet skal teste kronologisk forståelse, årsag-virkning, kildeanalyse eller perspektivering af historiske begivenheder.",
      forbiddenPatterns:
        "Undgå anakronismer. Alle årstal og fakta SKAL være historisk korrekte.",
      antiFluff:
        `Det er FORBUDT at skrive "Historie handler om…" eller "I fortiden…" som generelle indledninger.
Start direkte med den historiske begivenhed eller kontekst.`,
    };
  }

  if (key.includes("geografi") || key.includes("samfund")) {
    return {
      contentDirective:
        "body_text skal beskrive geografiske, samfundsmæssige eller kulturelle forhold med konkrete data, steder, koordinater eller statistikker. Start direkte med fænomenet.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være et geografisk eller samfundsfagligt begreb (fx KLIMA, DEMOKRATI, EKSPORT). hint skal relatere til konkrete data eller steder."
        : "Spørgsmålet skal teste forståelse af geografiske sammenhænge, samfundsstrukturer eller dataanalyse.",
      forbiddenPatterns:
        "Undgå upræcise eller forældede statistikker. Fokusér på verificerbare fakta.",
      antiFluff:
        `Det er FORBUDT at skrive "Geografi handler om…", "Verden er stor…" eller lignende generelle indledninger.
Start direkte med det konkrete fænomen, stedet eller datasættet. Fokusér på fakta og data.`,
    };
  }

  if (key.includes("biologi")) {
    return {
      contentDirective:
        "body_text skal beskrive en biologisk proces, en organisme, et økosystem eller et eksperiment med konkrete fagtermer, enheder eller observationer. Start direkte med fænomenet.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være en biologisk fagterm (fx FOTOSYNTESE, CELLEDELING, HABITAT). hint skal beskrive den biologiske sammenhæng."
        : "Spørgsmålet skal teste forståelse af biologiske processer, klassifikation, årsag-virkning eller observationer.",
      forbiddenPatterns:
        "Undgå ren trivia. Fokusér på biologisk forståelse, processer og fagtermer.",
      antiFluff:
        `Det er FORBUDT at skrive "Biologi handler om…", "Naturen er fantastisk…" eller lignende.
Start direkte med organismen, processen eller eksperimentet. Fokusér på faglige observationer.`,
    };
  }

  // Default: no extra subject rules
  return {
    contentDirective: "",
    questionFormat: "",
    forbiddenPatterns: "",
    antiFluff: "",
  };
}

function buildSubjectContentBlock(rules: SubjectContentRules): string {
  if (!rules.contentDirective && !rules.questionFormat && !rules.forbiddenPatterns) {
    return "";
  }

  const lines: string[] = ["\nFagregler — SKAL overholdes strengt:"];
  if (rules.contentDirective) lines.push(`- ${rules.contentDirective}`);
  if (rules.questionFormat) lines.push(`- ${rules.questionFormat}`);
  if (rules.forbiddenPatterns) lines.push(`- ${rules.forbiddenPatterns}`);
  return lines.join("\n");
}

function buildAntiFluffBlock(rules: SubjectContentRules): string {
  if (!rules.antiFluff) return "";
  return `\nANTI-FLUFF REGLER — KRITISK, OVERHOLD ALTID:\n${rules.antiFluff}`;
}

// ---------------------------------------------------------------------------
// Grade × Subject cross-rules
// ---------------------------------------------------------------------------

function resolveGradeSubjectCrossRules(subject: string, gradeLevels: readonly string[]): string {
  const { highestGrade } = getGradeLevelRange(gradeLevels);
  const key = subject.trim().toLowerCase();

  if (key.includes("matematik")) {
    if (highestGrade !== null && highestGrade <= 2) {
      return `Matematik × Indskoling (1.-2. klasse):
- Kun addition og subtraktion med tal under 20.
- Ingen brøker, decimaler eller multiplikation.
- Opgaverne skal handle om tælbare, konkrete ting (æbler, bolde, fingre).
- Eksempel: "Anna har 8 æbler. Hun spiser 3. Hvor mange har hun?"`;
    }
    if (highestGrade !== null && highestGrade <= 4) {
      return `Matematik × Begyndende mellemtrin (3.-4. klasse):
- Addition, subtraktion, multiplikation og enkel division.
- Tal under 1000. Ingen brøker eller decimaler endnu.
- Brug hverdagsscenarier (køb, antal, længder i hele tal).
- Eksempel: "Købmanden har 15 kasser med 6 flasker i hver. Hvor mange flasker er der i alt?"`;
    }
    if (highestGrade !== null && highestGrade <= 6) {
      return `Matematik × Mellemtrin (5.-6. klasse):
- Brøker, decimaler, procentregning, areal og omkreds.
- Tal op til 100.000. Enkel geometri (rektangel, trekant, cirkel).
- Brug målbare situationer (afstande, priser, arealer).
- Eksempel: "Et rektangulært bord er 1,2 m langt og 0,8 m bredt. Hvad er arealet?"`;
    }
    if (highestGrade !== null && highestGrade <= 9) {
      return `Matematik × Udskoling (7.-9. klasse):
- Algebra, ligninger, funktioner, geometri, proportioner, statistik.
- Brug variabler (x, y), formler og abstrakte problemer.
- Eksempel: "Løs ligningen: 3x + 7 = 22. Hvad er x?"`;
    }
    return "";
  }

  if (key.includes("fysik") || key.includes("kemi")) {
    if (highestGrade !== null && highestGrade <= 6) {
      return `Fysik/Kemi × Mellemtrin (5.-6. klasse):
- Simple eksperimenter og observationer.
- Grundlæggende enheder: gram (g), liter (L), grader Celsius (°C).
- Stofskifte, tilstandsformer (fast, flydende, gas), simple kredsløb.
- Ingen komplekse formler — fokusér på observation og beskrivelse.`;
    }
    if (highestGrade !== null && highestGrade <= 8) {
      return `Fysik/Kemi × Udskoling (7.-8. klasse):
- Formler som F = m·a, densitet = m/V, Ohms lov.
- Kemiske symboler, periodiske system, pH-skala.
- Enhedsomregninger og simple beregninger med formler.`;
    }
    if (highestGrade !== null && highestGrade <= 9) {
      return `Fysik/Kemi × Udskoling (9. klasse):
- Balancerede kemiske reaktionsskemaer, energiberegninger, mol-begrebet.
- Atomstruktur, bølger, elektromagnetisme.
- Avancerede beregninger med flere trin.`;
    }
    return "";
  }

  if (key.includes("tysk")) {
    if (highestGrade !== null && highestGrade <= 6) {
      return `Tysk × Mellemtrin (5.-6. klasse):
- Grundlæggende ordforråd: tal, farver, dyr, familie, mad, skole.
- Simple sætninger og hilsner. Ingen kasus eller avanceret grammatik.
- Oversættelsesopgaver med enkle, velkendte ord.`;
    }
    if (highestGrade !== null && highestGrade <= 9) {
      return `Tysk × Udskoling (7.-9. klasse):
- Udvidet ordforråd, verbbøjning (præsens, perfektum), kasus (nominativ, akkusativ, dativ).
- Sammensatte sætninger, præpositioner, modalverber.
- Korte tyske tekster med forståelsesspørgsmål.`;
    }
    return "";
  }

  if (key.includes("engelsk")) {
    if (highestGrade !== null && highestGrade <= 4) {
      return `Engelsk × Begyndende mellemtrin (3.-4. klasse):
- Grundlæggende ordforråd: farver, dyr, tal, kroppen, familien.
- Simple sætninger. Ingen grammatisk analyse.
- Oversættelsesopgaver med billedstøtte og velkendte ord.`;
    }
    if (highestGrade !== null && highestGrade <= 6) {
      return `Engelsk × Mellemtrin (5.-6. klasse):
- Udvidet ordforråd, simple verbtider (present, past), spørgeord.
- Korte engelske sætninger og dialoger. Udfyldningsopgaver.`;
    }
    if (highestGrade !== null && highestGrade <= 9) {
      return `Engelsk × Udskoling (7.-9. klasse):
- Avanceret grammatik (tider, passiv, reported speech), idiomer.
- Længere engelske tekster, læseforståelse, skriftlig produktion.`;
    }
    return "";
  }

  if (key.includes("biologi")) {
    if (highestGrade !== null && highestGrade <= 6) {
      return `Biologi × Mellemtrin (5.-6. klasse):
- Dyr, planter, menneskekroppen, sanser, simple økosystemer.
- Konkrete observationer og beskrivelser. Ingen komplekse fagtermer.`;
    }
    if (highestGrade !== null && highestGrade <= 9) {
      return `Biologi × Udskoling (7.-9. klasse):
- Cellebiologi, fotosyntese, genetik, evolution, økologi.
- Fagtermer bruges frit (DNA, mitose, habitat, fødekæde).`;
    }
    return "";
  }

  if (key.includes("geografi")) {
    if (highestGrade !== null && highestGrade <= 6) {
      return `Geografi × Mellemtrin (5.-6. klasse):
- Danmarks geografi, verdensdele, klimazoner, vejr.
- Konkrete steder og simple kort. Ingen avanceret statistik.`;
    }
    if (highestGrade !== null && highestGrade <= 9) {
      return `Geografi × Udskoling (7.-9. klasse):
- Globalisering, befolkning, ressourcer, bæredygtighed, tektoniske plader.
- Brug data, statistikker og fagtermer frit.`;
    }
    return "";
  }

  return "";
}

// ---------------------------------------------------------------------------
// Teacher override block
// ---------------------------------------------------------------------------

function buildTeacherOverrideBlock(topic: string): string {
  return `LÆRERENS INSTRUKTION ER LOV:
- Lærerens emne-beskrivelse ("${topic}") er den øverste autoritet.
- Hvis læreren beder om et specifikt format (fx "rene regnestykker", "ligninger", "oversættelsesopgaver"), skal ALLE poster følge det format uden undtagelse.
- Hvis læreren specificerer et emne (fx "brøker", "2. verdenskrig", "fotosyntese"), skal ALLE poster handle om præcis det emne.
- Lærerens instruktion overskriver alle andre regler om body_text-længde, stil og format.
- Tænk på lærerens emne-beskrivelse som et direkte svar på spørgsmålet: "Hvad præcis skal eleverne træne?"`;
}

// ---------------------------------------------------------------------------
// Pedagogical grade-band router (Gold Standard)
// ---------------------------------------------------------------------------

function resolveStjerneloebGradeLevelGuidance(gradeLevels: readonly string[]): string {
  const { lowestGrade, highestGrade } = getGradeLevelRange(gradeLevels);
  const gradeLevelLabel = formatGradeLevelsForPrompt(gradeLevels);

  if (lowestGrade !== null && highestGrade !== null && lowestGrade !== highestGrade) {
    return `Målgruppe: ${gradeLevelLabel} (flere klassetrin, ${lowestGrade}.-${highestGrade}. klasse).
Pædagogiske regler — SKAL overholdes strengt:
- Hold sproget tilgængeligt nok til de yngste, men byg faglig progression og udfordring ind til de ældste.
- Brødteksten skal være kort nok til at de yngste kan læse den, men fagligt stærk nok til at de ældste får udbytte.
- Spørgsmålene skal variere i sværhedsgrad, så der er noget for alle niveauer.
- Tonen skal være engageret, klar og alderssvarende for den brede gruppe.`;
  }

  const gradeNumber = highestGrade;

  if (gradeNumber !== null && gradeNumber <= 2) {
    return `Målgruppe: Indskoling (${gradeLevelLabel}, 6-8 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal være meget kort med korte, enkle sætninger. Brug kun hovedsætninger, ingen bisætninger.
- Brug kun dagligdags, konkrete ord som barnet kender fra hverdagen. Undgå alle fremmedord, fagtermer og abstrakte begreber.
- Spørgsmålene skal være meget konkrete, enkle og lette at afkode. Svarmulighederne skal være korte (1-3 ord).
- Tonen skal være varm, nysgerrig og opmuntrende, som en venlig voksen der fortæller.`;
  }

  if (gradeNumber !== null && gradeNumber <= 4) {
    return `Målgruppe: Begyndende mellemtrin (${gradeLevelLabel}, 9-10 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal være kort og overskuelig med tydelige sætninger.
- Brug velkendte situationer, korte cases og tydelige formuleringer.
- Du må gerne bruge enkle fagbegreber, men de skal forklares kort i selve teksten.
- Spørgsmålene skal kræve simpel forståelse og genkendelse. Svarmulighederne skal være korte og realistiske.
- Tonen skal være engageret og informativ.`;
  }

  if (gradeNumber !== null && gradeNumber <= 6) {
    return `Målgruppe: Mellemtrin (${gradeLevelLabel}, 10-12 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal være informativ med klare sætninger og lidt mere faglig dybde.
- Du må gerne bruge fagbegreber, men de skal forklares kort i selve teksten første gang de bruges.
- Spørgsmålene skal kræve let logisk tænkning — ikke bare direkte aflæsning, men kort refleksion over teksten.
- Tonen skal være engageret og informativ, som en god lærebog.`;
  }

  if (gradeNumber !== null && gradeNumber <= 9) {
    return `Målgruppe: Udskoling (${gradeLevelLabel}, 13-16 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal have et højt fagligt niveau med præcise, sammensatte sætninger.
- Brug præcise fagtermer, videnskabelige begreber og abstrakte koncepter frit uden at forklare dem.
- Spørgsmålene må gerne kræve analyse, perspektivering, sammenligning eller kildekritisk tænkning.
- Tonen skal være saglig, akademisk og udfordrende, som et fagligt opslagsværk.`;
  }

  // Fallback: default to mellemtrin rules
  return `Målgruppe: Mellemtrin (generelt niveau, 10-12 år).
Pædagogiske regler — SKAL overholdes strengt:
- Brødteksten skal være informativ med klare sætninger og lidt mere faglig dybde.
- Du må gerne bruge fagbegreber, men de skal forklares kort i selve teksten første gang de bruges.
- Spørgsmålene skal kræve let logisk tænkning — ikke bare direkte aflæsning, men kort refleksion over teksten.
- Tonen skal være engageret og informativ, som en god lærebog.`;
}

export async function POST(req: Request) {
  const requestPath = new URL(req.url).pathname;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await logHandledServerError({
        requestPath,
        route: requestPath,
        method: "POST",
        context: "stjerneloeb_generate_missing_openai_key",
        status: 500,
        error: "OPENAI_API_KEY mangler i miljøet.",
      });
      return NextResponse.json(
        { error: "OPENAI_API_KEY mangler i miljøet." },
        { status: 500 }
      );
    }

    const openaiClient = new OpenAI({ apiKey });

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

    let payload: GeneratePayload;
    try {
      payload = (await req.json()) as GeneratePayload;
    } catch {
      return NextResponse.json(
        { error: "Request-body skal være gyldigt JSON." },
        { status: 400 }
      );
    }

    const topic = asTrimmedString(payload.topic);
    const subject = asTrimmedString(payload.subject);
    const gradeLevels = normalizeGradeLevels(
      Array.isArray(payload.gradeLevels) ? payload.gradeLevels : []
    );
    const gradeLevelLabel = formatGradeLevelsForPrompt(gradeLevels);

    const count = asCount(payload.count);
    const raceType = (typeof payload.raceType === "string" && (payload.raceType === "crossword" || payload.raceType === "classic")) ? payload.raceType : "classic";

    if (!topic) {
      return NextResponse.json(
        { error: "Angiv et emne for stjerneløbet." },
        { status: 400 }
      );
    }
    if (topic.length > MAX_TOPIC_LENGTH) {
      return NextResponse.json(
        { error: "Emnet er for langt. Hold det under 150 tegn." },
        { status: 400 }
      );
    }
    if (subject.length > MAX_SUBJECT_LENGTH) {
      return NextResponse.json(
        { error: "Faget er for langt. Hold det under 80 tegn." },
        { status: 400 }
      );
    }


    const contentMode = resolveSubjectContentMode(subject);
    const contentModeBlock = buildContentModeBlock(contentMode);
    const pedagogicalRules = resolveStjerneloebGradeLevelGuidance(gradeLevels);
    const gradeSubjectCrossRules = resolveGradeSubjectCrossRules(subject, gradeLevels);
    const subjectContentRules = resolveSubjectContentRules(subject, raceType);
    const subjectContentBlock = buildSubjectContentBlock(subjectContentRules);
    const antiFluffBlock = buildAntiFluffBlock(subjectContentRules);
    const teacherOverrideBlock = buildTeacherOverrideBlock(topic);
    const subjectLine = subject ? `- Brug faget \"${subject}\" som faglig ramme for alle poster.` : "";
    const imageArtDirection = resolveImageArtDirection(subject);
    const imageDirectionLine =
      `- Alle billedprompts skal følge layout-retningen \"${imageArtDirection.label}\": ${imageArtDirection.promptRule}.`;
    const imagePurposeLine =
      `- Billedprompts skal især fremhæve ${imageArtDirection.emphasis}.`;

    const bodyTextDescription = contentMode === "task"
      ? "en kort opgavetekst eller et scenarie (1-3 sætninger, start direkte med opgaven)"
      : contentMode === "inquiry"
        ? "en kort faglig beskrivelse af et fænomen eller en observation med konkrete data"
        : "en læsbar brødtekst (se sætningskrav ovenfor)";

    let systemPrompt = "";
    if (raceType === "crossword") {
      systemPrompt = `Du er en dansk lærer, der laver et analogt stjerneløb som krydsordsløb til udendørs undervisning.
Et stjerneløb er en serie af laminerede A4-post-kort, der hænges rundt i skolegården.
Elever vandrer fra post til post, læser teksten, ser på billedet og skal gætte et ord ud fra en ledetråd.

${contentModeBlock}

${pedagogicalRules}
${gradeSubjectCrossRules ? `\n${gradeSubjectCrossRules}` : ""}
${subjectContentBlock}
${antiFluffBlock}

${teacherOverrideBlock}

Vigtige regler:
- Alt indhold skal være på dansk.
- Lav præcis ${count} poster.
- Hver post skal have: en kort overskrift, ${bodyTextDescription}, et billedprompt på ENGELSK til en AI-billedgenerator, et answer_word (et kort, logisk ord uden specialtegn, der relaterer til postens tekst, max 12 tegn, store bogstaver, ingen mellemrum) og et hint (en kort ledetråd til ordet).
- answer_word skal være på formatet: kun store bogstaver og tal, ingen mellemrum eller specialtegn, max 12 tegn.
- hint skal være en kort, præcis ledetråd til answer_word.
- Må IKKE generere options eller correct_index.
- Billedprompt på engelsk: én enkel prompt på naturligt engelsk, uden citationstegn eller punktform, og den skal passe direkte til posten.
${imageDirectionLine}
${imagePurposeLine}
- Giv løbet en samlet titel.
${subjectLine}`;
    } else {
      systemPrompt = `Du er en dansk lærer, der laver et analogt stjerneløb til udendørs undervisning.
Et stjerneløb er en serie af laminerede A4-post-kort, der hænges rundt i skolegården.
Elever vandrer fra post til post, læser teksten, ser på billedet og besvarer spørgsmålet.

${contentModeBlock}

${pedagogicalRules}
${gradeSubjectCrossRules ? `\n${gradeSubjectCrossRules}` : ""}
${subjectContentBlock}
${antiFluffBlock}

${teacherOverrideBlock}

Vigtige regler:
- Alt indhold skal være på dansk.
- Lav præcis ${count} poster.
- Hver post skal have: en kort overskrift, ${bodyTextDescription}, et billedprompt på ENGELSK til en AI-billedgenerator, et fagligt spørgsmål og præcis 4 svarmuligheder.
- Kun ét svar er korrekt (correct_index 0-3).
- body_text skal indeholde den information eleven behøver for at besvare spørgsmålet.
- Billedprompt på engelsk: én enkel prompt på naturligt engelsk, uden citationstegn eller punktform, og den skal passe direkte til posten.
${imageDirectionLine}
${imagePurposeLine}
- Giv løbet en samlet titel.
${subjectLine}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    let result: z.infer<ReturnType<typeof createSchema>>;
    try {
      const schema = createSchema(count, raceType);
      const response = await generateObject({
        model: openai("gpt-4o-mini"),
        schema,
        system: systemPrompt,
        prompt: `Lav et stjerneløb om emnet: "${topic}".`,
        abortSignal: controller.signal,
      });
      result = response.object;
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" || /timed out|timeout|aborted/i.test(err.message));
      if (isTimeout) {
        return NextResponse.json(
          { error: "AI-generering tog for lang tid. Prøv igen." },
          { status: 504 }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // Generate DALL-E 3 images in parallel (fall back to Pollinations on failure)
    type ClassicPost = z.infer<typeof postSchemaClassic>;
    type CrosswordPost = z.infer<typeof postSchemaCrossword>;

    const imageArtDir = resolveImageArtDirection(subject);
    const imageUrls = await Promise.all(
      result.posts.map((post) => generateImageUrl(openaiClient, post.image_prompt, imageArtDir)),
    );

    const posts = result.posts.map((post, i) => {
      const base = {
        number: i + 1,
        title: post.title,
        body_text: post.body_text,
        image_prompt: post.image_prompt,
        image_url: imageUrls[i],
      };
      if (raceType === "crossword") {
        const p = post as CrosswordPost;
        return {
          ...base,
          hint: p.hint,
          answer_word: p.answer_word,
        };
      } else {
        const p = post as ClassicPost;
        return {
          ...base,
          question: p.question,
          options: p.options,
          correct_index: p.correct_index,
        };
      }
    });

    const { data: savedRun, error: insertError } = await supabase
      .from("stjerneloeb")
      .insert({
        user_id: user.id,
        title: result.title,
        subject: subject || "Ikke angivet",
        grade_level: gradeLevelLabel || "Ikke angivet",
        posts,
      })
      .select("id")
      .single();

    if (insertError || !savedRun) {
      console.error("Supabase insert error:", insertError);
      await logHandledServerError({
        route: "/api/stjerneloeb-generate",
        method: "POST",
        status: 500,
        error: insertError ?? "Kunne ikke gemme stjerneløbet i databasen.",
        requestPath,
        routeType: "route",
      });
      return NextResponse.json(
        { error: "Kunne ikke gemme stjerneløbet i databasen." },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: savedRun.id });
  } catch (err) {
    console.error("Uventet fejl i /api/stjerneloeb-generate:", err);
    await logHandledServerError({
      route: "/api/stjerneloeb-generate",
      method: "POST",
      status: 500,
      error: err,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json(
      { error: "Der skete en uventet fejl. Prøv igen." },
      { status: 500 }
    );
  }
}
