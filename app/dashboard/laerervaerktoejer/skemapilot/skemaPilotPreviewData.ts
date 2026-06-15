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
  isFixedBlock?: boolean;
  lesson: number;
  note?: string;
  room?: string;
  roomIsShared?: boolean;
  roomMissing?: boolean;
  roomSource?: "default" | "fixed" | "missing" | "selected";
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

export type RoomScheduleStats = {
  busiestDay: string;
  freeLessons: number;
  placedLessons: number;
  simultaneousBookings: number;
  usageDays: number;
};

export type RoomSimultaneousBooking = {
  day: string;
  lesson: number;
  lessons: SkemaPilotPreviewCell[];
  room: string;
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
      const isFixedBlock = Boolean(fixedSubject);
      const teacherInfo = getTeacherForPreviewCell(
        className,
        subject,
        isFixedBlock,
        subjectAssignments,
        teacherById,
      );
      const roomInfo = getRoomForSubject(subject, activeRooms, isFixedBlock);

      return {
        className,
        day,
        isFixedBlock,
        lesson: lessonIndex + 1,
        note: fixedSubject ? "Fast blok" : undefined,
        subject,
        ...roomInfo,
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

export function getSkemaPilotPreviewCellKey(cell: SkemaPilotPreviewCell) {
  return `${cell.className}::${cell.day}::${cell.lesson}`;
}

export function getPreviewLessonsInSlot(
  previewLessons: readonly SkemaPilotPreviewCell[],
  day: string,
  lessonNumber: number,
) {
  return previewLessons.filter((lesson) => lesson.day === day && lesson.lesson === lessonNumber);
}

export function getClassPreviewLessonInSlot(
  previewLessons: readonly SkemaPilotPreviewCell[],
  className: string,
  day: string,
  lessonNumber: number,
  excludedCellKey = "",
) {
  return getPreviewLessonsInSlot(previewLessons, day, lessonNumber).find(
    (lesson) => lesson.className === className && getSkemaPilotPreviewCellKey(lesson) !== excludedCellKey,
  );
}

export function getTeacherPreviewConflictInSlot(
  previewLessons: readonly SkemaPilotPreviewCell[],
  teacherId: string,
  className: string,
  day: string,
  lessonNumber: number,
  excludedCellKey = "",
) {
  return getPreviewLessonsInSlot(previewLessons, day, lessonNumber).find(
    (lesson) =>
      lesson.teacherId === teacherId &&
      lesson.className !== className &&
      getSkemaPilotPreviewCellKey(lesson) !== excludedCellKey,
  );
}

export function getSharedRoomPreviewConflictInSlot(
  previewLessons: readonly SkemaPilotPreviewCell[],
  room: string,
  className: string,
  day: string,
  lessonNumber: number,
  excludedCellKey = "",
) {
  return getPreviewLessonsInSlot(previewLessons, day, lessonNumber).find(
    (lesson) =>
      lesson.room === room &&
      lesson.roomIsShared &&
      lesson.className !== className &&
      !lesson.roomMissing &&
      !lesson.isFixedBlock &&
      getSkemaPilotPreviewCellKey(lesson) !== excludedCellKey,
  );
}

export function getClassSubjectCountOnDay(
  previewLessons: readonly SkemaPilotPreviewCell[],
  className: string,
  day: string,
  options: { excludedCellKey?: string; includeSubject?: string; includeFixedBlocks?: boolean } = {},
) {
  const subjects = new Set(
    previewLessons
      .filter(
        (lesson) =>
          lesson.className === className &&
          lesson.day === day &&
          (options.includeFixedBlocks || !lesson.isFixedBlock) &&
          getSkemaPilotPreviewCellKey(lesson) !== options.excludedCellKey,
      )
      .map((lesson) => lesson.subject),
  );

  if (options.includeSubject) {
    subjects.add(options.includeSubject);
  }

  return subjects.size;
}

export function getAvailableRoomNames(
  activeRooms: readonly string[],
  previewLessons: readonly SkemaPilotPreviewCell[],
) {
  const usedRooms = previewLessons
    .filter((lesson) => lesson.room && !lesson.roomMissing && !lesson.isFixedBlock)
    .map((lesson) => lesson.room ?? "");

  return [...new Set([...activeRooms, ...usedRooms])].sort((first, second) => first.localeCompare(second, "da"));
}

export function getRoomPreviewLessons(
  previewLessons: readonly SkemaPilotPreviewCell[],
  room: string,
) {
  return previewLessons.filter((lesson) => lesson.room === room && !lesson.roomMissing && !lesson.isFixedBlock);
}

export function getRoomScheduleStats(
  previewLessons: readonly SkemaPilotPreviewCell[],
  room: string,
  lessonCount: number,
): RoomScheduleStats {
  const roomLessons = getRoomPreviewLessons(previewLessons, room);
  const occupiedSlots = new Set(roomLessons.map((lesson) => `${lesson.day}::${lesson.lesson}`));
  const dailyCounts = weekdays.map((day) => ({
    count: roomLessons.filter((lesson) => lesson.day === day).length,
    day,
  }));
  const busiestDay = [...dailyCounts].sort((first, second) => second.count - first.count)[0];

  return {
    busiestDay: busiestDay && busiestDay.count > 0 ? `${busiestDay.day} (${busiestDay.count})` : "Ingen brug endnu",
    freeLessons: Math.max(0, lessonCount * weekdays.length - occupiedSlots.size),
    placedLessons: roomLessons.length,
    simultaneousBookings: getRoomSimultaneousBookings(previewLessons, room).length,
    usageDays: new Set(roomLessons.map((lesson) => lesson.day)).size,
  };
}

export function getRoomSimultaneousBookings(
  previewLessons: readonly SkemaPilotPreviewCell[],
  room: string,
): RoomSimultaneousBooking[] {
  const groupedLessons = new Map<string, SkemaPilotPreviewCell[]>();

  getRoomPreviewLessons(previewLessons, room).forEach((lesson) => {
    const key = `${lesson.day}::${lesson.lesson}`;
    groupedLessons.set(key, [...(groupedLessons.get(key) ?? []), lesson]);
  });

  return [...groupedLessons.values()]
    .filter((lessons) => new Set(lessons.map((lesson) => lesson.className)).size > 1)
    .map((lessons) => ({
      day: lessons[0]?.day ?? "",
      lesson: lessons[0]?.lesson ?? 0,
      lessons,
      room,
    }));
}

export type ManualMove = {
  kind: "move";
  id: string;
  className: string;
  fromDay: string;
  fromLesson: number;
  toDay: string;
  toLesson: number;
};

export type ManualSwap = {
  kind: "swap";
  id: string;
  className: string;
  aFromDay: string;
  aFromLesson: number;
  bFromDay: string;
  bFromLesson: number;
};

export type ManualChange = ManualMove | ManualSwap;

export function applyManualChangesToLessons(
  lessons: readonly SkemaPilotPreviewCell[],
  changes: readonly ManualChange[],
): SkemaPilotPreviewCell[] {
  if (!changes.length) {
    return [...lessons];
  }

  let result: SkemaPilotPreviewCell[] = [...lessons];

  for (const change of changes) {
    if (change.kind === "move") {
      result = result.map((cell) => {
        if (cell.className === change.className && cell.day === change.fromDay && cell.lesson === change.fromLesson) {
          return { ...cell, day: change.toDay, lesson: change.toLesson };
        }

        return cell;
      });
    } else {
      result = result.map((cell) => {
        if (cell.className === change.className && cell.day === change.aFromDay && cell.lesson === change.aFromLesson) {
          return { ...cell, day: change.bFromDay, lesson: change.bFromLesson };
        }

        if (cell.className === change.className && cell.day === change.bFromDay && cell.lesson === change.bFromLesson) {
          return { ...cell, day: change.aFromDay, lesson: change.aFromLesson };
        }

        return cell;
      });
    }
  }

  return result;
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

function getRoomForSubject(subject: string, activeRooms: readonly string[], isFixedBlock: boolean) {
  if (isFixedBlock) {
    return {
      roomSource: "fixed" as const,
    };
  }

  const sharedRoom = getSharedRoomForSubject(subject);

  if (sharedRoom) {
    if (activeRooms.includes(sharedRoom)) {
      return {
        room: sharedRoom,
        roomIsShared: true,
        roomSource: "selected" as const,
      };
    }

    return {
      roomIsShared: true,
      roomMissing: true,
      roomSource: "missing" as const,
    };
  }

  return {
    room: "Klasselokale",
    roomIsShared: false,
    roomSource: "default" as const,
  };
}

function getSharedRoomForSubject(subject: string) {
  const normalizedSubject = subject.toLowerCase();

  if (subject === "Idræt") {
    return "Idrætshal";
  }

  if (subject === "Musik") {
    return "Musik";
  }

  if (subject === "Billedkunst/krea") {
    return "Billedkunst/krea";
  }

  if (subject === "Natur/teknologi" || normalizedSubject.includes("naturfag")) {
    return "Naturfag";
  }

  if (subject === "Madkundskab") {
    return "Madkundskab";
  }

  return null;
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
