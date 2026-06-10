"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CircleHelp, Printer, Shield, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import PwaInstallTip from "@/components/PwaInstallTip";
import {
  canCreatePremiumRun,
  hasPremiumAccess,
  type AccessProfile,
} from "@/utils/accessControl";
import { type RaceTypeThemeKey } from "@/utils/raceTypeTheme";
import { markDraftForAutoload, writeRunDraft } from "@/utils/runDrafts";
import { createClient } from "@/utils/supabase/client";
import { buildVm26Template } from "@/utils/vm26Template";

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
const MANUEL_DRAFT_STORAGE_KEY = "draft_run_manuel";

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
type GameType = "stratego" | "zone-krig";
type GameInfoCopy = {
  title: string;
  purpose: string;
  flow: string;
  toneClassName: string;
  iconToneClassName: string;
};

const GAME_INFO_COPY: Record<GameType, GameInfoCopy> = {
  stratego: {
    title: "Live Stratego",
    purpose: "Tag det klassiske brætspil ud i virkeligheden! Eleverne får pulsen op, mens de samarbejder, tænker taktisk og dyster mod hinanden i det fri.",
    flow: "Eleverne inddeles i hold, og deres telefoner fungerer som spillebrikker på et stort, interaktivt kort. Holdene skal forsøge at finde og erobre modstandernes fane, som er gemt i en af baserne. Det kræver, at eleverne bevæger sig fysisk ud til zonerne for at angribe eller forsvare. Bliver man angrebet, dyster holdene på rang (præcis som i brætspillet), og taberen må løbe tilbage til start. Et fantastisk spil til idræt, trivselsdage eller som et aktivt afbræk i undervisningen.",
    toneClassName:
      "border-red-300/28 bg-[linear-gradient(145deg,rgba(127,29,29,0.94),rgba(136,19,55,0.9))] text-white shadow-[0_24px_60px_rgba(127,29,29,0.35)]",
    iconToneClassName:
      "border-red-300/35 bg-red-500/18 text-red-50 shadow-[0_12px_26px_rgba(239,68,68,0.22)]",
  },
  "zone-krig": {
    title: "Zone-Krigen",
    purpose: "Gør skolegården eller lokalområdet til en levende spilleplade. Her handler det om strategi, udholdenhed og at løfte i flok som hold.",
    flow: "Spillet fungerer som en moderne, digital fangeleg. Læreren placerer en række \"zoner\" på kortet (eller henter dem fra Arkivet). Holdene skal nu løbe ud og stille sig ind i zonerne for at erobre dem. Jo længere et hold kan fastholde en zone uden at blive jagtet væk af de andre, jo flere point tikker der ind på kontoen. Det hold, der har samlet flest point, når tiden rinder ud, vinder. En intens og sjov hold-dyst, hvor alle kan være med!",
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

function Vm26TemplateCard({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -4, scale: 1.012 }}
      onClick={onCreate}
      className={`${cardBaseClass} cursor-pointer border-sky-500/75 bg-sky-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(14,165,233,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]`}
    >
      <div className={cardBackgroundShellClass}>
        <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(14,165,233,0.22)]" />
        <div className="absolute inset-[1px] rounded-[1.95rem]" />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <span className="inline-flex items-center rounded-full border border-sky-300/40 bg-sky-400/20 px-3 py-1 text-[0.58rem] font-bold tracking-[0.18em] text-white uppercase shadow-[0_10px_22px_rgba(14,165,233,0.18)] backdrop-blur-md">
          ⚽ VM26
        </span>
      </div>

      <div className={`${cardPanelClass} text-slate-950`}>
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-amber-200/45 bg-amber-300/18 shadow-[0_10px_30px_rgba(251,191,36,0.24)]">
            <Trophy className="h-5 w-5 text-sky-100" />
          </div>
          <div className="space-y-1">
            <h2 className={`text-[1.25rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
              🏆 VM26 – Jagten på pokalen
            </h2>
            <p className="mx-auto max-w-[16.5rem] text-[0.68rem] leading-tight text-white/84">
              Et sikkert almindeligt GPS-løb med 8 færdige fodboldposter. Ingen ny motor, bare VM-stemning i den kendte builder.
            </p>
            <span className="mt-2 inline-flex rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[0.58rem] font-black tracking-[0.18em] text-white uppercase">
              Opret VM26-løb
            </span>
          </div>
        </div>
      </div>
    </motion.button>
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
  const router = useRouter();
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
  const handleCreateVm26Run = useCallback(() => {
    writeRunDraft(MANUEL_DRAFT_STORAGE_KEY, null, buildVm26Template());
    markDraftForAutoload(MANUEL_DRAFT_STORAGE_KEY);
    router.push("/dashboard/opret/manuel");
  }, [router]);
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
              <GameInfoButton
                gameType="stratego"
                isOpen={selectedInfo === "stratego"}
                onToggle={handleInfoToggle}
              />

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

          <Vm26TemplateCard onCreate={handleCreateVm26Run} />
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
