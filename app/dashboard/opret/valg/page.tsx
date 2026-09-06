"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CircleHelp, MapPin, Printer } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";
import { type ReactNode, useEffect, useState } from "react";

import HeroBanner from "@/components/brand/HeroBanner";
import PwaInstallTip from "@/components/PwaInstallTip";
import {
  canCreatePremiumRun,
  hasPremiumAccess,
  type AccessProfile,
} from "@/utils/accessControl";
import { type RaceTypeThemeKey } from "@/utils/raceTypeTheme";
import { createClient } from "@/utils/supabase/client";

const cardBaseClass =
  "group relative z-0 mx-auto flex h-[12rem] w-full max-w-[20.5rem] flex-col overflow-visible rounded-[2rem] border bg-white/10 p-0 text-left shadow-[0_22px_52px_rgba(15,23,42,0.16),0_8px_18px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-lg transition-all duration-300 hover:z-20 focus-within:z-20";

const cardBackgroundShellClass =
  "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[2rem]";

const cardPanelClass =
  "relative flex h-full flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-16px_24px_rgba(15,23,42,0.07)]";

const IS_PAYWALL_ENABLED = process.env.NEXT_PUBLIC_PAYWALL_ENABLED === "true";
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

type ProfileAccessRow = AccessProfile;
type PremiumCardAccessState = "loading" | "premium" | "trial" | "locked";
type GameType = "zone-krig";
type GameInfoCopy = {
  title: string;
  purpose: string;
  flow: string;
  toneClassName: string;
  iconToneClassName: string;
};

