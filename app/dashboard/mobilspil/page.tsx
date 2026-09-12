"use client";

import { ArrowLeft, ArrowRight, Gamepad2, UserSearch } from "lucide-react";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";

export default function MobilspilPage() {
  return (
    <main
      className={"min-h-screen bg-[linear-gradient(135deg,#f4f9ff_0%,#e2efff_100%)] px-6 py-8 text-slate-950 md:px-10 lg:px-12 " + poppins.className}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="hidden items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 sm:inline-flex">
            <Gamepad2 className="h-4 w-4" />
            Mobilspil
          </span>
        </header>

        <section className="flex flex-1 items-center py-12 sm:py-16">
          <div className="w-full">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-sky-700">Mobilspil</p>
              <h1 className={"mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl " + rubik.className}>
                Vælg et spil
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-slate-600">
                Du sætter spillet op her. Eleverne deltager fra deres mobil, og du styrer forløbet fra live-siden.
              </p>
            </div>

            <article className="mx-auto mt-10 max-w-2xl rounded-3xl border border-sky-200 bg-white p-6 shadow-[0_18px_44px_rgba(7,68,128,0.10)] sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <UserSearch className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Mobilspil</p>
                  <h2 className={"mt-2 text-3xl font-black tracking-tight text-slate-950 " + rubik.className}>
                    Find Bedrageren
                  </h2>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                    Eleverne får roller og et hemmeligt ord. Klassen taler sammen og stemmer om, hvem der bluffer.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-medium leading-6 text-slate-700">
                Opsæt ord og roller → eleverne joiner → du styrer diskussion og afstemning.
              </div>

              <Link
                href="/dashboard/mobilspil/find-bedrageren"
                className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0377d8] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#075fb2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
              >
                Opsæt spil
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
