"use client";

import { CalendarDays, Clock3, Columns3, UserRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  getAvailableSubjectTeachers,
  getTeacherDisplayName,
  type SubjectAssignmentTeacher,
} from "./SkemaPilotSubjectAssignment";
import {
  getTeacherPreviewLessons,
  getTeacherScheduleStats,
  type SkemaPilotPreviewCell,
  weekdays,
} from "./skemaPilotPreviewData";

type SkemaPilotTeacherPreviewProps = {
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  lessonCount: number;
  rubikClassName: string;
  teachers: readonly SubjectAssignmentTeacher[];
};

export function SkemaPilotTeacherPreview({
  allPreviewLessons,
  lessonCount,
  rubikClassName,
  teachers,
}: SkemaPilotTeacherPreviewProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const availableTeachers = useMemo(() => getAvailableSubjectTeachers(teachers), [teachers]);
  const resolvedTeacherId = availableTeachers.some((teacher) => teacher.id === selectedTeacherId)
    ? selectedTeacherId
    : availableTeachers[0]?.id ?? "";
  const selectedTeacher = availableTeachers.find((teacher) => teacher.id === resolvedTeacherId);
  const teacherLessons = useMemo(
    () => getTeacherPreviewLessons(allPreviewLessons, resolvedTeacherId),
    [allPreviewLessons, resolvedTeacherId],
  );
  const scheduleStats = useMemo(
    () => getTeacherScheduleStats(allPreviewLessons, resolvedTeacherId, lessonCount),
    [allPreviewLessons, lessonCount, resolvedTeacherId],
  );

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Lærerskema-preview</p>
          <h4 className={`mt-2 text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            Visuel ugekladde for lærer
          </h4>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Vælg en lærer og se, hvor læreren optræder i den samme lokale kladde som klassepreviewet. Det er et
            lokalt estimat, ikke et færdigt arbejdsskema.
          </p>
        </div>

        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 lg:w-[320px]">
          <label className="block">
            <span className="text-sm font-black text-slate-950">Lærer</span>
            <select
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              disabled={!availableTeachers.length}
              value={resolvedTeacherId}
              onChange={(event) => setSelectedTeacherId(event.target.value)}
            >
              {!availableTeachers.length ? <option value="">Ingen lærere endnu</option> : null}
              {availableTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {getTeacherDisplayName(teacher)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Lokalt estimat fra visuel kladde
          </p>
        </div>
      </div>

      {!availableTeachers.length ? (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-950">
          Tilføj lærere og fagfordeling for at se lærerskema.
        </p>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TeacherMetric
              icon={<CalendarDays className="h-4 w-4" />}
              label="Placerede lektioner"
              value={String(scheduleStats.placedLessons)}
            />
            <TeacherMetric
              icon={<Columns3 className="h-4 w-4" />}
              label="Undervisningsdage"
              value={String(scheduleStats.teachingDays)}
            />
            <TeacherMetric
              icon={<Clock3 className="h-4 w-4" />}
              label="Mulige huller"
              value={String(scheduleStats.possibleGaps)}
            />
            <TeacherMetric
              icon={<UserRound className="h-4 w-4" />}
              label="Længste blok"
              value={`${scheduleStats.longestContinuousBlock} lektioner`}
            />
          </div>

          {!teacherLessons.length ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-600">
              Denne lærer har endnu ingen fag i fagfordelingen.
            </p>
          ) : null}

          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Ugekladde</p>
                <p className="mt-1 break-words text-sm font-black text-slate-950">
                  {selectedTeacher ? getTeacherDisplayName(selectedTeacher) : "Valgt lærer"}
                </p>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Bredt preview - scroll vandret på små skærme
              </p>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[820px] border-collapse text-left">
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
                        const lessonsInSlot = teacherLessons.filter(
                          (lesson) => lesson.day === day && lesson.lesson === lessonIndex + 1,
                        );

                        return (
                          <td key={`${day}-${lessonIndex + 1}`} className="px-2 py-2 align-top">
                            <TeacherSlotCell lessons={lessonsInSlot} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TeacherMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-600">
        {icon}
        <p className="text-xs font-black uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className="mt-2 break-words text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">Lokalt estimat</p>
    </article>
  );
}

function TeacherSlotCell({ lessons }: { lessons: readonly SkemaPilotPreviewCell[] }) {
  if (!lessons.length) {
    return (
      <div className="min-h-16 rounded-lg border border-slate-100 bg-white px-3 py-3 text-sm font-bold text-slate-400">
        Ledig
      </div>
    );
  }

  return (
    <div className="min-h-16 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-950 shadow-sm">
      <div className="grid gap-2">
        {lessons.map((lesson) => (
          <div key={`${lesson.className}-${lesson.subject}-${lesson.day}-${lesson.lesson}`} className="min-w-0">
            <p className="break-words text-sm font-black leading-5">{lesson.className}</p>
            <p className="mt-1 break-words text-xs font-bold leading-5 opacity-80">{lesson.subject}</p>
          </div>
        ))}
      </div>
      {lessons.length > 1 ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-white/80 px-2 py-1 text-xs font-black leading-4 text-amber-800">
          Mulig dobbeltbooking
        </p>
      ) : null}
    </div>
  );
}
