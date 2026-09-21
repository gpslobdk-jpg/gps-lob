import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const OEVEKORT_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Cookie",
} as const;

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export type OevekortOwnerAccess = {
  userId: string;
  admin: AdminClient;
};

export type OevekortOwnerAccessResult =
  | { ok: true; value: OevekortOwnerAccess }
  | { ok: false; response: NextResponse };

export function oevekortJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: OEVEKORT_NO_STORE_HEADERS,
  });
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  // All browser JSON mutations include Origin. Rejecting an absent Origin keeps
  // these cookie-backed owner endpoints closed to non-browser form posts too.
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readOevekortJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function getOevekortOwnerAccess(): Promise<OevekortOwnerAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: oevekortJson({ error: "Du skal være logget ind." }, 401),
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      response: oevekortJson(
        { error: "Øvekort er midlertidigt utilgængeligt." },
        503
      ),
    };
  }

  return { ok: true, value: { userId: user.id, admin } };
}

export function readRpcRow<T>(value: unknown) {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value && typeof value === "object" ? (value as T) : null;
}

export function readRpcRows<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function hasDatabaseMessage(error: unknown, expected: string) {
  if (!error || typeof error !== "object") return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.includes(expected);
}

function safeDatabaseCode(error: unknown) {
  if (!error || typeof error !== "object") return "unknown";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(code)
    ? code
    : "unknown";
}

export async function reportOevekortRouteFailure(
  route: string,
  method: string,
  context: string,
  error: unknown
) {
  await logHandledServerError({
    route,
    method,
    status: 500,
    error: new Error(`oevekort_api_failed_${safeDatabaseCode(error)}`),
    requestPath: route,
    routeType: "route",
    context,
  });
}

export function requestOrigin(request: Request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}
