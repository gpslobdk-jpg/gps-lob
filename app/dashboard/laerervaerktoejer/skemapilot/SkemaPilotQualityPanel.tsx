"use client";

import { CircleDashed, Gauge, Lightbulb, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import type { SubjectAssignmentStatus, TeacherLoad } from "./SkemaPilotSubjectAssignment";

type PriorityLevel = "Lav" | "Middel" | "Høj";

type QualityPreviewCell = {
  day: string;
  lesson: number;
  note?: string;
  room?: string;
  subject: string;
};

type QualityPanelProps = {
  lessonCount: number;
  previewClass: string;
  previewLessons: readonly QualityPreviewCell[];
  priorities: Record<string, PriorityLevel>;
  rubikClassName: string;
  subjectAssignmentStatus: SubjectAssignmentStatus;
  teacherLoads: readonly TeacherLoad[];
};

type QualityMetric = {
  description: string;
  label: string;
  score: number;
  status: "good" | "medium" | "low" | "unknown";
  title: string;
  weight: number;
};

const coreSubjects = ["Dansk", "Matematik"] as const;
const heavySubjects = ["Dansk", "Matematik", "Engelsk", "Natur/teknologi"] as const;
const creativeSubjects = ["Musik", "Billedkunst/krea"] as const;
const fixedSubjects = ["Morgensamling", "Læsebånd", "Fællessamling"] as const;

const statusClassNames = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-950",
  medium: "border-amber-200 bg-amber-50 text-amber-950",
  low: "border-rose-200 bg-rose-50 text-rose-950",
  unknown: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

export function SkemaPilotQualityPanel({
  lessonCount,
  previewClass,
  previewLessons,
  priorities,
  rubikClassName,
  subjectAssignmentStatus,
  teacherLoads,
}: QualityPanelProps) {
  const grade = getGradeFromClassName(previewClass);
  const metrics = buildQualityMetrics(previewLessons, lessonCount, grade, priorities, subjectAssignmentStatus);
  const scoredMetrics = metrics.filter((metric) => metric.status !== "unknown");
  const weightedTotal = scoredMetrics.reduce((total, metric) => total + metric.score * metric.weight, 0);
  const weightTotal = scoredMetrics.reduce((total, metric) => total + metric.weight, 0);
  const score = weightTotal ? Math.round(weightedTotal / weightTotal) : 70;
  const strengths = buildStrengths(metrics, grade);
  const improvements = buildImprovements(metrics);
  const teacherLoadInsight = getTeacherLoadInsight(teacherLoads, subjectAssignmentStatus);

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Pædagogisk kvalitet
          </p>
          <h4 className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            Pædagogisk kvalitet: {score} / 100
          </h4>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Scoren er en lokal, regelbaseret indikator på den visuelle kladde. Den ændrer ikke skemaet og
            erstatter ikke skolens faglige vurdering.
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <Gauge className="h-6 w-6" />
          <p className="mt-3 text-sm font-black uppercase tracking-[0.14em]">Lokal score</p>
          <p className="mt-1 text-sm font-bold leading-6">
            Bygger på bløde ønsker og den valgte klasses visuelle kladde.
          </p>
          <p className="mt-3 border-t border-emerald-200 pt-3 text-sm font-bold leading-6">
            {teacherLoadInsight}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <InsightList
          icon={<TrendingUp className="h-5 w-5" />}
          items={strengths}
          title="Styrker i previewet"
          tone="good"
        />
        <InsightList
          icon={<Lightbulb className="h-5 w-5" />}
          items={improvements}
          title="Forbedringsforslag"
          tone="medium"
        />
      </div>
    </section>
  );
}

function MetricCard({ metric }: { metric: QualityMetric }) {
  return (
    <article className={`rounded-lg border p-4 ${statusClassNames[metric.status]}`}>
      <div className="flex items-start justify-between gap-3">
        <h5 className="text-sm font-black leading-6">{metric.title}</h5>
        <span className="rounded-lg border border-current/20 bg-white/55 px-2 py-1 text-xs font-black">
          {metric.label}
        </span>
      </div>
      <p className="mt-3 text-sm font-bold leading-6">{metric.description}</p>
      {metric.status === "unknown" ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] opacity-75">
          <CircleDashed className="h-4 w-4" />
          Ikke vurderet endnu
        </p>
      ) : (
        <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] opacity-75">{metric.score} / 100</p>
      )}
    </article>
  );
}

