"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  ChevronLeft,
  Clock,
  Heart,
  RefreshCw,
  Target,
  TreePine,
  Users,
  Zap,
} from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";

const rubik = Rubik({ subsets: ["latin"], weight: ["700", "800", "900"] });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const AUTO_REFRESH_MS = 60_000;
const DISPLAY_TIME_ZONE = "Europe/Copenhagen";
const TIME_OPTIONS: { label: string; hours: number }[] = [
  { label: "1 time", hours: 1 },
  { label: "2 timer", hours: 2 },
  { label: "3 timer", hours: 3 },
  { label: "12 timer", hours: 12 },
  { label: "24 timer", hours: 24 },
];

const RACE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  manuel: { label: "Generel Quiz", icon: "🗺️" },
  dansk: { label: "Dansk", icon: "📖" },
  engelsk: { label: "Engelsk", icon: "🇬🇧" },
  matematik: { label: "Matematik", icon: "🧮" },
  foto: { label: "Foto", icon: "📸" },
  escape: { label: "Escape", icon: "🔐" },
  rollespil: { label: "Rollespil", icon: "🎭" },
  scanner: { label: "Scanner", icon: "📷" },
  zone_krig: { label: "Zone-Krigen", icon: "⚔️" },
  stratego: { label: "Stratego", icon: "🏰" },
  selfie: { label: "Selfie", icon: "🤳" },
  podcast: { label: "Podcast", icon: "🎙️" },
};

type RaceTypeCount = { race_type: string; count: number };

