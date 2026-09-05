import { NextRequest } from "next/server";
import { isFocusUuid } from "@/lib/focusMode";
import { isFocusModeAvailable, readFocusRun, writeFocusRun } from "@/lib/focusModeServer";
import { focusJson, focusTeacherAccess, ownedFocusRun, readFocusBody } from "../_shared";

const unavailable = { available: false, enabled: false };

export async function GET(request: NextRequest) {
  try {
    if (!isFocusModeAvailable()) return focusJson(unavailable);
    const access = await focusTeacherAccess();
    if (!access) return focusJson(unavailable, 401);
    const runId = request.nextUrl.searchParams.get("runId");
    if (!isFocusUuid(runId)) return focusJson(unavailable, 400);
    if (!await ownedFocusRun(access, runId)) return focusJson(unavailable, 404);
    return focusJson({ available: true, enabled: await readFocusRun(access.db, runId) });
  } catch { return focusJson(unavailable); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isFocusModeAvailable()) return focusJson(unavailable, 503);
    const access = await focusTeacherAccess();
    if (!access) return focusJson(unavailable, 401);
    const body = await readFocusBody(request);
    if (!body || !isFocusUuid(body.runId) || typeof body.enabled !== "boolean") return focusJson(unavailable, 400);
    if (!await ownedFocusRun(access, body.runId)) return focusJson(unavailable, 404);
    await writeFocusRun(access.db, body.runId, body.enabled);
    return focusJson({ available: true, enabled: body.enabled });
  } catch { return focusJson(unavailable, 503); }
}
