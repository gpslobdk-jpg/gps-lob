import { generateObject, jsonSchema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";

import type { Post } from "@/components/play/types";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_UNLOCK_RANGE = 15;
const DEFAULT_POST_COUNT = 6;
const MIN_POST_COUNT = 3;
const MAX_POST_COUNT = 10;

function getRequestedPostCount(prompt: string) {
  const match = prompt.match(/\b([3-9]|10)\b/);
  if (!match) return DEFAULT_POST_COUNT;

  const count = Number(match[1]);
  if (!Number.isInteger(count)) return DEFAULT_POST_COUNT;

  return Math.max(MIN_POST_COUNT, Math.min(MAX_POST_COUNT, count));
}

const magicPostSchema = jsonSchema<Post>({
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "type",
    "lat",
    "lng",
    "question",
    "options",
    "answer",
    "mission",
    "unlockRange",
  ],
  properties: {
    id: {
      type: "integer",
      minimum: 1,
    },
    type: {
      type: "string",
      enum: ["multiple_choice", "ai_image"],
    },
    lat: {
      type: "number",
    },
    lng: {
      type: "number",
    },
    question: {
      type: "string",
      minLength: 8,
    },
    options: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "string",
      },
    },
    answer: {
      type: "string",
    },
    mission: {
      type: "string",
    },
    unlockRange: {
      type: "integer",
      minimum: 5,
      maximum: 100,
    },
  },
});

function normalizeMagicPosts(posts: Post[]): Post[] {
  return posts.map((post, index) => {
    const question = post.question.trim();
    const mission = post.mission.trim();
    const normalizedOptions = [...post.options]
      .slice(0, 4)
      .map((option) => option.trim()) as [string, string, string, string];

    if (post.type === "ai_image") {
      return {
        id: index + 1,
        type: "ai_image",
        lat: 0,
        lng: 0,
        question,
        options: ["", "", "", ""],
        answer: "",
        mission,
        unlockRange: DEFAULT_UNLOCK_RANGE,
      };
    }

    const validAnswer =
      post.answer.trim() && normalizedOptions.includes(post.answer.trim())
        ? post.answer.trim()
        : normalizedOptions[0] ?? "";

    return {
      id: index + 1,
      type: "multiple_choice",
      lat: 0,
      lng: 0,
      question,
      options: normalizedOptions,
      answer: validAnswer,
      mission: mission || "",
      unlockRange: DEFAULT_UNLOCK_RANGE,
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
      return NextResponse.json({ error: "OPENAI_API_KEY mangler i miljøet." }, { status: 500 });
    }

    const requestedPostCount = getRequestedPostCount(trimmedPrompt);

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      output: "array",
      schema: magicPostSchema,
      schemaName: "GpsRunPost",
      schemaDescription:
        "En GPS-post til læreren med dummy-koordinater, unlock-radius og enten quizdata eller foto-mission.",
      system: `Du er en Kreativ Pædagogisk Assistent, der designer sjove, lærerige og varierede GPS-poster til undervisning.

Du SKAL returnere præcis ${requestedPostCount} poster.
DU SKAL GENERERE PRÆCIS ${requestedPostCount} POSTER. DETTE ER ET ABSOLUT KRAV.
Svar kun med strukturerede objekter, der matcher schemaet.

Regler:
- Lav poster, der passer direkte til brugerens emne.
- Gør dem aldersvenlige, konkrete og nemme at placere i et fysisk GPS-løb.
- Brug både variation, energi og pædagogisk klarhed.
- Sæt ALTID lat til 0 og lng til 0, fordi læreren selv placerer posterne bagefter.
- Sæt ALTID unlockRange til ${DEFAULT_UNLOCK_RANGE}.
- Brug ids som fortløbende heltal fra 1.
- Lav som udgangspunkt cirka 2 foto-missioner, hvis emnet passer til det. Resten skal være quiz-poster.

For "multiple_choice":
- question er selve spørgsmålet, som eleven ser.
- options skal være præcis 4 svarmuligheder.
- answer skal være præcis én af de 4 svarmuligheder.
- mission skal være en tom streng.

For "ai_image":
- question er den elevrettede instruktion.
- mission er den korte, konkrete ting eller handling, billedanalysen skal lede efter.
- options skal være ["", "", "", ""].
- answer skal være en tom streng.

Undgå meta-kommentarer, forklaringer og markdown.`,
      prompt: `Emne til GPS-løb: ${trimmedPrompt}`,
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
      console.warn("Magi API: AI returnerede et andet antal poster end ønsket.", {
        requestedPostCount,
        returnedPostCount: object.length,
      });
    }

    // Accepter færre poster end ønsket, men trim overskydende poster væk.
    return NextResponse.json(
      normalizeMagicPosts(object).slice(0, requestedPostCount)
    );
  } catch (error) {
    console.error("Magi API-fejl:", error);
    return NextResponse.json({ error: "Kunne ikke generere løbet lige nu." }, { status: 500 });
  }
}
