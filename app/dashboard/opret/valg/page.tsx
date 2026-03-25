"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

import PwaInstallTip from "@/components/PwaInstallTip";
import { type RaceTypeThemeKey } from "@/utils/raceTypeTheme";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const cardBaseClass =
  "group relative mx-auto flex h-[21rem] w-full max-w-[20.5rem] flex-col overflow-hidden rounded-[2rem] border bg-white/10 p-0 text-left shadow-[0_22px_52px_rgba(15,23,42,0.16),0_8px_18px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-lg transition-all duration-300";

const cardPanelClass =
  "relative flex h-full flex-col items-center justify-between rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] px-6 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-16px_24px_rgba(15,23,42,0.07)]";

const cardActionClass =
  "flex min-h-12 w-full max-w-[15.5rem] items-center justify-between rounded-full border border-white/16 bg-white/12 px-5 py-3 shadow-[0_14px_28px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md";

type BuilderCard = {
  raceType: RaceTypeThemeKey;
  title: string;
  description: string;
  href?: string;
  eyebrow: string;
  actionLabel: string;
  actionState: string;
  locked?: boolean;
  badge?: string;
  accentClass: string;
  accentGlowClass: string;
  badgeClass: string;
  actionAccentClass: string;
};

const cards: BuilderCard[] = [
  {
    raceType: "manuel",
    title: "Klassisk Quiz-løb",
    description: "Skab en klassisk rute med spørgsmål og fire svarmuligheder.",
    href: "/dashboard/opret/manuel",
    eyebrow: "Klar til at bygge",
    actionLabel: "Åbn quiz-byggeren",
    actionState: "Byg",
    accentClass:
      "border-emerald-500/75 bg-emerald-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(16,185,129,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(16,185,129,0.24)]",
    badgeClass:
      "border-emerald-300/40 bg-emerald-400/20 text-white shadow-[0_10px_22px_rgba(16,185,129,0.18)]",
    actionAccentClass: "border-emerald-300/34 bg-emerald-400/20",
  },
  {
    raceType: "foto",
    title: "Foto mission",
    description:
      "Eleverne løser kreative foto-opgaver ude på ruten og uploader billederne. Efter løbet kan du gennemgå holdenes pletskud.",
    href: "/dashboard/opret/foto",
    eyebrow: "Kamera & kreativitet",
    actionLabel: "Åbn foto-byggeren",
    actionState: "Start",
    accentClass:
      "border-blue-500/75 bg-blue-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(59,130,246,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(59,130,246,0.24)]",
    badgeClass:
      "border-blue-300/40 bg-blue-400/20 text-white shadow-[0_10px_22px_rgba(59,130,246,0.18)]",
    actionAccentClass: "border-blue-300/34 bg-blue-400/20",
  },
  {
    raceType: "scanner",
    title: "Scan bogen",
    description: "Upload en bogside eller indsæt tekst, og lad AI bygge et komplet quiz-løb.",
    href: "/dashboard/opret/scanner",
    eyebrow: "AI klar på siden",
    actionLabel: "Åbn scan-byggeren",
    actionState: "Scan",
    accentClass:
      "border-teal-500/75 bg-teal-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(20,184,166,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(20,184,166,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(20,184,166,0.24)]",
    badgeClass:
      "border-teal-300/40 bg-teal-400/20 text-white shadow-[0_10px_22px_rgba(20,184,166,0.18)]",
    actionAccentClass: "border-teal-300/34 bg-teal-400/20",
  },
];

