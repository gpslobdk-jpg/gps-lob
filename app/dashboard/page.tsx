"use client";

import { motion } from "framer-motion";
import { FolderOpen, MapPin, Radio, Settings } from "lucide-react";
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
  "relative flex h-[300px] flex-col overflow-hidden rounded-[2.5rem] border border-white/50 bg-white/80 p-8 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/95 hover:shadow-2xl";

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

    setLiveHint("Start et l\u00f8b fra arkivet f\u00f8rst.");
  };

  const handleLogUd = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const liveCardClass = useMemo(() => {
    if (isCheckingLiveSession) {
      return `${cardBaseClass} cursor-progress opacity-85 hover:scale-100`;
    }
    if (hasActiveSession) {
      return `${cardBaseClass} cursor-pointer ring-1 ring-emerald-300/60`;
    }
    return `${cardBaseClass} cursor-not-allowed opacity-75 hover:scale-100`;
  }, [hasActiveSession, isCheckingLiveSession]);

  return (
    <div
      className={`relative flex min-h-screen flex-col bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 p-6 text-white md:p-12 lg:bg-none lg:bg-transparent ${poppins.className}`}
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
      <div className="fixed inset-0 hidden bg-gradient-to-b from-sky-900/20 to-emerald-900/40 backdrop-blur-[2px] -z-10 lg:block" />

      <header className="flex items-center justify-between">
        <Image src="/gpslogo.png" width={150} height={50} alt="Logo" priority />
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/indstillinger"
            className="rounded-xl border border-white/40 bg-white/15 p-2.5 text-white drop-shadow-md backdrop-blur-sm transition-colors hover:bg-white/25"
            aria-label="Indstillinger"
          >
                  <Settings className="w-6 h-6 text-slate-700" />
          </Link>
          <button
            type="button"
            onClick={() => void handleLogUd()}
            className="text-white drop-shadow-md transition-colors hover:text-white/90"
          >
            Log ud
          </button>
        </div>
      </header>

      <section className="text-center">
        <h1
          className={`mt-12 mb-2 text-4xl font-black tracking-widest text-white uppercase drop-shadow-md md:text-6xl ${rubik.className}`}
        >
          UDSIGTSPOSTEN
        </h1>
        <div className="mt-4 flex justify-center">
          <span className="inline-flex rounded-full border border-white/45 bg-white/12 px-4 py-1.5 text-xs font-medium text-white/90 shadow-[0_8px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm">
            100% menneskabt arkitektur â€“ med et strejf af AI-magi
          </span>
        </div>
        <p className="text-emerald-50">{"V\u00e6lg din n\u00e6ste handling og kom i gang"}</p>
      </section>

      <section className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        <Link href="/dashboard/opret/valg" data-tour="dashboard-create-run" className="block">
          <motion.article whileHover={{ scale: 1.03 }} className={`${cardBaseClass} cursor-pointer`}>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-600">
              <MapPin className="h-7 w-7" />
            </div>
            <h2 className={`mb-2 text-2xl font-bold tracking-wide text-emerald-950 uppercase ${rubik.className}`}>
              {"OPRET NYT L\u00d8B"}
            </h2>
            <p className="mb-4 text-sm font-semibold text-emerald-700 uppercase">
              {"BYG P\u00c5 ET RIGTIGT KORT."}
            </p>
            <p className="text-sm leading-relaxed text-emerald-800">
              {
                "S\u00e6t poster ind p\u00e5 et interaktivt kort, skriv sp\u00f8rgsm\u00e5l og gem lynhurtigt."
              }
            </p>
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
              className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full border text-emerald-600 ${
                hasActiveSession && !isCheckingLiveSession
                  ? "animate-pulse border-emerald-300 bg-emerald-200"
                  : "border-emerald-200 bg-emerald-100"
              }`}
            >
              <Radio className="h-7 w-7" />
            </div>
            <h2 className={`mb-2 text-2xl font-bold tracking-wide text-emerald-950 uppercase ${rubik.className}`}>
              {hasActiveSession && !isCheckingLiveSession
                ? "GENOPTAG IGANGV\u00c6RENDE L\u00d8B"
                : "LIVE OVERV\u00c5GNING"}
            </h2>
            <p className="mb-4 text-sm font-semibold text-emerald-700 uppercase">
              {isCheckingLiveSession
                ? "TJEKKER AKTIV SESSION..."
                : hasActiveSession
                  ? "FORTS\u00c6T DER, HVOR DU SLAP."
                  : "F\u00d8LG HOLDET I REALTID."}
            </p>
            <p className="text-sm leading-relaxed text-emerald-800">
              {isCheckingLiveSession
                ? "Vi finder automatisk en aktiv session til dig."
                : hasActiveSession
                  ? "Hop direkte tilbage til livekort, chat og svarflow uden at miste overblikket."
                  : "Se deltagernes positioner bev\u00e6ge sig p\u00e5 kortet og modtag deres svar live."}
            </p>
            {!isCheckingLiveSession && !hasActiveSession && liveHint ? (
              <p className="mt-4 text-xs font-semibold text-emerald-700">{liveHint}</p>
            ) : null}
          </article>
        </motion.button>

        <Link href="/dashboard/arkiv" className="block">
          <article className={`${cardBaseClass} cursor-pointer`}>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-600">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h2 className={`mb-2 text-2xl font-bold tracking-wide text-emerald-950 uppercase ${rubik.className}`}>
              {"MIT L\u00d8BSARKIV"}
            </h2>
            <p className="mb-4 text-sm font-semibold text-emerald-700 uppercase">GENBRUG OG DEL.</p>
            <p className="text-sm leading-relaxed text-emerald-800">
              {"Find alle dine tidligere l\u00f8b, rediger dem, eller del koden med en ny gruppe."}
            </p>
          </article>
        </Link>
      </section>

      <footer className="mx-auto mt-auto w-full max-w-5xl pt-14 text-center">
        <div className="space-x-4 text-sm text-slate-500">
          <Link href="/privacy" className="transition hover:text-slate-700">
            Privatlivspolitik
          </Link>
          <Link href="/privacy" className="transition hover:text-slate-700">
            Udvikler Info
          </Link>
        </div>
      </footer>
    </div>
  );
}
