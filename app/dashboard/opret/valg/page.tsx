"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
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
  href?: string;
  badge: string;
  cta: string;
  animationUrl: string;
  surfaceClass: string;
  borderClass: string;
  titleClass: string;
  accentTextClass: string;
  accentMutedClass: string;
};

const quizAnimationUrl = "/quiz.png";
const photoAnimationUrl = "/foto.png";
const escapeAnimationUrl = "/escape.png";
const roleplayAnimationUrl = "/rollespil.png";
const selfieAnimationUrl = "/selfie.png";

type CardIconProps = {
  src: string;
  alt: string;
};

function CardIcon({ src, alt }: CardIconProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-0 flex justify-center">
      <Image
        src={src}
        alt={alt}
        width={112}
        height={112}
        className="h-28 w-28 object-contain opacity-80"
      />
    </div>
  );
}

function HubCardBody({ card }: { card: HubCard }) {
  return (
    <div className="relative flex h-full flex-col justify-between">
      <CardIcon src={card.animationUrl} alt={card.title} />

      <div>
        <span
          className={`relative z-10 inline-flex rounded-full border bg-white/75 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] uppercase ${card.borderClass} ${card.accentMutedClass}`}
        >
          {card.badge}
        </span>

        <div className="relative z-10 mt-20 flex-1 text-center">
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

function renderCard(card: HubCard, index: number) {
  const body = (
    <article
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-[2rem] border p-7 shadow-lg backdrop-blur-md transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl group-focus-visible:scale-[1.02] group-focus-visible:shadow-xl ${card.surfaceClass} ${card.borderClass}`}
    >
      <HubCardBody card={card} />
    </article>
  );

  if (card.href) {
    return (
      <Link
        key={`${card.title}-${index}`}
        href={card.href}
        data-tour={index === 0 ? "valg-classic-quiz" : undefined}
        className="group block h-full focus:outline-none"
      >
        {body}
      </Link>
    );
  }

  return (
    <div key={`${card.title}-${index}`} className="group block h-full">
      {body}
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
    surfaceClass: "bg-violet-50/90",
    borderClass: "border-violet-200/50",
    titleClass: "text-violet-950",
    accentTextClass: "text-violet-700",
    accentMutedClass: "text-violet-700/80",
  },
  {
    title: "Selfie-jagt",
    shortText: "Gør løbet personligt med smil.",
    detail:
      "Deltagerne skal finde specifikke lokationer og tage en selfie med tingen i baggrunden. AI'en tjekker både ansigt og motiv!",
    href: "/dashboard/opret/selfie",
    badge: "Klar nu",
    cta: "Åbn selfie-bygger",
    animationUrl: selfieAnimationUrl,
    surfaceClass:
      "bg-[linear-gradient(145deg,rgba(255,237,213,0.95),rgba(255,228,230,0.92))]",
    borderClass: "border-orange-200/70",
    titleClass: "text-rose-950",
    accentTextClass: "text-orange-700",
    accentMutedClass: "text-orange-700/80",
  },
];

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
