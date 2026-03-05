import { NextResponse } from "next/server";
import OpenAI from "openai";

type MagicPost = {
  type: "multiple_choice" | "ai_image";
  question: string;
  options?: [string, string, string, string];
  correctAnswer?: string;
  aiPrompt?: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractArrayFromText(content: string): unknown[] | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const container = parsed as Record<string, unknown>;
      if (Array.isArray(container.posts)) return container.posts;
      if (Array.isArray(container.questions)) return container.questions;
      if (Array.isArray(container.items)) return container.items;
    }
  } catch {
    // Fald tilbage til substring-parse nedenfor.
  }

  const firstBracket = content.indexOf("[");
  const lastBracket = content.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    return null;
  }

  const candidate = content.slice(firstBracket, lastBracket + 1);
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeMagicPosts(rawPosts: unknown[]): MagicPost[] {
  const normalized = rawPosts
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      const type = item.type === "ai_image" ? "ai_image" : "multiple_choice";
      const question = typeof item.question === "string" ? item.question.trim() : "";

      if (!question) return null;

      if (type === "ai_image") {
        const aiPrompt = typeof item.aiPrompt === "string" ? item.aiPrompt.trim() : "";
        if (!aiPrompt) return null;
        return {
          type,
          question,
          aiPrompt,
        } satisfies MagicPost;
      }

      const options = Array.isArray(item.options)
        ? item.options.slice(0, 4).map((option) => (typeof option === "string" ? option.trim() : ""))
        : [];
      while (options.length < 4) options.push("");
      if (options.some((option) => !option)) return null;

      const correctAnswer =
        typeof item.correctAnswer === "string" && item.correctAnswer.trim().length > 0
          ? item.correctAnswer.trim()
          : options[0];

      return {
        type,
        question,
        options: [options[0], options[1], options[2], options[3]],
        correctAnswer,
      } satisfies MagicPost;
    })
    .filter((post): post is NonNullable<typeof post> => post !== null);

  return normalized.slice(0, 6);
}

export async function POST(req: Request) {
  try {
    const { prompt } = (await req.json()) as { prompt?: string };
    const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";

    if (!trimmedPrompt) {
      return NextResponse.json({ error: "Prompt mangler." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY mangler i milj\u00f8et." }, { status: 500 });
    }

    const systemPrompt = `Du er en ekspert i at designe sjove, udend\u00f8rs GPS-l\u00f8b og skattejagter.
Brugeren giver dig et tema. Du SKAL returnere pr\u00e6cis 6 poster.
Svar UDELUKKENDE i valid JSON-format, som et array af objekter.
Strukturen for et objekt skal v\u00e6re:
{
  "type": "multiple_choice" eller "ai_image",
  "question": "Overskrift/Sp\u00f8rgsm\u00e5let til deltageren",
  "options": ["Svar 1", "Svar 2", "Svar 3", "Svar 4"] (KUN hvis typen er multiple_choice, ellers udelad),
  "correctAnswer": "Det korrekte svar" (KUN hvis typen er multiple_choice, ellers udelad),
  "aiPrompt": "Instruks til fotodommeren, f.eks. 'Find et egetr\u00e6'" (KUN hvis typen er ai_image, ellers udelad)
}
G\u00f8r 2 af posterne til 'ai_image' og 4 til 'multiple_choice'.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Tema: ${trimmedPrompt}` },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const rawArray = extractArrayFromText(content);

    if (!rawArray) {
      return NextResponse.json({ error: "AI returnerede ugyldigt JSON-format." }, { status: 502 });
    }

    const posts = normalizeMagicPosts(rawArray);
    if (posts.length !== 6) {
      return NextResponse.json(
        { error: "AI returnerede ikke pr\u00e6cis 6 gyldige poster. Pr\u00f8v igen." },
        { status: 502 }
      );
    }

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Magi API-fejl:", error);
    return NextResponse.json({ error: "Kunne ikke generere l\u00f8bet lige nu." }, { status: 500 });
  }
}
