import type { GradeBand } from "./subjectProfiles";

export type AnnualPlanAiInput = {
  subject: string;
  grade: string;
  gradeBand: GradeBand;
  schoolYear: string;
  municipality: string;
  lessonsPerWeek: number;
  courseCount: number;
  wishes: string;
  commonGoalsIntro: string;
  holidaySummary: string[];
  structuralCourses: {
    id: string;
    periodLabel: string;
    teachingWeeks: number;
    estimatedLessons: number;
    suggestedTitle: string;
    focusArea: string;
  }[];
};

export type AnnualPlanAiOutput = {
  courses: {
    id: string;
    improvedTitle?: string;
    commonGoalsFocus?: string;
    contentAndActivities?: string;
    evaluation?: string;
    imageIdea?: string;
  }[];
  teacherNote?: string;
};

/**
 * Lokal, deterministisk mock der simulerer de tekster AI senere kan levere.
 * Må ikke ændre struktur (uger, perioder, antal forløb etc.).
 */
export function createMockAiAnnualPlanEnhancement(input: AnnualPlanAiInput): AnnualPlanAiOutput {
  const courses = input.structuralCourses.map((c) => {
    const baseTitle = c.suggestedTitle;
    const improvedTitle = `${baseTitle} — et undersøgende forløb`;
    const commonGoalsFocus = `Eleverne arbejder med ${c.focusArea}. Forløbet lægger vægt på undersøgende, mundtlige og skriftlige aktiviteter, så eleverne kan anvende faglige begreber og forklare sammenhænge.`;
    const contentAndActivities = `Forløbet kombinerer fælles introduktion, makkerarbejde, undersøgelser, praktiske opgaver og en afsluttende opsamling. Aktivitetseksempler: ${input.wishes || "klasseøvelser, diskussion og projektarbejde"}.`;
    const evaluation = `Elevernes udbytte vurderes gennem korte præsentationer, refleksionsopgaver eller lærerobservationer.`;
    const imageIdea = `Illustration af elever i arbejde med temaet \"${baseTitle}\", roligt skolemiljø, faglige materialer og plads til titeltekst.`;

    return {
      id: c.id,
      improvedTitle,
      commonGoalsFocus,
      contentAndActivities,
      evaluation,
      imageIdea,
    };
  });

  const teacherNote =
    "Denne AI-forbedring er en lokal demo. I den færdige version kan AI hjælpe med at formulere mål, aktiviteter og evaluering. Strukturen med skoleår, ferieuger og perioder fastholdes altid af årsplanmotoren.";

  return { courses, teacherNote };
}
