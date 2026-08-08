import { NextResponse } from "next/server";

import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import { getAwardedPoints } from "@/utils/questionPoints";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";
import { usesStandardStudentLocationExperience } from "@/lib/location/studentLocationState";
import {
  getProtectedAnswerPhotoUrl,
  PARTICIPANT_UPLOADS_BUCKET,
} from "@/lib/studentData/privacyPolicy";
import {
  PhotoUploadValidationError,
  PHOTO_UPLOAD_MAX_BYTES,
  sanitizeUploadedPhoto,
  type SanitizedPhoto,
} from "@/lib/studentData/photoUpload";
import { createPhotoRateLimitFingerprint } from "@/lib/studentData/photoRateLimit";
import { registerParticipantPhotoObject } from "@/utils/supabase/participantPhotos";
import {
  asTrimmedString,
  fetchParticipantStartState,
  fetchRunForSession,
  getAnsweredPostIndex,
  getFirstRoutePostIndexForParticipant,
  getServerRouteOrder,
  resolveQuestionVariant,
  supportsServerStaggeredStart,
} from "@/app/api/play/_shared";

export const maxDuration = 60;

const RUN_OUT_OF_SYNC_ERROR_CODE = "RUN_OUT_OF_SYNC";
const PHOTO_OPERATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type ResolvedPhotoRun = NonNullable<
  Awaited<ReturnType<typeof fetchRunForSession>>
> & {
  questions: unknown[];
};

type ActiveSessionRow = {
  id?: string | null;
};

type PhotoProgressRow = {
  post_index?: number | string | null;
  question_index?: number | string | null;
};

type ExistingPhotoAnswerRow = {
  id?: string | null;
  participant_id?: string | null;
  image_url?: string | null;
  awarded_points?: number | string | null;
  is_correct?: boolean | null;
  post_index?: number | string | null;
  question_index?: number | string | null;
  client_operation_id?: string | null;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  status?: number | string;
  statusCode?: number | string;
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

function isUniqueViolationError(error: SupabaseLikeError | null | undefined) {
  return error?.code === "23505";
}

function parsePhotoSubmissionOperationId(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return {
      provided: false,
      valid: true,
      value: null as string | null,
    };
  }

  if (typeof value !== "string") {
    return {
      provided: true,
      valid: false,
      value: null as string | null,
    };
  }

  const normalized = value.trim().toLowerCase();
  return {
    provided: true,
    valid: PHOTO_OPERATION_ID_PATTERN.test(normalized),
    value: PHOTO_OPERATION_ID_PATTERN.test(normalized)
      ? normalized
      : null,
  };
}

function buildPhotoStoragePath(
  sessionId: string,
  participantId: string,
  answerId: string,
  postIndex: number
) {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "") || "session";
  const safeParticipantId = participantId.replace(/[^a-zA-Z0-9_-]/g, "") || "participant";
  const safeAnswerId = answerId.replace(/[^a-fA-F0-9-]/g, "");
  return `private-v2/${safeSessionId}/${safeParticipantId}/${safeAnswerId}-${postIndex}.jpg`;
}

function getQuestionText(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return "";
  return asTrimmedString(rawQuestion.text);
}

function isSelfiePhotoQuestion(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return false;
  return rawQuestion.isSelfie === true || rawQuestion.is_selfie === true;
}

function isActualStoredPhotoAnswer(answer: ExistingPhotoAnswerRow) {
  return (
    answer.is_correct === true &&
    Boolean(asTrimmedString(answer.image_url))
  );
}

