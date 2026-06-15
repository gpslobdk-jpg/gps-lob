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
  longestContinuousBlock: number;
  placedLessons: number;
  possibleGaps: number;
  teachingDays: number;
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
): TeacherScheduleStats {
  const teacherLessons = getTeacherPreviewLessons(previewLessons, teacherId);

  return {
    longestContinuousBlock: getLongestContinuousBlock(teacherLessons),
    placedLessons: teacherLessons.length,
    possibleGaps: getPossibleGapCount(teacherLessons),
    teachingDays: new Set(teacherLessons.map((lesson) => lesson.day)).size,
  };
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

function getPossibleGapCount(teacherLessons: readonly SkemaPilotPreviewCell[]) {
  return weekdays.reduce((total, day) => {
    const lessonNumbers = getUniqueSortedLessonNumbers(teacherLessons, day);

    if (lessonNumbers.length < 2) {
      return total;
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

    return total + gaps;
  }, 0);
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

function getUniqueSortedLessonNumbers(teacherLessons: readonly SkemaPilotPreviewCell[], day: string) {
  return [...new Set(teacherLessons.filter((lesson) => lesson.day === day).map((lesson) => lesson.lesson))].sort(
    (first, second) => first - second,
  );
}
