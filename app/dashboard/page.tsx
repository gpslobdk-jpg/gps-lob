"use client";

import { motion } from "framer-motion";
import { BookOpen, Gamepad2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import PwaInstallTip from "@/components/PwaInstallTip";
import MobileInSchoolBanner from "@/components/MobileInSchoolBanner";
import { readStoredActiveParticipant } from "@/components/play/playUtils";
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
  "group relative mx-auto flex h-full w-full max-w-[20.5rem] flex-col overflow-hidden rounded-[2rem] border bg-white/10 p-0 text-left shadow-[0_22px_52px_rgba(15,23,42,0.16),0_8px_18px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-lg transition-all duration-300";

const cardPanelClass =
  "relative flex h-full flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-16px_24px_rgba(15,23,42,0.07)]";

const createCardClass =
  "border-emerald-400/60 bg-emerald-500/10 shadow-[0_22px_52px_rgba(15,23,42,0.16),0_12px_26px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(255,255,255,0.18)]";

const liveCardEnabledClass =
  "border-amber-400/60 bg-amber-500/10 shadow-[0_22px_52px_rgba(15,23,42,0.16),0_12px_26px_rgba(245,158,11,0.16),inset_0_1px_0_rgba(255,255,255,0.18)]";

const archiveCardClass =
  "border-fuchsia-400/60 bg-fuchsia-500/10 shadow-[0_22px_52px_rgba(15,23,42,0.16),0_12px_26px_rgba(217,70,239,0.16),inset_0_1px_0_rgba(255,255,255,0.18)]";

const mobileGamesCardClass =
  "border-cyan-400/60 bg-cyan-500/10 shadow-[0_22px_52px_rgba(15,23,42,0.16),0_12px_26px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)]";

const teacherToolsCardClass =
  "border-indigo-300/65 bg-indigo-500/10 shadow-[0_22px_52px_rgba(15,23,42,0.16),0_12px_26px_rgba(99,102,241,0.15),inset_0_1px_0_rgba(255,255,255,0.18)]";

type ActiveSessionRow = {
  id: string;
};

type ParticipantResumeRow = {
  id: string;
  session_id: string;
  finished_at: string | null;
};

type ResumeTarget = {
  kind: "participant" | "teacher";
  sessionId: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [resumeTarget, setResumeTarget] = useState<ResumeTarget | null>(null);
  const [isCheckingLiveSession, setIsCheckingLiveSession] = useState(true);
  const [liveHint, setLiveHint] = useState("");
  const [runCountError, setRunCountError] = useState(false);
  const [dashboardRetryKey, setDashboardRetryKey] = useState(0);
  const [isNavigatingCreate, setIsNavigatingCreate] = useState(false);
  const [isNavigatingArchive, setIsNavigatingArchive] = useState(false);
  const [isNavigatingMobileGames, setIsNavigatingMobileGames] = useState(false);
  const [isNavigatingTeacherTools, setIsNavigatingTeacherTools] = useState(false);
  const [, setIsNavigatingLive] = useState(false);

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
          if (isMounted) setResumeTarget(null);
          return;
        }

        const storedParticipant = readStoredActiveParticipant();
        if (storedParticipant?.participantId) {
          const { data: participantData, error: participantError } = await supabase
            .from("participants")
            .select("id,session_id,finished_at")
            .eq("id", storedParticipant.participantId)
            .is("finished_at", null)
            .maybeSingle();

          if (participantError) {
            console.error("Kunne ikke tjekke aktiv deltagerstatus:", participantError);
          }

          const activeParticipant = (participantData as ParticipantResumeRow | null) ?? null;
          if (activeParticipant?.session_id) {
            if (isMounted) {
              setResumeTarget({ kind: "participant", sessionId: activeParticipant.session_id });
            }
            return;
          }
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
            setResumeTarget(null);
          }
          return;
        }

        if (runCount === 0) {
          // No saved runs yet — keep the dashboard view but don't attempt
          // to redirect to a removed welcome/onboarding page.
          if (isMounted) setResumeTarget(null);
          return;
        }

        if (error) {
          console.error("Kunne ikke tjekke aktiv live-session:", error);
          if (isMounted) setResumeTarget(null);
          return;
        }

        const active = (data as ActiveSessionRow[] | null)?.[0] ?? null;
        if (isMounted) {
          setResumeTarget(active?.id ? { kind: "teacher", sessionId: active.id } : null);
        }
      } catch (error) {
        console.error("Dashboardet kunne ikke indl\u00e6ses:", error);
        if (isMounted) {
          setRunCountError(true);
          setResumeTarget(null);
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

  const hasResumeTarget = Boolean(resumeTarget?.sessionId);
  const isParticipantResume = resumeTarget?.kind === "participant";
  const isTeacherResume = resumeTarget?.kind === "teacher";

  useEffect(() => {
    if (hasResumeTarget || isCheckingLiveSession) {
      setLiveHint("");
    }
  }, [hasResumeTarget, isCheckingLiveSession]);

  const handleLiveMonitoringClick = () => {
    if (isCheckingLiveSession) return;

    if (resumeTarget?.sessionId) {
      setIsNavigatingLive(true);
      void router.push(
        resumeTarget.kind === "participant"
          ? `/play/${resumeTarget.sessionId}`
          : `/dashboard/live/${resumeTarget.sessionId}`
      );
      return;
    }

    setLiveHint("Start et l\u00f8b fra arkivet f\u00f8rst.");
  };

  const handleRetryDashboardLoad = () => {
    setDashboardRetryKey((current) => current + 1);
  };

  const liveCardClass = useMemo(() => {
    if (isCheckingLiveSession) {
      return `${cardBaseClass} ${liveCardEnabledClass} cursor-progress opacity-90`;
    }
    if (hasResumeTarget) {
      return `${cardBaseClass} ${liveCardEnabledClass} cursor-pointer`;
    }
    return `${cardBaseClass} border-amber-400/60 bg-amber-500/8 cursor-not-allowed opacity-80 shadow-[0_22px_52px_rgba(15,23,42,0.16),0_12px_26px_rgba(245,158,11,0.10),inset_0_1px_0_rgba(255,255,255,0.18)]`;
  }, [hasResumeTarget, isCheckingLiveSession]);

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

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="h-[300px] rounded-3xl border border-emerald-500/20 bg-slate-800/70" />
                <div className="h-[300px] rounded-3xl border border-emerald-500/20 bg-slate-800/70" />
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
      className={`relative flex min-h-screen flex-col bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 px-6 pt-0 pb-8 text-white md:px-10 md:pt-0 md:pb-10 lg:bg-none lg:bg-transparent ${poppins.className}`}
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
      </header>

      <section className="mx-auto -mt-8 flex w-full max-w-5xl flex-col items-center text-center md:-mt-12">
        <h1
          className={`mb-2 text-4xl font-black tracking-widest text-white uppercase drop-shadow-md md:text-6xl ${rubik.className}`}
        >
          UDSIGTSPOSTEN
        </h1>
        <p className="text-emerald-50">{"V\u00e6lg din n\u00e6ste handling og kom i gang"}</p>
      </section>

      <section className="mx-auto mt-8 w-full max-w-4xl">
        <MobileInSchoolBanner variant="dashboard" />
      </section>

      <section className="mx-auto mt-10 grid w-full max-w-5xl grid-cols-1 justify-items-center gap-5 md:mt-14 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
        <motion.button
          type="button"
          onClick={() => {
            if (isNavigatingCreate) return;
            setIsNavigatingCreate(true);
            void router.push("/dashboard/opret/valg");
          }}
          data-tour="dashboard-create-run"
          className="flex h-full w-full flex-col justify-center text-left"
          aria-busy={isNavigatingCreate}
          aria-disabled={isNavigatingCreate}
        >
          <motion.article
            whileHover={isNavigatingCreate ? undefined : { y: -4, scale: 1.012 }}
            className={`${cardBaseClass} ${createCardClass} ${isNavigatingCreate ? "cursor-progress opacity-85" : "cursor-pointer"}`}
          >
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_34%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.22),transparent_58%)]" />
            <div className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_0_42px_rgba(16,185,129,0.16)]" />
            <div className={`${cardPanelClass} text-emerald-950`}>
              <div className="relative z-10 flex w-full flex-col items-center justify-center text-center">
                <div className="space-y-3">
                  <h2 className={`text-[1.85rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
                    {isNavigatingCreate ? "Gør klar til nyt løb" : "Opret nyt løb"}
                  </h2>
                  <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-white/70 uppercase">
                    Byg et nyt eventyr med fuld kontrol.
                  </p>
                  <p className="mx-auto max-w-[15.5rem] text-sm leading-6 text-white/84">
                    Sæt poster på kortet, skriv spørgsmål og design et løb, der føles gennemtænkt fra første stop.
                  </p>
                </div>

              </div>
            </div>
          </motion.article>
        </motion.button>

        <motion.button
          type="button"
          onClick={handleLiveMonitoringClick}
          whileHover={hasResumeTarget ? { scale: 1.012 } : undefined}
          className="flex h-full w-full flex-col justify-center text-left"
          aria-disabled={!hasResumeTarget && !isCheckingLiveSession}
        >
          <motion.article whileHover={hasResumeTarget ? { y: -4, scale: 1.012 } : undefined} className={liveCardClass}>
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_34%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.22),transparent_58%)]" />
            <div className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_0_42px_rgba(245,158,11,0.16)]" />
            <div className={`${cardPanelClass} text-amber-950`}>
              <div className="relative z-10 flex w-full flex-col items-center justify-center text-center">
                <div className="space-y-3">
                  <h2 className={`text-[1.85rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
                    {isParticipantResume ? "Genoptag dit løb" : isTeacherResume ? "Genoptag live-overblik" : "Genoptag"}
                  </h2>
                  <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-white/70 uppercase">
                    {isCheckingLiveSession
                      ? "Vi leder efter dit aktive løb."
                      : isParticipantResume
                        ? "Hop direkte tilbage til din post på ruten."
                        : isTeacherResume
                          ? "Hop direkte tilbage ind i det aktive løb."
                        : "Åbner igen, så snart et løb er sat i gang."}
                  </p>
                  <p className="mx-auto max-w-62 text-sm leading-6 text-white/84">
                    {isCheckingLiveSession
                      ? "Vi matcher dig med den seneste aktive deltager- eller lærersession, så du kan fortsætte uden ekstra klik."
                      : isParticipantResume
                        ? "Fortsæt direkte i spillerflowet på den aktive session uden at miste din fremdrift."
                        : isTeacherResume
                          ? "Fortsæt med livekort, svarflow og overblik præcis der, hvor du slap."
                        : "Start et løb fra arkivet først, hvis du vil åbne overvågning og genoptage en session."}
                  </p>
                  {!isCheckingLiveSession && !hasResumeTarget && liveHint ? (
                    <p className="mx-auto max-w-62 rounded-2xl border border-amber-200/24 bg-amber-400/10 px-4 py-3 text-xs font-semibold text-white/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md">
                      {liveHint}
                    </p>
                  ) : null}
                </div>

              </div>
            </div>
          </motion.article>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => {
            if (isNavigatingArchive) return;
            setIsNavigatingArchive(true);
            void router.push("/dashboard/arkiv");
          }}
          className="flex h-full w-full flex-col justify-center text-left"
          aria-busy={isNavigatingArchive}
          aria-disabled={isNavigatingArchive}
        >
          <motion.article
            whileHover={isNavigatingArchive ? undefined : { y: -4, scale: 1.012 }}
            className={`${cardBaseClass} ${archiveCardClass} ${isNavigatingArchive ? "cursor-progress opacity-85" : "cursor-pointer"}`}
          >
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_34%),radial-gradient(circle_at_bottom,rgba(217,70,239,0.22),transparent_58%)]" />
            <div className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_0_42px_rgba(217,70,239,0.16)]" />
            <div className={`${cardPanelClass} text-sky-950`}>
              <div className="relative z-10 flex w-full flex-col items-center justify-center text-center">
                <div className="space-y-3">
                  <h2 className={`text-[1.85rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
                    Mit løbsarkiv
                  </h2>
                  <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-white/70 uppercase">
                    Gemte løb, klar til genbrug.
                  </p>
                  <p className="mx-auto max-w-62 text-sm leading-6 text-white/84">
                    Find dine tidligere løb, justér indholdet, og del dem hurtigt med nye klasser eller hold.
                  </p>
                </div>

              </div>
            </div>
          </motion.article>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => {
            if (isNavigatingMobileGames) return;
            setIsNavigatingMobileGames(true);
            void router.push("/dashboard/mobilspil");
          }}
          className="flex h-full w-full flex-col justify-center text-left"
          aria-busy={isNavigatingMobileGames}
          aria-disabled={isNavigatingMobileGames}
        >
          <motion.article
            whileHover={isNavigatingMobileGames ? undefined : { y: -4, scale: 1.012 }}
            className={`${cardBaseClass} ${mobileGamesCardClass} ${isNavigatingMobileGames ? "cursor-progress opacity-85" : "cursor-pointer"}`}
          >
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_34%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.22),transparent_58%)]" />
            <div className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_0_42px_rgba(34,211,238,0.16)]" />
            <div className={`${cardPanelClass} text-cyan-950`}>
              <div className="relative z-10 flex w-full flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/18 bg-white/12 text-white shadow-[0_14px_34px_rgba(34,211,238,0.14)]">
                  <Gamepad2 className="h-6 w-6" />
                </div>
                <div className="space-y-3">
                  <h2 className={`text-[1.85rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
                    Mobilspil
                  </h2>
                  <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-white/70 uppercase">
                    Spil designet til elevernes telefoner.
                  </p>
                  <p className="mx-auto max-w-62 text-sm leading-6 text-white/84">
                    Vælg mobile spilformater, og start en klasseaktivitet med klare roller, tempo og fælles opsamling.
                  </p>
                </div>
              </div>
            </div>
          </motion.article>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => {
            if (isNavigatingTeacherTools) return;
            setIsNavigatingTeacherTools(true);
            void router.push("/dashboard/laerervaerktoejer");
          }}
          className="flex h-full w-full flex-col justify-center text-left"
          aria-busy={isNavigatingTeacherTools}
          aria-disabled={isNavigatingTeacherTools}
        >
          <motion.article
            whileHover={isNavigatingTeacherTools ? undefined : { y: -4, scale: 1.012 }}
            className={`${cardBaseClass} ${teacherToolsCardClass} ${isNavigatingTeacherTools ? "cursor-progress opacity-85" : "cursor-pointer"}`}
          >
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_34%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.2),transparent_58%)]" />
            <div className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_0_42px_rgba(99,102,241,0.14)]" />
            <div className={`${cardPanelClass} text-indigo-950`}>
              <div className="relative z-10 flex w-full flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/18 bg-white/12 text-white shadow-[0_14px_34px_rgba(99,102,241,0.14)]">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="space-y-3">
                  <h2 className={`text-[1.85rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)] ${rubik.className}`}>
                    Lærerværktøjer
                  </h2>
                  <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-white/70 uppercase">
                    PLANLÆGNING OG AI-HJÆLP
                  </p>
                  <p className="mx-auto max-w-62 text-sm leading-6 text-white/84">
                    Find værktøjer, der hjælper dig med planlægning, årsplaner og undervisningsidéer.
                  </p>
                </div>
              </div>
            </div>
          </motion.article>
        </motion.button>
      </section>

      <section className="mx-auto mt-7 w-full max-w-4xl">
        <PwaInstallTip />
      </section>

      <footer className="mx-auto mt-auto w-full max-w-5xl pt-10 text-center">
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
