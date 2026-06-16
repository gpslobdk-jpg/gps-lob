"use client";

import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
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
  onApplyMove: (move: {
    className: string;
    fromDay: string;
    fromLesson: number;
    toDay: string;
    toLesson: number;
  }) => void;
  onApplySwap: (swap: {
    aFromDay: string;
    aFromLesson: number;
    bFromDay: string;
    bFromLesson: number;
    className: string;
  }) => void;
  prefill?: {
    lessonKey: string;
    targetDay: string;
    targetLesson: number;
    version: number;
  } | null;
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

type SwapSimulation = {
  attentions: string[];
  benefits: string[];
  status: "possible" | "check" | "conflict";
  swapLesson: SkemaPilotPreviewCell;
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
  onApplyMove,
  onApplySwap,
  prefill,
  rubikClassName,
}: SkemaPilotMoveSimulatorProps) {
  const lessonOptions = useMemo(() => buildLessonOptions(allPreviewLessons), [allPreviewLessons]);
  const [selectedLessonKey, setSelectedLessonKey] = useState("");
  const [targetDay, setTargetDay] = useState<string>(weekdays[0]);
  const [targetLessonNumber, setTargetLessonNumber] = useState(1);
  const [lastPrefillVersion, setLastPrefillVersion] = useState<number | null>(null);

  if (prefill && prefill.version !== lastPrefillVersion) {
    setLastPrefillVersion(prefill.version);
    setSelectedLessonKey(prefill.lessonKey);
    setTargetDay(prefill.targetDay);
    setTargetLessonNumber(prefill.targetLesson);
  }
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

  const swapSimulation = useMemo(
    () =>
      selectedLesson && simulation?.status === "swap" && simulation.targetLesson
        ? buildSwapSimulation({
            allPreviewLessons,
            lessonCount,
            selectedLesson,
            swapLesson: simulation.targetLesson,
          })
        : null,
    [allPreviewLessons, lessonCount, selectedLesson, simulation],
  );

  const isSameSlot =
    selectedLesson !== undefined &&
    selectedLesson.day === targetDay &&
    selectedLesson.lesson === targetLessonNumber;
  const canApplyMove =
    !isSameSlot &&
    simulation !== null &&
    (simulation.status === "possible" || simulation.status === "check");
  const canApplySwap =
    swapSimulation !== null &&
    (swapSimulation.status === "possible" || swapSimulation.status === "check");

  function handleApplyMove() {
    if (!selectedLesson || !canApplyMove) {
      return;
    }

    onApplyMove({
      className: selectedLesson.className,
      fromDay: selectedLesson.day,
      fromLesson: selectedLesson.lesson,
      toDay: targetDay,
      toLesson: targetLessonNumber,
    });
  }

  function handleApplySwap() {
    if (!selectedLesson || !swapSimulation || !canApplySwap) {
      return;
    }

    onApplySwap({
      aFromDay: selectedLesson.day,
      aFromLesson: selectedLesson.lesson,
      bFromDay: swapSimulation.swapLesson.day,
      bFromLesson: swapSimulation.swapLesson.lesson,
      className: selectedLesson.className,
    });
  }

  if (!lessonOptions.length) {
    return (
      <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Flyt/bytte-simulator
        </p>
        <h4 className={`mt-2 text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
          Flyt eller byt
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
            Flyt eller byt i visuel kladde
          </h4>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Vælg en lektion og et nyt tidspunkt. Simulatoren viser et lokalt tjek og giver mulighed
            for at anvende flytningen i den lokale kladde.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
          <div className="flex items-start gap-2">
            <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>Ingen ændringer gemmes permanent. Kladden nulstilles ved refresh.</p>
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

        {selectedLesson && simulation?.status === "swap" && swapSimulation ? (
          <SwapProposalCard selectedLesson={selectedLesson} swapSimulation={swapSimulation} />
        ) : simulation ? (
          <SimulationResult simulation={simulation} />
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm font-bold leading-6 text-slate-600">
          <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p>
            {canApplyMove
              ? "Flytningen ser sikker nok ud til at anvende i den lokale kladde."
              : canApplySwap
                ? "Byttet ser sikkert nok ud til at anvende i den lokale kladde."
                : "Ikke gemt – afventer valg eller kontroller simuleringsresultatet."}
          </p>
        </div>
        {canApplyMove ? (
          <button
            className="min-h-11 rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
            type="button"
            onClick={handleApplyMove}
          >
            Anvend i lokal kladde
          </button>
        ) : canApplySwap ? (
          <button
            className="min-h-11 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
            type="button"
            onClick={handleApplySwap}
          >
            Anvend bytte i lokal kladde
          </button>
        ) : simulation?.status === "swap" ? (
          <button
            className="min-h-11 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-black text-rose-400"
            disabled
            type="button"
          >
            Bytte giver konflikt
          </button>
        ) : simulation?.status === "conflict" ? (
          <button
            className="min-h-11 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-black text-rose-400"
            disabled
            type="button"
          >
            Konflikt – kan ikke anvendes
          </button>
        ) : (
          <button
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-400"
            disabled
            type="button"
          >
            {isSameSlot ? "Vælg et nyt tidspunkt" : "Ikke gemt"}
          </button>
        )}
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

function buildSwapSimulation({
  allPreviewLessons,
  lessonCount,
  selectedLesson,
  swapLesson,
}: {
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  lessonCount: number;
  selectedLesson: SkemaPilotPreviewCell;
  swapLesson: SkemaPilotPreviewCell;
}): SwapSimulation {
  const keyA = getSkemaPilotPreviewCellKey(selectedLesson);
  const keyB = getSkemaPilotPreviewCellKey(swapLesson);
  const lessonsExcludingBoth = allPreviewLessons.filter(
    (lesson) => getSkemaPilotPreviewCellKey(lesson) !== keyA && getSkemaPilotPreviewCellKey(lesson) !== keyB,
  );

  const aTeacherConflict =
    selectedLesson.teacherId && !selectedLesson.teacherMissing
      ? getTeacherPreviewConflictInSlot(
          lessonsExcludingBoth,
          selectedLesson.teacherId,
          selectedLesson.className,
          swapLesson.day,
          swapLesson.lesson,
        )
      : undefined;
  const aRoomConflict =
    selectedLesson.room && selectedLesson.roomIsShared
      ? getSharedRoomPreviewConflictInSlot(
          lessonsExcludingBoth,
          selectedLesson.room,
          selectedLesson.className,
          swapLesson.day,
          swapLesson.lesson,
        )
      : undefined;
  const bTeacherConflict =
    swapLesson.teacherId && !swapLesson.teacherMissing
      ? getTeacherPreviewConflictInSlot(
          lessonsExcludingBoth,
          swapLesson.teacherId,
          swapLesson.className,
          selectedLesson.day,
          selectedLesson.lesson,
        )
      : undefined;
  const bRoomConflict =
    swapLesson.room && swapLesson.roomIsShared
      ? getSharedRoomPreviewConflictInSlot(
          lessonsExcludingBoth,
          swapLesson.room,
          swapLesson.className,
          selectedLesson.day,
          selectedLesson.lesson,
        )
      : undefined;

  const hasHardConflict = !!(aTeacherConflict || aRoomConflict || bTeacherConflict || bRoomConflict);
  const attentions: string[] = [];
  const benefits: string[] = [];

  if (aTeacherConflict && selectedLesson.teacherName) {
    attentions.push(
      `${selectedLesson.teacherName} underviser allerede ${aTeacherConflict.className} i ${aTeacherConflict.subject} ${formatSlot(swapLesson.day, swapLesson.lesson)}.`,
    );
  }

  if (aRoomConflict && selectedLesson.room) {
    attentions.push(
      `${selectedLesson.room} bruges allerede af ${aRoomConflict.className} ${formatSlot(swapLesson.day, swapLesson.lesson)}.`,
    );
  }

  if (bTeacherConflict && swapLesson.teacherName) {
    attentions.push(
      `${swapLesson.teacherName} underviser allerede ${bTeacherConflict.className} i ${bTeacherConflict.subject} ${formatSlot(selectedLesson.day, selectedLesson.lesson)}.`,
    );
  }

  if (bRoomConflict && swapLesson.room) {
    attentions.push(
      `${swapLesson.room} bruges allerede af ${bRoomConflict.className} ${formatSlot(selectedLesson.day, selectedLesson.lesson)}.`,
    );
  }

  const aPedWarnings = getPedagogicalWarnings({
    allPreviewLessons: lessonsExcludingBoth,
    lessonCount,
    selectedLesson,
    targetDay: swapLesson.day,
    targetLessonNumber: swapLesson.lesson,
  });
  const bPedWarnings = getPedagogicalWarnings({
    allPreviewLessons: lessonsExcludingBoth,
    lessonCount,
    selectedLesson: swapLesson,
    targetDay: selectedLesson.day,
    targetLessonNumber: selectedLesson.lesson,
  });

  attentions.push(...aPedWarnings, ...bPedWarnings);

  if (!hasHardConflict) {
    benefits.push("Ingen lærer- eller lokalekonflikt fundet for byttet i kladden.");
  }

  if (selectedLesson.day !== swapLesson.day) {
    benefits.push(`Byttet fordeler lektionerne på ${selectedLesson.day} og ${swapLesson.day}.`);
  } else {
    benefits.push("Begge lektioner forbliver på samme dag og bytter kun tidspunkt.");
  }

  benefits.push("Byttet er reversibelt via Fortryd seneste i kladden.");

  const status: "possible" | "check" | "conflict" = hasHardConflict
    ? "conflict"
    : attentions.length > 0
      ? "check"
      : "possible";

  return {
    attentions: attentions.slice(0, 6),
    benefits: benefits.slice(0, 4),
    status,
    swapLesson,
  };
}

function SwapProposalCard({
  selectedLesson,
  swapSimulation,
}: {
  selectedLesson: SkemaPilotPreviewCell;
  swapSimulation: SwapSimulation;
}) {
  const swapLesson = swapSimulation.swapLesson;
  const statusLabel =
    swapSimulation.status === "possible"
      ? "Bytte ser muligt ud"
      : swapSimulation.status === "check"
        ? "Bytte bør tjekkes"
        : "Bytte giver konflikt";
  const statusClassName =
    swapSimulation.status === "possible"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : swapSimulation.status === "check"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-rose-200 bg-rose-50 text-rose-950";
  const StatusIcon = swapSimulation.status === "possible" ? CheckCircle2 : AlertTriangle;
  const iconClassName =
    swapSimulation.status === "possible"
      ? "text-emerald-700"
      : swapSimulation.status === "check"
        ? "text-amber-700"
        : "text-rose-700";

  return (
    <article className={`rounded-lg border p-4 ${statusClassName}`}>
      <div className="flex items-start gap-3">
        <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClassName}`} />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em]">Bytteforslag</p>
          <h5 className="mt-2 text-2xl font-black tracking-tight">{statusLabel}</h5>
        </div>
      </div>

      <div className="mt-4 grid gap-1 rounded-lg border border-current/10 bg-white/60 p-3 text-sm font-bold leading-6">
        <p className="mb-1 text-xs font-black uppercase tracking-[0.12em] opacity-60">Bytter plads</p>
        <p>
          {selectedLesson.subject} · {selectedLesson.className} · {selectedLesson.day}{" "}
          {selectedLesson.lesson}. lektion
        </p>
        <p className="text-xs font-black opacity-50">↕</p>
        <p>
          {swapLesson.subject} · {swapLesson.className} · {swapLesson.day} {swapLesson.lesson}. lektion
        </p>
      </div>

      <div className="mt-3 grid gap-3">
        <ResultList items={swapSimulation.benefits} title="Mulige fordele" tone="good" />
        <ResultList items={swapSimulation.attentions} title="Opmærksomhedspunkter" tone="attention" />
      </div>
    </article>
  );
}
