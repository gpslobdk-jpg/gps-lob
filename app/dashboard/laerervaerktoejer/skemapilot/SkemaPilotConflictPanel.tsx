"use client";

import { AlertCircle, Check, CircleDashed } from "lucide-react";
import type { ReactNode } from "react";

import type { SubjectAssignmentStatus } from "./SkemaPilotSubjectAssignment";

type ConflictPanelProps = {
  activeBlocks: readonly string[];
  activeClasses: readonly string[];
  activeRooms: readonly string[];
  allPreviewLessons: readonly ConflictPreviewCell[];
  getLessonValue: (className: string, subject: string) => string;
  lessonCount: number;
  previewClass: string;
  rubikClassName: string;
  subjectAssignmentStatus: SubjectAssignmentStatus;
  subjects: readonly string[];
};

type ConflictPreviewCell = {
  className: string;
  day: string;
  isFixedBlock?: boolean;
  lesson: number;
  room?: string;
  roomIsShared?: boolean;
  roomMissing?: boolean;
  subject: string;
  teacherId?: string;
  teacherName?: string;
};

type RuleStatus = "ok" | "warning" | "unknown";

type RuleCard = {
  description: string;
  detail: string;
  status: RuleStatus;
  title: string;
};

const statusStyles: Record<RuleStatus, { badge: string; card: string; icon: ReactNode; label: string }> = {
  ok: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    card: "border-emerald-200 bg-emerald-50/45",
    icon: <Check className="h-4 w-4" />,
    label: "OK",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    card: "border-amber-200 bg-amber-50/55",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Bør tjekkes",
  },
  unknown: {
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    card: "border-slate-200 bg-slate-50",
    icon: <CircleDashed className="h-4 w-4" />,
    label: "Ikke beregnet endnu",
  },
};

