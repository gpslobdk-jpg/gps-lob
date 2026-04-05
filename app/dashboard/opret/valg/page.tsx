"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CircleHelp, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { type ReactNode, useEffect, useRef, useState } from "react";

import PwaInstallTip from "@/components/PwaInstallTip";
import {
  canCreatePremiumRun,
  hasPremiumAccess,
  type AccessProfile,
} from "@/utils/accessControl";
import { type RaceTypeThemeKey } from "@/utils/raceTypeTheme";
import { createClient } from "@/utils/supabase/client";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
type GameInfoCopy = {
  title: string;
  purpose: string;
  flow: string;
  toneClassName: string;
  iconToneClassName: string;
};

const GAME_INFO_COPY: Record<"stratego" | "zone-krig", GameInfoCopy> = {
  stratego: {
    title: "Live Stratego",
    purpose: "Find og fang modstanderholdets Fane for at vinde øjeblikkeligt.",
    flow:
      "Fjender vises som abstrakte radarzoner. Se afstanden, men find dem i virkeligheden. Området omkring jeres base er fredet, og dueller afgøres af rang med klassiske undtagelser.",
    toneClassName:
      "border-red-300/28 bg-[linear-gradient(145deg,rgba(127,29,29,0.94),rgba(136,19,55,0.9))] text-white shadow-[0_24px_60px_rgba(127,29,29,0.35)]",
    iconToneClassName:
      "border-red-300/35 bg-red-500/18 text-red-50 shadow-[0_12px_26px_rgba(239,68,68,0.22)]",
  },
  "zone-krig": {
    title: "Zone-Krigen",
    purpose:
      "Erobr og hold fast i flest zoner, når tiden løber ud. Point er kun til pynt – zoner afgør sejren.",
    flow:
      "Løb hen til en zone og svar rigtigt på opgaven for at overtage den. Når en zone overtages, får den et 3-minutters skjold, og et korrekt svar på egen zone fornyer skjoldet.",
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
      data-tour={index === 0 ? "valg-classic-quiz" : undefined}
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

function GameInfoPopover({ copy }: { copy: GameInfoCopy }) {
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isHoverActive, setIsHoverActive] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hoverCloseTimeoutRef = useRef<number | null>(null);
  const isOpen = isPinnedOpen || isHoverActive;

  const clearHoverCloseTimeout = () => {
    if (hoverCloseTimeoutRef.current === null || typeof window === "undefined") {
      return;
    }

    window.clearTimeout(hoverCloseTimeoutRef.current);
    hoverCloseTimeoutRef.current = null;
  };

  const handleHoverStart = () => {
    clearHoverCloseTimeout();
    setIsHoverActive(true);
  };

  const handleHoverEnd = () => {
    if (typeof window === "undefined") {
      setIsHoverActive(false);
      return;
    }

    clearHoverCloseTimeout();
    hoverCloseTimeoutRef.current = window.setTimeout(() => {
      setIsHoverActive(false);
      hoverCloseTimeoutRef.current = null;
    }, 100);
  };

  useEffect(() => {
    if (!isPinnedOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        setIsPinnedOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPinnedOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPinnedOpen]);

  useEffect(() => {
    return () => {
      clearHoverCloseTimeout();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="absolute top-4 left-4 z-30"
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      onPointerDownCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        aria-label={`Læs om ${copy.title}`}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsPinnedOpen((previous) => !previous);
        }}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl transition hover:scale-[1.03] ${copy.iconToneClassName}`}
      >
        <CircleHelp className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div
          onMouseEnter={handleHoverStart}
          onMouseLeave={handleHoverEnd}
          onPointerDownCapture={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClickCapture={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className={`absolute left-0 top-12 z-40 max-h-[min(26rem,calc(100vh-6rem))] w-[min(18rem,calc(100vw-4rem))] overflow-y-auto rounded-[1.5rem] border px-4 py-4 backdrop-blur-2xl overscroll-contain ${copy.toneClassName}`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/72">
            Læs Om Spillet
          </p>
          <h3 className={`mt-2 text-lg font-black tracking-tight text-white ${rubik.className}`}>
            {copy.title}
          </h3>

          <div className="mt-4 space-y-3">
            <div className="rounded-[1rem] border border-white/12 bg-white/8 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">Formål</p>
              <p className="mt-2 text-sm leading-6 text-white/88">{copy.purpose}</p>
            </div>

            <div className="rounded-[1rem] border border-white/12 bg-white/8 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">Spillets gang</p>
              <p className="mt-2 text-sm leading-6 text-white/88">{copy.flow}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ValgHubPage() {
  const [premiumAccessState, setPremiumAccessState] = useState<PremiumCardAccessState>(() =>
    IS_PAYWALL_ENABLED ? "loading" : "premium"
  );

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

  const premiumCardsAreTrial = IS_PAYWALL_ENABLED && premiumAccessState === "trial";
  const premiumCardsAreLocked = IS_PAYWALL_ENABLED && premiumAccessState === "locked";
  const premiumCardsAreLoading = IS_PAYWALL_ENABLED && premiumAccessState === "loading";
  const strategoCardHref = premiumCardsAreLocked
    ? "/priser"
    : premiumCardsAreLoading
      ? undefined
      : "/dashboard/opret/stratego";
  const zoneKrigCardHref = premiumCardsAreLocked
    ? "/priser"
    : premiumCardsAreLoading
      ? undefined
      : "/dashboard/opret/zone-krig";
  const premiumBadgeLabel = premiumCardsAreLocked
    ? "\uD83D\uDD12 L\u00C5ST / KR\u00C6VER PRO"
    : premiumCardsAreTrial
      ? "\uD83C\uDF81 1 GRATIS PR\u00D8VEL\u00D8B"
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
          <PremiumGameCardWrapper href={strategoCardHref}>
            <motion.article
              whileHover={strategoCardHref ? { y: -4, scale: 1.012 } : undefined}
              className={`${cardBaseClass} ${strategoCardHref ? "cursor-pointer" : "cursor-default"} border-red-500/75 bg-red-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(239,68,68,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] ${premiumCardsAreLocked ? "ring-1 ring-amber-300/20" : ""}`}
            >
              <div className={cardBackgroundShellClass}>
                <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(249,115,22,0.28),transparent_62%),radial-gradient(circle_at_center,rgba(239,68,68,0.2),transparent_70%)] shadow-[inset_0_0_54px_rgba(239,68,68,0.18)]" />
                <div className="absolute inset-[1px] rounded-[1.95rem]" />
              </div>
              <GameInfoPopover copy={GAME_INFO_COPY.stratego} />

              <div className="absolute top-4 right-4 z-20">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.58rem] font-bold tracking-[0.18em] text-white uppercase shadow-[0_10px_22px_rgba(239,68,68,0.22)] backdrop-blur-md ${premiumBadgeLabel ? premiumBadgeClass : "border-red-300/40 bg-red-400/20"}`}>
                  {premiumBadgeLabel ?? "NYT SPIL"}
                </span>
              </div>

              <div className={`${cardPanelClass} text-slate-950`}>
                <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-red-300/35 bg-red-500/18 shadow-[0_10px_30px_rgba(239,68,68,0.22)]">
                    <Shield className="h-6 w-6 text-orange-200" />
                  </div>

                  <div className="space-y-1">
                    <h2 className={`text-[1.4rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
                      Live Stratego
                    </h2>
                    <p className="mx-auto max-w-[15rem] text-xs leading-tight text-white/84">
                      Det klassiske brætspil vækkes til live. Eleverne får hemmelige roller på mobilen og dyster i virkeligheden.
                    </p>
                  </div>
                </div>
              </div>
            </motion.article>
          </PremiumGameCardWrapper>

          <PremiumGameCardWrapper href={zoneKrigCardHref}>
            <motion.article
              whileHover={zoneKrigCardHref ? { y: -4, scale: 1.012 } : undefined}
              className={`${cardBaseClass} ${zoneKrigCardHref ? "cursor-pointer" : "cursor-default"} border-orange-500/75 bg-orange-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(249,115,22,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] ${premiumCardsAreLocked ? "ring-1 ring-amber-300/20" : ""}`}
            >
              <div className={cardBackgroundShellClass}>
                <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(249,115,22,0.34),transparent_62%)] shadow-[inset_0_0_54px_rgba(249,115,22,0.28)]" />
                <div className="absolute inset-[1px] rounded-[1.95rem]" />
              </div>
              <GameInfoPopover copy={GAME_INFO_COPY["zone-krig"]} />

              <div className="absolute top-4 right-4 z-20">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.58rem] font-bold tracking-[0.18em] text-white uppercase shadow-[0_10px_22px_rgba(249,115,22,0.22)] backdrop-blur-md ${premiumBadgeLabel ? premiumBadgeClass : "border-orange-300/40 bg-orange-400/20"}`}>
                  {premiumBadgeLabel ?? "SPIL"}
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
          </PremiumGameCardWrapper>
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
