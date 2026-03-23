import { generateObject, jsonSchema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";

import type { Post } from "@/components/play/types";

export const maxDuration = 300;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_UNLOCK_RANGE = 15;
const DEFAULT_POST_COUNT = 6;
const MIN_POST_COUNT = 3;
const MAX_POST_COUNT = 10;

type MagicPost = Omit<Post, "type"> & {
  type: "multiple_choice";
};

type RawMagicPost = Partial<Omit<Post, "type" | "options" | "answer" | "mission">> & {
  type?: string | null;
  question?: string | null;
  options?: string[] | null;
  answer?: string | null;
  mission?: string | null;
};

function getRequestedPostCount(prompt: string) {
  const match = prompt.match(/\b([3-9]|10)\b/);
  if (!match) return DEFAULT_POST_COUNT;

  const count = Number(match[1]);
  if (!Number.isInteger(count)) return DEFAULT_POST_COUNT;

  return Math.max(MIN_POST_COUNT, Math.min(MAX_POST_COUNT, count));
}

const magicPostSchema = jsonSchema<RawMagicPost>({
  type: "object",
  additionalProperties: false,
  properties: {
    id: {
      type: "integer",
      minimum: 1,
    },
    type: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    lat: {
      type: "number",
    },
    lng: {
      type: "number",
    },
    question: {
      type: "string",
    },
    options: {
      type: "array",
      items: {
        type: "string",
      },
    },
    answer: {
      type: "string",
    },
    mission: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    unlockRange: {
      type: "integer",
      minimum: 5,
      maximum: 100,
    },
  },
});

function getTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFallbackOption(index: number, existingOptions: string[]) {
  const labels = ["Mulighed A", "Mulighed B", "Mulighed C", "Mulighed D", "Mulighed E"];
  const preferredLabel = labels[index] ?? `Mulighed ${index + 1}`;

  if (!existingOptions.includes(preferredLabel)) {
    return preferredLabel;
  }

  let suffix = index + 1;

  while (existingOptions.includes(`Mulighed ${suffix}`)) {
    suffix += 1;
  }

  return `Mulighed ${suffix}`;
}

function normalizeOptions(options: unknown, answer: string) {
  const rawOptions = Array.isArray(options) ? options : [];
  const dedupedOptions: string[] = [];

  const pushIfValid = (value: unknown) => {
    const trimmedValue = getTrimmedString(value);
    if (!trimmedValue || dedupedOptions.includes(trimmedValue)) {
      return;
    }

    dedupedOptions.push(trimmedValue);
  };

  pushIfValid(answer);

  rawOptions.forEach((option) => {
    pushIfValid(option);
  });

  while (dedupedOptions.length < 4) {
    dedupedOptions.push(getFallbackOption(dedupedOptions.length, dedupedOptions));
  }

  return dedupedOptions.slice(0, 4) as [string, string, string, string];
}

function normalizeUnlockRange(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_UNLOCK_RANGE;
  }

  return Math.max(5, Math.min(100, Math.round(value)));
}

function normalizeMagicPosts(posts: RawMagicPost[]): MagicPost[] {
  return posts.map((post, index) => {
    const question = getTrimmedString(post.question) || `Spørgsmål ${index + 1}`;
    const answer = getTrimmedString(post.answer);
    const normalizedOptions = normalizeOptions(post.options, answer);

    const validAnswer =
      answer && normalizedOptions.includes(answer)
        ? answer
        : normalizedOptions[0] ?? "";

    return {
      id: index + 1,
      type: "multiple_choice",
      lat: 0,
      lng: 0,
      question,
      options: normalizedOptions,
      answer: validAnswer,
      mission: "",
      unlockRange: normalizeUnlockRange(post.unlockRange),
    };
  });
}

export async function POST(req: Request) {
  try {
    const { prompt } = (await req.json()) as { prompt?: string };
    const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";

    if (!trimmedPrompt) {
      return NextResponse.json({ error: "Prompt mangler." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY mangler i miljoet." }, { status: 500 });
    }

    const requestedPostCount = getRequestedPostCount(trimmedPrompt);

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      output: "array",
      schema: magicPostSchema,
      schemaName: "GpsRunPost",
      schemaDescription:
        "En klassisk multiple-choice GPS-post til laereren med dummy-koordinater og unlock-radius.",
      system: `Du er en kreativ paedagogisk assistent, der designer sjove, laererige og varierede multiple-choice GPS-poster til undervisning.

Du SKAL returnere praecis ${requestedPostCount} poster.
DU SKAL GENERERE PRAECIS ${requestedPostCount} POSTER. DETTE ER ET ABSOLUT KRAV.
Svar kun med strukturerede objekter, der matcher schemaet.

Regler:
- Lav poster, der passer direkte til brugerens emne.
- Goer dem aldersvenlige, konkrete og nemme at placere i et fysisk GPS-loeb.
- Brug baade variation, energi og paedagogisk klarhed.
- Saet ALTID lat til 0 og lng til 0, fordi laereren selv placerer posterne bagefter.
- Saet ALTID unlockRange til ${DEFAULT_UNLOCK_RANGE}.
- Brug ids som fortloebende heltal fra 1.
- HVER ENESTE post SKAL have type "multiple_choice".
- Det er FORBUDT at returnere foto-missioner, ai_image-poster eller andre posttyper.
- question er selve spoergsmaalet, som eleven ser.
- options skal vaere praecis 4 forskellige svarmuligheder.
- answer skal vaere praecis en af de 4 svarmuligheder.
- mission skal altid vaere en tom streng.

Undgaa meta-kommentarer, forklaringer og markdown.`,
      prompt: `Emne til GPS-loeb: ${trimmedPrompt}`,
      temperature: 0.8,
      providerOptions: {
        openai: {
          strictJsonSchema: true,
        },
      },
    });

    if (!Array.isArray(object) || object.length === 0) {
      return NextResponse.json(
        { error: "AI returnerede ingen gyldige poster." },
        { status: 502 }
      );
    }

    if (object.length !== requestedPostCount) {
      console.warn("Magi API: AI returnerede et andet antal poster end oensket.", {
        requestedPostCount,
        returnedPostCount: object.length,
      });
    }

    const normalizedPosts = normalizeMagicPosts(object).slice(0, requestedPostCount);

    if (normalizedPosts.length === 0) {
      return NextResponse.json(
        { error: "AI returnerede ingen gyldige poster." },
        { status: 502 }
      );
    }

    return NextResponse.json(normalizedPosts);
  } catch (error) {
    console.error("Magi API-fejl:", error);
    return NextResponse.json({ error: "Kunne ikke generere loebet lige nu." }, { status: 500 });
  }
}
