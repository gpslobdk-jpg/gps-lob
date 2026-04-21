import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_TELEMETRY_EVENT_SET, writeTelemetryLog } from "@/utils/telemetry/serverLogs";

export const runtime = "edge";

// Event types that warrant an immediate Discord alert when they occur in production.
const ALERT_EVENT_TYPES = new Set([
  "gps_fallback_activated",
  "answer_submission_max_retries",
]);

async function sendDiscordAlert(event_type: string, payload: {
  participant_id: string | null;
  session_id: string | null;
  message: string | null;
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const lines = [
    `🚨 **${event_type}**`,
    payload.session_id   ? `• session: \`${payload.session_id}\`` : null,
    payload.participant_id ? `• deltager: \`${payload.participant_id}\`` : null,
    payload.message      ? `• besked: ${payload.message}` : null,
  ].filter(Boolean).join("\n");

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: lines }),
  }).catch(() => {});
}

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

    const participantId = typeof participant_id === "string" ? participant_id : null;
    const sessionId     = typeof session_id    === "string" ? session_id    : null;
    const msg           = typeof message       === "string" ? message       : null;

    await writeTelemetryLog({ eventType: event_type, participantId, sessionId, message: msg });

    if (ALERT_EVENT_TYPES.has(event_type)) {
      await sendDiscordAlert(event_type, {
        participant_id: participantId,
        session_id: sessionId,
        message: msg,
      });
    }
  } catch {
    // Swallow all errors — always respond 204 so clients never retry
  }

  return new NextResponse(null, { status: 204 });
}
