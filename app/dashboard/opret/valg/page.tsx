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
  animationUrl: string;
  titleClass: string;
  tintClass: string;
  hoverTintClass: string;
};

const cards: HubCard[] = [
  {
    title: "Klassisk Quiz-løb",
    description: "Skab en klassisk rute med spørgsmål og fire svarmuligheder.",
    href: "/dashboard/opret/manuel",
    animationUrl: "/quiz.png",
    titleClass: "text-emerald-50",
    tintClass: "from-emerald-300/12 via-white/8 to-white/6",
    hoverTintClass: "group-hover:from-emerald-300/18 group-hover:via-white/12 group-hover:to-white/8",
  },
  {
    title: "AI Foto-mission",
    description: "Deltagerne skal finde og fotografere specifikke motiver i virkeligheden.",
    href: "/dashboard/opret/foto",
    animationUrl: "/foto.png",
    titleClass: "text-sky-50",
    tintClass: "from-sky-300/12 via-white/8 to-white/6",
    hoverTintClass: "group-hover:from-sky-300/18 group-hover:via-white/12 group-hover:to-white/8",
  },
  {
    title: "Escape Room i Naturen",
    description: "Løs gåder ved hver post og saml kode-brikker til en endelig master-kode.",
    href: "/dashboard/opret/escape",
    animationUrl: "/escape.png",
    titleClass: "text-amber-50",
    tintClass: "from-amber-300/12 via-white/8 to-white/6",
    hoverTintClass: "group-hover:from-amber-300/18 group-hover:via-white/12 group-hover:to-white/8",
  },
  {
    title: "Tidsmaskinen",
    description: "Lad en fiktiv eller historisk karakter styre løbet med beskeder og svar.",
    href: "/dashboard/opret/rollespil",
    animationUrl: "/rollespil.png",
    titleClass: "text-violet-50",
    tintClass: "from-violet-300/12 via-white/8 to-white/6",
    hoverTintClass: "group-hover:from-violet-300/18 group-hover:via-white/12 group-hover:to-white/8",
  },
  {
    title: "Selfie-jagt",
    description: "Tag en selfie på den rigtige lokation, mens AI'en tjekker ansigt og baggrund.",
    href: "/dashboard/opret/selfie",
    animationUrl: "/selfie.png",
    titleClass: "text-rose-50",
    tintClass: "from-orange-300/12 via-rose-200/10 to-white/6",
    hoverTintClass: "group-hover:from-orange-300/18 group-hover:via-rose-200/14 group-hover:to-white/8",
  },
];

function CompactCard({ card }: { card: HubCard }) {
  return (
    <div className="relative flex h-full flex-col items-center text-center">
      <div
        className={`pointer-events-none absolute inset-0 rounded-[1.6rem] bg-gradient-to-br ${card.tintClass} transition-all duration-300 ${card.hoverTintClass}`}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center">
        <div className="transition-all duration-300 group-hover:-translate-y-2 group-focus-visible:-translate-y-2">
          <h2 className={`text-lg font-black tracking-wide sm:text-xl ${card.titleClass} ${rubik.className}`}>
            {card.title}
          </h2>
        </div>

        <div className="mt-4 transition-all duration-300 group-hover:scale-90 group-hover:opacity-0 group-focus-visible:scale-90 group-focus-visible:opacity-0">
          <Image
            src={card.animationUrl}
            alt={card.title}
            width={80}
            height={80}
            className="mx-auto h-20 w-20 object-contain"
          />
        </div>

        <div className="pointer-events-none absolute inset-x-5 top-1/2 -translate-y-1/2 opacity-0 transition-all duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="text-sm leading-relaxed text-white/88">{card.description}</p>
        </div>
      </div>
    </div>
  );
}

function renderCard(card: HubCard, index: number) {
  return (
    <Link
      key={`${card.title}-${index}`}
      href={card.href}
      data-tour={index === 0 ? "valg-classic-quiz" : undefined}
      className="group mx-auto block h-full w-full max-w-[280px] focus:outline-none"
    >
      <article className="relative aspect-square overflow-hidden rounded-[1.6rem] border border-white/20 bg-white/10 p-8 shadow-[0_18px_40px_rgba(15,23,42,0.24)] backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1.5 group-hover:bg-white/14 group-hover:shadow-[0_24px_50px_rgba(15,23,42,0.32)] group-focus-visible:-translate-y-1.5 group-focus-visible:bg-white/14 group-focus-visible:shadow-[0_24px_50px_rgba(15,23,42,0.32)]">
        <CompactCard card={card} />
      </article>
    </Link>
  );
}

export default function ValgHubPage() {
  const topRowCards = cards.slice(0, 3);
  const bottomRowCards = cards.slice(3);

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-transparent px-6 py-12 text-emerald-950 md:px-10 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 -z-20 h-full w-full scale-105 object-cover brightness-[0.48] blur-sm"
        src="/baggrundvalgside.mp4"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-sky-950/20 via-emerald-950/18 to-emerald-950/60 backdrop-blur-[2px]" />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret"
            className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-900 shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-white/95 hover:shadow-xl"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til opret
          </Link>
          <p className="rounded-full border border-white/35 bg-white/10 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-white/82 uppercase shadow-lg backdrop-blur-md">
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

        <div className="mt-10 grid grid-cols-1 justify-items-center gap-6 md:grid-cols-2 lg:grid-cols-3">
          {topRowCards.map((card, index) => renderCard(card, index))}
          <div className="contents lg:col-span-3 lg:flex lg:justify-center lg:gap-6">
            {bottomRowCards.map((card, index) => renderCard(card, index + topRowCards.length))}
          </div>
        </div>
      </section>
    </main>
  );
}
