import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, FileText, Printer, Ruler, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { poppins, rubik } from "@/lib/fonts";
import {
  getProjectWorkshopStartHref,
  PROJECT_WORKSHOP_NEWS_PATH,
} from "@/lib/projektvaerkstedet/links";

export const metadata: Metadata = {
  title: "Projektværkstedet | SkoleGPS",
  description:
    "Find papirnære matematikforløb med printmaterialer i Projektværkstedet fra SkoleGPS.",
};

const activities = [
  {
    icon: Ruler,
    title: "Rumfang — hvad tæller vi egentlig?",
    body:
      "Et matematikforløb om lag, kubiske klodser og cm³ med elevark, forklaring, fagplakat og lærerfacit til print.",
  },
  {
    icon: FileText,
    title: "Renover klasselokalet",
    body:
      "Et færdigt forløb, hvor eleverne måler, regner, bygger en flad model og begrunder et fiktivt renoveringsforslag.",
  },
] as const;

export default function ProjektvaerkstedetPage() {
  const startHref = getProjectWorkshopStartHref();

  return (
    <main className={`min-h-screen bg-[linear-gradient(180deg,#f2fbf7_0%,#e6f6f0_43%,#ffffff_100%)] px-5 py-6 text-slate-900 sm:px-8 sm:py-10 ${poppins.className}`}>
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Til forsiden
          </Link>
          <Link
            href={PROJECT_WORKSHOP_NEWS_PATH}
            className="text-sm font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 transition hover:text-emerald-950"
          >
            Læs nyheden
          </Link>
        </header>

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-[0_18px_45px_rgba(7,86,58,0.09)] sm:p-10">
          <p className="text-xs font-black tracking-[0.18em] text-emerald-800 uppercase">SkoleGPS · lærerværktøj</p>
          <h1 className={`mt-4 max-w-4xl text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] [overflow-wrap:anywhere] sm:text-5xl ${rubik.className}`}>
            Projektværk<wbr />stedet
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700 sm:text-xl">
            To papirnære matematikforløb, hvor klassen undersøger, regner, bygger og forklarer. Vælg et forløb i PrintMitArbejdsark, hent materialerne og gå i gang sammen.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              data-testid="project-workshop-start"
              href={startHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(4,120,87,0.2)] transition hover:bg-emerald-800"
            >
              Åbn Projektværkstedet i PrintMitArbejdsark
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
            <Link
              href="#forloeb"
              className="inline-flex min-h-12 items-center justify-center rounded-full px-4 py-3 text-sm font-black text-emerald-800 underline decoration-emerald-300 underline-offset-4 transition hover:text-emerald-950"
            >
              Se de to forløb
            </Link>
          </div>
        </section>

        <section id="forloeb" className="mt-7 scroll-mt-6" aria-labelledby="project-workshop-activities-heading">
          <div className="max-w-3xl">
            <p className="text-xs font-black tracking-[0.16em] text-emerald-800 uppercase">Forløb</p>
            <h2 id="project-workshop-activities-heading" className={`mt-2 text-3xl font-black tracking-tight text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
              Vælg den opgave, der passer til klassen
            </h2>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {activities.map(({ body, icon: Icon, title }) => (
              <article key={title} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-sky-100 bg-sky-50/75 p-5 sm:flex sm:items-start sm:gap-4 sm:p-6" aria-labelledby="project-workshop-boundary-heading">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="mt-3 sm:mt-0">
            <h2 id="project-workshop-boundary-heading" className="font-black text-[var(--skolegps-deep-navy)]">Tydelig overgang til PrintMitArbejdsark</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              SkoleGPS sender dig videre med dit lærerlogin. Projektforløb og lokale kladder hører til i PrintMitArbejdsark; denne side overfører ikke klasse-, elev- eller projektdata mellem værktøjerne.
            </p>
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-800 p-6 text-white shadow-[0_18px_40px_rgba(6,78,59,0.18)] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-emerald-100 uppercase">Klar til print</p>
            <h2 className={`mt-2 text-2xl font-black tracking-tight ${rubik.className}`}>Start med materialerne — ikke med en kontoopsætning.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Vælg et forløb, hent det materiale du skal bruge, og lad elevernes arbejde på papir være omdrejningspunktet.</p>
          </div>
          <a
            href={startHref}
            className="mt-5 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50 sm:mt-0"
          >
            <Printer aria-hidden="true" className="h-4 w-4" />
            Vælg et forløb
          </a>
        </section>
      </div>
    </main>
  );
}
