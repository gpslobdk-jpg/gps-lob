import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type LocationPayload = {
  sessionId?: unknown;
  participantId?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type SupabaseRestError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type SupabaseResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: SupabaseRestError; status: number };

type ParticipantIdRow = {
  id?: string | null;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error("Supabase er ikke konfigureret.");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isMissingColumnError(error: SupabaseRestError | null | undefined) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column/i.test(error.message ?? "");
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit,
  prefer = "return=representation"
): Promise<SupabaseResult<T>> {
  const { url, anonKey } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${anonKey}`);
  headers.set("Content-Type", "application/json");
  headers.set("Prefer", prefer);

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as T | SupabaseRestError)
    : ({ message: await response.text() } satisfies SupabaseRestError);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body as SupabaseRestError,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: body as T,
  };
}

async function updateParticipantById(
  sessionId: string,
  participantId: string,
  lat: number,
  lng: number,
  timestamp: string
) {
  let result = await supabaseRequest<ParticipantIdRow[]>(
    `participants?id=eq.${encodeURIComponent(participantId)}&session_id=eq.${encodeURIComponent(
      sessionId
    )}&select=id`,
    {
      method: "PATCH",
      body: JSON.stringify({ lat, lng, last_updated: timestamp }),
    }
  );

  if (!result.ok && isMissingColumnError(result.error)) {
    result = await supabaseRequest<ParticipantIdRow[]>(
      `participants?id=eq.${encodeURIComponent(participantId)}&session_id=eq.${encodeURIComponent(
        sessionId
      )}&select=id`,
      {
        method: "PATCH",
        body: JSON.stringify({ lat, lng }),
      }
    );
  }

  return result;
}

export async function POST(request: NextRequest) {
  let payload: LocationPayload;

  try {
    payload = (await request.json()) as LocationPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const sessionId = asTrimmedString(payload.sessionId);
  const participantId = asTrimmedString(payload.participantId);
  const lat = asFiniteNumber(payload.lat);
  const lng = asFiniteNumber(payload.lng);

  if (!sessionId || !participantId || lat === null || lng === null) {
    return NextResponse.json({ error: "Manglende positionsdata." }, { status: 400 });
  }

  const timestamp = new Date().toISOString();

  try {
    const updateResult = await updateParticipantById(sessionId, participantId, lat, lng, timestamp);

    if (!updateResult.ok) {
      console.error("Kunne ikke opdatere participant via id:", updateResult.error);
      return NextResponse.json({ error: "Kunne ikke gemme positionen." }, { status: 500 });
    }

    const updatedRows = Array.isArray(updateResult.data) ? updateResult.data : [];
    if (updatedRows.length === 0) {
      return NextResponse.json({ error: "Deltageren findes ikke længere." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, participantId });
  } catch (error) {
    console.error("Kunne ikke synkronisere elevposition:", error);
    return NextResponse.json({ error: "Kunne ikke gemme positionen." }, { status: 500 });
  }
}
