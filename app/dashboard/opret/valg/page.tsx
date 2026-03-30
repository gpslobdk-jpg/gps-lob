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
  "group relative mx-auto flex h-[12rem] w-full max-w-[20.5rem] flex-col overflow-hidden rounded-[2rem] border bg-white/10 p-0 text-left shadow-[0_22px_52px_rgba(15,23,42,0.16),0_8px_18px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-lg transition-all duration-300";

const cardPanelClass =
  "relative flex h-full flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-16px_24px_rgba(15,23,42,0.07)]";

type BuilderCard = {
  raceType: RaceTypeThemeKey;
  title: string;
  description: string;
  href?: string;
  locked?: boolean;
  badge?: string;
  accentClass: string;
  accentGlowClass: string;
  badgeClass: string;
};

const fagligeCards: BuilderCard[] = [
  {
    raceType: "manuel",
    title: "Generel Quiz",
    description: "Byg et klassisk løb med spørgsmål, svarmuligheder og fuld kontrol over ruten.",
    href: "/dashboard/opret/manuel",
    accentClass:
      "border-emerald-500/75 bg-emerald-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(16,185,129,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(16,185,129,0.24)]",
    badgeClass:
      "border-emerald-300/40 bg-emerald-400/20 text-white shadow-[0_10px_22px_rgba(16,185,129,0.18)]",
  },
  {
    raceType: "engelsk",
    title: "Engelsk",
    description: "Opret interaktive engelsk-løb med smart samtaletræning og sproglige missioner.",
    href: "/dashboard/opret/engelsk",
    accentClass:
      "border-indigo-500/75 bg-indigo-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(99,102,241,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(99,102,241,0.24)]",
    badgeClass:
      "border-indigo-300/40 bg-indigo-400/20 text-white shadow-[0_10px_22px_rgba(99,102,241,0.18)]",
  },
  {
    raceType: "matematik",
    title: "Matematik",
    description: "Løs regnestykker og matematiske gåder ude i virkeligheden.",
    href: "/dashboard/opret/matematik",
    accentClass:
      "border-amber-500/75 bg-amber-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(245,158,11,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(245,158,11,0.24)]",
    badgeClass:
      "border-amber-300/40 bg-amber-400/20 text-white shadow-[0_10px_22px_rgba(245,158,11,0.18)]",
  },
  {
    raceType: "dansk",
    title: "Dansk",
    description: "Læseforståelse og grammatik kombineret med bevægelse.",
    href: "/dashboard/opret/dansk",
    accentClass:
      "border-rose-500/75 bg-rose-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(244,63,94,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(244,63,94,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(244,63,94,0.24)]",
    badgeClass:
      "border-rose-300/40 bg-rose-400/20 text-white shadow-[0_10px_22px_rgba(244,63,94,0.18)]",
  },
];

