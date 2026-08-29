import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  FileText,
  Presentation,
  Podcast,
  School,
} from "lucide-react";
import { poppins, rubik } from "@/lib/fonts";

import { getDagensTavleSsoOrigin, getFamilySsoOrigin } from "@/lib/familySso/config";

export const metadata: Metadata = {
  title: "Lærerværktøjer – SkoleGPS",
  description: "En samlet hub for planlægningsværktøjer til lærere i SkoleGPS.",
};

const dagensTavleOrigin = getDagensTavleSsoOrigin() ?? "https://dagenstavle.dk";
const printMitOrigin = getFamilySsoOrigin("printmitarbejdsark") ?? "https://printmitarbejdsark.dk";

const toolCards = [
  {
    title: "Årsplan",
    description: "Lav og tilpas en årsplan – klar som PDF.",
    href: "/dashboard/laerervaerktoejer/aarsplan-generator",
    icon: Calendar,
    cta: "Lav årsplan",
    familyLabel: "SkoleGPS",
    destinationLabel: "Åbner i SkoleGPS",
    theme: {
      card:
        "border-amber-300/45 bg-[linear-gradient(145deg,rgba(120,53,15,0.92)_0%,rgba(51,35,25,0.94)_38%,rgba(15,23,42,0.97)_78%)] shadow-[0_24px_90px_rgba(245,158,11,0.16)] hover:border-amber-200/80 hover:shadow-[0_28px_100px_rgba(245,158,11,0.28)]",
      rail: "bg-amber-300",
      accent: "via-amber-200/95",
      icon: "border-amber-200/55 bg-amber-300/20 text-amber-100",
      badge: "border-amber-200/35 bg-amber-300/15 text-amber-50",
      destination: "text-amber-100/90",
      button:
        "border-amber-100/70 bg-amber-300 text-amber-950 hover:border-white hover:bg-amber-200 focus-visible:ring-amber-200/40",
    },
  },
  {
    title: "SkemaPilot",
    description: "Byg en skemakladde med fag, lærere og lokaler.",
    href: "https://www.skemapilot.dk/app",
    icon: School,
    cta: "Åbn SkemaPilot",
    familyLabel: "SkoleGPS-familien",
    destinationLabel: "Åbner på skemapilot.dk",
    theme: {
      card:
        "border-sky-300/45 bg-[linear-gradient(145deg,rgba(3,105,161,0.88)_0%,rgba(15,48,68,0.94)_38%,rgba(15,23,42,0.97)_78%)] shadow-[0_24px_90px_rgba(14,165,233,0.16)] hover:border-sky-200/80 hover:shadow-[0_28px_100px_rgba(14,165,233,0.28)]",
      rail: "bg-sky-300",
      accent: "via-sky-200/95",
      icon: "border-sky-200/55 bg-sky-300/20 text-sky-100",
      badge: "border-sky-200/35 bg-sky-300/15 text-sky-50",
      destination: "text-sky-100/90",
      button:
        "border-sky-100/70 bg-sky-400 text-sky-950 hover:border-white hover:bg-sky-300 focus-visible:ring-sky-200/40",
    },
  },
  {
    title: "SkolePodcast.dk",
    description: "Planlæg og optag elevpodcasts til undervisningen.",
    href: "https://skolepodcast.dk",
    icon: Podcast,
    cta: "Åbn SkolePodcast.dk",
    familyLabel: "SkoleGPS-familien",
    destinationLabel: "Åbner på skolepodcast.dk",
    theme: {
      card:
        "border-fuchsia-300/45 bg-[linear-gradient(145deg,rgba(126,34,206,0.88)_0%,rgba(65,27,86,0.94)_38%,rgba(15,23,42,0.97)_78%)] shadow-[0_24px_90px_rgba(217,70,239,0.16)] hover:border-fuchsia-200/80 hover:shadow-[0_28px_100px_rgba(217,70,239,0.28)]",
      rail: "bg-fuchsia-300",
      accent: "via-fuchsia-200/95",
      icon: "border-fuchsia-200/55 bg-fuchsia-300/20 text-fuchsia-100",
      badge: "border-fuchsia-200/35 bg-fuchsia-300/15 text-fuchsia-50",
      destination: "text-fuchsia-100/90",
      button:
        "border-fuchsia-100/70 bg-fuchsia-400 text-fuchsia-950 hover:border-white hover:bg-fuchsia-300 focus-visible:ring-fuchsia-200/40",
    },
  },
  {
    title: "PrintMitArbejdsark",
    description: "Lav flotte arbejdsark klar til print på få minutter.",
    href: `${printMitOrigin}/auth/family-sso/start?next=%2Flav&source=skolegps`,
    icon: FileText,
    cta: "Åbn PrintMitArbejdsark",
    familyLabel: "SkoleGPS-familien",
    destinationLabel: "Åbner på printmitarbejdsark.dk",
    theme: {
      card:
        "border-cyan-300/45 bg-[linear-gradient(145deg,rgba(14,116,144,0.9)_0%,rgba(21,65,75,0.94)_38%,rgba(15,23,42,0.97)_78%)] shadow-[0_24px_90px_rgba(34,211,238,0.14)] hover:border-cyan-200/80 hover:shadow-[0_28px_100px_rgba(34,211,238,0.26)]",
      rail: "bg-cyan-300",
      accent: "via-emerald-200/90",
      icon: "border-cyan-200/55 bg-cyan-300/20 text-cyan-50",
      badge: "border-cyan-200/35 bg-cyan-300/15 text-cyan-50",
      destination: "text-cyan-100/90",
      button:
        "border-cyan-100/70 bg-cyan-300 text-cyan-950 hover:border-white hover:bg-cyan-200 focus-visible:ring-cyan-200/40",
    },
  },
  {
    title: "DagensTavle",
    description: "Fra skema til tavle – klar til undervisning.",
    href: `${dagensTavleOrigin}/auth/family-sso/start?next=%2Ftavle&source=skolegps`,
    icon: Presentation,
    cta: "Åbn DagensTavle",
    familyLabel: "SkoleGPS-familien",
    destinationLabel: "Åbner på dagenstavle.dk",
    theme: {
      card:
        "border-[#8fd8bc]/50 bg-[linear-gradient(145deg,rgba(23,63,52,0.96)_0%,rgba(16,47,39,0.96)_44%,rgba(15,23,42,0.98)_82%)] shadow-[0_24px_90px_rgba(52,211,153,0.14)] hover:border-[#c7f2df]/85 hover:shadow-[0_28px_100px_rgba(52,211,153,0.26)]",
      rail: "bg-[#8fd8bc]",
      accent: "via-[#e8d17d]/85",
      icon: "border-[#bcebd7]/55 bg-[#8fd8bc]/18 text-[#e6fff4]",
      badge: "border-[#bcebd7]/35 bg-[#8fd8bc]/12 text-[#f4efd9]",
      destination: "text-[#d9f6e9]",
      button:
        "border-[#c7f2df]/70 bg-[#8fd8bc] text-[#102f27] hover:border-white hover:bg-[#bcebd7] focus-visible:ring-[#8fd8bc]/45",
    },
  },
] as const;

