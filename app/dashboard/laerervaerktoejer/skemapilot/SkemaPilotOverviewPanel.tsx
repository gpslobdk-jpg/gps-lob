"use client";

import { AlertTriangle, CircleDashed, ListChecks, TrendingUp } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import {
  getAvailableSubjectTeachers,
  type SubjectAssignmentStatus,
  type SubjectAssignmentTeacher,
} from "./SkemaPilotSubjectAssignment";
import {
  getAvailableRoomNames,
  getRoomSimultaneousBookings,
  getTeacherLoadSummary,
  getTeacherScheduleAnalyses,
  type SkemaPilotPreviewCell,
} from "./skemaPilotPreviewData";

type SkemaPilotOverviewPanelProps = {
  activeClasses: readonly string[];
  activeRooms: readonly string[];
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  getLessonValue: (className: string, subject: string) => string;
  lessonCount: number;
  rubikClassName: string;
  subjectAssignmentStatus: SubjectAssignmentStatus;
  subjects: readonly string[];
  teachers: readonly SubjectAssignmentTeacher[];
};

type StatusTone = "good" | "warning" | "attention" | "neutral";

type OverviewStatus = {
  label: string;
  tone: StatusTone;
  value: string;
};

const toneClassNames: Record<StatusTone, string> = {
  attention: "border-rose-200 bg-rose-50 text-rose-950",
  good: "border-emerald-200 bg-emerald-50 text-emerald-950",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
};

export function SkemaPilotOverviewPanel({
  activeClasses,
  activeRooms,
  allPreviewLessons,
  getLessonValue,
  lessonCount,
  rubikClassName,
  subjectAssignmentStatus,
  subjects,
  teachers,
}: SkemaPilotOverviewPanelProps) {
  const overview = useMemo(
    () =>
      buildOverview({
        activeClasses,
        activeRooms,
        allPreviewLessons,
        getLessonValue,
        lessonCount,
        subjectAssignmentStatus,
        subjects,
        teachers,
      }),
    [
      activeClasses,
      activeRooms,
      allPreviewLessons,
      getLessonValue,
      lessonCount,
      subjectAssignmentStatus,
      subjects,
      teachers,
    ],
  );

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Skoleleder-overblik</p>
          <h4 className={`mt-2 text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            Opsætning: {overview.readinessPercentage} % klar
          </h4>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Et samlet lokalt estimat over den visuelle kladde. Overblikket samler opsætning, fagfordeling,
            lærerbelastning, lokaler og lokale tjek.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold leading-6 text-slate-700">
          <p>Visuel kladde oprettet</p>
          <p>{overview.previewLessonCount} preview-celler analyseret</p>
          <p>{overview.totalCheckItems} punkter bør tjekkes</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overview.statuses.map((status) => (
          <StatusCard key={status.label} status={status} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <OverviewList
          icon={<AlertTriangle className="h-5 w-5" />}
          items={overview.firstChecks}
          title="Bør tjekkes først"
          tone="warning"
        />
        <OverviewList
          icon={<TrendingUp className="h-5 w-5" />}
          items={overview.strengths}
          title="Styrker"
          tone="good"
        />
        <OverviewList
          icon={<ListChecks className="h-5 w-5" />}
          items={overview.risks}
          title="Opmærksomhedspunkter"
          tone="attention"
        />
      </div>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-600">Næste skridt</p>
            <div className="mt-3 grid gap-2 text-sm font-bold leading-6 text-slate-700">
              <p>Næste naturlige skridt er manuelle justeringer og senere drag-and-drop med live konfliktfeedback.</p>
              <p>På sigt kan SkemaPilot foreslå konkrete byt og flytninger.</p>
              <p>Dette er stadig en lokal visuel kladde.</p>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function StatusCard({ status }: { status: OverviewStatus }) {
  return (
    <article className={`rounded-lg border p-4 ${toneClassNames[status.tone]}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] opacity-75">{status.label}</p>
      <p className="mt-2 break-words text-2xl font-black">{status.value}</p>
      <p className="mt-1 text-xs font-bold opacity-75">Lokalt estimat</p>
    </article>
  );
}

