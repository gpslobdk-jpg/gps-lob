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
  titleClass: string;
  glowClass: string;
};

const cards: HubCard[] = [
  {
    title: "Klassisk Quiz-løb",
    description: "Skab en klassisk rute med spørgsmål og fire svarmuligheder.",
    href: "/dashboard/opret/manuel",
    imageSrc: "/quiz.png",
    titleClass: "text-white",
    glowClass: "group-hover:bg-emerald-200/10 group-focus-visible:bg-emerald-200/10",
  },
  {
    title: "AI Foto-mission",
    description: "Deltagerne skal finde og fotografere specifikke motiver i virkeligheden.",
    href: "/dashboard/opret/foto",
    imageSrc: "/foto.png",
    titleClass: "text-white",
    glowClass: "group-hover:bg-sky-200/10 group-focus-visible:bg-sky-200/10",
  },
  {
    title: "Escape Room i Naturen",
    description: "Løs gåder ved hver post og saml kode-brikker til en endelig master-kode.",
    href: "/dashboard/opret/escape",
    imageSrc: "/escape.png",
    titleClass: "text-white",
    glowClass: "group-hover:bg-amber-200/10 group-focus-visible:bg-amber-200/10",
  },
  {
    title: "Tidsmaskinen",
    description: "Lad en fiktiv eller historisk karakter styre løbet med beskeder og svar.",
    href: "/dashboard/opret/rollespil",
    imageSrc: "/rollespil.png",
    titleClass: "text-white",
    glowClass: "group-hover:bg-violet-200/10 group-focus-visible:bg-violet-200/10",
  },
  {
    title: "Selfie-jagt",
    description: "Tag en selfie på den rigtige lokation, mens AI'en tjekker ansigt og baggrund.",
    href: "/dashboard/opret/selfie",
    imageSrc: "/selfie.png",
    titleClass: "text-white",
    glowClass: "group-hover:bg-rose-200/10 group-focus-visible:bg-rose-200/10",
  },
];

function renderCard(card: HubCard, index: number) {
  return (
    <Link
      key={`${card.title}-${index}`}
      href={card.href}
      data-tour={index === 0 ? "valg-classic-quiz" : undefined}
      className="group block h-64 w-64 focus:outline-none"
    >
      <article
        className={`relative h-64 w-64 overflow-hidden rounded-[1.85rem] border border-white/20 bg-white/10 backdrop-blur-xl transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:bg-white/14 group-focus-visible:-translate-y-1.5 group-focus-visible:bg-white/14`}
      >
        <div className={`absolute inset-0 transition-colors duration-300 ${card.glowClass}`} />

        <div className="relative flex h-full flex-col items-center justify-center p-6 text-center">
          <div className="flex min-h-[3.5rem] items-start justify-center">
            <h2 className={`text-lg font-bold leading-tight text-white ${rubik.className}`}>
              {card.title}
            </h2>
          </div>

          <div className="mt-4 flex min-h-[6rem] items-center justify-center transition-all duration-300 group-hover:translate-y-3 group-hover:opacity-0 group-focus-visible:translate-y-3 group-focus-visible:opacity-0">
            <Image
              src={card.imageSrc}
              alt={card.title}
              width={96}
              height={96}
              className="h-24 w-24 object-contain"
            />
          </div>

          <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 opacity-0 transition-all duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            <p className="text-sm text-center text-white/90">{card.description}</p>
          </div>
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
      className={`relative min-h-screen overflow-hidden bg-transparent px-6 py-12 text-white md:px-10 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 -z-20 h-full w-full scale-105 object-cover brightness-[0.48] blur-sm"
        src="/baggrundvalgside.mp4"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-950/18 via-emerald-950/14 to-slate-950/48" />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret"
            className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/12 px-4 py-2 text-sm font-medium text-white backdrop-blur-xl transition-colors duration-300 hover:bg-white/18"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til opret
          </Link>
          <p className="rounded-full border border-white/25 bg-white/8 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-white/78 uppercase backdrop-blur-xl">
            Løbstyper
          </p>
        </div>

        <div className="mt-12 max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.32em] text-white/80 uppercase">
            Vælg format
          </p>
          <h1
            className={`mt-4 text-4xl font-black tracking-tight text-white md:text-5xl ${rubik.className}`}
          >
            Hvilken type løb vil du bygge?
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/82 md:text-base">
            Vælg det format, der passer bedst til dit arrangement. Kortene holder sig rolige, og
            beskrivelsen toner først frem, når du bevæger dig ind over dem.
          </p>
        </div>

        <div className="mt-12 flex justify-center">
          <div className="grid grid-cols-1 justify-items-center gap-8 md:grid-cols-2 lg:grid-cols-3">
            {topRowCards.map((card, index) => renderCard(card, index))}
            <div className="contents lg:col-span-3 lg:flex lg:justify-center lg:gap-8">
              {bottomRowCards.map((card, index) => renderCard(card, index + topRowCards.length))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
