import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type TelemetryLogRow = {
  id?: string | number | null;
  event_type?: string | null;
  participant_id?: string | null;
  session_id?: string | null;
  message?: string | null;
  created_at?: string | null;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
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

type ActiveAlarmSeverity = "critical" | "high" | "warning";

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

type StatuspageStatusResponse = {
  page?: {
    name?: string;
    url?: string;
    updated_at?: string;
  };
  status?: {
    indicator?: string;
    description?: string;
  };
};

type StatuspageIncidentsResponse = {
  incidents?: Array<{
    id?: string;
    name?: string;
    status?: string;
    impact?: string;
    shortlink?: string;
    created_at?: string;
    updated_at?: string;
  }>;
};

type StructuredLogMeta = Record<string, string>;

type RouteAlarmBucket = {
  route: string;
  count: number;
  uniqueParticipants: Set<string>;
  uniqueSessions: Set<string>;
  statusCounts: Map<string, number>;
  contextCounts: Map<string, number>;
  startedAt: number | null;
  lastSeenAt: number | null;
};

type SessionCorrelationBucket = {
  sessionId: string;
  route: string | null;
  signal: string;
  count: number;
  uniqueParticipants: Set<string>;
  statusCounts: Map<string, number>;
  contextCounts: Map<string, number>;
  startedAt: number | null;
  lastSeenAt: number | null;
};

type CrossSessionPatternBucket = {
  route: string;
  status: number | null;
  context: string;
  count: number;
  uniqueParticipants: Set<string>;
  uniqueSessions: Set<string>;
  startedAt: number | null;
  lastSeenAt: number | null;
};

type ReconnectCorrelationBucket = {
  signal: string;
  count: number;
  uniqueParticipants: Set<string>;
  uniqueSessions: Set<string>;
  startedAt: number | null;
  lastSeenAt: number | null;
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ACTIVE_ALARM_WINDOW_MINUTES = 15;
const ACTIVE_ALARM_WINDOW_MS = ACTIVE_ALARM_WINDOW_MINUTES * 60 * 1000;
const CORRELATION_WINDOW_MINUTES = 45;
const CORRELATION_WINDOW_MS = CORRELATION_WINDOW_MINUTES * 60 * 1000;

const RECONNECT_EVENT_SET = new Set([
  "participant_restore_exhausted",
  "wake_reconnect_failed",
  "auth_error",
]);

const CRITICAL_ROUTES = new Set([
  "/api/join",
  "/api/play/participant",
  "/api/play/session",
  "/api/play/status",
  "/api/play/location",
  "/api/play/submit-answer",
  "/api/play/submit-photo",
  "/api/checkout",
  "/api/webhook/stripe",
]);

const mockTelemetryLogs: TelemetryLogRow[] = [
  {
    id: "mock-restore-exhausted-1",
    event_type: "participant_restore_exhausted",
    participant_id: "demo-participant-1",
    session_id: "demo-session-1",
    message: "reason=wake_reconnect_failed",
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-participant-401-1",
    event_type: "server_response_error",
    participant_id: "demo-participant-2",
    session_id: "demo-session-1",
    message:
      "meta:kind=response|source=route-response|route=/api/play/participant|path=/api/play/participant?sessionId=demo-session-1|method=GET|status=401|msg=Unauthorized",
    created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-participant-401-2",
    event_type: "server_response_error",
    participant_id: "demo-participant-3",
    session_id: "demo-session-2",
    message:
      "meta:kind=response|source=route-response|route=/api/play/participant|path=/api/play/participant?sessionId=demo-session-2|method=GET|status=401|msg=Unauthorized",
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-join-loop-1",
    event_type: "server_handled_error",
    participant_id: null,
    session_id: "demo-session-3",
    message:
      "meta:kind=handled|source=route-catch|route=/api/join|path=/api/join|method=POST|status=500|type=route|msg=Kunne ikke registrere deltageren.",
    created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-join-loop-2",
    event_type: "server_handled_error",
    participant_id: null,
    session_id: "demo-session-4",
    message:
      "meta:kind=handled|source=route-catch|route=/api/join|path=/api/join|method=POST|status=500|type=route|msg=Kunne ikke registrere deltageren.",
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-join-loop-3",
    event_type: "server_handled_error",
    participant_id: null,
    session_id: "demo-session-5",
    message:
      "meta:kind=handled|source=route-catch|route=/api/join|path=/api/join|method=POST|status=500|type=route|msg=Kunne ikke registrere deltageren.",
    created_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
  },
];

const externalProviders = [
  {
    provider: "vercel",
    name: "Vercel",
    statusUrl: "https://www.vercel-status.com",
    statusApiUrl: "https://www.vercel-status.com/api/v2/status.json",
    incidentsApiUrl: "https://www.vercel-status.com/api/v2/incidents/unresolved.json",
  },
  {
    provider: "supabase",
    name: "Supabase",
    statusUrl: "https://status.supabase.com",
    statusApiUrl: "https://status.supabase.com/api/v2/status.json",
    incidentsApiUrl: "https://status.supabase.com/api/v2/incidents/unresolved.json",
  },
] as const;

const fallbackExternalServices: ExternalServiceStatus[] = [
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
];

function getTelemetryFallbackMessage(error: SupabaseErrorLike | null) {
  if (!error) {
    return "Live telemetry kunne ikke læses. Siden viser en skal, indtil databasen svarer igen.";
  }

  const combined = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLocaleLowerCase("da-DK");

  if (combined.includes("telemetry_logs") && (combined.includes("does not exist") || combined.includes("pgrst205"))) {
    return "telemetry_logs kunne ikke findes. Siden viser en skal, indtil tabellen er tilgængelig.";
  }

  if (combined.includes("42501") || combined.includes("permission") || combined.includes("policy")) {
    return "telemetry_logs findes, men serveren kunne ikke læse tabellen. Siden viser en skal i stedet for live-data.";
  }

  return "Live telemetry kunne ikke læses. Siden viser en skal, indtil tabellen eller læseadgangen er på plads.";
}

function parseStructuredMeta(message?: string | null): StructuredLogMeta | null {
  if (!message || !message.startsWith("meta:")) {
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

function toTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function toIsoString(timestamp: number | null) {
  return timestamp ? new Date(timestamp).toISOString() : null;
}

function getStatusCode(log: TelemetryLogRow) {
  const meta = parseStructuredMeta(log.message);
  const fromMeta = Number(meta?.status ?? "");
  if (Number.isFinite(fromMeta) && fromMeta > 0) {
    return fromMeta;
  }

  const match = (log.message ?? "").match(/\b(401|404|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

function getRoutePath(log: TelemetryLogRow) {
  const meta = parseStructuredMeta(log.message);
  if (meta?.route) {
    return meta.route;
  }

  const routeMatch = (log.message ?? "").match(/\/api\/[A-Za-z0-9\-/]+/);
  return routeMatch ? routeMatch[0] : null;
}

function getContext(log: TelemetryLogRow) {
  const meta = parseStructuredMeta(log.message);
  if (meta?.context) {
    return meta.context;
  }

  return typeof log.event_type === "string" ? log.event_type : null;
}

function addToCountMap(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
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

function getRouteRecommendedAction(routePath: string | null) {
  switch (routePath) {
    case "/api/join":
      return "Tjek deltager-oprettelse, auth-binding og Supabase service-role adgang med det samme. Når join-flowet fejler i bølger, kan nye elever ikke komme ind i løbet.";
    case "/api/play/participant":
      return "Tjek deltager-auth og restore-flow. Hvis mange elever rammes samtidigt, er problemet sandsynligvis sessionbinding eller auth-genopretning og ikke enkelte elevtelefoner.";
    case "/api/play/session":
    case "/api/play/status":
      return "Tjek live_sessions, runs-data og Supabase-adgang. Fejl her giver typisk stuck loading og manglende missioner hos eleverne.";
    case "/api/play/location":
      return "Tjek realtime- og databaseadgang for positionssynk. Hvis mange sessioner er berørt, så behandle det som en platformfejl og ikke et enkelt device-problem.";
    case "/api/play/submit-answer":
    case "/api/play/submit-photo":
      return "Tjek insert/update-fejl i answers og eventuel storage-adgang. Hvis alarmen vokser, bør lærere informeres om at gemme svar manuelt midlertidigt.";
    case "/api/checkout":
    case "/api/webhook/stripe":
      return "Tjek Stripe-konfiguration, webhook-hemmeligheder og profiles-opdateringer. Stop eventuelle betalingsflows, hvis fejlene fortsætter, så brugere ikke sidder fast halvvejs.";
    default:
      return "Åbn de tekniske loglinjer for den berørte route og afgør hurtigt, om fejlen er sessionlokal eller rammer flere lærere og elever samtidigt.";
  }
}

function getExternalRecommendedAction(service: ExternalServiceStatus) {
  if (service.source === "unavailable") {
    return "Statusfeeden kunne ikke hentes. Verificer leverandørens statusside manuelt, før du konkluderer at problemet ligger i vores egen kode.";
  }

  if (service.indicator !== "none" || service.incidents.length > 0) {
    return `Tjek ${service.name}-statussiden først. Informer lærere om ekstern driftspåvirkning og undgå at bruge tid på lokal klientfejlsøgning, mens leverandøren er gul eller rød.`;
  }

  return "Ingen ekstern driftspåvirkning registreret lige nu.";
}

function createAlarmId(...parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part): part is string | number => part !== null && part !== undefined && part !== "")
    .map((part) => String(part).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .join("-");
}

function formatStatusBreakdown(statusCounts: Map<string, number>) {
  const parts = Array.from(statusCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([status, count]) => `${status} x${count}`);

  return parts.length > 0 ? parts.join(" · ") : "ingen statusdata";
}

function formatContextBreakdown(contextCounts: Map<string, number>) {
  const parts = Array.from(contextCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([context, count]) => `${context} x${count}`);

  return parts.length > 0 ? parts.join(" · ") : "ingen kendt fejlkontekst";
}

function severityWeight(severity: ActiveAlarmSeverity) {
  switch (severity) {
    case "critical":
      return 3;
    case "high":
      return 2;
    default:
      return 1;
  }
}

function deriveCorrelatedIncidents(telemetryLogs: TelemetryLogRow[]) {
  const now = Date.now();
  const recentLogs = telemetryLogs.filter((log) => {
    const timestamp = toTimestamp(log.created_at);
    return timestamp !== null && timestamp >= now - CORRELATION_WINDOW_MS;
  });

  const incidents: CorrelatedIncident[] = [];
  const sessionBuckets = new Map<string, SessionCorrelationBucket>();
  const crossSessionBuckets = new Map<string, CrossSessionPatternBucket>();
  const reconnectBuckets = new Map<string, ReconnectCorrelationBucket>();

  for (const log of recentLogs) {
    const status = getStatusCode(log);
    const route = getRoutePath(log);
    const context = getContext(log) ?? "ukendt_kontekst";
    const isReconnectSignal = RECONNECT_EVENT_SET.has(log.event_type ?? "") || (route === "/api/play/participant" && (status === 401 || status === 404));
    const isErrorSignal = status !== null && (status >= 500 || (route === "/api/play/participant" && (status === 401 || status === 404)));
    const timestamp = toTimestamp(log.created_at);

    if (isReconnectSignal) {
      const reconnectSignal = route === "/api/play/participant" && status ? `${route}:${status}` : context;
      const reconnectBucket =
        reconnectBuckets.get(reconnectSignal) ??
        {
          signal: reconnectSignal,
          count: 0,
          uniqueParticipants: new Set<string>(),
          uniqueSessions: new Set<string>(),
          startedAt: null,
          lastSeenAt: null,
        };

      reconnectBucket.count += 1;
      if (log.participant_id) {
        reconnectBucket.uniqueParticipants.add(log.participant_id);
      }
      if (log.session_id) {
        reconnectBucket.uniqueSessions.add(log.session_id);
      }
      if (timestamp !== null) {
        reconnectBucket.startedAt = reconnectBucket.startedAt === null ? timestamp : Math.min(reconnectBucket.startedAt, timestamp);
        reconnectBucket.lastSeenAt = reconnectBucket.lastSeenAt === null ? timestamp : Math.max(reconnectBucket.lastSeenAt, timestamp);
      }

      reconnectBuckets.set(reconnectSignal, reconnectBucket);
    }

    if (log.session_id && (isErrorSignal || isReconnectSignal)) {
      const sessionSignal = route ?? (isReconnectSignal ? context : "ukendt_signal");
      const sessionBucketKey = `${log.session_id}|${sessionSignal}`;
      const sessionBucket =
        sessionBuckets.get(sessionBucketKey) ??
        {
          sessionId: log.session_id,
          route,
          signal: sessionSignal,
          count: 0,
          uniqueParticipants: new Set<string>(),
          statusCounts: new Map<string, number>(),
          contextCounts: new Map<string, number>(),
          startedAt: null,
          lastSeenAt: null,
        };

      sessionBucket.count += 1;
      if (log.participant_id) {
        sessionBucket.uniqueParticipants.add(log.participant_id);
      }
      if (status !== null) {
        addToCountMap(sessionBucket.statusCounts, String(status));
      }
      addToCountMap(sessionBucket.contextCounts, context);
      if (timestamp !== null) {
        sessionBucket.startedAt = sessionBucket.startedAt === null ? timestamp : Math.min(sessionBucket.startedAt, timestamp);
        sessionBucket.lastSeenAt = sessionBucket.lastSeenAt === null ? timestamp : Math.max(sessionBucket.lastSeenAt, timestamp);
      }

      sessionBuckets.set(sessionBucketKey, sessionBucket);
    }

    if (route && isErrorSignal) {
      const crossSessionKey = `${route}|${status ?? "none"}|${context}`;
      const crossSessionBucket =
        crossSessionBuckets.get(crossSessionKey) ??
        {
          route,
          status,
          context,
          count: 0,
          uniqueParticipants: new Set<string>(),
          uniqueSessions: new Set<string>(),
          startedAt: null,
          lastSeenAt: null,
        };

      crossSessionBucket.count += 1;
      if (log.participant_id) {
        crossSessionBucket.uniqueParticipants.add(log.participant_id);
      }
      if (log.session_id) {
        crossSessionBucket.uniqueSessions.add(log.session_id);
      }
      if (timestamp !== null) {
        crossSessionBucket.startedAt = crossSessionBucket.startedAt === null ? timestamp : Math.min(crossSessionBucket.startedAt, timestamp);
        crossSessionBucket.lastSeenAt = crossSessionBucket.lastSeenAt === null ? timestamp : Math.max(crossSessionBucket.lastSeenAt, timestamp);
      }

      crossSessionBuckets.set(crossSessionKey, crossSessionBucket);
    }
  }

  for (const bucket of sessionBuckets.values()) {
    if (bucket.count < 2) {
      continue;
    }

    const dominantStatus = Array.from(bucket.statusCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const severity: ActiveAlarmSeverity =
      bucket.count >= 5 || bucket.uniqueParticipants.size >= 4
        ? "critical"
        : bucket.count >= 3 || bucket.uniqueParticipants.size >= 2
          ? "high"
          : "warning";
    const routeLabel = bucket.route ? formatRouteLabel(bucket.route) : "reconnect-flow";

    incidents.push({
      id: createAlarmId("correlation", "session", bucket.sessionId, bucket.signal),
      severity,
      kind: "session-cluster",
      signal: bucket.signal,
      title: `${routeLabel} er koncentreret i én session`,
      summary: `${bucket.count} hændelser i samme session inden for ${CORRELATION_WINDOW_MINUTES} minutter. Det peger på et problem, der er samlet i ét løb frem for bred platformstøj.`,
      recommendedAction: `${getRouteRecommendedAction(bucket.route)} Fokuser først på den berørte session, fordi mønsteret er koncentreret dér.`,
      evidence: [
        `Session ${bucket.sessionId}`,
        `Statusmønster: ${formatStatusBreakdown(bucket.statusCounts)}`,
        `Kontekster: ${formatContextBreakdown(bucket.contextCounts)}`,
      ],
      route: bucket.route,
      sessionId: bucket.sessionId,
      status: dominantStatus ? Number(dominantStatus) : null,
      count: bucket.count,
      uniqueParticipants: bucket.uniqueParticipants.size,
      uniqueSessions: 1,
      startedAt: toIsoString(bucket.startedAt),
      lastSeenAt: toIsoString(bucket.lastSeenAt),
    });
  }

  for (const bucket of crossSessionBuckets.values()) {
    if (bucket.count < 3 || (bucket.uniqueSessions.size < 2 && bucket.uniqueParticipants.size < 4)) {
      continue;
    }

    const severity: ActiveAlarmSeverity =
      (CRITICAL_ROUTES.has(bucket.route) && bucket.uniqueSessions.size >= 3) || bucket.count >= 6
        ? "critical"
        : bucket.count >= 4 || bucket.uniqueSessions.size >= 2
          ? "high"
          : "warning";

    incidents.push({
      id: createAlarmId("correlation", "cross-session", bucket.route, bucket.status, bucket.context),
      severity,
      kind: "cross-session-pattern",
      signal: `${bucket.route}:${bucket.status ?? "none"}:${bucket.context}`,
      title: `${formatRouteLabel(bucket.route)} viser samme fejlmønster på tværs af sessioner`,
      summary: `${bucket.count} hændelser med samme route, status og fejlkontekst fordelt på ${bucket.uniqueSessions.size} sessioner inden for ${CORRELATION_WINDOW_MINUTES} minutter.`,
      recommendedAction: `${getRouteRecommendedAction(bucket.route)} Fordi mønsteret går på tværs af sessioner, bør det behandles som en fælles systemfejl og ikke kun som et enkelt løb.`,
      evidence: [
        `Status ${bucket.status ?? "ukendt"} · kontekst ${bucket.context}`,
        `${bucket.uniqueSessions.size} sessioner berørt · ${bucket.uniqueParticipants.size} deltagere berørt`,
      ],
      route: bucket.route,
      sessionId: null,
      status: bucket.status,
      count: bucket.count,
      uniqueParticipants: bucket.uniqueParticipants.size,
      uniqueSessions: bucket.uniqueSessions.size,
      startedAt: toIsoString(bucket.startedAt),
      lastSeenAt: toIsoString(bucket.lastSeenAt),
    });
  }

  for (const bucket of reconnectBuckets.values()) {
    if (bucket.count < 4 || (bucket.uniqueParticipants.size < 3 && bucket.uniqueSessions.size < 2)) {
      continue;
    }

    const severity: ActiveAlarmSeverity =
      bucket.count >= 8 || bucket.uniqueParticipants.size >= 5 ? "critical" : "high";

    incidents.push({
      id: createAlarmId("correlation", "reconnect", bucket.signal),
      severity,
      kind: "reconnect-pattern",
      signal: bucket.signal,
      title: "Samme reconnect-signal rammer flere elever",
      summary: `${bucket.count} reconnect-relaterede hændelser med samme signal fordelt på ${bucket.uniqueParticipants.size} elever i ${bucket.uniqueSessions.size} sessioner inden for ${CORRELATION_WINDOW_MINUTES} minutter.`,
      recommendedAction:
        "Behandl dette som et fælles reconnect-mønster. Sammenlign de berørte sessioner for at afgøre, om problemet ligger i auth, restore-flow eller i /api/play/participant-svaret.",
      evidence: [
        `Signal ${bucket.signal}`,
        `${bucket.uniqueParticipants.size} elever berørt · ${bucket.uniqueSessions.size} sessioner berørt`,
      ],
      route: bucket.signal.startsWith("/api/") ? bucket.signal.split(":")[0] : "/api/play/participant",
      sessionId: null,
      status: bucket.signal.includes(":401") ? 401 : bucket.signal.includes(":404") ? 404 : null,
      count: bucket.count,
      uniqueParticipants: bucket.uniqueParticipants.size,
      uniqueSessions: bucket.uniqueSessions.size,
      startedAt: toIsoString(bucket.startedAt),
      lastSeenAt: toIsoString(bucket.lastSeenAt),
    });
  }

  return incidents.sort((left, right) => {
    const severityDelta = severityWeight(right.severity) - severityWeight(left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const lastSeenDelta = (toTimestamp(right.lastSeenAt) ?? 0) - (toTimestamp(left.lastSeenAt) ?? 0);
    if (lastSeenDelta !== 0) {
      return lastSeenDelta;
    }

    return right.count - left.count;
  });
}

function deriveActiveAlarms(telemetryLogs: TelemetryLogRow[], externalServices: ExternalServiceStatus[]) {
  const now = Date.now();
  const recentLogs = telemetryLogs.filter((log) => {
    const timestamp = toTimestamp(log.created_at);
    return timestamp !== null && timestamp >= now - ACTIVE_ALARM_WINDOW_MS;
  });

  const alarms: ActiveAlarm[] = [];

  for (const service of externalServices) {
    const hasIncidentSignal = service.source === "unavailable" || service.indicator !== "none" || service.incidents.length > 0;
    if (!hasIncidentSignal) {
      continue;
    }

    const severity: ActiveAlarmSeverity =
      service.source === "unavailable"
        ? "warning"
        : service.indicator === "critical" || service.indicator === "major" || service.incidents.length >= 2
          ? "critical"
          : "high";

    const summary =
      service.source === "unavailable"
        ? `${service.name}-statusfeeden kunne ikke hentes, så eksterne incidents kan være skjult.`
        : `${service.incidents.length} åbne incidents og leverandørstatus "${translateExternalIndicator(service.indicator)}".`;

    const evidence =
      service.incidents.length > 0
        ? service.incidents.slice(0, 3).map((incident) => `${incident.title} · ${incident.impact} · ${incident.status}`)
        : [service.errorMessage || service.description];

    alarms.push({
      id: createAlarmId("external", service.provider, service.indicator, service.incidents.length),
      severity,
      category: "external",
      source: "external",
      signal: service.provider,
      title:
        service.source === "unavailable"
          ? `Statusfeed for ${service.name} kan ikke læses`
          : `${service.name} melder driftsproblemer`,
      summary,
      recommendedAction: getExternalRecommendedAction(service),
      evidence,
      count: Math.max(service.incidents.length, 1),
      uniqueParticipants: 0,
      uniqueSessions: 0,
      route: null,
      provider: service.provider,
      status: null,
      startedAt: service.incidents[0]?.createdAt ?? service.updatedAt,
      lastSeenAt: service.incidents[0]?.updatedAt ?? service.updatedAt,
    });
  }

  const reconnectFailureLogs = recentLogs.filter((log) => {
    const status = getStatusCode(log);
    const route = getRoutePath(log);
    return (
      log.event_type === "participant_restore_exhausted" ||
      log.event_type === "wake_reconnect_failed" ||
      log.event_type === "auth_error" ||
      (route === "/api/play/participant" && (status === 401 || status === 404))
    );
  });

  if (reconnectFailureLogs.length > 0) {
    const participantIds = new Set<string>();
    const sessionIds = new Set<string>();
    const signalCounts = new Map<string, number>();
    let firstSeenAt: number | null = null;
    let lastSeenAt: number | null = null;

    for (const log of reconnectFailureLogs) {
      if (log.participant_id) {
        participantIds.add(log.participant_id);
      }

      if (log.session_id) {
        sessionIds.add(log.session_id);
      }

      const route = getRoutePath(log);
      const status = getStatusCode(log);
      const signal = route === "/api/play/participant" && status ? `${route}:${status}` : log.event_type ?? "ukendt";
      addToCountMap(signalCounts, signal);

      const timestamp = toTimestamp(log.created_at);
      if (timestamp !== null) {
        firstSeenAt = firstSeenAt === null ? timestamp : Math.min(firstSeenAt, timestamp);
        lastSeenAt = lastSeenAt === null ? timestamp : Math.max(lastSeenAt, timestamp);
      }
    }

    if (reconnectFailureLogs.length >= 4 && (participantIds.size >= 3 || sessionIds.size >= 2)) {
      const severity: ActiveAlarmSeverity =
        reconnectFailureLogs.length >= 8 || participantIds.size >= 5 ? "critical" : "high";

      alarms.push({
        id: createAlarmId("student-spike", "reconnect", participantIds.size, sessionIds.size),
        severity,
        category: "student-spike",
        source: "telemetry",
        signal: "student_reconnect_spike",
        title: "Mange elever rammes af genopkoblingsfejl",
        summary: `${reconnectFailureLogs.length} reconnect-relaterede fejl på ${ACTIVE_ALARM_WINDOW_MINUTES} minutter for ${participantIds.size} elever i ${sessionIds.size} sessioner.`,
        recommendedAction:
          "Tjek om auth- eller restore-flowet fejler bredt lige nu. Informer lærere om, at elever skal blive på samme enhed og bruge Genopret forbindelse, mens du verificerer om fejlen er global.",
        evidence: [
          `Signaler: ${formatContextBreakdown(signalCounts)}`,
          `${participantIds.size} elever berørt · ${sessionIds.size} sessioner berørt`,
        ],
        count: reconnectFailureLogs.length,
        uniqueParticipants: participantIds.size,
        uniqueSessions: sessionIds.size,
        route: "/api/play/participant",
        provider: null,
        status: null,
        startedAt: toIsoString(firstSeenAt),
        lastSeenAt: toIsoString(lastSeenAt),
      });
    }
  }

  const routeBuckets = new Map<string, RouteAlarmBucket>();

  for (const log of recentLogs) {
    const status = getStatusCode(log);
    if (status === null || status < 500) {
      continue;
    }

    const route = getRoutePath(log) ?? "ukendt-route";
    const bucket =
      routeBuckets.get(route) ??
      {
        route,
        count: 0,
        uniqueParticipants: new Set<string>(),
        uniqueSessions: new Set<string>(),
        statusCounts: new Map<string, number>(),
        contextCounts: new Map<string, number>(),
        startedAt: null,
        lastSeenAt: null,
      };

    bucket.count += 1;
    if (log.participant_id) {
      bucket.uniqueParticipants.add(log.participant_id);
    }
    if (log.session_id) {
      bucket.uniqueSessions.add(log.session_id);
    }

    addToCountMap(bucket.statusCounts, String(status));
    addToCountMap(bucket.contextCounts, getContext(log) ?? "ukendt_kontekst");

    const timestamp = toTimestamp(log.created_at);
    if (timestamp !== null) {
      bucket.startedAt = bucket.startedAt === null ? timestamp : Math.min(bucket.startedAt, timestamp);
      bucket.lastSeenAt = bucket.lastSeenAt === null ? timestamp : Math.max(bucket.lastSeenAt, timestamp);
    }

    routeBuckets.set(route, bucket);
  }

  for (const bucket of routeBuckets.values()) {
    const threshold = CRITICAL_ROUTES.has(bucket.route) ? 3 : 5;
    if (bucket.count < threshold) {
      continue;
    }

    const severity: ActiveAlarmSeverity = CRITICAL_ROUTES.has(bucket.route)
      ? bucket.count >= 6 || bucket.uniqueSessions.size >= 3
        ? "critical"
        : "high"
      : bucket.count >= 8 || bucket.uniqueSessions.size >= 3
        ? "high"
        : "warning";

    const dominantStatus = Array.from(bucket.statusCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

    alarms.push({
      id: createAlarmId("route-loop", bucket.route, dominantStatus),
      severity,
      category: "route-loop",
      source: "telemetry",
      signal: `route_loop:${bucket.route}`,
      title: `${formatRouteLabel(bucket.route)} fejler gentagne gange`,
      summary: `${bucket.count} serverfejl på ${formatRouteLabel(bucket.route)} inden for ${ACTIVE_ALARM_WINDOW_MINUTES} minutter.`,
      recommendedAction: getRouteRecommendedAction(bucket.route),
      evidence: [
        `Statusmønster: ${formatStatusBreakdown(bucket.statusCounts)}`,
        `Kontekster: ${formatContextBreakdown(bucket.contextCounts)}`,
        `${bucket.uniqueParticipants.size} deltagere · ${bucket.uniqueSessions.size} sessioner berørt`,
      ],
      count: bucket.count,
      uniqueParticipants: bucket.uniqueParticipants.size,
      uniqueSessions: bucket.uniqueSessions.size,
      route: bucket.route,
      provider: null,
      status: dominantStatus ? Number(dominantStatus) : null,
      startedAt: toIsoString(bucket.startedAt),
      lastSeenAt: toIsoString(bucket.lastSeenAt),
    });
  }

  return alarms.sort((left, right) => {
    const severityDelta = severityWeight(right.severity) - severityWeight(left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const lastSeenDelta = (toTimestamp(right.lastSeenAt) ?? 0) - (toTimestamp(left.lastSeenAt) ?? 0);
    if (lastSeenDelta !== 0) {
      return lastSeenDelta;
    }

    return right.count - left.count;
  });
}

async function fetchExternalProviderSnapshot(provider: (typeof externalProviders)[number]): Promise<ExternalServiceStatus> {
  try {
    const [statusResult, incidentsResult] = await Promise.all([
      fetch(provider.statusApiUrl, { cache: "no-store" }),
      fetch(provider.incidentsApiUrl, { cache: "no-store" }),
    ]);

    if (!statusResult.ok || !incidentsResult.ok) {
      throw new Error(`Status API svarede med ${statusResult.status}/${incidentsResult.status}`);
    }

    const [statusPayload, incidentsPayload] = (await Promise.all([
      statusResult.json(),
      incidentsResult.json(),
    ])) as [StatuspageStatusResponse, StatuspageIncidentsResponse];

    return {
      provider: provider.provider,
      name: provider.name,
      source: "live",
      statusUrl: provider.statusUrl,
      indicator: statusPayload.status?.indicator ?? "unknown",
      description: statusPayload.status?.description ?? "Ukendt status",
      updatedAt: statusPayload.page?.updated_at ?? null,
      incidents: (incidentsPayload.incidents ?? []).map((incident, index) => ({
        id: incident.id ?? `${provider.provider}-${index}`,
        title: incident.name ?? "Ukendt incident",
        status: incident.status ?? "unknown",
        impact: incident.impact ?? "unknown",
        shortLink: incident.shortlink ?? provider.statusUrl,
        createdAt: incident.created_at ?? null,
        updatedAt: incident.updated_at ?? null,
      })),
      errorMessage: "",
    };
  } catch (error) {
    return {
      provider: provider.provider,
      name: provider.name,
      source: "unavailable",
      statusUrl: provider.statusUrl,
      indicator: "unknown",
      description: "Kunne ikke hente ekstern driftsstatus lige nu",
      updatedAt: null,
      incidents: [],
      errorMessage: error instanceof Error ? error.message : "Ukendt statusfejl",
    };
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    let telemetryLogs = mockTelemetryLogs;
    let dataSource: "live" | "mock" = "mock";
    let fallbackMessage = "";

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      fallbackMessage = "SUPABASE_SERVICE_ROLE_KEY mangler. Siden viser en skal, indtil serveradgangen er på plads.";
    } else {
      const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
      const { data, error } = await adminSupabase
        .from("telemetry_logs")
        .select("id,event_type,participant_id,session_id,message,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(250);

      if (error) {
        fallbackMessage = getTelemetryFallbackMessage(error as SupabaseErrorLike);
      } else {
        telemetryLogs = ((data as TelemetryLogRow[] | null) ?? []).filter(Boolean);
        dataSource = "live";
      }
    }

    const externalServices = await Promise.all(externalProviders.map(fetchExternalProviderSnapshot));
    const activeAlarms = deriveActiveAlarms(telemetryLogs, externalServices);
    const correlatedIncidents = deriveCorrelatedIncidents(telemetryLogs);
    const generatedAt = new Date().toISOString();

    return NextResponse.json(
      {
        telemetryLogs,
        dataSource,
        fallbackMessage,
        externalServices,
        activeAlarms,
        correlatedIncidents,
        generatedAt,
        alarmWindowMinutes: ACTIVE_ALARM_WINDOW_MINUTES,
        correlationWindowMinutes: CORRELATION_WINDOW_MINUTES,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    await logHandledServerError({
      route: "/api/admin/logs",
      method: "GET",
      status: 500,
      error,
      requestPath: "/api/admin/logs",
      routeType: "route",
    });

    return NextResponse.json(
      {
        telemetryLogs: mockTelemetryLogs,
        dataSource: "mock",
        fallbackMessage: "Admin-logfeed kunne ikke bygges live. Siden viser en skal med kendte eksempler.",
        externalServices: fallbackExternalServices,
        activeAlarms: deriveActiveAlarms(mockTelemetryLogs, fallbackExternalServices),
        correlatedIncidents: deriveCorrelatedIncidents(mockTelemetryLogs),
        generatedAt: new Date().toISOString(),
        alarmWindowMinutes: ACTIVE_ALARM_WINDOW_MINUTES,
        correlationWindowMinutes: CORRELATION_WINDOW_MINUTES,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
