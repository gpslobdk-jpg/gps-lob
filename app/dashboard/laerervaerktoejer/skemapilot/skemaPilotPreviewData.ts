import {
  getAvailableSubjectTeachers,
  getSubjectAssignmentKey,
  getTeacherDisplayName,
  type SubjectAssignmentMap,
  type SubjectAssignmentTeacher,
} from "./SkemaPilotSubjectAssignment";

export type SkemaPilotPreviewCell = {
  className: string;
  day: string;
  lesson: number;
  note?: string;
  room?: string;
  subject: string;
  teacherId?: string;
  teacherMissing?: boolean;
  teacherName?: string;
};

export type TeacherScheduleStats = {
  compactDays: string[];
  longestContinuousBlock: number;
  placedLessons: number;
  possibleGaps: number;
  spreadDays: string[];
  teachingDays: number;
};

export type TeacherScheduleStatus = "calm" | "check" | "manyGaps" | "compact";

export type TeacherScheduleDayInsight = {
  day: string;
  isSpreadDay: boolean;
  lessons: number[];
  longestBlock: number;
  possibleGaps: number;
};

export type TeacherScheduleAnalysis = TeacherScheduleStats & {
  status: TeacherScheduleStatus;
  statusDescription: string;
  statusLabel: string;
  teacherId: string;
  teacherName: string;
};

export type TeacherLoadSummary = {
  analyzedTeachers: number;
  busiestTeacherLessons: number;
  busiestTeacherName: string;
  teachersToCheck: number;
  totalPossibleGaps: number;
};

export const weekdays = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"] as const;

export function buildSkemaPilotPreviewLessons(
  className: string,
  lessonCount: number,
  availableSubjects: readonly string[],
  getLessonValue: (className: string, subject: string) => string,
  activeBlocks: readonly string[],
  activeRooms: readonly string[],
  subjectAssignments: SubjectAssignmentMap,
  teachers: readonly SubjectAssignmentTeacher[],
): SkemaPilotPreviewCell[] {
  const teacherById = new Map<string, SubjectAssignmentTeacher>(
    getAvailableSubjectTeachers(teachers).map((teacher) => [teacher.id, teacher]),
  );
  const weightedSubjects = availableSubjects.flatMap((subject) => {
    const subjectCount = Math.max(0, Math.round(Number(getLessonValue(className, subject)) || 0));
    return Array.from({ length: Math.max(1, subjectCount) }, () => subject);
  });
  const subjectPool = weightedSubjects.length ? weightedSubjects : availableSubjects;

  return weekdays.flatMap((day, dayIndex) =>
    Array.from({ length: lessonCount }, (_, lessonIndex) => {
      const fixedSubject = getFixedBlockSubject(dayIndex, lessonIndex, activeBlocks);
      const subject = fixedSubject ?? subjectPool[(dayIndex * lessonCount + lessonIndex) % subjectPool.length];
      const teacherInfo = getTeacherForPreviewCell(
        className,
        subject,
        Boolean(fixedSubject),
        subjectAssignments,
        teacherById,
      );

      return {
        className,
        day,
        lesson: lessonIndex + 1,
        note: fixedSubject ? "Fast blok" : undefined,
        room: getRoomForSubject(subject, activeRooms),
        subject,
        ...teacherInfo,
      };
    }),
  );
}

export function getSkemaPilotLessonCount(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 6;
  }

  return Math.min(10, Math.max(1, parsed));
}

export function getTeacherScheduleStats(
  previewLessons: readonly SkemaPilotPreviewCell[],
  teacherId: string,
  lessonCount = 6,
): TeacherScheduleStats {
  const teacherLessons = getTeacherPreviewLessons(previewLessons, teacherId);
  const dayInsights = getTeacherScheduleDayInsights(previewLessons, teacherId, lessonCount);

  return {
    compactDays: dayInsights.filter((dayInsight) => dayInsight.longestBlock >= 4).map((dayInsight) => dayInsight.day),
    longestContinuousBlock: getLongestContinuousBlock(teacherLessons),
    placedLessons: teacherLessons.length,
    possibleGaps: dayInsights.reduce((total, dayInsight) => total + dayInsight.possibleGaps, 0),
    spreadDays: dayInsights.filter((dayInsight) => dayInsight.isSpreadDay).map((dayInsight) => dayInsight.day),
    teachingDays: new Set(teacherLessons.map((lesson) => lesson.day)).size,
  };
}

