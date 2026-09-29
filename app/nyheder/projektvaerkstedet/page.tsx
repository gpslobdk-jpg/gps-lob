import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, FileText, Printer } from "lucide-react";
import Link from "next/link";

import { poppins, rubik } from "@/lib/fonts";
import {
  PROJECT_WORKSHOP_PATH,
} from "@/lib/projektvaerkstedet/links";

export const metadata: Metadata = {
  title: "Nyt: Projektværkstedet | SkoleGPS",
  description:
    "Projektværkstedet samler to papirnære matematikforløb, som åbnes fra SkoleGPS i PrintMitArbejdsark.",
};

export default function ProjektvaerkstedetNewsPage() {
  return (
    <main className={`min-h-screen bg-[linear-gradient(180deg,#f6fbff_0%,#eef8f4_48%,#ffffff_100%)] px-5 py-6 text-slate-900 sm:px-8 sm:py-10 ${poppins.className}`}>
      <article className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-800"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Til forsiden
        </Link>

        <header className="mt-7 rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-[0_18px_45px_rgba(7,86,58,0.08)] sm:p-10">
          <p className="text-xs font-black tracking-[0.18em] text-emerald-800 uppercase">Nyhed · 29. september 2026</p>
          <h1 className={`mt-4 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] [overflow-wrap:anywhere] sm:text-5xl ${rubik.className}`}>
            Projektværk<wbr />stedet er klar
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700 sm:text-xl">
            SkoleGPS har fået en tydelig indgang til Projektværkstedet: to matematikforløb, hvor materialerne kan printes, og elevernes undersøgelser foregår med hænderne og på papiret.
          </p>
        </header>

        <section className="mt-7 grid gap-5 md:grid-cols-2" aria-label="Det nye i Projektværkstedet">
          <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
            <FileText aria-hidden="true" className="h-6 w-6 text-emerald-700" />
            <h2 className="mt-4 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">To konkrete forløb</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Rumfang — hvad tæller vi egentlig? og Renover klasselokalet giver læreren et klart udgangspunkt i matematik med forskellige faglige greb.
            </p>
          </div>
          <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
            <Printer aria-hidden="true" className="h-6 w-6 text-emerald-700" />
            <h2 className="mt-4 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">Materialer til print</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Forløbene åbnes i PrintMitArbejdsark, hvor læreren vælger materialer og fortsætter med sit lærerlogin.
            </p>
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-800 p-6 text-white shadow-[0_18px_40px_rgba(6,78,59,0.18)] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
          <div>
            <h2 className={`text-2xl font-black tracking-tight ${rubik.className}`}>Se Projektværkstedet</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Læs om forløbene, og åbn dem derfra med den eksisterende, beskyttede overgang til PrintMitArbejdsark.</p>
          </div>
          <Link
            href={PROJECT_WORKSHOP_PATH}
            className="mt-5 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50 sm:mt-0"
          >
            Til Projektværkstedet
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </section>
      </article>
    </main>
  );
}
