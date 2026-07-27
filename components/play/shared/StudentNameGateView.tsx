"use client";

import type { FormEvent } from "react";

import StudentOnboardingShell, {
  getStudentOnboardingToneStyles,
  type StudentOnboardingTone,
} from "./StudentOnboardingShell";

type StudentNameGateViewProps = {
  tone?: StudentOnboardingTone;
  title: string;
  description: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  value: string;
  error: string | null;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export default function StudentNameGateView({
  tone = "emerald",
  title,
  description,
  label = "Holdnavn",
  placeholder = "Skriv holdnavn",
  helperText = "Brug jeres rigtige navn eller holdnavn.",
  value,
  error,
  isSubmitting,
  submitLabel,
  submittingLabel,
  onChange,
  onSubmit,
}: StudentNameGateViewProps) {
  const styles = getStudentOnboardingToneStyles(tone);
  const inputClass =
    tone === "cyan"
      ? "w-full rounded-[1.45rem] border border-cyan-300/25 bg-slate-950 px-4 py-4 text-base text-white outline-none transition placeholder:text-white/32 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
      : "w-full rounded-[1.45rem] border border-emerald-300/25 bg-slate-950 px-4 py-4 text-base text-white outline-none transition placeholder:text-white/32 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20";
  const buttonClass =
    tone === "cyan"
      ? "inline-flex w-full items-center justify-center rounded-[1.4rem] bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/45"
      : "inline-flex w-full items-center justify-center rounded-[1.4rem] bg-gradient-to-r from-emerald-400 to-sky-400 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#03110d] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(value);
  };

  return (
    <StudentOnboardingShell tone={tone} step={1} title={title} description={description}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="student-name-gate"
            className={`mb-2 block text-sm font-semibold ${styles.eyebrowClass}`}
          >
            {label}
          </label>
          <input
            id="student-name-gate"
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={isSubmitting}
            placeholder={placeholder}
            autoComplete="off"
            className={inputClass}
          />
        </div>

        <p className={`text-sm ${styles.descriptionClass}`}>{helperText}</p>

        {error ? (
          <div
            className="rounded-[1.35rem] border border-rose-300/30 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={isSubmitting} className={buttonClass}>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </form>
    </StudentOnboardingShell>
  );
}
