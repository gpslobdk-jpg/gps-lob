"use client";

import { ArrowLeft, Camera, Sparkles } from "lucide-react";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function SelfieBuilderPlaceholderPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-transparent px-6 py-12 text-rose-950 md:px-10 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 -z-20 h-full w-full scale-105 object-cover brightness-[0.5] blur-sm"
        src="/baggrundvalgside.mp4"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-orange-950/18 via-rose-950/18 to-rose-950/58 backdrop-blur-[2px]" />

      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/80 px-4 py-2 text-sm font-medium text-rose-900 shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-white/95 hover:shadow-xl"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til løbstyper
          </Link>
          <p className="rounded-full border border-white/50 bg-white/75 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-rose-800/80 uppercase shadow-lg backdrop-blur-md">
            Selfie-jagt
          </p>
        </div>

        <div className="mt-14 rounded-[2.5rem] border border-white/45 bg-white/78 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.24)] backdrop-blur-xl md:p-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-200/70 bg-[linear-gradient(145deg,rgba(255,237,213,0.96),rgba(255,228,230,0.94))] text-orange-700 shadow-inner">
            <Camera className="h-7 w-7" />
          </div>

          <p className="mt-8 text-sm font-semibold tracking-[0.32em] text-rose-700/80 uppercase">
            Fase 1 er landet
          </p>
          <h1 className={`mt-4 text-4xl font-black tracking-tight text-rose-950 md:text-5xl ${rubik.className}`}>
            Selfie-byggeren er næste stop
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-700">
            Valg-kortet er nu på plads, og næste fase er selve builderen. Her kommer du snart til
            at opsætte selfie-poster, hvor AI&apos;en både tjekker ansigtet og motivet i baggrunden.
          </p>

          <div className="mt-8 rounded-[2rem] border border-orange-200/70 bg-[linear-gradient(145deg,rgba(255,237,213,0.92),rgba(255,228,230,0.88))] p-6 shadow-[0_18px_40px_rgba(251,146,60,0.14)]">
            <div className="flex items-center gap-3 text-orange-700">
              <Sparkles className="h-5 w-5" />
              <p className="text-sm font-semibold tracking-[0.2em] uppercase">På vej</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Den kommende builder får samme glass-look som resten af dashboardet og bliver gjort
              klar til selfie-missioner med lokation, baggrundsobjekt og AI-validering.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
