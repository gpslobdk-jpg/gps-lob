import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Compass,
  FileText,
  ListChecks,
  Presentation,
  Podcast,
  School,
} from "lucide-react";
import { poppins } from "@/lib/fonts";

import HeroBanner from "@/components/brand/HeroBanner";
import QuickActionCard from "@/components/brand/QuickActionCard";
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
    title: "SkolePodcast",
    description: "Planlæg og optag elevpodcasts til undervisningen.",
    href: "https://skolepodcast.dk",
    icon: Podcast,
    cta: "Åbn SkolePodcast",
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
  {
    title: "UgePilot",
    description: "Planlæg ugearbejde og giv eleverne overblik over deres opgaver.",
    href: "https://ugepilot.dk",
    icon: ListChecks,
    cta: "Åbn UgePilot",
    familyLabel: "SkoleGPS-familien",
    destinationLabel: "Åbner på ugepilot.dk",
    theme: {
      card:
        "border-indigo-300/45 bg-[linear-gradient(145deg,rgba(67,56,202,0.9)_0%,rgba(43,45,91,0.94)_38%,rgba(15,23,42,0.97)_78%)] shadow-[0_24px_90px_rgba(129,140,248,0.15)] hover:border-indigo-200/80 hover:shadow-[0_28px_100px_rgba(129,140,248,0.27)]",
      rail: "bg-indigo-300",
      accent: "via-violet-200/90",
      icon: "border-indigo-200/55 bg-indigo-300/20 text-indigo-50",
      badge: "border-indigo-200/35 bg-indigo-300/15 text-indigo-50",
      destination: "text-indigo-100/90",
      button:
        "border-indigo-100/70 bg-indigo-300 text-indigo-950 hover:border-white hover:bg-indigo-200 focus-visible:ring-indigo-200/40",
    },
  },
  {
    title: "KildeGPS",
    description: "Find udvalgte kilder til elevernes research og skolearbejde.",
    href: "https://www.kildegps.dk",
    icon: Compass,
    cta: "Åbn KildeGPS",
    familyLabel: "SkoleGPS-familien",
    destinationLabel: "Åbner på kildegps.dk",
    theme: {
      card:
        "border-teal-300/45 bg-[linear-gradient(145deg,rgba(17,94,89,0.92)_0%,rgba(19,51,57,0.94)_38%,rgba(15,23,42,0.97)_78%)] shadow-[0_24px_90px_rgba(45,212,191,0.15)] hover:border-teal-200/80 hover:shadow-[0_28px_100px_rgba(45,212,191,0.27)]",
      rail: "bg-teal-300",
      accent: "via-cyan-200/90",
      icon: "border-teal-200/55 bg-teal-300/20 text-teal-50",
      badge: "border-teal-200/35 bg-teal-300/15 text-teal-50",
      destination: "text-teal-100/90",
      button:
        "border-teal-100/70 bg-teal-300 text-teal-950 hover:border-white hover:bg-teal-200 focus-visible:ring-teal-200/40",
    },
  },
] as const;

const toolTones = ["yellow", "blue", "rose", "green", "sand", "navy", "blue"] as const;

export default function LaerervaerktoejerPage() {
  return (
    <main className={`relative min-h-screen overflow-x-hidden bg-[var(--skolegps-muted-bg)] text-slate-950 ${poppins.className}`}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(14,165,233,0.15),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(247,183,51,0.13),transparent_28%),linear-gradient(180deg,#f4fbff_0%,#eef9ef_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white/82 px-4 py-2 text-sm font-bold text-[var(--skolegps-deep-navy)] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage
          </Link>
          <div className="hidden min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white/82 px-4 py-2 text-sm font-bold text-sky-800 shadow-sm backdrop-blur sm:inline-flex">
            <BookOpen className="h-4 w-4" />
            SkoleGPS-familien
          </div>
        </header>

        <section className="py-6 sm:py-8">
          <HeroBanner
            compact
            eyebrow="Lærerhub"
            icon={Compass}
            mascot="point"
            title="Lærerværktøjer"
            subtitle="Planlæg, byg og find materialer uden at miste overblikket."
          />

          <section
            className="mt-7 grid grid-cols-1 auto-rows-fr items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Lærerværktøjer"
          >
            {toolCards.map((tool, index) => {
              const Icon = tool.icon;
              const isExternal = tool.href.startsWith("http");

              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  aria-label={`${tool.cta}${isExternal ? " - åbner i en ny fane" : ""}`}
                  className="block h-full rounded-2xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-500"
                >
                  <QuickActionCard
                    className="min-h-60"
                    cta={tool.cta}
                    description={tool.description}
                    eyebrow={tool.familyLabel}
                    icon={Icon}
                    title={tool.title}
                    tone={toolTones[index % toolTones.length]}
                  />
                </Link>
              );
            })}
          </section>
        </section>
      </div>
    </main>
  );
}
