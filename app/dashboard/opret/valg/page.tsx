"use client";

import {
  ArrowLeft,
  BookOpen,
  Camera,
  Lock,
  MapPin,
  MessageSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
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
  icon: LucideIcon;
  iconShellClass: string;
  iconClass: string;
};

const cards: HubCard[] = [
  {
    title: "Klassisk Quiz-løb",
    description: "Skab en klassisk rute med spørgsmål og fire svarmuligheder.",
    href: "/dashboard/opret/manuel",
    icon: MapPin,
    iconShellClass:
      "border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.18)]",
    iconClass: "text-emerald-300",
  },
  {
    title: "AI Foto-mission",
    description:
      "Deltagerne fotograferer motiver i virkeligheden, og AI'en vurderer billedet på sekunder.",
    href: "/dashboard/opret/foto",
    icon: Camera,
    iconShellClass:
      "border-sky-500/30 bg-sky-500/10 shadow-[0_0_30px_rgba(14,165,233,0.18)]",
    iconClass: "text-sky-300",
  },
  {
    title: "Escape Room",
    description: "Løs gåder ved hver post og saml kode-brikker til en endelig master-kode.",
    href: "/dashboard/opret/escape",
    icon: Lock,
    iconShellClass:
      "border-amber-500/30 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.18)]",
    iconClass: "text-amber-300",
  },
  {
    title: "Rollespil",
    description: "Lad eleverne møde karakterer, tale med AI og spille sig gennem historien.",
    href: "/dashboard/opret/rollespil",
    icon: MessageSquare,
    iconShellClass:
      "border-violet-500/30 bg-violet-500/10 shadow-[0_0_30px_rgba(139,92,246,0.18)]",
    iconClass: "text-violet-300",
  },
  {
    title: "Scan bogen",
    description: "Upload en bogside eller indsæt tekst, og lad AI bygge et komplet quiz-løb.",
    href: "/dashboard/opret/scanner",
    icon: BookOpen,
    iconShellClass:
      "border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_30px_rgba(6,182,212,0.18)]",
    iconClass: "text-cyan-300",
  },
  {
    title: "Selfie-mission",
    description: "Byg en jagt med selfie-poster, hvor deltagerne skal finde og dokumentere steder.",
    href: "/dashboard/opret/selfie",
    icon: Sparkles,
    iconShellClass:
      "border-rose-500/30 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.18)]",
    iconClass: "text-rose-300",
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
      <article className="flex h-full min-h-[320px] flex-col rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-6 shadow-lg backdrop-blur-xl transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-emerald-500/50 group-hover:shadow-[0_28px_80px_rgba(16,185,129,0.16)] group-focus-visible:-translate-y-1.5 group-focus-visible:border-emerald-500/50 group-focus-visible:shadow-[0_28px_80px_rgba(16,185,129,0.16)]">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${card.iconShellClass}`}
        >
          <card.icon className={`h-8 w-8 ${card.iconClass}`} />
        </div>

        <div className="mt-6">
          <h2 className={`text-2xl font-black tracking-wide text-emerald-400 ${rubik.className}`}>
            {card.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">{card.description}</p>
        </div>

        <div className="mt-auto pt-8">
          <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold tracking-[0.18em] text-emerald-300 uppercase transition-colors group-hover:bg-emerald-500/15 group-focus-visible:bg-emerald-500/15">
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
      className={`relative min-h-screen overflow-hidden bg-slate-950 px-6 py-12 pb-32 text-slate-100 md:px-10 md:pb-16 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 h-full w-full object-cover -z-20"
        src="/promo.mp4"
      />
      <div className="fixed inset-0 -z-10 bg-slate-950/70 backdrop-blur-[2px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_100%,rgba(14,165,233,0.1),transparent_40%)]" />

      <section className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-slate-950/70 px-4 py-2 text-sm font-medium text-slate-100 shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/50 hover:bg-slate-900/80"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-300" />
            Tilbage til dashboard
          </Link>
          <p className="rounded-full border border-emerald-500/20 bg-slate-950/70 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-emerald-300 uppercase shadow-sm backdrop-blur-xl">
            Løbstyper
          </p>
        </div>

        <div className="mt-12 max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.32em] text-emerald-300 uppercase">
            Vælg format
          </p>
          <h1
            className={`mt-4 text-4xl font-black tracking-tight text-white md:text-5xl ${rubik.className}`}
          >
            Hvilken type løb vil du bygge?
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">
            Vælg det format, der passer bedst til dit arrangement. Her finder du quiz, foto,
            escape, rollespil, bog-scanner og selfie-missioner samlet ét sted.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, index) => renderCard(card, index))}
        </div>

        <div className="mt-12 flex justify-center">
          <div className="space-x-4 text-sm text-slate-400">
            <Link href="/privacy" className="transition hover:text-emerald-300">
              Privatlivspolitik
            </Link>
            <Link href="/teknologi" className="transition hover:text-emerald-300">
              Udvikler Info
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
