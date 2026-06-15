"use client";

import { AlertCircle, CalendarDays, Info, School } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { SkemaPilotAiMockPanel } from "./SkemaPilotAiMockPanel";
import { SkemaPilotConflictPanel } from "./SkemaPilotConflictPanel";
import { SkemaPilotMoveSimulator } from "./SkemaPilotMoveSimulator";
import { SkemaPilotOverviewPanel } from "./SkemaPilotOverviewPanel";
import { SkemaPilotQualityPanel } from "./SkemaPilotQualityPanel";
import { SkemaPilotRoomPreview } from "./SkemaPilotRoomPreview";
import { SkemaPilotTeacherLoadPanel } from "./SkemaPilotTeacherLoadPanel";
import { SkemaPilotTeacherPreview } from "./SkemaPilotTeacherPreview";
import {
  type SubjectAssignmentMap,
  type SubjectAssignmentStatus,
  type SubjectAssignmentTeacher,
  type TeacherLoad,
} from "./SkemaPilotSubjectAssignment";
import {
  applyManualMovesToLessons,
  buildSkemaPilotPreviewLessons,
  getSkemaPilotLessonCount,
  type ManualMove,
  type SkemaPilotPreviewCell,
  weekdays,
} from "./skemaPilotPreviewData";

type PriorityLevel = "Lav" | "Middel" | "Høj";

type PreviewSettings = {
  schoolName: string;
  schoolYear: string;
  lessonsPerDay: string;
  startTime: string;
  endTime: string;
};

type SkemaPilotPreviewProps = {
  activeBlocks: readonly string[];
  activeClasses: readonly string[];
  activeRooms: readonly string[];
  getLessonValue: (className: string, subject: string) => string;
  priorities: Record<string, PriorityLevel>;
  rubikClassName: string;
  settings: PreviewSettings;
  subjectAssignments: SubjectAssignmentMap;
  subjectAssignmentStatus: SubjectAssignmentStatus;
  subjects: readonly string[];
  teachers: readonly SubjectAssignmentTeacher[];
  teacherLoads: readonly TeacherLoad[];
};

const subjectColors: Record<string, string> = {
  Dansk: "border-emerald-200 bg-emerald-50 text-emerald-950",
  Matematik: "border-sky-200 bg-sky-50 text-sky-950",
  Engelsk: "border-indigo-200 bg-indigo-50 text-indigo-950",
  Idræt: "border-lime-200 bg-lime-50 text-lime-950",
  Musik: "border-rose-200 bg-rose-50 text-rose-950",
  "Billedkunst/krea": "border-amber-200 bg-amber-50 text-amber-950",
  "Natur/teknologi": "border-teal-200 bg-teal-50 text-teal-950",
  Morgensamling: "border-slate-300 bg-slate-100 text-slate-800",
  Læsebånd: "border-violet-200 bg-violet-50 text-violet-950",
  Fællessamling: "border-slate-300 bg-slate-100 text-slate-800",
};

