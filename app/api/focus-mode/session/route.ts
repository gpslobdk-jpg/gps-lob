import { NextRequest } from "next/server";
import { isFocusUuid } from "@/lib/focusMode";
import { isFocusModeAvailable, readFocusTeacherSession, writeFocusExclusion, writeFocusSession } from "@/lib/focusModeServer";
import { focusJson, focusTeacherAccess, ownedFocusSession, readFocusBody } from "../_shared";

const unavailable = { available: false, enabled: false, participants: [] };

export async function GET(request: NextRequest) {
  try {
    if (!isFocusModeAvailable()) return focusJson(unavailable);
    const access = await focusTeacherAccess();
    if (!access) return focusJson(unavailable, 401);
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!isFocusUuid(sessionId)) return focusJson(unavailable, 400);
    const session = await ownedFocusSession(access, sessionId);
    if (!session) return focusJson(unavailable, 404);
    return focusJson(await readFocusTeacherSession(access.db, session));
  } catch { return focusJson(unavailable); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isFocusModeAvailable()) return focusJson(unavailable, 503);
    const access = await focusTeacherAccess();
    if (!access) return focusJson(unavailable, 401);
    const body = await readFocusBody(request);
    if (!body || !isFocusUuid(body.sessionId)) return focusJson(unavailable, 400);
    const session = await ownedFocusSession(access, body.sessionId);
    if (!session) return focusJson(unavailable, 404);
    if (typeof body.enabled === "boolean" && body.participantId === undefined && body.excluded === undefined) {
      await writeFocusSession(access.db, session, body.enabled);
    } else if (isFocusUuid(body.participantId) && typeof body.excluded === "boolean" && body.enabled === undefined) {
      await writeFocusExclusion(access.db, session, body.participantId, body.excluded);
    } else return focusJson(unavailable, 400);
    return focusJson(await readFocusTeacherSession(access.db, session));
  } catch { return focusJson(unavailable, 503); }
}