const GAME_INFO_COPY: Record<GameType, GameInfoCopy> = {
  "zone-krig": {
    title: "Zone-Krigen",
    purpose: "Gør skolegården eller lokalområdet til en levende spilleplade. Her handler det om strategi, udholdenhed og at løfte i flok som hold.",
    flow: "Spillet fungerer som en moderne, digital fangeleg. Læreren placerer en række \"zoner\" på kortet (eller henter dem fra Arkivet). Holdene skal nu løbe ud, stille sig ind i zonerne og svare rigtigt for at erobre dem. Vinderen findes ud fra de zoner, holdet ejer, når kampen slutter. En intens og sjov hold-dyst, hvor alle kan være med!",
    toneClassName:
      "border-orange-300/28 bg-[linear-gradient(145deg,rgba(154,52,18,0.94),rgba(194,65,12,0.9))] text-white shadow-[0_24px_60px_rgba(194,65,12,0.28)]",
    iconToneClassName:
      "border-orange-300/35 bg-orange-500/18 text-orange-50 shadow-[0_12px_26px_rgba(249,115,22,0.2)]",
  },
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
  {
    raceType: "musikquiz",
    title: "Musikquiz",
    description: "Lad eleverne lytte til musikklip og gætte sangtitlen ved posterne.",
    href: "/dashboard/opret/musikquiz",
    accentClass:
      "border-pink-500/75 bg-pink-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(236,72,153,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(236,72,153,0.24)]",
    badgeClass:
      "border-pink-300/40 bg-pink-400/20 text-white shadow-[0_10px_22px_rgba(236,72,153,0.18)]",
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

function BuilderCard({ card }: { card: BuilderCard }) {
  const tourId = card.href === "/dashboard/opret/manuel" ? "valg-classic-quiz" : undefined;
  const testId =
    card.href === "/dashboard/opret/lynbygger"
      ? "create-card-lynbygger"
      : card.href === "/dashboard/opret/manuel"
        ? "create-card-manuel"
        : undefined;
  const content = (
    <motion.article
      whileHover={card.locked ? undefined : { y: -4, scale: 1.012 }}
      className={`${cardBaseClass} ${card.accentClass} ${card.locked ? "cursor-default" : "cursor-pointer"}`}
    >
      <div className={cardBackgroundShellClass}>
        <div className={`absolute inset-0 rounded-[2rem] ${card.accentGlowClass}`} />
        <div className="absolute inset-[1px] rounded-[1.95rem]" />
      </div>

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
      data-tour={tourId}
      data-testid={testId}
      className="block w-full text-left"
    >
      {content}
    </Link>
  );
}

function PremiumGameCardWrapper({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}) {
  if (!href) {
    return <div className="block w-full text-left">{children}</div>;
  }

  return (
    <Link href={href} className="block w-full text-left">
      {children}
    </Link>
  );
}

function GameInfoButton({
  gameType,
  isOpen,
  onToggle,
}: {
  gameType: GameType;
  isOpen: boolean;
  onToggle: (gameType: GameType) => void;
}) {
  const copy = GAME_INFO_COPY[gameType];

  return (
    <div className="absolute top-4 left-4 z-30">
      <button
        type="button"
        aria-label={`Læs om ${copy.title}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle(gameType);
        }}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl transition hover:scale-[1.03] ${copy.iconToneClassName}`}
      >
        <CircleHelp className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ValgHubPage() {
  const [premiumAccessState, setPremiumAccessState] = useState<PremiumCardAccessState>(() =>
    IS_PAYWALL_ENABLED ? "loading" : "premium"
  );
  const [selectedInfo, setSelectedInfo] = useState<GameType | null>(null);

  useEffect(() => {
    if (!IS_PAYWALL_ENABLED) {
      return;
    }

    let isMounted = true;

    const loadPremiumAccess = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isMounted) {
          return;
        }

        if (userError || !user) {
          setPremiumAccessState("locked");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("plan_type,access_expires_at,has_used_free_trial")
          .eq("id", user.id)
          .maybeSingle<ProfileAccessRow>();

        if (!isMounted) {
          return;
        }

        if (profileError) {
          console.error("Kunne ikke hente adgangsprofil til premium-kort:", profileError);
          setPremiumAccessState("locked");
          return;
        }

        if (hasPremiumAccess(profile)) {
          setPremiumAccessState("premium");
          return;
        }

        setPremiumAccessState(canCreatePremiumRun(profile) ? "trial" : "locked");
      } catch (error) {
        console.error("Kunne ikke afg\u00F8re premium-adgang i Udsigtsposten:", error);
        if (isMounted) {
          setPremiumAccessState("locked");
        }
      }
    };

    void loadPremiumAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedInfo) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedInfo(null);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedInfo]);

  const premiumCardsAreTrial = IS_PAYWALL_ENABLED && premiumAccessState === "trial";
  const premiumCardsAreLocked = IS_PAYWALL_ENABLED && premiumAccessState === "locked";
  const premiumCardsAreLoading = IS_PAYWALL_ENABLED && premiumAccessState === "loading";
  const selectedInfoCopy = selectedInfo ? GAME_INFO_COPY[selectedInfo] : null;
  const handleInfoToggle = (gameType: GameType) => {
    setSelectedInfo((current) => (current === gameType ? null : gameType));
  };
  const zoneKrigCardHref = premiumCardsAreLocked
    ? "/priser"
    : premiumCardsAreLoading
      ? undefined
      : "/dashboard/opret/zone-krig";
  const premiumBadgeLabel = premiumCardsAreLocked
    ? "L\u00C5ST / KR\u00C6VER PRO"
    : premiumCardsAreTrial
      ? "1 GRATIS PR\u00D8VEL\u00D8B"
      : premiumCardsAreLoading
        ? "TJEKKER ADGANG"
        : null;
  const premiumBadgeClass = premiumCardsAreLocked
    ? "border-red-300/40 bg-red-500/22"
    : premiumCardsAreTrial
      ? "border-emerald-300/40 bg-emerald-500/22"
      : "border-amber-300/40 bg-amber-400/20";

  return (
    <main
      className={`relative flex min-h-screen flex-col bg-[var(--skolegps-muted-bg)] px-5 pt-0 pb-8 text-slate-950 sm:px-6 md:px-8 md:pb-10 lg:px-10 ${poppins.className}`}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(14,165,233,0.15),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(247,183,51,0.12),transparent_28%),linear-gradient(180deg,#f4fbff_0%,#eef9ef_100%)]" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-3 md:py-4">
        <Image src="/skolegps-logo.svg" width={150} height={150} alt="SkoleGPS logo" priority />
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/82 px-4 py-2 text-sm font-bold text-[var(--skolegps-deep-navy)] shadow-sm backdrop-blur transition hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbage
        </Link>
      </header>

      <section className="mx-auto mt-4 w-full max-w-6xl md:mt-6">
        <HeroBanner
          compact
          eyebrow="Opret løb"
          icon={MapPin}
          mascot="guide"
          title="Hvordan vil du lave dit løb?"
          subtitle="Start hurtigt med Lynbyggeren eller vælg en bestemt aktivitet."
        />
      </section>

      <aside className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-sky-100 bg-white/84 px-5 py-4 text-left shadow-[0_14px_36px_rgba(7,26,58,0.08)] backdrop-blur lg:hidden">
        <p className="text-sm font-black text-[var(--skolegps-deep-navy)]">Bedst på computer</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Oprettelse og redigering af løb fungerer bedst på en større skærm, hvor der er plads til kort og spørgsmål.
        </p>
      </aside>

      <section className="mx-auto mt-8 w-full max-w-4xl">
        <Link
          href="/dashboard/opret/lynbygger"
          data-tour="valg-lynbygger"
          data-testid="create-card-lynbygger"
          className="group block rounded-[2rem] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
        >
          <motion.article
            whileHover={{ y: -4, scale: 1.008 }}
            className="relative overflow-hidden rounded-[2rem] border-2 border-cyan-300/85 bg-[linear-gradient(135deg,rgba(8,47,73,0.97),rgba(6,78,59,0.94))] px-6 py-8 text-left shadow-[0_30px_80px_rgba(8,145,178,0.32),inset_0_1px_0_rgba(255,255,255,0.2)] sm:px-9 sm:py-9"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.26),transparent_42%)]" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <span className="inline-flex rounded-full border border-cyan-100/35 bg-cyan-200/15 px-3 py-1 text-[0.65rem] font-black tracking-[0.18em] text-cyan-50 uppercase">
                  Anbefalet til nye brugere
                </span>
                <h2 className={`mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl ${rubik.className}`}>
                  Start med Lynbyggeren
                </h2>
                <p className="mt-3 text-sm leading-6 text-cyan-50/86 sm:text-base">
                  Skriv emne og klassetrin – gennemse og godkend spørgsmålene bagefter.
                </p>
              </div>
              <span className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 transition group-hover:bg-cyan-200">
                Åbn Lynbyggeren
              </span>
            </div>
          </motion.article>
        </Link>
      </section>

      <section className="mx-auto mt-12 w-full max-w-6xl">
        <h2 className={`mb-8 text-center text-2xl font-black text-[var(--skolegps-deep-navy)] sm:text-3xl ${rubik.className}`}>
          Andre måder at lave et løb
        </h2>
        <h2 className={`text-2xl font-black text-[var(--skolegps-deep-navy)] uppercase mb-3 ${rubik.className}`}>
          Faglige Værktøjer
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 justify-items-center gap-8">
          {fagligeCards.map((card, index) => (
            <BuilderCard key={`${card.title}-${index}`} card={card} />
          ))}
        </div>

        <div className="w-full h-px bg-sky-100 my-12" />

        <h2 className={`text-2xl font-black text-[var(--skolegps-deep-navy)] uppercase mb-3 ${rubik.className}`}>
          Kreative Værktøjer & Scannere
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 justify-items-center gap-8">
          {aiCards.map((card, index) => (
            <BuilderCard key={`${card.title}-${index}`} card={card} />
          ))}
        </div>

        <div className="w-full h-px bg-sky-100 my-12" />

        <h2 className={`text-2xl font-black text-[var(--skolegps-deep-navy)] uppercase mb-3 ${rubik.className}`}>
          Analoge Værktøjer
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 justify-items-center gap-8">
          <Link href="/dashboard/opret/stjerneloeb" className="block w-full text-left">
            <motion.article
              whileHover={{ y: -4, scale: 1.012 }}
              className={`${cardBaseClass} cursor-pointer border-lime-500/75 bg-lime-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(132,204,22,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]`}
            >
              <div className={cardBackgroundShellClass}>
                <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(132,204,22,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(132,204,22,0.24)]" />
                <div className="absolute inset-[1px] rounded-[1.95rem]" />
              </div>

              <div className="absolute top-4 right-4 z-20">
                <span className="inline-flex items-center rounded-full border border-lime-300/40 bg-lime-400/20 px-3 py-1 text-[0.58rem] font-bold tracking-[0.18em] text-white uppercase shadow-[0_10px_22px_rgba(132,204,22,0.18)] backdrop-blur-md">
                  ANALOGT
                </span>
              </div>

              <div className={`${cardPanelClass} text-slate-950`}>
                <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-lime-300/35 bg-lime-500/18 shadow-[0_10px_30px_rgba(132,204,22,0.22)]">
                    <Printer className="h-6 w-6 text-lime-200" />
                  </div>

                  <div className="space-y-1">
                    <h2 className={`text-[1.4rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
                      Fysisk Stjerneløb
                    </h2>
                    <p className="mx-auto max-w-[15rem] text-xs leading-tight text-white/84">
                      Opret analoge stjerneløb til print, hvor posterne findes fysisk i terrænet uden brug af GPS. Perfekt som backup eller til kortere aktiviteter.
                    </p>
                  </div>
                </div>
              </div>
            </motion.article>
          </Link>
        </div>

        <div className="w-full h-px bg-sky-100 my-12" />

        <h2 className={`text-2xl font-black text-[var(--skolegps-deep-navy)] uppercase mb-3 ${rubik.className}`}>
          Spil
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 justify-items-center gap-8">
          <PremiumGameCardWrapper href={zoneKrigCardHref}>
            <motion.article
              whileHover={zoneKrigCardHref ? { y: -4, scale: 1.012 } : undefined}
              className={`${cardBaseClass} ${zoneKrigCardHref ? "cursor-pointer" : "cursor-default"} border-orange-500/75 bg-orange-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(249,115,22,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] ${premiumCardsAreLocked ? "ring-1 ring-amber-300/20" : ""}`}
            >
              <div className={cardBackgroundShellClass}>
                <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(249,115,22,0.34),transparent_62%)] shadow-[inset_0_0_54px_rgba(249,115,22,0.28)]" />
                <div className="absolute inset-[1px] rounded-[1.95rem]" />
              </div>
              <GameInfoButton
                gameType="zone-krig"
                isOpen={selectedInfo === "zone-krig"}
                onToggle={handleInfoToggle}
              />

              <div className="absolute top-4 right-4 z-20">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.58rem] font-bold tracking-[0.18em] text-white uppercase shadow-[0_10px_22px_rgba(249,115,22,0.22)] backdrop-blur-md ${premiumBadgeLabel ? premiumBadgeClass : "border-orange-300/40 bg-orange-400/20"}`}>
                  {premiumBadgeLabel ?? "SPIL"}
                </span>
              </div>

              <div className={`${cardPanelClass} text-slate-950`}>
                <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
                  <div className="space-y-1">
                    <h2 className={`text-[1.4rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
                      Zone-Krigen
                    </h2>
                    <p className="mx-auto max-w-[15rem] text-xs leading-tight text-white/84">
                      Omdan din skolegård til et live e-sport arena. Erobr zoner, svar på spørgsmål og kæmp om territorium!
                    </p>
                  </div>
                </div>
              </div>
            </motion.article>
          </PremiumGameCardWrapper>

        </div>
      </section>

      <div className="mx-auto mt-8 w-full max-w-4xl">
        <PwaInstallTip />
      </div>

      <div className="mt-10 flex justify-center">
        <div className="space-x-4 text-sm font-semibold text-slate-500">
          <Link href="/privacy" className="transition hover:text-slate-800">
            Privatlivspolitik
          </Link>
          <Link href="/teknologi" className="transition hover:text-slate-800">
            Udvikler Info
          </Link>
        </div>
      </div>

      {selectedInfoCopy ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setSelectedInfo(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-info-modal-title"
            className={`relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border p-6 backdrop-blur-2xl overscroll-contain sm:p-8 ${selectedInfoCopy.toneClassName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Luk info"
              onClick={() => setSelectedInfo(null)}
              className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/18 bg-white/10 text-lg font-semibold text-white/92 transition hover:bg-white/16"
            >
              X
            </button>

            <p className="pr-12 text-[10px] font-black uppercase tracking-[0.28em] text-white/72">
              Læs Om Spillet
            </p>
            <h3
              id="game-info-modal-title"
              className={`mt-3 pr-12 text-2xl font-black tracking-tight text-white ${rubik.className}`}
            >
              {selectedInfoCopy.title}
            </h3>

            <div className="mt-6 space-y-4">
              <div className="rounded-[1rem] border border-white/12 bg-white/8 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">Formål</p>
                <p className="mt-2 text-sm leading-6 text-white/88">{selectedInfoCopy.purpose}</p>
              </div>

              <div className="rounded-[1rem] border border-white/12 bg-white/8 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">
                  Spillets gang
                </p>
                <p className="mt-2 text-sm leading-6 text-white/88">{selectedInfoCopy.flow}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
