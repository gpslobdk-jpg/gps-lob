import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ALLOWED_EVENTS = new Set([
  "session_drop",
  "auth_error",
  "gps_died",
  "gps_warmup_timeout",
  "jwt_refresh_failed",
  "kick_false_positive",
  "participant_auth_refresh_recovered",
  "participant_auth_rebind_recovered",
  "participant_restore_exhausted",
  "wake_reconnect_recovered",
  "wake_reconnect_failed",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      event_type?: unknown;
      participant_id?: unknown;
      session_id?: unknown;
      message?: unknown;
    };

    const { event_type, participant_id, session_id, message } = body;

    if (typeof event_type !== "string" || !ALLOWED_EVENTS.has(event_type)) {
      return NextResponse.json({ error: "invalid event_type" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.from("telemetry_logs").insert({
      event_type,
      participant_id: typeof participant_id === "string" ? participant_id : null,
      session_id: typeof session_id === "string" ? session_id : null,
      message: typeof message === "string" ? message.slice(0, 500) : null,
    });

    if (error) {
      // Table may not exist yet — log info, never error, so server logs stay clean
      console.info("[telemetry] telemetry_logs not writable:", event_type, error.message);
    }
  } catch {
    // Swallow all errors — always respond 204 so clients never retry
  }

  return new NextResponse(null, { status: 204 });
}
