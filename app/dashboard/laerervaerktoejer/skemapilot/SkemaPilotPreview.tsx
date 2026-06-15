"use client";

import { AlertCircle, CalendarDays, Info, School } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { SkemaPilotAiMockPanel } from "./SkemaPilotAiMockPanel";
import { SkemaPilotConflictPanel } from "./SkemaPilotConflictPanel";
import { SkemaPilotQualityPanel } from "./SkemaPilotQualityPanel";
import { SkemaPilotTeacherLoadPanel } from "./SkemaPilotTeacherLoadPanel";
import { SkemaPilotTeacherPreview } from "./SkemaPilotTeacherPreview";
import {
  type SubjectAssignmentMap,
  type SubjectAssignmentStatus,
  type SubjectAssignmentTeacher,
  type TeacherLoad,
} from "./SkemaPilotSubjectAssignment";
import {
  buildSkemaPilotPreviewLessons,
  getSkemaPilotLessonCount,
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
  const previewClass = activeClasses.includes(selectedClass) ? selectedClass : activeClasses[0] ?? "0. klasse";
  const lessonCount = getSkemaPilotLessonCount(settings.lessonsPerDay);
  const previewLessons = useMemo(
    () =>
      buildSkemaPilotPreviewLessons(
        previewClass,
        lessonCount,
        subjects,
        getLessonValue,
        activeBlocks,
        activeRooms,
        subjectAssignments,
        teachers,
      ),
    [activeBlocks, activeRooms, getLessonValue, lessonCount, previewClass, subjectAssignments, subjects, teachers],
  );
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
            Previewet er en visuel kladde baseret på de lokale valg. Det er ikke et færdigt genereret skema
            og flytter ikke lektioner automatisk.
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
                    const cell = previewLessons.find(
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
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Dette viser previewet</p>
            <ul className="mt-3 grid gap-2 text-sm font-bold leading-6 text-amber-950">
              <li>Previewet er kun en visuel kladde.</li>
              <li>Konflikttjek og kvalitetsscore vises under skemaet.</li>
              <li>Dialogpanelet viser faste eksempelsvar.</li>
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status</p>
            <div className="mt-3 grid gap-2">
              <StatusLine text="Lokale tjek bygger på prototype-data" />
              <StatusLine
                text={`${subjectAssignmentStatus.assignedItems}/${subjectAssignmentStatus.totalItems} fagposter er fordelt til lærere`}
              />
              <StatusLine text="Preview-celler viser lærer, når fagfordelingen er udfyldt" />
              <StatusLine text="Ingen automatisk flytning af lektioner" />
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
        allPreviewLessons={allPreviewLessons}
        lessonCount={lessonCount}
        rubikClassName={rubikClassName}
        teachers={teachers}
      />
      <SkemaPilotTeacherLoadPanel
        allPreviewLessons={allPreviewLessons}
        lessonCount={lessonCount}
        rubikClassName={rubikClassName}
        teachers={teachers}
      />
      <SkemaPilotConflictPanel
        activeBlocks={activeBlocks}
        activeClasses={activeClasses}
        getLessonValue={getLessonValue}
        allPreviewLessons={allPreviewLessons}
        lessonCount={lessonCount}
        previewClass={previewClass}
        rubikClassName={rubikClassName}
        subjectAssignmentStatus={subjectAssignmentStatus}
        subjects={subjects}
      />
      <SkemaPilotQualityPanel
        allPreviewLessons={allPreviewLessons}
        lessonCount={lessonCount}
        previewClass={previewClass}
        previewLessons={previewLessons}
        priorities={priorities}
        rubikClassName={rubikClassName}
        subjectAssignmentStatus={subjectAssignmentStatus}
        teacherLoads={teacherLoads}
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
        <p className="mt-2 break-words text-xs font-black leading-5 opacity-80">{cell.teacherName}</p>
      ) : null}
      {cell.teacherMissing ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs font-black leading-4 text-amber-800">
          Ikke fordelt
        </p>
      ) : null}
      {cell.room ? <p className="mt-2 text-xs font-bold opacity-75">{cell.room}</p> : null}
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