export function SkemaPilotPreview({
  activeBlocks,
  activeClasses,
  activeRooms,
  getLessonValue,
  priorities,
  rubikClassName,
  settings,
  subjectAssignments,
  subjectAssignmentStatus,
  subjects,
  teachers,
  teacherLoads,
}: SkemaPilotPreviewProps) {
  const [selectedClass, setSelectedClass] = useState("");
  const [manualMoves, setManualMoves] = useState<ManualMove[]>([]);
  const previewClass = activeClasses.includes(selectedClass) ? selectedClass : activeClasses[0] ?? "0. klasse";
  const lessonCount = getSkemaPilotLessonCount(settings.lessonsPerDay);
  const allPreviewLessons = useMemo(
    () =>
      activeClasses.flatMap((className) =>
        buildSkemaPilotPreviewLessons(
          className,
          lessonCount,
          subjects,
          getLessonValue,
          activeBlocks,
          activeRooms,
          subjectAssignments,
          teachers,
        ),
      ),
    [activeBlocks, activeClasses, activeRooms, getLessonValue, lessonCount, subjectAssignments, subjects, teachers],
  );
  const effectiveLessons = useMemo(
    () => applyManualMovesToLessons(allPreviewLessons, manualMoves),
    [allPreviewLessons, manualMoves],
  );
  const effectivePreviewLessons = useMemo(
    () => effectiveLessons.filter((lesson) => lesson.className === previewClass),
    [effectiveLessons, previewClass],
  );

  function handleApplyMove(move: {
    className: string;
    fromDay: string;
    fromLesson: number;
    toDay: string;
    toLesson: number;
  }) {
    setManualMoves((previous) => [...previous, { ...move, id: `move-${Date.now()}` }]);
  }

  function handleUndoLastMove() {
    setManualMoves((previous) => previous.slice(0, -1));
  }

  function handleResetMoves() {
    setManualMoves([]);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-800">
            Prototype / visuel kladde
          </p>
          <h3 className={`mt-3 text-3xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            Skema-preview
          </h3>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Alle paneler herunder bruger samme lokale kladde. De samler overblik, visuelle skemaer,
            analyser og dialog-eksempler uden at gemme eller flytte lektioner.
          </p>
        </div>

        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 lg:w-[320px]">
          <label className="block">
            <span className="text-sm font-black text-slate-950">Preview-klasse</span>
            <select
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              value={previewClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              {activeClasses.length ? (
                activeClasses.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))
              ) : (
                <option value={previewClass}>{previewClass}</option>
              )}
            </select>
          </label>
          <div className="mt-4 grid gap-2 text-sm font-bold leading-6 text-slate-600">
            <MetaLine icon={<School className="h-4 w-4" />} text={settings.schoolName || "Skole ikke navngivet"} />
            <MetaLine icon={<CalendarDays className="h-4 w-4" />} text={settings.schoolYear} />
            <MetaLine icon={<Info className="h-4 w-4" />} text={`${settings.startTime}-${settings.endTime}`} />
          </div>
        </div>
      </div>

      <SectionNavigation />

      {manualMoves.length > 0 ? (
        <div className="mt-5 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Lokal kladde ændret</p>
              <p className="mt-1 text-sm font-bold leading-6 text-sky-950">
                {manualMoves.length === 1
                  ? "1 manuel flytning er anvendt i denne visning."
                  : `${manualMoves.length} manuelle flytninger er anvendt i denne visning.`}{" "}
                Ændringerne er ikke gemt.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={handleUndoLastMove}
                className="min-h-10 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-black text-sky-800 transition hover:border-sky-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
              >
                Fortryd seneste
              </button>
              <button
                type="button"
                onClick={handleResetMoves}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition hover:border-rose-200 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
              >
                Nulstil kladde
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PreviewSectionIntro
        id="skemapilot-overblik"
        label="Overblik"
        title="Status først, detaljer bagefter"
        description="Start med skolelederens samlede status og en simuleret flytning. Begge dele er lokale tjek på den samme kladde."
      />

      <SkemaPilotOverviewPanel
        activeClasses={activeClasses}
        activeRooms={activeRooms}
        allPreviewLessons={effectiveLessons}
        getLessonValue={getLessonValue}
        lessonCount={lessonCount}
        rubikClassName={rubikClassName}
        subjectAssignmentStatus={subjectAssignmentStatus}
        subjects={subjects}
        teachers={teachers}
      />

      <SkemaPilotMoveSimulator
        allPreviewLessons={effectiveLessons}
        lessonCount={lessonCount}
        onApplyMove={handleApplyMove}
        rubikClassName={rubikClassName}
      />

      <PreviewSectionIntro
        id="skemapilot-visuelle-skemaer"
        label="Visuelle skemaer"
        title="Klasse, lærer og lokale"
        description="Her vises den samme ugekladde fra tre vinkler, så sammenhængen mellem klasse, lærer og lokale er lettere at følge."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 lg:hidden">
          Bredt preview - scroll vandret på små skærme
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                <th className="w-28 border-b border-slate-200 px-3 py-3">Lektion</th>
                {weekdays.map((day) => (
                  <th key={day} className="border-b border-slate-200 px-3 py-3">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: lessonCount }, (_, lessonIndex) => (
                <tr key={lessonIndex + 1} className="border-b border-slate-100 last:border-b-0">
                  <th className="bg-slate-50 px-3 py-3 align-top text-sm font-black text-slate-700">
                    {lessonIndex + 1}. lektion
                  </th>
                  {weekdays.map((day) => {
                    const cell = effectivePreviewLessons.find(
                      (lesson) => lesson.day === day && lesson.lesson === lessonIndex + 1,
                    );

                    return (
                      <td key={`${day}-${lessonIndex + 1}`} className="px-2 py-2 align-top">
                        <PreviewSubjectCell cell={cell} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Klasseskema</p>
            <ul className="mt-3 grid gap-2 text-sm font-bold leading-6 text-amber-950">
              <li>Valgt klasse vises som ugekladde.</li>
              <li>Cellerne viser fag, lærer og lokale.</li>
              <li>Detaljer følger i lærer- og lokaleskema.</li>
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status</p>
            <div className="mt-3 grid gap-2">
              <StatusLine text="Samme lokale kladde bruges på tværs" />
              <StatusLine
                text={`${subjectAssignmentStatus.assignedItems}/${subjectAssignmentStatus.totalItems} fagposter fordelt`}
              />
                <StatusLine text="Flytninger kan anvendes i lokal kladde" />
              <StatusLine text="Pædagogiske ønsker indgår i kvalitetsscoren" />
            </div>
          </section>

          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Lokale noter</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...activeRooms.slice(0, 3), ...activeBlocks.slice(0, 3)].map((item) => (
                <span
                  key={item}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-950"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <SkemaPilotTeacherPreview
        allPreviewLessons={effectiveLessons}
        lessonCount={lessonCount}
        rubikClassName={rubikClassName}
        teachers={teachers}
      />
      <SkemaPilotRoomPreview
        activeRooms={activeRooms}
        allPreviewLessons={effectiveLessons}
        lessonCount={lessonCount}
        rubikClassName={rubikClassName}
      />

      <PreviewSectionIntro
        id="skemapilot-analyser"
        label="Analyser"
        title="Konflikter, belastning og kvalitet"
        description="Brug disse paneler til at finde det, der bør tjekkes, før kladden bruges i videre dialog."
      />

      <SkemaPilotConflictPanel
        activeBlocks={activeBlocks}
        activeClasses={activeClasses}
        activeRooms={activeRooms}
        getLessonValue={getLessonValue}
        allPreviewLessons={effectiveLessons}
        lessonCount={lessonCount}
        previewClass={previewClass}
        rubikClassName={rubikClassName}
        subjectAssignmentStatus={subjectAssignmentStatus}
        subjects={subjects}
      />
      <SkemaPilotTeacherLoadPanel
        allPreviewLessons={effectiveLessons}
        lessonCount={lessonCount}
        rubikClassName={rubikClassName}
        teachers={teachers}
      />
      <SkemaPilotQualityPanel
        allPreviewLessons={effectiveLessons}
        lessonCount={lessonCount}
        previewClass={previewClass}
        previewLessons={effectivePreviewLessons}
        priorities={priorities}
        rubikClassName={rubikClassName}
        subjectAssignmentStatus={subjectAssignmentStatus}
        teacherLoads={teacherLoads}
      />

      <PreviewSectionIntro
        id="skemapilot-dialog"
        label="Dialog og næste skridt"
        title="Eksempler uden AI-forbindelse"
        description="Dialogpanelet viser faste eksempler på, hvordan SkemaPilot senere kan støtte samtalen om skemaets rytme."
      />

      <SkemaPilotAiMockPanel
        previewClass={previewClass}
        priorities={priorities}
        rubikClassName={rubikClassName}
        subjectAssignmentStatus={subjectAssignmentStatus}
        teacherLoads={teacherLoads}
      />
    </section>
  );
}

function SectionNavigation() {
  const sections = [
    { href: "#skemapilot-overblik", label: "Overblik" },
    { href: "#skemapilot-visuelle-skemaer", label: "Visuelle skemaer" },
    { href: "#skemapilot-analyser", label: "Analyser" },
    { href: "#skemapilot-dialog", label: "Dialog" },
  ];

  return (
    <nav className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Opsummeringen er delt op</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {sections.map((section) => (
          <a
            key={section.href}
            className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800"
            href={section.href}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function PreviewSectionIntro({
  description,
  id,
  label,
  title,
}: {
  description: string;
  id: string;
  label: string;
  title: string;
}) {
  return (
    <section id={id} className="mt-8 border-t border-slate-200 pt-6">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{label}</p>
      <h4 className="mt-2 text-xl font-black tracking-tight text-slate-950">{title}</h4>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-600">{description}</p>
    </section>
  );
}

function PreviewSubjectCell({ cell }: { cell?: SkemaPilotPreviewCell }) {
  if (!cell) {
    return (
      <div className="min-h-20 rounded-lg border border-slate-100 bg-white px-3 py-3 text-sm font-bold text-slate-400">
        Tom
      </div>
    );
  }

  const colorClassName = subjectColors[cell.subject] ?? "border-slate-200 bg-white text-slate-800";

  return (
    <div className={`min-h-20 rounded-lg border px-3 py-3 shadow-sm ${colorClassName}`}>
      <p className="text-sm font-black leading-5">{cell.subject}</p>
      {cell.teacherName ? (
        <p className="mt-2 break-words text-xs font-black leading-5 opacity-80">Lærer: {cell.teacherName}</p>
      ) : null}
      {cell.teacherMissing ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs font-black leading-4 text-amber-800">
          Ikke fordelt
        </p>
      ) : null}
      {cell.room ? <p className="mt-2 break-words text-xs font-bold opacity-75">Lokale: {cell.room}</p> : null}
      {cell.roomMissing ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs font-black leading-4 text-amber-800">
          Lokale mangler
        </p>
      ) : null}
      {cell.note ? <p className="mt-2 text-xs font-bold opacity-75">{cell.note}</p> : null}
    </div>
  );
}

function MetaLine({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <p className="flex min-w-0 items-start gap-2">
      <span className="shrink-0 text-emerald-700">{icon}</span>
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}

function StatusLine({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-sm font-bold leading-6 text-slate-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      {text}
    </p>
  );
}
