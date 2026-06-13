"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MessageSquareText,
  Settings2,
  ShieldQuestion,
  Smartphone,
  UserSearch,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const gameSteps = [
  "Læreren vælger et hemmeligt ord.",
  "Eleverne joiner spillet fra deres mobil.",
  "De fleste elever får ordet at vide.",
  "Bedrageren kender ikke ordet og må bluffe.",
  "Klassen diskuterer, stemmer og ser om bedrageren bliver afsløret.",
] as const;

const roleCards = [
  {
    title: "Lærerens opgave",
    text: "Du opretter spillet, vælger ordet og styrer faserne fra live-siden.",
    icon: Settings2,
  },
  {
    title: "Elevernes oplevelse",
    text: "Eleverne får deres rolle på mobilen, deltager i diskussionen og stemmer til sidst på den, de mistænker.",
    icon: Smartphone,
  },
] as const;

const phaseCards = [
  { label: "Roller", icon: UserSearch },
  { label: "Bluff", icon: ShieldQuestion },
  { label: "Diskussion", icon: MessageSquareText },
  { label: "Afstemning", icon: CheckCircle2 },
] as const;

export default function FindBedragerenIntroPage() {
  return (
    <main
      className={`relative min-h-screen overflow-x-hidden bg-slate-950 px-6 py-8 text-white md:px-10 lg:px-12 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="fixed inset-0 h-full w-full object-cover opacity-[0.54]"
        src="/baggrundbilledespilside.mp4"
      />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(34,211,238,0.27),transparent_27%),radial-gradient(circle_at_86%_18%,rgba(168,85,247,0.22),transparent_29%),linear-gradient(135deg,rgba(2,6,23,0.87),rgba(15,23,42,0.75)_44%,rgba(3,7,18,0.9))]" />
      <div className="fixed inset-0 bg-slate-950/44 backdrop-blur-[1px]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard/mobilspil"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/16 bg-white/10 px-4 py-2 text-sm font-bold text-white/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition hover:border-cyan-200/42 hover:bg-white/16 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/18"
          >
            <ArrowLeft className="h-4 w-4" />
            Mobilspil
          </Link>
          <div className="hidden min-h-11 items-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 shadow-[0_16px_44px_rgba(8,145,178,0.16)] backdrop-blur-xl sm:inline-flex">
            <UsersRound className="h-4 w-4" />
            Socialt bluff-spil
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <div className="inline-flex rounded-lg border border-cyan-200/22 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100 shadow-[0_16px_44px_rgba(8,145,178,0.13)] backdrop-blur-xl">
              SOCIALT BLUFF-SPIL
            </div>
            <h1
              className={`mt-6 text-5xl font-black tracking-tight text-white drop-shadow-[0_18px_40px_rgba(0,0,0,0.5)] md:text-7xl ${rubik.className}`}
            >
              Find Bedrageren
            </h1>
            <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-200/90 md:text-lg">
              Et spil hvor eleverne får roller, et hemmeligt ord og skal finde den eller dem, der forsøger at bluffe
              sig igennem.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/opret/find-bedrageren"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-cyan-100/26 bg-cyan-300/18 px-5 py-3 text-sm font-black text-cyan-50 shadow-[0_18px_44px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:border-cyan-100/48 hover:bg-cyan-300/28 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/20"
              >
                Start opsætning
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/mobilspil"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/16 bg-white/10 px-5 py-3 text-sm font-black text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition hover:border-white/28 hover:bg-white/16 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/16"
              >
                <ArrowLeft className="h-4 w-4" />
                Tilbage til Mobilspil
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.62, delay: 0.08, ease: "easeOut" }}
            className="grid gap-4"
          >
            <section
              className="relative overflow-hidden rounded-lg border border-white/16 bg-white/10 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.42),0_18px_42px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl md:p-6"
              aria-labelledby="find-bedrageren-flow"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.26),transparent_42%),linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.035))]" />
              <div className="relative z-10">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/82">Sådan fungerer spillet</p>
                <h2 id="find-bedrageren-flow" className={`mt-2 text-3xl font-black tracking-tight text-white ${rubik.className}`}>
                  Først roller. Så mistanke.
                </h2>
                <ol className="mt-6 grid gap-3">
                  {gameSteps.map((step, index) => (
                    <li
                      key={step}
                      className="flex gap-3 rounded-lg border border-white/12 bg-slate-950/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-cyan-100/30 hover:bg-cyan-50/10"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/16 text-sm font-black text-cyan-50">
                        {index + 1}
                      </span>
                      <span className="pt-1 text-sm font-semibold leading-6 text-slate-200/88">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              {roleCards.map((card) => {
                const Icon = card.icon;

                return (
                  <section
                    key={card.title}
                    className="rounded-lg border border-white/14 bg-white/9 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition hover:border-cyan-100/30 hover:bg-white/13"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-100/24 bg-cyan-200/12 text-cyan-50 shadow-[0_16px_38px_rgba(34,211,238,0.14)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className={`mt-4 text-xl font-black tracking-tight text-white ${rubik.className}`}>{card.title}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-200/82">{card.text}</p>
                  </section>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {phaseCards.map((phase) => {
                const Icon = phase.icon;

                return (
                  <div
                    key={phase.label}
                    className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-lg border border-white/12 bg-slate-950/26 px-3 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
                  >
                    <Icon className="h-5 w-5 text-cyan-100" />
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-200/82">{phase.label}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