export default function LaerervaerktoejerPage() {
  return (
    <main className={`relative min-h-screen overflow-x-hidden bg-slate-950 text-white ${poppins.className}`}>
      <div className="pointer-events-none absolute inset-0 z-0">
        <video
          src="/baggrundlearen.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover opacity-45 saturate-[0.85]"
        />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.22),transparent_34%),linear-gradient(120deg,rgba(15,23,42,0.92),rgba(15,23,42,0.42)_48%,rgba(6,78,59,0.78))] backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-6 sm:py-8 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-slate-950/55 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:border-emerald-300/60 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til dashboard
          </Link>
          <div className="hidden min-h-11 items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-50 shadow-sm backdrop-blur sm:inline-flex">
            <BookOpen className="h-4 w-4" />
            SkoleGPS-familien
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10 sm:py-12 lg:py-16">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-50 backdrop-blur">
              Lærerhub
            </p>
            <h1
              className={`mt-5 break-words text-[clamp(2rem,9vw,4.5rem)] font-black tracking-tight text-white ${rubik.className}`}
            >
              Lærerværktøjer
            </h1>
            <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-slate-100 sm:text-xl">
              Vælg mellem årsplan, skema, tavle, elevpodcast og arbejdsark.
            </p>
          </div>

          <section
            className="mt-9 grid auto-rows-fr items-stretch gap-5 md:grid-cols-2 2xl:grid-cols-5"
            aria-label="Lærerværktøjer"
          >
            {toolCards.map((tool) => {
              const Icon = tool.icon;
              const isExternal = tool.href.startsWith("http");
              const LinkIcon = isExternal ? ArrowUpRight : ArrowRight;

              return (
                <article
                  key={tool.href}
                  className={`group relative flex h-full min-h-[22rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border p-6 backdrop-blur-md transition duration-300 hover:-translate-y-1 md:p-7 ${tool.theme.card}`}
                >
                  <div
                    className={`pointer-events-none absolute inset-y-8 left-0 w-1 rounded-r-full ${tool.theme.rail}`}
                  />
                  <div
                    className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${tool.theme.accent}`}
                  />

                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${tool.theme.icon}`}
                    >
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <span
                      className={`max-w-[11rem] break-words rounded-full border px-3 py-1.5 text-right text-[0.68rem] font-black uppercase leading-4 tracking-[0.12em] ${tool.theme.badge}`}
                    >
                      {tool.familyLabel}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2
                      className={`mt-7 break-words text-3xl font-black tracking-tight text-white ${rubik.className}`}
                    >
                      {tool.title}
                    </h2>
                    <p className="mt-4 text-sm font-semibold leading-7 text-slate-100 sm:text-base">
                      {tool.description}
                    </p>
                  </div>

                  <div className="mt-auto min-w-0 pt-7">
                    <p className={`mb-3 break-words text-xs font-semibold ${tool.theme.destination}`}>
                      {tool.destinationLabel}
                    </p>
                    <Link
                      href={tool.href}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      aria-label={`${tool.cta}${isExternal ? " – åbner i en ny fane" : ""}`}
                      className={`inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-sm leading-5 font-black whitespace-normal shadow-sm transition focus-visible:outline-none focus-visible:ring-4 [overflow-wrap:anywhere] ${tool.theme.button}`}
                    >
                      <span className="min-w-0">{tool.cta}</span>
                      <LinkIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        </section>
      </div>
    </main>
  );
}
