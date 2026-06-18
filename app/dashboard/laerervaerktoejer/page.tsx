import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Calendar, School } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";

export const metadata: Metadata = {
  title: "Lærerværktøjer – GPSLØB",
  description: "En samlet hub for planlægningsværktøjer til lærere i GPSLØB.",
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
    title: "Skal vi hjælpe dig med at lave en årsplan?",
    description: "Lav et første udkast, tilpas det og gør det klar som PDF.",
    secondaryText: "Senere kan AI hjælpe med efterredigering og billeder.",
    href: "/dashboard/laerervaerktoejer/aarsplan-generator",
    icon: Calendar,
    cta: "Lav årsplan",
  },
  {
    title: "SkemaPilot",
    description: "Et skemaværktøj under opbygning til små skoler, friskoler og privatskoler.",
    secondaryText:
      "Lav en visuel skemakladde, fordel fag, lærere og lokaler, og gem kladden lokalt i browseren.",
    href: "https://www.skemapilot.dk/app",
    icon: School,
    cta: "Åbn SkemaPilot",
    statusLabel: "Åbner på skemapilot.dk",
  },
] as const;

export default function LaerervaerktoejerPage() {
  return (
    <main className={`relative min-h-screen overflow-hidden bg-slate-950 text-white ${poppins.className}`}>
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

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-slate-950/55 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:border-emerald-300/60 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til dashboard
          </Link>
          <div className="hidden min-h-11 items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-50 shadow-sm backdrop-blur sm:inline-flex">
            <BookOpen className="h-4 w-4" />
            Planlægning
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:py-16">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-50 backdrop-blur">
              Lærerhub
            </p>
            <h1 className={`mt-6 text-5xl font-black tracking-tight text-white md:text-7xl ${rubik.className}`}>
              Lærerværktøjer
            </h1>
            <p className="mt-5 max-w-xl text-xl font-semibold leading-8 text-slate-100">
              Saml dine planlægningsværktøjer ét sted.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Start roligt med en årsplan, og gør den klar til at dele med klassen eller Aula.
            </p>
          </div>

          <section className="grid gap-5" aria-label="Lærerværktøjer">
            {toolCards.map((tool) => {
              const Icon = tool.icon;
              const isExternal = tool.href.startsWith("http");

              return (
                <article
                  key={tool.href}
                  className="group relative overflow-hidden rounded-lg border border-white/15 bg-slate-950/70 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-md transition duration-300 hover:border-emerald-300/45 hover:bg-slate-950/75 md:p-7"
                >
                  <div className="flex flex-col gap-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className={`text-3xl font-black tracking-tight text-white ${rubik.className}`}>
                            {tool.title}
                          </h2>
                          {"statusLabel" in tool ? (
                            <span className="rounded-lg border border-amber-200/40 bg-amber-200/15 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
                              {tool.statusLabel}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-200 md:text-base">
                          {tool.description}
                        </p>
                        <p className="mt-4 max-w-xl border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">
                          {tool.secondaryText}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={tool.href}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/25 md:w-fit"
                    >
                      {tool.cta}
                      <ArrowRight className="h-4 w-4" />
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
