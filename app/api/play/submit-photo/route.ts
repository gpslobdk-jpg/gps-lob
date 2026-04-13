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
  participantId: string,
  answeredAt: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("answers")
    .select("id,image_url")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .eq("answered_at", answeredAt)
    .maybeSingle<ExistingPhotoAnswerRow>();

  if (error) {
    if (isMissingColumnError(error)) {
      return null;
    }

    throw new Error(error.message ?? "Kunne ikke tjekke eksisterende foto-svar.");
  }

  return data ?? null;
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
    if (!run || !Array.isArray(run.questions) || postIndex >= run.questions.length) {
      return NextResponse.json({ error: "Foto-posten kunne ikke findes." }, { status: 404 });
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

    const existingAnswer = await findExistingPhotoAnswer(
      sessionId,
      participantId,
      answeredAt,
      adminSupabase
    );
    const awardedPoints = getAwardedPoints(rawQuestion, true);

    if (!existingAnswer?.id) {
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
    }

    return NextResponse.json({
      storedAnswer: true,
      awardedPoints,
      imageUrl: uploadedPhoto.imageUrl,
      message: "Billedet er uploadet til laererens foto-stroem.",
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