import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

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
  gradeLevel?: unknown;
  count?: unknown;
  raceType?: unknown;
};

const postSchemaClassic = z
  .object({
    title: z.string().trim().min(1),
    body_text: z.string().trim().min(1),
    image_prompt: z.string().trim().min(1),
    question: z.string().trim().min(1).optional(),
    options: z.array(z.string().trim().min(1)).length(4).optional(),
    correct_index: z.number().int().min(0).max(3).optional(),
    hint: z.string().trim().optional(),
    answer_word: z.string().trim().max(12).regex(/^[A-ZÆØÅ0-9]+$/).optional(),
  })
  .strict();

const postSchemaCrossword = z
  .object({
    title: z.string().trim().min(1),
    body_text: z.string().trim().min(1),
    image_prompt: z.string().trim().min(1),
    hint: z.string().trim().min(1),
    answer_word: z.string().trim().max(12).regex(/^[A-ZÆØÅ0-9]+$/),
    question: z.string().trim().optional(),
    options: z.array(z.string().trim().min(1)).length(4).optional(),
    correct_index: z.number().int().min(0).max(3).optional(),
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
    const gradeLevel = asTrimmedString(payload.gradeLevel);

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


    const gradeLine = gradeLevel ? `- Sproglig sværhedsgrad og ordvalg skal passe til ${gradeLevel}.` : "";
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

Vigtige regler:
- Alt indhold skal være på dansk.
- Lav præcis ${count} poster.
- Hver post skal have: en kort overskrift, en læsbar brødtekst (3-5 sætninger der fortæller noget fagligt interessant), et billedprompt på ENGELSK til en AI-billedgenerator, et answer_word (et kort, logisk ord uden specialtegn, der relaterer til postens tekst, max 12 tegn, store bogstaver, ingen mellemrum) og et hint (en kort ledetråd til ordet).
- answer_word skal være på formatet: kun store bogstaver og tal, ingen mellemrum eller specialtegn, max 12 tegn.
- hint skal være en kort, præcis ledetråd til answer_word.
- Må IKKE generere options eller correct_index.
- Billedprompt på engelsk: én enkel prompt på naturligt engelsk, uden citationstegn eller punktform, og den skal passe direkte til posten.
${imageDirectionLine}
${imagePurposeLine}
- Giv løbet en samlet titel.
${subjectLine}
${gradeLine}`;
    } else {
      systemPrompt = `Du er en dansk lærer, der laver et analogt stjerneløb til udendørs undervisning.
Et stjerneløb er en serie af laminerede A4-post-kort, der hænges rundt i skolegården.
Elever vandrer fra post til post, læser teksten, ser på billedet og besvarer spørgsmålet.

Vigtige regler:
- Alt indhold skal være på dansk.
- Lav præcis ${count} poster.
- Hver post skal have: en kort overskrift, en læsbar brødtekst (3-5 sætninger der fortæller noget fagligt interessant), et billedprompt på ENGELSK til en AI-billedgenerator, et fagligt spørgsmål og præcis 4 svarmuligheder.
- Kun ét svar er korrekt (correct_index 0-3).
- Brødteksten skal indeholde svaret på spørgsmålet, så elever kan finde det ved at læse.
- Billedprompt på engelsk: én enkel prompt på naturligt engelsk, uden citationstegn eller punktform, og den skal passe direkte til posten.
${imageDirectionLine}
${imagePurposeLine}
- Giv løbet en samlet titel.
${subjectLine}
${gradeLine}`;
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
    const posts = result.posts.map((post, i) => {
      const base = {
        number: i + 1,
        title: post.title,
        body_text: post.body_text,
        image_prompt: post.image_prompt,
        image_url: buildPollinationsUrl(post.image_prompt),
      };
      if (raceType === "crossword") {
        return {
          ...base,
          hint: post.hint,
          answer_word: post.answer_word,
        };
      } else {
        return {
          ...base,
          question: post.question,
          options: post.options,
          correct_index: post.correct_index,
        };
      }
    });

    const { data: savedRun, error: insertError } = await supabase
      .from("stjerneloeb")
      .insert({
        user_id: user.id,
        title: result.title,
        subject: subject || "Ikke angivet",
        grade_level: gradeLevel || "Ikke angivet",
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
