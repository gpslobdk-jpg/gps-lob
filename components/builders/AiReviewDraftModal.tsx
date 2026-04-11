"use client";

import type { ReactNode } from "react";

type Tone = "emerald" | "rose" | "amber" | "indigo";

type ReviewItem = {
  label: string;
  value: ReactNode;
};

type Props = {
  tone: Tone;
  eyebrow: string;
  title: string;
  description: string;
  warning?: string | null;
  summaryItems: ReviewItem[];
  detailItems?: ReviewItem[];
  cancelLabel: string;
  applyLabel: string;
  headingClassName?: string;
  onCancel: () => void;
  onApply: () => void;
};

const toneClassMap: Record<
  Tone,
  {
    frame: string;
    eyebrow: string;
    heading: string;
    body: string;
    label: string;
    cancel: string;
    apply: string;
  }
> = {
  emerald: {
    frame: "border-emerald-400/25",
    eyebrow: "text-emerald-100/70",
    heading: "text-emerald-50",
    body: "text-emerald-100/80",
    label: "text-emerald-100/65",
    cancel: "text-emerald-50",
    apply:
      "border-emerald-300/40 bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-300",
  },
  rose: {
    frame: "border-rose-400/25",
    eyebrow: "text-rose-100/70",
    heading: "text-rose-50",
    body: "text-rose-100/80",
    label: "text-rose-100/65",
    cancel: "text-rose-50",
    apply:
      "border-rose-300/40 bg-rose-600 text-slate-950 shadow-lg shadow-rose-500/20 hover:bg-rose-500",
  },
  amber: {
    frame: "border-amber-400/25",
    eyebrow: "text-amber-100/70",
    heading: "text-amber-50",
    body: "text-amber-100/80",
    label: "text-amber-100/65",
    cancel: "text-amber-50",
    apply:
      "border-amber-300/40 bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300",
  },
  indigo: {
    frame: "border-indigo-400/25",
    eyebrow: "text-indigo-100/70",
    heading: "text-white",
    body: "text-indigo-100/80",
    label: "text-indigo-100/65",
    cancel: "text-indigo-50",
    apply:
      "border-indigo-300/40 bg-indigo-300 text-slate-950 shadow-lg shadow-indigo-500/20 hover:bg-indigo-200",
  },
};

export default function AiReviewDraftModal({
  tone,
  eyebrow,
  title,
  description,
  warning,
  summaryItems,
  detailItems = [],
  cancelLabel,
  applyLabel,
  headingClassName = "",
  onCancel,
  onApply,
}: Props) {
  const theme = toneClassMap[tone];
  const detailGridClass = detailItems.length > 1 ? "sm:grid-cols-2" : "";

  return (
    <div className="fixed inset-0 z-1350 overflow-y-auto bg-slate-950/75 px-6 py-10 backdrop-blur-md print:hidden">
      <div className="flex min-h-full items-start justify-center sm:items-center">
        <div
          className={`w-full max-w-3xl rounded-4xl border bg-slate-950/92 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8 ${theme.frame}`}
        >
          <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${theme.eyebrow}`}>{eyebrow}</p>
          <h2 className={`mt-3 text-3xl font-black tracking-tight ${theme.heading} ${headingClassName}`}>
            {title}
          </h2>
          <p className={`mt-4 text-sm leading-6 sm:text-base ${theme.body}`}>{description}</p>

          {warning ? (
            <div className="mt-6 rounded-[1.6rem] border border-amber-300/25 bg-amber-400/10 px-5 py-4 text-sm font-semibold text-amber-50">
              {warning}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-[1.6rem] border border-white/10 bg-white/4 px-5 py-4">
                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme.label}`}>{item.label}</p>
                <p className="mt-3 text-lg font-black text-white">{item.value}</p>
              </div>
            ))}
          </div>

          {detailItems.length > 0 ? (
            <div className={`mt-4 grid gap-4 ${detailGridClass}`}>
              {detailItems.map((item) => (
                <div key={item.label} className="rounded-[1.6rem] border border-white/10 bg-white/4 px-5 py-4">
                  <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme.label}`}>{item.label}</p>
                  <p className="mt-3 text-sm leading-6 text-white/90">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onCancel}
              className={`rounded-3xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] transition hover:bg-white/10 ${theme.cancel}`}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onApply}
              className={`rounded-3xl border px-5 py-4 text-sm font-black uppercase tracking-[0.18em] transition ${theme.apply}`}
            >
              {applyLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}