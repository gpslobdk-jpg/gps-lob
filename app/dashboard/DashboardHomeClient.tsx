"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  FileText,
  Lightbulb,
  MapPin,
  PlayCircle,
  Presentation,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DASHBOARD_QUICK_GUIDE_EVENT,
  DASHBOARD_QUICK_GUIDE_VISIBILITY_EVENT,
} from "@/components/DashboardQuickGuide";
import Mascot from "@/components/brand/Mascot";
import MascotMessage from "@/components/brand/MascotMessage";
import { TeacherToolCard } from "@/components/dashboard/TeacherToolCard";
import { TeacherToolsModal } from "@/components/dashboard/TeacherToolsModal";
import { readStoredActiveParticipant } from "@/components/play/playUtils";
import { poppins } from "@/lib/fonts";
import { TEACHER_TOOL_FACEBOOK_GROUP_LINK } from "@/lib/teacherTools/community";
import {
  markCommunityInviteAlreadyMember,
  shouldAutoShowCommunityInvite,
  snoozeCommunityInvite,
} from "@/lib/teacherTools/communityPreference";
import {
  type ActiveTeacherTool,
  type TeacherTool,
  type TeacherToolId,
} from "@/lib/teacherTools/registry";
import { createClient } from "@/utils/supabase/client";

type ActiveSessionRow = {
  id: string;
};

type ParticipantResumeRow = {
  finished_at: string | null;
  id: string;
  session_id: string;
};

type ResumeTarget = {
  kind: "participant" | "teacher";
  sessionId: string;
};

type RecentToolEntry = {
  id: TeacherToolId;
  openedAt: number;
};

type DashboardHomeClientProps = {
  tools: readonly TeacherTool[];
};

const RECENT_TOOLS_STORAGE_PREFIX = "skolegps.teacher-tools.recent.v1";
const MAX_RECENT_TOOLS = 3;

function getRecentToolsStorageKey(userId: string) {
  return `${RECENT_TOOLS_STORAGE_PREFIX}.${userId}`;
}

function isRecentToolEntry(value: unknown): value is RecentToolEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<RecentToolEntry>;
  return typeof entry.id === "string" && typeof entry.openedAt === "number" && Number.isFinite(entry.openedAt);
}

function readRecentTools(userId: string) {
  try {
    const stored = window.localStorage.getItem(getRecentToolsStorageKey(userId));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentToolEntry).slice(0, MAX_RECENT_TOOLS);
  } catch {
    return [];
  }
}

function getTeacherDisplayName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const source = metadata as Record<string, unknown>;
  const candidate = [source.full_name, source.name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  if (!candidate) return null;

  const firstName = candidate.trim().split(/\s+/)[0];
  return firstName ? firstName.slice(0, 80) : null;
}

function TeacherToolLink({
  children,
  className,
  onNavigate,
  tool,
}: {
  children: ReactNode;
  className: string;
  onNavigate?: () => void;
  tool: ActiveTeacherTool;
}) {
  if (tool.link.kind === "internal") {
    return (
      <Link className={className} href={tool.link.href} onClick={onNavigate}>
        {children}
      </Link>
    );
  }

  return (
    <a
      className={className}
      href={tool.link.href}
      onClick={onNavigate}
      rel={tool.link.target === "_blank" ? "noopener noreferrer" : undefined}
      target={tool.link.target}
    >
      {children}
    </a>
  );
}

function QuickAction({
  description,
  icon: Icon,
  onNavigate,
  tool,
}: {
  description: string;
  icon: LucideIcon;
  onNavigate: () => void;
  tool: ActiveTeacherTool;
}) {
  return (
    <TeacherToolLink
      className="group flex min-h-22 items-center gap-3 rounded-2xl border border-sky-100 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(25,83,129,0.06)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_16px_34px_rgba(25,83,129,0.11)]"
      onNavigate={onNavigate}
      tool={tool}
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[var(--skolegps-deep-navy)]">{tool.cta}</span>
        <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-600">{description}</span>
      </span>
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-700 transition group-hover:translate-x-0.5" />
    </TeacherToolLink>
  );
}

