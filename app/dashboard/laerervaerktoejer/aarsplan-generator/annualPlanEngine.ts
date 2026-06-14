import {
  fallbackProfile,
  subjectProfiles,
  type GradeBand,
  type SubjectProfile,
} from "./subjectProfiles";
import { GENERIC_HOLIDAY_PLAN_LABEL } from "./municipalities";

export type { GradeBand, SubjectProfile };

export type AnnualPlanEngineInput = {
  subject: string;
  grade: string;
  schoolYear: string;
  municipality: string;
  lessonsPerWeek: number;
  courseCount: number;
  wishes: string;
  notes?: string;
};

export type HolidayWeek = {
  name: string;
  weeks: number[];
  label: string;
  type: "holiday" | "note";
  note?: string;
};

export type TeachingWeek = {
  week: number;
  label: string;
  order: number;
};

export type AnnualPlanCourse = {
  period: string;
  teachingWeeks: number;
  estimatedLessons: number;
  title: string;
  description: string;
  focus: string;
  activities: string;
  product: string;
  imagePrompt: string;
  pauseNote?: string;
};

// Structural course shape used as input to the mock-AI enhancer
export type StructuralCourse = {
  id: string;
  periodLabel: string;
  teachingWeeks: number;
  estimatedLessons: number;
  suggestedTitle: string;
  focusArea: string;
};

export type AnnualPlanDraft = {
  title: string;
  subject: string;
  grade: string;
  gradeBand: GradeBand;
  gradeBandLabel: string;
  profileName: string;
  schoolYear: string;
  municipality: string;
  teachingWeeks: number;
  holidayWeeks: HolidayWeek[];
  commonGoalsIntro: string;
  courses: AnnualPlanCourse[];
  summary: {
    totalLessons: number;
    courseCount: number;
    weeksUsed: number;
    teacherNote?: string;
  };
};

export type AnnualPlanAiOverlayStatus = string[];

export const subjects = [
  "Dansk",
  "Matematik",
  "Engelsk",
  "Tysk",
  "Historie",
  "Samfundsfag",
  "Kristendomskundskab",
  "Geografi",
  "Biologi",
  "Fysik/kemi",
  "Natur/teknologi",
  "Idræt",
  "Musik",
  "Billedkunst",
  "Håndværk og design",
  "Madkundskab",
  "Valgfag",
] as const;

export const gradeLevels = [
  "0. klasse",
  "1. klasse",
  "2. klasse",
  "3. klasse",
  "4. klasse",
  "5. klasse",
  "6. klasse",
  "7. klasse",
  "8. klasse",
  "9. klasse",
] as const;

export const schoolYears = ["2026/2027", "2027/2028"] as const;

export const lessonsPerWeekOptions = ["1", "2", "3", "4", "5"] as const;
export const courseCountOptions = ["4", "5", "6", "7", "8"] as const;

const gradeBandLabels: Record<GradeBand, string> = {
  indskoling: "Indskoling",
  mellemtrin: "Mellemtrin",
  udskoling: "Udskoling",
};

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function formatWeekLabel(weeks: number[]) {
  if (weeks.length === 1) {
    return `uge ${weeks[0]}`;
  }

  return `uge ${weeks.slice(0, -1).join(", ")} og ${weeks[weeks.length - 1]}`;
}

function parseGradeLevel(grade: string) {
  const gradeMatch = grade.match(/\d+/);
  return gradeMatch ? Number(gradeMatch[0]) : 7;
}

export function getGradeBand(grade: string): GradeBand {
  const gradeNumber = parseGradeLevel(grade);

  if (gradeNumber <= 3) {
    return "indskoling";
  }

  if (gradeNumber <= 6) {
    return "mellemtrin";
  }

  return "udskoling";
}

export function getGradeBandLabel(grade: string) {
  return gradeBandLabels[getGradeBand(grade)];
}

