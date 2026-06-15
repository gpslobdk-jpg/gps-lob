"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Lock } from "lucide-react";
import { useMemo, useState } from "react";

import {
  getClassPreviewLessonInSlot,
  getClassSubjectCountOnDay,
  getSharedRoomPreviewConflictInSlot,
  getSkemaPilotPreviewCellKey,
  getTeacherPreviewConflictInSlot,
  type SkemaPilotPreviewCell,
  weekdays,
} from "./skemaPilotPreviewData";

type SkemaPilotMoveSimulatorProps = {
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  lessonCount: number;
  rubikClassName: string;
};

type SimulationStatus = "possible" | "check" | "conflict" | "swap";

type MoveSimulation = {
  attentions: string[];
  benefits: string[];
  description: string;
  status: SimulationStatus;
  targetLesson?: SkemaPilotPreviewCell;
  title: string;
};

type LessonOption = {
  cell: SkemaPilotPreviewCell;
  key: string;
  label: string;
};

const statusClassNames: Record<SimulationStatus, string> = {
  check: "border-amber-200 bg-amber-50 text-amber-950",
  conflict: "border-rose-200 bg-rose-50 text-rose-950",
  possible: "border-emerald-200 bg-emerald-50 text-emerald-950",
  swap: "border-sky-200 bg-sky-50 text-sky-950",
};

const statusIconClassNames: Record<SimulationStatus, string> = {
  check: "text-amber-700",
  conflict: "text-rose-700",
  possible: "text-emerald-700",
  swap: "text-sky-700",
};

const coreSubjects = ["Dansk", "Matematik"] as const;
const heavySubjects = ["Dansk", "Matematik", "Engelsk", "Natur/teknologi"] as const;

export function SkemaPilotMoveSimulator({
  allPreviewLessons,
  lessonCount,
  rubikClassName,
}: SkemaPilotMoveSimulatorProps) {
  const lessonOptions = useMemo(() => buildLessonOptions(allPreviewLessons), [allPreviewLessons]);
  const [selectedLessonKey, setSelectedLessonKey] = useState("");
  const [targetDay, setTargetDay] = useState<string>(weekdays[0]);
  const [targetLessonNumber, setTargetLessonNumber] = useState(1);
  const selectedOption =
    lessonOptions.find((option) => option.key === selectedLessonKey) ?? lessonOptions[0];
  const selectedLesson = selectedOption?.cell;
  const simulation = useMemo(
    () =>
      selectedLesson
        ? buildMoveSimulation({
            allPreviewLessons,
            lessonCount,
            selectedLesson,
            targetDay,
            targetLessonNumber,
          })
        : null,
    [allPreviewLessons, lessonCount, selectedLesson, targetDay, targetLessonNumber],
  );

  if (!lessonOptions.length) {
    return (
      <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Flyt/bytte-simulator
        </p>
        <h4 className={`mt-2 text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
          Simuler flytning
        </h4>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
          Tilføj klasser og lektioner for at simulere lokale flytninger i den visuelle kladde.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Flyt/bytte-simulator
          </p>
          <h4 className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            Simuler flytning i visuel kladde
          </h4>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Vælg en lektion og et nyt tidspunkt. SkemaPilot viser kun et lokalt tjek af mulige
            konsekvenser og ændrer ikke skema-previewet.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
          <div className="flex items-start gap-2">
            <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>Prototype. Ingen flytning gemmes eller anvendes.</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="block min-w-0">
            <span className="text-sm font-black text-slate-950">Vælg lektion</span>
            <select
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              value={selectedOption?.key ?? ""}
              onChange={(event) => setSelectedLessonKey(event.target.value)}
            >
              {lessonOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-black text-slate-950">Dag</span>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                value={targetDay}
                onChange={(event) => setTargetDay(event.target.value)}
              >
                {weekdays.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-950">Lektion</span>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                value={targetLessonNumber}
                onChange={(event) => setTargetLessonNumber(Number(event.target.value))}
              >
                {Array.from({ length: lessonCount }, (_, lessonIndex) => lessonIndex + 1).map((lessonNumber) => (
                  <option key={lessonNumber} value={lessonNumber}>
                    {lessonNumber}. lektion
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedLesson ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold leading-6 text-slate-700">
              <MoveLine label="Fra" value={`${selectedLesson.className} · ${selectedLesson.subject}`} />
              <MoveLine label="Tid" value={`${selectedLesson.day} · ${selectedLesson.lesson}. lektion`} />
              <MoveLine label="Lærer" value={selectedLesson.teacherName ?? "Lærer ikke fordelt"} />
              <MoveLine label="Lokale" value={selectedLesson.room ?? "Lokale ikke valgt"} />
              <MoveLine label="Til" value={`${targetDay} · ${targetLessonNumber}. lektion`} />
              {simulation?.targetLesson ? (
                <MoveLine label="Målpunkt" value={formatTargetLesson(simulation.targetLesson)} />
              ) : (
                <MoveLine label="Målpunkt" value="Ingen anden lektion fundet for klassen i kladden" />
              )}
            </div>
          ) : null}
        </div>

        {simulation ? <SimulationResult simulation={simulation} /> : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm font-bold leading-6 text-slate-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p>Simulatoren viser kun et lokalt tjek og ændrer ikke den visuelle kladde.</p>
        </div>
        <button
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-400"
          disabled
          type="button"
        >
          Anvend flytning · kommende funktion
        </button>
      </div>
    </section>
  );
}

function SimulationResult({ simulation }: { simulation: MoveSimulation }) {
  const StatusIcon = simulation.status === "possible" ? CheckCircle2 : AlertTriangle;

  return (
    <article className={`rounded-lg border p-4 ${statusClassNames[simulation.status]}`}>
      <div className="flex items-start gap-3">
        <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${statusIconClassNames[simulation.status]}`} />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em]">Lokalt tjek</p>
          <h5 className="mt-2 text-2xl font-black tracking-tight">{simulation.title}</h5>
          <p className="mt-2 text-sm font-bold leading-6">{simulation.description}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <ResultList items={simulation.benefits} title="Mulige fordele" tone="good" />
        <ResultList items={simulation.attentions} title="Opmærksomhedspunkter" tone="attention" />
      </div>
    </article>
  );
}

