"use client";

import { motion } from "framer-motion";
import { FolderOpen, MapPin, Radio } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import PwaInstallTip from "@/components/PwaInstallTip";
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
  const [runCountError, setRunCountError] = useState(false);
  const [dashboardRetryKey, setDashboardRetryKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const fetchActiveSession = async () => {
      if (isMounted) {
        setIsCheckingLiveSession(true);
        setRunCountError(false);
      }

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

        const [
          { data, error },
          { count: runCount, error: runsError },
        ] = await Promise.all([
          supabase
            .from("live_sessions")
            .select("id")
            .eq("teacher_id", user.id)
            .in("status", ["waiting", "running"])
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("gps_runs")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
        ]);

        if (runsError) {
          console.error("Kunne ikke tjekke antal gemte l\u00f8b:", runsError);
          if (isMounted) {
            setRunCountError(true);
            setActiveSessionId(null);
          }
          return;
        }

        if (runCount === 0) {
          router.replace("/dashboard/velkommen");
          return;
        }

        if (error) {
          console.error("Kunne ikke tjekke aktiv live-session:", error);
          if (isMounted) setActiveSessionId(null);
          return;
        }

        const active = (data as ActiveSessionRow[] | null)?.[0] ?? null;
        if (isMounted) {
          setActiveSessionId(active?.id ?? null);
        }
      } catch (error) {
        console.error("Dashboardet kunne ikke indl\u00e6ses:", error);
        if (isMounted) {
          setRunCountError(true);
          setActiveSessionId(null);
        }
      } finally {
        if (isMounted) setIsCheckingLiveSession(false);
      }
    };

    void fetchActiveSession();

    return () => {
      isMounted = false;
    };
  }, [dashboardRetryKey, router]);

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

  const handleRetryDashboardLoad = () => {
    setDashboardRetryKey((current) => current + 1);
  };

  const liveCardClass = useMemo(() => {
    if (isCheckingLiveSession) {
      return `${cardBaseClass} cursor-progress opacity-85 hover:scale-100`;
    }
    if (hasActiveSession) {
      return `${cardBaseClass} cursor-pointer ring-1 ring-amber-300/60`;
    }
    return `${cardBaseClass} cursor-not-allowed opacity-75 hover:scale-100`;
  }, [hasActiveSession, isCheckingLiveSession]);

  if (isCheckingLiveSession) {
    return (
      <div
        className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-12 text-white ${poppins.className}`}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="fixed top-0 left-0 h-full w-full object-cover -z-20"
          src="/promo.mp4"
        />
        <div className="fixed inset-0 -z-10 bg-slate-950/75 backdrop-blur-[3px]" />

        <div className="relative w-full max-w-6xl">
          <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl animate-pulse sm:p-8">
            <div className="flex flex-col gap-8">
              <div className="space-y-4">
                <div className="h-5 w-28 rounded-full border border-emerald-500/20 bg-slate-800/80" />
                <div className="h-12 max-w-md rounded-2xl border border-emerald-500/20 bg-slate-800/80" />
                <div className="h-4 max-w-xl rounded-full border border-emerald-500/20 bg-slate-800/70" />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="h-[300px] rounded-3xl border border-emerald-500/20 bg-slate-800/70" />
                <div className="h-[300px] rounded-3xl border border-emerald-500/20 bg-slate-800/70" />
                <div className="h-[300px] rounded-3xl border border-emerald-500/20 bg-slate-800/70" />
              </div>

              <div className="flex justify-center gap-4">
                <div className="h-4 w-28 rounded-full border border-emerald-500/20 bg-slate-800/70" />
                <div className="h-4 w-32 rounded-full border border-emerald-500/20 bg-slate-800/70" />
                <div className="h-4 w-28 rounded-full border border-emerald-500/20 bg-slate-800/70" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (runCountError) {
    return (
      <div
        className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-12 text-white ${poppins.className}`}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="fixed top-0 left-0 h-full w-full object-cover -z-20"
          src="/promo.mp4"
        />
        <div className="fixed inset-0 -z-10 bg-slate-950/80 backdrop-blur-[3px]" />

        <div className="relative w-full max-w-xl rounded-[2rem] border border-emerald-500/20 bg-slate-900/70 p-8 text-center shadow-[0_32px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-lg font-black text-emerald-300">
            MC
          </div>
          <p className="mt-6 text-xs font-semibold tracking-[0.32em] text-emerald-300 uppercase">
            Mission Control
          </p>
          <h1 className={`mt-4 text-3xl font-black tracking-tight text-white ${rubik.className}`}>
            {"Kontrollt\u00e5rnet mistede forbindelsen"}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
            {
              "Vi kunne ikke hente dine gemte l\u00f8b fra databasen. Pr\u00f8v igen, s\u00e5 genopretter vi forbindelsen og sender dig videre."
            }
          </p>
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleRetryDashboardLoad}
              className="inline-flex items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-500/25"
            >
              {"Pr\u00f8v igen"}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <button
          type="button"
          onClick={() => void handleLogUd()}
          className="text-white drop-shadow-md transition-colors hover:text-white/90"
        >
          Log ud
        </button>
      </header>

      <section className="text-center">
        <h1
          className={`mt-12 mb-2 text-4xl font-black tracking-widest text-white uppercase drop-shadow-md md:text-6xl ${rubik.className}`}
        >
          UDSIGTSPOSTEN
        </h1>
        <p className="text-emerald-50">{"V\u00e6lg din n\u00e6ste handling og kom i gang"}</p>
      </section>

      <section className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        <Link href="/dashboard/opret/valg" data-tour="dashboard-create-run" className="block">
          <motion.article whileHover={{ scale: 1.03 }} className={`${cardBaseClass} cursor-pointer`}>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-600">
              <MapPin className="h-7 w-7" />
            </div>
            <h2 className={`mb-2 text-2xl font-black tracking-wide text-emerald-950 uppercase ${rubik.className}`}>
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
              className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full border text-amber-600 ${
                hasActiveSession && !isCheckingLiveSession
                  ? "animate-pulse border-amber-300 bg-amber-200"
                  : "border-amber-200 bg-amber-100"
              }`}
            >
              <Radio className="h-7 w-7" />
            </div>
            <h2 className={`mb-2 text-2xl font-black tracking-wide text-amber-950 uppercase ${rubik.className}`}>
              {hasActiveSession && !isCheckingLiveSession
                ? "GENOPTAG IGANGV\u00c6RENDE L\u00d8B"
                : "LIVE OVERV\u00c5GNING"}
            </h2>
            <p className="mb-4 text-sm font-semibold text-amber-700 uppercase">
              {isCheckingLiveSession
                ? "TJEKKER AKTIV SESSION..."
                : hasActiveSession
                  ? "FORTS\u00c6T DER, HVOR DU SLAP."
                  : "F\u00d8LG HOLDET I REALTID."}
            </p>
            <p className="text-sm leading-relaxed text-amber-800">
              {isCheckingLiveSession
                ? "Vi finder automatisk en aktiv session til dig."
                : hasActiveSession
                  ? "Hop direkte tilbage til livekort, chat og svarflow uden at miste overblikket."
                  : "Se deltagernes positioner bev\u00e6ge sig p\u00e5 kortet og modtag deres svar live."}
            </p>
            {!isCheckingLiveSession && !hasActiveSession && liveHint ? (
              <p className="mt-4 text-xs font-semibold text-amber-700">{liveHint}</p>
            ) : null}
          </article>
        </motion.button>

        <Link href="/dashboard/arkiv" className="block">
          <article className={`${cardBaseClass} cursor-pointer`}>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-blue-600">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h2 className={`mb-2 text-2xl font-black tracking-wide text-blue-950 uppercase ${rubik.className}`}>
              {"MIT L\u00d8BSARKIV"}
            </h2>
            <p className="mb-4 text-sm font-semibold text-blue-700 uppercase">GENBRUG OG DEL.</p>
            <p className="text-sm leading-relaxed text-blue-800">
              {"Find alle dine tidligere l\u00f8b, rediger dem, eller del koden med en ny gruppe."}
            </p>
          </article>
        </Link>
      </section>

      <section className="mx-auto mt-8 w-full max-w-4xl">
        <PwaInstallTip />
      </section>

      <footer className="mx-auto mt-auto w-full max-w-5xl pt-14 text-center">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
          <Link href="/dashboard/indstillinger" className="transition hover:text-slate-700">
            Indstillinger
          </Link>
          <Link href="/privacy" className="transition hover:text-slate-700">
            Privatlivspolitik
          </Link>
          <Link href="/teknologi" className="transition hover:text-slate-700">
            Udvikler Info
          </Link>
        </div>
      </footer>
    </div>
  );
}
