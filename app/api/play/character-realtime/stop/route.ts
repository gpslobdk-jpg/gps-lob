import { NextRequest, NextResponse } from "next/server";

import { resolveCharacterRealtimeServerGate } from "@/lib/characterRealtime";
import { verifyCharacterRealtimeStopToken } from "@/lib/characterRealtimeServer";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "nodejs";
export const maxDuration = 10;

function noStoreJson(code: string, status: number) {
  return NextResponse.json(
    { error: "Samtalen kunne ikke afsluttes på serveren.", code },
    {
      status,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    },
  );
}

export async function POST(request: NextRequest) {
  const gate = resolveCharacterRealtimeServerGate(process.env);
  if (!gate.available) return noStoreJson(gate.code, 503);

  let token = "";
  try {
    const payload = (await request.json()) as { token?: unknown };
    token = typeof payload.token === "string" ? payload.token.trim() : "";
  } catch {
    return noStoreJson("INVALID_STOP_TOKEN", 400);
  }
  if (!token || token.length > 2_048) {
    return noStoreJson("INVALID_STOP_TOKEN", 400);
  }

  const participantContext = await resolveParticipantRequestContext();
  if (!participantContext.ok) {
    return noStoreJson("PARTICIPANT_UNAUTHORIZED", participantContext.status);
  }

  const { participantId, sessionId } = participantContext.data;
  const verified = verifyCharacterRealtimeStopToken({
    secret: process.env.PILEN_REALTIME_RATE_LIMIT_SECRET!.trim(),
    token,
    participantId,
    sessionId,
  });
  if (!verified) return noStoreJson("INVALID_STOP_TOKEN", 403);

  try {
    const hangupEndpoint = gate.endpoint.replace(
      /\/calls$/,
      `/calls/${encodeURIComponent(verified.callId)}/hangup`,
    );
    await fetch(hangupEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${gate.apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Local WebRTC cleanup is authoritative for the browser. The provider also
    // ends the call when the peer disappears, so a stop request stays best effort.
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
