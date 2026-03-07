"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Lottie from "lottie-react";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useState } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type HubCard = {
  title: string;
  shortText: string;
  detail?: string;
  href?: string;
  badge: string;
  cta: string;
  animationUrl: string;
  surfaceClass: string;
  borderClass: string;
  titleClass: string;
  accentTextClass: string;
  accentMutedClass: string;
  animationShellClass: string;
};

const quizAnimationUrl = "https://lottie.host/delicate-quiz-list.json";
const photoAnimationUrl = "https://lottie.host/transparent-camera.json";
const escapeAnimationUrl = "https://lottie.host/elegant-key-lock.json";
const roleplayAnimationUrl = "https://lottie.host/time-travel-silhouette.json";

type LottieCardAnimationProps = {
  src: string;
  shellClass: string;
};

function LottieCardAnimation({ src, shellClass }: LottieCardAnimationProps) {
  const [animationData, setAnimationData] = useState<unknown | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadAnimation = async () => {
      try {
        const response = await fetch(src, {
          signal: controller.signal,
          cache: "force-cache",
        });

        if (!response.ok) {
          throw new Error("Animationen kunne ikke hentes.");
        }

        const nextAnimationData = (await response.json()) as unknown;
        if (isActive) {
          setAnimationData(nextAnimationData);
        }
      } catch {
        if (isActive) {
          setAnimationData(null);
        }
      }
    };

    void loadAnimation();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [src]);

  return (
    <div
      className={`relative h-24 w-24 overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl ${shellClass}`}
    >
      <div className="absolute inset-[5px] rounded-[1.45rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.04))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_48%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.08),transparent_58%)]" />
      {animationData ? (
        <Lottie
          animationData={animationData}
          loop={true}
          autoplay={true}
          className="relative z-10 h-full w-full p-1.5 opacity-80"
        />
      ) : (
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <div className="relative h-12 w-12 opacity-70">
            <span className="absolute inset-0 animate-pulse rounded-full bg-white/12" />
            <span className="absolute inset-2 rounded-full border border-white/20" />
            <span className="absolute inset-5 rounded-full bg-white/20" />
          </div>
        </div>
      )}
    </div>
  );
}

