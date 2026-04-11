"use client";

import { Camera, Check, Radio, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type StudentOnboardingTone = "emerald" | "cyan";

type StudentOnboardingShellProps = {
  tone?: StudentOnboardingTone;
  step: 1 | 2 | 3;
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

type ToneStyles = {
  shellClass: string;
  eyebrowClass: string;
  titleClass: string;
  descriptionClass: string;
  stepActiveClass: string;
  stepCompletedClass: string;
  stepIdleClass: string;
  stepLabelActiveClass: string;
  stepLabelIdleClass: string;
  connectorClass: string;
};

const STEP_ITEMS: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Navn", icon: UserRound },
  { label: "Avatar", icon: Camera },
  { label: "Venter", icon: Radio },
];

export function getStudentOnboardingToneStyles(tone: StudentOnboardingTone = "emerald"): ToneStyles {
  if (tone === "cyan") {
    return {
      shellClass:
        "gpslob-onboarding-enter w-full max-w-md rounded-[2rem] border border-cyan-400/20 bg-slate-900/74 p-8 text-white shadow-[0_30px_80px_rgba(8,47,73,0.38)] backdrop-blur-2xl",
      eyebrowClass: "text-cyan-100/72",
      titleClass: "text-white",
      descriptionClass: "text-cyan-50/82",
      stepActiveClass: "border-cyan-300/35 bg-cyan-400/16 text-cyan-50",
      stepCompletedClass: "border-cyan-300/25 bg-cyan-500/10 text-cyan-100",
      stepIdleClass: "border-white/10 bg-white/5 text-white/42",
      stepLabelActiveClass: "text-cyan-100/90",
      stepLabelIdleClass: "text-white/42",
      connectorClass: "bg-[linear-gradient(90deg,rgba(34,211,238,0.36),rgba(255,255,255,0.08))]",
    };
  }

  return {
    shellClass:
      "gpslob-onboarding-enter w-full max-w-md rounded-[2rem] border border-emerald-400/20 bg-slate-900/74 p-8 text-white shadow-[0_30px_80px_rgba(6,78,59,0.34)] backdrop-blur-2xl",
    eyebrowClass: "text-emerald-100/72",
    titleClass: "text-white",
    descriptionClass: "text-emerald-50/82",
    stepActiveClass: "border-emerald-300/35 bg-emerald-400/16 text-emerald-50",
    stepCompletedClass: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
    stepIdleClass: "border-white/10 bg-white/5 text-white/42",
    stepLabelActiveClass: "text-emerald-100/90",
    stepLabelIdleClass: "text-white/42",
    connectorClass: "bg-[linear-gradient(90deg,rgba(52,211,153,0.36),rgba(255,255,255,0.08))]",
  };
}

export default function StudentOnboardingShell({
  tone = "emerald",
  step,
  eyebrow = "Klar til mission",
  title,
  description,
  children,
  footer,
}: StudentOnboardingShellProps) {
  const styles = getStudentOnboardingToneStyles(tone);

  return (
    <div className={styles.shellClass}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.32em] ${styles.eyebrowClass}`}>
          {eyebrow}
        </p>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEP_ITEMS.map(({ label, icon: Icon }, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === step;
          const isCompleted = stepNumber < step;

          return (
            <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                    isActive
                      ? styles.stepActiveClass
                      : isCompleted
                        ? styles.stepCompletedClass
                        : styles.stepIdleClass
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
                      isActive || isCompleted ? styles.stepLabelActiveClass : styles.stepLabelIdleClass
                    }`}
                  >
                    {stepNumber}
                  </p>
                  <p
                    className={`truncate text-xs font-semibold ${
                      isActive || isCompleted ? styles.stepLabelActiveClass : styles.stepLabelIdleClass
                    }`}
                  >
                    {label}
                  </p>
                </div>
              </div>

              {index < STEP_ITEMS.length - 1 ? (
                <div className={`h-px min-w-4 flex-1 rounded-full ${styles.connectorClass}`} />
              ) : null}
            </div>
          );
        })}
      </div>

      <div>
        <h1 className={`text-3xl font-black ${styles.titleClass}`}>{title}</h1>
        <p className={`mt-3 text-sm leading-6 ${styles.descriptionClass}`}>{description}</p>
      </div>

      <div className="mt-8">{children}</div>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  );
}