function InsightList({
  icon,
  items,
  title,
  tone,
}: {
  icon: ReactNode;
  items: string[];
  title: string;
  tone: "good" | "medium";
}) {
  const className =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <section className={`rounded-lg border p-4 ${className}`}>
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

function buildQualityMetrics(
  previewLessons: readonly QualityPreviewCell[],
  lessonCount: number,
  grade: number,
  priorities: Record<string, PriorityLevel>,
  subjectAssignmentStatus: SubjectAssignmentStatus,
): QualityMetric[] {
  const coreMetric = getCoreEarlyMetric(previewLessons, lessonCount);
  const peMetric = getBlockMetric(previewLessons, "Idræt", "Idræt gerne som dobbeltlektion");
  const creativeMetric = getCreativeBlockMetric(previewLessons);
  const calmDayMetric = getCalmDayMetric(previewLessons, grade);
  const lateHeavyMetric = getLateHeavyMetric(previewLessons, lessonCount, grade);

  return [
    {
      title: "Kernetimer tidligt",
      label: getMetricLabel(coreMetric),
      score: coreMetric,
      status: getMetricStatus(coreMetric),
      description: getCoreEarlyDescription(coreMetric),
      weight: getPriorityWeight(priorities["Dansk/matematik helst tidligt på dagen"]),
    },
    {
      title: "Ro i skoledagen",
      label: getMetricLabel(calmDayMetric),
      score: calmDayMetric,
      status: getMetricStatus(calmDayMetric),
      description: getCalmDayDescription(calmDayMetric, grade),
      weight:
        getPriorityWeight(priorities["Ikke for mange skift på én dag"]) +
        getPriorityWeight(priorities["Færre fag pr. dag i indskolingen"]) * 0.5,
    },
    {
      title: "Praktiske fag som blokke",
      label: getMetricLabel(Math.round((peMetric + creativeMetric) / 2)),
      score: Math.round((peMetric + creativeMetric) / 2),
      status: getMetricStatus(Math.round((peMetric + creativeMetric) / 2)),
      description: getPracticalBlockDescription(peMetric, creativeMetric),
      weight:
        getPriorityWeight(priorities["Idræt gerne som dobbeltlektion"]) +
        getPriorityWeight(priorities["Kreative fag gerne som længere blokke"]),
    },
    {
      title: "Tunge fag sent",
      label: getMetricLabel(lateHeavyMetric),
      score: lateHeavyMetric,
      status: getMetricStatus(lateHeavyMetric),
      description: getLateHeavyDescription(lateHeavyMetric, grade),
      weight:
        getPriorityWeight(priorities["Yngre elever skal helst ikke have tunge fag sent"]) +
        getPriorityWeight(priorities["Udskoling kan bedre tåle senere fag"]) * 0.5,
    },
    {
      title: "Klasselærer tidligt",
      label: "Ikke vurderet",
      score: 0,
      status: "unknown",
      description: "Klasselærerens placering vurderes senere, når klasselærer og fagfordeling kobles på.",
      weight: getPriorityWeight(priorities["Klasselærer gerne tidligt på dagen"]),
    },
    {
      title: "Lærerhuller",
      label: "Ikke vurderet",
      score: 0,
      status: "unknown",
      description:
        subjectAssignmentStatus.assignedItems > 0
          ? "Lærerhuller kræver konkrete placeringer, men lærerbelastning kan nu estimeres ud fra fagfordelingen."
          : "Lærerhuller vurderes senere, når fagfordeling kobles på.",
      weight: getPriorityWeight(priorities["Lærere skal helst ikke have mange huller"]),
    },
  ];
}

function getTeacherLoadInsight(
  teacherLoads: readonly TeacherLoad[],
  subjectAssignmentStatus: SubjectAssignmentStatus,
) {
  if (!subjectAssignmentStatus.assignedItems) {
    return "Lærerbelastning vises som lokalt estimat, når fagposter er fordelt.";
  }

  const busiestTeacher = [...teacherLoads].sort((first, second) => second.lessons - first.lessons)[0];

  if (!busiestTeacher) {
    return "Lærerbelastning kan nu estimeres ud fra fagfordelingen.";
  }

  return `${busiestTeacher.teacherName} har flest fordelte lektioner i det lokale estimat.`;
}

function getCoreEarlyMetric(previewLessons: readonly QualityPreviewCell[], lessonCount: number) {
  const earlyLimit = Math.max(2, Math.ceil(lessonCount / 2));
  const coreLessons = previewLessons.filter((cell) => coreSubjects.includes(cell.subject as (typeof coreSubjects)[number]));

  if (!coreLessons.length) {
    return 70;
  }

  const earlyCoreLessons = coreLessons.filter((cell) => cell.lesson <= earlyLimit).length;
  return clampScore(45 + Math.round((earlyCoreLessons / coreLessons.length) * 55));
}

function getBlockMetric(previewLessons: readonly QualityPreviewCell[], subject: string, wish: string) {
  const subjectLessons = previewLessons.filter((cell) => cell.subject === subject);

  if (subjectLessons.length < 2) {
    return wish ? 60 : 60;
  }

  const lessonsInBlocks = subjectLessons.filter((cell) =>
    previewLessons.some(
      (otherCell) =>
        otherCell.day === cell.day &&
        otherCell.subject === subject &&
        Math.abs(otherCell.lesson - cell.lesson) === 1,
    ),
  ).length;

  return clampScore(45 + Math.round((lessonsInBlocks / subjectLessons.length) * 55));
}

function getCreativeBlockMetric(previewLessons: readonly QualityPreviewCell[]) {
  const creativeLessons = previewLessons.filter((cell) =>
    creativeSubjects.includes(cell.subject as (typeof creativeSubjects)[number]),
  );

  if (creativeLessons.length < 2) {
    return 65;
  }

  const lessonsInBlocks = creativeLessons.filter((cell) =>
    previewLessons.some(
      (otherCell) =>
        otherCell.day === cell.day &&
        otherCell.subject === cell.subject &&
        Math.abs(otherCell.lesson - cell.lesson) === 1,
    ),
  ).length;

  return clampScore(45 + Math.round((lessonsInBlocks / creativeLessons.length) * 55));
}

function getCalmDayMetric(previewLessons: readonly QualityPreviewCell[], grade: number) {
  const days = [...new Set(previewLessons.map((cell) => cell.day))];
  const dailyUniqueCounts = days.map((day) => {
    const subjects = new Set(
      previewLessons
        .filter((cell) => cell.day === day && !fixedSubjects.includes(cell.subject as (typeof fixedSubjects)[number]))
        .map((cell) => cell.subject),
    );
    return subjects.size;
  });
  const averageUniqueSubjects =
    dailyUniqueCounts.reduce((total, count) => total + count, 0) / Math.max(1, dailyUniqueCounts.length);
  const target = grade <= 3 ? 4 : 5;
  const penalty = Math.max(0, averageUniqueSubjects - target) * 14;

  return clampScore(Math.round(88 - penalty));
}

function getLateHeavyMetric(previewLessons: readonly QualityPreviewCell[], lessonCount: number, grade: number) {
  const lateStart = Math.max(4, Math.ceil(lessonCount * 0.68));
  const heavyLessons = previewLessons.filter((cell) =>
    heavySubjects.includes(cell.subject as (typeof heavySubjects)[number]),
  );

  if (!heavyLessons.length) {
    return 72;
  }

  const lateHeavyShare = heavyLessons.filter((cell) => cell.lesson >= lateStart).length / heavyLessons.length;
  const tolerance = grade >= 7 ? 0.45 : grade >= 4 ? 0.28 : 0.16;
  const penalty = Math.max(0, lateHeavyShare - tolerance) * 110;

  return clampScore(Math.round(88 - penalty));
}

function buildStrengths(metrics: QualityMetric[], grade: number) {
  const strengths: string[] = [];
  const coreMetric = metrics.find((metric) => metric.title === "Kernetimer tidligt");
  const calmMetric = metrics.find((metric) => metric.title === "Ro i skoledagen");
  const practicalMetric = metrics.find((metric) => metric.title === "Praktiske fag som blokke");
  const lateMetric = metrics.find((metric) => metric.title === "Tunge fag sent");

  if (coreMetric && coreMetric.score >= 70) {
    strengths.push("Dansk/matematik ligger tidligt flere steder i previewet.");
  }

  if (calmMetric && calmMetric.score >= 70) {
    strengths.push("Previewet har en forholdsvis rolig fordeling af fag på dagene.");
  }

  if (practicalMetric && practicalMetric.score >= 70) {
    strengths.push("Idræt eller kreative fag ligger flere steder tæt nok til at ligne blokke.");
  }

  if (lateMetric && lateMetric.score >= 70) {
    strengths.push(
      grade >= 7
        ? "Udskolingsklassen kan bedre bære enkelte senere fag i denne kladde."
        : "Tunge fag ligger ikke dominerende sent i denne kladde.",
    );
  }

  strengths.push("Scoren viser en lokal indikator, som kan bruges til samtale om skemaets rytme.");
  return strengths.slice(0, 5);
}

function buildImprovements(metrics: QualityMetric[]) {
  const improvements: string[] = [];
  const coreMetric = metrics.find((metric) => metric.title === "Kernetimer tidligt");
  const calmMetric = metrics.find((metric) => metric.title === "Ro i skoledagen");
  const practicalMetric = metrics.find((metric) => metric.title === "Praktiske fag som blokke");
  const lateMetric = metrics.find((metric) => metric.title === "Tunge fag sent");

  if (coreMetric && coreMetric.score < 70) {
    improvements.push("Bør overvejes: læg flere dansk-/matematiklektioner tidligere på dagen.");
  }

  if (calmMetric && calmMetric.score < 74) {
    improvements.push("Kan forbedres: previewet har mange forskellige fag samme dag for den valgte klasse.");
  }

  if (practicalMetric && practicalMetric.score < 72) {
    improvements.push("Kan forbedres: idræt eller kreative fag ligger ikke tydeligt som længere blokke i kladden.");
  }

  if (lateMetric && lateMetric.score < 72) {
    improvements.push("Bør overvejes: yngre elever bør helst ikke have for mange tunge fag sent på dagen.");
  }

  improvements.push("Lærerhuller vurderes senere, når fagfordeling kobles på.");
  improvements.push("Klasselærerens placering vurderes senere, når klasselærerdata kobles på.");
  improvements.push("Næste skridt kan være at sammenholde denne indikator med konflikttjekket.");
  return improvements.slice(0, 5);
}

function getCoreEarlyDescription(score: number) {
  if (score >= 76) {
    return "Matematik og dansk ligger tidligt flere dage i previewet.";
  }

  if (score >= 62) {
    return "Nogle kernetimer ligger tidligt, men fordelingen kan styrkes.";
  }

  return "Kernetimer ligger ofte senere end ønsket i denne visuelle kladde.";
}

function getCalmDayDescription(score: number, grade: number) {
  if (score >= 76) {
    return grade <= 3
      ? "Indskolingsdagen virker forholdsvis enkel med et moderat antal fag."
      : "Dagenes fagvariation ser fornuftig ud i previewet.";
  }

  if (score >= 62) {
    return "Der er en rimelig rytme, men nogle dage kan gøres roligere.";
  }

  return "Previewet har mange forskellige fag samme dag for den valgte klasse.";
}

function getPracticalBlockDescription(peScore: number, creativeScore: number) {
  if (peScore >= 72 && creativeScore >= 72) {
    return "Idræt og kreative fag ligger flere steder tæt nok til blokke.";
  }

  if (peScore < 72 && creativeScore < 72) {
    return "Idræt og kreative fag ligger mest som spredte enkelttimer.";
  }

  return peScore >= creativeScore
    ? "Idræt ser rimeligt samlet ud, mens kreative fag kan styrkes."
    : "Kreative fag ser rimeligt samlet ud, mens idræt kan styrkes.";
}

function getLateHeavyDescription(score: number, grade: number) {
  if (score >= 76) {
    return grade >= 7
      ? "Senere tunge fag virker acceptable for udskolingen i denne kladde."
      : "Yngre elever får ikke for mange tunge fag sent i denne kladde.";
  }

  if (score >= 62) {
    return "Tunge fag sent på dagen bør holdes øje med.";
  }

  return "Der ligger relativt mange tunge fag sent for den valgte klasse.";
}

function getPriorityWeight(priority?: PriorityLevel) {
  if (priority === "Høj") {
    return 1.35;
  }

  if (priority === "Lav") {
    return 0.65;
  }

  return 1;
}

function getMetricLabel(score: number) {
  if (score >= 76) {
    return "Ser fornuftigt ud";
  }

  if (score >= 62) {
    return "Bør overvejes";
  }

  return "Kan forbedres";
}

function getMetricStatus(score: number): QualityMetric["status"] {
  if (score >= 76) {
    return "good";
  }

  if (score >= 62) {
    return "medium";
  }

  return "low";
}

function getGradeFromClassName(className: string) {
  const match = className.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function clampScore(score: number) {
  return Math.min(100, Math.max(0, score));
}