type HealthData = {
  activeSessions: number;
  liveStudents: number;
  runsCreated: number;
  stjerneloebCreated: number;
  correctAnswerRate: number | null;
  totalAnswersToday: number;
  raceTypes: RaceTypeCount[];
  generatedAt: string;
  hours: number;
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("da-DK", {
      timeZone: DISPLAY_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function HealthDashboardPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(
    async (selectedHours?: number) => {
      const h = selectedHours ?? hours;
      try {
        setRefreshing(true);
        const res = await fetch(`/api/admin/health?hours=${h}`, { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const payload: HealthData = await res.json();
        setData(payload);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukendt fejl");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hours]
  );

  useEffect(() => {
    fetchHealth();
    intervalRef.current = setInterval(() => fetchHealth(), AUTO_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchHealth]);

  function handleTimeFilter(h: number) {
    setHours(h);
    fetchHealth(h);
  }

  const overallStatus = !data
    ? "loading"
    : error
      ? "error"
      : "healthy";

  const statusConfig = {
    loading: { color: "bg-gray-400", pulse: true, text: "Indlæser …" },
    error: { color: "bg-amber-400", pulse: false, text: "Kan ikke hente data" },
    healthy: { color: "bg-emerald-400", pulse: true, text: "Alt kører fint" },
  }[overallStatus];

  return (
    <div className={`${poppins.className} min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950`}>
      {/* Decorative nature shapes */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 h-[30rem] w-[30rem] rounded-full bg-teal-500/5 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-green-500/3 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-emerald-200/80 backdrop-blur-sm transition hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </Link>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
                <TreePine className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h1 className={`${rubik.className} text-2xl font-bold text-white sm:text-3xl`}>
                  Systemets Sundhed
                </h1>
                <p className="text-sm text-emerald-200/60">
                  Overblik over aktivitet og sundhed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Status indicator */}
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
                <span className="relative flex h-3 w-3">
                  {statusConfig.pulse && (
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusConfig.color} opacity-75`}
                    />
                  )}
                  <span className={`relative inline-flex h-3 w-3 rounded-full ${statusConfig.color}`} />
                </span>
                <span className="text-sm font-medium text-white">{statusConfig.text}</span>
              </div>

              {/* Refresh button */}
              <button
                onClick={() => fetchHealth()}
                disabled={refreshing}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-emerald-300 backdrop-blur-sm transition hover:bg-white/10 disabled:opacity-50"
                title="Opdater nu"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Last updated */}
          {data?.generatedAt && (
            <p className="mt-2 text-right text-xs text-emerald-300/40">
              Sidst opdateret kl. {formatTime(data.generatedAt)} · auto-opdatering hvert minut
            </p>
          )}
        </header>

        {/* Loading state */}
        {loading && !data && (
          <div className="flex items-center justify-center py-32">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-400/60" />
          </div>
        )}

        {/* Error state */}
        {error && !data && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8 text-center backdrop-blur-md">
            <p className="text-lg font-semibold text-amber-200">Kunne ikke hente sundhedsdata</p>
            <p className="mt-2 text-sm text-amber-300/70">{error}</p>
            <button
              onClick={() => fetchHealth()}
              className="mt-4 rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/30"
            >
              Prøv igen
            </button>
          </div>
        )}

        {data && (
          <>
            {/* Top metric cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                icon={<Zap className="h-5 w-5" />}
                label="Løb oprettet"
                value={data.runsCreated + data.stjerneloebCreated}
                sublabel={`seneste ${data.hours === 1 ? "time" : `${data.hours} timer`}`}
                accent="emerald"
              />
              <MetricCard
                icon={<Users className="h-5 w-5" />}
                label="Elever aktive LIGE NU"
                value={data.liveStudents}
                sublabel="seneste 5 minutter"
                accent="teal"
                pulse
              />
              <MetricCard
                icon={<Activity className="h-5 w-5" />}
                label="Aktive sessioner"
                value={data.activeSessions}
                sublabel="kører lige nu"
                accent="green"
              />
            </div>

            {/* Time filter */}
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md">
                <Clock className="ml-2 h-4 w-4 text-emerald-300/60" />
                <span className="mr-1 text-sm text-emerald-200/60">Tidsfilter:</span>
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.hours}
                    onClick={() => handleTimeFilter(opt.hours)}
                    className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                      hours === opt.hours
                        ? "bg-emerald-500/20 text-emerald-200 shadow-lg shadow-emerald-500/10"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom stats section */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Correct answer rate */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
                    <Target className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h2 className={`${rubik.className} text-lg font-bold text-white`}>
                    Gennemsnitlig succesrate
                  </h2>
                </div>

                {data.correctAnswerRate !== null ? (
                  <div className="flex items-end gap-3">
                    <span className={`${rubik.className} text-5xl font-black text-emerald-300`}>
                      {data.correctAnswerRate}%
                    </span>
                    <span className="mb-2 text-sm text-emerald-200/50">
                      af {data.totalAnswersToday.toLocaleString("da-DK")} svar i dag
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-white/40">Ingen svar registreret i dag endnu.</p>
                )}

                {data.correctAnswerRate !== null && (
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                      style={{ width: `${Math.min(data.correctAnswerRate, 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Race types */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-400/20 bg-teal-500/10">
                    <BarChart3 className="h-5 w-5 text-teal-400" />
                  </div>
                  <h2 className={`${rubik.className} text-lg font-bold text-white`}>
                    Populære løbstyper i dag
                  </h2>
                </div>

                {data.raceTypes.length > 0 ? (
                  <div className="space-y-3">
                    {data.raceTypes.slice(0, 6).map((rt) => {
                      const info = RACE_TYPE_LABELS[rt.race_type] ?? {
                        label: rt.race_type,
                        icon: "📋",
                      };
                      const maxCount = data.raceTypes[0]?.count ?? 1;
                      const pct = Math.round((rt.count / maxCount) * 100);
                      return (
                        <div key={rt.race_type}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-2 text-sm text-white/80">
                              <span>{info.icon}</span>
                              <span>{info.label}</span>
                            </span>
                            <span className="text-sm font-semibold text-emerald-300">
                              {rt.count}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/40">
                    Ingen løb oprettet i dag endnu.
                  </p>
                )}
              </div>
            </div>

            {/* Stjerneløb breakdown */}
            {data.stjerneloebCreated > 0 && (
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="flex items-center gap-2 text-sm text-emerald-200/60">
                  <Heart className="h-4 w-4 text-emerald-400/60" />
                  <span>
                    Heraf <strong className="text-emerald-300">{data.stjerneloebCreated}</strong>{" "}
                    Stjerneløb (print) oprettet i perioden
                  </span>
                </div>
              </div>
            )}

            {/* Footer link to technical logs */}
            <footer className="mt-12 border-t border-white/5 pt-6 text-center">
              <Link
                href="/dashboard/admin/logs"
                className="inline-flex items-center gap-2 text-sm text-emerald-300/40 transition hover:text-emerald-300/70"
              >
                Se teknisk log (Kun for udviklere) →
              </Link>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Metric Card ─── */

type MetricCardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel: string;
  accent: "emerald" | "teal" | "green";
  pulse?: boolean;
};

const accentMap = {
  emerald: {
    border: "border-emerald-400/20",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    number: "text-emerald-200",
  },
  teal: {
    border: "border-teal-400/20",
    bg: "bg-teal-500/10",
    text: "text-teal-300",
    number: "text-teal-200",
  },
  green: {
    border: "border-green-400/20",
    bg: "bg-green-500/10",
    text: "text-green-300",
    number: "text-green-200",
  },
};

function MetricCard({ icon, label, value, sublabel, accent, pulse }: MetricCardProps) {
  const a = accentMap[accent];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:bg-white/[0.07]">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${a.border} ${a.bg}`}>
          <span className={a.text}>{icon}</span>
        </div>
        <span className="text-sm font-medium text-white/70">{label}</span>
        {pulse && (
          <span className="relative ml-auto flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
          </span>
        )}
      </div>
      <p className={`${rubik.className} text-4xl font-black ${a.number}`}>
        {value.toLocaleString("da-DK")}
      </p>
      <p className="mt-1 text-xs text-white/40">{sublabel}</p>
    </div>
  );
}
