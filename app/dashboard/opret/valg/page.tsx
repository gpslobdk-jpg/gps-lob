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
  shortText: string;
  detail?: string;
  href: string;
  animationUrl: string;
  surfaceClass: string;
  borderClass: string;
  titleClass: string;
};

const cards: HubCard[] = [
  {
    title: "Klassisk Quiz-løb",
    shortText: "Multiple-choice spørgsmål med AI-assistent.",
    detail: "Skab en klassisk rute med spørgsmål og fire svarmuligheder.",
    href: "/dashboard/opret/manuel",
    animationUrl: "/quiz.png",
    surfaceClass: "bg-emerald-50/90",
    borderClass: "border-emerald-200/50",
    titleClass: "text-emerald-950",
  },
  {
    title: "AI Foto-mission",
    shortText: "Gør virkeligheden til en interaktiv opgave.",
    detail:
      "Deltagerne skal bruge øjnene! I stedet for at svare på spørgsmål, skal de finde og fotografere specifikke motiver i virkeligheden.",
    href: "/dashboard/opret/foto",
    animationUrl: "/foto.png",
    surfaceClass: "bg-sky-50/90",
    borderClass: "border-sky-200/50",
    titleClass: "text-sky-950",
  },
  {
    title: "Escape Room i Naturen",
    shortText: "Knæk koden og løs logiske gåder.",
    detail:
      "Fokus på logik, matematik og samarbejde. Deltagerne skal løse gåder ved hver post for at samle tal eller bogstaver til en endelig master-kode. Perfekt til teambuilding og udendørs 'break-out' spil.",
    href: "/dashboard/opret/escape",
    animationUrl: "/escape.png",
    surfaceClass: "bg-amber-50/90",
    borderClass: "border-amber-200/50",
    titleClass: "text-amber-950",
  },
  {
    title: "Tidsmaskinen",
    shortText: "Lad en historisk person styre løbet.",
    detail:
      "AI'en spiller en fiktiv eller historisk karakter. Deltagerne modtager dramatiske beskeder og skal svare for at drive historien frem.",
    href: "/dashboard/opret/rollespil",
    animationUrl: "/rollespil.png",
    surfaceClass: "bg-violet-50/90",
    borderClass: "border-violet-200/50",
    titleClass: "text-violet-950",
  },
  {
    title: "Selfie-jagt",
    shortText: "Gør løbet personligt med smil.",
    detail:
      "Deltagerne skal finde specifikke lokationer og tage en selfie med tingen i baggrunden. AI'en tjekker både ansigt og motiv!",
    href: "/dashboard/opret/selfie",
    animationUrl: "/selfie.png",
    surfaceClass:
      "bg-[linear-gradient(145deg,rgba(255,237,213,0.95),rgba(255,228,230,0.92))]",
    borderClass: "border-orange-200/70",
    titleClass: "text-rose-950",
  },
];

function CardIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="pointer-events-none mx-auto mb-4 flex w-full justify-center">
      <Image
        src={src}
        alt={alt}
        width={96}
        height={96}
        className="h-24 w-24 object-contain opacity-80"
      />
    </div>
  );
}

function HubCardBody({ card }: { card: HubCard }) {
  return (
    <div className="relative flex h-full flex-col justify-between">
      <div className="relative z-10 text-center">
        <h2 className={`text-xl font-black tracking-wide sm:text-2xl ${card.titleClass} ${rubik.className}`}>
          {card.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{card.shortText}</p>
        {card.detail ? (
          <p className="mt-4 text-sm leading-relaxed text-slate-700">{card.detail}</p>
        ) : null}
      </div>

      <div className="relative z-10 mt-10 flex flex-1 items-end justify-center">
        <CardIcon src={card.animationUrl} alt={card.title} />
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
      className="group block h-full focus:outline-none"
    >
      <article
        className={`relative flex h-full min-h-[380px] flex-col overflow-hidden rounded-[2rem] border p-8 shadow-lg backdrop-blur-md transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-[1.01] group-hover:shadow-2xl group-focus-visible:-translate-y-1 group-focus-visible:scale-[1.01] group-focus-visible:shadow-2xl ${card.surfaceClass} ${card.borderClass}`}
      >
        <HubCardBody card={card} />
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

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {topRowCards.map((card, index) => renderCard(card, index))}
          <div className="contents lg:col-span-3 lg:flex lg:justify-center lg:gap-6">
            {bottomRowCards.map((card, index) => (
              <div
                key={`${card.title}-${index + topRowCards.length}-wrapper`}
                className="lg:w-full lg:max-w-[calc((100%-1.5rem)*0.3334)]"
              >
                {renderCard(card, index + topRowCards.length)}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