const aiCards: BuilderCard[] = [
  {
    raceType: "foto",
    title: "Foto mission",
    description:
      "Send eleverne ud på kreative foto-opgaver og gennemgå holdenes billeder efter løbet.",
    href: "/dashboard/opret/foto",
    accentClass:
      "border-blue-500/75 bg-blue-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(59,130,246,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(59,130,246,0.24)]",
    badgeClass:
      "border-blue-300/40 bg-blue-400/20 text-white shadow-[0_10px_22px_rgba(59,130,246,0.18)]",
  },
  {
    raceType: "scanner",
    title: "Scan bogen",
    description: "Upload en bogside eller indsæt tekst, og lad den smarte motor omsætte den til et færdigt løb.",
    href: "/dashboard/opret/scanner",
    accentClass:
      "border-fuchsia-500/75 bg-fuchsia-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(217,70,239,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(217,70,239,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(217,70,239,0.24)]",
    badgeClass:
      "border-fuchsia-300/40 bg-fuchsia-400/20 text-white shadow-[0_10px_22px_rgba(217,70,239,0.18)]",
  },
  {
    raceType: "podcast",
    title: "Podcast-Detektiven",
    description: "Indsæt et link, og lad den smarte motor bygge et løb ud fra lyden.",
    href: "/dashboard/opret/podcast",
    accentClass:
      "border-purple-500/75 bg-purple-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(147,51,234,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(147,51,234,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(147,51,234,0.24)]",
    badgeClass:
      "border-purple-300/40 bg-purple-400/20 text-white shadow-[0_10px_22px_rgba(147,51,234,0.18)]",
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
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
          <div className="space-y-1">
            <h2
              className={`text-[1.4rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}
            >
              {card.title}
            </h2>
            <p className="mx-auto max-w-[15rem] text-xs leading-tight text-white/84">{card.description}</p>
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
      className={`relative flex min-h-screen flex-col bg-gradient-to-b from-slate-300 via-slate-100 to-zinc-200 px-6 pt-0 pb-8 text-white md:px-10 md:pt-0 md:pb-10 lg:bg-none lg:bg-transparent ${poppins.className}`}
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
      <div className="fixed inset-0 hidden bg-gradient-to-b from-slate-900/18 via-slate-900/8 to-slate-950/40 backdrop-blur-[2px] -z-10 lg:block" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-3 md:py-4">
        <Image src="/gpslogo.png" width={150} height={50} alt="Logo" priority />
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-300 hover:border-white/28 hover:bg-white/16"
        >
          <ArrowLeft className="h-4 w-4 text-white/82" />
          Tilbage
        </Link>
      </header>

      <section className="mx-auto mt-[-4rem] flex w-full max-w-6xl flex-col items-center text-center">
        <h1
          className={`text-4xl font-black tracking-[0.22em] text-white uppercase drop-shadow-[0_18px_40px_rgba(15,23,42,0.24)] md:text-6xl ${rubik.className}`}
        >
          VÆLG LØBSTYPE
        </h1>
      </section>

      <section className="mx-auto mt-56 w-full max-w-6xl lg:mt-64">
        <h2 className={`text-2xl font-black tracking-[0.18em] text-white drop-shadow-md uppercase mb-3 ${rubik.className}`}>
          Faglige Værktøjer
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 justify-items-center gap-8">
          {fagligeCards.map((card, index) => (
            <BuilderCard key={`${card.title}-${index}`} card={card} index={index} />
          ))}
        </div>

        <div className="w-full h-px bg-white/10 my-12" />

        <h2 className={`text-2xl font-black tracking-[0.18em] text-white drop-shadow-md uppercase mb-3 ${rubik.className}`}>
          Kreative Værktøjer & Scannere
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 justify-items-center gap-8">
          {aiCards.map((card, index) => (
            <BuilderCard key={`${card.title}-${index}`} card={card} index={index} />
          ))}
        </div>

        <div className="w-full h-px bg-white/10 my-12" />

        <h2 className={`text-2xl font-black tracking-[0.18em] text-white drop-shadow-md uppercase mb-3 ${rubik.className}`}>
          Spil
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 justify-items-center gap-8">
          <Link
            href="/dashboard/opret/zone-krig"
            className="block w-full text-left"
          >
            <motion.article
              whileHover={{ y: -4, scale: 1.012 }}
              className={`${cardBaseClass} cursor-pointer border-orange-500/75 bg-orange-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(249,115,22,0.28),inset_0_1px_0_rgba(255,255,255,0.18)]`}
            >
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(249,115,22,0.34),transparent_62%)] shadow-[inset_0_0_54px_rgba(249,115,22,0.28)]" />
              <div className="pointer-events-none absolute inset-[1px] rounded-[1.95rem]" />

              <div className="absolute top-4 right-4 z-20">
                <span className="inline-flex items-center rounded-full border border-orange-300/40 bg-orange-400/20 px-3 py-1 text-[0.58rem] font-bold tracking-[0.18em] text-white uppercase shadow-[0_10px_22px_rgba(249,115,22,0.22)] backdrop-blur-md">
                  SPIL
                </span>
              </div>

              <div className={`${cardPanelClass} text-slate-950`}>
                <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
                  <div className="space-y-1">
                    <h2 className={`text-[1.4rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
                      Zone-Krigen 🚩
                    </h2>
                    <p className="mx-auto max-w-[15rem] text-xs leading-tight text-white/84">
                      Omdan din skolegård til et live e-sport arena. Erobr zoner, svar på spørgsmål og kæmp om territorium!
                    </p>
                  </div>
                </div>
              </div>
            </motion.article>
          </Link>
        </div>
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
