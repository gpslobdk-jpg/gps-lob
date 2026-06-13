import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Calendar, FileText, GraduationCap } from "lucide-react";
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
    title: "Årsplan-generator",
    label: "KOMMER SNART",
    description:
      "Lav en årsplan ud fra fag, klassetrin, skoleår, kommune, ferieplan og Fælles Mål.",
    secondaryText:
      "Første version kommer til at hjælpe med struktur, perioder, forløb og en let forklaring af Fælles Mål i det valgte fag.",
    href: "/dashboard/laerervaerktoejer/aarsplan-generator",
    icon: Calendar,
  },
] as const;

const focusAreas = [
  { title: "Årsplaner", icon: Calendar },
  { title: "Forløb", icon: FileText },
  { title: "Fælles Mål", icon: GraduationCap },
] as const;

export default function LaerervaerktoejerPage() {
  return (
    <main className={`min-h-screen bg-slate-50 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til dashboard
          </Link>
          <div className="hidden min-h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900 shadow-sm sm:inline-flex">
            <BookOpen className="h-4 w-4" />
            Planlægning
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:py-16">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-800">
              Lærerhub
            </p>
            <h1 className={`mt-6 text-5xl font-black tracking-tight text-slate-950 md:text-7xl ${rubik.className}`}>
              Lærerværktøjer
            </h1>
            <p className="mt-5 max-w-xl text-xl font-semibold leading-8 text-slate-700">
              Saml dine planlægningsværktøjer ét sted.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Her finder du værktøjer, der kan hjælpe med årsplaner, forløb, idéer og struktur i undervisningen.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {focusAreas.map((area) => {
                const Icon = area.icon;

                return (
                  <div
                    key={area.title}
                    className="flex min-h-24 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-800">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-bold text-slate-800">{area.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <section className="grid gap-5" aria-label="Lærerværktøjer">
            {toolCards.map((tool) => {
              const Icon = tool.icon;

              return (
                <article
                  key={tool.href}
                  className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] transition duration-300 hover:border-emerald-200 hover:shadow-[0_28px_80px_rgba(15,23,42,0.12)] md:p-7"
                >
                  <div className="flex flex-col gap-7">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-800">
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                          {tool.label}
                        </p>
                        <h2 className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}>
                          {tool.title}
                        </h2>
                        <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-700 md:text-base">
                          {tool.description}
                        </p>
                        <p className="mt-4 max-w-xl border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">
                          {tool.secondaryText}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={tool.href}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:border-emerald-700 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 md:w-fit"
                    >
                      Åbn værktøj
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
