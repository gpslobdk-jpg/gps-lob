import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Calendar, Check, FileText, GraduationCap } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";

export const metadata: Metadata = {
  title: "Årsplan-generator – GPSLØB",
  description: "En kommende årsplan-generator til lærere i GPSLØB.",
};

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const steps = [
  "Vælg fag og klassetrin",
  "Vælg skoleår og kommune",
  "Tilpas temaer og ønsker",
  "Generér årsplan",
  "Redigér og eksportér",
] as const;

const wizardPrinciples = [
  "Én ting ad gangen",
  "Tydelige dropdowns",
  "Desktop-first",
  "Ingen overfyldt side",
] as const;

const previewAreas = [
  { title: "Fag og klassetrin", icon: BookOpen },
  { title: "Skoleår og ferieplan", icon: Calendar },
  { title: "Fælles Mål", icon: GraduationCap },
  { title: "Forløb og struktur", icon: FileText },
] as const;

export default function AarsplanGeneratorPage() {
  return (
    <main className={`min-h-screen bg-slate-50 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard/laerervaerktoejer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Lærerværktøjer
          </Link>
          <div className="hidden min-h-11 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900 shadow-sm sm:inline-flex">
            <Calendar className="h-4 w-4" />
            Kommer snart
          </div>
        </header>

        <section className="py-12 lg:py-16">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-amber-800">
              KOMMER SNART
            </p>
            <h1 className={`mt-6 text-5xl font-black tracking-tight text-slate-950 md:text-7xl ${rubik.className}`}>
              Årsplan-generator
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-700 md:text-lg">
              Her kommer et værktøj, der kan hjælpe lærere med at lave årsplaner tilpasset fag, klassetrin, skoleår og kommunens ferieplan.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {previewAreas.map((area) => {
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
        </section>

        <section className="grid gap-6 pb-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
              Kommende trin
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {steps.map((step, index) => (
                <article
                  key={step}
                  className="flex min-h-36 flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <h2 className="mt-5 text-base font-black leading-6 text-slate-950">{step}</h2>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white">
                <Check className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-semibold leading-7 text-emerald-950">
                Målet er, at årsplanen starter med en let forklaring af Fælles Mål i det valgte fag og derefter fordeler forløb efter den valgte kommunes ferieplan.
              </p>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Planlagt wizard-flow
              </p>
              <div className="mt-4 grid gap-2">
                {wizardPrinciples.map((principle) => (
                  <div
                    key={principle}
                    className="flex min-h-10 items-center gap-3 border-b border-slate-100 py-2 last:border-b-0"
                  >
                    <Check className="h-4 w-4 text-emerald-700" />
                    <span className="text-sm font-bold text-slate-800">{principle}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