async function uploadPhotoToStorage(
  image: SanitizedPhoto,
  answerId: string,
  sessionId: string,
  participantId: string,
  postIndex: number,
  adminSupabase: AdminSupabaseClient
) {
  const storagePath = buildPhotoStoragePath(
    sessionId,
    participantId,
    answerId,
    postIndex
  );
  const { error: uploadError } = await adminSupabase.storage
    .from(PARTICIPANT_UPLOADS_BUCKET)
    .upload(storagePath, image.buffer, {
      contentType: image.mimeType,
      upsert: false,
      cacheControl: "0",
    });

  if (uploadError) {
    console.error("Kunne ikke uploade deltagerbillede til Storage.");
    return {
      imageUrl: null as string | null,
      storagePath,
      createdByRequest: true,
    };
  }

  return {
    imageUrl: getProtectedAnswerPhotoUrl(answerId),
    storagePath,
    createdByRequest: true,
  };
}

function shouldRemovePhotoUploadAfterDuplicate({
  createdByRequest,
  uploadedImageUrl,
  storedImageUrl,
}: {
  createdByRequest: boolean;
  uploadedImageUrl: string | null;
  storedImageUrl: string | null | undefined;
}) {
  return (
    createdByRequest &&
    Boolean(uploadedImageUrl) &&
    uploadedImageUrl !== (storedImageUrl ?? null)
  );
}

async function removeNewPhotoUpload(
  storagePath: string | null,
  createdByRequest: boolean,
  adminSupabase: AdminSupabaseClient
) {
  if (!storagePath || !createdByRequest) return;

  const { error } = await adminSupabase.storage
    .from(PARTICIPANT_UPLOADS_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error("Kunne ikke rydde en urefereret deltagerfoto-upload.");
  }
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
    console.error("Kunne ikke validere aktiv live-session til foto-upload.");
    return { ok: false as const };
  }

  return {
    ok: true as const,
    session: data ?? null,
  };
}

async function fetchAnsweredPhotoProgress(
  sessionId: string,
  participantId: string,
  adminSupabase: AdminSupabaseClient
) {
  for (const selectClause of [
    "question_index,post_index",
    "question_index",
    "post_index",
  ] as const) {
    const { data, error } = await adminSupabase
      .from("answers")
      .select(selectClause)
      .eq("session_id", sessionId)
      .eq("participant_id", participantId);

    if (error) {
      if (isMissingColumnError(error)) {
        continue;
      }

      throw new Error(
        error.message ?? "Kunne ikke hente eksisterende foto-progression."
      );
    }

    const answeredPostIndexes = new Set<number>();
    for (const row of (Array.isArray(data) ? data : []) as PhotoProgressRow[]) {
      const answeredPostIndex = getAnsweredPostIndex(
        row as Record<string, unknown>
      );
      if (answeredPostIndex !== null && answeredPostIndex >= 0) {
        answeredPostIndexes.add(answeredPostIndex);
      }
    }

    return answeredPostIndexes;
  }

  return null;
}

