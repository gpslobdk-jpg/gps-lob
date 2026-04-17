import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import {
  formatGradeLevelsForPrompt,
  GRADE_LEVEL_OPTIONS,
  getGradeLevelRange,
  normalizeGradeLevels,
} from "@/utils/gradeLevels";

export const maxDuration = 120;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true`;
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
        "editorial literary illustration, warm Nordic tones, tactile paper feel, subtle symbolism, school-safe scene, no text overlay, no watermark",
      emphasis: "læsescener, stemning og fortællende detaljer",
    };
  }

  if (normalizedSubject.includes("matematik")) {
    return {
      label: "Matematik Grid",
      promptRule:
        "clean educational illustration, geometric clarity, structured composition, clear quantities or shapes, high contrast, school-safe, no text overlay, no watermark",
      emphasis: "mønstre, former, størrelser eller relationer, der understøtter problemløsning",
    };
  }

  if (normalizedSubject.includes("engelsk")) {
    return {
      label: "English Poster",
      promptRule:
        "bold classroom poster illustration, cinematic composition, energetic but school-safe, contemporary everyday scene, no text overlay, no watermark",
      emphasis: "tydelige situationer, karakterer og handlingsøjeblikke, der giver mission-følelse",
    };
  }

  return {
    label: "Standard",
    promptRule:
      "clear educational illustration, friendly realistic detail, readable composition, school-safe, no text overlay, no watermark",
    emphasis: "en umiddelbart forståelig scene, der hjælper eleverne ind i emnet",
  };
}

// ---------------------------------------------------------------------------
// Subject-aware content rules
// ---------------------------------------------------------------------------

type SubjectContentRules = {
  contentDirective: string;
  questionFormat: string;
  forbiddenPatterns: string;
};

function resolveSubjectContentRules(subject: string, raceType: "classic" | "crossword"): SubjectContentRules {
  const key = subject.trim().toLowerCase();

  if (key.includes("matematik")) {
    return raceType === "crossword"
      ? {
          contentDirective:
            "Brødteksten skal beskrive et matematisk scenarie med konkrete tal, mål eller geometriske figurer. Inkludér en beregning eller et regnestykke, som eleven skal løse for at finde svaret.",
          questionFormat:
            "answer_word SKAL være resultatet af en beregning (fx et tal eller en matematisk term som AREAL, RADIUS). hint skal indeholde selve regnestykket eller den matematiske opgave.",
          forbiddenPatterns:
            "Generér ALDRIG generelle vidensspørgsmål om matematik (fx 'Hvad hedder…'). Alle poster SKAL indeholde et konkret regnestykke eller en talbaseret opgave, som eleven skal løse.",
        }
      : {
          contentDirective:
            "Brødteksten skal beskrive et matematisk scenarie med konkrete tal, mål, formler eller geometriske figurer. Inkludér altid mindst ét regnestykke, en ligning eller en talrelation i teksten.",
          questionFormat:
            "Spørgsmålet SKAL være en regneopgave eller et matematisk problem med ét korrekt numerisk eller formelbaseret svar. Alle fire svarmuligheder SKAL være tal, mål eller matematiske udtryk — IKKE tekst-svar. Eksempel: '12 cm²', '3/4', '56', '2π'.",
          forbiddenPatterns:
            "Generér ALDRIG spørgsmål som 'Hvad hedder denne form?' eller 'Hvem opfandt…'. Alle poster SKAL have et konkret regnestykke, og svarmulighederne SKAL være numeriske eller formelbaserede.",
        };
  }

  if (key.includes("fysik") || key.includes("kemi") || key.includes("natur")) {
    return raceType === "crossword"
      ? {
          contentDirective:
            "Brødteksten skal beskrive et eksperiment, en fysisk/kemisk proces eller et naturfænomen med rigtige enheder og størrelser (fx Newton, mol, gram, Celsius).",
          questionFormat:
            "answer_word SKAL være en fagterm, en enhed eller et resultat relateret til eksperimentet (fx NEWTON, OXYGEN, CELSIUS). hint skal beskrive den videnskabelige sammenhæng.",
          forbiddenPatterns:
            "Undgå ren trivia. Posterne SKAL involvere konkret videnskabelig ræsonnering, enheder eller eksperimentelle observationer.",
        }
      : {
          contentDirective:
            "Brødteksten skal beskrive et eksperiment, en fysisk/kemisk proces eller et naturfænomen med rigtige enheder og størrelser. Inkludér formler, enheder eller målbare observationer.",
          questionFormat:
            "Spørgsmålet SKAL teste forståelse af formler, enhedsomregninger, årsag-virkning i eksperimenter eller observationer. Svarmulighederne skal indeholde enheder, tal eller præcise fagtermer.",
          forbiddenPatterns:
            "Undgå ren trivia eller 'hvem opdagede…'-spørgsmål. Fokusér på videnskabelig forståelse, beregninger og eksperimentelle resultater.",
        };
  }

  if (key.includes("dansk")) {
    return {
      contentDirective:
        "Brødteksten skal være et litterært uddrag, en læsepassage eller en sproglig tekst med tydelig opbygning og klart sprog.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være et ord relateret til tekstens indhold, sprog eller analyse (fx METAFOR, TEMA, FORTÆLLER). hint skal pege på en sproglig eller indholdsmæssig detalje i teksten."
        : "Spørgsmålet skal teste læseforståelse, ordkendskab, tekstanalyse eller sproglig bevidsthed baseret på brødteksten.",
      forbiddenPatterns:
        "Undgå matematik- eller naturfagsspørgsmål. Hold fokus på læsning, sprog og tekstforståelse.",
    };
  }

  if (key.includes("engelsk")) {
    return {
      contentDirective:
        "Brødteksten skal være på dansk men relatere til engelsk sprogindlæring. Inkludér engelske ord, udtryk eller sætninger, som eleven skal arbejde med.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være et engelsk ord (fx LIBRARY, PRESENT, COULD). hint skal være en dansk beskrivelse eller oversættelsesopgave."
        : "Spørgsmålet skal involvere oversættelse, ordforråd, grammatik eller udfyldningsopgaver mellem dansk og engelsk. Mindst én svarmulighed skal indeholde engelske ord.",
      forbiddenPatterns:
        "Alt indhold skal have en klar sproglig dimension. Undgå rene faktaspørgsmål uden sprogligt element.",
    };
  }

  if (key.includes("historie")) {
    return {
      contentDirective:
        "Brødteksten skal beskrive en historisk begivenhed, periode eller person med konkrete årstal, steder og kontekst.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være et historisk nøgleord (fx REFORM, VIKING, REVOLUTION). hint skal referere til en specifik historisk kontekst."
        : "Spørgsmålet skal teste kronologisk forståelse, årsag-virkning, kildeanalyse eller perspektivering af historiske begivenheder.",
      forbiddenPatterns:
        "Undgå anakronismer. Alle årstal og fakta SKAL være historisk korrekte.",
    };
  }

  if (key.includes("geografi") || key.includes("samfund")) {
    return {
      contentDirective:
        "Brødteksten skal beskrive geografiske, samfundsmæssige eller kulturelle forhold med konkrete data, steder eller statistikker.",
      questionFormat: raceType === "crossword"
        ? "answer_word SKAL være et geografisk eller samfundsfagligt begreb (fx KLIMA, DEMOKRATI, EXPORT). hint skal relatere til konkrete data eller steder."
        : "Spørgsmålet skal teste forståelse af geografiske sammenhænge, samfundsstrukturer eller dataanalyse.",
      forbiddenPatterns:
        "Undgå upræcise eller forældede statistikker. Fokusér på verificerbare fakta.",
    };
  }

  // Default: no extra subject rules
  return {
    contentDirective: "",
    questionFormat: "",
    forbiddenPatterns: "",
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
    if (!process.env.OPENAI_API_KEY) {
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


    const pedagogicalRules = resolveStjerneloebGradeLevelGuidance(gradeLevels);
    const subjectContentRules = resolveSubjectContentRules(subject, raceType);
    const subjectContentBlock = buildSubjectContentBlock(subjectContentRules);
    const subjectLine = subject ? `- Brug faget \"${subject}\" som faglig ramme for alle poster.` : "";
    const imageArtDirection = resolveImageArtDirection(subject);
    const imageDirectionLine =
      `- Alle billedprompts skal følge layout-retningen \"${imageArtDirection.label}\": ${imageArtDirection.promptRule}.`;
    const imagePurposeLine =
      `- Billedprompts skal især fremhæve ${imageArtDirection.emphasis}.`;

    let systemPrompt = "";
    if (raceType === "crossword") {
      systemPrompt = `Du er en dansk lærer, der laver et analogt stjerneløb som krydsordsløb til udendørs undervisning.
Et stjerneløb er en serie af laminerede A4-post-kort, der hænges rundt i skolegården.
Elever vandrer fra post til post, læser teksten, ser på billedet og skal gætte et ord ud fra en ledetråd.

${pedagogicalRules}
${subjectContentBlock}

Vigtige regler:
- Alt indhold skal være på dansk.
- Lav præcis ${count} poster.
- Hver post skal have: en kort overskrift, en læsbar brødtekst (se sætningskrav ovenfor), et billedprompt på ENGELSK til en AI-billedgenerator, et answer_word (et kort, logisk ord uden specialtegn, der relaterer til postens tekst, max 12 tegn, store bogstaver, ingen mellemrum) og et hint (en kort ledetråd til ordet).
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

${pedagogicalRules}
${subjectContentBlock}

Vigtige regler:
- Alt indhold skal være på dansk.
- Lav præcis ${count} poster.
- Hver post skal have: en kort overskrift, en læsbar brødtekst (se sætningskrav ovenfor), et billedprompt på ENGELSK til en AI-billedgenerator, et fagligt spørgsmål og præcis 4 svarmuligheder.
- Kun ét svar er korrekt (correct_index 0-3).
- Brødteksten skal indeholde svaret på spørgsmålet, så elever kan finde det ved at læse.
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

    // Attach Pollinations image URLs
    type ClassicPost = z.infer<typeof postSchemaClassic>;
    type CrosswordPost = z.infer<typeof postSchemaCrossword>;

    const posts = result.posts.map((post, i) => {
      const base = {
        number: i + 1,
        title: post.title,
        body_text: post.body_text,
        image_prompt: post.image_prompt,
        image_url: buildPollinationsUrl(post.image_prompt),
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
