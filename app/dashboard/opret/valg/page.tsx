"use client";

import { ArrowLeft } from "lucide-react";
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
  imageSrc: string;
  iconShellClass: string;
  iconAccentClass: string;
  titleClass: string;
  bodyClass: string;
  badgeClass: string;
  shadowClass: string;
  hoverShadowClass: string;
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
    badgeClass: "bg-emerald-100 text-emerald-800",
    shadowClass: "shadow-[0_18px_45px_rgba(16,185,129,0.18)]",
    hoverShadowClass: "group-hover:shadow-[0_24px_58px_rgba(16,185,129,0.24)] group-focus-visible:shadow-[0_24px_58px_rgba(16,185,129,0.24)]",
  },
  {
    title: "AI Foto-mission",
    description: "Deltagerne skal finde og fotografere specifikke motiver i virkeligheden.",
    href: "/dashboard/opret/foto",
    imageSrc: "/foto.png",
    iconShellClass: "border-sky-200 bg-sky-50",
    iconAccentClass: "bg-sky-100 text-sky-700",
    titleClass: "text-sky-950",
    bodyClass: "text-sky-900/80",
    badgeClass: "bg-sky-100 text-sky-800",
    shadowClass: "shadow-[0_18px_45px_rgba(14,165,233,0.18)]",
    hoverShadowClass: "group-hover:shadow-[0_24px_58px_rgba(14,165,233,0.24)] group-focus-visible:shadow-[0_24px_58px_rgba(14,165,233,0.24)]",
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
    badgeClass: "bg-violet-100 text-violet-800",
    shadowClass: "shadow-[0_18px_45px_rgba(139,92,246,0.18)]",
    hoverShadowClass: "group-hover:shadow-[0_24px_58px_rgba(139,92,246,0.24)] group-focus-visible:shadow-[0_24px_58px_rgba(139,92,246,0.24)]",
  },
  {
    title: "Tidsmaskinen",
    description: "Lad en fiktiv eller historisk karakter styre løbet med beskeder og svar.",
    href: "/dashboard/opret/rollespil",
    imageSrc: "/rollespil.png",
    iconShellClass: "border-amber-200 bg-amber-50",
    iconAccentClass: "bg-amber-100 text-amber-700",
    titleClass: "text-amber-950",
    bodyClass: "text-amber-900/80",
    badgeClass: "bg-amber-100 text-amber-800",
    shadowClass: "shadow-[0_18px_45px_rgba(245,158,11,0.18)]",
    hoverShadowClass: "group-hover:shadow-[0_24px_58px_rgba(245,158,11,0.24)] group-focus-visible:shadow-[0_24px_58px_rgba(245,158,11,0.24)]",
  },
  {
    title: "Selfie-jagt",
    description: "Gør løbet personligt med smil og AI-tjek af ansigt og baggrund.",
    href: "/dashboard/opret/selfie",
    imageSrc: "/selfie.png",
    iconShellClass: "border-rose-200 bg-rose-50",
    iconAccentClass: "bg-orange-100 text-rose-700",
    titleClass: "text-rose-950",
    bodyClass: "text-rose-900/80",
    badgeClass: "bg-orange-100 text-rose-800",
    shadowClass: "shadow-[0_18px_45px_rgba(251,146,60,0.18)]",
    hoverShadowClass: "group-hover:shadow-[0_24px_58px_rgba(251,146,60,0.24)] group-focus-visible:shadow-[0_24px_58px_rgba(251,146,60,0.24)]",
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
        className={`flex h-full min-h-[320px] flex-col rounded-3xl border border-white/70 bg-white/90 p-8 backdrop-blur-sm transition-all duration-300 ${card.shadowClass} ${card.hoverShadowClass} group-hover:-translate-y-1.5 group-hover:bg-white/95 group-focus-visible:-translate-y-1.5 group-focus-visible:bg-white/95`}
      >
        <div className={`flex h-16 w-16 items-center justify-center rounded-full border ${card.iconShellClass}`}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${card.iconAccentClass}`}>
            <Image
              src={card.imageSrc}
              alt={card.title}
              width={48}
              height={48}
              className="h-8 w-8 object-contain"
            />
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
            className={`inline-flex rounded-full px-4 py-2 text-xs font-bold tracking-[0.18em] uppercase ${card.badgeClass}`}
          >
            Vælg løbstype
          </span>
        </div>
      </article>
    </Link>
  );
}

export default function ValgHubPage() {
  const topRowCards = cards.slice(0, 3);
  const bottomRowCards = cards.slice(3);

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
            href="/dashboard/opret"
            className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-4 py-2 text-sm font-medium text-emerald-900 shadow-lg transition-all duration-300 hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til opret
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
            Vælg det format, der passer bedst til dit arrangement. Hvert kort er bygget som en
            lille, tydelig indgang til den builder, du vil arbejde videre i.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {topRowCards.map((card, index) => renderCard(card, index))}
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {bottomRowCards.map((card, index) => (
              <div key={`${card.title}-bottom-${index}`} className="w-full md:max-w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.35rem)]">
                {renderCard(card, index + topRowCards.length)}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
