"use client";

import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  Database,
  Globe,
  Info,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Waves,
} from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const AUTO_REFRESH_MS = 30_000;
const DISPLAY_TIME_ZONE = "Europe/Copenhagen";
const FALLBACK_BASE_TIMESTAMP = Date.parse("2026-04-13T10:00:00.000Z");

function getStaticFallbackTimestamp(minutesAgo = 0) {
  return new Date(FALLBACK_BASE_TIMESTAMP - minutesAgo * 60_000).toISOString();
}

type AdminLogsTab = "overview" | "network" | "recoveries";
type DataSourceMode = "live" | "mock";
type ActiveAlarmSeverity = "critical" | "high" | "warning";
type DrilldownGroupBy = "route" | "session" | "event";

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

type CorrelatedIncidentKind = "session-cluster" | "cross-session-pattern" | "reconnect-pattern";

type CorrelatedIncident = {
  id: string;
  severity: ActiveAlarmSeverity;
  kind: CorrelatedIncidentKind;
  signal: string;
  title: string;
  summary: string;
  recommendedAction: string;
  evidence: string[];
  route: string | null;
  sessionId: string | null;
  status: number | null;
  count: number;
  uniqueParticipants: number;
  uniqueSessions: number;
  startedAt: string | null;
  lastSeenAt: string | null;
};

type DrilldownGroup = {
  key: string;
  label: string;
  count: number;
  items: TelemetryLogItem[];
  uniqueParticipants: number;
  uniqueSessions: number;
  lastSeenAt: string | null;
};

type GroupedTelemetryLog = {
  key: string;
  representative: TelemetryLogItem;
  items: TelemetryLogItem[];
  count: number;
  participantId: string | null;
  sessionId: string | null;
  routePath: string | null;
  status: number | null;
  eventType: string;
  startedAt: string | null;
  lastSeenAt: string | null;
};

type AdminLogsFeedResponse = {
  telemetryLogs?: TelemetryLogRow[];
  dataSource?: DataSourceMode;
  fallbackMessage?: string;
  externalServices?: ExternalServiceStatus[];
  activeAlarms?: ActiveAlarm[];
  correlatedIncidents?: CorrelatedIncident[];
  generatedAt?: string;
  alarmWindowMinutes?: number;
  correlationWindowMinutes?: number;
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
      created_at: getStaticFallbackTimestamp(12),
    },
    {
      id: "mock-401-participant",
      event_type: "server_response_error",
      participant_id: "demo-participant-2",
      session_id: "demo-session-2",
      message:
        "meta:kind=response|route=/api/play/participant|path=/api/play/participant?sessionId=demo|method=GET|status=401|msg=Unauthorized",
      created_at: getStaticFallbackTimestamp(28),
    },
    {
      id: "mock-server-error",
      event_type: "server_handled_error",
      participant_id: null,
      session_id: "demo-session-3",
      message:
        "meta:kind=handled|route=/api/join|path=/api/join|method=POST|status=500|type=route|msg=Kunne ikke registrere deltageren.",
      created_at: getStaticFallbackTimestamp(56),
    },
    {
      id: "mock-rebind",
      event_type: "participant_auth_rebind_recovered",
      participant_id: "demo-participant-4",
      session_id: "demo-session-4",
      message: "reason=wake_reconnect:status_channel_error",
      created_at: getStaticFallbackTimestamp(78),
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
      startedAt: getStaticFallbackTimestamp(12),
      lastSeenAt: getStaticFallbackTimestamp(2),
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
      startedAt: getStaticFallbackTimestamp(10),
      lastSeenAt: getStaticFallbackTimestamp(1),
    },
  ] satisfies ActiveAlarm[],
  correlatedIncidents: [
    {
      id: "mock-correlation-session",
      severity: "high",
      kind: "session-cluster",
      signal: "/api/play/submit-photo",
      title: "foto-upload er koncentreret i én session",
      summary: "3 foto-fejl i samme session inden for 45 minutter. Det ligner et løbsspecifikt problem og ikke bred platformstøj.",
      recommendedAction:
        "Fokuser først på den berørte session og tjek foto-post, storage-adgang og answers-flow, før du behandler det som global platformfejl.",
      evidence: ["Session demo-session-3", "Statusmønster: 500 x3", "Kontekster: submit_photo x3"],
      route: "/api/play/submit-photo",
      sessionId: "demo-session-3",
      status: 500,
      count: 3,
      uniqueParticipants: 2,
      uniqueSessions: 1,
      startedAt: getStaticFallbackTimestamp(32),
      lastSeenAt: getStaticFallbackTimestamp(4),
    },
    {
      id: "mock-correlation-cross-session",
      severity: "critical",
      kind: "cross-session-pattern",
      signal: "/api/join:500:join_error",
      title: "join-flow viser samme fejlmønster på tværs af sessioner",
      summary: "6 hændelser med samme route, status og fejlkontekst fordelt på 3 sessioner inden for 45 minutter.",
      recommendedAction:
        "Behandl dette som en fælles systemfejl og tjek auth-binding, participant-oprettelse og service-role adgang på tværs af løb.",
      evidence: ["Status 500 · kontekst join_error", "3 sessioner berørt · 5 deltagere berørt"],
      route: "/api/join",
      sessionId: null,
      status: 500,
      count: 6,
      uniqueParticipants: 5,
      uniqueSessions: 3,
      startedAt: getStaticFallbackTimestamp(40),
      lastSeenAt: getStaticFallbackTimestamp(2),
    },
  ] satisfies CorrelatedIncident[],
  generatedAt: getStaticFallbackTimestamp(),
  alarmWindowMinutes: 15,
  correlationWindowMinutes: 45,
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
    timeZone: DISPLAY_TIME_ZONE,
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

