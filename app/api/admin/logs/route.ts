import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
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

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const mockTelemetryLogs: TelemetryLogRow[] = [
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
      "meta:kind=response|source=route-response|route=/api/play/participant|path=/api/play/participant?sessionId=demo|method=GET|status=401|msg=Unauthorized",
    created_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-server-error",
    event_type: "server_handled_error",
    participant_id: null,
    session_id: "demo-session-3",
    message:
      "meta:kind=handled|source=route-catch|route=/api/join|path=/api/join|method=POST|status=500|type=route|msg=Kunne ikke registrere deltageren.",
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

async function fetchExternalProviderSnapshot(provider: (typeof externalProviders)[number]) {
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
      source: "live" as const,
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
      source: "unavailable" as const,
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

    return NextResponse.json(
      {
        telemetryLogs,
        dataSource,
        fallbackMessage,
        externalServices,
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
        externalServices: externalProviders.map((provider) => ({
          provider: provider.provider,
          name: provider.name,
          source: "unavailable",
          statusUrl: provider.statusUrl,
          indicator: "unknown",
          description: "Kunne ikke hente ekstern driftsstatus lige nu",
          updatedAt: null,
          incidents: [],
          errorMessage: "Admin-logfeed fejlede under indlæsning",
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}