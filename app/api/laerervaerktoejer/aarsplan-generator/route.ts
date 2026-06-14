import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import { createMockAiAnnualPlanEnhancement, type AnnualPlanAiInput } from "../../../dashboard/laerervaerktoejer/aarsplan-generator/annualPlanAiMock";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_TIMEOUT_MS = 45_000;

const StructuralCourseSchema = z.object({
  id: z.string().min(1),
  periodLabel: z.string().min(1),
  teachingWeeks: z.number().int().min(0),
  estimatedLessons: z.number().int().min(0),
  suggestedTitle: z.string().min(1),
  focusArea: z.string().min(1),
});

const AiInputSchema = z
  .object({
    subject: z.string().min(1),
    grade: z.string().min(1),
    gradeBand: z.union([z.literal("indskoling"), z.literal("mellemtrin"), z.literal("udskoling")]),
    schoolYear: z.string().min(1),
    municipality: z.string().min(1),
    lessonsPerWeek: z.number().int().min(0),
    courseCount: z.number().int().min(0),
    wishes: z.string(),
    commonGoalsIntro: z.string(),
    holidaySummary: z.array(z.string()),
    structuralCourses: z.array(StructuralCourseSchema),
  })
  .strict();

const AiCourseOutSchema = z
  .object({
    id: z.string().min(1),
    improvedTitle: z.string().min(1),
    commonGoalsFocus: z.string().min(1),
    contentAndActivities: z.string().min(1),
    evaluation: z.string().min(1),
  })
  .strict();

const AiOutputSchema = z
  .object({
    courses: z.array(AiCourseOutSchema),
    teacherNote: z.string().min(1),
  })
  .strict();

function buildSystemPrompt(): string {
  return [
    "Du er en dansk lærerassistent.\nDu hjælper med at formulere årsplanindhold til lærere.",
    "Regler:",
    "- Du må kun forbedre tekstfelter (titel, målformulering, Fælles Mål-fokus, aktiviteter og evaluering).",
    "- Du må IKKE ændre course-id'er, perioder, uger, lektionstal, antallet af forløb eller rækkefølge.",
    "- Returnér KUN gyldig JSON i det præcise format beskrevet i prompten.",
    "- Skriv på dansk, konkret og lærerrettet.",
  ].join("\n");
}

function buildUserPrompt(input: z.infer<typeof AiInputSchema>) {
  const courseList = input.structuralCourses
    .map((c) => `- ${c.id}: ${c.suggestedTitle} (${c.periodLabel}, ${c.teachingWeeks} uger, ${c.estimatedLessons} lektioner)`)
    .join("\n");

  return [
    `Fag: ${input.subject}`,
    `Klassetrin: ${input.grade}`,
    `Fælles Mål-intro: ${input.commonGoalsIntro || ""}`,
    `Skoleår: ${input.schoolYear}`,
    `Kommune: ${input.municipality}`,
    `Lektioner pr uge: ${input.lessonsPerWeek}`,
    `Antal forløb: ${input.courseCount}`,
    `Forløb (struktur):`,
    courseList,
    input.wishes ? `Lærerens ønske: ${input.wishes}` : "",
    "Krav til output: Returnér et JSON-objekt med præcis samme antal 'courses' som input. Hvert course skal have samme 'id' som input. Felter: improvedTitle, commonGoalsFocus, contentAndActivities, evaluation.",
    "Returnér kun JSON. Ingen ekstra forklaringer.",
  ].filter(Boolean).join("\n\n");
}

async function fallbackWithMock(input: AnnualPlanAiInput) {
  return createMockAiAnnualPlanEnhancement(input);
}

export async function POST(req: Request) {
  const requestPath = new URL(req.url).pathname;

  try {
    const raw = await req.json();

    const parsed = AiInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ugyldigt input" }, { status: 400 });
    }

    const input = parsed.data as AnnualPlanAiInput;

    if (!process.env.OPENAI_API_KEY) {
      // No key: return local mock with marking
      const out = await fallbackWithMock(input);
      return NextResponse.json(out);
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(parsed.data);

    const schema = AiOutputSchema;

    try {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema,
        schemaName: "AnnualPlanAiOutput",
        schemaDescription: "Tekstforbedringer til årsplanforløb.",
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.2,
        timeout: OPENAI_TIMEOUT_MS,
        providerOptions: {
          openai: { strictJsonSchema: true },
        },
      });

      // Validate structure vs input ids
      const out = object as z.infer<typeof AiOutputSchema>;
      const inputIds = parsed.data.structuralCourses.map((c) => c.id);
      const outIds = out.courses.map((c) => c.id);

      const idsMatch = inputIds.length === outIds.length && inputIds.every((id, idx) => id === outIds[idx]);

      if (!idsMatch) {
        // fallback
        return NextResponse.json(await fallbackWithMock(input));
      }

      // Additional sanity: no empty fields
      const hasEmpty = out.courses.some((c) => !c.improvedTitle.trim() || !c.contentAndActivities.trim());
      if (hasEmpty) {
        return NextResponse.json(await fallbackWithMock(input));
      }

      return NextResponse.json(out);
    } catch (aiError) {
      console.error("annual plan text route error:", aiError);
      await logHandledServerError({
        requestPath,
        route: requestPath,
        method: "POST",
        context: "annual_plan_ai_error",
        status: 500,
        error: aiError,
      });

      return NextResponse.json(await fallbackWithMock(parsed.data));
    }
  } catch (error) {
    console.error("annual plan ai route unexpected error:", error);
    return NextResponse.json({ error: "Uventet serverfejl" }, { status: 500 });
  }
}
