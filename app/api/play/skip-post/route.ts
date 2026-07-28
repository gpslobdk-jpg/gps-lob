import { NextRequest, NextResponse } from "next/server";

import {
  asTrimmedString,
  getAnsweredPostIndex,
  getPhotoMissionConfig,
  getServerRouteOrder,
  normalizeRaceMode,
  resolveQuestionVariant,
  supportsServerStaggeredStart,
} from "@/app/api/play/_shared";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import {
  logHandledServerError,
  writeTelemetryLog,
} from "@/utils/telemetry/serverLogs";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";
import { usesStandardStudentLocationExperience } from "@/lib/location/studentLocationState";

export const runtime = "edge";
export const maxDuration = 60;

const SKIPPABLE_SESSION_STATUSES = new Set(["running", "active", "paused"]);

type SkipPostPayload = {
  sessionId?: unknown;
  participantId?: unknown;
  postIndex?: unknown;
};

type LiveSessionStateRow = {
  id?: string | null;
  run_id?: string | null;
  status?: string | null;
  post_order_mode?: unknown;
  route_version?: number | string | null;
};

type RunRow = {
  questions?: unknown;
  raceType?: unknown;
  race_type?: unknown;
};

type AnswerLookupRow = {
  question_index?: number | string | null;
  post_index?: number | string | null;
};

type ExistingAnswerOutcomeRow = {
  id?: string | null;
  is_correct?: boolean | null;
};

type SupabaseLikeError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