function OverviewList({
  icon,
  items,
  title,
  tone,
}: {
  icon: ReactNode;
  items: string[];
  title: string;
  tone: "attention" | "good" | "warning";
}) {
  return (
    <section className={`rounded-lg border p-4 ${toneClassNames[tone]}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h5 className="text-sm font-black uppercase tracking-[0.14em]">{title}</h5>
      </div>
      <ul className="mt-3 grid gap-2 text-sm font-bold leading-6">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function buildOverview({
  activeClasses,
  activeRooms,
  allPreviewLessons,
  getLessonValue,
  lessonCount,
  subjectAssignmentStatus,
  subjects,
  teachers,
}: {
  activeClasses: readonly string[];
  activeRooms: readonly string[];
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  getLessonValue: (className: string, subject: string) => string;
  lessonCount: number;
  subjectAssignmentStatus: SubjectAssignmentStatus;
  subjects: readonly string[];
  teachers: readonly SubjectAssignmentTeacher[];
}) {
  const availableTeachers = getAvailableSubjectTeachers(teachers);
  const teacherAnalyses = getTeacherScheduleAnalyses(allPreviewLessons, teachers, lessonCount);
  const teacherSummary = getTeacherLoadSummary(teacherAnalyses);
  const availableRooms = getAvailableRoomNames(activeRooms, allPreviewLessons);
  const sharedRooms = availableRooms.filter((room) =>
    allPreviewLessons.some(
      (lesson) => lesson.room === room && lesson.roomIsShared && !lesson.roomMissing && !lesson.isFixedBlock,
    ),
  );
  const roomDoubleBookings = sharedRooms.flatMap((room) => getRoomSimultaneousBookings(allPreviewLessons, room));
  const missingRoomCount = allPreviewLessons.filter((lesson) => lesson.roomMissing && !lesson.isFixedBlock).length;
  const classLessonTotals = activeClasses.map((className) => ({
    className,
    lessons: subjects.reduce((total, subject) => total + (Number(getLessonValue(className, subject)) || 0), 0),
  }));
  const classesWithLessons = classLessonTotals.filter((item) => item.lessons > 0).length;
  const allClassesHaveLessons = activeClasses.length > 0 && classesWithLessons === activeClasses.length;
  const compactTeacherCount = teacherAnalyses.filter((analysis) => analysis.compactDays.length > 0).length;
  const manyGapTeacherCount = teacherAnalyses.filter((analysis) => analysis.status === "manyGaps").length;
  const setupReadinessParts = [
    activeClasses.length > 0 ? 100 : 0,
    activeClasses.length ? Math.round((classesWithLessons / activeClasses.length) * 100) : 0,
    availableTeachers.length > 0 ? 100 : 0,
    activeRooms.length > 0 ? 100 : 0,
    subjectAssignmentStatus.completionPercentage,
    allPreviewLessons.length > 0 ? 100 : 0,
  ];
  const readinessPercentage = Math.round(
    setupReadinessParts.reduce((total, value) => total + value, 0) / setupReadinessParts.length,
  );
  const totalCheckItems =
    subjectAssignmentStatus.missingItems +
    teacherSummary.teachersToCheck +
    roomDoubleBookings.length +
    missingRoomCount;
  const statuses: OverviewStatus[] = [
    {
      label: "Fagfordeling",
      tone:
        subjectAssignmentStatus.missingItems === 0 && subjectAssignmentStatus.totalItems > 0
          ? "good"
          : subjectAssignmentStatus.assignedItems > 0
            ? "warning"
            : "attention",
      value: `${subjectAssignmentStatus.assignedItems}/${subjectAssignmentStatus.totalItems} fordelt`,
    },
    {
      label: "Lærere",
      tone: availableTeachers.length > 0 ? "good" : "attention",
      value: `${availableTeachers.length} oprettet`,
    },
    {
      label: "Lokaler",
      tone: activeRooms.length > 0 ? "good" : "warning",
      value: `${activeRooms.length} valgt`,
    },
    {
      label: "Preview",
      tone: allPreviewLessons.length > 0 ? "good" : "neutral",
      value: allPreviewLessons.length > 0 ? "Oprettet" : "Ikke oprettet",
    },
    {
      label: "Lokale tjek",
      tone: roomDoubleBookings.length > 0 || missingRoomCount > 0 ? "warning" : "good",
      value: `${roomDoubleBookings.length} mulige konflikter`,
    },
    {
      label: "Lærerbelastning",
      tone: teacherSummary.teachersToCheck > 0 ? "warning" : "good",
      value: `${teacherSummary.teachersToCheck} lærere bør tjekkes`,
    },
    {
      label: "Mulige huller",
      tone: teacherSummary.totalPossibleGaps > 2 ? "warning" : "good",
      value: String(teacherSummary.totalPossibleGaps),
    },
    {
      label: "Klassetimetal",
      tone: allClassesHaveLessons ? "good" : "warning",
      value: `${classesWithLessons}/${activeClasses.length}`,
    },
  ];
  const firstChecks = buildFirstChecks({
    compactTeacherCount,
    manyGapTeacherCount,
    missingRoomCount,
    roomDoubleBookings: roomDoubleBookings.length,
    subjectAssignmentStatus,
    teacherSummary,
  });
  const strengths = buildStrengths({
    allClassesHaveLessons,
    allPreviewLessons,
    roomDoubleBookings: roomDoubleBookings.length,
    subjectAssignmentStatus,
    teacherSummary,
  });
  const risks = buildRisks({
    missingRoomCount,
    roomDoubleBookings: roomDoubleBookings.length,
    subjectAssignmentStatus,
    teacherSummary,
  });

  return {
    firstChecks,
    previewLessonCount: allPreviewLessons.length,
    readinessPercentage,
    risks,
    statuses,
    strengths,
    totalCheckItems,
  };
}

function buildFirstChecks({
  compactTeacherCount,
  manyGapTeacherCount,
  missingRoomCount,
  roomDoubleBookings,
  subjectAssignmentStatus,
  teacherSummary,
}: {
  compactTeacherCount: number;
  manyGapTeacherCount: number;
  missingRoomCount: number;
  roomDoubleBookings: number;
  subjectAssignmentStatus: SubjectAssignmentStatus;
  teacherSummary: ReturnType<typeof getTeacherLoadSummary>;
}) {
  const items: string[] = [];

  if (subjectAssignmentStatus.missingItems > 0) {
    items.push(`${subjectAssignmentStatus.missingItems} fagposter mangler lærer.`);
  }

  if (manyGapTeacherCount > 0) {
    items.push(`${manyGapTeacherCount} lærere har mange mulige huller.`);
  } else if (teacherSummary.totalPossibleGaps > 0) {
    items.push(`${teacherSummary.totalPossibleGaps} mulige lærerhuller bør tjekkes.`);
  }

  if (compactTeacherCount > 0) {
    items.push(`${compactTeacherCount} lærere har meget kompakte dage.`);
  }

  if (roomDoubleBookings > 0) {
    items.push(`${roomDoubleBookings} lokale-tidspunkter bør tjekkes.`);
  }

  if (missingRoomCount > 0) {
    items.push(`${missingRoomCount} lektioner mangler lokale.`);
  }

  [
    "Gennemgå fagfordeling, lærerbelastning og lokaleoverblik samlet.",
    "Brug konflikttjekket til at prioritere manuelle justeringer.",
    "Sammenhold pædagogisk kvalitet med de hårde lokale tjek.",
  ].forEach((item) => {
    if (items.length < 3) {
      items.push(item);
    }
  });

  return items.slice(0, 6);
}

function buildStrengths({
  allClassesHaveLessons,
  allPreviewLessons,
  roomDoubleBookings,
  subjectAssignmentStatus,
  teacherSummary,
}: {
  allClassesHaveLessons: boolean;
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  roomDoubleBookings: number;
  subjectAssignmentStatus: SubjectAssignmentStatus;
  teacherSummary: ReturnType<typeof getTeacherLoadSummary>;
}) {
  const items: string[] = [];

  if (allClassesHaveLessons) {
    items.push("Alle aktive klasser har lokale timetal.");
  }

  if (subjectAssignmentStatus.totalItems > 0 && subjectAssignmentStatus.completionPercentage >= 75) {
    items.push("De fleste fagposter er fordelt til lærere.");
  }

  if (roomDoubleBookings === 0) {
    items.push("Ingen lokale-dobbeltbooking fundet i den visuelle kladde.");
  }

  if (allPreviewLessons.some((lesson) => lesson.teacherId && lesson.room)) {
    items.push("Previewet har lærer og lokale koblet på cellerne.");
  }

  if (teacherSummary.totalPossibleGaps === 0 && teacherSummary.analyzedTeachers > 0) {
    items.push("Lærerbelastningen ser rolig ud i det lokale estimat.");
  }

  [
    "Previewet samler klasse, lærer og lokale i samme visuelle kladde.",
    "Overblikket bruger kun lokale estimater og ændrer ikke skemaet.",
  ].forEach((item) => {
    if (items.length < 2) {
      items.push(item);
    }
  });

  return items.slice(0, 5);
}

function buildRisks({
  missingRoomCount,
  roomDoubleBookings,
  subjectAssignmentStatus,
  teacherSummary,
}: {
  missingRoomCount: number;
  roomDoubleBookings: number;
  subjectAssignmentStatus: SubjectAssignmentStatus;
  teacherSummary: ReturnType<typeof getTeacherLoadSummary>;
}) {
  const items = [
    `${subjectAssignmentStatus.missingItems} fagposter mangler lærer.`,
    `${missingRoomCount} lektioner mangler lokale.`,
    `${teacherSummary.totalPossibleGaps} mulige lærerhuller er fundet.`,
    `${roomDoubleBookings} lokale-tidspunkter bør tjekkes.`,
  ];

  if (teacherSummary.teachersToCheck > 0) {
    items.push(`${teacherSummary.teachersToCheck} lærere bør tjekkes i lærerbelastningen.`);
  }

  return items.slice(0, 5);
}