function getWinterHolidayWeek(schoolYear: string, municipality: string) {
  const winterWeeks: Record<string, Record<string, number>> = {
    "2026/2027": {
      "Faxe Kommune": 7,
      "Vordingborg Kommune": 8,
      "Københavns Kommune": 7,
      [GENERIC_HOLIDAY_PLAN_LABEL]: 7,
    },
    "2027/2028": {
      "Faxe Kommune": 8,
      "Vordingborg Kommune": 7,
      "Københavns Kommune": 7,
      [GENERIC_HOLIDAY_PLAN_LABEL]: 8,
    },
  };

  return winterWeeks[schoolYear]?.[municipality] ?? winterWeeks[schoolYear]?.[GENERIC_HOLIDAY_PLAN_LABEL] ?? 7;
}

function getEasterWeeks(schoolYear: string) {
  return schoolYear === "2027/2028" ? [15, 16] : [14, 15];
}

function getSpringBreakNoteWeek(schoolYear: string) {
  return schoolYear === "2027/2028" ? 21 : 20;
}

export function getHolidayWeeks(schoolYear: string, municipality: string): HolidayWeek[] {
  const winterWeek = getWinterHolidayWeek(schoolYear, municipality);
  const easterWeeks = getEasterWeeks(schoolYear);
  const springNoteWeek = getSpringBreakNoteWeek(schoolYear);

  return [
    {
      name: "Efterårsferie",
      weeks: [42],
      label: "uge 42",
      type: "holiday",
    },
    {
      name: "Juleferie",
      weeks: [52, 1],
      label: "uge 52 og 1",
      type: "holiday",
    },
    {
      name: "Vinterferie",
      weeks: [winterWeek],
      label: `uge ${winterWeek}`,
      type: "holiday",
    },
    {
      name: "Påskeferie",
      weeks: easterWeeks,
      label: formatWeekLabel(easterWeeks),
      type: "holiday",
    },
    {
      name: "Kristi himmelfart / korte forårsbrud",
      weeks: [springNoteWeek],
      label: `uge ${springNoteWeek}`,
      type: "note",
      note: "Markeret som prototype-note og ikke behandlet som en hel ferieuge.",
    },
  ];
}

function getSchoolYearWeeks() {
  return [...range(33, 52), ...range(1, 26)].map((week, order) => ({
    week,
    label: `Uge ${week}`,
    order,
  }));
}

export function buildTeachingWeeks(schoolYear: string, municipality: string): TeachingWeek[] {
  const holidayWeeks = getHolidayWeeks(schoolYear, municipality);
  const excludedWeeks = new Set(
    holidayWeeks.flatMap((holiday) => (holiday.type === "holiday" ? holiday.weeks : [])),
  );

  return getSchoolYearWeeks().filter((week) => !excludedWeeks.has(week.week));
}

export function getSubjectProfile(subject: string) {
  return subjectProfiles[subject] ?? fallbackProfile;
}

export function hasDedicatedSubjectProfile(subject: string) {
  return Boolean(subjectProfiles[subject]);
}

export function getCommonGoalsIntro(subject: string) {
  return getSubjectProfile(subject).commonGoalsIntro;
}

function getCourseIdeasForBand(profile: SubjectProfile, gradeBand: GradeBand) {
  return profile.courseIdeasByBand?.[gradeBand]?.length
    ? profile.courseIdeasByBand[gradeBand]
    : profile.courseIdeas;
}

function splitTeachingWeeks(teachingWeeks: TeachingWeek[], courseCount: number) {
  const count = Math.max(1, Math.min(courseCount, teachingWeeks.length));
  const baseSize = Math.floor(teachingWeeks.length / count);
  const remainder = teachingWeeks.length % count;
  let cursor = 0;

  return Array.from({ length: count }, (_, index) => {
    const size = baseSize + (index < remainder ? 1 : 0);
    const group = teachingWeeks.slice(cursor, cursor + size);
    cursor += size;
    return group;
  });
}