function asPostIndex(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function getPostType(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return null;

  if (typeof rawQuestion.post_type === "string") {
    return rawQuestion.post_type;
  }

  if (typeof rawQuestion.postType === "string") {
    return rawQuestion.postType;
  }

  return null;
}

function getQuestionText(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return "";
  return typeof rawQuestion.text === "string" ? rawQuestion.text : "";
}

function buildTelemetryMessage(fields: Record<string, unknown>) {
  return Object.entries(fields)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${String(value).replace(/[\r\n|]/g, " ").replace(/=/g, ":")}`)
    .join("|")
    .slice(0, 500);
}

async function logSkipSuccessTelemetry({
  participantId,
  sessionId,
  postIndex,
  raceMode,
  variant,
}: {
  participantId: string | null;
  sessionId: string | null;
  postIndex: number;
  raceMode: string;
  variant: string;
}) {
  await writeTelemetryLog({
    eventType: "play_emergency_skip_succeeded",
    participantId,
    sessionId,
    message: buildTelemetryMessage({
      postIndex,
      raceMode,
      variant,
    }),
  });
}

async function logSkipFailureTelemetry({
  participantId,
  sessionId,
  status,
  reason,
  postIndex,
  expectedPostIndex,
  raceMode,
  variant,
}: {
  participantId: string | null;
  sessionId: string | null;
  status: number;
  reason: string;
  postIndex?: number | null;
  expectedPostIndex?: number | null;
  raceMode?: string | null;
  variant?: string | null;
}) {
  await writeTelemetryLog({
    eventType: "play_emergency_skip_failed",
    participantId,
    sessionId,
    message: buildTelemetryMessage({
      status,
      reason,
      postIndex,
      expectedPostIndex,
      raceMode,
      variant,
    }),
  });
}

async function fetchSessionState(
  sessionId: string,
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const { data, error } = await adminSupabase
    .from("live_sessions")
    .select("id,run_id,status,post_order_mode,route_version")
    .eq("id", sessionId)
    .maybeSingle<LiveSessionStateRow>();

  if (error) {
    throw new Error(error.message ?? "Kunne ikke hente sessionen.");
  }

  return data ?? null;
}

async function fetchRunRow(
  runId: string,
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const { data, error } = await adminSupabase
    .from("gps_runs")
    .select("questions,raceType,race_type")
    .eq("id", runId)
    .maybeSingle<RunRow>();

  if (error) {
    throw new Error(error.message ?? "Kunne ikke hente løbet.");
  }

  return data ?? null;
}

async function fetchAnswerRowsForParticipant(
  sessionId: string,
  participantId: string,
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const runQuery = (selectClause: string) =>
    adminSupabase
      .from("answers")
      .select(selectClause)
      .eq("session_id", sessionId)
      .eq("participant_id", participantId);

  for (const selectClause of ["question_index,post_index", "question_index", "post_index"] as const) {
    const result = await runQuery(selectClause);

    if (result.error) {
      if (isMissingColumnError(result.error)) {
        continue;
      }

      throw new Error(result.error.message ?? "Kunne ikke hente eksisterende svar.");
    }

    return Array.isArray(result.data) ? (result.data as AnswerLookupRow[]) : [];
  }

  return null;
}

async function fetchAnsweredPostIndexes(
  sessionId: string,
  participantId: string,
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const answeredPostIndexes = new Set<number>();

  const rows = await fetchAnswerRowsForParticipant(sessionId, participantId, adminSupabase);
  if (rows === null) {
    return null;
  }

  for (const row of rows) {
    const normalizedPostIndex = getAnsweredPostIndex(row as Record<string, unknown>);
    if (normalizedPostIndex !== null && normalizedPostIndex >= 0) {
      answeredPostIndexes.add(normalizedPostIndex);
    }
  }

  return answeredPostIndexes;
}

async function findExistingAnswerOutcome(
  sessionId: string,
  participantId: string,
  postIndex: number,
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>
) {
  let hasUsableIndexColumn = false;

  for (const column of ["question_index", "post_index"] as const) {
    const value = column === "question_index" ? postIndex : postIndex + 1;
    const { data, error } = await adminSupabase
      .from("answers")
      .select("id,is_correct")
      .eq("session_id", sessionId)
      .eq("participant_id", participantId)
      .eq(column, value)
      .limit(1);

    if (error) {
      if (isMissingColumnError(error)) {
        continue;
      }

      throw new Error(error.message ?? "Kunne ikke tjekke eksisterende skip-svar.");
    }

    hasUsableIndexColumn = true;

    if (Array.isArray(data) && data.length > 0) {
      return (data as ExistingAnswerOutcomeRow[])[0] ?? false;
    }
  }

  return hasUsableIndexColumn ? false : null;
}

function isSkipEquivalentOutcome(
  answer: ExistingAnswerOutcomeRow | false | null
) {
  return answer !== null && answer !== false && answer.is_correct === false;
}

function createSkipDuplicateResponse({
  postIndex,
  expectedPostIndex,
}: {
  postIndex: number;
  expectedPostIndex: number | null;
}) {
  return NextResponse.json({
    skipped: true,
    duplicate: true,
    storedIsCorrect: false,
    postIndex,
    awardedPoints: 0,
    expectedPostIndex,
  });
}

function createSkipOutcomeConflictResponse(expectedPostIndex: number | null) {
  return NextResponse.json(
    {
      error: "Posten er allerede afsluttet med en anden aflevering.",
      code: "SUBMISSION_CONFLICT",
      expectedPostIndex,
    },
    { status: 409 }
  );
}

async function maybeStampRunStartedAt(
  sessionId: string,
  participantId: string,
  answeredPostIndex: number,
  firstRoutePostIndex: number | null,
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>
) {
  if (firstRoutePostIndex === null || answeredPostIndex !== firstRoutePostIndex) {
    return;
  }

  const { error } = await adminSupabase
    .from("participants")
    .update({ run_started_at: new Date().toISOString() })
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .is("run_started_at", null);

  if (error && !isMissingColumnError(error)) {
    throw new Error(error.message ?? "Kunne ikke gemme run_started_at.");
  }
}

function buildSkipAnswerPayloads({
  sessionId,
  participantId,
  studentName,
  postIndex,
  questionText,
}: {
  sessionId: string;
  participantId: string;
  studentName: string;
  postIndex: number;
  questionText: string;
}) {
  const timestamp = new Date().toISOString();

  return [
    {
      session_id: sessionId,
      participant_id: participantId,
      student_name: studentName,
      post_index: postIndex + 1,
      question_index: postIndex,
      selected_index: 0,
      answer_index: 0,
      is_correct: false,
      awarded_points: 0,
      question_text: questionText,
      answered_at: timestamp,
      created_at: timestamp,
    },
    {
      session_id: sessionId,
      participant_id: participantId,
      student_name: studentName,
      post_index: postIndex + 1,
      selected_index: 0,
      is_correct: false,
      awarded_points: 0,
      answered_at: timestamp,
    },
    {
      session_id: sessionId,
      participant_id: participantId,
      student_name: studentName,
      question_index: postIndex,
      answer_index: 0,
      is_correct: false,
      awarded_points: 0,
      created_at: timestamp,
    },
    {
      session_id: sessionId,
      participant_id: participantId,
      student_name: studentName,
      is_correct: false,
      awarded_points: 0,
    },
  ];
}

async function persistEmergencySkip(
  payloads: Record<string, unknown>[],
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>
) {
  for (const payload of payloads) {
    const { error } = await adminSupabase.from("answers").insert(payload);

    if (!error) {
      return { ok: true as const };
    }

    if (isUniqueViolationError(error)) {
      return { ok: false as const, kind: "conflict" as const };
    }

    if (isMissingColumnError(error)) {
      continue;
    }

    throw new Error(error.message ?? "Kunne ikke gemme emergency skip.");
  }

  return { ok: false as const, kind: "missing_columns" as const };
}

export async function POST(request: NextRequest) {
  let payload: SkipPostPayload;
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    payload = (await request.json()) as SkipPostPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const claimedSessionId = asTrimmedString(payload.sessionId);
  const claimedParticipantId = asTrimmedString(payload.participantId);
  const requestedPostIndex = asPostIndex(payload.postIndex);

  if (!claimedSessionId || !claimedParticipantId || requestedPostIndex === null) {
    return NextResponse.json({ error: "Manglende skip-data." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
  }

  try {
    const participantContext = await resolveParticipantRequestContext({
      adminSupabase,
      claimedParticipantId,
      claimedSessionId,
    });

    if (!participantContext.ok) {
      await logSkipFailureTelemetry({
        participantId: claimedParticipantId || null,
        sessionId: claimedSessionId || null,
        status: participantContext.status,
        reason: "participant_context_failed",
        postIndex: requestedPostIndex,
      });
      return NextResponse.json({ error: participantContext.error }, { status: participantContext.status });
    }

    const { participantId, sessionId, studentName, startOffset } = participantContext.data;
    const sessionState = await fetchSessionState(sessionId, adminSupabase);
    if (!sessionState?.id) {
      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 404,
        reason: "session_missing",
        postIndex: requestedPostIndex,
      });
      return NextResponse.json(
        {
          error: "Løbet kunne ikke findes.",
          code: "SESSION_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const normalizedSessionStatus = asTrimmedString(sessionState.status).toLocaleLowerCase("da-DK");
    if (!SKIPPABLE_SESSION_STATUSES.has(normalizedSessionStatus)) {
      const closedRunId = asTrimmedString(sessionState.run_id);
      if (closedRunId) {
        const closedRun = await fetchRunRow(closedRunId, adminSupabase);
        const closedQuestions = Array.isArray(closedRun?.questions)
          ? closedRun.questions
          : [];
        const closedRaceType = closedRun?.raceType ?? closedRun?.race_type;
        const closedQuestion = closedQuestions[requestedPostIndex];
        const closedVariant = resolveQuestionVariant(
          closedRaceType,
          closedQuestion
        );
        const closedPostType =
          getPostType(closedQuestion)?.trim().toLocaleLowerCase("da-DK") ?? "";
        const canReconcileClosedSkip =
          closedPostType !== "intro" &&
          (closedVariant === "quiz" || closedVariant === "photo") &&
          !(
            closedVariant === "photo" &&
            getPhotoMissionConfig(closedQuestion).isSelfie
          );

        if (
          closedRun &&
          isStandardSkipRaceType(closedRaceType) &&
          canReconcileClosedSkip
        ) {
          const existingClosedOutcome = await findExistingAnswerOutcome(
            sessionId,
            participantId,
            requestedPostIndex,
            adminSupabase
          );

          if (existingClosedOutcome) {
            if (!isSkipEquivalentOutcome(existingClosedOutcome)) {
              return createSkipOutcomeConflictResponse(null);
            }

            const closedRouteOrder = getServerRouteOrder(
              closedQuestions.length,
              startOffset ?? 0,
              supportsServerStaggeredStart(
                closedRaceType,
                sessionState.post_order_mode,
                sessionState.route_version
              )
            );
            await maybeStampRunStartedAt(
              sessionId,
              participantId,
              requestedPostIndex,
              closedRouteOrder[0] ?? null,
              adminSupabase
            );

            return createSkipDuplicateResponse({
              postIndex: requestedPostIndex,
              expectedPostIndex: null,
            });
          }
        }
      }

      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 410,
        reason: "session_not_skippable",
        postIndex: requestedPostIndex,
      });
      return NextResponse.json(
        {
          error: "Løbet er afsluttet. Posten kan ikke springes over.",
          code: "SESSION_CLOSED",
        },
        { status: 410 }
      );
    }

    const runId = asTrimmedString(sessionState.run_id);
    if (!runId) {
      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 404,
        reason: "run_missing",
        postIndex: requestedPostIndex,
      });
      return NextResponse.json(
        {
          error: "Løbet kunne ikke findes.",
          code: "SESSION_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const run = await fetchRunRow(runId, adminSupabase);
    const questions = Array.isArray(run?.questions) ? run.questions : [];
    if (!run || questions.length === 0 || requestedPostIndex >= questions.length) {
      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 404,
        reason: "post_missing",
        postIndex: requestedPostIndex,
      });
      return NextResponse.json({ error: "Posten kunne ikke findes." }, { status: 404 });
    }

    const rawRaceType = run.raceType ?? run.race_type;
    if (!isStandardSkipRaceType(rawRaceType)) {
      return NextResponse.json(
        {
          error: "Denne løbstype understøtter ikke at springe poster over.",
          code: "SPECIAL_FLOW_EXCLUDED",
        },
        { status: 403 }
      );
    }

    const raceMode = normalizeRaceMode(rawRaceType);
    const rawQuestion = questions[requestedPostIndex];
    const postType = getPostType(rawQuestion)?.trim().toLocaleLowerCase("da-DK") ?? "";
    if (postType === "intro") {
      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 403,
        reason: "intro_post_excluded",
        postIndex: requestedPostIndex,
        raceMode,
      });
      return NextResponse.json({ error: "Denne posttype kan ikke springes over." }, { status: 403 });
    }

    const variant = resolveQuestionVariant(run.raceType ?? run.race_type, rawQuestion);
    if (variant !== "quiz" && variant !== "photo") {
      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 403,
        reason: "excluded_post_variant",
        postIndex: requestedPostIndex,
        raceMode,
        variant,
      });
      return NextResponse.json({ error: "Denne posttype kan ikke springes over." }, { status: 403 });
    }

    if (variant === "photo" && getPhotoMissionConfig(rawQuestion).isSelfie) {
      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 403,
        reason: "selfie_excluded",
        postIndex: requestedPostIndex,
        raceMode,
        variant,
      });
      return NextResponse.json({ error: "Selfie-poster kan ikke springes over i v1." }, { status: 403 });
    }

    const answeredPostIndexes = await fetchAnsweredPostIndexes(
      sessionId,
      participantId,
      adminSupabase
    );

    if (answeredPostIndexes === null) {
      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 503,
        reason: "answers_schema_incompatible",
        postIndex: requestedPostIndex,
        raceMode,
        variant,
      });
      return NextResponse.json(
        { error: "Emergency skip understoettes ikke med den nuvaerende answers-struktur." },
        { status: 503 }
      );
    }

    const routeOrder = getServerRouteOrder(
      questions.length,
      startOffset ?? 0,
      supportsServerStaggeredStart(
        run.raceType ?? run.race_type,
        sessionState.post_order_mode,
        sessionState.route_version
      )
    );
    const progressDecision = resolveSkipProgressDecision({
      routeOrder,
      answeredPostIndexes,
      requestedPostIndex,
    });

    if (progressDecision.kind === "duplicate") {
      const existingOutcome = await findExistingAnswerOutcome(
        sessionId,
        participantId,
        requestedPostIndex,
        adminSupabase
      );
      if (existingOutcome === null) {
        return NextResponse.json(
          {
            error:
              "Emergency skip understoettes ikke med den nuvaerende answers-struktur.",
            code: "ANSWERS_SCHEMA_INCOMPATIBLE",
          },
          { status: 503 }
        );
      }
      if (!isSkipEquivalentOutcome(existingOutcome)) {
        return createSkipOutcomeConflictResponse(
          progressDecision.expectedPostIndex
        );
      }

      await maybeStampRunStartedAt(
        sessionId,
        participantId,
        requestedPostIndex,
        routeOrder[0] ?? null,
        adminSupabase
      );

      return createSkipDuplicateResponse({
        postIndex: requestedPostIndex,
        expectedPostIndex: progressDecision.expectedPostIndex,
      });
    }

    if (progressDecision.kind === "progress_mismatch") {
      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 409,
        reason: "progress_mismatch",
        postIndex: requestedPostIndex,
        expectedPostIndex: progressDecision.expectedPostIndex,
        raceMode,
        variant,
      });
      return NextResponse.json(
        {
          error: "Posten matcher ikke den aktuelle serverprogression.",
          code: "PROGRESS_MISMATCH",
          expectedPostIndex: progressDecision.expectedPostIndex,
        },
        { status: 409 }
      );
    }

    const alreadyAnsweredOutcome = await findExistingAnswerOutcome(
      sessionId,
      participantId,
      requestedPostIndex,
      adminSupabase
    );

    if (alreadyAnsweredOutcome === null) {
      await logSkipFailureTelemetry({
        participantId,
        sessionId,
        status: 503,
        reason: "duplicate_check_schema_incompatible",
        postIndex: requestedPostIndex,
        expectedPostIndex: progressDecision.expectedPostIndex,
        raceMode,
        variant,
      });
      return NextResponse.json(
        { error: "Emergency skip understoettes ikke med den nuvaerende answers-struktur." },
        { status: 503 }
      );
    }

    if (alreadyAnsweredOutcome) {
      const nextExpectedPostIndex =
        routeOrder.find(
          (postIndex) =>
            postIndex !== requestedPostIndex &&
            !answeredPostIndexes.has(postIndex)
        ) ?? null;

      if (!isSkipEquivalentOutcome(alreadyAnsweredOutcome)) {
        return createSkipOutcomeConflictResponse(nextExpectedPostIndex);
      }

      await maybeStampRunStartedAt(
        sessionId,
        participantId,
        requestedPostIndex,
        routeOrder[0] ?? null,
        adminSupabase
      );

      return createSkipDuplicateResponse({
        postIndex: requestedPostIndex,
        expectedPostIndex: nextExpectedPostIndex,
      });
    }

    const persistResult = await persistEmergencySkip(
      buildSkipAnswerPayloads({
        sessionId,
        participantId,
        studentName,
        postIndex: requestedPostIndex,
        questionText: getQuestionText(rawQuestion),
      }),
      adminSupabase
    );

    if (!persistResult.ok) {
      if (persistResult.kind === "conflict") {
        const storedOutcomeAfterConflict = await findExistingAnswerOutcome(
          sessionId,
          participantId,
          requestedPostIndex,
          adminSupabase
        );
        const nextExpectedPostIndex =
          routeOrder.find((postIndex) => postIndex !== requestedPostIndex && !answeredPostIndexes.has(postIndex)) ?? null;

        if (isSkipEquivalentOutcome(storedOutcomeAfterConflict)) {
          await maybeStampRunStartedAt(
            sessionId,
            participantId,
            requestedPostIndex,
            routeOrder[0] ?? null,
            adminSupabase
          );

          return createSkipDuplicateResponse({
            postIndex: requestedPostIndex,
            expectedPostIndex: nextExpectedPostIndex,
          });
        }

        if (storedOutcomeAfterConflict) {
          return createSkipOutcomeConflictResponse(nextExpectedPostIndex);
        }

        await logSkipFailureTelemetry({
          participantId,
          sessionId,
          status: 409,
          reason: "insert_conflict",
          postIndex: requestedPostIndex,
          expectedPostIndex: nextExpectedPostIndex,
          raceMode,
          variant,
        });
        return NextResponse.json(
          {
            error: "Posten blev opdateret af en anden aflevering.",
            code: "SUBMISSION_CONFLICT",
            expectedPostIndex: nextExpectedPostIndex,
          },
          { status: 409 }
        );
      }

      throw new Error("Kunne ikke gemme emergency skip med den nuværende answers-struktur.");
    }

    await maybeStampRunStartedAt(
      sessionId,
      participantId,
      requestedPostIndex,
      routeOrder[0] ?? null,
      adminSupabase
    );

    await logSkipSuccessTelemetry({
      participantId,
      sessionId,
      postIndex: requestedPostIndex,
      raceMode,
      variant,
    });

    return NextResponse.json({
      skipped: true,
      postIndex: requestedPostIndex,
      awardedPoints: 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    await logSkipFailureTelemetry({
      participantId: claimedParticipantId || null,
      sessionId: claimedSessionId || null,
      status: 500,
      reason: "server_exception",
      postIndex: requestedPostIndex,
    });

    console.error("Emergency skip fejlede:", error);
    await logHandledServerError({
      route: "/api/play/skip-post",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
      participantId: claimedParticipantId || null,
      sessionId: claimedSessionId || null,
    });
    return NextResponse.json({ error: "Emergency skip fejlede." }, { status: 500 });
  }
}

type SkipProgressDecision =
  | {
      kind: "submit";
      expectedPostIndex: number;
    }
  | {
      kind: "duplicate";
      expectedPostIndex: number | null;
    }
  | {
      kind: "progress_mismatch";
      expectedPostIndex: number | null;
    };

function resolveSkipProgressDecision({
  routeOrder,
  answeredPostIndexes,
  requestedPostIndex,
}: {
  routeOrder: readonly number[];
  answeredPostIndexes: ReadonlySet<number>;
  requestedPostIndex: number;
}): SkipProgressDecision {
  const expectedPostIndex =
    routeOrder.find((postIndex) => !answeredPostIndexes.has(postIndex)) ??
    null;

  if (answeredPostIndexes.has(requestedPostIndex)) {
    return {
      kind: "duplicate",
      expectedPostIndex,
    };
  }

  if (
    expectedPostIndex === null ||
    requestedPostIndex !== expectedPostIndex
  ) {
    return {
      kind: "progress_mismatch",
      expectedPostIndex,
    };
  }

  return {
    kind: "submit",
    expectedPostIndex,
  };
}

function isStandardSkipRaceType(rawRaceType: unknown) {
  return usesStandardStudentLocationExperience(rawRaceType);
}