async function findExistingPhotoAnswer(
  sessionId: string,
  studentName: string,
  participantId: string,
  postIndex: number,
  adminSupabase: AdminSupabaseClient,
  lookupMode: "standard" | "legacy"
): Promise<ExistingPhotoAnswerRow | null> {
  const normalizedStudentName = asTrimmedString(studentName);
  const normalizedParticipantId = asTrimmedString(participantId);
  const lookupCandidates =
    lookupMode === "standard"
      ? [
          normalizedParticipantId
            ? {
                column: "participant_id" as const,
                value: normalizedParticipantId,
                legacyOnly: false,
              }
            : null,
          normalizedStudentName
            ? {
                column: "student_name" as const,
                value: normalizedStudentName,
                legacyOnly: true,
              }
            : null,
        ]
      : [
          normalizedStudentName
            ? {
                column: "student_name" as const,
                value: normalizedStudentName,
                legacyOnly: false,
              }
            : null,
          !normalizedStudentName && normalizedParticipantId
            ? {
                column: "participant_id" as const,
                value: normalizedParticipantId,
                legacyOnly: false,
              }
            : null,
        ];
  const normalizedLookupCandidates = lookupCandidates.filter(
    (
      candidate
    ): candidate is {
      column: "student_name" | "participant_id";
      value: string;
      legacyOnly: boolean;
    } => candidate !== null
  );

  if (normalizedLookupCandidates.length === 0) {
    return null;
  }

  for (const lookup of normalizedLookupCandidates) {
    for (const column of ["question_index", "post_index"] as const) {
      const value = column === "question_index" ? postIndex : postIndex + 1;
      let query = adminSupabase
        .from("answers")
        .select("id,participant_id,image_url,awarded_points,is_correct")
        .eq("session_id", sessionId)
        .eq(lookup.column, lookup.value)
        .eq(column, value);

      if (lookup.legacyOnly) {
        query = query.is("participant_id", null);
      }

      const { data, error } =
        await query.maybeSingle<ExistingPhotoAnswerRow>();

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

function getExistingPhotoAnswerPostIndex(
  answer: ExistingPhotoAnswerRow
) {
  const questionIndex = Number(answer.question_index);
  if (Number.isInteger(questionIndex) && questionIndex >= 0) {
    return questionIndex;
  }

  const postIndex = Number(answer.post_index);
  if (Number.isInteger(postIndex) && postIndex >= 1) {
    return postIndex - 1;
  }

  return null;
}

async function findExistingPhotoAnswerByOperationId(
  sessionId: string,
  participantId: string,
  operationId: string,
  adminSupabase: AdminSupabaseClient
): Promise<ExistingPhotoAnswerRow | null> {
  const { data, error } = await adminSupabase
    .from("answers")
    .select(
      "id,participant_id,image_url,awarded_points,is_correct,post_index,question_index,client_operation_id"
    )
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .eq("client_operation_id", operationId)
    .limit(1);

  if (error) {
    if (isMissingColumnError(error)) {
      return null;
    }

    throw new Error(
      error.message ?? "Kunne ikke tjekke eksisterende foto-operation."
    );
  }

  return Array.isArray(data)
    ? (data as ExistingPhotoAnswerRow[])[0] ?? null
    : null;
}

function createPhotoSubmissionConflictResponse(
  code: "PHOTO_OPERATION_CONFLICT" | "PHOTO_SUBMISSION_CONFLICT",
  error: string
) {
  return NextResponse.json(
    {
      error,
      code,
    },
    { status: 409 }
  );
}

async function validateStandardPhotoProgress({
  sessionId,
  participantId,
  postIndex,
  startOffset,
  run,
  adminSupabase,
}: {
  sessionId: string;
  participantId: string;
  postIndex: number;
  startOffset: number | string | null;
  run: ResolvedPhotoRun;
  adminSupabase: AdminSupabaseClient;
}) {
  const answeredPostIndexes = await fetchAnsweredPhotoProgress(
    sessionId,
    participantId,
    adminSupabase
  );
  if (answeredPostIndexes === null) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Foto-aflevering understottes ikke med den nuvaerende answers-struktur.",
          code: "ANSWERS_SCHEMA_INCOMPATIBLE",
        },
        { status: 503 }
      ),
    };
  }

  const routeOrder = getServerRouteOrder(
    run.questions.length,
    startOffset ?? 0,
    supportsServerStaggeredStart(
      run.raceType ?? run.race_type,
      run.sessionPostOrderMode,
      run.routeVersion
    )
  );
  const expectedPostIndex =
    routeOrder.find(
      (candidatePostIndex) => !answeredPostIndexes.has(candidatePostIndex)
    ) ?? null;

  if (expectedPostIndex !== postIndex) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Foto-posten er ikke laengere synkron med loebet.",
          code: RUN_OUT_OF_SYNC_ERROR_CODE,
          postIndex,
          expectedPostIndex,
          questionCount: run.questions.length,
        },
        { status: 409 }
      ),
    };
  }

  return { ok: true as const };
}