export function getTeacherScheduleDayInsights(
  previewLessons: readonly SkemaPilotPreviewCell[],
  teacherId: string,
  lessonCount = 6,
): TeacherScheduleDayInsight[] {
  const teacherLessons = getTeacherPreviewLessons(previewLessons, teacherId);
  const lateLessonStart = Math.max(3, Math.ceil(lessonCount * 0.67));

  return weekdays.map((day) => {
    const lessons = getUniqueSortedLessonNumbers(teacherLessons, day);
    const possibleGaps = getGapCountFromLessonNumbers(lessons);
    const hasEarlyLesson = lessons.some((lesson) => lesson <= 2);
    const hasLateLesson = lessons.some((lesson) => lesson >= lateLessonStart);

    return {
      day,
      isSpreadDay: possibleGaps > 0 && hasEarlyLesson && hasLateLesson,
      lessons,
      longestBlock: getLongestBlockFromLessonNumbers(lessons),
      possibleGaps,
    };
  });
}

export function getTeacherScheduleAnalyses(
  previewLessons: readonly SkemaPilotPreviewCell[],
  teachers: readonly SubjectAssignmentTeacher[],
  lessonCount = 6,
): TeacherScheduleAnalysis[] {
  return getAvailableSubjectTeachers(teachers).map((teacher) => {
    const stats = getTeacherScheduleStats(previewLessons, teacher.id, lessonCount);
    const status = getTeacherScheduleStatus(stats);

    return {
      ...stats,
      status,
      statusDescription: getTeacherScheduleStatusDescription(stats, status),
      statusLabel: getTeacherScheduleStatusLabel(status),
      teacherId: teacher.id,
      teacherName: getTeacherDisplayName(teacher),
    };
  });
}

export function getTeacherLoadSummary(analyses: readonly TeacherScheduleAnalysis[]): TeacherLoadSummary {
  const busiestTeacher = [...analyses].sort((first, second) => second.placedLessons - first.placedLessons)[0];

  return {
    analyzedTeachers: analyses.length,
    busiestTeacherLessons: busiestTeacher?.placedLessons ?? 0,
    busiestTeacherName:
      busiestTeacher && busiestTeacher.placedLessons > 0 ? busiestTeacher.teacherName : "Ingen placerede lektioner",
    teachersToCheck: analyses.filter((analysis) => analysis.status !== "calm").length,
    totalPossibleGaps: analyses.reduce((total, analysis) => total + analysis.possibleGaps, 0),
  };
}

export function getTeacherLoadRecommendations(analyses: readonly TeacherScheduleAnalysis[]) {
  if (!analyses.length) {
    return [
      "Tilføj lærere og fagfordeling for at se lokale anbefalinger.",
      "Brug lærerbelastning som dialogpunkt, når den visuelle kladde begynder at tage form.",
      "Den visuelle kladde kan bruges til dialog, men er ikke et færdigt skema.",
    ];
  }

  const totalPossibleGaps = analyses.reduce((total, analysis) => total + analysis.possibleGaps, 0);
  const hasSpreadDays = analyses.some((analysis) => analysis.spreadDays.length > 0);
  const hasCompactDays = analyses.some((analysis) => analysis.compactDays.length > 0);
  const hasTeachersWithoutLessons = analyses.some((analysis) => analysis.placedLessons === 0);
  const recommendations: string[] = [];

  if (totalPossibleGaps > 0) {
    recommendations.push("Tjek lærere med mange mulige huller først.");
  }

  if (hasSpreadDays) {
    recommendations.push("Overvej at samle spredte enkelttimer, hvis det passer med fag og lokaler.");
  }

  if (hasCompactDays) {
    recommendations.push("Lærere med meget kompakte dage kan have brug for luft i den videre dialog.");
  }

  if (hasTeachersWithoutLessons) {
    recommendations.push("Tjek om lærere uden placerede lektioner mangler fagfordeling.");
  }

  recommendations.push("Sammenlign lærerbelastning med fagfordelingen, før kladden vurderes samlet.");
  recommendations.push("Brug mulige huller som samtalepunkt, ikke som endelig fejlmarkering.");
  recommendations.push("Den visuelle kladde kan bruges til dialog, men er ikke et færdigt skema.");

  return recommendations.slice(0, 5);
}

export function getTeacherPreviewLessons(
  previewLessons: readonly SkemaPilotPreviewCell[],
  teacherId: string,
) {
  return previewLessons.filter((lesson) => lesson.teacherId === teacherId);
}

function getTeacherForPreviewCell(
  className: string,
  subject: string,
  isFixedSubject: boolean,
  subjectAssignments: SubjectAssignmentMap,
  teacherById: Map<string, SubjectAssignmentTeacher>,
) {
  if (isFixedSubject) {
    return {};
  }

  const teacherId = subjectAssignments[getSubjectAssignmentKey(className, subject)] ?? "";
  const teacher = teacherId ? teacherById.get(teacherId) : undefined;

  if (!teacher) {
    return {
      teacherMissing: true,
    };
  }

  return {
    teacherId,
    teacherName: getTeacherDisplayName(teacher),
  };
}

