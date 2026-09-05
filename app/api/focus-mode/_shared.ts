import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFocusUuid } from "@/lib/focusMode";
import { readFocusSession, type FocusDatabase, type FocusSession } from "@/lib/focusModeServer";

export function focusJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

type TeacherAccess = { db: FocusDatabase; userId: string };
export async function focusTeacherAccess(): Promise<TeacherAccess | null> {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user || user.is_anonymous) return null;
  const db = createAdminClient();
  if (!db) throw new Error("Focus unavailable");
  return { db, userId: user.id };
}

export async function ownedFocusRun(access: TeacherAccess, runId: unknown) {
  if (!isFocusUuid(runId)) return false;
  const { data, error } = await access.db.from("gps_runs").select("id").eq("id", runId).eq("user_id", access.userId).maybeSingle();
  if (error) throw new Error("Focus ownership unavailable");
  return !!data;
}

export async function ownedFocusSession(access: TeacherAccess, sessionId: unknown): Promise<FocusSession | null> {
  if (!isFocusUuid(sessionId)) return null;
  const session = await readFocusSession(access.db, sessionId);
  // Match the existing live-theme boundary: session controls belong to the
  // executing teacher, even if its material was shared by another run owner.
  if (!session || session.teacher_id !== access.userId) return null;
  return session;
}

export async function readFocusBody(request: Request): Promise<Record<string, unknown> | null> {
  // This endpoint only needs a handful of scalar values, never arbitrary telemetry.
  if (Number(request.headers.get("content-length") ?? 0) > 2_048) return null;
  const raw = await request.text();
  if (raw.length > 2_048) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}
