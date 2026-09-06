import type { LucideIcon } from "lucide-react";

import { rubik } from "@/lib/fonts";

type QuickActionTone = "blue" | "green" | "yellow" | "navy" | "sand" | "rose";

type QuickActionCardProps = {
  className?: string;
  cta?: string;
  description: string;
  eyebrow?: string;
  icon: LucideIcon;
  isBusy?: boolean;
  title: string;
  tone?: QuickActionTone;
};

const toneClasses: Record<QuickActionTone, { icon: string; ring: string }> = {
  blue: {
    icon: "bg-sky-600 text-white shadow-[0_12px_24px_rgba(3,119,216,0.22)]",
    ring: "group-hover:border-sky-300 group-hover:shadow-[0_18px_46px_rgba(3,119,216,0.14)]",
  },
  green: {
    icon: "bg-green-600 text-white shadow-[0_12px_24px_rgba(34,164,71,0.22)]",
    ring: "group-hover:border-green-300 group-hover:shadow-[0_18px_46px_rgba(34,164,71,0.14)]",
  },
  yellow: {
    icon: "bg-amber-400 text-slate-950 shadow-[0_12px_24px_rgba(247,183,51,0.24)]",
    ring: "group-hover:border-amber-300 group-hover:shadow-[0_18px_46px_rgba(247,183,51,0.16)]",
  },
  navy: {
    icon: "bg-[var(--skolegps-deep-navy)] text-white shadow-[0_12px_24px_rgba(7,26,58,0.2)]",
    ring: "group-hover:border-slate-300 group-hover:shadow-[0_18px_46px_rgba(7,26,58,0.13)]",
  },
  sand: {
    icon: "bg-[var(--skolegps-sand)] text-amber-950 shadow-[0_12px_24px_rgba(180,116,28,0.18)]",
    ring: "group-hover:border-amber-200 group-hover:shadow-[0_18px_46px_rgba(180,116,28,0.12)]",
  },
  rose: {
    icon: "bg-rose-500 text-white shadow-[0_12px_24px_rgba(244,63,94,0.18)]",
    ring: "group-hover:border-rose-200 group-hover:shadow-[0_18px_46px_rgba(244,63,94,0.12)]",
  },
};

export default function QuickActionCard({
  className = "",
  cta,
  description,
  eyebrow,
  icon: Icon,
  isBusy = false,
  title,
  tone = "blue",
}: QuickActionCardProps) {
  const toneClass = toneClasses[tone];

  return (
    <div
      className={`group relative flex h-full min-h-40 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-950 shadow-[0_14px_36px_rgba(7,26,58,0.08)] transition ${toneClass.ring} ${isBusy ? "opacity-75" : ""} ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--skolegps-blue),var(--skolegps-green),var(--skolegps-yellow))]" />
      <div className="flex items-start gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass.icon}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          {eyebrow ? (
            <span className="block text-[11px] font-bold uppercase text-slate-500">{eyebrow}</span>
          ) : null}
          <span className={`mt-0.5 block text-xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
            {title}
          </span>
        </span>
      </div>
      <p className="mt-4 flex-1 text-sm font-semibold leading-6 text-slate-600">{description}</p>
      {cta ? (
        <span className="mt-5 inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800 transition group-hover:border-sky-200 group-hover:bg-sky-50 group-hover:text-sky-800">
          {cta}
        </span>
      ) : null}
    </div>
  );
}
