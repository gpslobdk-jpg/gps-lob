import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type LocationPayload = {
  sessionId?: unknown;
  studentName?: unknown;
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
  participantId: string,
  lat: number,
  lng: number,
  timestamp: string
) {
  let result = await supabaseRequest<ParticipantIdRow[]>(
    `participants?id=eq.${encodeURIComponent(participantId)}&select=id`,
    {
      method: "PATCH",
      body: JSON.stringify({ lat, lng, last_updated: timestamp }),
    }
  );

  if (!result.ok && isMissingColumnError(result.error)) {
    result = await supabaseRequest<ParticipantIdRow[]>(
      `participants?id=eq.${encodeURIComponent(participantId)}&select=id`,
      {
        method: "PATCH",
        body: JSON.stringify({ lat, lng }),
      }
    );
  }

  return result;
}

async function updateParticipantByName(
  sessionId: string,
  studentName: string,
  lat: number,
  lng: number,
  timestamp: string
) {
  let result = await supabaseRequest<ParticipantIdRow[]>(
    `participants?session_id=eq.${encodeURIComponent(sessionId)}&student_name=eq.${encodeURIComponent(studentName)}&select=id`,
    {
      method: "PATCH",
      body: JSON.stringify({ lat, lng, last_updated: timestamp }),
    }
  );

  if (!result.ok && isMissingColumnError(result.error)) {
    result = await supabaseRequest<ParticipantIdRow[]>(
      `participants?session_id=eq.${encodeURIComponent(sessionId)}&student_name=eq.${encodeURIComponent(studentName)}&select=id`,
      {
        method: "PATCH",
        body: JSON.stringify({ lat, lng }),
      }
    );
  }

  return result;
}

async function insertParticipant(
  sessionId: string,
  studentName: string,
  lat: number,
  lng: number,
  timestamp: string
) {
  const payloads = [
    { session_id: sessionId, student_name: studentName, lat, lng, last_updated: timestamp },
    { session_id: sessionId, student_name: studentName, lat, lng },
  ];

  for (const payload of payloads) {
    const result = await supabaseRequest<ParticipantIdRow[]>(
      "participants?select=id",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    if (result.ok) {
      return result;
    }

    if (result.error.code === "23505") {
      return supabaseRequest<ParticipantIdRow[]>(
        `participants?session_id=eq.${encodeURIComponent(sessionId)}&student_name=eq.${encodeURIComponent(studentName)}&select=id&limit=1`,
        { method: "GET" },
        "return=representation"
      );
    }

    if (result.error.code === "PGRST205" || isMissingColumnError(result.error)) {
      continue;
    }

    return result;
  }

  return {
    ok: false,
    status: 400,
    error: { code: "PGRST205", message: "Participants-tabellen er ikke tilgængelig." },
  } satisfies SupabaseResult<ParticipantIdRow[]>;
}

async function updateSessionStudent(
  sessionId: string,
  studentName: string,
  lat: number,
  lng: number,
  timestamp: string
) {
  let result = await supabaseRequest<unknown>(
    `session_students?session_id=eq.${encodeURIComponent(sessionId)}&student_name=eq.${encodeURIComponent(studentName)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ lat, lng, last_updated: timestamp }),
    },
    "return=minimal"
  );

  if (!result.ok && isMissingColumnError(result.error)) {
    result = await supabaseRequest<unknown>(
      `session_students?session_id=eq.${encodeURIComponent(sessionId)}&student_name=eq.${encodeURIComponent(studentName)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ lat, lng }),
      },
      "return=minimal"
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
  const studentName = asTrimmedString(payload.studentName);
  const participantId = asTrimmedString(payload.participantId);
  const lat = asFiniteNumber(payload.lat);
  const lng = asFiniteNumber(payload.lng);

  if (!sessionId || !studentName || lat === null || lng === null) {
    return NextResponse.json({ error: "Manglende positionsdata." }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  let resolvedParticipantId = participantId || null;
  let shouldFallbackToSessionStudents = false;

  try {
    if (participantId) {
      const byIdResult = await updateParticipantById(participantId, lat, lng, timestamp);
      if (byIdResult.ok && Array.isArray(byIdResult.data) && byIdResult.data.length > 0) {
        return NextResponse.json({ ok: true, participantId });
      }

      if (!byIdResult.ok && byIdResult.error.code !== "PGRST205") {
        console.error("Kunne ikke opdatere participant via id:", byIdResult.error);
      }
    }

    const participantUpdate = await updateParticipantByName(sessionId, studentName, lat, lng, timestamp);

    if (participantUpdate.ok) {
      const firstRow = Array.isArray(participantUpdate.data) ? participantUpdate.data[0] : null;
      if (firstRow?.id) {
        resolvedParticipantId = String(firstRow.id);
        return NextResponse.json({ ok: true, participantId: resolvedParticipantId });
      }

      const insertResult = await insertParticipant(sessionId, studentName, lat, lng, timestamp);
      if (insertResult.ok) {
        const firstInsertedRow = Array.isArray(insertResult.data) ? insertResult.data[0] : null;
        resolvedParticipantId =
          typeof firstInsertedRow?.id === "string" ? firstInsertedRow.id : resolvedParticipantId;
        return NextResponse.json({ ok: true, participantId: resolvedParticipantId });
      }

      if (insertResult.error.code === "PGRST205") {
        shouldFallbackToSessionStudents = true;
      } else {
        console.error("Kunne ikke oprette participant:", insertResult.error);
      }
    } else if (participantUpdate.error.code === "PGRST205") {
      shouldFallbackToSessionStudents = true;
    } else {
      console.error("Kunne ikke opdatere participant:", participantUpdate.error);
    }

    if (shouldFallbackToSessionStudents) {
      const fallbackResult = await updateSessionStudent(sessionId, studentName, lat, lng, timestamp);
      if (fallbackResult.ok || fallbackResult.error.code === "PGRST205") {
        return NextResponse.json({ ok: true, participantId: resolvedParticipantId });
      }

      console.error("Kunne ikke opdatere elevposition:", fallbackResult.error);
      return NextResponse.json({ error: "Kunne ikke gemme positionen." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, participantId: resolvedParticipantId });
  } catch (error) {
    console.error("Kunne ikke synkronisere elevposition:", error);
    return NextResponse.json({ error: "Kunne ikke gemme positionen." }, { status: 500 });
  }
}