function createPeriodLabel(weeks: TeachingWeek[]) {
  const firstWeek = weeks[0]?.week;
  const lastWeek = weeks[weeks.length - 1]?.week;

  if (!firstWeek || !lastWeek) {
    return "Ingen undervisningsuger";
  }

  if (firstWeek === lastWeek) {
    return `Uge ${firstWeek}`;
  }

  return `Uge ${firstWeek}-${lastWeek}`;
}

function createPauseNote(weeks: TeachingWeek[], holidayWeeks: HolidayWeek[]) {
  const firstOrder = weeks[0]?.order;
  const lastOrder = weeks[weeks.length - 1]?.order;

  if (firstOrder === undefined || lastOrder === undefined) {
    return undefined;
  }

  const schoolWeekOrder = new Map(getSchoolYearWeeks().map((week) => [week.week, week.order]));
  const crossedPauses = holidayWeeks.filter((holiday) =>
    holiday.weeks.some((week) => {
      const order = schoolWeekOrder.get(week);
      return order !== undefined && order > firstOrder && order < lastOrder;
    }),
  );

  if (crossedPauses.length === 0) {
    return undefined;
  }

  return `Forløbet ligger hen over ${crossedPauses
    .map((holiday) => `${holiday.name.toLowerCase()} (${holiday.label})`)
    .join(", ")}.`;
}

function pickProfileValue(values: string[], index: number) {
  return values[index % values.length];
}

function getSubjectDescriptionFrame(subject: string) {
  if (subject === "Historie") {
    return "Eleverne undersøger emnet gennem kilder, fortællinger og historiske problemstillinger. Der arbejdes med sammenhænge mellem fortid, nutid og elevernes egen forståelse af historie.";
  }

  if (subject === "Matematik") {
    return "Eleverne arbejder undersøgende med begreber, strategier og problemløsning. Forløbet kombinerer fælles gennemgange, praktiske opgaver og selvstændig træning.";
  }

  if (subject === "Dansk") {
    return "Eleverne læser, undersøger og producerer tekster med tydelige faglige stilladser. Forløbet veksler mellem fælles modellering, samtale, respons og selvstændig fremstilling.";
  }

  if (subject === "Engelsk" || subject === "Tysk") {
    return "Eleverne opbygger ordforråd og sproglig sikkerhed gennem korte tekster, samtaler og stilladserede produktioner. Der lægges vægt på tryg mundtlighed og kulturmøder.";
  }

  if (subject === "Samfundsfag") {
    return "Eleverne arbejder med aktuelle eksempler, faglige begreber og begrundede holdninger. Forløbet kobler casearbejde, debat og korte undersøgelser.";
  }

  if (["Biologi", "Fysik/kemi", "Natur/teknologi", "Geografi"].includes(subject)) {
    return "Eleverne arbejder naturfagligt med observationer, forsøg, modeller og konkrete data. Forløbet kobler undersøgende arbejde med faglige forklaringer og hverdagseksempler.";
  }

  if (["Idræt", "Musik", "Billedkunst", "Håndværk og design", "Madkundskab"].includes(subject)) {
    return "Eleverne arbejder praktisk og skabende med fagets metoder, materialer og udtryk. Forløbet veksler mellem afprøvning, feedback og faglig refleksion.";
  }

  if (subject === "Kristendomskundskab") {
    return "Eleverne undersøger livsspørgsmål, fortællinger og etiske perspektiver gennem samtale, begrebsarbejde og respektfuld stillingtagen.";
  }

  return "Eleverne arbejder med centrale begreber, små undersøgelser og konkrete eksempler, så de kan forbinde fagets indhold med deres egen hverdag.";
}

export function createCourseDescription(subject: string, gradeBand: GradeBand, courseTitle: string, grade: string) {
  const bandPhrase: Record<GradeBand, string> = {
    indskoling: "Aktiviteterne er konkrete, korte og fælles, så eleverne kan bygge fagligt sprog i trygge rammer.",
    mellemtrin: "Eleverne får flere faglige valg og arbejder med tydelige modeller, makkerdialog og korte produkter.",
    udskoling:
      "Eleverne arbejder mere analytisk og selvstændigt med problemstillinger, faglige argumenter og perspektivering.",
  };

  return `${getSubjectDescriptionFrame(subject)} Temaet er ${courseTitle.toLowerCase()} i ${grade}. ${bandPhrase[gradeBand]}`;
}