function RecentToolLink({
  onNavigate,
  tool,
}: {
  onNavigate: () => void;
  tool: ActiveTeacherTool;
}) {
  return (
    <TeacherToolLink
      className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-sky-50"
      onNavigate={onNavigate}
      tool={tool}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-xs font-black text-sky-700">
        {tool.title.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-[var(--skolegps-deep-navy)]">{tool.title}</span>
        <span className="block text-xs font-medium text-slate-500">Åbnet på denne enhed</span>
      </span>
      <ArrowRight aria-hidden="true" className="h-4 w-4 text-sky-700 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
    </TeacherToolLink>
  );
}

export default function DashboardHomeClient({ tools }: DashboardHomeClientProps) {
  const router = useRouter();
  const [resumeTarget, setResumeTarget] = useState<ResumeTarget | null>(null);
  const [isCheckingLiveSession, setIsCheckingLiveSession] = useState(true);
  const [runCountError, setRunCountError] = useState(false);
  const [dashboardRetryKey, setDashboardRetryKey] = useState(0);
  const [isNavigatingCreate, setIsNavigatingCreate] = useState(false);
  const [isNavigatingLive, setIsNavigatingLive] = useState(false);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [recentTools, setRecentTools] = useState<RecentToolEntry[]>([]);
  const [toolSearch, setToolSearch] = useState("");
  const [shouldAutoOpenCommunityInvite, setShouldAutoOpenCommunityInvite] = useState(false);

  const activeTools = useMemo(
    () => tools.filter((tool): tool is ActiveTeacherTool => tool.status === "active"),
    [tools],
  );
  const toolById = useMemo(() => new Map(activeTools.map((tool) => [tool.id, tool])), [activeTools]);
  const recentToolEntries = useMemo(
    () => recentTools.flatMap((entry) => {
      const tool = toolById.get(entry.id);
      return tool ? [{ entry, tool }] : [];
    }),
    [recentTools, toolById],
  );
  const searchResults = useMemo(() => {
    const query = toolSearch.trim().toLocaleLowerCase("da-DK");
    if (!query) return [];
    return activeTools.filter((tool) =>
      `${tool.title} ${tool.description}`.toLocaleLowerCase("da-DK").includes(query),
    );
  }, [activeTools, toolSearch]);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const fetchDashboard = async () => {
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
          if (isMounted) {
            setResumeTarget(null);
            setTeacherId(null);
            setTeacherName(null);
            setRecentTools([]);
            setShouldAutoOpenCommunityInvite(false);
          }
          return;
        }

        if (isMounted) {
          setTeacherId(user.id);
          setTeacherName(getTeacherDisplayName(user.user_metadata));
          setRecentTools(readRecentTools(user.id));
        }

        const storedParticipant = readStoredActiveParticipant();
        if (storedParticipant?.participantId) {
          const { data: participantData, error: participantError } = await supabase
            .from("participants")
            .select("id,session_id,finished_at")
            .eq("id", storedParticipant.participantId)
            .is("finished_at", null)
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

    void fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, [dashboardRetryKey]);

  useEffect(() => {
    const syncQuickGuideVisibility = (event?: Event) => {
      const isActive = event instanceof CustomEvent && typeof event.detail === "boolean"
        ? event.detail
        : document.documentElement.dataset.dashboardQuickGuide === "active";
      if (isActive) setShouldAutoOpenCommunityInvite(false);
    };

    syncQuickGuideVisibility();
    window.addEventListener(DASHBOARD_QUICK_GUIDE_VISIBILITY_EVENT, syncQuickGuideVisibility);
    return () => window.removeEventListener(DASHBOARD_QUICK_GUIDE_VISIBILITY_EVENT, syncQuickGuideVisibility);
  }, []);

  useEffect(() => {
    if (
      isCheckingLiveSession ||
      !teacherId ||
      resumeTarget !== null ||
      document.documentElement.dataset.dashboardQuickGuide === "active"
    ) {
      setShouldAutoOpenCommunityInvite(false);
      return;
    }

    setShouldAutoOpenCommunityInvite(shouldAutoShowCommunityInvite(teacherId));
  }, [isCheckingLiveSession, resumeTarget, teacherId]);

  const recordToolOpen = (toolId: TeacherToolId) => {
    if (!teacherId) return;
    const openedAt = Date.now();
    setRecentTools((current) => {
      const next = [{ id: toolId, openedAt }, ...current.filter((entry) => entry.id !== toolId)].slice(0, MAX_RECENT_TOOLS);
      try {
        window.localStorage.setItem(getRecentToolsStorageKey(teacherId), JSON.stringify(next));
      } catch {
        // Local history is a convenience only; a storage error must never block a tool link.
      }
      return next;
    });
  };

  const handleCommunityInviteSnooze = () => {
    if (teacherId) snoozeCommunityInvite(teacherId);
    setShouldAutoOpenCommunityInvite(false);
  };

  const handleCommunityInviteAlreadyMember = () => {
    if (teacherId) markCommunityInviteAlreadyMember(teacherId);
    setShouldAutoOpenCommunityInvite(false);
  };

  const hasResumeTarget = Boolean(resumeTarget?.sessionId);
  const isParticipantResume = resumeTarget?.kind === "participant";
  const liveCardDescription = isParticipantResume ? "Tilbage til din post." : "Åbn livekort og svarflow.";
  const dagensTavle = activeTools.find((tool) => tool.id === "dagens-tavle");
  const printMit = activeTools.find((tool) => tool.id === "printmit-arbejdsark");
  const gpsLob = activeTools.find((tool) => tool.id === "gps-lob");

  const handleLiveMonitoringClick = () => {
    if (isCheckingLiveSession || !resumeTarget?.sessionId) return;
    setIsNavigatingLive(true);
    void router.push(
      resumeTarget.kind === "participant"
        ? `/play/${resumeTarget.sessionId}`
        : `/dashboard/live/${resumeTarget.sessionId}`,
    );
  };

  if (isCheckingLiveSession) {
    return (
      <main className={`skolegps-teacher-portal relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 text-slate-950 ${poppins.className}`}>
        <section className="relative w-full max-w-sm text-center" role="status">
          <Mascot variant="guide" size="lg" className="mx-auto" />
          <div className="skolegps-teacher-surface mt-5 rounded-[1.75rem] px-6 py-7">
            <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Pilen finder vej</p>
            <p className="mt-3 text-xl font-black text-[var(--skolegps-deep-navy)]">Henter dit dashboard</p>
          </div>
        </section>
      </main>
    );
  }

  if (runCountError) {
    return (
      <main className={`skolegps-teacher-portal relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 text-slate-950 ${poppins.className}`}>
        <div className="skolegps-teacher-surface w-full max-w-xl rounded-[1.75rem] p-8 text-center sm:p-10">
          <MascotMessage message="Prøv igen, så henter vi arkivet." title="Dashboard" />
          <h1 className="mt-6 text-3xl font-black text-[var(--skolegps-deep-navy)]">Vi kunne ikke hente dine løb</h1>
          <button type="button" onClick={() => setDashboardRetryKey((current) => current + 1)} className="skolegps-teacher-primary-action mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black transition">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Prøv igen
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={`skolegps-teacher-portal min-h-screen px-4 py-5 text-slate-950 sm:px-6 sm:py-7 lg:px-8 ${poppins.className}`}>
      <div className="mx-auto w-full max-w-[90rem]">
        <header className="skolegps-teacher-portal-hero relative overflow-hidden rounded-3xl border border-white/80 px-5 py-7 shadow-[0_18px_42px_rgba(25,83,129,0.09)] sm:px-8 sm:py-9">
          <Mascot variant="wave" size="sm" className="absolute right-5 bottom-4 hidden drop-shadow-lg sm:block" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">Lærerens forside</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-4xl">
              {teacherName ? `Goddag, ${teacherName}` : "Goddag"}
            </h1>
            <p className="mt-2 max-w-2xl text-base font-medium leading-7 text-slate-700 sm:text-lg">
              Her finder du de værktøjer, du bruger i undervisningen.
            </p>
          </div>
          <div className="relative mt-6 max-w-xl">
            <label className="sr-only" htmlFor="teacher-tool-search">Søg blandt SkoleGPS-værktøjer</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-700" />
              <input
                autoComplete="off"
                className="min-h-12 w-full rounded-2xl border border-sky-200 bg-white/94 py-3 pr-4 pl-11 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                id="teacher-tool-search"
                onChange={(event) => setToolSearch(event.target.value)}
                placeholder="Søg blandt værktøjerne"
                type="search"
                value={toolSearch}
              />
              {toolSearch ? (
                <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-sky-100 bg-white p-2 shadow-[0_18px_40px_rgba(25,83,129,0.16)]">
                  {searchResults.length > 0 ? (
                    <ul aria-label="Søgeresultater" className="grid gap-1">
                      {searchResults.map((tool) => (
                        <li key={tool.id}>
                          <TeacherToolLink
                            className="block rounded-xl px-3 py-3 transition hover:bg-sky-50"
                            onNavigate={() => recordToolOpen(tool.id)}
                            tool={tool}
                          >
                            <span className="block text-sm font-black text-[var(--skolegps-deep-navy)]">{tool.title}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-slate-600">{tool.description}</span>
                          </TeacherToolLink>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="px-3 py-3 text-sm font-medium text-slate-600">Vi fandt ikke et værktøj med det navn.</p>}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section aria-label="Hurtigvalg" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {hasResumeTarget ? (
            <button
              type="button"
              onClick={handleLiveMonitoringClick}
              disabled={isNavigatingLive}
              className="group flex min-h-22 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left shadow-[0_8px_24px_rgba(25,83,129,0.06)] transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white"><PlayCircle className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-black text-emerald-950">{isParticipantResume ? "Fortsæt dit løb" : "Fortsæt løbet"}</span><span className="mt-0.5 block text-xs font-semibold leading-5 text-emerald-900">{liveCardDescription}</span></span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-800" />
            </button>
          ) : null}
          {gpsLob ? (
            <button
              type="button"
              aria-label="Opret et løb"
              data-tour="dashboard-create-run"
              aria-busy={isNavigatingCreate}
              disabled={isNavigatingCreate}
              onClick={() => {
                if (isNavigatingCreate) return;
                recordToolOpen(gpsLob.id);
                setIsNavigatingCreate(true);
                void router.push("/dashboard/opret/valg");
              }}
              className="skolegps-teacher-primary-action group flex min-h-22 items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/18"><MapPin className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-black">Lav nyt GPS-løb</span><span className="mt-0.5 block text-xs font-semibold leading-5 text-white/88">Byg rute, poster og spørgsmål.</span></span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </button>
          ) : null}
          {dagensTavle ? <QuickAction description="Vis dagens program på tavlen." icon={Presentation} onNavigate={() => recordToolOpen(dagensTavle.id)} tool={dagensTavle} /> : null}
          {printMit ? <QuickAction description="Lav et arbejdsark klar til print." icon={FileText} onNavigate={() => recordToolOpen(printMit.id)} tool={printMit} /> : null}
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="skolegps-teacher-surface rounded-3xl p-4 sm:p-6" aria-labelledby="your-tools-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-sky-800 uppercase">Værktøjer</p>
                <h2 id="your-tools-heading" className="mt-1 text-2xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">Dine værktøjer</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">Åbn det, du skal bruge lige nu.</p>
              </div>
              <TeacherToolsModal
                communityInvite={{
                  autoOpen: shouldAutoOpenCommunityInvite,
                  onAlreadyMember: handleCommunityInviteAlreadyMember,
                  onSnooze: handleCommunityInviteSnooze,
                }}
                description="Åbn et værktøj, når det passer til din undervisning."
                onToolNavigate={(tool) => recordToolOpen(tool.id)}
                title="Opdag flere værktøjer i SkoleGPS"
                tools={tools}
              />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {tools.map((tool, index) => (
                <TeacherToolCard key={tool.id} onNavigate={tool.status === "active" ? () => recordToolOpen(tool.id) : undefined} priority={index === 0} tool={tool} />
              ))}
            </div>
          </section>

          <aside className="grid content-start gap-4" aria-label="Dagens overblik">
            <section className="skolegps-teacher-surface rounded-3xl p-5" aria-labelledby="daily-tip-heading">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Lightbulb aria-hidden="true" className="h-5 w-5" /></span>
                <div><p className="text-xs font-black tracking-[0.16em] text-amber-700 uppercase">Dagens tip</p><h2 id="daily-tip-heading" className="text-lg font-black text-[var(--skolegps-deep-navy)]">Gør alle med</h2></div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">Lad makkerpar forklare ét nøglebegreb for hinanden, før I går videre.</p>
              <button type="button" onClick={() => window.dispatchEvent(new Event(DASHBOARD_QUICK_GUIDE_EVENT))} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-black text-sky-800 transition hover:text-sky-600"><BookOpen aria-hidden="true" className="h-4 w-4" />Hjælp</button>
            </section>

            <section className="skolegps-teacher-surface rounded-3xl p-5" aria-labelledby="today-heading">
              <div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><Clock3 aria-hidden="true" className="h-5 w-5" /></span><div><p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">I dag</p><h2 id="today-heading" className="text-lg font-black text-[var(--skolegps-deep-navy)]">Planlæg dagen</h2></div></div>
              <p className="mt-4 text-sm leading-6 text-slate-700">Din dagsplan vises i DagensTavle. Der er endnu ikke en delt datavej til dashboardet.</p>
              {dagensTavle ? <TeacherToolLink className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-black text-sky-800 transition hover:text-sky-600" onNavigate={() => recordToolOpen(dagensTavle.id)} tool={dagensTavle}>Åbn DagensTavle <ArrowRight aria-hidden="true" className="h-4 w-4" /></TeacherToolLink> : null}
            </section>

            <section className="skolegps-teacher-surface rounded-3xl p-5" aria-labelledby="recent-heading">
              <div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Clock3 aria-hidden="true" className="h-5 w-5" /></span><div><p className="text-xs font-black tracking-[0.16em] text-violet-700 uppercase">Senest åbnet</p><h2 id="recent-heading" className="text-lg font-black text-[var(--skolegps-deep-navy)]">På denne enhed</h2></div></div>
              {recentToolEntries.length > 0 ? <div className="mt-3 grid gap-1">{recentToolEntries.map(({ tool }) => <RecentToolLink key={tool.id} onNavigate={() => recordToolOpen(tool.id)} tool={tool} />)}</div> : <p className="mt-4 text-sm leading-6 text-slate-700">Når du åbner et værktøj, vises det her på denne enhed.</p>}
            </section>
          </aside>
        </div>

        <section className="mt-5 overflow-hidden rounded-3xl border border-sky-100 bg-[linear-gradient(120deg,#eff9ff,#f6fbff_58%,#eaf7f1)] px-5 py-5 shadow-[0_12px_32px_rgba(25,83,129,0.07)] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7" aria-labelledby="community-heading">
          <div className="flex items-start gap-4"><span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm"><UsersRound aria-hidden="true" className="h-6 w-6" /></span><div><h2 id="community-heading" className="text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">Bliv en del af fællesskabet</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">Få inspiration, opdag nye værktøjer og del idéer med andre undervisere.</p></div></div>
          <a className="skolegps-teacher-primary-action mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition hover:-translate-y-0.5 sm:mt-0" href={TEACHER_TOOL_FACEBOOK_GROUP_LINK.href} rel={TEACHER_TOOL_FACEBOOK_GROUP_LINK.rel} target={TEACHER_TOOL_FACEBOOK_GROUP_LINK.target}><UsersRound aria-hidden="true" className="h-4 w-4" />{TEACHER_TOOL_FACEBOOK_GROUP_LINK.label}</a>
        </section>
      </div>
    </main>
  );
}
