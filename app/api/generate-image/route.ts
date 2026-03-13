import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { questionText, subject, topic } = await req.json();
    
    if (!questionText || !subject || !topic) {
      return NextResponse.json({ error: "Data mangler" }, { status: 400 });
    }

    // Opret et godt prompt til billedgeneratoren baseret på spørgsmålet
    const imagePrompt = `A pedagogical illustration for a children's quiz game about the subject '${subject}' and topic '${topic}'. The image should visualize the question: "${questionText}". Style: Clean, modern, digital illustration, vibrant colors, slightly playful but educational, no text in the image.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "Intet billede modtaget fra OpenAI" }, { status: 500 });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Image AI Error:", error);
    return NextResponse.json({ error: "Fejl ved generering af billede" }, { status: 500 });
  }
}