function ResultList({
  items,
  title,
  tone,
}: {
  items: readonly string[];
  title: string;
  tone: "attention" | "good";
}) {
  const className =
    tone === "good"
      ? "border-emerald-200 bg-white/70 text-emerald-950"
      : "border-amber-200 bg-white/70 text-amber-950";

  return (
    <section className={`rounded-lg border p-3 ${className}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em]">{title}</p>
      <ul className="mt-2 grid gap-2 text-sm font-bold leading-6">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function MoveLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="grid gap-1 sm:grid-cols-[80px_1fr]">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-800">{value}</span>
    </p>
  );
}

function buildLessonOptions(allPreviewLessons: readonly SkemaPilotPreviewCell[]): LessonOption[] {
  return [...allPreviewLessons]
    .sort((first, second) =>
      `${first.className}-${first.day}-${first.lesson}`.localeCompare(
        `${second.className}-${second.day}-${second.lesson}`,
        "da",
      ),
    )
    .map((cell) => ({
      cell,
      key: getSkemaPilotPreviewCellKey(cell),
      label: formatLessonOptionLabel(cell),
    }));
}

function buildMoveSimulation({
  allPreviewLessons,
  lessonCount,
  selectedLesson,
  targetDay,
  targetLessonNumber,
}: {
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  lessonCount: number;
  selectedLesson: SkemaPilotPreviewCell;
  targetDay: string;
  targetLessonNumber: number;
}): MoveSimulation {
  const selectedLessonKey = getSkemaPilotPreviewCellKey(selectedLesson);
  const sameSlot = selectedLesson.day === targetDay && selectedLesson.lesson === targetLessonNumber;
  const classConflict = getClassPreviewLessonInSlot(
    allPreviewLessons,
    selectedLesson.className,
    targetDay,
    targetLessonNumber,
    selectedLessonKey,
  );
  const teacherConflict =
    selectedLesson.teacherId && !selectedLesson.teacherMissing
      ? getTeacherPreviewConflictInSlot(
          allPreviewLessons,
          selectedLesson.teacherId,
          selectedLesson.className,
          targetDay,
          targetLessonNumber,
          selectedLessonKey,
        )
      : undefined;
  const roomConflict =
    selectedLesson.room && selectedLesson.roomIsShared
      ? getSharedRoomPreviewConflictInSlot(
          allPreviewLessons,
          selectedLesson.room,
          selectedLesson.className,
          targetDay,
          targetLessonNumber,
          selectedLessonKey,
        )
      : undefined;
  const pedagogicalWarnings = getPedagogicalWarnings({
    allPreviewLessons,
    lessonCount,
    selectedLesson,
    targetDay,
    targetLessonNumber,
  });
  const attentions = buildAttentionPoints({
    classConflict,
    pedagogicalWarnings,
    roomConflict,
    sameSlot,
    selectedLesson,
    targetDay,
    targetLessonNumber,
    teacherConflict,
  });
  const benefits = buildBenefits({
    classConflict,
    roomConflict,
    sameSlot,
    selectedLesson,
    targetDay,
    targetLessonNumber,
    teacherConflict,
  });
  const status = getSimulationStatus({
    attentions,
    classConflict,
    roomConflict,
    teacherConflict,
  });

  return {
    attentions,
    benefits,
    description: getStatusDescription(status),
    status,
    targetLesson: classConflict,
    title: getStatusTitle(status),
  };
}

function buildAttentionPoints({
  classConflict,
  pedagogicalWarnings,
  roomConflict,
  sameSlot,
  selectedLesson,
  targetDay,
  targetLessonNumber,
  teacherConflict,
}: {
  classConflict?: SkemaPilotPreviewCell;
  pedagogicalWarnings: readonly string[];
  roomConflict?: SkemaPilotPreviewCell;
  sameSlot: boolean;
  selectedLesson: SkemaPilotPreviewCell;
  targetDay: string;
  targetLessonNumber: number;
  teacherConflict?: SkemaPilotPreviewCell;
}) {
  const items: string[] = [];

  if (sameSlot) {
    items.push("Du har valgt lektionens nuværende tidspunkt i den visuelle kladde.");
  }

  if (classConflict) {
    items.push(
      `Klassen har allerede ${classConflict.subject} ${formatSlot(targetDay, targetLessonNumber)}. Det kræver et byt i denne simulator.`,
    );
  }

  if (teacherConflict && selectedLesson.teacherName) {
    items.push(
      `${selectedLesson.teacherName} underviser allerede ${teacherConflict.className} i ${teacherConflict.subject} ${formatSlot(
        targetDay,
        targetLessonNumber,
      )}.`,
    );
  }

  if (roomConflict && selectedLesson.room) {
    items.push(
      `${selectedLesson.room} bruges allerede af ${roomConflict.className} ${formatSlot(targetDay, targetLessonNumber)}.`,
    );
  }

  if (selectedLesson.teacherMissing) {
    items.push("Lektionens lærer er ikke fordelt endnu, så lærertjekket er begrænset.");
  }

  if (selectedLesson.roomMissing) {
    items.push("Lektionen mangler lokale, så lokaletjekket er begrænset.");
  }

  items.push(...pedagogicalWarnings);

  if (!items.length) {
    items.push("Ingen tydelige opmærksomhedspunkter fundet i det lokale tjek.");
  }

  return items.slice(0, 6);
}

function buildBenefits({
  classConflict,
  roomConflict,
  sameSlot,
  selectedLesson,
  targetDay,
  targetLessonNumber,
  teacherConflict,
}: {
  classConflict?: SkemaPilotPreviewCell;
  roomConflict?: SkemaPilotPreviewCell;
  sameSlot: boolean;
  selectedLesson: SkemaPilotPreviewCell;
  targetDay: string;
  targetLessonNumber: number;
  teacherConflict?: SkemaPilotPreviewCell;
}) {
  const items: string[] = [];

  if (!teacherConflict && !roomConflict) {
    items.push("Ingen lærer- eller lokalekonflikt fundet i kladden.");
  }

  if (!classConflict && !sameSlot) {
    items.push("Målet ser ledigt ud for klassen i den visuelle kladde.");
  }

  if (targetLessonNumber < selectedLesson.lesson && targetDay === selectedLesson.day) {
    items.push("Flytningen kan lægge lektionen tidligere på dagen.");
  }

  if (targetDay !== selectedLesson.day) {
    items.push("Flytningen kan fordele lektionen til en anden dag i ugen.");
  }

  if (!items.length) {
    items.push("Simuleringen gør konsekvenserne synlige uden at ændre kladden.");
  }

  return items.slice(0, 4);
}

function getPedagogicalWarnings({
  allPreviewLessons,
  lessonCount,
  selectedLesson,
  targetDay,
  targetLessonNumber,
}: {
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  lessonCount: number;
  selectedLesson: SkemaPilotPreviewCell;
  targetDay: string;
  targetLessonNumber: number;
}) {
  const warnings: string[] = [];
  const lateLessonStart = Math.max(4, Math.ceil(lessonCount * 0.67));
  const isLateLesson = targetLessonNumber >= lateLessonStart;
  const grade = getGradeFromClassName(selectedLesson.className);

  if (coreSubjects.includes(selectedLesson.subject as (typeof coreSubjects)[number]) && isLateLesson) {
    warnings.push("Kernefag flyttes sent på dagen. Bør tjekkes.");
  }

  if (
    grade <= 3 &&
    heavySubjects.includes(selectedLesson.subject as (typeof heavySubjects)[number]) &&
    isLateLesson
  ) {
    warnings.push("Yngre klasse får et tungt fag sent på dagen.");
  }

  if (
    selectedLesson.subject === "Idræt" &&
    hasAdjacentSameSubject(allPreviewLessons, selectedLesson, selectedLesson.day, selectedLesson.lesson) &&
    !hasAdjacentSameSubject(allPreviewLessons, selectedLesson, targetDay, targetLessonNumber)
  ) {
    warnings.push("Idræt fungerer ofte bedst som samlet blok.");
  }

  if (getTargetDaySubjectCount(allPreviewLessons, selectedLesson, targetDay) > (grade <= 3 ? 4 : 5)) {
    warnings.push("Dagen kan blive urolig med mange faglige skift.");
  }

  return warnings;
}

function getSimulationStatus({
  attentions,
  classConflict,
  roomConflict,
  teacherConflict,
}: {
  attentions: readonly string[];
  classConflict?: SkemaPilotPreviewCell;
  roomConflict?: SkemaPilotPreviewCell;
  teacherConflict?: SkemaPilotPreviewCell;
}): SimulationStatus {
  if (teacherConflict || roomConflict) {
    return "conflict";
  }

  if (classConflict) {
    return "swap";
  }

  if (attentions.length > 0 && !attentions[0]?.startsWith("Ingen tydelige")) {
    return "check";
  }

  return "possible";
}

function getStatusTitle(status: SimulationStatus) {
  if (status === "possible") {
    return "Ser mulig ud";
  }

  if (status === "conflict") {
    return "Konflikt";
  }

  if (status === "swap") {
    return "Kræver byt";
  }

  return "Bør tjekkes";
}

function getStatusDescription(status: SimulationStatus) {
  if (status === "possible") {
    return "Der er ikke fundet lærer- eller lokalekonflikt i det lokale tjek.";
  }

  if (status === "conflict") {
    return "Flytningen skaber en konkret lærer- eller lokalekonflikt i den visuelle kladde.";
  }

  if (status === "swap") {
    return "Målet er optaget for klassen og skal behandles som et muligt byt.";
  }

  return "Flytningen kan være mulig, men bør vurderes manuelt før den bruges i et senere skema.";
}

function hasAdjacentSameSubject(
  allPreviewLessons: readonly SkemaPilotPreviewCell[],
  selectedLesson: SkemaPilotPreviewCell,
  day: string,
  lessonNumber: number,
) {
  return allPreviewLessons.some(
    (lesson) =>
      lesson.className === selectedLesson.className &&
      lesson.subject === selectedLesson.subject &&
      lesson.day === day &&
      Math.abs(lesson.lesson - lessonNumber) === 1 &&
      getSkemaPilotPreviewCellKey(lesson) !== getSkemaPilotPreviewCellKey(selectedLesson),
  );
}

function getTargetDaySubjectCount(
  allPreviewLessons: readonly SkemaPilotPreviewCell[],
  selectedLesson: SkemaPilotPreviewCell,
  targetDay: string,
) {
  return getClassSubjectCountOnDay(allPreviewLessons, selectedLesson.className, targetDay, {
    excludedCellKey: getSkemaPilotPreviewCellKey(selectedLesson),
    includeSubject: selectedLesson.isFixedBlock ? undefined : selectedLesson.subject,
  });
}

function formatLessonOptionLabel(cell: SkemaPilotPreviewCell) {
  return `${cell.className} · ${cell.subject} · ${cell.day} ${cell.lesson}. lektion`;
}

function formatTargetLesson(cell: SkemaPilotPreviewCell) {
  return `${cell.className} · ${cell.subject} · ${cell.teacherName ?? "Lærer ikke fordelt"} · ${
    cell.room ?? "Lokale ikke valgt"
  }`;
}

function formatSlot(day: string, lessonNumber: number) {
  return `${day.toLocaleLowerCase("da-DK")} ${lessonNumber}. lektion`;
}

function getGradeFromClassName(className: string) {
  const match = className.match(/\d+/);
  return match ? Number(match[0]) : 0;
}