function createImagePrompt(input: AnnualPlanEngineInput, profile: SubjectProfile, gradeBand: GradeBand, title: string, index: number) {
  const notes = input.notes?.trim();
  const base =
    `Flot moderne undervisningsillustration til ${input.subject.toLowerCase()}forløbet "${title}", ` +
    `${profile.imagePromptStyle.toLowerCase()}, niveau ${gradeBandLabels[gradeBand].toLowerCase()}. ` +
    "Rolig, professionel skoleæstetik, tydeligt fagligt miljø og plads til titeltekst.";

  if (index !== 0 || !notes) {
    return base;
  }

  return `${base} Noter til senere AI-version: ${notes}.`;
}

export function createAnnualPlanDraft(input: AnnualPlanEngineInput): AnnualPlanDraft {
  const lessonsPerWeek = Math.max(1, input.lessonsPerWeek);
  const courseCount = Math.max(1, input.courseCount);
  const profile = getSubjectProfile(input.subject);
  const gradeBand = getGradeBand(input.grade);
  const courseIdeas = getCourseIdeasForBand(profile, gradeBand);
  const holidayWeeks = getHolidayWeeks(input.schoolYear, input.municipality);
  const teachingWeeks = buildTeachingWeeks(input.schoolYear, input.municipality);
  const courseWeekGroups = splitTeachingWeeks(teachingWeeks, courseCount);

  const courses = courseWeekGroups.map((weeks, index) => {
    const title = pickProfileValue(courseIdeas, index);
    const teachingWeekCount = weeks.length;
    const wishNote =
      index === 0 && input.wishes.trim()
        ? ` Lærerens særlige ønsker indarbejdes: ${input.wishes.trim()}.`
        : "";

    return {
      period: createPeriodLabel(weeks),
      teachingWeeks: teachingWeekCount,
      estimatedLessons: teachingWeekCount * lessonsPerWeek,
      title,
      description: `${createCourseDescription(input.subject, gradeBand, title, input.grade)}${wishNote}`,
      focus: pickProfileValue(profile.focusAreas, index),
      activities: pickProfileValue(profile.activityIdeas, index),
      product: pickProfileValue(profile.productIdeas, index),
      imagePrompt: createImagePrompt(input, profile, gradeBand, title, index),
      pauseNote: createPauseNote(weeks, holidayWeeks),
    };
  });

  const weeksUsed = courses.reduce((total, course) => total + course.teachingWeeks, 0);

  return {
    title: `Årsplan i ${input.subject} – ${input.grade} – ${input.schoolYear}`,
    subject: input.subject,
    grade: input.grade,
    gradeBand,
    gradeBandLabel: gradeBandLabels[gradeBand],
    profileName: hasDedicatedSubjectProfile(input.subject) ? input.subject : "Generisk fagprofil",
    schoolYear: input.schoolYear,
    municipality: input.municipality,
    teachingWeeks: teachingWeeks.length,
    holidayWeeks,
    commonGoalsIntro: profile.commonGoalsIntro,
    courses,
    summary: {
      totalLessons: weeksUsed * lessonsPerWeek,
      courseCount: courses.length,
      weeksUsed,
    },
  };
}

export function createStructuralCoursesForAi(input: AnnualPlanEngineInput) {
  const draft = createAnnualPlanDraft(input);
  return draft.courses.map((c, index) => ({
    id: `${index + 1}`,
    periodLabel: c.period,
    teachingWeeks: c.teachingWeeks,
    estimatedLessons: c.estimatedLessons,
    suggestedTitle: c.title,
    focusArea: c.focus,
  }));
}
