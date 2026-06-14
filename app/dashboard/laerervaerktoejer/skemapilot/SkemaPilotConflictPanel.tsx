"use client";

import { AlertCircle, Check, CircleDashed } from "lucide-react";
import type { ReactNode } from "react";

type ConflictPanelProps = {
  activeBlocks: readonly string[];
  activeClasses: readonly string[];
  getLessonValue: (className: string, subject: string) => string;
  lessonCount: number;
  previewClass: string;
  rubikClassName: string;
  subjects: readonly string[];
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
  getLessonValue,
  lessonCount,
  previewClass,
  rubikClassName,
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
      status: "unknown",
      description: "Lærer pr. lektion er ikke koblet på previewet endnu.",
      detail: "Kræver senere fagfordeling med konkrete lærere pr. fag og klasse.",
    },
    {
      title: "Lokale må ikke bruges af to hold samtidig",
      status: "unknown",
      description: "Lokaler vises kun som noter i dette dummy-preview.",
      detail: "Kræver senere lokaleplacering pr. lektion for alle klasser.",
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
            Dette er første lokale tjek. Senere kan SkemaPilot tjekke lærer-, klasse- og lokalekonflikter mere
            præcist, når fagfordelingen kobles på.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
          <p>{totalCapacity} mulige lektionsfelter</p>
          <p>{totalSelectedLessons} valgte lektioner</p>
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
