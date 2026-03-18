import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";

export const runtime = "edge";

type SubmitAnswerPayload = {
  payloads?: unknown;
};

function isArrayOfRecords(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((v) => typeof v === "object" && v !== null && !Array.isArray(v));
}

function isMissingColumnError(error: any) {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") return true;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("column");
}

export async function POST(request: NextRequest) {
  let body: SubmitAnswerPayload;
  try {
    body = (await request.json()) as SubmitAnswerPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const rawPayloads = body.payloads ?? null;
  if (!isArrayOfRecords(rawPayloads)) {
    return NextResponse.json({ error: "Manglende eller ugyldigt payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
  }

  try {
    for (const payload of rawPayloads) {
      try {
        const { error } = await admin.from("answers").insert(payload as Record<string, unknown>);
        if (!error) {
          return NextResponse.json({ inserted: true });
        }

        if (isMissingColumnError(error)) {
          // Skip payloads that rely on missing columns and try next
          continue;
        }

        // If we hit a non-recoverable error, return it so the client can log it
        return NextResponse.json({ error: error.message ?? "Kunne ikke gemme svar." }, { status: 500 });
      } catch (inner) {
        // Unexpected insert error for this payload, try next or return
        console.error("Fejl ved indsættelse af svar-payload:", inner);
        continue;
      }
    }

    return NextResponse.json({ error: "Kunne ikke gemme nogen af svarene." }, { status: 500 });
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }
    console.error("Kunne ikke gemme svar via admin-klient:", error);
    return NextResponse.json({ error: "Kunne ikke gemme svar." }, { status: 500 });
  }
}
