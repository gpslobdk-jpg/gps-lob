import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";

import Mascot from "@/components/brand/Mascot";
import RoutePath from "@/components/brand/RoutePath";
import { rubik } from "@/lib/fonts";

type HeroBannerProps = {
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
  eyebrow?: string;
  icon?: LucideIcon;
  mascot?: "default" | "wave" | "point" | "thinking" | "celebrate" | "guide" | false;
  subtitle?: ReactNode;
  title: ReactNode;
};

export default function HeroBanner({
  actions,
  className = "",
  compact = false,
  eyebrow,
  icon: Icon,
  mascot = "guide",
  subtitle,
  title,
}: HeroBannerProps) {
  return (
    <section
      className={`relative overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white text-slate-950 shadow-[0_24px_70px_rgba(7,26,58,0.13)] ${className}`}
    >
      <Image
        src={compact ? "/brand/heroes/adventure-banner.webp" : "/brand/heroes/adventure-hero.webp"}
        alt=""
        fill
        priority
        sizes={compact ? "(max-width: 1280px) 100vw, 1280px" : "(max-width: 1280px) 100vw, 1440px"}
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.86)_42%,rgba(255,255,255,0.5)_72%,rgba(255,255,255,0.18)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,rgba(244,251,255,0.96),transparent)]" />
      <RoutePath className="absolute right-0 top-4 h-24 w-[56%] opacity-45" />

      <div className={`relative z-10 grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${compact ? "lg:p-8" : "lg:p-10"}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {Icon ? (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-[0_10px_24px_rgba(3,119,216,0.22)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            ) : null}
            {eyebrow ? (
              <p className="rounded-full border border-sky-200 bg-white/78 px-3 py-1 text-[11px] font-bold uppercase text-sky-800">
                {eyebrow}
              </p>
            ) : null}
          </div>

          <h1
            className={`mt-4 max-w-3xl text-4xl font-black text-[var(--skolegps-deep-navy)] sm:text-5xl ${compact ? "lg:text-5xl" : "lg:text-6xl"} ${rubik.className}`}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-700 sm:text-lg">
              {subtitle}
            </p>
          ) : null}
          {actions ? <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
        </div>

        {mascot ? (
          <div className="hidden lg:block">
            <Mascot variant={mascot} size={compact ? "lg" : "hero"} priority />
          </div>
        ) : null}
      </div>
    </section>
  );
}
