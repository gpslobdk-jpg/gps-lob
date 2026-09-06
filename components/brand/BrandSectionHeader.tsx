import type { ReactNode } from "react";

import { rubik } from "@/lib/fonts";

type BrandSectionHeaderProps = {
  action?: ReactNode;
  className?: string;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export default function BrandSectionHeader({
  action,
  className = "",
  eyebrow,
  subtitle,
  title,
}: BrandSectionHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase text-sky-700">{eyebrow}</p>
        ) : null}
        <h2 className={`text-2xl font-black text-[var(--skolegps-deep-navy)] sm:text-3xl ${rubik.className}`}>
          {title}
        </h2>
        {subtitle ? <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
