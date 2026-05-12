import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Image model can be configured via env; default to a safer current model
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

function buildPollinationsUrl(prompt: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true`;
}

export async function POST(req: Request) {
  const requestPath = new URL(req.url).pathname;

  try {
    const { questionText, subject, topic } = await req.json();
    if (!questionText || !subject || !topic) {
      return NextResponse.json({ error: "Data mangler" }, { status: 400 });
    }

    const imagePrompt = `A pedagogical illustration for a children's quiz game about the subject '${subject}' and topic '${topic}'. The image should visualize the question: "${questionText}". Style: Clean, modern, digital illustration, vibrant colors, slightly playful but educational, no text in the image.`;

    try {
      const response = await openai.images.generate({
        model: IMAGE_MODEL,
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      const data0 = response.data?.[0];
      let imageUrl = data0?.url ?? (data0?.b64_json ? `data:image/png;base64,${data0.b64_json}` : undefined);

      if (imageUrl) {
        return NextResponse.json({ imageUrl });
      }

      // No usable URL returned — fall through to Pollinations fallback
      console.warn('OpenAI image response missing url/b64_json, falling back to Pollinations');
    } catch (err) {
      console.warn('OpenAI image generation failed, falling back to Pollinations:', err instanceof Error ? err.message : err);
    }

    // Fallback to Pollinations if OpenAI image generation fails
    const fallbackUrl = buildPollinationsUrl(imagePrompt);
    return NextResponse.json({ imageUrl: fallbackUrl });
  } catch (error) {
    console.error("Image AI Error:", error);
    await logHandledServerError({
      route: "/api/generate-image",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json({ error: "Fejl ved generering af billede" }, { status: 500 });
  }
}
