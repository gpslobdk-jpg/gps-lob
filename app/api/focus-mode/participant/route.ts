import { NextRequest } from "next/server";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";
import { FOCUS_MODE_UNAVAILABLE, isFocusUuid, parseFocusReturnEvent } from "@/lib/focusMode";
import { isFocusModeAvailable, readFocusParticipantPolicy, readFocusSession, recordFocusReturn } from "@/lib/focusModeServer";
import { focusJson, readFocusBody } from "../_shared";

export async function GET(request: NextRequest) {
  try {
    if (!isFocusModeAvailable()) return focusJson(FOCUS_MODE_UNAVAILABLE);
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const participantId = request.nextUrl.searchParams.get("participantId");
    if (!isFocusUuid(sessionId) || !isFocusUuid(participantId)) return focusJson(FOCUS_MODE_UNAVAILABLE, 400);
    const identity = await resolveParticipantRequestContext({ claimedSessionId: sessionId, claimedParticipantId: participantId });
    if (!identity.ok) return focusJson(FOCUS_MODE_UNAVAILABLE, identity.status);
    const session = await readFocusSession(identity.data.adminSupabase, sessionId);
    if (!session) return focusJson(FOCUS_MODE_UNAVAILABLE);
    return focusJson(await readFocusParticipantPolicy(identity.data.adminSupabase, session, participantId));
  } catch { return focusJson(FOCUS_MODE_UNAVAILABLE); }
}

export async function POST(request: NextRequest) {
  const ignored = { available: false, accepted: false };
  try {
    if (!isFocusModeAvailable()) return focusJson(ignored);
    const body = await readFocusBody(request);
    if (!body || !isFocusUuid(body.sessionId) || !isFocusUuid(body.participantId)) return focusJson(ignored, 400);
    const event = parseFocusReturnEvent(body);
    if (!event) return focusJson({ available: true, accepted: false });
    const identity = await resolveParticipantRequestContext({ claimedSessionId: body.sessionId, claimedParticipantId: body.participantId });
    if (!identity.ok) return focusJson(ignored, identity.status);
    const accepted = await recordFocusReturn(identity.data.adminSupabase, body.sessionId, body.participantId, event);
    return focusJson({ available: true, accepted });
  } catch { return focusJson(ignored); }
}