function getFixedBlockSubject(dayIndex: number, lessonIndex: number, activeBlocks: readonly string[]) {
  if (lessonIndex === 0 && activeBlocks.includes("Morgensamling")) {
    return "Morgensamling";
  }

  if (lessonIndex === 1 && dayIndex < 4 && activeBlocks.includes("Læsebånd")) {
    return "Læsebånd";
  }

  if (lessonIndex === 0 && dayIndex === 4 && activeBlocks.includes("Fællessamling")) {
    return "Fællessamling";
  }

  return null;
}

function getRoomForSubject(subject: string, activeRooms: readonly string[]) {
  if (subject === "Idræt" && activeRooms.includes("Idrætshal")) {
    return "Idrætshal";
  }

  if (subject === "Musik" && activeRooms.includes("Musik")) {
    return "Musik";
  }

  if (subject === "Billedkunst/krea" && activeRooms.includes("Billedkunst/krea")) {
    return "Billedkunst/krea";
  }

  if (subject === "Natur/teknologi" && activeRooms.includes("Naturfag")) {
    return "Naturfag";
  }

  return undefined;
}

function getLongestContinuousBlock(teacherLessons: readonly SkemaPilotPreviewCell[]) {
  return weekdays.reduce((longestBlock, day) => {
    const lessonNumbers = getUniqueSortedLessonNumbers(teacherLessons, day);
    let currentBlock = 0;
    let previousLesson = 0;
    let dayLongestBlock = 0;

    lessonNumbers.forEach((lessonNumber) => {
      currentBlock = lessonNumber === previousLesson + 1 ? currentBlock + 1 : 1;
      previousLesson = lessonNumber;
      dayLongestBlock = Math.max(dayLongestBlock, currentBlock);
    });

    return Math.max(longestBlock, dayLongestBlock);
  }, 0);
}

function getTeacherScheduleStatus(stats: TeacherScheduleStats): TeacherScheduleStatus {
  if (stats.placedLessons === 0) {
    return "check";
  }

  if (stats.possibleGaps >= 3 || stats.spreadDays.length >= 2) {
    return "manyGaps";
  }

  if (stats.compactDays.length > 0) {
    return "compact";
  }

  if (stats.possibleGaps > 0 || stats.spreadDays.length > 0) {
    return "check";
  }

  return "calm";
}

function getTeacherScheduleStatusLabel(status: TeacherScheduleStatus) {
  if (status === "calm") {
    return "Ser roligt ud";
  }

  if (status === "manyGaps") {
    return "Mange huller";
  }

  if (status === "compact") {
    return "Meget kompakt dag";
  }

  return "Bør tjekkes";
}

function getTeacherScheduleStatusDescription(stats: TeacherScheduleStats, status: TeacherScheduleStatus) {
  if (stats.placedLessons === 0) {
    return "Ingen placerede lektioner i den visuelle kladde.";
  }

  if (status === "manyGaps") {
    return "Flere mulige huller eller spredte dage bør tjekkes først.";
  }

  if (status === "compact") {
    return "Mindst én dag har en lang sammenhængende undervisningsblok.";
  }

  if (status === "check") {
    return "Der er enkelte mulige huller eller spredte dage i kladden.";
  }

  return "Ingen tydelige huller eller spredte dage i det lokale estimat.";
}

function getGapCountFromLessonNumbers(lessonNumbers: readonly number[]) {
  if (lessonNumbers.length < 2) {
    return 0;
  }

  const scheduledLessons = new Set(lessonNumbers);
  const firstLesson = lessonNumbers[0];
  const lastLesson = lessonNumbers[lessonNumbers.length - 1];
  let gaps = 0;

  for (let lesson = firstLesson; lesson <= lastLesson; lesson += 1) {
    if (!scheduledLessons.has(lesson)) {
      gaps += 1;
    }
  }

  return gaps;
}

function getLongestBlockFromLessonNumbers(lessonNumbers: readonly number[]) {
  let currentBlock = 0;
  let previousLesson = 0;
  let longestBlock = 0;

  lessonNumbers.forEach((lessonNumber) => {
    currentBlock = lessonNumber === previousLesson + 1 ? currentBlock + 1 : 1;
    previousLesson = lessonNumber;
    longestBlock = Math.max(longestBlock, currentBlock);
  });

  return longestBlock;
}

function getUniqueSortedLessonNumbers(teacherLessons: readonly SkemaPilotPreviewCell[], day: string) {
  return [...new Set(teacherLessons.filter((lesson) => lesson.day === day).map((lesson) => lesson.lesson))].sort(
    (first, second) => first - second,
  );
}
