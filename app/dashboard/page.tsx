"use client";

import { motion } from "framer-motion";
import { FolderOpen, MapPin, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  "relative flex h-[300px] flex-col overflow-hidden rounded-[2rem] border border-white/5 bg-[#131b35] p-8 transition-colors duration-300";

type ActiveSessionRow = {
  id: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isCheckingLiveSession, setIsCheckingLiveSession] = useState(true);
  const [liveHint, setLiveHint] = useState("");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const fetchActiveSession = async () => {
      setIsCheckingLiveSession(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (userError) {
            console.error("Kunne ikke hente bruger:", userError);
          }
          if (isMounted) setActiveSessionId(null);
          return;
        }

        const { data, error } = await supabase
          .from("live_sessions")
          .select("id")
          .eq("teacher_id", user.id)
          .in("status", ["waiting", "running"])
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Kunne ikke tjekke aktiv live-session:", error);
          if (isMounted) setActiveSessionId(null);
          return;
        }

        const active = (data as ActiveSessionRow[] | null)?.[0] ?? null;
        if (isMounted) {
          setActiveSessionId(active?.id ?? null);
        }
      } finally {
        if (isMounted) setIsCheckingLiveSession(false);
      }
    };

    void fetchActiveSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasActiveSession = Boolean(activeSessionId);

  useEffect(() => {
    if (hasActiveSession || isCheckingLiveSession) {
      setLiveHint("");
    }
  }, [hasActiveSession, isCheckingLiveSession]);

  const handleLiveMonitoringClick = () => {
    if (isCheckingLiveSession) return;

    if (activeSessionId) {
      router.push(`/dashboard/live/${activeSessionId}`);
      return;
    }

    setLiveHint("Start et løb fra arkivet først.");
  };

  const liveCardClass = useMemo(() => {
    if (isCheckingLiveSession) {
      return `${cardBaseClass} opacity-80 cursor-progress`;
    }
    if (hasActiveSession) {
      return `${cardBaseClass} cursor-pointer ring-1 ring-emerald-300/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]`;
    }
    return `${cardBaseClass} cursor-not-allowed opacity-50`;
  }, [hasActiveSession, isCheckingLiveSession]);

  return (
    <div className={`min-h-screen bg-[#0a1128] p-6 text-white md:p-12 ${poppins.className}`}>
      <header className="flex items-center justify-between">
        <Image src="/gpslogo.png" width={150} height={50} alt="Logo" priority />
        <button type="button" className="text-white/50 transition-colors hover:text-white">
          Log ud
        </button>
      </header>

      <section className="text-center">
        <h1
          className={`mt-12 mb-2 text-4xl font-black tracking-widest uppercase md:text-6xl ${rubik.className}`}
        >
          KONTROLTÅRNET
        </h1>
        <p className="text-white/65">Vælg din næste handling og kom i gang</p>
      </section>

      <section className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        <Link href="/dashboard/opret" className="block">
          <motion.article whileHover={{ scale: 1.03 }} className={`${cardBaseClass} cursor-pointer hover:bg-[#1a2442]`}>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-300">
              <MapPin className="h-7 w-7" />
            </div>
            <h2 className={`mb-2 text-2xl font-bold tracking-wide uppercase ${rubik.className}`}>
              OPRET NYT LØB
            </h2>
            <p className="mb-4 text-sm font-semibold text-white/50 uppercase">
              BYG PÅ ET RIGTIGT KORT.
            </p>
            <p className="text-sm leading-relaxed text-white/70">
              Sæt poster ind på et interaktivt kort, skriv spørgsmål og gem lynhurtigt.
            </p>
            <div className="absolute right-0 bottom-0 left-0 h-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_-5px_20px_rgba(34,211,238,0.5)]" />
          </motion.article>
        </Link>

        <motion.button
          type="button"
          onClick={handleLiveMonitoringClick}
          whileHover={hasActiveSession ? { scale: 1.03 } : undefined}
          className="block w-full text-left"
          aria-disabled={!hasActiveSession && !isCheckingLiveSession}
        >
          <article className={liveCardClass}>
            <div
              className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full border text-emerald-300 ${
                hasActiveSession && !isCheckingLiveSession
                  ? "animate-pulse border-emerald-300/60 bg-emerald-400/25"
                  : "border-emerald-300/30 bg-emerald-400/10"
              }`}
            >
              <Radio className="h-7 w-7" />
            </div>
            <h2 className={`mb-2 text-2xl font-bold tracking-wide uppercase ${rubik.className}`}>
              {hasActiveSession && !isCheckingLiveSession
                ? "GENOPTAG IGANGVÆRENDE LØB"
                : "LIVE OVERVÅGNING"}
            </h2>
            <p className="mb-4 text-sm font-semibold text-white/50 uppercase">
              {isCheckingLiveSession
                ? "TJEKKER AKTIV SESSION..."
                : hasActiveSession
                  ? "FORTSÆT DER, HVOR DU SLAP."
                  : "FØLG KLASSEN I REALTID."}
            </p>
            <p className="text-sm leading-relaxed text-white/70">
              {isCheckingLiveSession
                ? "Vi finder automatisk en aktiv session til dig."
                : hasActiveSession
                  ? "Hop direkte tilbage til livekort, chat og svarflow uden at miste overblikket."
                  : "Se elevernes positioner bevæge sig på kortet og modtag deres svar live."}
            </p>
            {!isCheckingLiveSession && !hasActiveSession && liveHint ? (
              <p className="mt-4 text-xs font-semibold text-amber-200">{liveHint}</p>
            ) : null}
            <div
              className={`absolute right-0 bottom-0 left-0 h-1.5 ${
                hasActiveSession && !isCheckingLiveSession
                  ? "animate-pulse bg-gradient-to-r from-emerald-300 to-lime-400 shadow-[0_-5px_22px_rgba(132,204,22,0.6)]"
                  : "bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_-5px_20px_rgba(52,211,153,0.5)]"
              }`}
            />
          </article>
        </motion.button>

        <Link href="/dashboard/arkiv" className="block">
          <article className={`${cardBaseClass} cursor-pointer hover:bg-[#1a2442]`}>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-purple-300/30 bg-purple-400/10 text-purple-300">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h2 className={`mb-2 text-2xl font-bold tracking-wide uppercase ${rubik.className}`}>
              MIT LØBSARKIV
            </h2>
            <p className="mb-4 text-sm font-semibold text-white/50 uppercase">
              GENBRUG OG DEL.
            </p>
            <p className="text-sm leading-relaxed text-white/70">
              Find alle dine tidligere løb, rediger dem, eller del koden med en ny klasse.
            </p>
            <div className="absolute right-0 bottom-0 left-0 h-1.5 bg-gradient-to-r from-purple-400 to-pink-500 shadow-[0_-5px_20px_rgba(192,132,252,0.5)]" />
          </article>
        </Link>
      </section>
    </div>
  );
}

