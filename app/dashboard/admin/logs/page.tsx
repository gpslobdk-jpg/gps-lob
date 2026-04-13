"use client";

import Link from "next/link";
import { Activity, ChevronLeft, Database, RefreshCw, ShieldAlert, Waves } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
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

type AdminLogsTab = "overview" | "network" | "recoveries";
type DataSourceMode = "live" | "mock";

type TelemetryLogRow = {
  id?: string | number | null;
  event_type?: string | null;
  participant_id?: string | null;
  session_id?: string | null;
  message?: string | null;
  created_at?: string | null;
};

type TelemetryLogItem = {
  id: string;
  eventType: string;
  participantId: string | null;
  sessionId: string | null;
  message: string;
  createdAt: string | null;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const mockTelemetryLogs: TelemetryLogItem[] = [
  {
    id: "mock-restore-success",
    eventType: "restore_success",
    participantId: "demo-participant-1",
    sessionId: "demo-session-1",
    message: "restore_success after wake-up recovery",
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-401-participant",
    eventType: "auth_error",
    participantId: "demo-participant-2",
    sessionId: "demo-session-2",
    message: "GET /api/play/participant returned 401 during wake-up restore",
    createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-404-participant",
    eventType: "participant_lookup_failed",
    participantId: "demo-participant-3",
    sessionId: "demo-session-3",
    message: "GET /api/play/participant returned 404 after reconnect check",
    createdAt: new Date(Date.now() - 56 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-rebind",
    eventType: "participant_auth_rebind_recovered",
    participantId: "demo-participant-4",
    sessionId: "demo-session-4",
    message: "reason=wake_reconnect:status_channel_error",
    createdAt: new Date(Date.now() - 78 * 60 * 1000).toISOString(),
  },
];

const tabs: Array<{ id: AdminLogsTab; label: string }> = [
  { id: "overview", label: "Overblik" },
  { id: "network", label: "Netværksfejl (401/404)" },
  { id: "recoveries", label: "Genoprettelser (Telemetry)" },
];

function normalizeTelemetryLog(row: TelemetryLogRow, index: number): TelemetryLogItem {
  return {
    id: String(row.id ?? `${row.event_type ?? "event"}-${row.created_at ?? index}-${index}`),
    eventType: typeof row.event_type === "string" ? row.event_type : "unknown",
    participantId: typeof row.participant_id === "string" && row.participant_id ? row.participant_id : null,
    sessionId: typeof row.session_id === "string" && row.session_id ? row.session_id : null,
    message: typeof row.message === "string" ? row.message : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "Ukendt tidspunkt";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Ukendt tidspunkt";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getCombinedLogText(log: TelemetryLogItem) {
  return `${log.eventType} ${log.message}`.toLocaleLowerCase("da-DK");
}

function isNetworkErrorLog(log: TelemetryLogItem) {
  const combined = getCombinedLogText(log);
  return combined.includes("401") || combined.includes("404");
}

function isRecoveryLog(log: TelemetryLogItem) {
  const combined = getCombinedLogText(log);
  return (
    combined.includes("restore_success") ||
    combined.includes("recovered") ||
    combined.includes("rebind") ||
    combined.includes("wake_reconnect_recovered")
  );
}

function translateTelemetryLog(log: TelemetryLogItem) {
  const combined = getCombinedLogText(log);

  if (combined.includes("401") && combined.includes("/api/play/participant")) {
    return "Elev-adgang afvist (Muligvis dvale)";
  }

  if (combined.includes("restore_success") || log.eventType === "wake_reconnect_recovered") {
    return "Elev genoprettet succesfuldt";
  }

  switch (log.eventType) {
    case "participant_auth_refresh_recovered":
      return "Deltager-login genskabt via session-refresh";
    case "participant_auth_rebind_recovered":
      return "Deltager-login genskabt via rebind";
    case "participant_restore_exhausted":
      return "Automatisk genopretning blev opgivet";
    case "wake_reconnect_failed":
      return "Genopretning efter dvale mislykkedes";
    case "auth_error":
      return "401 opdaget under elevsynkronisering";
    case "session_drop":
      return "Deltager blev fjernet fra sessionen";
    case "gps_died":
      return "GPS-watcher stoppede og blev genstartet";
    default:
      return log.eventType.replace(/_/g, " ");
  }
}

function getLiveFallbackMessage(error: SupabaseErrorLike | null) {
  if (!error) {
    return "Live telemetry kunne ikke læses. Siden viser en skal, indtil databasen svarer igen.";
  }

  const combined = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLocaleLowerCase("da-DK");

  if (combined.includes("telemetry_logs") && (combined.includes("does not exist") || combined.includes("pgrst205"))) {
    return "telemetry_logs kunne ikke findes. Siden viser en skal, indtil tabellen er tilgængelig.";
  }

  if (combined.includes("42501") || combined.includes("permission") || combined.includes("policy")) {
    return "telemetry_logs findes, men klienten har ikke læseadgang. Siden viser en skal i stedet for live-data.";
  }

  return "Live telemetry kunne ikke læses. Siden viser en skal, indtil tabellen eller læseadgangen er på plads.";
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-[0_20px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-2 leading-6 text-slate-300/85">{body}</p>
    </div>
  );
}

export default function AdminLogsPage() {
  const [activeTab, setActiveTab] = useState<AdminLogsTab>("overview");
  const [logs, setLogs] = useState<TelemetryLogItem[]>([]);
  const [dataSource, setDataSource] = useState<DataSourceMode>("live");
  const [isLoading, setIsLoading] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const loadTelemetry = async () => {
      setIsLoading(true);
      setFallbackMessage("");

      const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();

      const { data, error } = await supabase
        .from("telemetry_logs")
        .select("id,event_type,participant_id,session_id,message,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(250);

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("Kunne ikke hente telemetry_logs live:", error);
        setLogs(mockTelemetryLogs);
        setDataSource("mock");
        setFallbackMessage(getLiveFallbackMessage(error as SupabaseErrorLike));
        setIsLoading(false);
        return;
      }

      setLogs(((data as TelemetryLogRow[] | null) ?? []).map(normalizeTelemetryLog));
      setDataSource("live");
      setIsLoading(false);
    };

    void loadTelemetry();

    return () => {
      isMounted = false;
    };
  }, [refreshNonce]);

  const networkLogs = useMemo(() => logs.filter(isNetworkErrorLog), [logs]);
  const recoveryLogs = useMemo(() => logs.filter(isRecoveryLog), [logs]);
  const uniqueSessionCount = useMemo(
    () => new Set(logs.map((log) => log.sessionId).filter((value): value is string => Boolean(value))).size,
    [logs]
  );
  const lastEventAt = logs[0]?.createdAt ?? null;

  const overviewCards = useMemo(
    () => [
      {
        label: "Hændelser seneste 24 timer",
        value: String(logs.length),
        detail: dataSource === "live" ? "Live fra telemetry_logs" : "Skaldata vises",
      },
      {
        label: "Netværksfejl 401/404",
        value: String(networkLogs.length),
        detail: "Hændelser der typisk rammer genopkobling og dvale",
      },
      {
        label: "Genoprettelser",
        value: String(recoveryLogs.length),
        detail: "Succesfulde reconnects og auth-gendannelser",
      },
      {
        label: "Berørte sessioner",
        value: String(uniqueSessionCount),
        detail: lastEventAt ? `Seneste hændelse ${formatDateTime(lastEventAt)}` : "Ingen hændelser endnu",
      },
    ],
    [dataSource, lastEventAt, logs.length, networkLogs.length, recoveryLogs.length, uniqueSessionCount]
  );

  const visibleLogs =
    activeTab === "overview" ? logs.slice(0, 10) : activeTab === "network" ? networkLogs : recoveryLogs;

  return (
    <div className={`min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8 ${poppins.className}`}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              Tilbage til dashboard
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/75">
              Internt Fejl & Log-dashboard
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-[0.04em] text-white sm:text-4xl ${rubik.className}`}>
              Systemets sundhed, samlet ét sted
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300/85 sm:text-base">
              Siden ligger bag dashboard-login og viser de seneste 24 timers telemetry, når tabellen er tilgængelig.
              Hvis live-data ikke kan læses, falder visningen tilbage til en skal, så UI og tolkninger stadig kan gennemgås.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRefreshNonce((current) => current + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/16"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Opdater visning
          </button>
        </div>

        {fallbackMessage ? (
          <div className="mb-6 rounded-[1.75rem] border border-amber-300/30 bg-amber-400/10 p-5 text-sm text-amber-50 shadow-[0_22px_48px_rgba(120,53,15,0.18)] backdrop-blur-xl">
            <p className="font-semibold text-amber-100">Live telemetry er ikke tilgængelig lige nu.</p>
            <p className="mt-2 leading-6 text-amber-50/90">{fallbackMessage}</p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[1.9rem] border border-white/10 bg-white/6 p-5 shadow-[0_24px_55px_rgba(15,23,42,0.18)] backdrop-blur-xl"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/75">{card.label}</p>
              <p className={`mt-3 text-3xl font-black text-white ${rubik.className}`}>{card.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/80">{card.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-3 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-cyan-400 text-slate-950 shadow-[0_14px_28px_rgba(34,211,238,0.28)]"
                      : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              {activeTab === "overview" ? (
                <Activity className="h-5 w-5 text-cyan-300" />
              ) : activeTab === "network" ? (
                <ShieldAlert className="h-5 w-5 text-amber-300" />
              ) : (
                <Waves className="h-5 w-5 text-emerald-300" />
              )}
              <div>
                <h2 className={`text-xl font-black text-white ${rubik.className}`}>
                  {tabs.find((tab) => tab.id === activeTab)?.label}
                </h2>
                <p className="text-sm text-slate-300/75">
                  {activeTab === "overview"
                    ? "Seneste hændelser og deres tolkede status."
                    : activeTab === "network"
                      ? "Fejl med 401/404, oversat til driftssprog."
                      : "Gendannelser og reconnects, hvor systemet hentede sig selv tilbage."}
                </p>
              </div>
            </div>

            {isLoading ? (
              <EmptyState
                title="Indlæser telemetry"
                body="Vi henter de seneste loglinjer og bygger et overblik over systemets sundhed."
              />
            ) : visibleLogs.length === 0 ? (
              <EmptyState
                title="Ingen hændelser at vise"
                body={
                  activeTab === "overview"
                    ? "Der ligger ingen telemetry-hændelser i de seneste 24 timer."
                    : activeTab === "network"
                      ? "Der blev ikke fundet 401/404-hændelser i perioden."
                      : "Der blev ikke fundet kendte genoprettelser i perioden."
                }
              />
            ) : (
              <div className="space-y-4">
                {visibleLogs.map((log) => (
                  <article
                    key={log.id}
                    className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4 shadow-[0_18px_36px_rgba(15,23,42,0.16)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{translateTelemetryLog(log)}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300/80">{log.message || "Ingen ekstra besked"}</p>
                      </div>
                      <time className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300/85">
                        {formatDateTime(log.createdAt)}
                      </time>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-300/75">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        event: {log.eventType}
                      </span>
                      {log.sessionId ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          session: {log.sessionId}
                        </span>
                      ) : null}
                      {log.participantId ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          deltager: {log.participantId}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-6">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-cyan-300" />
                <div>
                  <h2 className={`text-lg font-black text-white ${rubik.className}`}>Datakilde</h2>
                  <p className="text-sm text-slate-300/75">Hvor visningen får sine hændelser fra lige nu.</p>
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">Status</p>
                <p className="mt-3 text-base font-semibold text-white">
                  {dataSource === "live" ? "Live data fra telemetry_logs" : "Skaldata med fallback"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300/80">
                  {dataSource === "live"
                    ? "Siden læser de seneste 24 timers logs direkte fra Supabase-tabellen telemetry_logs."
                    : "Siden kunne ikke læse telemetry_logs live og viser derfor en forudfyldt skal med kendte eksempler."}
                </p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-6">
              <h2 className={`text-lg font-black text-white ${rubik.className}`}>Kendte oversættelser</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300/85">
                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="font-semibold text-white">401 på /api/play/participant</p>
                  <p className="mt-1 leading-6">Vises som: Elev-adgang afvist (Muligvis dvale)</p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="font-semibold text-white">restore_success</p>
                  <p className="mt-1 leading-6">Vises som: Elev genoprettet succesfuldt</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}