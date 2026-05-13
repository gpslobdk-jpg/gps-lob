import { NextResponse } from "next/server";

import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import { getAwardedPoints } from "@/utils/questionPoints";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";
import {
  asTrimmedString,
  fetchParticipantStartState,
  fetchRunForSession,
  getFirstRoutePostIndexForParticipant,
  resolveQuestionVariant,
} from "@/app/api/play/_shared";

export const maxDuration = 60;

const RUN_OUT_OF_SYNC_ERROR_CODE = "RUN_OUT_OF_SYNC";

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type UploadedPhotoInput = {
  buffer: Buffer;
  mimeType: string;
};

type ActiveSessionRow = {
  id?: string | null;
};

type ExistingPhotoAnswerRow = {
  id?: string | null;
  image_url?: string | null;
  awarded_points?: number | string | null;
  is_correct?: boolean | null;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asPostIndex(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

function isMissingColumnError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") {
    return true;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("column");
}

async function parseUploadedImage(file: File): Promise<UploadedPhotoInput | null> {
  const mimeType = file.type.trim().toLowerCase();
  if (!mimeType.startsWith("image/")) {
    return null;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength === 0) {
    return null;
  }

  return {
    buffer,
    mimeType,
  };
}

function getImageFileExtension(mimeType: string) {
  const rawSubtype = mimeType.split("/")[1]?.toLowerCase() ?? "jpg";
  const normalizedSubtype = rawSubtype.replace(/[^a-z0-9]/g, "");

  if (normalizedSubtype === "jpeg") return "jpg";
  return normalizedSubtype || "jpg";
}

function createStorageUploadNonce(answeredAt: string) {
  const normalizedTimestamp = answeredAt.replace(/[^a-zA-Z0-9_-]/g, "");
  if (normalizedTimestamp) {
    return normalizedTimestamp;
  }

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildStoragePath(
  sessionId: string,
  participantId: string,
  postIndex: number,
  mimeType: string,
  answeredAt: string
) {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "") || "session";
  const safeParticipantId = participantId.replace(/[^a-zA-Z0-9_-]/g, "") || "participant";
  const extension = getImageFileExtension(mimeType);
  const uploadNonce = createStorageUploadNonce(answeredAt);
  return `${safeSessionId}/${safeParticipantId}/${uploadNonce}-${postIndex}.${extension}`;
}

function getQuestionText(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return "";
  return asTrimmedString(rawQuestion.text);
}

async function uploadPhotoToStorage(
  image: UploadedPhotoInput,
  sessionId: string,
  participantId: string,
  postIndex: number,
  answeredAt: string,
  adminSupabase: AdminSupabaseClient
) {
  const storagePath = buildStoragePath(sessionId, participantId, postIndex, image.mimeType, answeredAt);
  const { error: uploadError } = await adminSupabase.storage
    .from("participant-uploads")
    .upload(storagePath, image.buffer, {
      contentType: image.mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error("Kunne ikke uploade deltagerbillede til Storage:", uploadError);
    return { imageUrl: null as string | null };
  }

  const {
    data: { publicUrl },
  } = adminSupabase.storage.from("participant-uploads").getPublicUrl(storagePath);

  return {
    imageUrl: publicUrl || null,
  };
}

async function fetchActiveSession(
  sessionId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("live_sessions")
    .select("id")
    .eq("id", sessionId)
    .in("status", ["waiting", "running"])
    .maybeSingle<ActiveSessionRow>();

  if (error) {
    console.error("Kunne ikke validere aktiv live-session til foto-upload:", error);
    return null;
  }

  return data ?? null;
}

async function findExistingPhotoAnswer(
  sessionId: string,
  studentName: string,
  participantId: string,
  postIndex: number,
  adminSupabase: AdminSupabaseClient
): Promise<ExistingPhotoAnswerRow | null> {
  const normalizedStudentName = asTrimmedString(studentName);
  const lookupCandidates = [
    normalizedStudentName ? { column: "student_name" as const, value: normalizedStudentName } : null,
    !normalizedStudentName && asTrimmedString(participantId)
      ? { column: "participant_id" as const, value: asTrimmedString(participantId) }
      : null,
  ].filter((candidate): candidate is { column: "student_name" | "participant_id"; value: string } =>
    candidate !== null
  );

  if (lookupCandidates.length === 0) {
    return null;
  }

  for (const lookup of lookupCandidates) {
    for (const column of ["question_index", "post_index"] as const) {
      const value = column === "question_index" ? postIndex : postIndex + 1;
      const { data, error } = await adminSupabase
        .from("answers")
        .select("id,image_url,awarded_points,is_correct")
        .eq("session_id", sessionId)
        .eq(lookup.column, lookup.value)
        .eq(column, value)
        .maybeSingle<ExistingPhotoAnswerRow>();

      if (error) {
        if (isMissingColumnError(error)) {
          continue;
        }

        throw new Error(error.message ?? "Kunne ikke tjekke eksisterende foto-svar.");
      }

      if (data) {
        return data;
      }
    }
  }

  return null;
}

async function maybeStampRunStartedAt(
  sessionId: string,
  participantId: string,
  postIndex: number,
  raceMode: unknown,
  questionCount: number,
  adminSupabase: AdminSupabaseClient,
  answeredAt: string
) {
  const participantState = await fetchParticipantStartState(sessionId, participantId, adminSupabase);
  if (!participantState || participantState.run_started_at) {
    return;
  }

  const firstRoutePostIndex = getFirstRoutePostIndexForParticipant(
    questionCount,
    participantState.start_offset ?? 0,
    raceMode
  );

  if (firstRoutePostIndex === null || postIndex !== firstRoutePostIndex) {
    return;
  }

  const { error } = await adminSupabase
    .from("participants")
    .update({ run_started_at: answeredAt })
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .is("run_started_at", null);

  if (error && !isMissingColumnError(error)) {
    throw new Error(error.message ?? "Kunne ikke gemme run_started_at.");
  }
}

export async function POST(request: Request) {
  let formData: FormData;
  const requestPath = new URL(request.url).pathname;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ugyldig foresporgsel." }, { status: 400 });
  }

  try {
    const imageEntry = formData.get("image");
    const claimedSessionId = asTrimmedString(formData.get("sessionId"));
    const claimedParticipantId = asTrimmedString(formData.get("participantId"));
    const answeredAt = asTrimmedString(formData.get("answeredAt")) || new Date().toISOString();
    const postIndex = asPostIndex(formData.get("postIndex"));

    if (!(imageEntry instanceof File) || postIndex === null) {
      return NextResponse.json({ error: "Billede eller postdata mangler." }, { status: 400 });
    }

    const image = await parseUploadedImage(imageEntry);
    if (!image) {
      return NextResponse.json({ error: "Billedfilen er ugyldig." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    const participantContext = await resolveParticipantRequestContext({
      adminSupabase,
      claimedParticipantId: claimedParticipantId || null,
      claimedSessionId: claimedSessionId || null,
    });
    if (!participantContext.ok) {
      return NextResponse.json({ error: participantContext.error }, { status: participantContext.status });
    }

    const { participantId, sessionId, studentName } = participantContext.data;
    const activeSession = await fetchActiveSession(sessionId, adminSupabase);
    if (!activeSession?.id) {
      return NextResponse.json({ error: "Sessionen er ikke aktiv laengere." }, { status: 404 });
    }

    const run = await fetchRunForSession(sessionId);
    if (!run || !Array.isArray(run.questions)) {
      return NextResponse.json({ error: "Foto-posten kunne ikke findes." }, { status: 404 });
    }

    const questionCount = run.questions.length;
    if (postIndex >= questionCount) {
      return NextResponse.json(
        {
          error: "Foto-posten er ikke laengere synkron med loebet.",
          code: RUN_OUT_OF_SYNC_ERROR_CODE,
          postIndex,
          questionCount,
        },
        { status: 409 }
      );
    }

    if (!studentName.trim()) {
      return NextResponse.json({ error: "Deltageren kunne ikke findes." }, { status: 404 });
    }

    const rawQuestion = run.questions[postIndex];
    const variant = resolveQuestionVariant(run.raceType ?? run.race_type, rawQuestion);
    if (variant !== "photo") {
      return NextResponse.json(
        { error: "Denne post bruger ikke foto-upload." },
        { status: 400 }
      );
    }

    const existingAnswer = await findExistingPhotoAnswer(
      sessionId,
      studentName,
      participantId,
      postIndex,
      adminSupabase
    );
    const awardedPoints = getAwardedPoints(rawQuestion, true);

    if (existingAnswer) {
      await maybeStampRunStartedAt(
        sessionId,
        participantId,
        postIndex,
        run.raceType ?? run.race_type,
        run.questions.length,
        adminSupabase,
        answeredAt
      );

      const existingAwardedPoints = Number(existingAnswer.awarded_points);
      const responseAwardedPoints =
        Number.isFinite(existingAwardedPoints) ? Math.max(0, Math.round(existingAwardedPoints)) : awardedPoints;

      return NextResponse.json({
        storedAnswer: true,
        awardedPoints: responseAwardedPoints,
        imageUrl: existingAnswer.image_url ?? null,
        message: "Billedet er uploadet til laererens foto-stroem.",
        isLocked: true,
      });
    }

    const uploadedPhoto = await uploadPhotoToStorage(
      image,
      sessionId,
      participantId,
      postIndex,
      answeredAt,
      adminSupabase
    );

    if (!uploadedPhoto.imageUrl) {
      return NextResponse.json({ error: "Billedet kunne ikke uploades." }, { status: 500 });
    }

    const { error } = await adminSupabase.from("answers").insert({
      session_id: sessionId,
      participant_id: participantId,
      student_name: studentName.trim(),
      post_index: postIndex + 1,
      question_index: postIndex,
      selected_index: 0,
      answer_index: 0,
      is_correct: true,
      awarded_points: awardedPoints,
      question_text: getQuestionText(rawQuestion),
      image_url: uploadedPhoto.imageUrl,
      answered_at: answeredAt,
      created_at: answeredAt,
    });

    if (error) {
      console.error("Kunne ikke gemme foto-upload i answers:", error);
      await logHandledServerError({
        route: "/api/play/submit-photo",
        method: "POST",
        status: 500,
        error,
        requestPath,
        routeType: "route",
        participantId,
        sessionId,
      });
      return NextResponse.json({ error: error.message ?? "Kunne ikke gemme fotoet." }, { status: 500 });
    }

    await maybeStampRunStartedAt(
      sessionId,
      participantId,
      postIndex,
      run.raceType ?? run.race_type,
      run.questions.length,
      adminSupabase,
      answeredAt
    );

    return NextResponse.json({
      storedAnswer: true,
      awardedPoints,
      imageUrl: uploadedPhoto.imageUrl,
      message: "Billedet er uploadet til laererens foto-stroem.",
      isLocked: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Foto-upload fejlede:", error);
    await logHandledServerError({
      route: "/api/play/submit-photo",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json({ error: "Foto-upload fejlede." }, { status: 500 });
  }
}