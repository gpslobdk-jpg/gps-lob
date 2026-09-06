"use client";

import { motion } from "framer-motion";
import { Archive, BookOpen, ExternalLink, Gamepad2, MapPin, PlayCircle, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { poppins } from "@/lib/fonts";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import HeroBanner from "@/components/brand/HeroBanner";
import MascotMessage from "@/components/brand/MascotMessage";
import QuickActionCard from "@/components/brand/QuickActionCard";
import PwaInstallTip from "@/components/PwaInstallTip";
import MobileInSchoolBanner from "@/components/MobileInSchoolBanner";
import { DASHBOARD_QUICK_GUIDE_EVENT } from "@/components/DashboardQuickGuide";
import { readStoredActiveParticipant } from "@/components/play/playUtils";
import { createClient } from "@/utils/supabase/client";

const SKOLEGPS_FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/1649785632764130";

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
  };

  const handleRetryDashboardLoad = () => {
    setDashboardRetryKey((current) => current + 1);
  };

  const liveCardDescription = useMemo(() => {
    if (isParticipantResume) return "Tilbage til din post.";
    return "Åbn livekort og svarflow.";
  }, [isParticipantResume]);

  if (isCheckingLiveSession) {
    return (
      <div
        className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--skolegps-muted-bg)] px-6 py-12 text-slate-950 ${poppins.className}`}
      >
        <div className="relative w-full max-w-6xl">
          <div className="rounded-[1.75rem] border border-sky-100 bg-white/82 p-6 shadow-[0_24px_70px_rgba(7,26,58,0.12)] backdrop-blur animate-pulse sm:p-8">
            <div className="flex flex-col gap-8">
              <div className="space-y-4">
                <div className="h-5 w-28 rounded-full bg-sky-100" />
                <div className="h-12 max-w-md rounded-2xl bg-sky-100" />
                <div className="h-4 max-w-xl rounded-full bg-slate-100" />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="h-40 rounded-2xl bg-white" />
                <div className="h-40 rounded-2xl bg-white" />
                <div className="h-40 rounded-2xl bg-white" />
                <div className="h-40 rounded-2xl bg-white" />
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
        className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--skolegps-muted-bg)] px-6 py-12 text-slate-950 ${poppins.className}`}
      >
        <div className="relative w-full max-w-xl rounded-[1.75rem] border border-sky-100 bg-white p-8 text-center shadow-[0_24px_70px_rgba(7,26,58,0.13)] sm:p-10">
          <MascotMessage message="Prøv igen, så henter vi arkivet." title="Dashboard" />
          <h1 className="mt-6 text-3xl font-black text-[var(--skolegps-deep-navy)]">
            {"Vi kunne ikke hente dine l\u00f8b"}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            {"Pr\u00f8v igen, s\u00e5 henter vi dem igen for dig."}
          </p>
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleRetryDashboardLoad}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-6 py-3 text-sm font-black text-white transition hover:bg-sky-700"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {"Pr\u00f8v igen"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex min-h-screen flex-col bg-[var(--skolegps-muted-bg)] px-5 pb-8 pt-6 text-slate-950 md:px-8 md:pb-10 lg:px-10 ${poppins.className}`}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(34,164,71,0.12),transparent_28%),linear-gradient(180deg,#f4fbff_0%,#eef9ef_100%)]" />

      <section className="mx-auto w-full max-w-6xl">
        <HeroBanner
          compact
          eyebrow="Lærer-dashboard"
          icon={MapPin}
          mascot="wave"
          title="Hvad vil du lave?"
          subtitle="Opret et løb, fortsæt hvor du slap, eller find dine forløb."
          actions={
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(DASHBOARD_QUICK_GUIDE_EVENT))}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-sky-200 bg-white/82 px-4 py-2 text-sm font-bold text-[var(--skolegps-deep-navy)] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              Ny her? Vis den korte guide
            </button>
          }
        />
      </section>

      <section className="mx-auto mt-6 w-full max-w-4xl">
        <MobileInSchoolBanner variant="dashboard" />
      </section>

      {/* Primary action: opret et løb er dashboardets ene tydelige hovedhandling */}
      <section className="mx-auto mt-8 w-full max-w-6xl">
        <motion.button
          type="button"
          aria-label="Opret et løb"
          onClick={() => {
            if (isNavigatingCreate) return;
            setIsNavigatingCreate(true);
            void router.push("/dashboard/opret/valg");
          }}
          data-tour="dashboard-create-run"
          className="block w-full text-left"
          aria-busy={isNavigatingCreate}
          aria-disabled={isNavigatingCreate}
        >
          <motion.div whileHover={isNavigatingCreate ? undefined : { y: -3, scale: 1.006 }}>
            <QuickActionCard
              className="min-h-44 border-green-200"
              cta={isNavigatingCreate ? "Åbner..." : "Start"}
              description="Byg rute, poster og spørgsmål."
              eyebrow="Kom i gang"
              icon={MapPin}
              isBusy={isNavigatingCreate}
              title={isNavigatingCreate ? "Gør klar til nyt løb" : "Opret et løb"}
              tone="green"
            />
          </motion.div>
        </motion.button>
      </section>

      {/* Dynamisk handling: vises kun når læreren faktisk har et aktivt løb */}
      {hasResumeTarget ? (
        <section className="mx-auto mt-5 w-full max-w-6xl">
          <motion.button
            type="button"
            aria-label={isParticipantResume ? "Fortsæt dit løb" : "Fortsæt løbet"}
            onClick={handleLiveMonitoringClick}
            className="block w-full text-left"
          >
            <motion.div whileHover={{ y: -3, scale: 1.006 }}>
              <QuickActionCard
                cta="Åbn"
                description={liveCardDescription}
                eyebrow="Aktivt løb"
                icon={PlayCircle}
                title={isParticipantResume ? "Fortsæt dit løb" : "Fortsæt løbet"}
                tone="yellow"
              />
            </motion.div>
          </motion.button>
        </section>
      ) : null}

      {/* Sekundære, men tydelige handlinger */}
      <section className="mx-auto mt-5 grid w-full max-w-6xl grid-cols-1 gap-5 md:grid-cols-3">
        <motion.button
          type="button"
          aria-label="Mine løb"
          onClick={() => {
            if (isNavigatingArchive) return;
            setIsNavigatingArchive(true);
            void router.push("/dashboard/arkiv");
          }}
          className="flex h-full w-full flex-col justify-center text-left"
          aria-busy={isNavigatingArchive}
          aria-disabled={isNavigatingArchive}
        >
          <motion.div whileHover={isNavigatingArchive ? undefined : { y: -3, scale: 1.006 }}>
            <QuickActionCard
              cta={isNavigatingArchive ? "Åbner..." : "Find"}
              description="Find, genbrug og start forløb."
              icon={Archive}
              isBusy={isNavigatingArchive}
              title="Arkiv"
              tone="blue"
            />
          </motion.div>
        </motion.button>

        <motion.button
          type="button"
          aria-label="Lærerværktøjer"
          onClick={() => {
            if (isNavigatingTeacherTools) return;
            setIsNavigatingTeacherTools(true);
            void router.push("/dashboard/laerervaerktoejer");
          }}
          className="flex h-full w-full flex-col justify-center text-left"
          aria-busy={isNavigatingTeacherTools}
          aria-disabled={isNavigatingTeacherTools}
        >
          <motion.div whileHover={isNavigatingTeacherTools ? undefined : { y: -3, scale: 1.006 }}>
            <QuickActionCard
              cta={isNavigatingTeacherTools ? "Åbner..." : "Åbn"}
              description="Planlægning, årsplan og AI-hjælp."
              icon={BookOpen}
              isBusy={isNavigatingTeacherTools}
              title="Lærerværktøjer"
              tone="navy"
            />
          </motion.div>
        </motion.button>

        <motion.button
          type="button"
          aria-label="Mobilspil"
          onClick={() => {
            if (isNavigatingMobileGames) return;
            setIsNavigatingMobileGames(true);
            void router.push("/dashboard/mobilspil");
          }}
          className="flex w-full items-center justify-center text-left"
          aria-busy={isNavigatingMobileGames}
          aria-disabled={isNavigatingMobileGames}
        >
          <motion.div whileHover={isNavigatingMobileGames ? undefined : { y: -3, scale: 1.006 }}>
            <QuickActionCard
              cta={isNavigatingMobileGames ? "Åbner..." : "Åbn"}
              description="Spil til elevernes telefoner."
              icon={Gamepad2}
              isBusy={isNavigatingMobileGames}
              title="Mobilspil"
              tone="sand"
            />
          </motion.div>
        </motion.button>
      </section>

      <section className="mx-auto mt-7 w-full max-w-6xl">
        <Link
          href={SKOLEGPS_FACEBOOK_GROUP_URL}
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col gap-3 rounded-2xl border border-green-100 bg-white/82 px-5 py-4 text-left text-slate-950 shadow-[0_14px_36px_rgba(7,26,58,0.08)] backdrop-blur transition hover:border-green-200 hover:bg-white sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-600 text-white">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase text-green-700">
                SkoleGPS-gruppen
              </span>
              <span className="mt-1 block text-sm font-semibold leading-6 text-slate-700">
                Få nyheder, del viden og ønsk nye funktioner.
              </span>
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition group-hover:border-green-200 group-hover:bg-green-50 sm:self-center">
            Åbn gruppe
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </Link>
      </section>

      <section className="mx-auto mt-5 w-full max-w-6xl">
        <PwaInstallTip />
      </section>

      <footer className="mx-auto mt-auto w-full max-w-5xl pt-10 text-center">
        <div className="flex flex-wrap justify-center gap-6 text-sm font-semibold text-slate-500">
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
