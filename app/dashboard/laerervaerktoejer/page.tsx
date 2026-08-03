import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Podcast,
  School,
} from "lucide-react";
import { Poppins, Rubik } from "next/font/google";

export const metadata: Metadata = {
  title: "Lærerværktøjer – SkoleGPS",
  description: "En samlet hub for planlægningsværktøjer til lærere i SkoleGPS.",
};

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const toolCards = [
  {
    title: "Årsplan",
    description: "Lav et første udkast til skoleåret, tilpas indholdet og gør planen klar som PDF.",
    secondaryText:
      "Få overblik over fag, perioder og mål, før du deler planen med kolleger eller Aula.",
    href: "/dashboard/laerervaerktoejer/aarsplan-generator",
    icon: Calendar,
    cta: "Lav årsplan",
    familyLabel: "SkoleGPS",
    destinationLabel: "Åbner i SkoleGPS",
  },
  {
    title: "SkemaPilot",
    description: "Byg en overskuelig skemakladde til små skoler, friskoler og privatskoler.",
    secondaryText:
      "Lav en visuel skemakladde, fordel fag, lærere og lokaler, og gem kladden lokalt i browseren.",
    href: "https://www.skemapilot.dk/app",
    icon: School,
    cta: "Åbn SkemaPilot",
    familyLabel: "SkoleGPS-familien",
    destinationLabel: "Åbner på skemapilot.dk",
  },
  {
    title: "SkolePodcast.dk",
    description: "Lav elevpodcasts nemt og trygt som en del af undervisningen.",
    secondaryText:
      "Saml idé, optagelse og elevernes podcastarbejde på en enkel side, der er bygget til skolen.",
    href: "https://skolepodcast.dk",
    icon: Podcast,
    cta: "Åbn SkolePodcast.dk",
    familyLabel: "SkoleGPS-familien",
    destinationLabel: "Åbner på skolepodcast.dk",
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
              Tre enkle indgange til planlægning, skema og elevpodcast.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Vælg det værktøj, der passer til opgaven. Resten åbner roligt og tydeligt derfra.
            </p>
          </div>

          <section
            className="mt-9 grid auto-rows-fr items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3"
            aria-label="Lærerværktøjer"
          >
            {toolCards.map((tool) => {
              const Icon = tool.icon;
              const isExternal = tool.href.startsWith("http");
              const LinkIcon = isExternal ? ArrowUpRight : ArrowRight;

              return (
                <article
                  key={tool.href}
                  className="group relative flex h-full min-h-[26rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-950/75 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-emerald-300/45 hover:bg-slate-950/85 md:p-7"
                >
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/80 to-transparent" />

                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <span className="max-w-[11rem] break-words rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-right text-[0.68rem] font-black uppercase leading-4 tracking-[0.12em] text-slate-200">
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
                    <p className="mt-5 border-t border-white/10 pt-5 text-sm leading-6 text-slate-300">
                      {tool.secondaryText}
                    </p>
                  </div>

                  <div className="mt-auto min-w-0 pt-7">
                    <p className="mb-3 break-words text-xs font-semibold text-emerald-100/75">
                      {tool.destinationLabel}
                    </p>
                    <Link
                      href={tool.href}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      aria-label={`${tool.cta}${isExternal ? " – åbner i en ny fane" : ""}`}
                      className="inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500 px-4 py-3 text-center text-sm leading-5 font-black whitespace-normal text-slate-950 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/25 [overflow-wrap:anywhere]"
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