async function maybeStampRunStartedAt(
  sessionId: string,
  participantId: string,
  postIndex: number,
  raceMode: unknown,
  postOrderMode: unknown,
  routeVersion: unknown,
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
    raceMode,
    postOrderMode,
    routeVersion
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

async function createPhotoDuplicateResponse({
  existingAnswer,
  sessionId,
  participantId,
  postIndex,
  run,
  adminSupabase,
  answeredAt,
}: {
  existingAnswer: ExistingPhotoAnswerRow;
  sessionId: string;
  participantId: string;
  postIndex: number;
  run: ResolvedPhotoRun;
  adminSupabase: AdminSupabaseClient;
  answeredAt: string;
}) {
  await maybeStampRunStartedAt(
    sessionId,
    participantId,
    postIndex,
    run.raceType ?? run.race_type,
    run.sessionPostOrderMode,
    run.routeVersion,
    run.questions.length,
    adminSupabase,
    answeredAt
  );

  const existingAwardedPoints = Number(existingAnswer.awarded_points);
  const rawQuestion = run.questions[postIndex];
  const responseAwardedPoints = Number.isFinite(existingAwardedPoints)
    ? Math.max(0, Math.round(existingAwardedPoints))
    : rawQuestion
      ? getAwardedPoints(rawQuestion, true)
      : 0;

  return NextResponse.json({
    storedAnswer: true,
    duplicate: true,
    storedIsCorrect: true,
    awardedPoints: responseAwardedPoints,
    imageUrl: existingAnswer.image_url ?? null,
    message: "Billedet er uploadet til laererens foto-stroem.",
    isLocked: true,
  });
}

async function insertPhotoAnswerWithOperationFallback({
  payload,
  operationId,
  adminSupabase,
}: {
  payload: Record<string, unknown>;
  operationId: string | null;
  adminSupabase: AdminSupabaseClient;
}) {
  const operationPayload = operationId
    ? {
        ...payload,
        client_operation_id: operationId,
      }
    : payload;
  const firstResult = await adminSupabase
    .from("answers")
    .insert(operationPayload);

  if (
    operationId &&
    firstResult.error &&
    isMissingColumnError(firstResult.error)
  ) {
    return adminSupabase.from("answers").insert(payload);
  }

  return firstResult;
}

export async function POST(request: Request) {
  let formData: FormData;
  const requestPath = new URL(request.url).pathname;
  const contentLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > PHOTO_UPLOAD_MAX_BYTES + 256 * 1024
  ) {
    return NextResponse.json(
      {
        error: "Billedet er for stort til at blive sendt.",
        code: "PHOTO_TOO_LARGE",
        maxBytes: PHOTO_UPLOAD_MAX_BYTES,
      },
      { status: 413 }
    );
  }

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
    const operationIdEntry = formData.get("operationId");

    if (!(imageEntry instanceof File) || postIndex === null) {
      return NextResponse.json({ error: "Billede eller postdata mangler." }, { status: 400 });
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

    const { participantId, sessionId, studentName, startOffset } =
      participantContext.data;
    const activeSessionLookup = await fetchActiveSession(
      sessionId,
      adminSupabase
    );
    if (!activeSessionLookup.ok) {
      return NextResponse.json(
        {
          error: "Sessionens status kunne ikke kontrolleres sikkert.",
          code: "SESSION_LOOKUP_FAILED",
        },
        { status: 503 }
      );
    }

    const activeSession = activeSessionLookup.session;
    if (!activeSession?.id) {
      const closedOperation = parsePhotoSubmissionOperationId(operationIdEntry);
      if (closedOperation.valid && closedOperation.value) {
        const closedRunResult = await fetchRunForSession(sessionId);
        const closedRun =
          closedRunResult && Array.isArray(closedRunResult.questions)
            ? (closedRunResult as ResolvedPhotoRun)
            : null;
        const closedQuestion = closedRun?.questions[postIndex];
        const isClosedRobustStandardPhoto =
          Boolean(closedRun) &&
          usesStandardStudentLocationExperience(
            closedRun?.raceType ?? closedRun?.race_type
          ) &&
          !isSelfiePhotoQuestion(closedQuestion);

        if (closedRun && isClosedRobustStandardPhoto) {
          const existingOperation =
            await findExistingPhotoAnswerByOperationId(
              sessionId,
              participantId,
              closedOperation.value,
              adminSupabase
            );
          if (
            existingOperation &&
            getExistingPhotoAnswerPostIndex(existingOperation) !== postIndex
          ) {
            return createPhotoSubmissionConflictResponse(
              "PHOTO_OPERATION_CONFLICT",
              "Billedets afleverings-id tilhorer en anden post."
            );
          }

          const existingClosedAnswer =
            existingOperation ??
            (await findExistingPhotoAnswer(
              sessionId,
              studentName,
              participantId,
              postIndex,
              adminSupabase,
              "standard"
            ));
          if (existingClosedAnswer) {
            if (!isActualStoredPhotoAnswer(existingClosedAnswer)) {
              return createPhotoSubmissionConflictResponse(
                "PHOTO_SUBMISSION_CONFLICT",
                "Posten er allerede afsluttet med en anden aflevering."
              );
            }

            return createPhotoDuplicateResponse({
              existingAnswer: existingClosedAnswer,
              sessionId,
              participantId,
              postIndex,
              run: closedRun,
              adminSupabase,
              answeredAt,
            });
          }

          return NextResponse.json(
            {
              error: "Sessionen er ikke aktiv laengere.",
              code: "SESSION_CLOSED",
            },
            { status: 410 }
          );
        }
      }

      return NextResponse.json({ error: "Sessionen er ikke aktiv laengere." }, { status: 404 });
    }

    const requestFingerprint = createPhotoRateLimitFingerprint(request);
    if (!requestFingerprint) {
      return NextResponse.json(
        {
          error: "Foto-uploadens sikkerhedskontrol er midlertidigt utilgaengelig.",
          code: "PHOTO_RATE_LIMIT_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const { data: uploadAllowed, error: rateLimitError } =
      await adminSupabase.rpc("consume_participant_photo_upload_limit", {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_request_fingerprint: requestFingerprint,
      });

    if (rateLimitError) {
      return NextResponse.json(
        {
          error: "Foto-uploadens sikkerhedskontrol er midlertidigt utilgaengelig.",
          code: "PHOTO_RATE_LIMIT_UNAVAILABLE",
        },
        { status: 503 }
      );
    }
    if (uploadAllowed !== true) {
      return NextResponse.json(
        {
          error: "Vent et oejeblik, foer du sender billedet igen.",
          code: "PHOTO_RATE_LIMITED",
        },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const runResult = await fetchRunForSession(sessionId);
    if (!runResult || !Array.isArray(runResult.questions)) {
      return NextResponse.json(
        {
          error: "Foto-posten kunne ikke findes.",
          code: "POST_NOT_FOUND",
        },
        { status: 404 }
      );
    }
    const run = runResult as ResolvedPhotoRun;

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

    const isStandardStudentSubmission =
      usesStandardStudentLocationExperience(
        run.raceType ?? run.race_type
      );
    const isSelfiePhotoTask = isSelfiePhotoQuestion(rawQuestion);
    const parsedOperationId =
      isStandardStudentSubmission && !isSelfiePhotoTask
      ? parsePhotoSubmissionOperationId(operationIdEntry)
      : {
          provided: false,
          valid: true,
          value: null as string | null,
        };

    if (!parsedOperationId.valid) {
      return NextResponse.json(
        {
          error: "Billedets afleverings-id er ugyldigt.",
          code: "INVALID_OPERATION_ID",
        },
        { status: 400 }
      );
    }

    const operationId = parsedOperationId.value;
    const usesRobustStandardPhotoDelivery =
      isStandardStudentSubmission &&
      !isSelfiePhotoTask &&
      operationId !== null;
    if (imageEntry.size > PHOTO_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          error: "Billedet er for stort til at blive sendt.",
          code: "PHOTO_TOO_LARGE",
          maxBytes: PHOTO_UPLOAD_MAX_BYTES,
        },
        { status: 413 }
      );
    }

    let image: SanitizedPhoto;
    try {
      image = await sanitizeUploadedPhoto(imageEntry);
    } catch (error) {
      const code =
        error instanceof PhotoUploadValidationError
          ? error.code
          : "PHOTO_DECODE_FAILED";
      return NextResponse.json(
        { error: "Billedfilen er ugyldig.", code },
        { status: 400 }
      );
    }

    let existingAnswer: ExistingPhotoAnswerRow | null = null;
    if (operationId) {
      const existingOperation =
        await findExistingPhotoAnswerByOperationId(
          sessionId,
          participantId,
          operationId,
          adminSupabase
        );
      if (
        existingOperation &&
        getExistingPhotoAnswerPostIndex(existingOperation) !== postIndex
      ) {
        return NextResponse.json(
          {
            error: "Billedets afleverings-id tilhører en anden post.",
            code: "PHOTO_OPERATION_CONFLICT",
          },
          { status: 409 }
        );
      }

      existingAnswer = existingOperation;
    }

    existingAnswer ??= await findExistingPhotoAnswer(
      sessionId,
      studentName,
      participantId,
      postIndex,
      adminSupabase,
      usesRobustStandardPhotoDelivery ? "standard" : "legacy"
    );
    const awardedPoints = getAwardedPoints(rawQuestion, true);

    if (existingAnswer) {
      if (
        usesRobustStandardPhotoDelivery &&
        !isActualStoredPhotoAnswer(existingAnswer)
      ) {
        return createPhotoSubmissionConflictResponse(
          "PHOTO_SUBMISSION_CONFLICT",
          "Posten er allerede afsluttet med en anden aflevering."
        );
      }

      if (usesRobustStandardPhotoDelivery) {
        return createPhotoDuplicateResponse({
          existingAnswer,
          sessionId,
          participantId,
          postIndex,
          run,
          adminSupabase,
          answeredAt,
        });
      }

      await maybeStampRunStartedAt(
        sessionId,
        participantId,
        postIndex,
        run.raceType ?? run.race_type,
        run.sessionPostOrderMode,
        run.routeVersion,
        run.questions.length,
        adminSupabase,
        answeredAt
      );

      const existingAwardedPoints = Number(existingAnswer.awarded_points);
      const responseAwardedPoints =
        Number.isFinite(existingAwardedPoints) ? Math.max(0, Math.round(existingAwardedPoints)) : awardedPoints;

      return NextResponse.json({
        storedAnswer: true,
        duplicate: true,
        awardedPoints: responseAwardedPoints,
        imageUrl: existingAnswer.image_url ?? null,
        message: "Billedet er uploadet til laererens foto-stroem.",
        isLocked: true,
      });
    }

    if (usesRobustStandardPhotoDelivery) {
      const progressResult = await validateStandardPhotoProgress({
        sessionId,
        participantId,
        postIndex,
        startOffset,
        run,
        adminSupabase,
      });
      if (!progressResult.ok) {
        return progressResult.response;
      }
    }

    const answerId = crypto.randomUUID();
    const uploadedPhoto = await uploadPhotoToStorage(
      image,
      answerId,
      sessionId,
      participantId,
      postIndex,
      adminSupabase
    );

    if (!uploadedPhoto.imageUrl || !uploadedPhoto.storagePath) {
      await removeNewPhotoUpload(
        uploadedPhoto.storagePath,
        uploadedPhoto.createdByRequest,
        adminSupabase
      );
      return NextResponse.json({ error: "Billedet kunne ikke uploades." }, { status: 500 });
    }

    const photoAnswerPayload: Record<string, unknown> = {
      id: answerId,
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
    };
    const { error } = await insertPhotoAnswerWithOperationFallback({
      payload: photoAnswerPayload,
      operationId,
      adminSupabase,
    });

    if (error && isUniqueViolationError(error)) {
      const existingAfterConflict = await findExistingPhotoAnswer(
        sessionId,
        studentName,
        participantId,
        postIndex,
        adminSupabase,
        usesRobustStandardPhotoDelivery ? "standard" : "legacy"
      );

      if (existingAfterConflict) {
        if (
          shouldRemovePhotoUploadAfterDuplicate({
            createdByRequest: uploadedPhoto.createdByRequest,
            uploadedImageUrl: uploadedPhoto.imageUrl,
            storedImageUrl: existingAfterConflict.image_url,
          })
        ) {
          await removeNewPhotoUpload(
            uploadedPhoto.storagePath,
            uploadedPhoto.createdByRequest,
            adminSupabase
          );
        }

        if (
          usesRobustStandardPhotoDelivery &&
          !isActualStoredPhotoAnswer(existingAfterConflict)
        ) {
          return createPhotoSubmissionConflictResponse(
            "PHOTO_SUBMISSION_CONFLICT",
            "Posten blev afsluttet med en anden aflevering."
          );
        }

        if (usesRobustStandardPhotoDelivery) {
          return createPhotoDuplicateResponse({
            existingAnswer: existingAfterConflict,
            sessionId,
            participantId,
            postIndex,
            run,
            adminSupabase,
            answeredAt,
          });
        }

        await maybeStampRunStartedAt(
          sessionId,
          participantId,
          postIndex,
          run.raceType ?? run.race_type,
          run.sessionPostOrderMode,
          run.routeVersion,
          run.questions.length,
          adminSupabase,
          answeredAt
        );

        const existingAwardedPoints = Number(
          existingAfterConflict.awarded_points
        );
        const responseAwardedPoints = Number.isFinite(existingAwardedPoints)
          ? Math.max(0, Math.round(existingAwardedPoints))
          : awardedPoints;

        return NextResponse.json({
          storedAnswer: true,
          duplicate: true,
          awardedPoints: responseAwardedPoints,
          imageUrl: existingAfterConflict.image_url ?? null,
          message: "Billedet er uploadet til laererens foto-stroem.",
          isLocked: true,
        });
      }

      await removeNewPhotoUpload(
        uploadedPhoto.storagePath,
        uploadedPhoto.createdByRequest,
        adminSupabase
      );

      return NextResponse.json(
        {
          error: "Billedet kolliderede med en anden aflevering.",
          code: "PHOTO_SUBMISSION_CONFLICT",
        },
        { status: 409 }
      );
    }

    if (error) {
      await removeNewPhotoUpload(
        uploadedPhoto.storagePath,
        uploadedPhoto.createdByRequest,
        adminSupabase
      );
      console.error("Kunne ikke gemme foto-upload i answers.");
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

    try {
      await registerParticipantPhotoObject({
        answerId,
        sessionId,
        participantId,
        objectPath: uploadedPhoto.storagePath,
        adminSupabase,
      });
    } catch (registrationError) {
      await adminSupabase.from("answers").delete().eq("id", answerId);
      await removeNewPhotoUpload(
        uploadedPhoto.storagePath,
        uploadedPhoto.createdByRequest,
        adminSupabase
      );
      await logHandledServerError({
        route: "/api/play/submit-photo",
        method: "POST",
        status: 500,
        error: registrationError,
        requestPath,
        routeType: "route",
        participantId,
        sessionId,
      });
      return NextResponse.json(
        { error: "Fotoet kunne ikke registreres sikkert." },
        { status: 500 }
      );
    }

    await maybeStampRunStartedAt(
      sessionId,
      participantId,
      postIndex,
      run.raceType ?? run.race_type,
      run.sessionPostOrderMode,
      run.routeVersion,
      run.questions.length,
      adminSupabase,
      answeredAt
    );

    return NextResponse.json({
      storedAnswer: true,
      ...(usesRobustStandardPhotoDelivery
        ? { storedIsCorrect: true }
        : {}),
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