export function SkemaPilotConflictPanel({
  activeBlocks,
  activeClasses,
  activeRooms,
  allPreviewLessons,
  getLessonValue,
  lessonCount,
  previewClass,
  rubikClassName,
  subjectAssignmentStatus,
  subjects,
}: ConflictPanelProps) {
  const capacityPerClass = lessonCount * 5;
  const totalCapacity = activeClasses.length * capacityPerClass;
  const selectedClassLessonTotal = getClassLessonTotal(previewClass, subjects, getLessonValue);
  const totalSelectedLessons = activeClasses.reduce(
    (total, className) => total + getClassLessonTotal(className, subjects, getLessonValue),
    0,
  );
  const fixedSlotsPerClass = getFixedBlockSlots(activeBlocks);
  const fixedSlotsTotal = fixedSlotsPerClass * activeClasses.length;
  const effectiveCapacityPerClass = Math.max(0, capacityPerClass - fixedSlotsPerClass);
  const effectiveTotalCapacity = Math.max(0, totalCapacity - fixedSlotsTotal);
  const hasClassCapacityWarning = selectedClassLessonTotal > effectiveCapacityPerClass;
  const hasTotalCapacityWarning = totalSelectedLessons > effectiveTotalCapacity;
  const teacherDoubleBookings = getTeacherDoubleBookings(allPreviewLessons);
  const roomDoubleBookings = getRoomDoubleBookings(allPreviewLessons);
  const missingRoomCount = getMissingRoomCount(allPreviewLessons);
  const roomOverview = getRoomOverview(activeRooms, allPreviewLessons, roomDoubleBookings);
  const canCheckTeacherDoubleBookings = activeClasses.length > 1 && subjectAssignmentStatus.assignedItems > 0;

  const rules: RuleCard[] = [
    {
      title: "Klasse må ikke have to lektioner samtidig",
      status: hasClassCapacityWarning ? "warning" : "ok",
      description: hasClassCapacityWarning
        ? `${previewClass} har flere valgte faglektioner end de frie felter i previewugen.`
        : `${previewClass} har ét skemafelt pr. lektion i previewet.`,
      detail: `${selectedClassLessonTotal} valgte lektioner mod ${capacityPerClass} mulige felter før faste blokke.`,
    },
    {
      title: "Lærer må ikke være to steder samtidig",
      status: teacherDoubleBookings.length > 0 ? "warning" : canCheckTeacherDoubleBookings ? "ok" : "unknown",
      description:
        teacherDoubleBookings.length > 0
          ? `${teacherDoubleBookings.length} mulig lærer-dobbeltbooking bør tjekkes i den visuelle kladde.`
          : canCheckTeacherDoubleBookings
            ? "Ingen lærer-dobbeltbooking fundet i den visuelle kladde."
            : subjectAssignmentStatus.assignedItems > 0
              ? "Lærere er koblet på fagfordelingen, men tjekket kræver flere aktive klasser for at sammenligne."
              : "Lærere er klar til at blive vist i previewet, når fagfordelingen udfyldes.",
      detail:
        teacherDoubleBookings.length > 0
          ? summarizeTeacherDoubleBooking(teacherDoubleBookings[0])
          : canCheckTeacherDoubleBookings
            ? "Tjekket sammenligner lærer, dag og lektion på tværs af aktive klassers visuelle kladder."
            : "Lærerhuller analyseres som foreløbigt lokalt estimat i lærerbelastningspanelet.",
    },
    {
      title: "Fagposter bør have lærer",
      status:
        subjectAssignmentStatus.totalItems === 0
          ? "unknown"
          : subjectAssignmentStatus.missingItems > 0
            ? "warning"
            : "ok",
      description:
        subjectAssignmentStatus.totalItems === 0
          ? "Der er ingen relevante fagposter at fordele endnu."
          : subjectAssignmentStatus.missingItems > 0
            ? `${subjectAssignmentStatus.missingItems} fagposter mangler lærer.`
            : "Alle relevante fagposter er fordelt til lærere.",
      detail: `${subjectAssignmentStatus.assignedItems}/${subjectAssignmentStatus.totalItems} fagposter er fordelt i det lokale estimat.`,
    },
    {
      title: "Lokale må ikke bruges af to hold samtidig",
      status: roomDoubleBookings.length > 0 || missingRoomCount > 0 ? "warning" : "ok",
      description:
        roomDoubleBookings.length > 0
          ? summarizeRoomDoubleBooking(roomDoubleBookings[0])
          : missingRoomCount > 0
            ? `${missingRoomCount} lektioner mangler lokale.`
            : "Ingen lokale-dobbeltbooking fundet i den visuelle kladde.",
      detail:
        roomDoubleBookings.length > 0
          ? "Tjekket sammenligner delte speciallokaler, dag og lektion på tværs af aktive klasser."
          : missingRoomCount > 0
            ? "Manglende lokale opstår, når et specialfag ikke har et relevant lokale valgt."
            : "Almindelige klasselokaler er lokale forslag og giver ikke fælleslokale-konflikt.",
    },
    {
      title: "Faste blokke må ikke overskrives",
      status: fixedSlotsPerClass > 0 ? "ok" : "unknown",
      description:
        fixedSlotsPerClass > 0
          ? "Faste blokke reserveres visuelt i previewet."
          : "Der er ikke valgt faste blokke, som previewet kan reservere.",
      detail:
        fixedSlotsPerClass > 0
          ? `Faste blokke reserverer ca. ${fixedSlotsPerClass} felter pr. klasse i previewugen.`
          : "Senere kan faste blokke låses mere præcist.",
    },
    {
      title: "Valgt lokalt timetal skal kunne dækkes",
      status: hasTotalCapacityWarning || hasClassCapacityWarning ? "warning" : "ok",
      description: hasTotalCapacityWarning
        ? "De valgte lektioner fylder mere end den simple kapacitet efter faste blokke."
        : "Det valgte lokale timetal kan rummes i den simple previewkapacitet.",
      detail: `Der er ${totalCapacity} mulige lektionsfelter og ${totalSelectedLessons} valgte lektioner. Efter faste blokke er der ca. ${effectiveTotalCapacity} frie felter.`,
    },
  ];

  const warningCount = rules.filter((rule) => rule.status === "warning").length;
  const unknownCount = rules.filter((rule) => rule.status === "unknown").length;
  const overallText =
    warningCount > 0
      ? `${warningCount} ting bør tjekkes`
      : "Ingen blokerende konflikter fundet i previewet";

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Lokalt konflikttjek</p>
          <h4 className={`mt-2 text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            {overallText}
          </h4>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Dette er et lokalt tjek på den visuelle kladde. Lærere og lokaler bruges som lokale forslag,
            uden at skemaet flyttes automatisk.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
          <p>{totalCapacity} mulige lektionsfelter</p>
          <p>{totalSelectedLessons} valgte lektioner</p>
          <p>{teacherDoubleBookings.length} mulige lærer-dobbeltbookinger</p>
          <p>{roomDoubleBookings.length} mulige lokale-dobbeltbookinger</p>
          <p>{missingRoomCount} lektioner mangler lokale</p>
          <p>{subjectAssignmentStatus.missingItems} fagposter mangler lærer</p>
          <p>{fixedSlotsTotal} felter reserveret af faste blokke</p>
          <p>{unknownCount} regler kræver senere data</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Hårde regler</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {rules.map((rule) => (
            <RuleStatusCard key={rule.title} rule={rule} />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Lokaleoverblik</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <RoomOverviewCard
            label="Valgte lokaler"
            value={roomOverview.selectedRooms.length ? roomOverview.selectedRooms.join(", ") : "Ingen speciallokaler valgt"}
          />
          <RoomOverviewCard
            label="Brugte lokaler"
            value={roomOverview.usedRooms.length ? roomOverview.usedRooms.join(", ") : "Ingen lokaler i kladden"}
          />
          <RoomOverviewCard
            label="Mulige konflikter"
            value={roomOverview.conflictRooms.length ? roomOverview.conflictRooms.join(", ") : "Ingen fundet"}
          />
          <RoomOverviewCard
            label="Ikke brugt"
            value={roomOverview.unusedRooms.length ? roomOverview.unusedRooms.join(", ") : "Alle valgte lokaler bruges"}
          />
        </div>
      </div>
    </section>
  );
}

function RuleStatusCard({ rule }: { rule: RuleCard }) {
  const styles = statusStyles[rule.status];

  return (
    <article className={`rounded-lg border p-4 ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <h5 className="text-sm font-black leading-6 text-slate-950">{rule.title}</h5>
        <span
          className={`inline-flex min-h-8 shrink-0 items-center gap-2 rounded-lg border px-3 py-1 text-xs font-black ${styles.badge}`}
        >
          {styles.icon}
          {styles.label}
        </span>
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-slate-700">{rule.description}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{rule.detail}</p>
    </article>
  );
}

function RoomOverviewCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-bold leading-6 text-slate-700">{value}</p>
    </article>
  );
}

function getTeacherDoubleBookings(previewLessons: readonly ConflictPreviewCell[]) {
  const groupedLessons = new Map<string, ConflictPreviewCell[]>();

  previewLessons.forEach((lesson) => {
    if (!lesson.teacherId) {
      return;
    }

    const key = `${lesson.day}::${lesson.lesson}::${lesson.teacherId}`;
    groupedLessons.set(key, [...(groupedLessons.get(key) ?? []), lesson]);
  });

  return [...groupedLessons.values()]
    .map((lessons) => ({
      classes: [...new Set(lessons.map((lesson) => lesson.className))],
      day: lessons[0]?.day ?? "",
      lesson: lessons[0]?.lesson ?? 0,
      subjects: lessons.map((lesson) => lesson.subject),
      teacherName: lessons[0]?.teacherName ?? "Ukendt lærer",
    }))
    .filter((booking) => booking.classes.length > 1);
}

function summarizeTeacherDoubleBooking(booking: ReturnType<typeof getTeacherDoubleBookings>[number]) {
  return `${booking.teacherName} optræder i ${booking.classes.join(" og ")} ${booking.day.toLowerCase()} i ${booking.lesson}. lektion.`;
}

function getRoomDoubleBookings(previewLessons: readonly ConflictPreviewCell[]) {
  const groupedLessons = new Map<string, ConflictPreviewCell[]>();

  previewLessons.forEach((lesson) => {
    if (!lesson.room || !lesson.roomIsShared || lesson.roomMissing || lesson.isFixedBlock) {
      return;
    }

    const key = `${lesson.day}::${lesson.lesson}::${lesson.room}`;
    groupedLessons.set(key, [...(groupedLessons.get(key) ?? []), lesson]);
  });

  return [...groupedLessons.values()]
    .map((lessons) => ({
      classes: [...new Set(lessons.map((lesson) => lesson.className))],
      day: lessons[0]?.day ?? "",
      lesson: lessons[0]?.lesson ?? 0,
      room: lessons[0]?.room ?? "Ukendt lokale",
    }))
    .filter((booking) => booking.classes.length > 1);
}

function summarizeRoomDoubleBooking(booking: ReturnType<typeof getRoomDoubleBookings>[number]) {
  return `${booking.room} bruges af ${booking.classes.length} klasser ${booking.day.toLowerCase()} ${booking.lesson}. lektion.`;
}

function getMissingRoomCount(previewLessons: readonly ConflictPreviewCell[]) {
  return previewLessons.filter((lesson) => lesson.roomMissing && !lesson.isFixedBlock).length;
}

function getRoomOverview(
  activeRooms: readonly string[],
  previewLessons: readonly ConflictPreviewCell[],
  roomDoubleBookings: ReturnType<typeof getRoomDoubleBookings>,
) {
  const selectedRooms = [...activeRooms].sort((first, second) => first.localeCompare(second, "da"));
  const usedRooms = [
    ...new Set(
      previewLessons
        .filter((lesson) => lesson.room && !lesson.isFixedBlock && !lesson.roomMissing)
        .map((lesson) => lesson.room ?? ""),
    ),
  ].sort((first, second) => first.localeCompare(second, "da"));
  const conflictRooms = [...new Set(roomDoubleBookings.map((booking) => booking.room))].sort((first, second) =>
    first.localeCompare(second, "da"),
  );
  const unusedRooms = selectedRooms.filter((room) => !usedRooms.includes(room));

  return {
    conflictRooms,
    selectedRooms,
    unusedRooms,
    usedRooms,
  };
}

function getClassLessonTotal(
  className: string,
  subjects: readonly string[],
  getLessonValue: (className: string, subject: string) => string,
) {
  return subjects.reduce((total, subject) => total + (Number(getLessonValue(className, subject)) || 0), 0);
}

function getFixedBlockSlots(activeBlocks: readonly string[]) {
  let slots = 0;

  if (activeBlocks.includes("Morgensamling")) {
    slots += 5;
  }

  if (activeBlocks.includes("Læsebånd")) {
    slots += 4;
  }

  if (activeBlocks.includes("Fællessamling")) {
    slots += 1;
  }

  return slots;
}
