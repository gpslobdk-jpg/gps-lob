"use client";

import { AlertCircle, CalendarDays, Info, School } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type PreviewSettings = {
  schoolName: string;
  schoolYear: string;
  lessonsPerDay: string;
  startTime: string;
  endTime: string;
};

type PreviewCell = {
  day: string;
  lesson: number;
  note?: string;
  room?: string;
  subject: string;
};

type SkemaPilotPreviewProps = {
  activeBlocks: readonly string[];
  activeClasses: readonly string[];
  activeRooms: readonly string[];
  getLessonValue: (className: string, subject: string) => string;
  rubikClassName: string;
  settings: PreviewSettings;
  subjects: readonly string[];
};

const weekdays = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"] as const;

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
  rubikClassName,
  settings,
  subjects,
}: SkemaPilotPreviewProps) {
  const [selectedClass, setSelectedClass] = useState("");
  const previewClass = activeClasses.includes(selectedClass) ? selectedClass : activeClasses[0] ?? "0. klasse";
  const lessonCount = getLessonCount(settings.lessonsPerDay);
  const previewLessons = useMemo(
    () => buildPreviewLessons(previewClass, lessonCount, subjects, getLessonValue, activeBlocks, activeRooms),
    [activeBlocks, activeRooms, getLessonValue, lessonCount, previewClass, subjects],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-800">
            Prototype / dummy-preview
          </p>
          <h3 className={`mt-3 text-3xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            Skema-preview
          </h3>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Previewet er kun en visuel kladde. Det viser et deterministisk eksempel ud fra de lokale valg,
            men det er ikke et færdigt genereret skema.
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
              <li>Næste fase bliver konflikttjek.</li>
              <li>Senere kommer pædagogisk kvalitetsscore og AI-forslag.</li>
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status</p>
            <div className="mt-3 grid gap-2">
              <StatusLine text="Ingen hårde regler tjekkes endnu" />
              <StatusLine text="Ingen konflikter beregnes endnu" />
              <StatusLine text="Pædagogiske ønsker bruges senere" />
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
    </section>
  );
}

function PreviewSubjectCell({ cell }: { cell?: PreviewCell }) {
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
      {cell.room ? <p className="mt-2 text-xs font-bold opacity-75">{cell.room}</p> : null}
      {cell.note ? <p className="mt-2 text-xs font-bold opacity-75">{cell.note}</p> : null}
    </div>
  );
}

function MetaLine({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className="text-emerald-700">{icon}</span>
      {text}
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

function buildPreviewLessons(
  className: string,
  lessonCount: number,
  availableSubjects: readonly string[],
  getLessonValue: (className: string, subject: string) => string,
  activeBlocks: readonly string[],
  activeRooms: readonly string[],
) {
  const weightedSubjects = availableSubjects.flatMap((subject) => {
    const subjectCount = Math.max(0, Math.round(Number(getLessonValue(className, subject)) || 0));
    return Array.from({ length: Math.max(1, subjectCount) }, () => subject);
  });
  const subjectPool = weightedSubjects.length ? weightedSubjects : availableSubjects;

  return weekdays.flatMap((day, dayIndex) =>
    Array.from({ length: lessonCount }, (_, lessonIndex) => {
      const fixedSubject = getFixedBlockSubject(dayIndex, lessonIndex, activeBlocks);
      const subject = fixedSubject ?? subjectPool[(dayIndex * lessonCount + lessonIndex) % subjectPool.length];

      return {
        day,
        lesson: lessonIndex + 1,
        note: fixedSubject ? "Fast blok" : undefined,
        room: getRoomForSubject(subject, activeRooms),
        subject,
      };
    }),
  );
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

function getLessonCount(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 6;
  }

  return Math.min(10, Math.max(1, parsed));
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
