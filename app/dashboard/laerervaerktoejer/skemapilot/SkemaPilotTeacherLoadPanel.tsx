"use client";

import { AlertTriangle, BarChart3, Clock3, Gauge, Rows3, UsersRound } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { SubjectAssignmentTeacher } from "./SkemaPilotSubjectAssignment";
import {
  getTeacherLoadRecommendations,
  getTeacherLoadSummary,
  getTeacherScheduleAnalyses,
  type SkemaPilotPreviewCell,
  type TeacherScheduleAnalysis,
  type TeacherScheduleStatus,
} from "./skemaPilotPreviewData";

type SkemaPilotTeacherLoadPanelProps = {
  allPreviewLessons: readonly SkemaPilotPreviewCell[];
  lessonCount: number;
  rubikClassName: string;
  teachers: readonly SubjectAssignmentTeacher[];
};

const statusClassNames: Record<TeacherScheduleStatus, { badge: string; card: string }> = {
  calm: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    card: "border-emerald-200 bg-emerald-50/35",
  },
  check: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    card: "border-amber-200 bg-amber-50/45",
  },
  manyGaps: {
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    card: "border-rose-200 bg-rose-50/40",
  },
  compact: {
    badge: "border-orange-200 bg-orange-50 text-orange-800",
    card: "border-orange-200 bg-orange-50/40",
  },
};

export function SkemaPilotTeacherLoadPanel({
  allPreviewLessons,
  lessonCount,
  rubikClassName,
  teachers,
}: SkemaPilotTeacherLoadPanelProps) {
  const analyses = useMemo(
    () => getTeacherScheduleAnalyses(allPreviewLessons, teachers, lessonCount),
    [allPreviewLessons, lessonCount, teachers],
  );
  const summary = useMemo(() => getTeacherLoadSummary(analyses), [analyses]);
  const recommendations = useMemo(() => getTeacherLoadRecommendations(analyses), [analyses]);

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Lærerbelastning</p>
          <h4 className={`mt-2 text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            Mulige huller og belastning
          </h4>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Panelet analyserer alle navngivne lærere i den visuelle kladde. Det er et lokalt estimat til
            dialog, ikke et færdigt lærerskema.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-xs font-black uppercase tracking-[0.14em]">Lokalt estimat</p>
          <p className="mt-2 text-sm font-bold leading-6">
            Mulige huller betyder tomme lektioner mellem lærerens første og sidste undervisningslektion samme dag.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric
          icon={<UsersRound className="h-4 w-4" />}
          label="Lærere analyseret"
          value={String(summary.analyzedTeachers)}
        />
        <SummaryMetric
          icon={<Clock3 className="h-4 w-4" />}
          label="Samlede mulige huller"
          value={String(summary.totalPossibleGaps)}
        />
        <SummaryMetric
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Bør tjekkes"
          value={String(summary.teachersToCheck)}
        />
        <SummaryMetric
          icon={<BarChart3 className="h-4 w-4" />}
          label="Mest belastede"
          value={
            summary.busiestTeacherLessons > 0
              ? `${summary.busiestTeacherName} (${summary.busiestTeacherLessons})`
              : summary.busiestTeacherName
          }
        />
      </div>

      {!analyses.length ? (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-600">
          Tilføj lærere og fagfordeling for at se lærerbelastning.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-3">
            {analyses.map((analysis) => (
              <TeacherLoadCard key={analysis.teacherId} analysis={analysis} />
            ))}
          </div>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-950">
              <Gauge className="h-5 w-5 text-emerald-700" />
              <h5 className="text-sm font-black uppercase tracking-[0.14em]">Lokale anbefalinger</h5>
            </div>
            <ul className="mt-4 grid gap-3 text-sm font-bold leading-6 text-slate-700">
              {recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}

function SummaryMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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

function TeacherLoadCard({ analysis }: { analysis: TeacherScheduleAnalysis }) {
  const styles = statusClassNames[analysis.status];

  return (
    <article className={`rounded-lg border p-4 ${styles.card}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-sm font-black text-slate-950">{analysis.teacherName}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{analysis.statusDescription}</p>
        </div>
        <span
          className={`inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg border px-3 py-1 text-xs font-black ${styles.badge}`}
        >
          {analysis.statusLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        <TeacherStat label="Lektioner" value={String(analysis.placedLessons)} />
        <TeacherStat label="Dage" value={String(analysis.teachingDays)} />
        <TeacherStat label="Mulige huller" value={String(analysis.possibleGaps)} />
        <TeacherStat label="Længste blok" value={String(analysis.longestContinuousBlock)} />
        <TeacherStat label="Spredte dage" value={String(analysis.spreadDays.length)} />
      </div>

      {analysis.spreadDays.length || analysis.compactDays.length ? (
        <div className="mt-4 grid gap-2 text-xs font-bold leading-5 text-slate-600 sm:grid-cols-2">
          <DetailLine
            icon={<Rows3 className="h-4 w-4" />}
            label="Spredte dage"
            value={analysis.spreadDays.length ? analysis.spreadDays.join(", ") : "Ingen tydelige"}
          />
          <DetailLine
            icon={<BarChart3 className="h-4 w-4" />}
            label="Meget kompakte dage"
            value={analysis.compactDays.length ? analysis.compactDays.join(", ") : "Ingen tydelige"}
          />
        </div>
      ) : null}
    </article>
  );
}

function TeacherStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function DetailLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <p className="flex min-w-0 items-start gap-2 rounded-lg border border-white/70 bg-white/70 px-3 py-2">
      <span className="shrink-0 text-slate-500">{icon}</span>
      <span className="min-w-0">
        <span className="block font-black uppercase tracking-[0.1em] text-slate-500">{label}</span>
        <span className="mt-1 block break-words text-slate-700">{value}</span>
      </span>
    </p>
  );
}
