import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";

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
};

const postSchema = z
  .object({
    title: z.string().trim().min(1),
    body_text: z.string().trim().min(1),
    image_prompt: z.string().trim().min(1),
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    correct_index: z.number().int().min(0).max(3),
  })
  .strict();

function createSchema(count: number) {
  return z
    .object({
      title: z.string().trim().min(1),
      posts: z.array(postSchema).length(count),
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

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
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
    const subjectLine = subject ? `- Brug faget "${subject}" som faglig ramme for alle poster.` : "";

    const systemPrompt = `Du er en dansk lærer, der laver et analogt stjerneløb til udendørs undervisning.
Et stjerneløb er en serie af laminerede A4-post-kort, der hænges rundt i skolegården.
Elever vandrer fra post til post, læser teksten, ser på billedet og besvarer spørgsmålet.

Vigtige regler:
- Alt indhold skal være på dansk.
- Lav præcis ${count} poster.
- Hver post skal have: en kort overskrift, en læsbar brødtekst (3-5 sætninger der fortæller noget fagligt interessant), et billedprompt på ENGELSK til en AI-billedgenerator, et fagligt spørgsmål og præcis 4 svarmuligheder.
- Kun ét svar er korrekt (correct_index 0-3).
- Brødteksten skal indeholde svaret på spørgsmålet, så elever kan finde det ved at læse.
- Billedprompt på engelsk: enkelt beskrivende, illustrativt, passer til posten.
- Giv løbet en samlet titel.
${subjectLine}
${gradeLine}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    let result: z.infer<ReturnType<typeof createSchema>>;
    try {
      const schema = createSchema(count);
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
    const posts = result.posts.map((post, i) => ({
      number: i + 1,
      title: post.title,
      body_text: post.body_text,
      image_prompt: post.image_prompt,
      image_url: buildPollinationsUrl(post.image_prompt),
      question: post.question,
      options: post.options,
      correct_index: post.correct_index,
    }));

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
      return NextResponse.json(
        { error: "Kunne ikke gemme stjerneløbet i databasen." },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: savedRun.id });
  } catch (err) {
    console.error("Uventet fejl i /api/stjerneloeb-generate:", err);
    return NextResponse.json(
      { error: "Der skete en uventet fejl. Prøv igen." },
      { status: 500 }
    );
  }
}