function getTelemetryTimestampValue(value: string | null) {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getTelemetryGroupActionLabel(log: TelemetryLogItem) {
  const status = getStatusCode(log);
  const routePath = getRoutePath(log);

  if (status === 401 && routePath === "/api/play/participant") {
    return "Adgang afvist";
  }

  if (status === 404 && routePath === "/api/play/participant") {
    return "Deltager ikke fundet";
  }

  if (log.eventType === "participant_auth_refresh_recovered" || log.eventType === "participant_auth_rebind_recovered") {
    return "Deltager-login genskabt";
  }

  if (log.eventType === "restore_success" || log.eventType === "wake_reconnect_recovered") {
    return "Elev genoprettet";
  }

  return translateTelemetryLog(log).replace(/\.$/, "");
}

function getTelemetryGroupSummary(group: GroupedTelemetryLog) {
  const action = getTelemetryGroupActionLabel(group.representative);
  const countLabel = `${group.count} ${group.count === 1 ? "gang" : "gange"}`;

  if (group.participantId && group.sessionId) {
    return `${action} ${countLabel} for samme elev i samme session`;
  }

  if (group.participantId) {
    return `${action} ${countLabel} for samme elev`;
  }

  if (group.sessionId) {
    return `${action} ${countLabel} i samme session`;
  }

  return `${action} ${countLabel} med samme signal`;
}

function getTelemetryGroupBadgeLabel(count: number) {
  return `x${count} ${count === 1 ? "hændelse" : "hændelser"}`;
}

function getTelemetryGroupContextLine(group: GroupedTelemetryLog) {
  const parts = [
    group.routePath ? `Route ${group.routePath}` : "",
    group.status !== null ? `Status ${group.status}` : `Event ${group.eventType}`,
    group.sessionId ? `Session ${group.sessionId}` : "",
    group.participantId ? `Deltager ${group.participantId}` : "",
    group.startedAt && group.lastSeenAt && group.startedAt !== group.lastSeenAt
      ? `${formatDateTime(group.startedAt)} til ${formatDateTime(group.lastSeenAt)}`
      : `Senest ${formatDateTime(group.lastSeenAt)}`,
  ].filter(Boolean);

  return parts.join(" · ");
}

function buildGroupedTelemetryLogs(logs: TelemetryLogItem[]) {
  const groups = new Map<string, GroupedTelemetryLog>();

  for (const log of logs) {
    const routePath = getRoutePath(log);
    const status = getStatusCode(log);
    const signalKey = status !== null ? `status:${status}` : `event:${log.eventType}`;
    const key = [
      log.sessionId ?? "__no_session__",
      log.participantId ?? "__no_participant__",
      routePath ?? "__no_route__",
      signalKey,
    ].join("::");
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      existing.items.push(log);

      if (log.createdAt && (!existing.startedAt || getTelemetryTimestampValue(log.createdAt) < getTelemetryTimestampValue(existing.startedAt))) {
        existing.startedAt = log.createdAt;
      }

      if (log.createdAt && (!existing.lastSeenAt || getTelemetryTimestampValue(log.createdAt) > getTelemetryTimestampValue(existing.lastSeenAt))) {
        existing.lastSeenAt = log.createdAt;
        existing.representative = log;
      }

      continue;
    }

    groups.set(key, {
      key,
      representative: log,
      items: [log],
      count: 1,
      participantId: log.participantId,
      sessionId: log.sessionId,
      routePath,
      status,
      eventType: log.eventType,
      startedAt: log.createdAt,
      lastSeenAt: log.createdAt,
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (left, right) => getTelemetryTimestampValue(right.createdAt) - getTelemetryTimestampValue(left.createdAt)
      ),
    }))
    .sort((left, right) => {
      const lastSeenDelta = getTelemetryTimestampValue(right.lastSeenAt) - getTelemetryTimestampValue(left.lastSeenAt);

      if (lastSeenDelta !== 0) {
        return lastSeenDelta;
      }

      return right.count - left.count;
    });
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