function BuilderCard({ card, index }: { card: BuilderCard; index: number }) {
  const content = (
    <motion.article
      whileHover={card.locked ? undefined : { y: -4, scale: 1.012 }}
      className={`${cardBaseClass} ${card.accentClass} ${card.locked ? "cursor-default" : "cursor-pointer"}`}
    >
      <div className={`pointer-events-none absolute inset-0 rounded-[2rem] ${card.accentGlowClass}`} />
      <div className="pointer-events-none absolute inset-[1px] rounded-[1.95rem]" />

      {card.badge ? (
        <div className="absolute top-4 right-4 z-20">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.58rem] font-bold tracking-[0.18em] uppercase backdrop-blur-md ${card.badgeClass}`}
          >
            {card.badge}
          </span>
        </div>
      ) : null}

      <div className={`${cardPanelClass} text-slate-950`}>
        <div className="relative z-10 flex h-full w-full flex-col items-center text-center">
          <div
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[0.58rem] font-bold tracking-[0.18em] uppercase backdrop-blur-md ${card.badgeClass}`}
          >
            {card.eyebrow}
          </div>

          <div className="mt-auto space-y-3">
            <h2
              className={`text-[1.85rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}
            >
              {card.title}
            </h2>
            <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-white/70 uppercase">
              {card.locked ? "Forberedes til næste bølge" : "Byg med samme premium kontrol"}
            </p>
            <p className="mx-auto max-w-[15.5rem] text-sm leading-6 text-white/84">{card.description}</p>
          </div>

          <div className="mt-auto flex w-full justify-center pt-6">
            <div className={`${cardActionClass} ${card.actionAccentClass}`}>
              <span className="text-sm font-bold text-white/92">{card.actionLabel}</span>
              <span className="text-[0.7rem] font-black tracking-[0.16em] text-white/82 uppercase">
                {card.actionState}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );

  if (card.locked || !card.href) {
    return <div className="block w-full">{content}</div>;
  }

  return (
    <Link
      href={card.href}
      data-tour={index === 0 ? "valg-classic-quiz" : undefined}
      className="block w-full text-left"
    >
      {content}
    </Link>
  );
}

export default function ValgHubPage() {
  return (
    <main
      className={`relative flex min-h-screen flex-col bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 px-6 pt-0 pb-8 text-white md:px-10 md:pt-0 md:pb-10 lg:bg-none lg:bg-transparent ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="fixed top-0 left-0 hidden h-full w-full object-cover -z-20 lg:block"
        src="/promo.mp4"
      />
      <div className="fixed inset-0 hidden bg-gradient-to-b from-sky-900/20 to-emerald-900/40 backdrop-blur-[2px] -z-10 lg:block" />

      <header className="flex items-center justify-between">
        <Image src="/gpslogo.png" width={150} height={50} alt="Logo" priority />
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-300 hover:border-white/28 hover:bg-white/16"
        >
          <ArrowLeft className="h-4 w-4 text-white/82" />
          Tilbage
        </Link>
      </header>

      <section className="mx-auto -mt-8 flex w-full max-w-5xl flex-col items-center text-center md:-mt-12">
        <p className="mb-3 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-[0.62rem] font-semibold tracking-[0.28em] text-white/78 uppercase shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          Løbstyper
        </p>
        <h1
          className={`mb-2 text-4xl font-black tracking-widest text-white uppercase drop-shadow-md md:text-6xl ${rubik.className}`}
        >
          VÆLG LØBSTYPE
        </h1>
        <p className="text-emerald-50">Hvilken type løb vil du bygge?</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/84 md:text-base">
          Vælg det format, der passer bedst til dit arrangement. Quiz, foto og scanner er klar nu i et mere tydeligt og farvestærkt overblik.
        </p>
      </section>

      <section className="mx-auto mt-4 grid w-full max-w-5xl grid-cols-1 justify-items-center gap-6 md:grid-cols-3">
        {cards.map((card, index) => (
          <BuilderCard key={`${card.title}-${index}`} card={card} index={index} />
        ))}
      </section>

      <div className="mx-auto mt-8 w-full max-w-4xl">
        <PwaInstallTip />
      </div>

      <div className="mt-10 flex justify-center">
        <div className="space-x-4 text-sm text-white/68">
          <Link href="/privacy" className="transition hover:text-white">
            Privatlivspolitik
          </Link>
          <Link href="/teknologi" className="transition hover:text-white">
            Udvikler Info
          </Link>
        </div>
      </div>
    </main>
  );
}
