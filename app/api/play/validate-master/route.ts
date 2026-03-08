import { NextRequest, NextResponse } from "next/server";

import {
  asTrimmedString,
  extractMasterCode,
  fetchRunForSession,
  normalizeMasterCode,
} from "@/app/api/play/_shared";

export const runtime = "edge";

type ValidateMasterPayload = {
  sessionId?: unknown;
  masterCode?: unknown;
};

export async function POST(request: NextRequest) {
  let payload: ValidateMasterPayload;

  try {
    payload = (await request.json()) as ValidateMasterPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const sessionId = asTrimmedString(payload.sessionId);
  const submittedCode = normalizeMasterCode(asTrimmedString(payload.masterCode));

  if (!sessionId || !submittedCode) {
    return NextResponse.json({ error: "Master-koden mangler." }, { status: 400 });
  }

  try {
    const run = await fetchRunForSession(sessionId);
    if (!run) {
      return NextResponse.json({ error: "Kunne ikke finde løbet." }, { status: 404 });
    }

    const expectedCode = extractMasterCode(run.description);
    if (!expectedCode) {
      return NextResponse.json({ error: "Master-koden mangler i løbet." }, { status: 400 });
    }

    return NextResponse.json({
      isCorrect: submittedCode === expectedCode,
    });
  } catch (error) {
    console.error("Kunne ikke validere master-kode:", error);
    return NextResponse.json({ error: "Kunne ikke tjekke master-koden." }, { status: 500 });
  }
}
