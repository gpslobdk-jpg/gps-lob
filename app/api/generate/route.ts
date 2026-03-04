import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { subject, topic, grade, count, prompt } = await req.json();

    if (!subject || !topic) {
      return NextResponse.json({ error: "Fag og emne mangler" }, { status: 400 });
    }

    const systemPrompt = `Du er en dygtig dansk folkeskolelærer. Din opgave er at generere præcis ${count} multiple-choice spørgsmål til et interaktivt GPS-løb.
    Målgruppe: ${grade}.
    Fag: ${subject}. 
    Emne: ${topic}.
    ${prompt ? `EKSTRA INSTRUKSER FRA LÆREREN: ${prompt}` : ''}
    
    Returner KUN et validt JSON-objekt med en property 'questions', som er et array af objekter. 
    Hvert objekt SKAL have præcis denne struktur:
    {
      "text": "Selve spørgsmålet",
      "answers": ["Svar A", "Svar B", "Svar C", "Svar D"],
      "correctIndex": 0 // Index (0-3) på det rigtige svar
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generer spørgsmålene nu som JSON." }
      ]
    });

    const data = JSON.parse(response.choices[0].message.content || "{}");
    return NextResponse.json(data);
  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ error: "Fejl ved generering" }, { status: 500 });
  }
}
