"use client";

import { ArrowLeft, type LucideIcon } from "lucide-react";
import Image from "next/image";
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

type HubCard = {
  title: string;
  description: string;
  href: string;
  imageSrc?: string;
  icon?: LucideIcon;
  iconShellClass: string;
  iconAccentClass: string;
  titleClass: string;
  bodyClass: string;
  badgeClass: string;
  shadowClass: string;
  hoverShadowClass: string;
  cardClassName?: string;
};

const cards: HubCard[] = [
  {
    title: "Klassisk Quiz-løb",
    description: "Skab en klassisk rute med spørgsmål og fire svarmuligheder.",
    href: "/dashboard/opret/manuel",
    imageSrc: "/quiz.png",
    iconShellClass: "border-emerald-200 bg-emerald-50",
    iconAccentClass: "bg-emerald-100 text-emerald-700",
    titleClass: "text-emerald-950",
    bodyClass: "text-emerald-900/80",
    badgeClass: "bg-green-800 hover:bg-green-900",
    shadowClass: "shadow-[0_18px_45px_rgba(16,185,129,0.18)]",
    hoverShadowClass:
      "group-hover:shadow-[0_24px_58px_rgba(16,185,129,0.24)] group-focus-visible:shadow-[0_24px_58px_rgba(16,185,129,0.24)]",
  },
  {
    title: "AI Foto-mission",
    description:
      "Deltagerne fotograferer motiver i virkeligheden. Vores AI analyserer og godkender billedet på sekunder - og den gennemskuer snyd.",
    href: "/dashboard/opret/foto",
    imageSrc: "/foto.png",
    iconShellClass: "border-sky-200 bg-sky-50",
    iconAccentClass: "bg-sky-100 text-sky-700",
    titleClass: "text-sky-950",
    bodyClass: "text-sky-900/80",
    badgeClass: "bg-slate-800 hover:bg-slate-900",
    shadowClass: "shadow-[0_18px_45px_rgba(14,165,233,0.18)]",
    hoverShadowClass:
      "group-hover:shadow-[0_24px_58px_rgba(14,165,233,0.24)] group-focus-visible:shadow-[0_24px_58px_rgba(14,165,233,0.24)]",
  },
  {
    title: "Escape Room i Naturen",
    description: "Løs gåder ved hver post og saml kode-brikker til en endelig master-kode.",
    href: "/dashboard/opret/escape",
    imageSrc: "/escape.png",
    iconShellClass: "border-violet-200 bg-violet-50",
    iconAccentClass: "bg-violet-100 text-violet-700",
    titleClass: "text-violet-950",
    bodyClass: "text-violet-900/80",
    badgeClass: "bg-amber-900 hover:bg-orange-950",
    shadowClass: "shadow-[0_18px_45px_rgba(139,92,246,0.18)]",
    hoverShadowClass:
      "group-hover:shadow-[0_24px_58px_rgba(139,92,246,0.24)] group-focus-visible:shadow-[0_24px_58px_rgba(139,92,246,0.24)]",
  },
];

function renderCard(card: HubCard, index: number) {
  return (
    <Link
      key={`${card.title}-${index}`}
      href={card.href}
      data-tour={index === 0 ? "valg-classic-quiz" : undefined}
      className="group block h-full w-full focus:outline-none"
    >
      <article
        className={`flex h-full min-h-[320px] flex-col rounded-3xl border border-white/70 bg-white/90 p-8 backdrop-blur-sm transition-all duration-300 ${card.shadowClass} ${card.hoverShadowClass} ${card.cardClassName ?? ""} group-hover:-translate-y-1.5 group-hover:bg-white/95 group-focus-visible:-translate-y-1.5 group-focus-visible:bg-white/95`}
      >
        <div className={`flex h-16 w-16 items-center justify-center rounded-full border ${card.iconShellClass}`}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${card.iconAccentClass}`}>
            {card.icon ? (
              <card.icon className="h-6 w-6" />
            ) : card.imageSrc ? (
              <Image
                src={card.imageSrc}
                alt={card.title}
                width={48}
                height={48}
                className="h-8 w-8 object-contain"
              />
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <h2 className={`text-2xl font-black tracking-wide ${card.titleClass} ${rubik.className}`}>
            {card.title}
          </h2>
          <p className={`mt-4 text-sm leading-relaxed ${card.bodyClass}`}>{card.description}</p>
        </div>

        <div className="mt-auto pt-8">
          <span
            className={`inline-flex rounded-full px-4 py-2 text-xs font-bold tracking-[0.18em] text-white uppercase transition-colors ${card.badgeClass}`}
          >
            Vælg løbstype
          </span>
        </div>
      </article>
    </Link>
  );
}

export default function ValgHubPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 px-6 py-12 text-white md:px-10 lg:bg-none lg:bg-transparent ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 hidden h-full w-full object-cover -z-20 lg:block"
        src="/baggrundvalgside.mp4"
      />
      <div className="fixed inset-0 hidden -z-10 bg-gradient-to-b from-sky-900/10 to-emerald-900/45 backdrop-blur-[2px] lg:block" />

      <section className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-4 py-2 text-sm font-medium text-emerald-900 shadow-lg transition-all duration-300 hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til dashboard
          </Link>
          <p className="rounded-full border border-white/50 bg-white/75 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-emerald-800 uppercase shadow-sm">
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
            Vælg det format, der passer bedst til dit arrangement. Her finder du de klassiske
            builders til quiz, foto og escape.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => renderCard(card, index))}
        </div>

        <div className="mt-12 flex justify-center">
          <div className="space-x-4 text-sm text-slate-500">
            <Link href="/privacy" className="transition hover:text-slate-700">
              Privatlivspolitik
            </Link>
            <Link href="/privacy" className="transition hover:text-slate-700">
              Udvikler Info
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
