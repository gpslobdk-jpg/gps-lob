import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import Mascot from "@/components/brand/Mascot";
import { rubik } from "@/lib/fonts";

type AdventureEmptyStateProps = {
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  description: string;
  icon?: LucideIcon;
  title: string;
};

export default function AdventureEmptyState({
  actionHref,
  actionLabel,
  className = "",
  description,
  icon: Icon,
  title,
}: AdventureEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-5 rounded-2xl border border-dashed border-sky-200 bg-white/88 p-8 text-center text-slate-900 shadow-[0_18px_42px_rgba(7,26,58,0.08)] sm:flex-row sm:text-left ${className}`}
    >
      <Mascot variant="thinking" size="lg" />
      <div className="min-w-0 flex-1">
        {Icon ? (
          <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-white">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <h2 className={`text-2xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
          {title}
        </h2>
        <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-600">{description}</p>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--skolegps-green)] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(34,164,71,0.22)] transition hover:bg-green-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-green-500"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