function getSeverityTone(severity: ActiveAlarmSeverity) {
  switch (severity) {
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
  return getSeverityTone(alarm.severity);
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

function getCorrelationKindLabel(kind: CorrelatedIncidentKind) {
  switch (kind) {
    case "session-cluster":
      return "Session-kluster";
    case "cross-session-pattern":
      return "Tværgående mønster";
    default:
      return "Reconnect-mønster";
  }
}

function getCorrelationMetaTags(incident: CorrelatedIncident) {
  const tags = [`type: ${getCorrelationKindLabel(incident.kind)}`, `signal: ${incident.signal}`];

  if (incident.route) tags.push(`route: ${incident.route}`);
  if (incident.sessionId) tags.push(`session: ${incident.sessionId}`);
  if (incident.status) tags.push(`status: ${incident.status}`);
  if (incident.uniqueParticipants > 0) tags.push(`elever: ${incident.uniqueParticipants}`);
  if (incident.uniqueSessions > 0) tags.push(`sessioner: ${incident.uniqueSessions}`);

  return tags;
}

function getDrilldownSearchText(log: TelemetryLogItem) {
  const meta = parseStructuredMeta(log.message);

  return [
    log.eventType,
    log.message,
    log.participantId,
    log.sessionId,
    meta?.route,
    meta?.path,
    meta?.status,
    meta?.context,
    meta?.msg,
    meta?.code,
    meta?.details,
    translateTelemetryLog(log),
    getTelemetryDetail(log),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("da-DK");
}

function getDrilldownGroupKey(log: TelemetryLogItem, groupBy: DrilldownGroupBy) {
  if (groupBy === "session") {
    return log.sessionId ?? "__no_session__";
  }

  if (groupBy === "event") {
    return log.eventType;
  }

  return getRoutePath(log) ?? "__no_route__";
}

function getDrilldownGroupLabel(log: TelemetryLogItem, groupBy: DrilldownGroupBy) {
  if (groupBy === "session") {
    return log.sessionId ?? "Uden session-id";
  }

  if (groupBy === "event") {
    return translateTelemetryLog(log);
  }

  return formatRouteLabel(getRoutePath(log));
}

function buildDrilldownGroups(logs: TelemetryLogItem[], groupBy: DrilldownGroupBy) {
  const groups = new Map<string, DrilldownGroup>();

  for (const log of logs) {
    const key = getDrilldownGroupKey(log, groupBy);
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      existing.items.push(log);
      if (log.participantId) {
        existing.uniqueParticipants = new Set(existing.items.map((item) => item.participantId).filter(Boolean)).size;
      }
      if (log.sessionId) {
        existing.uniqueSessions = new Set(existing.items.map((item) => item.sessionId).filter(Boolean)).size;
      }
      if (!existing.lastSeenAt || (log.createdAt && Date.parse(log.createdAt) > Date.parse(existing.lastSeenAt))) {
        existing.lastSeenAt = log.createdAt;
      }
      continue;
    }

    groups.set(key, {
      key,
      label: getDrilldownGroupLabel(log, groupBy),
      count: 1,
      items: [log],
      uniqueParticipants: log.participantId ? 1 : 0,
      uniqueSessions: log.sessionId ? 1 : 0,
      lastSeenAt: log.createdAt,
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return (Date.parse(right.lastSeenAt ?? "") || 0) - (Date.parse(left.lastSeenAt ?? "") || 0);
  });
}

function getLogMetaEntries(log: TelemetryLogItem) {
  const meta = parseStructuredMeta(log.message);
  return meta ? Object.entries(meta) : [];
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
  const [correlatedIncidents, setCorrelatedIncidents] = useState<CorrelatedIncident[]>(fallbackFeed.correlatedIncidents);
  const [dataSource, setDataSource] = useState<DataSourceMode>(fallbackFeed.dataSource);
  const [isLoading, setIsLoading] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState(fallbackFeed.fallbackMessage);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string>(fallbackFeed.generatedAt);
  const [alarmWindowMinutes, setAlarmWindowMinutes] = useState<number>(fallbackFeed.alarmWindowMinutes);
  const [correlationWindowMinutes, setCorrelationWindowMinutes] = useState<number>(fallbackFeed.correlationWindowMinutes);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(Date.now() + AUTO_REFRESH_MS);
  const [refreshCountdownMs, setRefreshCountdownMs] = useState(AUTO_REFRESH_MS);
  const [newAlarmIds, setNewAlarmIds] = useState<string[]>([]);
  const [newAlarmMessage, setNewAlarmMessage] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [drilldownQuery, setDrilldownQuery] = useState("");
  const [drilldownRoute, setDrilldownRoute] = useState("all");
  const [drilldownSession, setDrilldownSession] = useState("all");
  const [drilldownStatus, setDrilldownStatus] = useState("all");
  const [drilldownGroupBy, setDrilldownGroupBy] = useState<DrilldownGroupBy>("route");
  const [selectedDrilldownGroupKey, setSelectedDrilldownGroupKey] = useState<string>("all");
  const [selectedDrilldownLogId, setSelectedDrilldownLogId] = useState<string | null>(null);

  const previousAlarmIdsRef = useRef<string[]>([]);
  const deferredDrilldownQuery = useDeferredValue(drilldownQuery);

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
        const nextCorrelatedIncidents = payload.correlatedIncidents ?? fallbackFeed.correlatedIncidents;
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
        setCorrelatedIncidents(nextCorrelatedIncidents);
        setDataSource(payload.dataSource ?? "mock");
        setFallbackMessage(payload.fallbackMessage ?? "");
        setGeneratedAt(payload.generatedAt ?? new Date().toISOString());
        setAlarmWindowMinutes(payload.alarmWindowMinutes ?? fallbackFeed.alarmWindowMinutes);
        setCorrelationWindowMinutes(payload.correlationWindowMinutes ?? fallbackFeed.correlationWindowMinutes);

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
        setCorrelatedIncidents(fallbackFeed.correlatedIncidents);
        setDataSource("mock");
        setFallbackMessage(fallbackFeed.fallbackMessage);
        setGeneratedAt(new Date().toISOString());
        setAlarmWindowMinutes(fallbackFeed.alarmWindowMinutes);
        setCorrelationWindowMinutes(fallbackFeed.correlationWindowMinutes);
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
  const sessionCorrelationCount = useMemo(
    () => correlatedIncidents.filter((incident) => incident.kind === "session-cluster").length,
    [correlatedIncidents]
  );
  const crossSessionCorrelationCount = useMemo(
    () => correlatedIncidents.filter((incident) => incident.kind === "cross-session-pattern").length,
    [correlatedIncidents]
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
  const drilldownRouteOptions = useMemo(
    () =>
      Array.from(
        new Set(
          logs
            .map((log) => getRoutePath(log))
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right, "da-DK")),
    [logs]
  );
  const drilldownSessionOptions = useMemo(
    () =>
      Array.from(
        new Set(logs.map((log) => log.sessionId).filter((value): value is string => Boolean(value)))
      ).sort((left, right) => left.localeCompare(right, "da-DK")),
    [logs]
  );
  const drilldownStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          logs
            .map((log) => getStatusCode(log))
            .filter((value): value is number => value !== null)
            .map(String)
        )
      ).sort((left, right) => Number(left) - Number(right)),
    [logs]
  );
  const filteredDrilldownLogs = useMemo(
    () =>
      logs.filter((log) => {
        const route = getRoutePath(log) ?? "";
        const status = getStatusCode(log);
        const query = deferredDrilldownQuery.trim().toLocaleLowerCase("da-DK");

        if (drilldownRoute !== "all" && route !== drilldownRoute) {
          return false;
        }

        if (drilldownSession !== "all" && (log.sessionId ?? "") !== drilldownSession) {
          return false;
        }

        if (drilldownStatus !== "all" && String(status ?? "") !== drilldownStatus) {
          return false;
        }

        if (query && !getDrilldownSearchText(log).includes(query)) {
          return false;
        }

        return true;
      }),
    [deferredDrilldownQuery, drilldownRoute, drilldownSession, drilldownStatus, logs]
  );
  const drilldownGroups = useMemo(
    () => buildDrilldownGroups(filteredDrilldownLogs, drilldownGroupBy),
    [drilldownGroupBy, filteredDrilldownLogs]
  );
  const activeDrilldownLogs = useMemo(() => {
    if (selectedDrilldownGroupKey === "all") {
      return filteredDrilldownLogs;
    }

    return drilldownGroups.find((group) => group.key === selectedDrilldownGroupKey)?.items ?? [];
  }, [drilldownGroups, filteredDrilldownLogs, selectedDrilldownGroupKey]);
  const selectedDrilldownLog = useMemo(
    () => activeDrilldownLogs.find((log) => log.id === selectedDrilldownLogId) ?? activeDrilldownLogs[0] ?? null,
    [activeDrilldownLogs, selectedDrilldownLogId]
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
        label: "Korrelationsspor",
        value: String(correlatedIncidents.length),
        detail:
          correlatedIncidents.length > 0
            ? `${sessionCorrelationCount} sessionspecifikke · ${crossSessionCorrelationCount} tværgående mønstre`
            : `Ingen tydelige korrelationsspor i de seneste ${correlationWindowMinutes} min`,
      },
    ],
    [
      activeAlarms.length,
      alarmWindowMinutes,
      correlatedIncidents.length,
      correlationWindowMinutes,
      criticalAlarmCount,
      crossSessionCorrelationCount,
      degradedExternalCount,
      externalAlarmCount,
      lastEventAt,
      networkLogs.length,
      recoveryLogs.length,
      routeLoopAlarmCount,
      sessionCorrelationCount,
      serverErrorLogs.length,
      uniqueSessionCount,
      unresolvedExternalIncidentCount,
    ]
  );

  const statusCards = useMemo(
    () => [
      {
        label: "Kritiske",
        count: criticalAlarmCount,
        detail:
          criticalAlarmCount === 0
            ? "Ingen kritiske alarmer"
            : `${criticalAlarmCount} kræver hurtig handling`,
        isHealthy: criticalAlarmCount === 0,
      },
      {
        label: "Route-loops",
        count: routeLoopAlarmCount,
        detail:
          routeLoopAlarmCount === 0
            ? "Ingen route-loops registreret"
            : `${routeLoopAlarmCount} routes er i fejl-loop`,
        isHealthy: routeLoopAlarmCount === 0,
      },
      {
        label: "Eksterne signaler",
        count: degradedExternalCount,
        detail:
          degradedExternalCount === 0
            ? "Ingen aktive leverandørsignaler"
            : `${degradedExternalCount} leverandørsignaler kræver tjek`,
        isHealthy: degradedExternalCount === 0,
      },
    ],
    [criticalAlarmCount, degradedExternalCount, routeLoopAlarmCount]
  );

  const compactSystemInfo = useMemo(
    () => [
      { label: "Feed", value: dataSource === "live" ? "Live" : "Fallback" },
      { label: "Senest", value: formatDateTime(generatedAt) },
      {
        label: "Auto-refresh",
        value: autoRefreshEnabled ? formatCountdown(refreshCountdownMs) : "Pauset",
      },
      { label: "Browseralarmer", value: getNotificationStatusLabel(notificationPermission) },
    ],
    [autoRefreshEnabled, dataSource, generatedAt, notificationPermission, refreshCountdownMs]
  );

  const visibleLogGroups = useMemo(() => buildGroupedTelemetryLogs(logs), [logs]);

  useEffect(() => {
    if (selectedDrilldownGroupKey === "all") {
      return;
    }

    if (!drilldownGroups.some((group) => group.key === selectedDrilldownGroupKey)) {
      setSelectedDrilldownGroupKey("all");
    }
  }, [drilldownGroups, selectedDrilldownGroupKey]);

  useEffect(() => {
    if (!selectedDrilldownLogId) {
      return;
    }

    if (!activeDrilldownLogs.some((log) => log.id === selectedDrilldownLogId)) {
      setSelectedDrilldownLogId(activeDrilldownLogs[0]?.id ?? null);
    }
  }, [activeDrilldownLogs, selectedDrilldownLogId]);

  const clearDrilldownFilters = () => {
    setDrilldownQuery("");
    setDrilldownRoute("all");
    setDrilldownSession("all");
    setDrilldownStatus("all");
    setSelectedDrilldownGroupKey("all");
    setSelectedDrilldownLogId(null);
  };

  const focusDrilldown = ({
    route,
    sessionId,
    status,
    search,
  }: {
    route?: string | null;
    sessionId?: string | null;
    status?: number | null;
    search?: string | null;
  }) => {
    setDrilldownRoute(route && route.trim() ? route : "all");
    setDrilldownSession(sessionId && sessionId.trim() ? sessionId : "all");
    setDrilldownStatus(status ? String(status) : "all");
    setDrilldownQuery(search && search.trim() ? search : "");
    setSelectedDrilldownGroupKey("all");
    setSelectedDrilldownLogId(null);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("drilldown-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <div className={`min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8 ${poppins.className}`}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 text-right text-sm text-slate-300/78">Opdateret {formatDateTime(generatedAt)}</div>

        <div className="grid gap-4 md:grid-cols-3">
          {statusCards.map((card) => {
            const cardTone = card.isHealthy
              ? {
                  card: "border-emerald-300/30 bg-emerald-500/12",
                  badge: "border-emerald-300/30 bg-emerald-400/15 text-emerald-50",
                  label: "text-emerald-100/80",
                  value: "text-emerald-50",
                  detail: "text-emerald-50/88",
                }
              : {
                  card: "border-rose-300/30 bg-rose-500/12",
                  badge: "border-rose-300/30 bg-rose-400/15 text-rose-50",
                  label: "text-rose-100/80",
                  value: "text-rose-50",
                  detail: "text-rose-50/88",
                };

            return (
              <article key={card.label} className={`rounded-[1.8rem] border p-5 shadow-[0_22px_48px_rgba(15,23,42,0.16)] ${cardTone.card}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${cardTone.label}`}>{card.label}</p>
                    <p className={`mt-3 text-5xl font-black ${rubik.className} ${cardTone.value}`}>{card.count}</p>
                    <p className={`mt-3 text-sm leading-6 ${cardTone.detail}`}>{card.detail}</p>
                  </div>

                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${cardTone.badge}`}>
                    {card.isHealthy ? <CheckCircle2 className="h-6 w-6" /> : <TriangleAlert className="h-6 w-6" />}
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        <section className="mt-6 rounded-4xl border border-white/10 bg-white/5 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className={`text-xl font-black text-white ${rubik.className}`}>Overblik / Grupperet feed</h2>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300/85">
              {visibleLogGroups.length} grupper
            </span>
          </div>

          {isLoading ? (
            <EmptyState title="Indlæser telemetry" body="Henter seneste hændelser." />
          ) : visibleLogGroups.length === 0 ? (
            <EmptyState title="Ingen hændelser at vise" body="Der ligger ingen telemetry-hændelser i perioden." />
          ) : (
            <div className="space-y-4">
              {visibleLogGroups.map((group) => (
                <article
                  key={group.key}
                  className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 shadow-[0_18px_36px_rgba(15,23,42,0.16)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-base font-semibold text-white">{translateTelemetryLog(group.representative)}</p>

                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-50/92">
                      {getTelemetryGroupBadgeLabel(group.count)}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[1.25rem] border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50/92">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Anbefalet handling</p>
                    <p className="mt-2 leading-6">{getTelemetryRecommendedAction(group.representative)}</p>
                  </div>

                  <details className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/3 p-4">
                    <summary className="cursor-pointer list-none focus:outline-none">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/78">Teknisk kontekst</p>
                        <p className="text-xs text-slate-400/80">Fold ud ved behov</p>
                      </div>
                    </summary>

                    <div className="mt-4">
                      <p className="text-xs leading-6 text-slate-400/88">{getTelemetryGroupContextLine(group)}</p>

                      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-300/75">
                        {getTelemetryTags(group.representative).map((tag) => (
                          <span key={`${group.key}-${tag}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 space-y-3">
                        {group.items.map((log) => (
                          <div
                            key={log.id}
                            className="rounded-2xl border border-white/8 bg-slate-950/55 p-3 text-sm text-slate-200/88"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-slate-400/82">
                              <span className="font-semibold uppercase tracking-[0.12em] text-slate-300/82">{log.eventType}</span>
                              <time>{formatDateTime(log.createdAt)}</time>
                            </div>
                            <p className="mt-2 wrap-break-word font-mono text-xs leading-6 text-slate-200/88">
                              {log.message || "Ingen rå loglinje"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}