function HubCardBody({ card }: { card: HubCard }) {
  return (
    <div className="relative z-10 flex h-full flex-col justify-between">
      <div>
        <span
          className={`inline-flex rounded-full border bg-white/75 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] uppercase ${card.borderClass} ${card.accentMutedClass}`}
        >
          {card.badge}
        </span>

        <div className="mt-5 flex justify-center">
          <LottieCardAnimation src={card.animationUrl} shellClass={card.animationShellClass} />
        </div>

        <div className="mt-6 flex-1 text-center">
          <h2 className={`text-2xl font-black tracking-wide ${card.titleClass} ${rubik.className}`}>
            {card.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-700">
            {card.shortText}
          </p>
          {card.detail ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-700">
              {card.detail}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className={`text-xs font-bold tracking-[0.18em] uppercase ${card.accentTextClass}`}>
          Vælg løbstype
        </p>
        <span className={`inline-flex items-center gap-2 text-sm font-semibold ${card.accentTextClass}`}>
          {card.cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1" />
        </span>
      </div>
    </div>
  );
}

const cards: HubCard[] = [
  {
    title: "Klassisk Quiz-løb",
    shortText: "Multiple-choice spørgsmål med AI-assistent.",
    detail: "Skab en klassisk rute med spørgsmål og fire svarmuligheder.",
    href: "/dashboard/opret/manuel",
    badge: "Klar nu",
    cta: "Åbn quiz-bygger",
    animationUrl: quizAnimationUrl,
    surfaceClass: "bg-emerald-50/90",
    borderClass: "border-emerald-200/50",
    titleClass: "text-emerald-950",
    accentTextClass: "text-emerald-700",
    accentMutedClass: "text-emerald-700/80",
    animationShellClass:
      "border-emerald-200/20 bg-emerald-100/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_26px_rgba(6,78,59,0.08)]",
  },
  {
    title: "AI Foto-mission",
    shortText: "Gør virkeligheden til en interaktiv opgave.",
    detail:
      "Deltagerne skal bruge øjnene! I stedet for at svare på spørgsmål, skal de finde og fotografere specifikke motiver i virkeligheden.",
    href: "/dashboard/opret/foto",
    badge: "Klar nu",
    cta: "Åbn foto-mission",
    animationUrl: photoAnimationUrl,
    surfaceClass: "bg-sky-50/90",
    borderClass: "border-sky-200/50",
    titleClass: "text-sky-950",
    accentTextClass: "text-sky-700",
    accentMutedClass: "text-sky-700/80",
    animationShellClass:
      "border-sky-200/20 bg-sky-100/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_26px_rgba(14,116,144,0.08)]",
  },
  {
    title: "Escape Room i Naturen",
    shortText: "Knæk koden og løs logiske gåder.",
    detail:
      "Fokus på logik, matematik og samarbejde. Deltagerne skal løse gåder ved hver post for at samle tal eller bogstaver til en endelig master-kode. Perfekt til teambuilding og udendørs 'break-out' spil.",
    href: "/dashboard/opret/escape",
    badge: "Klar nu",
    cta: "Åbn escape room",
    animationUrl: escapeAnimationUrl,
    surfaceClass: "bg-amber-50/90",
    borderClass: "border-amber-200/50",
    titleClass: "text-amber-950",
    accentTextClass: "text-amber-700",
    accentMutedClass: "text-amber-700/80",
    animationShellClass:
      "border-amber-200/20 bg-amber-100/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_26px_rgba(180,83,9,0.08)]",
  },
  {
    title: "Tidsmaskinen",
    shortText: "Lad en historisk person styre løbet.",
    detail:
      "AI'en spiller en fiktiv eller historisk karakter. Deltagerne modtager dramatiske beskeder og skal svare for at drive historien frem.",
    href: "/dashboard/opret/rollespil",
    badge: "Klar nu",
    cta: "Åbn rollespil",
    animationUrl: roleplayAnimationUrl,
    surfaceClass: "bg-stone-100/90",
    borderClass: "border-stone-200/50",
    titleClass: "text-stone-900",
    accentTextClass: "text-stone-700",
    accentMutedClass: "text-stone-700/80",
    animationShellClass:
      "border-violet-200/20 bg-slate-100/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_26px_rgba(71,85,105,0.08)]",
  },
];

export default function ValgHubPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 px-6 py-12 text-emerald-950 md:px-10 lg:bg-none lg:bg-transparent ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 -z-20 hidden h-full w-full object-cover lg:block"
        src="/opret-bg.mp4"
      />
      <div className="fixed inset-0 -z-10 hidden bg-gradient-to-b from-sky-900/10 to-emerald-900/50 backdrop-blur-[2px] lg:block" />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret"
            className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-900 shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-white/95 hover:shadow-xl"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til opret
          </Link>
          <p className="rounded-full border border-white/50 bg-white/75 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-emerald-800/80 uppercase shadow-lg backdrop-blur-md">
            Løbstyper
          </p>
        </div>

        <div className="mt-12 max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.32em] text-white/90 drop-shadow-md uppercase">
            Vælg format
          </p>
          <h1
            className={`mt-4 text-4xl font-black tracking-tight text-white drop-shadow-md md:text-5xl ${rubik.className}`}
          >
            Hvilken type løb vil du bygge?
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white drop-shadow-md md:text-base">
            Vælg det format, der passer bedst til dit arrangement. Uanset om det er
            teambuilding, en skattejagt eller undervisning, tilpasser systemet sig automatisk.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {cards.map((card, index) => {
            if (card.href) {
              return (
                <Link
                  key={`${card.title}-${index}`}
                  href={card.href}
                  className="group block h-full focus:outline-none"
                >
                  <article
                    className={`relative flex h-full flex-col justify-between overflow-hidden rounded-[2rem] border p-7 shadow-lg backdrop-blur-md transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl group-focus-visible:scale-[1.02] group-focus-visible:shadow-xl ${card.surfaceClass} ${card.borderClass}`}
                  >
                    <HubCardBody card={card} />
                  </article>
                </Link>
              );
            }

            return (
              <article
                key={`${card.title}-${index}`}
                className={`relative flex flex-col justify-between overflow-hidden rounded-[2rem] border p-7 shadow-lg backdrop-blur-md ${card.surfaceClass} ${card.borderClass}`}
              >
                <HubCardBody card={card} />
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
