"use client";

import type { LucideIcon } from "lucide-react";
import { Archive, BookOpen, Gamepad2, MapPin, PlayCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DASHBOARD_QUICK_GUIDE_EVENT } from "@/components/DashboardQuickGuide";
import MobileInSchoolBanner from "@/components/MobileInSchoolBanner";
import Mascot from "@/components/brand/Mascot";
import MascotMessage from "@/components/brand/MascotMessage";
import PwaInstallTip from "@/components/PwaInstallTip";
import { readStoredActiveParticipant } from "@/components/play/playUtils";
import { poppins } from "@/lib/fonts";
import { createClient } from "@/utils/supabase/client";

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

type DashboardChoiceProps = {
  description: string;
  icon: LucideIcon;
  isBusy: boolean;
  onClick: () => void;
  title: string;
};

function DashboardChoice({ description, icon: Icon, isBusy, onClick, title }: DashboardChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isBusy}
      className="group flex min-h-32 w-full items-center gap-4 rounded-2xl border border-sky-100 bg-white p-5 text-left shadow-[0_14px_36px_rgba(7,26,58,0.08)] transition hover:border-sky-300 hover:shadow-[0_18px_42px_rgba(7,26,58,0.13)] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500"
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 transition group-hover:bg-sky-100">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black text-[var(--skolegps-deep-navy)]">{title}</span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-slate-600">{description}</span>
      </span>
      <span className="shrink-0 text-sm font-black text-sky-800">{isBusy ? "Åbner..." : "Åbn"}</span>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [resumeTarget, setResumeTarget] = useState<ResumeTarget | null>(null);
  const [isCheckingLiveSession, setIsCheckingLiveSession] = useState(true);
  const [runCountError, setRunCountError] = useState(false);
  const [dashboardRetryKey, setDashboardRetryKey] = useState(0);
  const [isNavigatingCreate, setIsNavigatingCreate] = useState(false);
  const [isNavigatingArchive, setIsNavigatingArchive] = useState(false);
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
          if (userError) console.error("Kunne ikke hente bruger:", userError);
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
            // The soft-removal migration is released before this client code.
            // A removed identity must never be offered a stale dashboard resume.
            .is("removed_at", null)
            .maybeSingle();

          if (participantError) console.error("Kunne ikke tjekke aktiv deltagerstatus:", participantError);
          const activeParticipant = (participantData as ParticipantResumeRow | null) ?? null;
          if (activeParticipant?.session_id) {
            if (isMounted) setResumeTarget({ kind: "participant", sessionId: activeParticipant.session_id });
            return;
          }
        }

        const [{ data, error }, { count: runCount, error: runsError }] = await Promise.all([
          supabase
            .from("live_sessions")
            .select("id")
            .eq("teacher_id", user.id)
            .in("status", ["waiting", "running"])
            .order("created_at", { ascending: false })
            .limit(1),
          supabase.from("gps_runs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        ]);

        if (runsError) {
          console.error("Kunne ikke tjekke antal gemte løb:", runsError);
          if (isMounted) {
            setRunCountError(true);
            setResumeTarget(null);
          }
          return;
        }

        if (runCount === 0) {
          if (isMounted) setResumeTarget(null);
          return;
        }

        if (error) {
          console.error("Kunne ikke tjekke aktiv live-session:", error);
          if (isMounted) setResumeTarget(null);
          return;
        }

        const active = (data as ActiveSessionRow[] | null)?.[0] ?? null;
        if (isMounted) setResumeTarget(active?.id ? { kind: "teacher", sessionId: active.id } : null);
      } catch (error) {
        console.error("Dashboardet kunne ikke indlæses:", error);
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
  const liveCardDescription = useMemo(
    () => (isParticipantResume ? "Tilbage til din post." : "Åbn livekort og svarflow."),
    [isParticipantResume]
  );

  const handleLiveMonitoringClick = () => {
    if (isCheckingLiveSession || !resumeTarget?.sessionId) return;
    setIsNavigatingLive(true);
    void router.push(
      resumeTarget.kind === "participant"
        ? `/play/${resumeTarget.sessionId}`
        : `/dashboard/live/${resumeTarget.sessionId}`
    );
  };

  if (isCheckingLiveSession) {
    return (
      <main className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--skolegps-muted-bg)] px-6 py-12 text-slate-950 ${poppins.className}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(14,165,233,0.13),transparent_30%),radial-gradient(circle_at_84%_88%,rgba(34,164,71,0.11),transparent_28%)]" />
        <section className="relative w-full max-w-sm text-center" role="status">
          <Mascot variant="guide" size="lg" className="mx-auto" />
          <div className="mt-5 rounded-[1.75rem] border border-sky-100 bg-white px-6 py-7 shadow-[0_20px_56px_rgba(7,26,58,0.12)]">
            <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Pilen finder vej</p>
            <p className="mt-3 text-xl font-black text-[var(--skolegps-deep-navy)]">Henter dit dashboard</p>
          </div>
        </section>
      </main>
    );
  }

  if (runCountError) {
    return (
      <main className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--skolegps-muted-bg)] px-6 py-12 text-slate-950 ${poppins.className}`}>
        <div className="w-full max-w-xl rounded-[1.75rem] border border-sky-100 bg-white p-8 text-center shadow-[0_24px_70px_rgba(7,26,58,0.13)] sm:p-10">
          <MascotMessage message="Prøv igen, så henter vi arkivet." title="Dashboard" />
          <h1 className="mt-6 text-3xl font-black text-[var(--skolegps-deep-navy)]">Vi kunne ikke hente dine løb</h1>
          <button type="button" onClick={() => setDashboardRetryKey((current) => current + 1)} className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-6 py-3 text-sm font-black text-white transition hover:bg-sky-700">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />Prøv igen
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={`relative min-h-screen bg-[var(--skolegps-muted-bg)] px-5 py-7 text-slate-950 sm:px-6 lg:px-8 ${poppins.className}`}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(14,165,233,0.13),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(34,164,71,0.1),transparent_28%)]" />
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Lærer-dashboard</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-4xl">Hvad vil du lave?</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600 sm:text-base">Start et nyt løb eller find det, du skal bruge.</p>
          </div>
          <button type="button" onClick={() => window.dispatchEvent(new Event(DASHBOARD_QUICK_GUIDE_EVENT))} className="min-h-11 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500">Kort guide</button>
        </header>

        <section className="mt-7">
          <button type="button" aria-label="Opret et løb" data-tour="dashboard-create-run" aria-busy={isNavigatingCreate} disabled={isNavigatingCreate} onClick={() => { if (isNavigatingCreate) return; setIsNavigatingCreate(true); void router.push("/dashboard/opret/valg"); }} className="group flex w-full items-center gap-5 rounded-[1.5rem] border border-green-200 bg-white p-6 text-left shadow-[0_18px_48px_rgba(7,26,58,0.11)] transition hover:border-green-300 hover:shadow-[0_22px_54px_rgba(34,164,71,0.15)] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-green-500 sm:p-7">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-600 text-white shadow-[0_12px_24px_rgba(34,164,71,0.22)]"><MapPin className="h-7 w-7" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-2xl font-black text-[var(--skolegps-deep-navy)]">Opret et løb</span><span className="mt-1 block text-sm font-semibold text-slate-600">Byg rute, poster og spørgsmål.</span></span>
            <span className="shrink-0 rounded-full bg-green-600 px-5 py-2.5 text-sm font-black text-white">{isNavigatingCreate ? "Åbner..." : "Start"}</span>
          </button>
        </section>

        {hasResumeTarget ? (
          <section className="mt-4">
            <button type="button" onClick={handleLiveMonitoringClick} className="flex w-full items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left transition hover:bg-amber-100 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-amber-500">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><PlayCircle className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block font-black text-amber-950">{isParticipantResume ? "Fortsæt dit løb" : "Fortsæt løbet"}</span><span className="mt-0.5 block text-sm font-semibold text-amber-900">{liveCardDescription}</span></span><span className="text-sm font-black text-amber-950">Åbn</span>
            </button>
          </section>
        ) : null}

        <section className="mt-4 grid gap-4 md:grid-cols-2" aria-label="Flere muligheder">
          <DashboardChoice title="Mine løb" description="Find, genbrug og start et tidligere forløb." icon={Archive} isBusy={isNavigatingArchive} onClick={() => { if (isNavigatingArchive) return; setIsNavigatingArchive(true); void router.push("/dashboard/arkiv"); }} />
          <DashboardChoice title="Lærerværktøjer" description="Planlægning, materialer og aktiviteter til klassen." icon={BookOpen} isBusy={isNavigatingTeacherTools} onClick={() => { if (isNavigatingTeacherTools) return; setIsNavigatingTeacherTools(true); void router.push("/dashboard/laerervaerktoejer"); }} />
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-600">Leder du efter spil til elevernes telefoner?</p>
          <Link href="/dashboard/mobilspil" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-black text-sky-800 transition hover:bg-sky-100"><Gamepad2 className="h-4 w-4" aria-hidden="true" />Mobilspil</Link>
        </div>

        <section className="mt-4"><MobileInSchoolBanner variant="dashboard" /></section>
        <section className="mt-4"><PwaInstallTip /></section>

        <footer className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3 pb-2 text-sm font-semibold text-slate-500">
          <Link href="/dashboard/indstillinger" className="transition hover:text-slate-700">Indstillinger</Link><Link href="/privacy" className="transition hover:text-slate-700">Privatliv</Link><Link href="/teknologi" className="transition hover:text-slate-700">Udviklerinfo</Link>
        </footer>
      </div>
    </main>
  );
}
