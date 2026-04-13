"use client";

import Link from "next/link";
import {
  Activity,
  ChevronLeft,
  Database,
  Globe,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Waves,
} from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const AUTO_REFRESH_MS = 30_000;

type AdminLogsTab = "overview" | "network" | "recoveries";
type DataSourceMode = "live" | "mock";
type ActiveAlarmSeverity = "critical" | "high" | "warning";

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

type ExternalIncident = {
  id: string;
  title: string;
  status: string;
  impact: string;
  shortLink: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExternalServiceStatus = {
  provider: string;
  name: string;
  source: "live" | "unavailable";
  statusUrl: string;
  indicator: string;
  description: string;
  updatedAt: string | null;
  incidents: ExternalIncident[];
  errorMessage: string;
};

type ActiveAlarm = {
  id: string;
  severity: ActiveAlarmSeverity;
  category: "student-spike" | "route-loop" | "external";
  source: "telemetry" | "external";
  signal: string;
  title: string;
  summary: string;
  recommendedAction: string;
  evidence: string[];
  count: number;
  uniqueParticipants: number;
  uniqueSessions: number;
  route: string | null;
  provider: string | null;
  status: number | null;
  startedAt: string | null;
  lastSeenAt: string | null;
};

type AdminLogsFeedResponse = {
  telemetryLogs?: TelemetryLogRow[];
  dataSource?: DataSourceMode;
  fallbackMessage?: string;
  externalServices?: ExternalServiceStatus[];
  activeAlarms?: ActiveAlarm[];
  generatedAt?: string;
  alarmWindowMinutes?: number;
};

type StructuredLogMeta = Record<string, string>;

const tabs: Array<{ id: AdminLogsTab; label: string }> = [
  { id: "overview", label: "Overblik" },
  { id: "network", label: "Netværksfejl (401/404)" },
  { id: "recoveries", label: "Genoprettelser (Telemetry)" },
];

const fallbackFeed = {
  telemetryLogs: [
    {
      id: "mock-restore-success",
      event_type: "restore_success",
      participant_id: "demo-participant-1",
      session_id: "demo-session-1",
      message: "restore_success after wake-up recovery",
      created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-401-participant",
      event_type: "server_response_error",
      participant_id: "demo-participant-2",
      session_id: "demo-session-2",
      message:
        "meta:kind=response|route=/api/play/participant|path=/api/play/participant?sessionId=demo|method=GET|status=401|msg=Unauthorized",
      created_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-server-error",
      event_type: "server_handled_error",
      participant_id: null,
      session_id: "demo-session-3",
      message:
        "meta:kind=handled|route=/api/join|path=/api/join|method=POST|status=500|type=route|msg=Kunne ikke registrere deltageren.",
      created_at: new Date(Date.now() - 56 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-rebind",
      event_type: "participant_auth_rebind_recovered",
      participant_id: "demo-participant-4",
      session_id: "demo-session-4",
      message: "reason=wake_reconnect:status_channel_error",
      created_at: new Date(Date.now() - 78 * 60 * 1000).toISOString(),
    },
  ] satisfies TelemetryLogRow[],
  dataSource: "mock" as DataSourceMode,
  fallbackMessage: "Admin-feed kunne ikke hentes live. Siden viser en lokal skal, indtil API'et svarer igen.",
  externalServices: [
    {
      provider: "vercel",
      name: "Vercel",
      source: "unavailable",
      statusUrl: "https://www.vercel-status.com",
      indicator: "unknown",
      description: "Kunne ikke hente ekstern driftsstatus lige nu",
      updatedAt: null,
      incidents: [],
      errorMessage: "Live statusfeed er utilgængeligt i fallback-visning.",
    },
    {
      provider: "supabase",
      name: "Supabase",
      source: "unavailable",
      statusUrl: "https://status.supabase.com",
      indicator: "unknown",
      description: "Kunne ikke hente ekstern driftsstatus lige nu",
      updatedAt: null,
      incidents: [],
      errorMessage: "Live statusfeed er utilgængeligt i fallback-visning.",
    },
  ] satisfies ExternalServiceStatus[],
  activeAlarms: [
    {
      id: "mock-student-spike",
      severity: "high",
      category: "student-spike",
      source: "telemetry",
      signal: "student_reconnect_spike",
      title: "Mange elever rammes af genopkoblingsfejl",
      summary: "6 reconnect-relaterede fejl på 15 minutter for 4 elever i 2 sessioner.",
      recommendedAction:
        "Tjek om auth- eller restore-flowet fejler bredt lige nu, og bed lærere holde eleverne på samme enhed, mens genopkoblingen afprøves.",
      evidence: [
        "Signaler: /api/play/participant:401 x4 · participant_restore_exhausted x2",
        "4 elever berørt · 2 sessioner berørt",
      ],
      count: 6,
      uniqueParticipants: 4,
      uniqueSessions: 2,
      route: "/api/play/participant",
      provider: null,
      status: 401,
      startedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      lastSeenAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-route-loop",
      severity: "critical",
      category: "route-loop",
      source: "telemetry",
      signal: "route_loop:/api/join",
      title: "join-flow fejler gentagne gange",
      summary: "5 serverfejl på join-flow inden for 15 minutter.",
      recommendedAction:
        "Tjek deltager-oprettelse, auth-binding og service-role adgang straks. Når join-flowet fejler i bølger, kan nye elever ikke komme ind i løbet.",
      evidence: ["Statusmønster: 500 x5", "Kontekster: join x5", "0 deltagere · 3 sessioner berørt"],
      count: 5,
      uniqueParticipants: 0,
      uniqueSessions: 3,
      route: "/api/join",
      provider: null,
      status: 500,
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      lastSeenAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    },
  ] satisfies ActiveAlarm[],
  generatedAt: new Date().toISOString(),
  alarmWindowMinutes: 15,
};

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

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "ukendt";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "ukendt";
  }

  const deltaMs = Date.now() - timestamp;
  const minutes = Math.max(0, Math.round(deltaMs / 60_000));
  if (minutes < 1) {
    return "lige nu";
  }

  if (minutes < 60) {
    return `${minutes} min siden`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours} t siden`;
}

function formatCountdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function parseStructuredMeta(message: string): StructuredLogMeta | null {
  if (!message.startsWith("meta:")) {
    return null;
  }

  return message
    .slice(5)
    .split("|")
    .reduce<StructuredLogMeta>((result, segment) => {
      const separatorIndex = segment.indexOf("=");
      if (separatorIndex <= 0) {
        return result;
      }

      const key = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();
      if (!key || !value) {
        return result;
      }

      result[key] = value;
      return result;
    }, {});
}

function getCombinedLogText(log: TelemetryLogItem) {
  return `${log.eventType} ${log.message}`.toLocaleLowerCase("da-DK");
}

function getStatusCode(log: TelemetryLogItem) {
  const meta = parseStructuredMeta(log.message);
  const fromMeta = Number(meta?.status ?? "");
  if (Number.isFinite(fromMeta) && fromMeta > 0) {
    return fromMeta;
  }

  const match = getCombinedLogText(log).match(/\b(401|404|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

function getRoutePath(log: TelemetryLogItem) {
  const meta = parseStructuredMeta(log.message);
  if (meta?.route) {
    return meta.route;
  }

  const routeMatch = log.message.match(/\/api\/[A-Za-z0-9\-/]+/);
  return routeMatch ? routeMatch[0] : null;
}

function formatRouteLabel(routePath: string | null) {
  if (!routePath) return "ukendt route";

  switch (routePath) {
    case "/api/play/participant":
      return "elev-genopkobling";
    case "/api/play/status":
      return "sessionstatus";
    case "/api/play/session":
      return "play-data";
    case "/api/play/location":
      return "positionssynk";
    case "/api/play/submit-answer":
      return "svar-upload";
    case "/api/play/submit-photo":
      return "foto-upload";
    case "/api/join":
      return "join-flow";
    case "/api/checkout":
      return "checkout";
    case "/api/webhook/stripe":
      return "Stripe-webhook";
    default:
      return routePath;
  }
}

function isNetworkErrorLog(log: TelemetryLogItem) {
  const status = getStatusCode(log);
  if (status === 401 || status === 404) {
    return true;
  }

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

function isServerErrorLog(log: TelemetryLogItem) {
  if (log.eventType === "server_exception" || log.eventType === "server_handled_error") {
    return true;
  }

  const status = getStatusCode(log);
  return status !== null && status >= 500;
}

function translateTelemetryLog(log: TelemetryLogItem) {
  const combined = getCombinedLogText(log);
  const status = getStatusCode(log);
  const routePath = getRoutePath(log);

  if (status === 401 && routePath === "/api/play/participant") {
    return "Elev-adgang afvist (Muligvis dvale)";
  }

  if (status === 404 && routePath === "/api/play/participant") {
    return "Deltager blev ikke fundet ved genopkobling";
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
    case "gps_died":
      return "GPS-watcher stoppede og blev genstartet";
    case "server_response_error":
      return `Serveren svarede ${status ?? "med fejl"} i ${formatRouteLabel(routePath)}`;
    case "server_handled_error":
      return `Håndteret serverfejl i ${formatRouteLabel(routePath)}`;
    case "server_exception":
      return `Ufanget serverfejl i ${formatRouteLabel(routePath)}`;
    default:
      return log.eventType.replace(/_/g, " ");
  }
}

function getTelemetryDetail(log: TelemetryLogItem) {
  const meta = parseStructuredMeta(log.message);
  if (!meta) {
    return log.message || "Ingen ekstra besked";
  }

  const parts = [
    meta.route ? `Route ${meta.route}` : "",
    meta.status ? `Status ${meta.status}` : "",
    meta.msg ? meta.msg : "",
    meta.code ? `Kode ${meta.code}` : "",
    meta.details ? meta.details : "",
  ].filter(Boolean);

  return parts.join(" · ") || "Ingen ekstra besked";
}

function getTelemetryRecommendedAction(log: TelemetryLogItem) {
  const status = getStatusCode(log);
  const routePath = getRoutePath(log);

  if (status === 401 && routePath === "/api/play/participant") {
    return "Bed eleven trykke Genopret forbindelse. Hvis 401 gentager sig, genindlæs løbet fra samme enhed, så deltager-login kan bindes igen.";
  }

  if (status === 404 && routePath === "/api/play/participant") {
    return "Kontroller om deltageren stadig findes i sessionen. Hvis eleven er faldet helt ud, lad eleven åbne samme løb igen eller join på ny.";
  }

  switch (log.eventType) {
    case "participant_restore_exhausted":
    case "wake_reconnect_failed":
      return "Få eleven tilbage på netværk og brug Genopret forbindelse. Hvis det stadig fejler, genindlæs siden og kontroller at samme enhed bruges.";
    case "participant_auth_refresh_recovered":
    case "participant_auth_rebind_recovered":
    case "wake_reconnect_recovered":
      return "Ingen akut handling. Hold øje med gentagne gendannelser for samme deltager og tjek netværk, hvis de kommer i bølger.";
    case "server_exception":
    case "server_handled_error":
    case "server_response_error":
      if (routePath === "/api/join") {
        return "Tjek deltager-oprettelse, service-role adgang og auth-binding. Fejl her blokerer nye elever fra at komme ind i løbet.";
      }

      if (routePath === "/api/play/location") {
        return "Tjek at sessionen stadig er aktiv, og at eleven har forbindelse nok til at sende GPS-positioner. Se efter gentagne 500-fejl på positionssynk.";
      }

      if (routePath === "/api/play/submit-photo") {
        return "Tjek Storage-adgang, answers-tabellen og om foto-posten stadig findes i løbet. Problemet ligger ofte i upload- eller databaseleddet.";
      }

      if (routePath === "/api/play/submit-answer") {
        return "Tjek svar-tabellen og schema-kompatibilitet. Hvis fejlen rammer mange elever samtidigt, er det oftest data- eller adgangslaget og ikke klienten.";
      }

      if (routePath === "/api/play/status" || routePath === "/api/play/session") {
        return "Tjek live_sessions, run-data og Supabase-adgang. Hvis denne route fejler, vil elever typisk sidde fast i indlæsning eller mangle missionsdata.";
      }

      return "Åbn den tekniske loglinje og route-navnet, og verificer om fejlen er lokal for en enkelt elev eller generel for hele sessionen, før du beder klassen reloade.";
    default:
      return "Ingen fast playbook endnu. Brug den tekniske loglinje og event-navnet til at afgøre, om fejlen er elevspecifik eller generel for sessionen.";
  }
}

function getTelemetryTags(log: TelemetryLogItem) {
  const meta = parseStructuredMeta(log.message);
  const tags = [`event: ${log.eventType}`];

  if (meta?.route) tags.push(`route: ${meta.route}`);
  if (meta?.status) tags.push(`status: ${meta.status}`);
  if (log.sessionId) tags.push(`session: ${log.sessionId}`);
  if (log.participantId) tags.push(`deltager: ${log.participantId}`);

  return tags;
}

function translateExternalIndicator(indicator: string) {
  switch (indicator) {
    case "none":
      return "Alt operativt";
    case "minor":
      return "Mindre driftspåvirkning";
    case "major":
      return "Større driftspåvirkning";
    case "critical":
      return "Kritisk driftspåvirkning";
    default:
      return "Status ukendt";
  }
}

function getExternalStatusTone(service: ExternalServiceStatus) {
  if (service.source === "unavailable") {
    return "border-amber-300/30 bg-amber-400/10 text-amber-50";
  }

  if (service.indicator !== "none" || service.incidents.length > 0) {
    return "border-rose-300/30 bg-rose-400/10 text-rose-50";
  }

  return "border-emerald-300/30 bg-emerald-400/10 text-emerald-50";
}

function getExternalRecommendedAction(service: ExternalServiceStatus) {
  if (service.source === "unavailable") {
    return "Statusfeeden kunne ikke hentes. Verificer leverandørens status-side manuelt, før du konkluderer at problemet ligger i vores egen kode.";
  }

  if (service.indicator !== "none" || service.incidents.length > 0) {
    return `Tjek ${service.name}-statussiden først. Informer lærere om ekstern driftspåvirkning og undgå at bruge tid på klientfejlsøgning, mens leverandøren er gul eller rød.`;
  }

  return "Ingen ekstern driftspåvirkning registreret lige nu. Fejl skal derfor sandsynligvis findes i vores egne routes, realtime eller klient-flow.";
}

function getAlarmSeverityLabel(severity: ActiveAlarmSeverity) {
  switch (severity) {
    case "critical":
      return "Kritisk";
    case "high":
      return "Høj";
    default:
      return "Advarsel";
  }
}

function getAlarmTone(alarm: ActiveAlarm) {
  switch (alarm.severity) {
    case "critical":
      return {
        card: "border-rose-300/30 bg-rose-500/10",
        pill: "border-rose-300/30 bg-rose-400/15 text-rose-50",
        accent: "text-rose-100",
        action: "border-rose-300/20 bg-rose-400/10 text-rose-50/92",
      };
    case "high":
      return {
        card: "border-amber-300/30 bg-amber-500/10",
        pill: "border-amber-300/30 bg-amber-400/15 text-amber-50",
        accent: "text-amber-100",
        action: "border-amber-300/20 bg-amber-400/10 text-amber-50/92",
      };
    default:
      return {
        card: "border-cyan-300/25 bg-cyan-500/8",
        pill: "border-cyan-300/30 bg-cyan-400/15 text-cyan-50",
        accent: "text-cyan-100",
        action: "border-cyan-300/20 bg-cyan-400/10 text-cyan-50/92",
      };
  }
}

function getAlarmCategoryLabel(alarm: ActiveAlarm) {
  switch (alarm.category) {
    case "student-spike":
      return "Elevspike";
    case "route-loop":
      return "Route-loop";
    default:
      return alarm.provider ? `${alarm.provider}-drift` : "Ekstern drift";
  }
}

function getAlarmMetaTags(alarm: ActiveAlarm) {
  const tags = [`kategori: ${getAlarmCategoryLabel(alarm)}`, `signal: ${alarm.signal}`];

  if (alarm.route) tags.push(`route: ${alarm.route}`);
  if (alarm.provider) tags.push(`leverandør: ${alarm.provider}`);
  if (alarm.status) tags.push(`status: ${alarm.status}`);
  if (alarm.uniqueParticipants > 0) tags.push(`elever: ${alarm.uniqueParticipants}`);
  if (alarm.uniqueSessions > 0) tags.push(`sessioner: ${alarm.uniqueSessions}`);

  return tags;
}

function getNotificationStatusLabel(permission: NotificationPermission | "unsupported") {
  switch (permission) {
    case "granted":
      return "Browseralarmer er slået til";
    case "denied":
      return "Browseralarmer er blokeret";
    case "unsupported":
      return "Browseralarmer understøttes ikke her";
    default:
      return "Browseralarmer er ikke slået til";
  }
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
  const [logs, setLogs] = useState<TelemetryLogItem[]>(fallbackFeed.telemetryLogs.map(normalizeTelemetryLog));
  const [externalServices, setExternalServices] = useState<ExternalServiceStatus[]>(fallbackFeed.externalServices);
  const [activeAlarms, setActiveAlarms] = useState<ActiveAlarm[]>(fallbackFeed.activeAlarms);
  const [dataSource, setDataSource] = useState<DataSourceMode>(fallbackFeed.dataSource);
  const [isLoading, setIsLoading] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState(fallbackFeed.fallbackMessage);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string>(fallbackFeed.generatedAt);
  const [alarmWindowMinutes, setAlarmWindowMinutes] = useState<number>(fallbackFeed.alarmWindowMinutes);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(Date.now() + AUTO_REFRESH_MS);
  const [refreshCountdownMs, setRefreshCountdownMs] = useState(AUTO_REFRESH_MS);
  const [newAlarmIds, setNewAlarmIds] = useState<string[]>([]);
  const [newAlarmMessage, setNewAlarmMessage] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );

  const previousAlarmIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    setNotificationPermission(window.Notification.permission);
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled) {
      setNextRefreshAt(null);
      return;
    }

    const scheduledAt = Date.now() + AUTO_REFRESH_MS;
    setNextRefreshAt(scheduledAt);
    const timeout = window.setTimeout(() => {
      setRefreshNonce((current) => current + 1);
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [autoRefreshEnabled, refreshNonce]);

  useEffect(() => {
    if (!autoRefreshEnabled || nextRefreshAt === null) {
      setRefreshCountdownMs(0);
      return;
    }

    const syncCountdown = () => {
      setRefreshCountdownMs(Math.max(nextRefreshAt - Date.now(), 0));
    };

    syncCountdown();
    const interval = window.setInterval(syncCountdown, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefreshEnabled, nextRefreshAt]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadAdminFeed = async () => {
      setIsLoading(true);

      try {
        const response = await fetch("/api/admin/logs", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Admin-feed svarede med ${response.status}`);
        }

        const payload = (await response.json()) as AdminLogsFeedResponse;
        if (!isMounted) {
          return;
        }

        const nextLogs = (payload.telemetryLogs ?? fallbackFeed.telemetryLogs).map(normalizeTelemetryLog);
        const nextExternalServices = payload.externalServices ?? fallbackFeed.externalServices;
        const nextActiveAlarms = payload.activeAlarms ?? fallbackFeed.activeAlarms;
        const previousAlarmIds = previousAlarmIdsRef.current;
        const incomingAlarmIds = nextActiveAlarms.map((alarm) => alarm.id);
        const detectedNewAlarms =
          previousAlarmIds.length === 0
            ? []
            : nextActiveAlarms.filter((alarm) => !previousAlarmIds.includes(alarm.id));

        previousAlarmIdsRef.current = incomingAlarmIds;

        setLogs(nextLogs);
        setExternalServices(nextExternalServices);
        setActiveAlarms(nextActiveAlarms);
        setDataSource(payload.dataSource ?? "mock");
        setFallbackMessage(payload.fallbackMessage ?? "");
        setGeneratedAt(payload.generatedAt ?? new Date().toISOString());
        setAlarmWindowMinutes(payload.alarmWindowMinutes ?? fallbackFeed.alarmWindowMinutes);

        if (detectedNewAlarms.length > 0) {
          setNewAlarmIds(detectedNewAlarms.map((alarm) => alarm.id));
          setNewAlarmMessage(
            `${detectedNewAlarms.length} ny${detectedNewAlarms.length > 1 ? "e" : ""} alarm${detectedNewAlarms.length > 1 ? "er" : ""} opdaget.`
          );

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            window.Notification.permission === "granted" &&
            document.visibilityState !== "visible"
          ) {
            detectedNewAlarms.slice(0, 3).forEach((alarm) => {
              new window.Notification(`GPSlob alarm: ${alarm.title}`, {
                body: alarm.summary,
              });
            });
          }
        }
      } catch {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        previousAlarmIdsRef.current = fallbackFeed.activeAlarms.map((alarm) => alarm.id);
        setLogs(fallbackFeed.telemetryLogs.map(normalizeTelemetryLog));
        setExternalServices(fallbackFeed.externalServices);
        setActiveAlarms(fallbackFeed.activeAlarms);
        setDataSource("mock");
        setFallbackMessage(fallbackFeed.fallbackMessage);
        setGeneratedAt(new Date().toISOString());
        setAlarmWindowMinutes(fallbackFeed.alarmWindowMinutes);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAdminFeed();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [refreshNonce]);

  useEffect(() => {
    if (!newAlarmMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNewAlarmMessage("");
      setNewAlarmIds([]);
    }, 12_000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [newAlarmMessage]);

  useEffect(() => {
    const baseTitle = "Fejl & Log";
    document.title = activeAlarms.length > 0 ? `(${activeAlarms.length}) ${baseTitle}` : baseTitle;

    return () => {
      document.title = baseTitle;
    };
  }, [activeAlarms.length]);

  const requestBrowserAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const networkLogs = useMemo(() => logs.filter(isNetworkErrorLog), [logs]);
  const recoveryLogs = useMemo(() => logs.filter(isRecoveryLog), [logs]);
  const serverErrorLogs = useMemo(() => logs.filter(isServerErrorLog), [logs]);
  const criticalAlarmCount = useMemo(
    () => activeAlarms.filter((alarm) => alarm.severity === "critical").length,
    [activeAlarms]
  );
  const routeLoopAlarmCount = useMemo(
    () => activeAlarms.filter((alarm) => alarm.category === "route-loop").length,
    [activeAlarms]
  );
  const externalAlarmCount = useMemo(
    () => activeAlarms.filter((alarm) => alarm.category === "external").length,
    [activeAlarms]
  );
  const uniqueSessionCount = useMemo(
    () => new Set(logs.map((log) => log.sessionId).filter((value): value is string => Boolean(value))).size,
    [logs]
  );
  const lastEventAt = logs[0]?.createdAt ?? null;
  const degradedExternalCount = useMemo(
    () =>
      externalServices.filter(
        (service) => service.source === "unavailable" || service.indicator !== "none" || service.incidents.length > 0
      ).length,
    [externalServices]
  );
  const unresolvedExternalIncidentCount = useMemo(
    () => externalServices.reduce((sum, service) => sum + service.incidents.length, 0),
    [externalServices]
  );
  const highlightedAlarmTitles = useMemo(
    () => activeAlarms.filter((alarm) => newAlarmIds.includes(alarm.id)).map((alarm) => alarm.title),
    [activeAlarms, newAlarmIds]
  );

  const overviewCards = useMemo(
    () => [
      {
        label: "Aktive alarmer",
        value: String(activeAlarms.length),
        detail:
          activeAlarms.length > 0
            ? `${criticalAlarmCount} kritiske · ${routeLoopAlarmCount} route-loops`
            : `Ingen aktive alarmer i de seneste ${alarmWindowMinutes} min`,
      },
      {
        label: "Serverfejl seneste 24 timer",
        value: String(serverErrorLogs.length),
        detail: lastEventAt
          ? `Berørte sessioner ${uniqueSessionCount} · seneste ${formatDateTime(lastEventAt)}`
          : `Berørte sessioner ${uniqueSessionCount}`,
      },
      {
        label: "Netværksfejl 401/404",
        value: String(networkLogs.length),
        detail: "Fejl der typisk rammer genopkobling, auth og dvale",
      },
      {
        label: "Genoprettelser",
        value: String(recoveryLogs.length),
        detail: "Succesfulde reconnects og auth-gendannelser",
      },
      {
        label: "Eksterne driftssignaler",
        value: String(degradedExternalCount),
        detail:
          unresolvedExternalIncidentCount > 0
            ? `${unresolvedExternalIncidentCount} åbne incidents hos Vercel/Supabase`
            : `${externalAlarmCount} aktive eksterne alarmer`,
      },
      {
        label: "Sidst genereret",
        value: formatRelativeTime(generatedAt),
        detail: `Alarmmotoren kører på serveren hvert opslag og ser ${alarmWindowMinutes} min tilbage`,
      },
    ],
    [
      activeAlarms.length,
      alarmWindowMinutes,
      criticalAlarmCount,
      degradedExternalCount,
      externalAlarmCount,
      generatedAt,
      lastEventAt,
      networkLogs.length,
      recoveryLogs.length,
      routeLoopAlarmCount,
      serverErrorLogs.length,
      uniqueSessionCount,
      unresolvedExternalIncidentCount,
    ]
  );

  const visibleLogs =
    activeTab === "overview" ? logs.slice(0, 12) : activeTab === "network" ? networkLogs : recoveryLogs;

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
              Alarmmotor for drift og fejl
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300/85 sm:text-base">
              Siden ligger bag dashboard-login og reagerer nu aktivt på tre typer problemer: mange elevfejl på kort
              tid, server-routes der går i 500-loop, og eksterne driftsproblemer hos Vercel eller Supabase.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAutoRefreshEnabled((current) => !current)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                autoRefreshEnabled
                  ? "border border-emerald-300/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/16"
                  : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {autoRefreshEnabled ? `Auto-refresh: ${formatCountdown(refreshCountdownMs)}` : "Auto-refresh er pauset"}
            </button>

            <button
              type="button"
              onClick={() => {
                void requestBrowserAlerts();
              }}
              disabled={notificationPermission === "unsupported" || notificationPermission === "granted"}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {notificationPermission === "granted"
                ? "Browseralarmer er aktive"
                : notificationPermission === "denied"
                  ? "Browseralarmer er blokeret"
                  : notificationPermission === "unsupported"
                    ? "Browseralarmer understøttes ikke"
                    : "Aktivér browseralarmer"}
            </button>

            <button
              type="button"
              onClick={() => setRefreshNonce((current) => current + 1)}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/16"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Opdater nu
            </button>
          </div>
        </div>

        {newAlarmMessage ? (
          <div className="mb-6 rounded-[1.8rem] border border-rose-300/30 bg-rose-500/10 p-5 shadow-[0_22px_48px_rgba(159,18,57,0.18)] backdrop-blur-xl">
            <div className="flex flex-wrap items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 text-rose-200" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-100/80">Ny alarm opdaget</p>
                <p className="mt-2 text-base font-semibold text-white">{newAlarmMessage}</p>
                {highlightedAlarmTitles.length > 0 ? (
                  <p className="mt-2 text-sm leading-6 text-rose-50/90">{highlightedAlarmTitles.join(" · ")}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {fallbackMessage ? (
          <div className="mb-6 rounded-[1.75rem] border border-amber-300/30 bg-amber-400/10 p-5 text-sm text-amber-50 shadow-[0_22px_48px_rgba(120,53,15,0.18)] backdrop-blur-xl">
            <p className="font-semibold text-amber-100">Live telemetry er ikke fuldt tilgængelig lige nu.</p>
            <p className="mt-2 leading-6 text-amber-50/90">{fallbackMessage}</p>
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 text-rose-200" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-100/70">Alarmfase</p>
                <h2 className={`mt-2 text-2xl font-black text-white ${rubik.className}`}>Aktive alarmer lige nu</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300/80">
                  Serveren gennemgår de seneste {alarmWindowMinutes} minutter og løfter kun de mønstre frem, der
                  ligner reel driftsstøj: mange elever med samme reconnect-fejl, vigtige routes i 500-loop og åbne
                  eksterne incidents.
                </p>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-300/85">
              <p className="font-semibold text-white">Alarmmotor status</p>
              <p className="mt-2">Senest kørt {formatDateTime(generatedAt)}</p>
              <p className="mt-1">{getNotificationStatusLabel(notificationPermission)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">Aktive alarmer</p>
              <p className={`mt-3 text-3xl font-black text-white ${rubik.className}`}>{activeAlarms.length}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">Alarmmotoren ser {alarmWindowMinutes} minutter tilbage.</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">Kritiske</p>
              <p className={`mt-3 text-3xl font-black text-white ${rubik.className}`}>{criticalAlarmCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">Kræver typisk lærerinformation eller akut driftstjek.</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">Route-loops</p>
              <p className={`mt-3 text-3xl font-black text-white ${rubik.className}`}>{routeLoopAlarmCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">Server-routes med 500/502/504-bølger på kort tid.</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">Eksterne signaler</p>
              <p className={`mt-3 text-3xl font-black text-white ${rubik.className}`}>{externalAlarmCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">Driftsproblemer eller utilgængelige statusfeeds hos leverandører.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-5">
              <EmptyState
                title="Beregner alarmer"
                body="Vi samler telemetry, eksterne incidents og serverfejl til aktive alarmer med severity og anbefalet handling."
              />
            </div>
          ) : activeAlarms.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="Ingen aktive alarmer"
                body="Der er ikke fundet mønstre i de seneste minutter, som tyder på bred driftspåvirkning lige nu."
              />
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {activeAlarms.map((alarm) => {
                const tone = getAlarmTone(alarm);
                const isNewAlarm = newAlarmIds.includes(alarm.id);

                return (
                  <article
                    key={alarm.id}
                    className={`rounded-[1.6rem] border p-5 shadow-[0_20px_40px_rgba(15,23,42,0.16)] ${tone.card} ${
                      isNewAlarm ? "ring-2 ring-cyan-300/40" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{alarm.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-200/85">{alarm.summary}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.pill}`}>
                          {getAlarmSeverityLabel(alarm.severity)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200/85">
                          {getAlarmCategoryLabel(alarm)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[1.1rem] border border-white/10 bg-black/15 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200/65">Senest set</p>
                        <p className={`mt-2 text-sm font-semibold ${tone.accent}`}>{formatDateTime(alarm.lastSeenAt)}</p>
                      </div>
                      <div className="rounded-[1.1rem] border border-white/10 bg-black/15 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200/65">Volumen</p>
                        <p className={`mt-2 text-sm font-semibold ${tone.accent}`}>{alarm.count} hændelser</p>
                      </div>
                      <div className="rounded-[1.1rem] border border-white/10 bg-black/15 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200/65">Berøring</p>
                        <p className={`mt-2 text-sm font-semibold ${tone.accent}`}>
                          {alarm.uniqueParticipants > 0 ? `${alarm.uniqueParticipants} elever` : "0 elever"}
                          {alarm.uniqueSessions > 0 ? ` · ${alarm.uniqueSessions} sessioner` : ""}
                        </p>
                      </div>
                    </div>

                    <div className={`mt-4 rounded-[1.25rem] border p-4 text-sm ${tone.action}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Anbefalet handling</p>
                      <p className="mt-2 leading-6">{alarm.recommendedAction}</p>
                    </div>

                    {alarm.evidence.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">Bevislinjer</p>
                        <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-200/82">
                          {alarm.evidence.slice(0, 3).map((line) => (
                            <li key={`${alarm.id}-${line}`} className="rounded-[1rem] border border-white/10 bg-black/15 px-3 py-2">
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-200/75">
                      {getAlarmMetaTags(alarm).map((tag) => (
                        <span key={`${alarm.id}-${tag}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
                    ? "Seneste hændelser med driftstolkning, serverkontekst og anbefalet handling."
                    : activeTab === "network"
                      ? "401/404-fejl, oversat til det konkrete elev- eller sessionproblem de typisk betyder."
                      : "Gendannelser og reconnects, hvor systemet hentede sig selv tilbage uden fuldt nedbrud."}
                </p>
              </div>
            </div>

            {isLoading ? (
              <EmptyState
                title="Indlæser telemetry"
                body="Vi henter de seneste loglinjer, serverfejl og statusfeeds og bygger et samlet overblik over systemets sundhed."
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
                        <p className="mt-1 text-sm leading-6 text-slate-300/80">{getTelemetryDetail(log)}</p>
                      </div>
                      <time className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300/85">
                        {formatDateTime(log.createdAt)}
                      </time>
                    </div>

                    <div className="mt-4 rounded-[1.25rem] border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50/92">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                        Anbefalet handling
                      </p>
                      <p className="mt-2 leading-6">{getTelemetryRecommendedAction(log)}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-300/75">
                      {getTelemetryTags(log).map((tag) => (
                        <span key={`${log.id}-${tag}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          {tag}
                        </span>
                      ))}
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
                  <h2 className={`text-lg font-black text-white ${rubik.className}`}>Alarmmotor & datakilde</h2>
                  <p className="text-sm text-slate-300/75">Hvordan siden holder sig opdateret og hvorfor den alarmerer.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-300/85">
                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/75">Feedstatus</p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {dataSource === "live" ? "Live data fra telemetry_logs" : "Skaldata med fallback"}
                  </p>
                  <p className="mt-2 leading-6 text-slate-300/82">
                    {dataSource === "live"
                      ? "Serverfeeden læser telemetry_logs med service-role adgang, udleder aktive alarmer server-side og sender dem færdige til klienten."
                      : "Serverfeeden faldt tilbage til skaldata, så visningen stadig kan vise kendte fejlmønstre og playbooks."}
                  </p>
                </div>

                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/75">Auto-refresh</p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {autoRefreshEnabled ? `Næste opdatering om ${formatCountdown(refreshCountdownMs)}` : "Pause aktiveret"}
                  </p>
                  <p className="mt-2 leading-6 text-slate-300/82">
                    Siden opdaterer automatisk hvert 30. sekund og markerer nye alarmer, så driftssignaler ikke gemmer sig i gammel historik.
                  </p>
                </div>

                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/75">Browseralarmer</p>
                  <p className="mt-2 text-base font-semibold text-white">{getNotificationStatusLabel(notificationPermission)}</p>
                  <p className="mt-2 leading-6 text-slate-300/82">
                    Når browseralarmer er tilladt, kan siden sende native notifikationer ved nye alarmer, hvis fanen ikke er aktiv.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-6">
              <h2 className={`text-lg font-black text-white ${rubik.className}`}>Kendte playbooks</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300/85">
                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="font-semibold text-white">401 på /api/play/participant</p>
                  <p className="mt-1 leading-6">Vises som: Elev-adgang afvist (Muligvis dvale)</p>
                  <p className="mt-2 leading-6 text-cyan-100/85">
                    Handling: Bed eleven bruge Genopret forbindelse, og genindlæs løbet fra samme enhed, hvis 401 fortsat vender tilbage.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="font-semibold text-white">Route-loop på /api/join</p>
                  <p className="mt-1 leading-6">Vises som: join-flow fejler gentagne gange</p>
                  <p className="mt-2 leading-6 text-cyan-100/85">
                    Handling: Tjek auth-binding, service-role adgang og participant-oprettelse før nye elever forsøger at joine igen.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="font-semibold text-white">Eksterne incidents hos Vercel/Supabase</p>
                  <p className="mt-1 leading-6">Vises som: leverandøren melder driftsproblemer</p>
                  <p className="mt-2 leading-6 text-cyan-100/85">
                    Handling: Tjek leverandørens statusside først og undgå at sende lærere ud i lokal fejlsøgning, hvis problemet allerede er eksternt.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-6">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-cyan-300" />
            <div>
              <h2 className={`text-xl font-black text-white ${rubik.className}`}>Eksterne driftsfejl</h2>
              <p className="text-sm text-slate-300/75">
                Separat sektion for leverandørstatus, så Vercel- og Supabase-problemer ikke forveksles med egne fejl.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {externalServices.map((service) => (
              <article
                key={service.provider}
                className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-5 shadow-[0_18px_36px_rgba(15,23,42,0.16)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{service.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300/80">{service.description}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getExternalStatusTone(service)}`}>
                    {translateExternalIndicator(service.indicator)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-300/75">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">kilde: {service.source}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    opdateret: {formatDateTime(service.updatedAt)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    incidents: {service.incidents.length}
                  </span>
                </div>

                {service.errorMessage ? (
                  <div className="mt-4 rounded-[1.2rem] border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50/90">
                    {service.errorMessage}
                  </div>
                ) : null}

                {service.incidents.length === 0 ? (
                  <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300/82">
                    Ingen åbne incidents registreret i statusfeeden lige nu.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {service.incidents.map((incident) => (
                      <div
                        key={incident.id}
                        className="rounded-[1.2rem] border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-50/92"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold text-white">{incident.title}</p>
                          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-rose-50/85">
                            {incident.impact} · {incident.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-rose-50/80">
                          Oprettet {formatDateTime(incident.createdAt)} · sidst opdateret {formatDateTime(incident.updatedAt)}
                        </p>
                        {incident.shortLink ? (
                          <a
                            href={incident.shortLink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
                          >
                            Åbn incident hos {service.name}
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-[1.25rem] border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50/92">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                    <TriangleAlert className="h-4 w-4" />
                    Anbefalet handling
                  </div>
                  <p className="mt-2 leading-6">{getExternalRecommendedAction(service)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}