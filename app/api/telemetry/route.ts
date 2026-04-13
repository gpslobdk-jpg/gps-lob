import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_TELEMETRY_EVENT_SET, writeTelemetryLog } from "@/utils/telemetry/serverLogs";

export const runtime = "edge";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      event_type?: unknown;
      participant_id?: unknown;
      session_id?: unknown;
      message?: unknown;
    };

    const { event_type, participant_id, session_id, message } = body;

    if (typeof event_type !== "string" || !PUBLIC_TELEMETRY_EVENT_SET.has(event_type)) {
      return NextResponse.json({ error: "invalid event_type" }, { status: 400 });
    }

    await writeTelemetryLog({
      eventType: event_type,
      participantId: typeof participant_id === "string" ? participant_id : null,
      sessionId: typeof session_id === "string" ? session_id : null,
      message: typeof message === "string" ? message : null,
    });
  } catch {
    // Swallow all errors — always respond 204 so clients never retry
  }

  return new NextResponse(null, { status: 204 });
}
