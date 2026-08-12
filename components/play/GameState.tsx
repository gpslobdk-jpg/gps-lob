"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClientTelemetryMessage, sendTelemetry } from "@/utils/telemetry";
import * as Sentry from "@sentry/nextjs";
import { authWithLockRetry } from "@/utils/supabase/authWithLockRetry";
import {
  POST_ORDER_MODES,
  normalizePostOrderMode,
  type ActivePostOrderMode,
} from "@/lib/routes/postOrderPolicy";
import {
  canProgressStudentSubmission,
  canReplayStudentSubmission,
  classifyStudentSubmissionResponse,
  createIdleStudentSubmissionState,
  createStudentSubmissionOperationId,
  getStudentSubmissionRetryDelayMs,
  isPendingSubmissionForContext,
  reconcileStudentSubmissionOutcome,
  reconcileStudentSubmissionProgress,
  rescueLegacyRejectedStudentSubmissions,
  restoreStudentSubmissionState,
  transitionStudentSubmission,
  type StudentSubmissionEvent,
  type StudentSubmissionState,
  type StudentSubmissionStatus,
  type StudentSubmissionType,
} from "@/lib/submissions/studentSubmissionState";

import type {
  AnswerProgressRow,
  EscapeCodeEntry,
  EscapeResultEntry,
  EscapeRewardState,
  Location,
  MasterLockStatus,
  NavigatorWithWakeLock,
  ParticipantRow,
  PhotoFeedbackState,
  PlayCurrentPostState,
  PlayEscapeState,
  PlayFeedbackState,
  PlayGameState,
  PlayGpsState,
  PlayLoadErrorVariant,
  PlayMapState,
  PlayPlayerState,
  PlayProgressState,
  PlayScreenState,
  PlaySessionPayload,
  PlayThemeState,
  PlayUiFlags,
  PostActionErrorState,
  Question,
  QuizAnswerFeedbackState,
  RaceMode,
  RoleplayReplyState,
  StoredPendingAnswer,
  StoredPlaySnapshot,
  SubmitAnswerServerCorrectness,
  TeacherBroadcastMessage,
  ValidateAnswerPayload,
  Vm26GoalFeedbackState,
  WakeLockSentinelLike,
  ZoneKrigCaptureFeedbackState,
  ZoneKrigCaptureStatus,
} from "./types";
import {
  buildRouteOrder,
  clearStoredActiveParticipant,
  clearStoredPlaySnapshot,
  compressImageForUpload,
  containsBadWord,
  getDistance,
  getEscapeCodeBrick,
  getEscapeCodeEntriesFromRows,
  getNormalizedAnsweredPostIndex,
  getQuestionDisplayText,
  getNextRoutePostIndex,
  getRouteStepIndex,
  getRoleplayAvatar,
  getRoleplayCharacterName,
  getRoleplayCharacterPersonality,
  getRoleplayCorrectAnswer,
  getRoleplayMessage,
  isMissingColumnError,
  normalizeMasterCode,
  normalizeRaceMode,
  parseQuestion,
  readStoredActiveParticipant,
  readStoredPlaySnapshot,
  resolvePostVariant,
  saveStoredActiveParticipant,
  savePendingAnswersForStoredPlaySnapshot,
  saveStoredPlaySnapshot,
  toFiniteNumber,
  toIntegerStartOffset,
} from "./playUtils";
import {
  isFreshParticipantHandoff,
  resolveParticipantStartOffset,
  resolveRestoredPostIndex,
} from "./participantHandoff";

const TARGET_VISUAL_RADIUS_METERS = 25;
const TARGET_CLICK_BUFFER_METERS = 20;
import { useStrategoEngine } from "./useStrategoEngine";
import { DEFAULT_QUESTION_POINTS } from "@/utils/questionPoints";
import { createClient } from "@/utils/supabase/client";

type UsePlayGameStateParams = {
  sessionId?: string;
  initialStudentName?: string;
};
type LiveSessionStatusRow = {
  status?: string | null;
  gps_override?: boolean | null;
};

type PlaySessionStatusSnapshot = {
  sessionStatus?: string | null;
  status?: string | null;
  gpsOverride?: boolean;
  teacherGuided?: boolean;
  error?: string;
};

type ParticipantSnapshotFetchResult = {
  data: ParticipantRow | null;
  error: { status?: number; code?: string; message?: string } | null;
};

type ParticipantAuthRecoveryMethod = "refresh" | "rebind";

type SubmitPhotoResponsePayload = {
  message?: string;
  awardedPoints?: number;
  imageUrl?: string | null;
  storedAnswer?: boolean;
  error?: string;
  code?: string;
  postIndex?: number;
  questionCount?: number;
  duplicate?: boolean;
};

type SubmitAnswerResponsePayload = {
  inserted?: boolean;
  duplicate?: boolean;
  awardedPoints?: number;
  storedIsCorrect?: boolean;
  serverCorrectness?: unknown;
  error?: string;
  code?: string;
  expectedPostIndex?: number | null;
  answeredPostIndexes?: number[];
  zoneKrigCapture?: ZoneKrigCaptureApiResult;
};

type SkipPostResponsePayload = {
  skipped?: boolean;
  duplicate?: boolean;
  postIndex?: number;
  awardedPoints?: number;
  expectedPostIndex?: number | null;
  error?: string;
  code?: string;
};

type SubmitPhotoRequestError = Error & {
  status?: number;
  isParticipantAuthError?: boolean;
  code?: string;
  postIndex?: number;
  questionCount?: number;
};

type FetchedPlaySessionSnapshot = {
  questions: Question[];
  raceMode: RaceMode;
  postOrderMode: ActivePostOrderMode;
  radius: number;
  gpsOverride: boolean;
  usesStandardStudentLocationExperience: boolean;
  bonusAvailable: boolean;
  theme?: PlayThemeState;
};

type WakeReconnectTrigger =
  | "status_channel_error"
  | "message_channel_error"
  | "visibility_resume"
  | "pageshow_resume"
  | "online_resume"
  | "auth_refresh";

const LOCATION_SYNC_404_STRIKE_LIMIT = 5;
const LOCATION_SYNC_RECOVERY_CHECK_COOLDOWN_MS = 15000;
const MAX_PLAYER_NAME_LENGTH = 20;
const OFFLINE_VALIDATION_MESSAGE = "Forbindelsen driller lidt. Prøv igen om et øjeblik.";
const ANSWER_VALIDATION_RETRY_MESSAGE = "Vi tjekker lige svaret. Prøv igen om et øjeblik.";
const PLAY_LOAD_RETRY_MESSAGE = "Vi gør løbet klar. Prøv igen om et øjeblik.";
const PLAY_SETUP_PENDING_MESSAGE = "Løbet bliver gjort klar lige nu. Prøv igen om et øjeblik.";
const PLAY_RESTORE_RETRY_MESSAGE =
  "Vi kunne ikke genskabe din deltager automatisk. Tryk på Prøv igen for at genindlæse missionen.";
const PLAY_PARTICIPANT_AUTH_EXPIRED_MESSAGE =
  "Hov, du har været væk lidt længe! Dit adgangskort er udløbet.";
const PLAY_PARTICIPANT_UNAUTHORIZED_REJOIN_MESSAGE = "Du skal tilmelde dig løbet igen.";
const RESTORE_RETRY_DELAY_MS = 2500;
const RESTORE_AUTH_RECOVERY_DELAY_MS = 350;
const VM26_GOAL_FEEDBACK_DURATION_MS = 1600;
const VM26_GOAL_FEEDBACK_MESSAGE = "MÅÅÅL! ⚽";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTerminalPendingAnswer(
  pendingAnswer: Pick<StoredPendingAnswer, "status">
) {
  return (
    pendingAnswer.status === "rejected" ||
    pendingAnswer.status === "session_closed"
  );
}

function normalizePlayTheme(value: unknown): PlayThemeState | undefined {
  if (!isRecord(value)) return undefined;

  const vm26 = isRecord(value.vm26) ? value.vm26 : null;
  if (vm26?.enabled !== true) return undefined;

  const templateId = typeof vm26.templateId === "string" ? vm26.templateId : "";
  const version = typeof vm26.version === "number" && Number.isFinite(vm26.version) ? vm26.version : null;

  if (!templateId || version === null) return undefined;

  return {
    vm26: {
      enabled: true,
      templateId,
      version,
    },
  };
}

function normalizeSubmitAnswerServerCorrectness(value: unknown): SubmitAnswerServerCorrectness | undefined {
  if (!isRecord(value)) return undefined;
  if (value.checked !== true || typeof value.isCorrect !== "boolean") return undefined;

  return {
    checked: true,
    isCorrect: value.isCorrect,
  };
}
const MAX_RESTORE_RETRIES = 6;
const CHANNEL_RESUBSCRIBE_DELAY_MS = 1000;
const NETWORK_RETRY_DELAY_MS = 3000;
// Max transient-network retries for answer validation. After this many failures
// the function throws so the caller's finally block releases the submission lock
// and the answer button becomes clickable again.
const VALIDATE_ANSWER_MAX_RETRIES = 3;
// Max transient-network retries for photo uploads. After this many failures
// we surface an error to the user and release the submission lock so the
// UI doesn't remain permanently disabled.
const PHOTO_UPLOAD_MAX_RETRIES = 5;
const STANDARD_ANSWER_SUBMISSION_TIMEOUT_MS = 12_000;
const WAITING_SESSION_STATUS_POLL_INTERVAL_MS = 4000;
const ACTIVE_SESSION_STATUS_POLL_INTERVAL_MS = 15000;
const PHOTO_UPLOAD_RUN_OUT_OF_SYNC_MESSAGE =
  "Foto-posten blev opdateret imens du var i gang. Vi har hentet den nyeste rute - proev billedet igen.";
const RUN_OUT_OF_SYNC_ERROR_CODE = "RUN_OUT_OF_SYNC";

type ZoneKrigCaptureApiResult = {
  status?: ZoneKrigCaptureStatus;
  shieldRemainingSeconds?: number | null;
} | null;

function isCircuitBreakerLoadErrorVariant(variant: PlayLoadErrorVariant) {
  return variant === "participant_auth_expired" || variant === "join_session_missing";
}

type ParticipantAuthRecoveryReason =
  | "participant_not_bound"
  | "auth_missing"
  | "auth_expired"
  | "unknown_auth_error";

function determineParticipantAuthRecoveryReason(status: number, message: unknown): ParticipantAuthRecoveryReason {
  if (typeof message !== "string") return "unknown_auth_error";
  const normalized = message.trim().toLocaleLowerCase("da-DK");

  if (status === 401 && normalized.includes("ikke knyttet til en aktiv deltager")) {
    return "participant_not_bound";
  }

  if (normalized.includes("udløbet")) {
    return "auth_expired";
  }

  if (normalized.includes("mangler")) {
    return "auth_missing";
  }

  return "unknown_auth_error";
}

function isParticipantAuthResponseError(status: number, message: unknown) {
  if (status !== 401 && status !== 403) {
    return false;
  }

  if (typeof message !== "string") {
    return false;
  }

  // Treat as "auth expired" when the JWT/cookie itself is missing or expired.
  // Also treat the precise server message "ikke knyttet til en aktiv deltager"
  // as a recoverable auth state — this indicates the anonymous auth user exists
  // but is not bound to an active participant, and the client may rebind.
  // Keep matching narrow to avoid false positives.
  const normalizedMessage = message.trim().toLocaleLowerCase("da-DK");
  if (normalizedMessage.includes("mangler") || normalizedMessage.includes("udløbet")) {
    return true;
  }

  if (status === 401 && normalizedMessage.includes("ikke knyttet til en aktiv deltager")) {
    return true;
  }

  return false;
}

type InsertAnswerResult = {
  didPersist: boolean;
  awardedPoints: number;
  zoneKrigCapture: ZoneKrigCaptureApiResult;
  serverCorrectness?: SubmitAnswerServerCorrectness;
  deliveryStatus?: StudentSubmissionStatus;
  operationId?: string;
  canProgress?: boolean;
  duplicate?: boolean;
  progressReconciled?: boolean;
};

type SessionTeacherMessageRow = {
  message?: string | null;
  created_at?: string | null;
  is_teacher?: boolean | null;
};

function formatShieldRemainingTime(seconds: number | null | undefined) {
  if (!Number.isFinite(seconds) || (seconds ?? 0) <= 0) return "få sekunder";
  const roundedSeconds = Math.max(0, Math.ceil(seconds ?? 0));
  if (roundedSeconds < 60) return `${roundedSeconds} sekunder`;
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  if (remainingSeconds === 0) {
    return minutes === 1 ? "1 minut" : `${minutes} minutter`;
  }
  return `${minutes} min ${remainingSeconds} sek`;
}

function buildZoneKrigCaptureFeedback(
  captureResult: ZoneKrigCaptureApiResult,
  key: string
): ZoneKrigCaptureFeedbackState {
  switch (captureResult?.status) {
    case "captured":
      return {
        key,
        status: "captured",
        message: "Fantastisk! I har erobret zonen!",
      };
    case "blocked_by_shield":
      return {
        key,
        status: "blocked_by_shield",
        message: `Korrekt svar! Men zonen er beskyttet i ${formatShieldRemainingTime(captureResult.shieldRemainingSeconds)} endnu. Dit forsøg på denne zone er brugt.`,
        shieldRemainingSeconds: captureResult.shieldRemainingSeconds ?? undefined,
      };
    case "already_owned":
      return {
        key,
        status: "already_owned",
        message: "I ejer allerede denne zone. Dit forsøg på denne zone er brugt.",
      };
    case "zone_missing":
      return {
        key,
        status: "zone_missing",
        message: "Korrekt svar, men zonen kunne ikke opdateres. Dit forsøg på denne zone er brugt.",
      };
    case "game_over":
      return {
        key,
        status: "game_over",
        message: "Spillet er slut! Flere zoner kan ikke overtages nu.",
      };
    case "capture_failed":
      return {
        key,
        status: "capture_failed",
        message: "Zonen kunne ikke opdateres. Dit forsøg på denne zone er brugt.",
      };
    default:
      return null;
  }
}

function sortUniquePostIndexes(values: number[]) {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

function createTeacherBroadcastMessage(
  row: SessionTeacherMessageRow
): TeacherBroadcastMessage | null {
  const normalizedMessage = row.message?.trim();
  if (!normalizedMessage) {
    return null;
  }

  const createdAt =
    typeof row.created_at === "string" && row.created_at.trim() ? row.created_at : null;

  return {
    key: `${createdAt ?? "no-time"}:${normalizedMessage}`,
    message: normalizedMessage,
    createdAt,
  };
}

function toTimestampMs(value: string | null | undefined) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function usePlayGameState({
  sessionId,
  initialStudentName = "",
}: UsePlayGameStateParams): PlayGameState {
  const initialNameCandidate = initialStudentName || "";
  const storedParticipantOnLoad = useMemo(() => {
    if (!sessionId) return null;
    const stored = readStoredActiveParticipant();
    if (!stored) return null;
    if (stored.sessionId !== sessionId) {
      return null;
    }
    return stored;
  }, [sessionId]);

  const storedPlaySnapshotOnLoad = useMemo(() => {
    if (!sessionId) return null;

    const storedSnapshot = readStoredPlaySnapshot();
    if (!storedSnapshot || storedSnapshot.sessionId !== sessionId) {
      return null;
    }

    if (
      storedParticipantOnLoad?.participantId &&
      storedSnapshot.participantId !== storedParticipantOnLoad.participantId
    ) {
      return null;
    }

    return storedSnapshot;
  }, [sessionId, storedParticipantOnLoad?.participantId]);

  const isStoredParticipantFreshJoin = useMemo(() => {
    return isFreshParticipantHandoff(
      storedParticipantOnLoad?.savedAt,
      Boolean(storedPlaySnapshotOnLoad)
    );
  }, [storedParticipantOnLoad?.savedAt, storedPlaySnapshotOnLoad]);

  const [pendingPlayerName, setPendingPlayerNameState] = useState(
    () => storedParticipantOnLoad?.studentName || initialNameCandidate
  );
  const [pendingAvatarUrl, setPendingAvatarUrlState] = useState<string | undefined>(
    () => storedParticipantOnLoad?.avatarUrl ?? undefined
  );
  const [playerName, setPlayerName] = useState(() => storedParticipantOnLoad?.studentName || "");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    () => storedParticipantOnLoad?.avatarUrl ?? undefined
  );
  const [hasConfirmedName, setHasConfirmedName] = useState(
    () => Boolean(storedParticipantOnLoad?.studentName)
  );
  const [hasCompletedAvatarGate, setHasCompletedAvatarGate] = useState(
    () => storedParticipantOnLoad?.hasCompletedAvatarGate ?? true
  );
  const [questions, setQuestions] = useState<Question[]>([]);
  const [raceMode, setRaceMode] = useState<RaceMode>("unknown");
  const [postOrderMode, setPostOrderMode] = useState<ActivePostOrderMode>(
    POST_ORDER_MODES.FIXED
  );
  const distributedCircularEnabled =
    postOrderMode === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR;
  const [theme, setTheme] = useState<PlayThemeState | undefined>(undefined);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [myLoc, setMyLoc] = useState<Location | null>(null);
  const [distance, setDistanceState] = useState<number | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadErrorVariant, setLoadErrorVariant] = useState<PlayLoadErrorVariant>("generic");
  const circuitBreakerActive =
    loadError.trim().length > 0 && isCircuitBreakerLoadErrorVariant(loadErrorVariant);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isKicked, setIsKicked] = useState(false);
  const [latestMessage, setLatestMessage] = useState<TeacherBroadcastMessage | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [wrongAnswerFeedback, setWrongAnswerFeedback] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<PhotoFeedbackState>(null);
  const [postActionError, setPostActionError] = useState<PostActionErrorState>(null);
  const [quizAnswerFeedback, setQuizAnswerFeedback] = useState<QuizAnswerFeedbackState>(null);
  const [vm26GoalFeedback, setVm26GoalFeedback] = useState<Vm26GoalFeedbackState>(null);
  const [zoneKrigCaptureFeedback, setZoneKrigCaptureFeedback] = useState<ZoneKrigCaptureFeedbackState>(null);
  const [escapeReward, setEscapeReward] = useState<EscapeRewardState>(null);
  const [collectedEscapeRewards, setCollectedEscapeRewards] = useState<EscapeCodeEntry[]>([]);
  const [roleplayReply, setRoleplayReply] = useState<RoleplayReplyState>(null);
  const [masterLockInput, setMasterLockInputState] = useState("");
  const [masterLockError, setMasterLockError] = useState<string | null>(null);
  const [masterLockStatus, setMasterLockStatus] = useState<MasterLockStatus>("locked");
  const [masterLockShakeNonce, setMasterLockShakeNonce] = useState(0);
  const [isFinalizingEscape, setIsFinalizingEscape] = useState(false);
  const [showEscapeResults, setShowEscapeResultsState] = useState(false);
  const [escapeResults, setEscapeResults] = useState<EscapeResultEntry[]>([]);
  const [isLoadingEscapeResults, setIsLoadingEscapeResults] = useState(false);
  const [escapeResultsError, setEscapeResultsError] = useState<string | null>(null);
  const [isCheckingEscapeAnswer, setIsCheckingEscapeAnswer] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [dismissedPostIndex, setDismissedPostIndex] = useState<number | null>(null);
  const [showMasterVictory, setShowMasterVictory] = useState(false);
  const [typedAnswerError, setTypedAnswerError] = useState<{ key: string; message: string } | null>(
    null
  );
  const [hasRoleplayInputErrorTone, setHasRoleplayInputErrorTone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(
    () => storedParticipantOnLoad?.participantId ?? null
  );
  const [startOffset, setStartOffset] = useState(() => storedParticipantOnLoad?.startOffset ?? 0);
  const [teamId, setTeamId] = useState<string | null>(() => storedParticipantOnLoad?.teamId ?? null);
  const [teamColor, setTeamColor] = useState<string | null>(() => storedParticipantOnLoad?.teamColor ?? null);
  const supabase = useMemo(() => createClient({ authScope: "participant" }), []);
  const [isProvisioningParticipant, setIsProvisioningParticipant] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(
    () => storedPlaySnapshotOnLoad?.correctAnswersCount ?? 0
  );
  const [score, setScore] = useState(() => storedPlaySnapshotOnLoad?.score ?? 0);
  const [solvedPostIndexes, setSolvedPostIndexes] = useState<number[]>(
    () => storedPlaySnapshotOnLoad?.solvedPostIndexes ?? []
  );
  const [answeredPostIndexes, setAnsweredPostIndexes] = useState<number[]>(
    () => storedPlaySnapshotOnLoad?.answeredPostIndexes ?? []
  );
  const [sessionStatus, setSessionStatus] = useState<string | null>(
    () => storedParticipantOnLoad?.sessionStatus ?? null
  );
  const [gpsOverride, setGpsOverride] = useState(false);
  const [
    usesStandardStudentLocationExperience,
    setUsesStandardStudentLocationExperience,
  ] = useState(false);
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const router = useRouter();
  const [isTeacherGuided, setIsTeacherGuided] = useState(false);
  const [autoUnlockRadius, setAutoUnlockRadius] = useState<number | null>(null);
  const [locationSyncErrors, setLocationSyncErrors] = useState(0);
  const [restoreRetryNonce, setRestoreRetryNonce] = useState(0);
  const [reconnectConfirmationNonce, setReconnectConfirmationNonce] =
    useState(0);
  const [isRestoringParticipant, setIsRestoringParticipant] = useState(false);
  const [pendingLocalAnswers, setPendingLocalAnswers] = useState<StoredPendingAnswer[]>(
    () => storedPlaySnapshotOnLoad?.pendingAnswers ?? []
  );
  const [studentSubmission, setStudentSubmission] =
    useState<StudentSubmissionState>(() => {
      const pendingSubmission =
        storedPlaySnapshotOnLoad?.pendingAnswers.find(
          (entry) =>
            entry.sessionId === storedPlaySnapshotOnLoad.sessionId &&
            entry.participantId === storedPlaySnapshotOnLoad.participantId &&
            (entry.status === "session_closed" ||
              (entry.solvedPostIndex === storedPlaySnapshotOnLoad.currentPostIndex &&
                (isTerminalPendingAnswer(entry) || !entry.hasLocalProgress)))
        ) ?? null;

      return pendingSubmission
        ? restoreStudentSubmissionState(
            pendingSubmission.submissionType,
            pendingSubmission.id,
            pendingSubmission.status
          )
        : createIdleStudentSubmissionState();
    });

  const answersTableMissingRef = useRef(false);
  const hasRestoredRef = useRef(!Boolean(storedParticipantOnLoad) || isStoredParticipantFreshJoin);
  const resumeMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playStartedAtMs, setPlayStartedAtMs] = useState<number | null>(
    () => storedPlaySnapshotOnLoad?.playStartedAtMs ?? null
  );
  const [playFinishedAtMs, setPlayFinishedAtMs] = useState<number | null>(null);
  const quizAnswerFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vm26GoalFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vm26GoalFeedbackIdRef = useRef(0);
  const wrongAnswerFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleplayInputErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockSentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const sessionStatusChannelRef = useRef<RealtimeChannel | null>(null);
  const messageChannelRef = useRef<RealtimeChannel | null>(null);
  const dismissedLatestMessageKeyRef = useRef<string | null>(null);
  const masterVictoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStatusResubscribeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageResubscribeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreRetryCountRef = useRef(0);
  const restoreInFlightRef = useRef(false);
  const reconnectInFlightRef = useRef(false);
  const kickConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submissionLockRef = useRef(false);
  const isMountedRef = useRef(true);
  const circuitBreakerTrippedRef = useRef(false);
  const sessionStatusMissingRef = useRef(false);
  const expiredLoggedRef = useRef(false);
  const solvedPostIndexesRef = useRef<number[]>([]);
  const answeredPostIndexesRef = useRef<number[]>(answeredPostIndexes);
  const pendingLocalAnswersRef = useRef<StoredPendingAnswer[]>(pendingLocalAnswers);
  const pendingAnswerReplayInFlightRef = useRef(false);
  const pendingAnswerReplayTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswerReplayRunnerRef = useRef<() => void>(() => undefined);
  const finalizeParticipantSilentlyRunnerRef =
    useRef<() => Promise<boolean>>(async () => false);
  const studentSubmissionRef =
    useRef<StudentSubmissionState>(studentSubmission);
  const reportedSubmissionEventsRef = useRef<Set<string>>(new Set());
  const finalizeAfterPendingAnswersRef = useRef(false);
  const locationSyncErrorsRef = useRef(0);
  const locationSyncSuspendedRef = useRef(false);
  const locationSyncRecoveryCheckInFlightRef = useRef(false);
  const locationSyncRecoveryCheckCooldownUntilRef = useRef(0);
  const [burnedPosts, setBurnedPosts] = useState<Set<number>>(
    () => new Set(storedPlaySnapshotOnLoad?.burnedPosts ?? [])
  );
  const burnedPostsRef = useRef<Set<number>>(new Set(storedPlaySnapshotOnLoad?.burnedPosts ?? []));
  // Tracks which post indexes have already triggered a play_progress_inconsistent_state
  // event this session, so we don't re-report the same post twice.
  const inconsistentStateReportedPostsRef = useRef<Set<number>>(new Set());
  const participantSnapshotRequestRef = useRef<{
    participantId: string;
    promise: Promise<ParticipantSnapshotFetchResult>;
  } | null>(null);
  const participantRegistrationPromiseRef = useRef<Promise<boolean> | null>(null);
  const participantAuthRecoveryPromiseRef = useRef<
    Promise<ParticipantAuthRecoveryMethod | null> | null
  >(null);
  // Stable refs so frequently-changing state doesn't recreate heavy callbacks.
  const sessionStatusRef = useRef<string | null>(sessionStatus);
  const isFinishedRef = useRef(isFinished);
  const isKickedRef = useRef(isKicked);
  const isRestoringParticipantRef = useRef(isRestoringParticipant);
  const playerNameRef = useRef(playerName);
  const pendingPlayerNameRef = useRef(pendingPlayerName);
  // In-flight guard for fetchSessionStatusSnapshot to avoid concurrent fetches.
  const statusFetchInFlightRef = useRef(false);
  const awaitingOnlineConfirmationRef = useRef(false);
  const clearRoleplayInputErrorTone = useCallback(() => {
    if (roleplayInputErrorTimerRef.current) {
      clearTimeout(roleplayInputErrorTimerRef.current);
      roleplayInputErrorTimerRef.current = null;
    }
    setHasRoleplayInputErrorTone(false);
  }, []);

  const triggerRoleplayInputError = useCallback(() => {
    clearRoleplayInputErrorTone();
    setHasRoleplayInputErrorTone(true);
    roleplayInputErrorTimerRef.current = setTimeout(() => {
      setHasRoleplayInputErrorTone(false);
      roleplayInputErrorTimerRef.current = null;
    }, 420);
  }, [clearRoleplayInputErrorTone]);

  const showResumeNotice = useCallback((message: string) => {
    setResumeMessage(message);
    if (resumeMessageTimerRef.current) {
      clearTimeout(resumeMessageTimerRef.current);
    }
    resumeMessageTimerRef.current = setTimeout(() => {
      setResumeMessage(null);
      resumeMessageTimerRef.current = null;
    }, 5000);
  }, []);

  const triggerVm26GoalFeedback = useCallback(() => {
    if (vm26GoalFeedbackTimerRef.current) {
      clearTimeout(vm26GoalFeedbackTimerRef.current);
      vm26GoalFeedbackTimerRef.current = null;
    }

    const id = vm26GoalFeedbackIdRef.current + 1;
    vm26GoalFeedbackIdRef.current = id;
    setVm26GoalFeedback({
      id,
      message: VM26_GOAL_FEEDBACK_MESSAGE,
    });

    vm26GoalFeedbackTimerRef.current = setTimeout(() => {
      setVm26GoalFeedback((currentFeedback) =>
        currentFeedback?.id === id ? null : currentFeedback
      );
      vm26GoalFeedbackTimerRef.current = null;
    }, VM26_GOAL_FEEDBACK_DURATION_MS);
  }, []);

  const applyLatestTeacherMessage = useCallback((row: SessionTeacherMessageRow | null) => {
    const nextMessage = row ? createTeacherBroadcastMessage(row) : null;

    if (!nextMessage) {
      setLatestMessage(null);
      return;
    }

    if (dismissedLatestMessageKeyRef.current === nextMessage.key) {
      return;
    }

    setLatestMessage((current) => (current?.key === nextMessage.key ? current : nextMessage));
  }, []);

  const dismissLatestMessage = useCallback(() => {
    setLatestMessage((current) => {
      if (current) {
        dismissedLatestMessageKeyRef.current = current.key;
      }

      return null;
    });
  }, []);

  const loadLatestTeacherMessage = useCallback(async () => {
    if (!sessionId) {
      setLatestMessage(null);
      return;
    }

    const { data, error } = await supabase
      .from("session_messages")
      .select("message,is_teacher,created_at")
      .eq("session_id", sessionId)
      .eq("is_teacher", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Fejl ved hentning af seneste besked:", error);
      return;
    }

    applyLatestTeacherMessage((data as SessionTeacherMessageRow | null) ?? null);
  }, [applyLatestTeacherMessage, sessionId]);

  useEffect(() => {
    dismissedLatestMessageKeyRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    solvedPostIndexesRef.current = solvedPostIndexes;
  }, [solvedPostIndexes]);

  useEffect(() => {
    answeredPostIndexesRef.current = answeredPostIndexes;
  }, [answeredPostIndexes]);

  useEffect(() => {
    burnedPostsRef.current = burnedPosts;
  }, [burnedPosts]);

  useEffect(() => {
    pendingLocalAnswersRef.current = pendingLocalAnswers;
  }, [pendingLocalAnswers]);

  // Keep stable refs in sync with their matching state values.
  useEffect(() => {
    studentSubmissionRef.current = studentSubmission;
  }, [studentSubmission]);
  useEffect(() => { sessionStatusRef.current = sessionStatus; }, [sessionStatus]);
  useEffect(() => { isFinishedRef.current = isFinished; }, [isFinished]);
  useEffect(() => { isKickedRef.current = isKicked; }, [isKicked]);
  useEffect(() => { isRestoringParticipantRef.current = isRestoringParticipant; }, [isRestoringParticipant]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { pendingPlayerNameRef.current = pendingPlayerName; }, [pendingPlayerName]);

  const getStoredPlaySnapshotForParticipant = useCallback(
    (targetParticipantId: string | null | undefined): StoredPlaySnapshot | null => {
      if (!sessionId || !targetParticipantId) return null;

      const storedSnapshot = readStoredPlaySnapshot();
      if (!storedSnapshot) return null;
      if (storedSnapshot.sessionId !== sessionId) return null;
      if (storedSnapshot.participantId !== targetParticipantId) return null;

      return storedSnapshot;
    },
    [sessionId]
  );

  const clearStoredPlayRecoveryState = useCallback(() => {
    clearStoredActiveParticipant();
    clearStoredPlaySnapshot();
    if (pendingAnswerReplayTimerRef.current) {
      clearTimeout(pendingAnswerReplayTimerRef.current);
      pendingAnswerReplayTimerRef.current = null;
    }
    pendingLocalAnswersRef.current = [];
    setPendingLocalAnswers([]);
    const idleSubmission = createIdleStudentSubmissionState();
    studentSubmissionRef.current = idleSubmission;
    setStudentSubmission(idleSubmission);
  }, []);

  const updatePendingLocalAnswers = useCallback(
    (
      update: (current: StoredPendingAnswer[]) => StoredPendingAnswer[]
    ) => {
      const current = pendingLocalAnswersRef.current;
      const next = update(current);
      if (next === current) {
        return {
          pendingAnswers: current,
          persisted: true,
        };
      }

      pendingLocalAnswersRef.current = next;
      setPendingLocalAnswers(next);

      const persisted =
        sessionId && participantId
          ? savePendingAnswersForStoredPlaySnapshot(
              sessionId,
              participantId,
              next
            )
          : false;

      return {
        pendingAnswers: next,
        persisted,
      };
    },
    [participantId, sessionId]
  );

  const queuePendingLocalAnswer = useCallback((pendingAnswer: StoredPendingAnswer) => {
    return updatePendingLocalAnswers((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === pendingAnswer.id);
      if (existingIndex < 0) {
        return [...current, pendingAnswer];
      }

      const next = [...current];
      next[existingIndex] = pendingAnswer;
      return next;
    }).persisted;
  }, [updatePendingLocalAnswers]);

  const removePendingLocalAnswer = useCallback((pendingAnswerId: string) => {
    updatePendingLocalAnswers((current) => {
      const next = current.filter((entry) => entry.id !== pendingAnswerId);
      return next.length === current.length ? current : next;
    });
  }, [updatePendingLocalAnswers]);

  const updatePendingLocalAnswer = useCallback(
    (
      pendingAnswerId: string,
      update: (current: StoredPendingAnswer) => StoredPendingAnswer
    ) => {
      return updatePendingLocalAnswers((current) => {
        const existingIndex = current.findIndex((entry) => entry.id === pendingAnswerId);
        if (existingIndex < 0) return current;

        const next = [...current];
        next[existingIndex] = update(current[existingIndex]);
        return next;
      });
    },
    [updatePendingLocalAnswers]
  );

  const markPendingAnswerLocallyProgressed = useCallback(
    (pendingAnswerId: string | undefined) => {
      if (!pendingAnswerId) return;
      updatePendingLocalAnswer(pendingAnswerId, (current) =>
        current.hasLocalProgress
          ? current
          : {
              ...current,
              hasLocalProgress: true,
            }
      );
      if (typeof navigator !== "undefined" && navigator.onLine) {
        pendingAnswerReplayRunnerRef.current();
      }
    },
    [updatePendingLocalAnswer]
  );

  const markSolvedPostIndex = useCallback((postIndex: number) => {
    if (
      !Number.isInteger(postIndex) ||
      postIndex < 0 ||
      solvedPostIndexesRef.current.includes(postIndex)
    ) {
      return false;
    }

    const nextSolvedPostIndexes = sortUniquePostIndexes([
      ...solvedPostIndexesRef.current,
      postIndex,
    ]);
    solvedPostIndexesRef.current = nextSolvedPostIndexes;
    setSolvedPostIndexes(nextSolvedPostIndexes);
    return true;
  }, []);

  const removeSolvedPostIndex = useCallback((postIndex: number) => {
    if (!solvedPostIndexesRef.current.includes(postIndex)) {
      return false;
    }

    const nextSolvedPostIndexes = solvedPostIndexesRef.current.filter(
      (candidate) => candidate !== postIndex
    );
    solvedPostIndexesRef.current = nextSolvedPostIndexes;
    setSolvedPostIndexes(nextSolvedPostIndexes);
    return true;
  }, []);

  const markBurnedPostIndex = useCallback((postIndex: number) => {
    if (
      !Number.isInteger(postIndex) ||
      postIndex < 0 ||
      burnedPostsRef.current.has(postIndex)
    ) {
      return false;
    }

    const nextBurnedPosts = new Set(burnedPostsRef.current);
    nextBurnedPosts.add(postIndex);
    burnedPostsRef.current = nextBurnedPosts;
    setBurnedPosts(nextBurnedPosts);
    return true;
  }, []);

  const removeBurnedPostIndex = useCallback((postIndex: number) => {
    if (!burnedPostsRef.current.has(postIndex)) {
      return false;
    }

    const nextBurnedPosts = new Set(burnedPostsRef.current);
    nextBurnedPosts.delete(postIndex);
    burnedPostsRef.current = nextBurnedPosts;
    setBurnedPosts(nextBurnedPosts);
    return true;
  }, []);

  const captureStudentSubmissionIssue = useCallback(
    (
      category:
        | "student_answer_submission_failed"
        | "student_answer_confirmation_uncertain"
        | "student_answer_queue_replay_failed"
        | "student_photo_upload_failed"
        | "student_skip_submission_failed"
        | "student_submission_state_invalid",
      operationId: string | null,
      metadata: {
        submissionType: StudentSubmissionType;
        stage: "submit" | "upload" | "confirm" | "replay" | "resume";
        result: "retryable" | "duplicate" | "rejected" | "unknown";
      }
    ) => {
      const dedupeKey = `${operationId ?? "none"}:${category}:${metadata.stage}`;
      if (reportedSubmissionEventsRef.current.has(dedupeKey)) return;
      reportedSubmissionEventsRef.current.add(dedupeKey);

      try {
        Sentry.withScope((scope) => {
          scope.setExtras({
            submission_type: metadata.submissionType,
            network_state:
              typeof navigator !== "undefined" && navigator.onLine === false
                ? "offline"
                : "online",
            stage: metadata.stage,
            result: metadata.result,
            queue_length: pendingLocalAnswersRef.current.length,
            route_mode: distributedCircularEnabled ? "distributed" : "fixed",
          });
          Sentry.captureMessage(category);
        });
      } catch {
        // best-effort, privacy-safe telemetry
      }
    },
    [distributedCircularEnabled]
  );

  const applyStudentSubmissionEvent = useCallback(
    (event: StudentSubmissionEvent) => {
      const transition = transitionStudentSubmission(
        studentSubmissionRef.current,
        event
      );

      if (!transition.accepted) {
        captureStudentSubmissionIssue(
          "student_submission_state_invalid",
          studentSubmissionRef.current.operationId,
          {
            submissionType: studentSubmissionRef.current.submissionType,
            stage: "resume",
            result: "rejected",
          }
        );
        return studentSubmissionRef.current;
      }

      studentSubmissionRef.current = transition.state;
      setStudentSubmission(transition.state);
      return transition.state;
    },
    [captureStudentSubmissionIssue]
  );

  const beginStudentSubmission = useCallback(
    (submissionType: StudentSubmissionType, operationId: string) => {
      const current = studentSubmissionRef.current;
      if (
        current.operationId !== operationId ||
        current.submissionType !== submissionType
      ) {
        const next = createIdleStudentSubmissionState(submissionType);
        studentSubmissionRef.current = next;
        setStudentSubmission(next);
      }

      const active = studentSubmissionRef.current;
      return applyStudentSubmissionEvent(
        active.operationId === operationId &&
          (active.status === "queued_offline" ||
            active.status === "awaiting_confirmation" ||
            active.status === "retryable_error")
          ? { type: "retry" }
          : { type: "submit", operationId }
      );
    },
    [applyStudentSubmissionEvent]
  );

  const rememberActiveParticipant = useCallback(
    (
      nextParticipantId: string,
      nextStudentName: string,
      nextStartOffset?: number | null,
      nextTeamId?: string | null,
      nextTeamColor?: string | null,
      nextAvatarUrl?: string | null,
      nextSessionStatus?: string | null
    ) => {
      if (!sessionId || !nextParticipantId) return;
      const normalizedName = nextStudentName.trim();
      const resolvedStartOffset = toIntegerStartOffset(nextStartOffset) ?? startOffset;
      setParticipantId(nextParticipantId);
      setStartOffset(resolvedStartOffset);
      // Preserve the original savedAt when updating the same participant during gameplay
      // (e.g. GPS sync). A fresh timestamp is only needed on a genuine new join, otherwise
      // reloads within 30 s of a recent sync are incorrectly treated as "fresh joins" and
      // the full DB-restore flow is skipped, resetting progress to post 1.
      const existing = readStoredActiveParticipant();
      if (existing?.participantId !== nextParticipantId || existing?.sessionId !== sessionId) {
        clearStoredPlaySnapshot();
        setPendingLocalAnswers([]);
      }
      const savedAt =
        existing?.participantId === nextParticipantId && existing?.sessionId === sessionId
          ? existing.savedAt
          : new Date().toISOString();
      saveStoredActiveParticipant({
        participantId: nextParticipantId,
        sessionId,
        studentName: normalizedName,
        startOffset: resolvedStartOffset,
        savedAt,
        teamId: nextTeamId ?? existing?.teamId ?? teamId ?? null,
        teamColor: nextTeamColor ?? existing?.teamColor ?? teamColor ?? null,
        avatarUrl: nextAvatarUrl ?? existing?.avatarUrl ?? avatarUrl ?? null,
        sessionStatus: nextSessionStatus ?? existing?.sessionStatus ?? sessionStatusRef.current ?? null,
        hasCompletedAvatarGate: existing?.hasCompletedAvatarGate ?? hasCompletedAvatarGate,
      });
    },
    // sessionStatus intentionally omitted – read from sessionStatusRef to avoid recreating
    // this callback (and its dependents) on every status poll.
    [avatarUrl, hasCompletedAvatarGate, sessionId, startOffset, teamColor, teamId]
  );

  const runParticipantIdentityRegistration = useCallback(
    async (nextStudentName: string) => {
      const normalizedName = nextStudentName.trim();
      const preferredParticipantId = storedParticipantOnLoad?.participantId?.trim() || null;
      if (!sessionId || !normalizedName || isProvisioningParticipant || circuitBreakerActive) {
        return false;
      }

      setIsProvisioningParticipant(true);

      try {
        const response = await fetch("/api/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            sessionId,
            studentName: normalizedName,
            participantId: preferredParticipantId,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              participantId?: string;
              studentName?: string;
              startOffset?: number;
              sessionStatus?: string | null;
              teamId?: string | null;
              teamColor?: string | null;
              error?: string;
            }
          | null;

        if (response.status === 410) {
          // Session findes, men er afsluttet eller ikke aktiv
          try {
            Sentry.addBreadcrumb({
              category: "join",
              message: "register_participant_session_ended",
              data: { statusCode: 410 },
            });
          } catch (err) {
            // best-effort
          }
          tripPlayCircuitBreaker("Løbet er afsluttet. Bed læreren om en ny kode, hvis I skal prøve igen.", "join_session_missing");
          return false;
        }
        if (response.status === 404) {
          // Session findes ikke
          try {
            Sentry.addBreadcrumb({
              category: "join",
              message: "register_participant_session_missing",
            });
          } catch (err) {
            // best-effort
          }
          tripPlayCircuitBreaker("Løbet findes ikke.", "join_session_missing");
          return false;
        }

        if (!response.ok || !payload?.participantId) {
          throw new Error(payload?.error || "Kunne ikke klargøre deltageren.");
        }

        const resolvedName = (payload.studentName ?? normalizedName).trim() || normalizedName;
        const resolvedStartOffset = toIntegerStartOffset(payload.startOffset) ?? 0;
        const resolvedSessionStatus =
          typeof payload.sessionStatus === "string" ? payload.sessionStatus : null;
        const resolvedTeamId = typeof payload.teamId === "string" ? payload.teamId : null;
        const resolvedTeamColor = typeof payload.teamColor === "string" ? payload.teamColor : null;
        const didRebindStoredParticipant =
          Boolean(preferredParticipantId) && payload.participantId === preferredParticipantId;
        const preservedAvatarUrl = didRebindStoredParticipant
          ? storedParticipantOnLoad?.avatarUrl ?? undefined
          : undefined;
        setPendingPlayerNameState(resolvedName);
        setPlayerName(resolvedName);
        setHasConfirmedName(true);
        setAvatarUrl(preservedAvatarUrl);
        setPendingAvatarUrlState(undefined);
        setHasCompletedAvatarGate(true);
        setNameError(null);
        setSessionStatus(resolvedSessionStatus);
        setTeamId(resolvedTeamId);
        setTeamColor(resolvedTeamColor);
        const initialRouteOrder = buildRouteOrder(
          questions.length,
          resolvedStartOffset,
          distributedCircularEnabled
        );
        // Only set the initial post when no posts have been answered yet.
        // During an auth-rebind (recoverParticipantAuthSession → rebind path),
        // this function is called again while the student is mid-run. Without
        // this guard, setCurrentPostIndex resets the student to post 1 even
        // when they are already on post 2 or beyond.
        // answeredPostIndexesRef is a stable ref — always current, no deps needed.
        if (initialRouteOrder.length > 0 && answeredPostIndexesRef.current.length === 0) {
          setCurrentPostIndex(initialRouteOrder[0] ?? 0);
        }
        rememberActiveParticipant(
          payload.participantId,
          resolvedName,
          resolvedStartOffset,
          resolvedTeamId,
          resolvedTeamColor,
          preservedAvatarUrl,
          resolvedSessionStatus
        );
        try {
          Sentry.addBreadcrumb({
            category: "auth",
            message: "participant_registered",
            data: { result: "stored" },
          });
        } catch (err) {
          // best-effort
        }
        return true;
      } catch (error) {
        console.error("Kunne ikke registrere deltageridentitet:", error);
        setHasConfirmedName(false);
        setHasCompletedAvatarGate(false);
        setNameError(
          error instanceof Error && error.message
            ? error.message
            : "Vi kunne ikke starte løbet lige nu. Prøv igen."
        );
        return false;
      } finally {
        setIsProvisioningParticipant(false);
      }
    },
    [
      circuitBreakerActive,
      isProvisioningParticipant,
      questions.length,
      distributedCircularEnabled,
      rememberActiveParticipant,
      sessionId,
      storedParticipantOnLoad?.avatarUrl,
      storedParticipantOnLoad?.hasCompletedAvatarGate,
      storedParticipantOnLoad?.participantId,
    ]
  );

  const registerParticipantIdentity = useCallback(
    async (nextStudentName: string) => {
      const inFlightRegistration = participantRegistrationPromiseRef.current;
      if (inFlightRegistration) {
        return inFlightRegistration;
      }

      const registrationPromise = runParticipantIdentityRegistration(nextStudentName);
      participantRegistrationPromiseRef.current = registrationPromise;

      try {
        return await registrationPromise;
      } finally {
        if (participantRegistrationPromiseRef.current === registrationPromise) {
          participantRegistrationPromiseRef.current = null;
        }
      }
    },
    [runParticipantIdentityRegistration]
  );

  const beginSubmission = useCallback(() => {
    if (isSubmitting || submissionLockRef.current) {
      return false;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    return true;
  }, [isSubmitting]);

  const endSubmission = useCallback(() => {
    submissionLockRef.current = false;
    setIsSubmitting(false);
  }, []);

  const routeOrder = useMemo(
    () => buildRouteOrder(questions.length, startOffset, distributedCircularEnabled),
    [distributedCircularEnabled, questions.length, startOffset]
  );
  const currentRouteStepIndex = getRouteStepIndex(routeOrder, currentPostIndex);
  const displayPostNumber = routeOrder.length > 0 ? currentRouteStepIndex + 1 : 0;
  const activeQuestion = questions[currentPostIndex];
  const activePostVariant = activeQuestion ? resolvePostVariant(raceMode, activeQuestion) : "unknown";
  const activeQuestionDisplayText =
    activeQuestion && activePostVariant !== "unknown"
      ? getQuestionDisplayText(activeQuestion, activePostVariant)
      : activeQuestion?.text ?? "";
  const roleplayCharacterName =
    activePostVariant === "roleplay" && activeQuestion ? getRoleplayCharacterName(activeQuestion) : "";
  const roleplayAvatar =
    activePostVariant === "roleplay" && activeQuestion ? getRoleplayAvatar(activeQuestion) : "";
  const progressPercent =
    questions.length > 0
      ? Math.max(0, Math.min(100, Math.round((correctAnswersCount / questions.length) * 100)))
      : 0;
  const isEscapeRace =
    raceMode === "escape" ||
    (raceMode === "unknown" &&
      questions.length > 0 &&
      questions.every((question) => resolvePostVariant(raceMode, question) === "escape"));
  const isStrategoRace = raceMode === "stratego";
  const isSessionPaused = sessionStatus === "paused";
  const activeDisplayName = playerName || pendingPlayerName || "Deltager";
  const celebrationName = activeDisplayName;
  const normalizedActiveDisplayName = activeDisplayName.trim().toLocaleLowerCase("da-DK");
  const myEscapePlacement =
    normalizedActiveDisplayName.length > 0
      ? escapeResults.find(
          (entry) =>
            entry.studentName.trim().toLocaleLowerCase("da-DK") === normalizedActiveDisplayName
        ) ?? null
      : null;
  const activeTypedAnswerKey = `${currentPostIndex}-${activePostVariant}`;
  const activeTypedAnswerError =
    typedAnswerError?.key === activeTypedAnswerKey ? typedAnswerError.message : null;
  const activePostActionError =
    postActionError?.key === activeTypedAnswerKey ? postActionError.message : null;
  const activePhotoFeedback = photoFeedback?.key === activeTypedAnswerKey ? photoFeedback : null;
  const activeQuizAnswerFeedback =
    quizAnswerFeedback?.key === activeTypedAnswerKey ? quizAnswerFeedback : null;
  const activeQuizPostBurned =
    activePostVariant === "quiz" &&
    (burnedPosts.has(currentPostIndex) || burnedPostsRef.current.has(currentPostIndex));
  const activeZoneKrigCaptureFeedback =
    zoneKrigCaptureFeedback?.key === activeTypedAnswerKey ? zoneKrigCaptureFeedback : null;
  const hasActiveQuizSuccess = activePostVariant === "quiz" && activeQuizAnswerFeedback?.tone === "success";
  const hasActivePhotoSuccess = activePhotoFeedback?.tone === "success";
  const isSelfiePhotoTask = activePostVariant === "photo" && activeQuestion?.isSelfie === true;
  const activeEscapeReward = escapeReward?.key === activeTypedAnswerKey ? escapeReward.brick : null;
  const activeRoleplayReply =
    roleplayReply?.key === activeTypedAnswerKey ? roleplayReply : null;
  const activeRoleplayReplyMessage = activeRoleplayReply?.message ?? null;
  const activeEscapeHint =
    activePostVariant === "escape" && wrongAttempts >= 3 ? activeQuestion?.hint?.trim() ?? "" : "";
  const isRoleplayImmersed = showQuestion && activePostVariant === "roleplay";
  const collectedEscapeRewardsCount = collectedEscapeRewards.length;
  const hasAllEscapeBricks =
    isEscapeRace && questions.length > 0 && collectedEscapeRewardsCount >= questions.length;

  const resetLocationSyncRecovery = useCallback(() => {
    locationSyncErrorsRef.current = 0;
    locationSyncSuspendedRef.current = false;
    locationSyncRecoveryCheckCooldownUntilRef.current = 0;
    setLocationSyncErrors(0);
  }, []);

  const isTransientNetworkError = useCallback((error: unknown) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return true;
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "";

    return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(
      message
    );
  }, []);

  const waitForNetworkRetry = useCallback((delayMs = NETWORK_RETRY_DELAY_MS) => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }, []);

  const fetchPlaySessionSnapshot = useCallback(async () => {
    if (!sessionId) {
      return null;
    }

    const response = await fetch(`/api/play/session?sessionId=${encodeURIComponent(sessionId)}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as PlaySessionPayload | null;

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        clearStoredActiveParticipant();
        router.push("/join?expired=1");
        return null;
      }

      throw new Error(payload?.error || PLAY_LOAD_RETRY_MESSAGE);
    }

    const parsedRadius = toFiniteNumber(payload?.radius);
    if (parsedRadius === null || parsedRadius <= 0) {
      throw new Error(PLAY_SETUP_PENDING_MESSAGE);
    }

    const parsedQuestions = Array.isArray(payload?.questions)
      ? payload.questions.map(parseQuestion).filter((q): q is Question => q !== null)
      : [];
    const nextRaceMode = normalizeRaceMode(payload?.raceType);
    const nextPostOrderMode = normalizePostOrderMode(payload?.postOrderMode);

    if (parsedQuestions.length === 0 && nextRaceMode !== "stratego") {
      throw new Error(PLAY_SETUP_PENDING_MESSAGE);
    }

    return {
      questions: parsedQuestions,
      raceMode: nextRaceMode,
      postOrderMode: nextPostOrderMode,
      radius: Math.round(parsedRadius),
      gpsOverride: Boolean(payload?.gpsOverride),
      usesStandardStudentLocationExperience: Boolean(
        payload?.usesStandardStudentLocationExperience
      ),
      bonusAvailable: Boolean(payload?.bonusAvailable),
      theme: normalizePlayTheme(payload?.theme),
    } satisfies FetchedPlaySessionSnapshot;
  }, [router, sessionId]);

  const recoverPhotoUploadRunOutOfSync = useCallback(
    async (uploadError: SubmitPhotoRequestError) => {
      const snapshot = await fetchPlaySessionSnapshot();
      if (!snapshot || !isMountedRef.current) {
        return false;
      }

      const nextQuestions = snapshot.questions;
      const questionCount = nextQuestions.length;
      if (questionCount === 0) {
        throw new Error(PLAY_SETUP_PENDING_MESSAGE);
      }

      const nextRaceMode = snapshot.raceMode;
      const nextAnsweredPostIndexes = answeredPostIndexesRef.current.filter(
        (index) => index >= 0 && index < questionCount
      );
      const nextSolvedPostIndexes = solvedPostIndexesRef.current.filter(
        (index) => index >= 0 && index < questionCount
      );
      const nextBurnedPosts = new Set<number>();
      for (const postIndex of burnedPostsRef.current) {
        if (postIndex >= 0 && postIndex < questionCount) {
          nextBurnedPosts.add(postIndex);
        }
      }

      const nextPendingLocalAnswers = pendingLocalAnswersRef.current.filter(
        (entry) => entry.solvedPostIndex >= 0 && entry.solvedPostIndex < questionCount
      );
      const nextRouteOrder = buildRouteOrder(
        questionCount,
        startOffset,
        snapshot.postOrderMode === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
      );
      const preferredPostIndex =
        typeof uploadError.postIndex === "number" &&
        Number.isInteger(uploadError.postIndex) &&
        uploadError.postIndex >= 0 &&
        uploadError.postIndex < questionCount
          ? uploadError.postIndex
          : currentPostIndex >= 0 && currentPostIndex < questionCount
            ? currentPostIndex
            : null;
      const answeredSet = new Set(nextAnsweredPostIndexes);
      const fallbackRoutePostIndex =
        getNextRoutePostIndex(nextRouteOrder, answeredSet) ?? nextRouteOrder[0] ?? 0;
      const nextCurrentPostIndex =
        preferredPostIndex !== null && !answeredSet.has(preferredPostIndex)
          ? preferredPostIndex
          : fallbackRoutePostIndex;

      setQuestions(nextQuestions);
      setRaceMode(nextRaceMode);
      setPostOrderMode(snapshot.postOrderMode);
      setTheme(snapshot.theme);
      setAutoUnlockRadius(snapshot.radius);
      setGpsOverride(snapshot.gpsOverride);
      setUsesStandardStudentLocationExperience(
        snapshot.usesStandardStudentLocationExperience
      );
      setBonusAvailable(snapshot.bonusAvailable);
      setAnsweredPostIndexes(nextAnsweredPostIndexes);
      setSolvedPostIndexes(nextSolvedPostIndexes);
      setCorrectAnswersCount(nextSolvedPostIndexes.length);
      burnedPostsRef.current = nextBurnedPosts;
      setBurnedPosts(new Set(nextBurnedPosts));
      pendingLocalAnswersRef.current = nextPendingLocalAnswers;
      setPendingLocalAnswers(nextPendingLocalAnswers);
      setCurrentPostIndex(nextCurrentPostIndex);
      setShowQuestion(false);
      setDismissedPostIndex(null);
      setDistanceState(null);

      showResumeNotice(PHOTO_UPLOAD_RUN_OUT_OF_SYNC_MESSAGE);

      return true;
    },
    [
      currentPostIndex,
      fetchPlaySessionSnapshot,
      setPendingLocalAnswers,
      showResumeNotice,
      startOffset,
    ]
  );

  const setPlayLoadError = useCallback(
    (message: string, variant: PlayLoadErrorVariant = "generic") => {
      setLoadError(message);
      setLoadErrorVariant(message ? variant : "generic");
    },
    []
  );

  const runParticipantAuthSessionRecovery = useCallback(
    async (
      storedName: string,
      telemetryReason?: string
    ): Promise<ParticipantAuthRecoveryMethod | null> => {
      if (circuitBreakerActive) {
        return null;
      }

      try {
        const { data, error } = await authWithLockRetry(
          () => supabase.auth.refreshSession(),
          "GameState.recoverParticipantAuthSession"
        );
        const refreshedUserId = data.user?.id ?? data.session?.user?.id ?? null;
        if (!error && refreshedUserId) {
          if (telemetryReason && sessionId) {
            sendTelemetry("participant_auth_refresh_recovered", {
              participant_id: participantId,
              session_id: sessionId,
              message: createClientTelemetryMessage({
                reason: telemetryReason,
                recovery_method: "refresh",
              }),
            });
          }

          return "refresh";
        }
      } catch (error) {
        console.warn("Deltager-login kunne ikke genopfriskes under restore:", error);
      }

      const normalizedStoredName = storedName.trim();
      if (!normalizedStoredName) {
        return null;
      }

      const didRebind = await registerParticipantIdentity(normalizedStoredName);
      if (!didRebind) {
        return null;
      }

      if (telemetryReason && sessionId) {
        sendTelemetry("participant_auth_rebind_recovered", {
          participant_id: participantId,
          session_id: sessionId,
          message: createClientTelemetryMessage({
            reason: telemetryReason,
            recovery_method: "rebind",
          }),
        });
      }

      restoreRetryCountRef.current = 0;
      await waitForNetworkRetry(RESTORE_AUTH_RECOVERY_DELAY_MS);
      return "rebind";
    },
    [
      circuitBreakerActive,
      participantId,
      registerParticipantIdentity,
      sessionId,
      supabase,
      waitForNetworkRetry,
    ]
  );

  const recoverParticipantAuthSession = useCallback(
    async (
      storedName: string,
      telemetryReason?: string
    ): Promise<ParticipantAuthRecoveryMethod | null> => {
      const inFlightRecovery = participantAuthRecoveryPromiseRef.current;
      if (inFlightRecovery) {
        return inFlightRecovery;
      }

      const recoveryPromise = runParticipantAuthSessionRecovery(
        storedName,
        telemetryReason
      );
      participantAuthRecoveryPromiseRef.current = recoveryPromise;

      try {
        return await recoveryPromise;
      } finally {
        if (participantAuthRecoveryPromiseRef.current === recoveryPromise) {
          participantAuthRecoveryPromiseRef.current = null;
        }
      }
    },
    [runParticipantAuthSessionRecovery]
  );

  const reconcileAuthoritativeAnswerProgress = useCallback(
    (
      pendingAnswer: StoredPendingAnswer,
      payload: SubmitAnswerResponsePayload | null
    ) => {
      if (
        !sessionId ||
        !participantId ||
        !payload ||
        !("expectedPostIndex" in payload) ||
        payload.expectedPostIndex === undefined ||
        !Array.isArray(payload.answeredPostIndexes) ||
        payload.answeredPostIndexes.some(
          (postIndex) =>
            !Number.isInteger(postIndex) ||
            postIndex < 0 ||
            postIndex >= questions.length
        )
      ) {
        return "invalid" as const;
      }

      const expectedPostIndex = payload.expectedPostIndex;
      if (
        expectedPostIndex !== null &&
        (!Number.isInteger(expectedPostIndex) ||
          (expectedPostIndex ?? -1) < 0 ||
          (expectedPostIndex ?? questions.length) >= questions.length)
      ) {
        return "invalid" as const;
      }

      const reconciliation = reconcileStudentSubmissionProgress(
        pendingLocalAnswersRef.current,
        { sessionId, participantId },
        {
          operationId: pendingAnswer.id,
          submittedPostIndex: pendingAnswer.solvedPostIndex,
          expectedPostIndex,
          answeredPostIndexes: payload.answeredPostIndexes,
        }
      );
      if (reconciliation.outcome === "invalid") {
        return "invalid" as const;
      }

      updatePendingLocalAnswers(() => reconciliation.queue);
      answeredPostIndexesRef.current = reconciliation.answeredPostIndexes;
      setAnsweredPostIndexes(reconciliation.answeredPostIndexes);

      const confirmedAnsweredPosts = new Set(
        reconciliation.answeredPostIndexes
      );
      const nextSolvedPostIndexes = solvedPostIndexesRef.current.filter(
        (postIndex) => confirmedAnsweredPosts.has(postIndex)
      );
      solvedPostIndexesRef.current = nextSolvedPostIndexes;
      setSolvedPostIndexes(nextSolvedPostIndexes);
      setCorrectAnswersCount(nextSolvedPostIndexes.length);
      const nextBurnedPosts = new Set(
        [...burnedPostsRef.current].filter((postIndex) =>
          confirmedAnsweredPosts.has(postIndex)
        )
      );
      burnedPostsRef.current = nextBurnedPosts;
      setBurnedPosts(nextBurnedPosts);

      setQuizAnswerFeedback(null);
      setPostActionError(null);
      setTypedAnswerError(null);
      setEscapeReward(null);
      setRoleplayReply(null);
      setDismissedPostIndex(null);
      setDistanceState(null);

      if (reconciliation.outcome === "retry_same_operation") {
        const retryableSubmission = restoreStudentSubmissionState(
          pendingAnswer.submissionType,
          pendingAnswer.id,
          "retryable_error"
        );
        studentSubmissionRef.current = retryableSubmission;
        setStudentSubmission(retryableSubmission);
        setCurrentPostIndex(pendingAnswer.solvedPostIndex);
        return reconciliation.outcome;
      }

      const idleSubmission = createIdleStudentSubmissionState(
        pendingAnswer.submissionType
      );
      studentSubmissionRef.current = idleSubmission;
      setStudentSubmission(idleSubmission);
      setShowQuestion(false);

      if (reconciliation.expectedPostIndex === null) {
        setIsFinished(true);
        void finalizeParticipantSilentlyRunnerRef.current();
        return reconciliation.outcome;
      }

      setCurrentPostIndex(reconciliation.expectedPostIndex);
      showResumeNotice("Løbet er opdateret. Fortsæt ved næste post.");
      return reconciliation.outcome;
    },
    [participantId, questions.length, sessionId, showResumeNotice, updatePendingLocalAnswers]
  );

  const sendStandardAnswerOperation = useCallback(
    async (
      operationId: string,
      payloads: Record<string, unknown>[],
      signal: AbortSignal
    ) => {
      const sendOnce = async () => {
        const response = await fetch("/api/play/submit-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ operationId, payloads }),
          signal,
        });
        const body = (await response.json().catch(() => null)) as
          | SubmitAnswerResponsePayload
          | null;
        return { response, body };
      };

      let result = await sendOnce();
      if (
        classifyStudentSubmissionResponse(
          result.response.status,
          result.body?.code
        ) !== "recover_auth"
      ) {
        return result;
      }

      const storedName =
        playerNameRef.current.trim() || pendingPlayerNameRef.current.trim();
      const recoveryMethod = await recoverParticipantAuthSession(
        storedName,
        "answer_submit_auth"
      );
      if (!recoveryMethod) {
        return result;
      }

      // Exactly one auth recovery and one resend. The operation id is unchanged,
      // so a lost first response remains idempotent server-side.
      result = await sendOnce();
      return result;
    },
    [recoverParticipantAuthSession]
  );

  const clearRestoreRetryTimer = useCallback(() => {
    if (restoreRetryTimerRef.current !== null) {
      clearTimeout(restoreRetryTimerRef.current);
      restoreRetryTimerRef.current = null;
    }
  }, []);

  const clearSessionStatusResubscribeTimer = useCallback(() => {
    if (sessionStatusResubscribeTimerRef.current !== null) {
      clearTimeout(sessionStatusResubscribeTimerRef.current);
      sessionStatusResubscribeTimerRef.current = null;
    }
  }, []);

  const clearMessageResubscribeTimer = useCallback(() => {
    if (messageResubscribeTimerRef.current !== null) {
      clearTimeout(messageResubscribeTimerRef.current);
      messageResubscribeTimerRef.current = null;
    }
  }, []);

  const tripPlayCircuitBreaker = useCallback(
    (
      message: string,
      variant: Extract<PlayLoadErrorVariant, "participant_auth_expired" | "join_session_missing">
    ) => {
      circuitBreakerTrippedRef.current = true;
      if (variant === "join_session_missing") {
        sessionStatusMissingRef.current = true;
      }
      clearRestoreRetryTimer();
      clearSessionStatusResubscribeTimer();
      clearMessageResubscribeTimer();
      restoreRetryCountRef.current = 0;
      reconnectInFlightRef.current = false;
      submissionLockRef.current = false;
      locationSyncErrorsRef.current = 0;
      locationSyncSuspendedRef.current = true;
      locationSyncRecoveryCheckInFlightRef.current = false;
      locationSyncRecoveryCheckCooldownUntilRef.current = Number.MAX_SAFE_INTEGER;

      setLocationSyncErrors(0);
      setResumeMessage(null);
      setShowQuestion(false);
      setIsLoading(false);
      setIsRestoringParticipant(false);
      setIsProvisioningParticipant(false);
      setIsSubmitting(false);
      setIsSubmittingAnswer(false);

      if (sessionStatusChannelRef.current) {
        void supabase.removeChannel(sessionStatusChannelRef.current).catch(() => undefined);
        sessionStatusChannelRef.current = null;
      }

      if (messageChannelRef.current) {
        void supabase.removeChannel(messageChannelRef.current).catch(() => undefined);
        messageChannelRef.current = null;
      }

      setPlayLoadError(message, variant);

      if (variant === "participant_auth_expired") {
        try {
          if (!expiredLoggedRef.current) {
            expiredLoggedRef.current = true;
            try {
              Sentry.addBreadcrumb({
                category: "play",
                message: "play_expired_screen_shown",
                data: { variant },
                level: "info",
              });
            } catch (_err) {
              // best-effort
            }

            try {
              sendTelemetry("play_expired_screen_shown", {
                participant_id: participantId ?? null,
                session_id: sessionId ?? null,
                message: createClientTelemetryMessage({ reason: variant, msg: message }),
              });
            } catch (_err) {
              // best-effort
            }
          }
        } catch (_err) {
          // best-effort
        }
      }
    },
    [
      clearMessageResubscribeTimer,
      clearRestoreRetryTimer,
      clearSessionStatusResubscribeTimer,
      sessionId,
      setPlayLoadError,
      supabase,
    ]
  );

  const fetchParticipantSnapshot = useCallback(
    async (targetParticipantId: string) => {
      if (!sessionId) {
        return {
          data: null as ParticipantRow | null,
          error: null as { status?: number; code?: string; message?: string } | null,
        };
      }

      if (circuitBreakerTrippedRef.current) {
        return {
          data: null,
          error: {
            status: 401,
            code: "CIRCUIT_BREAKER",
            message: PLAY_PARTICIPANT_AUTH_EXPIRED_MESSAGE,
          },
        } satisfies ParticipantSnapshotFetchResult;
      }

      const existingRequest = participantSnapshotRequestRef.current;
      if (existingRequest?.participantId === targetParticipantId) {
        return existingRequest.promise;
      }

      const requestPromise: Promise<ParticipantSnapshotFetchResult> = (async () => {
        // Allow one controlled recovery attempt for auth failures that occur
        // immediately after a fresh join (small race window). We avoid
        // tripping the circuit-breaker / logging Sentry on the first
        // transient 401/403 right after join.
        let authRecoveryAttempted = false;

        const doFetch = async () => {
          try {
            const response = await fetch(
              `/api/play/participant?sessionId=${encodeURIComponent(sessionId)}&participantId=${encodeURIComponent(targetParticipantId)}`,
              {
                cache: "no-store",
              }
            );
            const payload = (await response.json().catch(() => null)) as
              | { participant?: ParticipantRow | null; error?: string }
              | null;

            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                // Detect an immediate join (short window since savedAt). If so,
                // attempt one auth-recovery and retry before deciding how to
                // surface the failure. This covers the race where the join
                // response's Set-Cookie hasn't been applied yet.
                const savedAt = storedParticipantOnLoad?.savedAt;
                let withinJoinWindow = false;
                if (savedAt) {
                  try {
                    const savedMs = new Date(savedAt).getTime();
                    const ageMs = Date.now() - savedMs;
                    // conservative short window — 3s
                    withinJoinWindow = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 3000;
                  } catch {
                    withinJoinWindow = false;
                  }
                }

                if (withinJoinWindow && !authRecoveryAttempted) {
                  authRecoveryAttempted = true;
                  try {
                    const storedName =
                      storedParticipantOnLoad?.studentName?.trim() || playerName || pendingPlayerName || "";
                    const recoveryMethod = await recoverParticipantAuthSession(
                      storedName,
                      "participant_snapshot_retry"
                    );

                    if (recoveryMethod) {
                      // Try again once after recovery
                      const retryResp = await fetch(
                        `/api/play/participant?sessionId=${encodeURIComponent(sessionId)}&participantId=${encodeURIComponent(targetParticipantId)}`,
                        { cache: "no-store" }
                      );
                      const retryPayload = (await retryResp.json().catch(() => null)) as
                        | { participant?: ParticipantRow | null; error?: string }
                        | null;

                      if (retryResp.ok) {
                        return {
                          data: (retryPayload?.participant ?? null) as ParticipantRow | null,
                          error: null,
                        };
                      }

                      // Still failing after a recovery attempt — classify the failure.
                      const retryMessage = retryPayload?.error ?? retryResp.statusText;
                      const retryIsAuthExpired = isParticipantAuthResponseError(
                        retryResp.status,
                        retryMessage
                      );
                      const retryRecoveryReason =
                        determineParticipantAuthRecoveryReason(
                          retryResp.status,
                          retryMessage
                        );

                      if (
                        retryRecoveryReason === "participant_not_bound" ||
                        !retryIsAuthExpired
                      ) {
                        try {
                          clearStoredPlayRecoveryState();
                        } catch (_err) {
                          // best-effort
                        }

                        if (sessionId) {
                          sendTelemetry("play_participant_unauthorized_rejoin_shown", {
                            participant_id: participantId,
                            session_id: sessionId,
                            message: createClientTelemetryMessage({
                              reason: "participant_snapshot_401_retry",
                              httpStatus: retryResp.status,
                            }),
                          });
                        }

                        setPlayLoadError(PLAY_PARTICIPANT_UNAUTHORIZED_REJOIN_MESSAGE, "participant_unauthorized_rejoin");
                      } else {
                        tripPlayCircuitBreaker(
                          PLAY_PARTICIPANT_AUTH_EXPIRED_MESSAGE,
                          "participant_auth_expired"
                        );
                      }

                      return {
                        data: null,
                        error: {
                          status: retryResp.status,
                          code: String(retryResp.status),
                          message: retryMessage,
                        },
                      };
                    }
                  } catch {
                    // recovery attempt failed — fallthrough to normal handling
                  }
                }

                // No recovery attempted or recovery didn't help — classify response
                const msg = payload?.error ?? response.statusText;
                const isAuthExpired = isParticipantAuthResponseError(response.status, msg);
                const recoveryReason =
                  determineParticipantAuthRecoveryReason(response.status, msg);

                if (
                  recoveryReason === "participant_not_bound" ||
                  !isAuthExpired
                ) {
                  try {
                    clearStoredPlayRecoveryState();
                  } catch (_err) {
                    // best-effort
                  }

                  if (sessionId) {
                    sendTelemetry("play_participant_unauthorized_rejoin_shown", {
                      participant_id: participantId,
                      session_id: sessionId,
                      message: createClientTelemetryMessage({
                        reason: "participant_snapshot_401",
                        httpStatus: response.status,
                      }),
                    });
                  }

                  setPlayLoadError(PLAY_PARTICIPANT_UNAUTHORIZED_REJOIN_MESSAGE, "participant_unauthorized_rejoin");
                } else {
                  tripPlayCircuitBreaker(
                    PLAY_PARTICIPANT_AUTH_EXPIRED_MESSAGE,
                    "participant_auth_expired"
                  );
                }
              }

              return {
                data: null,
                error: {
                  status: response.status,
                  code: String(response.status),
                  message: payload?.error ?? response.statusText,
                },
              };
            }

            return {
              data: (payload?.participant ?? null) as ParticipantRow | null,
              error: null,
            };
          } catch (error) {
            return {
              data: null,
              error: {
                code: "FETCH_FAILED",
                message: error instanceof Error ? error.message : "Kunne ikke hente deltager-snapshot.",
              },
            };
          }
        };

        return await doFetch();
      })();

      participantSnapshotRequestRef.current = {
        participantId: targetParticipantId,
        promise: requestPromise,
      };

      try {
        return await requestPromise;
      } finally {
        if (participantSnapshotRequestRef.current?.promise === requestPromise) {
          participantSnapshotRequestRef.current = null;
        }
      }
    },
    [
      sessionId,
      tripPlayCircuitBreaker,
      recoverParticipantAuthSession,
      storedParticipantOnLoad,
      playerName,
      pendingPlayerName,
    ]
  );

  const scheduleRestoreRetry = useCallback(
    () => {
      if (circuitBreakerActive || circuitBreakerTrippedRef.current) {
        return;
      }

      if (restoreRetryTimerRef.current !== null) {
        return;
      }

      const nextRetryCount = restoreRetryCountRef.current + 1;
      if (nextRetryCount > MAX_RESTORE_RETRIES) {
        if (sessionId) {
          sendTelemetry("participant_restore_exhausted", {
            participant_id: participantId,
            session_id: sessionId,
            message: createClientTelemetryMessage({
              reason: "restore_exhausted",
              retries: nextRetryCount,
              state: "restore_loading",
            }),
          });
        }

        setIsRestoringParticipant(false);
        setPlayLoadError(PLAY_RESTORE_RETRY_MESSAGE, "restore_recovery");
        return;
      }

      restoreRetryCountRef.current = nextRetryCount;
      setIsRestoringParticipant(true);
      restoreRetryTimerRef.current = setTimeout(() => {
        restoreRetryTimerRef.current = null;
        setRestoreRetryNonce((current) => current + 1);
      }, RESTORE_RETRY_DELAY_MS);
    },
    [circuitBreakerActive, participantId, sessionId, setPlayLoadError]
  );

  const markPlayAsFinished = useCallback(() => {
    clearRestoreRetryTimer();
    restoreRetryCountRef.current = 0;
    resetLocationSyncRecovery();
    clearStoredPlayRecoveryState();
    setParticipantId(null);
    setShowQuestion(false);
    setIsKicked(false);
    setIsFinished(true);
    setIsRestoringParticipant(false);
  }, [clearRestoreRetryTimer, clearStoredPlayRecoveryState, resetLocationSyncRecovery]);

  const fetchSessionStatusSnapshot = useCallback(async () => {
    if (!sessionId || sessionStatusMissingRef.current) {
      return null;
    }
    // Deduplicate concurrent fetches — if one is already in-flight, skip.
    if (statusFetchInFlightRef.current) return null;
    statusFetchInFlightRef.current = true;

    try {
      const response = await fetch(`/api/play/status?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 404 || response.status === 410) {
          sessionStatusMissingRef.current = true;
          clearStoredPlayRecoveryState();
          router.replace("/join?missingSession=1");
          return null;
        }

        return null;
      }

      const payload = (await response.json().catch(() => null)) as PlaySessionStatusSnapshot | null;
      if (!payload) return null;

      const normalizeSessionStatus = (status: string | null | undefined) =>
        typeof status === "string" ? status : null;

      const nextSessionStatus = normalizeSessionStatus(payload.sessionStatus ?? payload.status);
      if (
        awaitingOnlineConfirmationRef.current &&
        navigator.onLine
      ) {
        awaitingOnlineConfirmationRef.current = false;
        setReconnectConfirmationNonce((current) => current + 1);
      }

      const teacherGuided = Boolean(
        (payload as any).teacherGuided ??
          (payload as any).isTeacherGuided ??
          (payload as any).guidedMode ??
          (payload as any).is_guided ??
          (payload as any).is_sequential ??
          (payload as any).sequential ??
          false
      );

      return {
        sessionStatus: nextSessionStatus,
        gpsOverride: Boolean(payload.gpsOverride),
        teacherGuided,
      };
    } catch (error) {
      console.error("Kunne ikke hente sessionstatus via API:", error);
      return null;
    } finally {
      statusFetchInFlightRef.current = false;
    }
  }, [sessionId]);

  const runAuthoritativeLocationSyncCheck = useCallback(async () => {
    if (
      !sessionId ||
      !participantId ||
      circuitBreakerActive ||
      restoreInFlightRef.current ||
      !hasRestoredRef.current ||
      locationSyncRecoveryCheckInFlightRef.current
    ) {
      return;
    }

    locationSyncRecoveryCheckInFlightRef.current = true;

    try {
      if (sessionStatus === "finished") {
        markPlayAsFinished();
        return;
      }

      const sessionResponse = await fetch(
        `/api/play/session?sessionId=${encodeURIComponent(sessionId)}`,
        {
          cache: "no-store",
        }
      );

      if (sessionResponse.status === 404 || sessionResponse.status === 410) {
        sessionStatusMissingRef.current = true;
        clearStoredPlayRecoveryState();
        router.replace("/join?missingSession=1");
        return;
      }

      if (!sessionResponse.ok) {
        console.error(
          "Kunne ikke verificere sessionen efter positionsfejl:",
          sessionResponse.status,
          sessionResponse.statusText
        );
        return;
      }

      const sessionStatusSnapshot = await fetchSessionStatusSnapshot();
      const nextSessionStatus = sessionStatusSnapshot?.sessionStatus ?? null;

      if (sessionStatusSnapshot) {
        setSessionStatus(nextSessionStatus);
        setGpsOverride(sessionStatusSnapshot.gpsOverride);
        setIsTeacherGuided(Boolean(sessionStatusSnapshot.teacherGuided));
      }

      if (nextSessionStatus === "finished") {
        markPlayAsFinished();
        return;
      }

      const authRecoveryMethod = await recoverParticipantAuthSession(
        storedParticipantOnLoad?.studentName?.trim() || playerName || pendingPlayerName,
        "location_sync_recovery"
      );

      if (!authRecoveryMethod) {
        scheduleRestoreRetry();
        return;
      }

      const { data: participantSnapshot, error: participantSnapshotError } =
        await fetchParticipantSnapshot(participantId);

      if (participantSnapshotError) {
        if (participantSnapshotError.status === 401 || participantSnapshotError.status === 403) {
          return;
        }

        console.error(
          "Kunne ikke verificere deltageren efter positionsfejl:",
          participantSnapshotError
        );
        scheduleRestoreRetry();
        return;
      }

      if (!participantSnapshot) {
        console.warn("Deltageren kunne ikke bekræftes efter positionsfejl. Bevarer lokal state.");
        scheduleRestoreRetry();
        return;
      }

      if (participantSnapshot.finished_at) {
        markPlayAsFinished();
        return;
      }

      resetLocationSyncRecovery();
    } catch (error) {
      console.error("Kunne ikke gennemfoere autoritativ session-check efter positionsfejl:", error);
    } finally {
      locationSyncRecoveryCheckInFlightRef.current = false;
    }
  }, [
    fetchSessionStatusSnapshot,
    fetchParticipantSnapshot,
    circuitBreakerActive,
    pendingPlayerName,
    playerName,
    recoverParticipantAuthSession,
    markPlayAsFinished,
    participantId,
    resetLocationSyncRecovery,
    scheduleRestoreRetry,
    sessionId,
    sessionStatus,
    storedParticipantOnLoad?.studentName,
  ]);

  const recoverWakeUpState = useCallback(async (trigger: WakeReconnectTrigger = "visibility_resume") => {
    if (
      !sessionId ||
      reconnectInFlightRef.current ||
      circuitBreakerActive ||
      sessionStatusMissingRef.current ||
      restoreInFlightRef.current ||
      (participantId && !hasRestoredRef.current)
    ) {
      return;
    }

    reconnectInFlightRef.current = true;
    if (
      usesStandardStudentLocationExperience &&
      (trigger === "visibility_resume" ||
        trigger === "pageshow_resume" ||
        trigger === "online_resume")
    ) {
      setDistanceState(null);
    }
    // Read frequently-changing state via refs so this callback stays stable.
    const shouldTrackReconnectOutcome =
      isRestoringParticipantRef.current ||
      trigger === "status_channel_error" ||
      trigger === "message_channel_error";
    let reconnectOutcomeLogged = false;

    try {
      const storedName =
        storedParticipantOnLoad?.studentName?.trim() || playerNameRef.current || pendingPlayerNameRef.current;
      let participantAuthRecoveryMethod: ParticipantAuthRecoveryMethod | null = null;
      let hasRecoveredParticipantAuth = true;
      const channelOnlyReconnect =
        trigger === "status_channel_error" || trigger === "message_channel_error";

      if (
        participantId &&
        !isFinishedRef.current &&
        !isKickedRef.current &&
        !channelOnlyReconnect
      ) {
        participantAuthRecoveryMethod = await recoverParticipantAuthSession(
          storedName,
          shouldTrackReconnectOutcome ? `wake_reconnect:${trigger}` : undefined
        );
        hasRecoveredParticipantAuth = participantAuthRecoveryMethod !== null;
      } else if (!participantId) {
        void authWithLockRetry(() => supabase.auth.refreshSession(), "GameState.backgroundRefresh").catch(() => undefined);
      }

      const sessionStatusSnapshot = await fetchSessionStatusSnapshot();
      const nextSessionStatus = sessionStatusSnapshot?.sessionStatus ?? null;

      if (sessionStatusSnapshot) {
        setSessionStatus(nextSessionStatus);
        setGpsOverride(sessionStatusSnapshot.gpsOverride);
        setIsTeacherGuided(Boolean(sessionStatusSnapshot.teacherGuided));
      }

      if (nextSessionStatus === "finished") {
        if (shouldTrackReconnectOutcome) {
          sendTelemetry("wake_reconnect_recovered", {
            participant_id: participantId,
            session_id: sessionId,
            message: createClientTelemetryMessage({
              auth_method: participantAuthRecoveryMethod ?? "none",
              reason: "session_finished",
              result: "session_finished",
              trigger,
            }),
          });
          reconnectOutcomeLogged = true;
        }

        markPlayAsFinished();
        return;
      }

      if (participantId && !isFinishedRef.current && !isKickedRef.current && !hasRecoveredParticipantAuth) {
        if (shouldTrackReconnectOutcome) {
          sendTelemetry("wake_reconnect_failed", {
            participant_id: participantId,
            session_id: sessionId,
            message: createClientTelemetryMessage({
              reason: "auth_recovery_failed",
              trigger,
            }),
          });
          reconnectOutcomeLogged = true;
        }
      }

      if (participantId && !isFinishedRef.current && !isKickedRef.current && hasRecoveredParticipantAuth) {
        const refreshedStoredParticipant = readStoredActiveParticipant();
        const activeParticipantId =
          refreshedStoredParticipant?.sessionId === sessionId
            ? refreshedStoredParticipant.participantId
            : participantId;

        if (activeParticipantId) {
          const { data: participantSnapshot, error: participantSnapshotError } =
            await fetchParticipantSnapshot(activeParticipantId);

          if (!participantSnapshotError && participantSnapshot) {
            const restoredName =
              typeof participantSnapshot.student_name === "string"
                ? participantSnapshot.student_name.trim()
                : "";
            const restoredStartOffset = toIntegerStartOffset(participantSnapshot.start_offset);
            const restoredLat = toFiniteNumber(participantSnapshot.lat);
            const restoredLng = toFiniteNumber(participantSnapshot.lng);

            if (restoredName) {
              setPlayerName(restoredName);
              setPendingPlayerNameState(restoredName);
              setHasConfirmedName(true);
              setNameError(null);
              rememberActiveParticipant(
                activeParticipantId,
                restoredName,
                restoredStartOffset,
                undefined,
                undefined,
                undefined,
                nextSessionStatus
              );
            }

            if (restoredStartOffset !== null) {
              setStartOffset(restoredStartOffset);
            }

            if (restoredLat !== null && restoredLng !== null) {
              setMyLoc({ lat: restoredLat, lng: restoredLng });
            }

            if (participantSnapshot.finished_at) {
              markPlayAsFinished();
              return;
            }

            clearRestoreRetryTimer();
            restoreRetryCountRef.current = 0;
            setIsRestoringParticipant(false);
            resetLocationSyncRecovery();
            if (shouldTrackReconnectOutcome) {
              sendTelemetry("wake_reconnect_recovered", {
                participant_id: activeParticipantId,
                session_id: sessionId,
                message: createClientTelemetryMessage({
                  auth_method: participantAuthRecoveryMethod ?? "none",
                  reason: "participant_restored",
                  result: "participant_restored",
                  trigger,
                }),
              });
              reconnectOutcomeLogged = true;
            }
          } else if (
            participantSnapshotError?.status === 401 ||
            participantSnapshotError?.status === 403
          ) {
            return;
          } else if (
            participantSnapshotError?.status &&
            participantSnapshotError.status !== 404
          ) {
            console.error(
              "Kunne ikke genskabe deltager under wake/reconnect:",
              participantSnapshotError
            );
            if (shouldTrackReconnectOutcome) {
              sendTelemetry("wake_reconnect_failed", {
                participant_id: activeParticipantId,
                session_id: sessionId,
                message: createClientTelemetryMessage({
                  reason: "snapshot_error",
                  status_code: participantSnapshotError.status ?? null,
                  trigger,
                }),
              });
              reconnectOutcomeLogged = true;
            }
          } else if (!participantSnapshot && shouldTrackReconnectOutcome) {
            sendTelemetry("wake_reconnect_failed", {
              participant_id: activeParticipantId,
              session_id: sessionId,
              message: createClientTelemetryMessage({
                reason: "participant_missing",
                trigger,
              }),
            });
            reconnectOutcomeLogged = true;
          }
        }
      }

      await loadLatestTeacherMessage();
    } catch (error) {
      console.error("Kunne ikke genoprette play-forbindelsen efter wake:", error);
      if (shouldTrackReconnectOutcome && !reconnectOutcomeLogged) {
        sendTelemetry("wake_reconnect_failed", {
          participant_id: participantId,
          session_id: sessionId,
          message: createClientTelemetryMessage({
            reason: "exception",
            trigger,
          }),
        });
      }
    } finally {
      reconnectInFlightRef.current = false;
    }
  }, [
    // isRestoringParticipant, playerName, pendingPlayerName, isFinished, isKicked, sessionStatus
    // intentionally omitted — read from refs so this callback doesn't recreate on every
    // restore setState or status poll, which would restart the two long-running effects
    // that list recoverWakeUpState as a dependency.
    clearRestoreRetryTimer,
    circuitBreakerActive,
    fetchParticipantSnapshot,
    fetchSessionStatusSnapshot,
    loadLatestTeacherMessage,
    markPlayAsFinished,
    participantId,
    recoverParticipantAuthSession,
    rememberActiveParticipant,
    resetLocationSyncRecovery,
    sessionId,
    storedParticipantOnLoad?.studentName,
    supabase,
    usesStandardStudentLocationExperience,
  ]);

  const getAnswerValidationErrorMessage = useCallback((error: unknown) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return OFFLINE_VALIDATION_MESSAGE;
    }

    const errorMessage = error instanceof Error ? error.message : "";
    if (/failed to fetch|load failed|networkerror/i.test(errorMessage)) {
      return OFFLINE_VALIDATION_MESSAGE;
    }

    return ANSWER_VALIDATION_RETRY_MESSAGE;
  }, []);

  useEffect(() => {
    locationSyncErrorsRef.current = locationSyncErrors;
  }, [locationSyncErrors]);

  useEffect(() => {
    circuitBreakerTrippedRef.current = circuitBreakerActive;
  }, [circuitBreakerActive]);

  useEffect(() => {
    restoreRetryCountRef.current = 0;
    resetLocationSyncRecovery();
  }, [participantId, resetLocationSyncRecovery, sessionId]);

  // Reset the inconsistent-state reporting set whenever participant or session changes.
  useEffect(() => {
    inconsistentStateReportedPostsRef.current = new Set();
  }, [participantId, sessionId]);

  useEffect(() => {
    return () => {
      clearRestoreRetryTimer();
      clearSessionStatusResubscribeTimer();
      clearMessageResubscribeTimer();
    };
  }, [clearMessageResubscribeTimer, clearRestoreRetryTimer, clearSessionStatusResubscribeTimer]);

  useEffect(() => {
    if (
      questions.length === 0 ||
      isFinished ||
      correctAnswersCount > 0 ||
      answeredPostIndexes.length > 0 ||
      routeOrder.length === 0
    ) {
      return;
    }

    const firstRoutePostIndex = routeOrder[0] ?? 0;
    setCurrentPostIndex((current) => (current === firstRoutePostIndex ? current : firstRoutePostIndex));
  }, [answeredPostIndexes.length, correctAnswersCount, isFinished, questions.length, routeOrder]);

  useEffect(() => {
    if (!sessionId || circuitBreakerActive) return;
    let cancelled = false;
    const pollTimeoutRef: { current: number | null } = {
      current: null,
    };

    const syncSessionStatus = async () => {
      const sessionStatusSnapshot = await fetchSessionStatusSnapshot();

      if (cancelled || !sessionStatusSnapshot) {
        return;
      }

      const nextStatus = sessionStatusSnapshot.sessionStatus ?? null;
      setSessionStatus(nextStatus);
      setGpsOverride(sessionStatusSnapshot.gpsOverride);
      setIsTeacherGuided(Boolean(sessionStatusSnapshot.teacherGuided));

      if (nextStatus === "finished") {
        markPlayAsFinished();
      }
    };

    const removeStatusChannel = () => {
      if (!sessionStatusChannelRef.current) return;
      void supabase.removeChannel(sessionStatusChannelRef.current).catch(() => undefined);
      sessionStatusChannelRef.current = null;
    };

    const clearPollTimeout = () => {
      if (pollTimeoutRef.current === null) {
        return;
      }

      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    };

    const shouldStopPolling = () => {
      if (cancelled || sessionStatusMissingRef.current || isFinishedRef.current || isKickedRef.current) {
        return true;
      }

      const currentStatus = sessionStatusRef.current;
      return currentStatus === "finished" || currentStatus === "expired";
    };

    const getNextPollDelayMs = () => {
      const currentStatus = sessionStatusRef.current;

      if (currentStatus === "running" || currentStatus === "active") {
        return ACTIVE_SESSION_STATUS_POLL_INTERVAL_MS;
      }

      return WAITING_SESSION_STATUS_POLL_INTERVAL_MS;
    };

    const scheduleNextPoll = () => {
      if (shouldStopPolling()) {
        clearPollTimeout();
        return;
      }

      clearPollTimeout();
      pollTimeoutRef.current = window.setTimeout(() => {
        pollTimeoutRef.current = null;
        void pollSessionStatus();
      }, getNextPollDelayMs());
    };

    const pollSessionStatus = async () => {
      if (shouldStopPolling()) {
        return;
      }

      try {
        if (document.hidden) {
          return;
        }

        await syncSessionStatus();
      } finally {
        if (!shouldStopPolling()) {
          scheduleNextPoll();
        }
      }
    };

    const scheduleStatusResubscribe = () => {
      if (cancelled || sessionStatusResubscribeTimerRef.current !== null) {
        return;
      }

      sessionStatusResubscribeTimerRef.current = setTimeout(() => {
        sessionStatusResubscribeTimerRef.current = null;
        if (cancelled) {
          return;
        }

        createStatusSubscription();
      }, CHANNEL_RESUBSCRIBE_DELAY_MS);
    };

    const createStatusSubscription = () => {
      removeStatusChannel();

      sessionStatusChannelRef.current = supabase
        .channel(`session-status-${sessionId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` },
          (payload) => {
            try {
              const nextRow = payload.new as LiveSessionStatusRow | null;
              const nextStatus = nextRow?.status ?? null;
              setSessionStatus(nextStatus);
              setGpsOverride(Boolean(nextRow?.gps_override));
              const teacherGuidedFromRow = Boolean(
                (nextRow as any)?.teacher_guided ??
                  (nextRow as any)?.isTeacherGuided ??
                  (nextRow as any)?.teacherGuided ??
                  (nextRow as any)?.guided ??
                  (nextRow as any)?.is_sequential ??
                  (nextRow as any)?.sequential ??
                  false
              );
              setIsTeacherGuided(teacherGuidedFromRow);

              if (nextStatus === "finished") {
                markPlayAsFinished();
              }
            } catch (error) {
              console.error("Fejl ved behandling af live_sessions-opdatering:", error);
            }
          }
        )
        .subscribe((status) => {
          if (cancelled) {
            return;
          }

          if (status === "SUBSCRIBED") {
            clearSessionStatusResubscribeTimer();
            void syncSessionStatus();
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            void recoverWakeUpState("status_channel_error");
            scheduleStatusResubscribe();
          }
        });
    };

    // Fetch initial session status
    void syncSessionStatus();
    createStatusSubscription();
    scheduleNextPoll();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void recoverWakeUpState("visibility_resume");
        createStatusSubscription();
      }
    };

    const handleOnline = () => {
      awaitingOnlineConfirmationRef.current = true;
      void recoverWakeUpState("online_resume");
      createStatusSubscription();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }

      void recoverWakeUpState("pageshow_resume");
      createStatusSubscription();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      cancelled = true;
      clearPollTimeout();
      clearSessionStatusResubscribeTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pageshow", handlePageShow);
      removeStatusChannel();
    };
  }, [
    // sessionStatus intentionally omitted — each timeout reads sessionStatusRef at schedule
    // time so the polling delay adapts without recreating the whole effect on every status
    // transition. The ref is kept in sync by a dedicated useEffect above.
    circuitBreakerActive,
    clearSessionStatusResubscribeTimer,
    fetchSessionStatusSnapshot,
    markPlayAsFinished,
    participantId,
    recoverWakeUpState,
    sessionId,
    supabase,
  ]);

  useEffect(() => {
    if (!sessionId || !participantId) {
      return;
    }

    const existing = readStoredActiveParticipant();
    if (!existing || existing.sessionId !== sessionId || existing.participantId !== participantId) {
      return;
    }

    saveStoredActiveParticipant({
      ...existing,
      avatarUrl: avatarUrl ?? existing.avatarUrl ?? null,
      sessionStatus,
      hasCompletedAvatarGate,
    });
  }, [avatarUrl, hasCompletedAvatarGate, participantId, sessionId, sessionStatus]);

  useEffect(() => {
    if (
      !sessionId ||
      !participantId ||
      isLoading ||
      isRestoringParticipant ||
      !hasRestoredRef.current
    ) {
      return;
    }

    let snapshotCurrentPostIndex = currentPostIndex;
    let snapshotShowQuestion = showQuestion;
    let snapshotDismissedPostIndex = dismissedPostIndex;

    if (distributedCircularEnabled) {
      if (routeOrder.length === 0) {
        return;
      }

      snapshotCurrentPostIndex = resolveRestoredPostIndex({
        routeOrder,
        answeredPostIndexes,
        snapshotCurrentPostIndex: currentPostIndex,
        enforceRouteOrder: true,
      });

      if (snapshotCurrentPostIndex !== currentPostIndex) {
        snapshotShowQuestion = false;
        snapshotDismissedPostIndex = null;
      }
    }

    saveStoredPlaySnapshot({
      participantId,
      sessionId,
      currentPostIndex: snapshotCurrentPostIndex,
      solvedPostIndexes,
      answeredPostIndexes,
      burnedPosts: Array.from(burnedPosts),
      correctAnswersCount,
      score,
      showQuestion: snapshotShowQuestion,
      dismissedPostIndex: snapshotDismissedPostIndex,
      playStartedAtMs,
      playFinishedAtMs,
      pendingAnswers: pendingLocalAnswers,
      savedAt: new Date().toISOString(),
    });
  }, [
    correctAnswersCount,
    currentPostIndex,
    dismissedPostIndex,
    distributedCircularEnabled,
    participantId,
    isLoading,
    isRestoringParticipant,
    pendingLocalAnswers,
    playFinishedAtMs,
    playStartedAtMs,
    score,
    sessionId,
    showQuestion,
    answeredPostIndexes,
    burnedPosts,
    routeOrder,
    solvedPostIndexes,
  ]);

  // ─── Inconsistent-state detection ──────────────────────────────────────────
  // Fires play_progress_inconsistent_state when:
  //   • the current post is already in answeredPostIndexes (student has answered it)
  //   • but the run is not finished and there is still an unanswered post in the route
  // This should NEVER persist for more than a few hundred milliseconds in normal
  // flow (continueFromSolvedPost advances currentPostIndex within the same user
  // interaction).  A 15-second debounce filters out transient React render-batching
  // and normal "looking at success feedback" time.  The ref guard prevents the same
  // post from being reported twice per session.
  useEffect(() => {
    if (
      !participantId ||
      !sessionId ||
      isFinished ||
      questions.length <= 1 ||
      answeredPostIndexes.length === 0 ||
      !answeredPostIndexes.includes(currentPostIndex) ||
      inconsistentStateReportedPostsRef.current.has(currentPostIndex)
    ) {
      return;
    }

    // Only relevant if there is still at least one unanswered post to go to.
    const answeredSet = new Set(answeredPostIndexes);
    const hasNextUnanswered = routeOrder.some((idx) => !answeredSet.has(idx));
    if (!hasNextUnanswered) {
      return;
    }

    const INCONSISTENT_DEBOUNCE_MS = 15_000;

    const timer = setTimeout(() => {
      // Re-check via refs so we use the freshest values at fire time.
      if (isFinishedRef.current) return;
      if (inconsistentStateReportedPostsRef.current.has(currentPostIndex)) return;
      if (!answeredPostIndexesRef.current.includes(currentPostIndex)) return;

      // Verify there is still an unanswered post using the current ref value.
      const currentAnsweredSet = new Set(answeredPostIndexesRef.current);
      if (!routeOrder.some((idx) => !currentAnsweredSet.has(idx))) return;

      inconsistentStateReportedPostsRef.current.add(currentPostIndex);

      sendTelemetry("play_progress_inconsistent_state", {
        participant_id: participantId,
        session_id: sessionId,
        message: createClientTelemetryMessage({
          current_post_index: currentPostIndex,
          answered_count: answeredPostIndexesRef.current.length,
          total_posts: questions.length,
          route_step: currentRouteStepIndex,
          has_next_unanswered_post: true,
          show_question: showQuestion,
          has_distance: distance !== null,
          race_mode: raceMode,
        }),
      });
    }, INCONSISTENT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    answeredPostIndexes,
    currentPostIndex,
    currentRouteStepIndex,
    distance,
    isFinished,
    participantId,
    questions.length,
    raceMode,
    routeOrder,
    sessionId,
    showQuestion,
  ]);
  // ───────────────────────────────────────────────────────────────────────────

  const schedulePendingAnswerReplay = useCallback((delayMs: number) => {
    if (pendingAnswerReplayTimerRef.current) {
      clearTimeout(pendingAnswerReplayTimerRef.current);
    }

    pendingAnswerReplayTimerRef.current = setTimeout(() => {
      pendingAnswerReplayTimerRef.current = null;
      pendingAnswerReplayRunnerRef.current();
    }, Math.max(250, delayMs));
  }, []);

  const replayPendingLocalAnswers = useCallback(async () => {
    if (
      !sessionId ||
      !participantId ||
      !hasRestoredRef.current ||
      isRestoringParticipantRef.current ||
      pendingAnswerReplayInFlightRef.current
    ) {
      return;
    }

    if (
      answersTableMissingRef.current ||
      (typeof navigator !== "undefined" && navigator.onLine === false)
    ) {
      return;
    }

    const queuedAnswers = [...pendingLocalAnswersRef.current];
    if (queuedAnswers.length === 0) {
      return;
    }

    pendingAnswerReplayInFlightRef.current = true;

    try {
      for (const pendingAnswer of queuedAnswers) {
        if (
          !isPendingSubmissionForContext(pendingAnswer, {
            sessionId,
            participantId,
          })
        ) {
          removePendingLocalAnswer(pendingAnswer.id);
          continue;
        }

        if (isTerminalPendingAnswer(pendingAnswer)) {
          if (pendingAnswer.status === "rejected") {
            continue;
          }
          const terminalSubmission = restoreStudentSubmissionState(
            pendingAnswer.submissionType,
            pendingAnswer.id,
            pendingAnswer.status
          );
          studentSubmissionRef.current = terminalSubmission;
          setStudentSubmission(terminalSubmission);
          break;
        }

        if (!pendingAnswer.hasLocalProgress) {
          // Et usikkert svar på den aktuelle post kræver elevens eksplicitte retry,
          // så replay ikke kan flytte UI-progression i baggrunden.
          if (pendingAnswer.solvedPostIndex === currentPostIndex) break;
          continue;
        }

        if (
          !canReplayStudentSubmission(
            pendingAnswer,
            { sessionId, participantId },
            Date.now(),
            pendingAnswer.nextRetryAtMs
          )
        ) {
          if (
            pendingAnswer.nextRetryAtMs &&
            pendingAnswer.nextRetryAtMs > Date.now()
          ) {
            schedulePendingAnswerReplay(
              pendingAnswer.nextRetryAtMs - Date.now()
            );
          }
          break;
        }

        const abortController = new AbortController();
        const timeoutId = setTimeout(
          () => abortController.abort(),
          STANDARD_ANSWER_SUBMISSION_TIMEOUT_MS
        );

        try {
          const { response, body } = await sendStandardAnswerOperation(
            pendingAnswer.id,
            pendingAnswer.payloads,
            abortController.signal
          );
          const responseDisposition = classifyStudentSubmissionResponse(
            response.status,
            body?.code
          );

          if (response.ok && body?.inserted === true) {
            if (pendingAnswer.hasLocalProgress) {
              const serverCorrectness =
                typeof body.storedIsCorrect === "boolean"
                  ? body.storedIsCorrect
                  : normalizeSubmitAnswerServerCorrectness(
                      body.serverCorrectness
                    )?.isCorrect ?? pendingAnswer.isCorrect;
              const serverAwardedPoints =
                typeof body.awardedPoints === "number" &&
                Number.isFinite(body.awardedPoints)
                  ? Math.max(0, Math.round(body.awardedPoints))
                  : pendingAnswer.awardedPoints;
              const reconciliation = reconcileStudentSubmissionOutcome(
                {
                  isCorrect: pendingAnswer.isCorrect,
                  awardedPoints: pendingAnswer.awardedPoints,
                },
                {
                  isCorrect: serverCorrectness,
                  awardedPoints: serverAwardedPoints,
                }
              );

              if (reconciliation.didCorrectnessChange) {
                if (reconciliation.authoritativeOutcome.isCorrect) {
                  removeBurnedPostIndex(pendingAnswer.solvedPostIndex);
                  if (markSolvedPostIndex(pendingAnswer.solvedPostIndex)) {
                    setCorrectAnswersCount((current) => current + 1);
                  }
                } else {
                  markBurnedPostIndex(pendingAnswer.solvedPostIndex);
                  if (removeSolvedPostIndex(pendingAnswer.solvedPostIndex)) {
                    setCorrectAnswersCount((current) =>
                      Math.max(0, current - 1)
                    );
                  }
                }
              }

              if (reconciliation.pointsDelta !== 0) {
                setScore((current) =>
                  Math.max(0, current + reconciliation.pointsDelta)
                );
              }
            }

            removePendingLocalAnswer(pendingAnswer.id);
            if (
              studentSubmissionRef.current.operationId === pendingAnswer.id &&
              studentSubmissionRef.current.status !== "confirmed"
            ) {
              applyStudentSubmissionEvent({
                type: "confirm",
                result: body.duplicate === true ? "duplicate" : "stored",
              });
            }
            showResumeNotice("Svaret er gemt");
            continue;
          }

          if (responseDisposition === "session_closed") {
            updatePendingLocalAnswer(pendingAnswer.id, (current) => ({
              ...current,
              status: "session_closed",
              nextRetryAtMs: null,
            }));
            const closedSubmission = restoreStudentSubmissionState(
              pendingAnswer.submissionType,
              pendingAnswer.id,
              "session_closed"
            );
            studentSubmissionRef.current = closedSubmission;
            setStudentSubmission(closedSubmission);
            break;
          }

          if (responseDisposition === "reconcile_progress") {
            const reconciliation = reconcileAuthoritativeAnswerProgress(
              pendingAnswer,
              body
            );
            if (
              reconciliation === "retry_same_operation" ||
              reconciliation === "advance" ||
              reconciliation === "complete"
            ) {
              break;
            }

            updatePendingLocalAnswer(pendingAnswer.id, (current) => ({
              ...current,
              status: "retryable_error",
              nextRetryAtMs: null,
              failureCode: "PROGRESS_RECONCILIATION_INVALID",
            }));
            if (pendingAnswer.solvedPostIndex === currentPostIndex) {
              const retryableSubmission = restoreStudentSubmissionState(
                pendingAnswer.submissionType,
                pendingAnswer.id,
                "retryable_error"
              );
              studentSubmissionRef.current = retryableSubmission;
              setStudentSubmission(retryableSubmission);
              break;
            }
            continue;
          }

          if (responseDisposition === "rejected_for_post") {
            updatePendingLocalAnswer(pendingAnswer.id, (current) => ({
              ...current,
              status: "rejected",
              nextRetryAtMs: null,
              failureCode: body?.code || `HTTP_${response.status}`,
            }));
            if (pendingAnswer.solvedPostIndex === currentPostIndex) {
              const rejectedSubmission = restoreStudentSubmissionState(
                pendingAnswer.submissionType,
                pendingAnswer.id,
                "rejected"
              );
              studentSubmissionRef.current = rejectedSubmission;
              setStudentSubmission(rejectedSubmission);
              break;
            }
            continue;
          }

          if (responseDisposition === "recover_auth") {
            updatePendingLocalAnswer(pendingAnswer.id, (current) => ({
              ...current,
              status: "retryable_error",
              nextRetryAtMs: null,
              failureCode: "AUTH_RECOVERY_FAILED",
            }));
            if (pendingAnswer.solvedPostIndex === currentPostIndex) {
              const retryableSubmission = restoreStudentSubmissionState(
                pendingAnswer.submissionType,
                pendingAnswer.id,
                "retryable_error"
              );
              studentSubmissionRef.current = retryableSubmission;
              setStudentSubmission(retryableSubmission);
              break;
            }
            continue;
          }

          const nextAttemptCount = pendingAnswer.attemptCount + 1;
          const retryDelayMs =
            getStudentSubmissionRetryDelayMs(nextAttemptCount);
          updatePendingLocalAnswer(pendingAnswer.id, (current) => ({
            ...current,
            status: "awaiting_confirmation",
            attemptCount: nextAttemptCount,
            nextRetryAtMs: Date.now() + retryDelayMs,
          }));
          schedulePendingAnswerReplay(retryDelayMs);
          captureStudentSubmissionIssue(
            "student_answer_queue_replay_failed",
            pendingAnswer.id,
            {
              submissionType: pendingAnswer.submissionType,
              stage: "replay",
              result: "retryable",
            }
          );
          break;
        } catch {
          const isOffline =
            typeof navigator !== "undefined" && navigator.onLine === false;
          const nextAttemptCount = pendingAnswer.attemptCount + 1;
          const retryDelayMs =
            getStudentSubmissionRetryDelayMs(nextAttemptCount);
          updatePendingLocalAnswer(pendingAnswer.id, (current) => ({
            ...current,
            status: isOffline
              ? "queued_offline"
              : "awaiting_confirmation",
            attemptCount: nextAttemptCount,
            nextRetryAtMs: isOffline ? null : Date.now() + retryDelayMs,
          }));
          if (!isOffline) {
            schedulePendingAnswerReplay(retryDelayMs);
          }
          captureStudentSubmissionIssue(
            "student_answer_queue_replay_failed",
            pendingAnswer.id,
            {
              submissionType: pendingAnswer.submissionType,
              stage: "replay",
              result: isOffline ? "unknown" : "retryable",
            }
          );
          break;
        } finally {
          clearTimeout(timeoutId);
        }
      }
    } finally {
      pendingAnswerReplayInFlightRef.current = false;
    }
  }, [
    applyStudentSubmissionEvent,
    captureStudentSubmissionIssue,
    currentPostIndex,
    participantId,
    markBurnedPostIndex,
    markSolvedPostIndex,
    reconcileAuthoritativeAnswerProgress,
    removePendingLocalAnswer,
    removeBurnedPostIndex,
    removeSolvedPostIndex,
    schedulePendingAnswerReplay,
    sendStandardAnswerOperation,
    sessionId,
    showResumeNotice,
    updatePendingLocalAnswer,
  ]);

  pendingAnswerReplayRunnerRef.current = () => {
    void replayPendingLocalAnswers();
  };

  useEffect(() => {
    if (
      !sessionId ||
      !participantId ||
      isRestoringParticipant ||
      !hasRestoredRef.current ||
      pendingLocalAnswersRef.current.length === 0
    ) {
      return;
    }

    void replayPendingLocalAnswers();
  }, [
    isRestoringParticipant,
    participantId,
    replayPendingLocalAnswers,
    sessionId,
  ]);

  useEffect(() => {
    if (!sessionId || !participantId) {
      return;
    }

    const handleOnline = () => {
      if (pendingAnswerReplayTimerRef.current) {
        clearTimeout(pendingAnswerReplayTimerRef.current);
        pendingAnswerReplayTimerRef.current = null;
      }
      void replayPendingLocalAnswers();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      if (pendingAnswerReplayTimerRef.current) {
        clearTimeout(pendingAnswerReplayTimerRef.current);
        pendingAnswerReplayTimerRef.current = null;
      }
    };
  }, [participantId, replayPendingLocalAnswers, sessionId]);

  const escapeCodeByPostIndex = new Map(
    collectedEscapeRewards.map((entry) => [entry.postIndex, entry.brick] as const)
  );
  const escapeCodeOverview = isEscapeRace
    ? questions.map((_, index) => escapeCodeByPostIndex.get(index) ?? "_")
    : [];
  const escapeCodeOverviewText = escapeCodeOverview.join(" ");
  const shouldKeepScreenAwake =
    !isLoading &&
    !isRestoringParticipant &&
    !loadError &&
    !isFinished &&
    !isKicked &&
    hasConfirmedName &&
    hasCompletedAvatarGate &&
    (questions.length > 0 || isStrategoRace);
  const targetVisualRadius =
    autoUnlockRadius !== null ? Math.max(autoUnlockRadius, TARGET_VISUAL_RADIUS_METERS) : null;
  const manualUnlockBufferRadius =
    autoUnlockRadius !== null ? autoUnlockRadius + TARGET_CLICK_BUFFER_METERS : null;
  const currentPostIsHardLocked =
    answeredPostIndexesRef.current.includes(currentPostIndex) ||
    burnedPostsRef.current.has(currentPostIndex);
  const canOpenCurrentPostFromDistance =
    !showQuestion &&
    !currentPostIsHardLocked &&
    !isTeacherGuided &&
    distance !== null &&
    manualUnlockBufferRadius !== null &&
    distance <= manualUnlockBufferRadius;
  const canOpenCurrentPost =
    !showQuestion &&
    !currentPostIsHardLocked &&
    !isTeacherGuided &&
    (gpsOverride ||
      dismissedPostIndex === currentPostIndex ||
      canOpenCurrentPostFromDistance);
  const canManualUnlock =
    !showQuestion &&
    !currentPostIsHardLocked &&
    !isTeacherGuided &&
    (gpsOverride ||
      dismissedPostIndex === currentPostIndex ||
      canOpenCurrentPostFromDistance);

  const clearTypedAnswerError = useCallback(() => {
    setTypedAnswerError(null);
  }, []);

  const clearPostActionError = useCallback(() => {
    setPostActionError(null);
  }, []);

  const markAnsweredPostIndex = useCallback((postIndex: number) => {
    if (!Number.isInteger(postIndex) || postIndex < 0) {
      return;
    }

    if (answeredPostIndexesRef.current.includes(postIndex)) {
      return;
    }

    const nextAnsweredPostIndexes = sortUniquePostIndexes([
      ...answeredPostIndexesRef.current,
      postIndex,
    ]);
    answeredPostIndexesRef.current = nextAnsweredPostIndexes;
    setAnsweredPostIndexes(nextAnsweredPostIndexes);
  }, []);

  const unlockCurrentPost = useCallback(() => {
    const isCurrentPostAnswered = answeredPostIndexesRef.current.includes(currentPostIndex);
    const currentPostIsHardLocked =
      isCurrentPostAnswered || burnedPostsRef.current.has(currentPostIndex);
    const canOpenPost =
      !showQuestion &&
      !currentPostIsHardLocked &&
      !isTeacherGuided &&
      (gpsOverride ||
        dismissedPostIndex === currentPostIndex ||
        (distance !== null &&
          manualUnlockBufferRadius !== null &&
          distance <= manualUnlockBufferRadius));

    if (!canOpenPost) {
      if (raceMode === "zone_krig") {
        const message = currentPostIsHardLocked
          ? "Dit forsøg på denne zone er brugt. En anden spiller på holdet kan angribe en zone senere."
          : showQuestion
            ? "Zone-spørgsmålet er allerede åbent."
            : isTeacherGuided
              ? "Zonen kan ikke åbnes, mens læreren styrer spillet."
              : "Zonen kan ikke åbnes endnu. Gå tættere på den valgte zone.";
        setPostActionError({ key: activeTypedAnswerKey, message });
      }
      return;
    }

    setIsClosing(false);
    clearRoleplayInputErrorTone();
    setDismissedPostIndex(null);
    setPhotoFeedback(null);
    setPostActionError(null);
    setQuizAnswerFeedback(null);
    setZoneKrigCaptureFeedback(null);
    setEscapeReward(null);
    setRoleplayReply(null);
    if (wrongAnswerFeedbackTimerRef.current) {
      clearTimeout(wrongAnswerFeedbackTimerRef.current);
      wrongAnswerFeedbackTimerRef.current = null;
    }
    setWrongAnswerFeedback(null);
    setShowQuestion(true);
  }, [
    activeTypedAnswerKey,
    currentPostIndex,
    dismissedPostIndex,
    distance,
    gpsOverride,
    isTeacherGuided,
    raceMode,
    showQuestion,
    manualUnlockBufferRadius,
    clearRoleplayInputErrorTone,
  ]);

  const dismissCurrentPost = useCallback(() => {
    clearRoleplayInputErrorTone();
    setPhotoFeedback(null);
    setPostActionError(null);
    setQuizAnswerFeedback(null);
    setZoneKrigCaptureFeedback(null);
    setTypedAnswerError(null);
    setShowQuestion(false);
    setDismissedPostIndex(currentPostIndex);
  }, [clearRoleplayInputErrorTone, currentPostIndex]);

  const syncParticipantLocation = useCallback(
    async (lat: number, lng: number, accuracy: number | null) => {
      if (!sessionId || !participantId || circuitBreakerActive) return;

      if (locationSyncSuspendedRef.current) {
        if (
          !locationSyncRecoveryCheckInFlightRef.current &&
          Date.now() >= locationSyncRecoveryCheckCooldownUntilRef.current
        ) {
          locationSyncRecoveryCheckCooldownUntilRef.current =
            Date.now() + LOCATION_SYNC_RECOVERY_CHECK_COOLDOWN_MS;
          void runAuthoritativeLocationSyncCheck();
        }
        return;
      }

      try {
        const response = await fetch("/api/play/location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            sessionId,
            participantId,
            lat,
            lng,
            accuracy,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;

          if (response.status === 404) {
            const nextLocationSyncErrors = locationSyncErrorsRef.current + 1;
            locationSyncErrorsRef.current = nextLocationSyncErrors;
            setLocationSyncErrors(nextLocationSyncErrors);

            if (nextLocationSyncErrors >= LOCATION_SYNC_404_STRIKE_LIMIT) {
              locationSyncSuspendedRef.current = true;
              locationSyncRecoveryCheckCooldownUntilRef.current =
                Date.now() + LOCATION_SYNC_RECOVERY_CHECK_COOLDOWN_MS;
              void runAuthoritativeLocationSyncCheck();
            }
          }

          if (response.status === 401) {
            // JWT may have expired — attempt a silent refresh so the next sync succeeds
            void authWithLockRetry(() => supabase.auth.refreshSession(), "GameState.backgroundRefresh").catch(() => undefined);
            sendTelemetry("auth_error", {
              participant_id: participantId,
              session_id: sessionId,
              message: "401 on location sync — triggering JWT refresh",
            });
          }

          console.error("Kunne ikke opdatere deltagerposition:", payload?.error ?? response.statusText);
          return;
        }

        resetLocationSyncRecovery();

        const payload = (await response.json().catch(() => null)) as
          | { participantId?: string | null }
          | null;

        if (typeof payload?.participantId === "string" && payload.participantId) {
          rememberActiveParticipant(payload.participantId, playerName.trim() || pendingPlayerName.trim());
        }
      } catch (error) {
        console.error("Kunne ikke synkronisere deltagerposition:", error);
      }
    },
    [
      circuitBreakerActive,
      participantId,
      pendingPlayerName,
      playerName,
      rememberActiveParticipant,
      resetLocationSyncRecovery,
      runAuthoritativeLocationSyncCheck,
      sessionId,
      supabase,
    ]
  );

  useEffect(() => {
    if (!sessionId || !participantId) return;

    const clearServerLocation = () => {
      void fetch("/api/play/location", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        keepalive: true,
        body: JSON.stringify({ sessionId, participantId }),
      }).catch(() => undefined);
    };

    window.addEventListener("pagehide", clearServerLocation);
    return () => {
      window.removeEventListener("pagehide", clearServerLocation);
      clearServerLocation();
    };
  }, [participantId, sessionId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (resumeMessageTimerRef.current) {
        clearTimeout(resumeMessageTimerRef.current);
      }
      if (quizAnswerFeedbackTimerRef.current) {
        clearTimeout(quizAnswerFeedbackTimerRef.current);
      }
      if (vm26GoalFeedbackTimerRef.current) {
        clearTimeout(vm26GoalFeedbackTimerRef.current);
      }
      if (wrongAnswerFeedbackTimerRef.current) {
        clearTimeout(wrongAnswerFeedbackTimerRef.current);
      }
      if (roleplayInputErrorTimerRef.current) {
        clearTimeout(roleplayInputErrorTimerRef.current);
      }
      if (masterVictoryTimerRef.current) {
        clearTimeout(masterVictoryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !sessionId ||
      !participantId ||
      circuitBreakerActive ||
      restoreInFlightRef.current ||
      isRestoringParticipant ||
      (questions.length === 0 && !isStrategoRace) ||
      hasRestoredRef.current
    ) {
      return;
    }

    let isActive = true;
    restoreInFlightRef.current = true;
    setIsRestoringParticipant(true);
    clearRestoreRetryTimer();

    const restoreFromStorage = async () => {
      try {
        const storedProgressSnapshot = getStoredPlaySnapshotForParticipant(participantId);
        const restoredBurnedPosts = new Set<number>(storedProgressSnapshot?.burnedPosts ?? []);
        burnedPostsRef.current = restoredBurnedPosts;
        setBurnedPosts(new Set(restoredBurnedPosts));
        const storedPendingAnswers =
          storedProgressSnapshot?.pendingAnswers ?? pendingLocalAnswersRef.current;
        const scopedStoredPendingAnswers = storedPendingAnswers.filter(
          (pendingAnswer) =>
            pendingAnswer.sessionId === sessionId &&
            pendingAnswer.participantId === participantId
        );
        if (scopedStoredPendingAnswers.length !== storedPendingAnswers.length) {
          pendingLocalAnswersRef.current = scopedStoredPendingAnswers;
          setPendingLocalAnswers(scopedStoredPendingAnswers);
          savePendingAnswersForStoredPlaySnapshot(
            sessionId,
            participantId,
            scopedStoredPendingAnswers
          );
        }
        const storedName = storedParticipantOnLoad?.studentName?.trim() || playerName || initialStudentName;
        const storedStartOffset = storedParticipantOnLoad?.startOffset ?? 0;
        if (storedName) {
          setPlayerName(storedName);
          setPendingPlayerNameState(storedName);
          setHasConfirmedName(true);
          setNameError(null);
          rememberActiveParticipant(participantId, storedName, storedStartOffset);
        }

        const attemptParticipantRestore = async () => {
          return await fetchParticipantSnapshot(participantId);
        };

        let participantData: ParticipantRow | null = null;
        let didResolveParticipant = false;

        const { data, error: participantError } = await attemptParticipantRestore();

        if (!isActive) return;

        if (participantError) {
          if (participantError.status === 401 || participantError.status === 403) {
            return;
          }

          console.error("Kunne ikke genskabe deltagerdata fra participants:", participantError);
          scheduleRestoreRetry();
          return;
        } else {
          didResolveParticipant = true;
          participantData = data ?? null;
        }

      if (didResolveParticipant && !participantData) {
        // Defensive restoration: DB reported "not found" — don't kick immediately.
        // Show a transient notice and retry a few times before concluding the participant
        // has been removed. This avoids false negatives caused by transient visibility delays.
        const maxAttempts = 3;
        const retryDelayMs = 800;
        const timers: ReturnType<typeof setTimeout>[] = [];

        let resolved = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (!isActive) break;

          // wait before retrying (small backoff)
          await new Promise<void>((resolve) => {
            const t = setTimeout(() => resolve(), retryDelayMs * (attempt + 1));
            timers.push(t);
          });

          if (!isActive) break;

          const { data: retryData, error: retryError } = await attemptParticipantRestore();

          if (!isActive) break;

          if (retryError) {
            if (retryError.status === 401 || retryError.status === 403) {
              return;
            }

            console.error("Fejl ved retry af participants-forespørgsel:", retryError);
            // continue retrying on transient errors
            continue;
          }

          if (retryData) {
            // Found participant on a retry — proceed with normal restore flow
            participantData = retryData ?? null;
            resolved = true;
            break;
          }
        }

        // clear any pending timers to avoid leaks
        for (const t of timers) clearTimeout(t);

        if (!resolved) {
          scheduleRestoreRetry();
          return;
        }
      }

      const restoredName =
        typeof participantData?.student_name === "string"
          ? participantData.student_name.trim()
          : "";
      const restoredStartOffset = resolveParticipantStartOffset(
        participantData?.start_offset,
        storedStartOffset
      );
      const restoredRunStartedAtMs =
        toTimestampMs(participantData?.run_started_at) ??
        storedProgressSnapshot?.playStartedAtMs ??
        null;
      const restoredRouteOrder = buildRouteOrder(
        questions.length,
        restoredStartOffset,
        distributedCircularEnabled
      );
      const firstRoutePostIndex = restoredRouteOrder[0] ?? 0;
      setStartOffset(restoredStartOffset);

      if (restoredRunStartedAtMs !== null) {
        setPlayStartedAtMs(restoredRunStartedAtMs);
      }

      const resolvedName = restoredName || storedName;
      if (resolvedName) {
        setPlayerName(resolvedName);
        setPendingPlayerNameState(resolvedName);
        setHasConfirmedName(true);
        setNameError(null);
      }

      if (participantData?.id && resolvedName) {
        rememberActiveParticipant(String(participantData.id), resolvedName, restoredStartOffset);
      }

      const restoredLat = toFiniteNumber(participantData?.lat);
      const restoredLng = toFiniteNumber(participantData?.lng);
      if (restoredLat !== null && restoredLng !== null) {
        setMyLoc({ lat: restoredLat, lng: restoredLng });
      }

      if (participantData?.finished_at) {
        clearStoredPlayRecoveryState();
        setParticipantId(null);
        setIsFinished(true);
        setIsRestoringParticipant(false);
        hasRestoredRef.current = true;
        return;
      }

      if (resolvedName) {
        const baseAnsweredPosts = new Set<number>(storedProgressSnapshot?.answeredPostIndexes ?? []);
        const baseSolvedPosts = new Set<number>(storedProgressSnapshot?.solvedPostIndexes ?? []);
        const baseScore = storedProgressSnapshot?.score ?? 0;
        let nextPostIndex = firstRoutePostIndex;
        let answersData: AnswerProgressRow[] | null = null;
        let answersError: { code?: string; message?: string } | null = null;
        let restoredAnswerRows: AnswerProgressRow[] = [];
        const pendingSolvedPosts = new Set<number>();
        const newlySolvedPosts = new Set<number>();
        const scoreByPostIndex = new Map<number, number>();
        const pendingEscapeRewards: EscapeCodeEntry[] = [];

        for (const pendingAnswer of scopedStoredPendingAnswers) {
          if (!questions[pendingAnswer.solvedPostIndex]) continue;
          if (!pendingAnswer.hasLocalProgress) continue;
          if (
            usesStandardStudentLocationExperience &&
            isTerminalPendingAnswer(pendingAnswer)
          ) {
            continue;
          }

          baseAnsweredPosts.add(pendingAnswer.solvedPostIndex);
          if (
            pendingAnswer.isCorrect &&
            !baseSolvedPosts.has(pendingAnswer.solvedPostIndex)
          ) {
            pendingSolvedPosts.add(pendingAnswer.solvedPostIndex);
            newlySolvedPosts.add(pendingAnswer.solvedPostIndex);
          }
          if (
            pendingAnswer.isCorrect &&
            !scoreByPostIndex.has(pendingAnswer.solvedPostIndex)
          ) {
            scoreByPostIndex.set(
              pendingAnswer.solvedPostIndex,
              Math.max(0, Math.round(pendingAnswer.awardedPoints))
            );
          }

          const pendingQuestion = questions[pendingAnswer.solvedPostIndex];
          if (
            pendingAnswer.isCorrect &&
            resolvePostVariant(raceMode, pendingQuestion) === "escape"
          ) {
            pendingEscapeRewards.push({
              postIndex: pendingAnswer.solvedPostIndex,
              brick: getEscapeCodeBrick(pendingQuestion, pendingAnswer.solvedPostIndex),
            });
          }
        }

        const restoredAnswerLookupColumn =
          usesStandardStudentLocationExperience && participantId
          ? "participant_id"
          : "student_name";
        const restoredAnswerLookupValue =
          usesStandardStudentLocationExperience && participantId
            ? participantId
            : resolvedName;

        const answersWithPointsResult = await supabase
          .from("answers")
          .select("post_index,question_index,is_correct,awarded_points,student_name")
          .eq("session_id", sessionId)
          .eq(restoredAnswerLookupColumn, restoredAnswerLookupValue);

        if (answersWithPointsResult.error && isMissingColumnError(answersWithPointsResult.error)) {
          const fallbackAnswersResult = await supabase
            .from("answers")
            .select("post_index,question_index,is_correct,student_name")
            .eq("session_id", sessionId)
            .eq(restoredAnswerLookupColumn, restoredAnswerLookupValue);

          answersData = (fallbackAnswersResult.data as AnswerProgressRow[] | null) ?? null;
          answersError = fallbackAnswersResult.error;
        } else {
          answersData = (answersWithPointsResult.data as AnswerProgressRow[] | null) ?? null;
          answersError = answersWithPointsResult.error;
        }

        if (!isActive) return;

        if (answersError) {
          if (answersError.code === "PGRST205") {
            answersTableMissingRef.current = true;
          } else {
            console.error("Kunde ikke hente deltagerens tidligere svar:", answersError);
          }

          const restoredAnsweredPostIndexes = sortUniquePostIndexes([...baseAnsweredPosts]);
          const restoredSolvedPostIndexes = sortUniquePostIndexes([
            ...baseSolvedPosts,
            ...newlySolvedPosts,
          ]);
          const restoredScore = [...newlySolvedPosts].reduce((total, postIndex) => {
            const awardedPoints = scoreByPostIndex.get(postIndex);
            return total + (awardedPoints ?? questions[postIndex]?.points ?? DEFAULT_QUESTION_POINTS);
          }, 0);

          burnedPostsRef.current = restoredBurnedPosts;
          setBurnedPosts(new Set(restoredBurnedPosts));

          setSolvedPostIndexes(restoredSolvedPostIndexes);
          setCorrectAnswersCount(restoredSolvedPostIndexes.length);
          setScore(baseScore + restoredScore);

          setAnsweredPostIndexes(restoredAnsweredPostIndexes);
          setCollectedEscapeRewards(
            pendingEscapeRewards.sort((a, b) => a.postIndex - b.postIndex)
          );

          nextPostIndex = resolveRestoredPostIndex({
            routeOrder: restoredRouteOrder,
            answeredPostIndexes: restoredAnsweredPostIndexes,
            snapshotCurrentPostIndex: storedProgressSnapshot?.currentPostIndex,
            enforceRouteOrder: distributedCircularEnabled,
          });
        } else if (answersData) {
          restoredAnswerRows = answersData as AnswerProgressRow[];
          const serverConfirmedPostIndexes = new Set<number>();
          const confirmedAnsweredPosts = new Set<number>(
            usesStandardStudentLocationExperience ? [] : baseAnsweredPosts
          );
          const confirmedSolvedPosts = new Set<number>(
            usesStandardStudentLocationExperience ? [] : baseSolvedPosts
          );
          const confirmedBurnedPosts = usesStandardStudentLocationExperience
            ? new Set<number>()
            : restoredBurnedPosts;
          for (const row of restoredAnswerRows) {
            const normalizedPostIndex = getNormalizedAnsweredPostIndex(row);
            if (normalizedPostIndex === null || normalizedPostIndex < 0) continue;
            serverConfirmedPostIndexes.add(normalizedPostIndex);
            confirmedAnsweredPosts.add(normalizedPostIndex);

            if (row.is_correct !== true) {
              confirmedBurnedPosts.add(normalizedPostIndex);
              continue;
            }

            confirmedSolvedPosts.add(normalizedPostIndex);
            if (!baseSolvedPosts.has(normalizedPostIndex)) {
              newlySolvedPosts.add(normalizedPostIndex);
            }

            const storedAwardedPoints = toFiniteNumber(row.awarded_points);
            scoreByPostIndex.set(
              normalizedPostIndex,
              storedAwardedPoints !== null
                ? Math.max(0, Math.round(storedAwardedPoints))
                : questions[normalizedPostIndex]?.points ?? DEFAULT_QUESTION_POINTS
            );
          }

          const confirmedPendingAnswers = scopedStoredPendingAnswers.filter(
            (pendingAnswer) =>
              serverConfirmedPostIndexes.has(pendingAnswer.solvedPostIndex)
          );
          let remainingScopedPendingAnswers =
            confirmedPendingAnswers.length > 0
              ? scopedStoredPendingAnswers.filter(
                  (pendingAnswer) =>
                    !serverConfirmedPostIndexes.has(
                      pendingAnswer.solvedPostIndex
                    )
                )
              : scopedStoredPendingAnswers;
          if (confirmedPendingAnswers.length > 0) {
            pendingLocalAnswersRef.current = remainingScopedPendingAnswers;
            setPendingLocalAnswers(remainingScopedPendingAnswers);
            savePendingAnswersForStoredPlaySnapshot(
              sessionId,
              participantId,
              remainingScopedPendingAnswers
            );

            const activeConfirmedPending = confirmedPendingAnswers.find(
              (pendingAnswer) =>
                pendingAnswer.id ===
                studentSubmissionRef.current.operationId
            );
            if (activeConfirmedPending) {
              const confirmedSubmission = restoreStudentSubmissionState(
                activeConfirmedPending.submissionType,
                activeConfirmedPending.id,
                "confirmed"
              );
              studentSubmissionRef.current = confirmedSubmission;
              setStudentSubmission(confirmedSubmission);
            }
          }

          if (usesStandardStudentLocationExperience) {
            for (const pendingAnswer of remainingScopedPendingAnswers) {
              const pendingPostIndex = pendingAnswer.solvedPostIndex;
              if (
                !pendingAnswer.hasLocalProgress ||
                isTerminalPendingAnswer(pendingAnswer) ||
                !questions[pendingPostIndex] ||
                confirmedAnsweredPosts.has(pendingPostIndex)
              ) {
                continue;
              }

              confirmedAnsweredPosts.add(pendingPostIndex);
              if (pendingAnswer.isCorrect) {
                confirmedSolvedPosts.add(pendingPostIndex);
                scoreByPostIndex.set(
                  pendingPostIndex,
                  Math.max(0, Math.round(pendingAnswer.awardedPoints))
                );
              } else {
                confirmedBurnedPosts.add(pendingPostIndex);
              }
            }
          } else {
            for (const pendingAnsweredPost of pendingSolvedPosts) {
              confirmedAnsweredPosts.add(pendingAnsweredPost);
            }
          }

          const restoredAnsweredPostIndexes = sortUniquePostIndexes([...confirmedAnsweredPosts]);
          if (usesStandardStudentLocationExperience && sessionId && participantId) {
            const authoritativeExpectedPostIndex =
              getNextRoutePostIndex(
                restoredRouteOrder,
                new Set(restoredAnsweredPostIndexes)
              ) ?? null;
            const rescuedPendingAnswers = rescueLegacyRejectedStudentSubmissions(
              remainingScopedPendingAnswers,
              { sessionId, participantId },
              {
                expectedPostIndex: authoritativeExpectedPostIndex,
                answeredPostIndexes: restoredAnsweredPostIndexes,
              }
            );
            if (
              rescuedPendingAnswers.length !== remainingScopedPendingAnswers.length ||
              rescuedPendingAnswers.some(
                (entry, index) =>
                  entry !== remainingScopedPendingAnswers[index]
              )
            ) {
              remainingScopedPendingAnswers = rescuedPendingAnswers;
              pendingLocalAnswersRef.current = rescuedPendingAnswers;
              setPendingLocalAnswers(rescuedPendingAnswers);
              savePendingAnswersForStoredPlaySnapshot(
                sessionId,
                participantId,
                rescuedPendingAnswers
              );
              const rescuedCurrentSubmission = rescuedPendingAnswers.find(
                (entry) =>
                  entry.solvedPostIndex === authoritativeExpectedPostIndex &&
                  !entry.hasLocalProgress
              );
              if (rescuedCurrentSubmission) {
                const restoredSubmission = restoreStudentSubmissionState(
                  rescuedCurrentSubmission.submissionType,
                  rescuedCurrentSubmission.id,
                  rescuedCurrentSubmission.status
                );
                studentSubmissionRef.current = restoredSubmission;
                setStudentSubmission(restoredSubmission);
              }
            }
          }
          const restoredSolvedPostIndexes = usesStandardStudentLocationExperience
            ? sortUniquePostIndexes([...confirmedSolvedPosts])
            : sortUniquePostIndexes([
                ...baseSolvedPosts,
                ...newlySolvedPosts,
              ]);
          const restoredScore = (
            usesStandardStudentLocationExperience
              ? restoredSolvedPostIndexes
              : [...newlySolvedPosts]
          ).reduce((total, postIndex) => {
              const awardedPoints = scoreByPostIndex.get(postIndex);
              return total + (awardedPoints ?? questions[postIndex]?.points ?? DEFAULT_QUESTION_POINTS);
            }, 0);

          burnedPostsRef.current = confirmedBurnedPosts;
          setBurnedPosts(new Set(confirmedBurnedPosts));

          setAnsweredPostIndexes(restoredAnsweredPostIndexes);
          setSolvedPostIndexes(restoredSolvedPostIndexes);
          setCorrectAnswersCount(restoredSolvedPostIndexes.length);
          setScore(
            usesStandardStudentLocationExperience
              ? restoredScore
              : baseScore + restoredScore
          );

          const restoredEscapeRewards = getEscapeCodeEntriesFromRows(restoredAnswerRows, questions);
          const mergedEscapeRewards = [...restoredEscapeRewards];
          for (const pendingReward of pendingEscapeRewards) {
            if (!mergedEscapeRewards.some((entry) => entry.postIndex === pendingReward.postIndex)) {
              mergedEscapeRewards.push(pendingReward);
            }
          }
          setCollectedEscapeRewards(mergedEscapeRewards.sort((a, b) => a.postIndex - b.postIndex));

          const hasCompletedRestore = isEscapeRace
            ? restoredSolvedPostIndexes.length >= questions.length
            : restoredAnsweredPostIndexes.length >= questions.length;
          if (
            usesStandardStudentLocationExperience &&
            hasCompletedRestore &&
            remainingScopedPendingAnswers.length > 0
          ) {
            finalizeAfterPendingAnswersRef.current = true;
          }

          if (
            !isStrategoRace &&
            questions.length > 0 &&
            raceMode !== "zone_krig" &&
            hasCompletedRestore &&
            (!usesStandardStudentLocationExperience ||
              remainingScopedPendingAnswers.length === 0)
          ) {
            setShowQuestion(false);
            setDistanceState(null);
            setEscapeReward(null);
            setRoleplayReply(null);
            setMasterLockStatus("locked");
            setMasterLockError(null);
            setMasterLockInputState("");
            setIsFinished(true);
            showResumeNotice("Dine kode-brikker er gendannet. Master-låsen er klar.");
            setIsRestoringParticipant(false);
            hasRestoredRef.current = true;
            return;
          }

          nextPostIndex = resolveRestoredPostIndex({
            routeOrder: restoredRouteOrder,
            answeredPostIndexes: restoredAnsweredPostIndexes,
            snapshotCurrentPostIndex: storedProgressSnapshot?.currentPostIndex,
            enforceRouteOrder: distributedCircularEnabled,
          });
        } else {
          const restoredAnsweredPostIndexes = sortUniquePostIndexes([...baseAnsweredPosts]);
          const restoredSolvedPostIndexes = sortUniquePostIndexes([
            ...baseSolvedPosts,
            ...newlySolvedPosts,
          ]);
          const restoredScore = [...newlySolvedPosts].reduce((total, postIndex) => {
            const awardedPoints = scoreByPostIndex.get(postIndex);
            return total + (awardedPoints ?? questions[postIndex]?.points ?? DEFAULT_QUESTION_POINTS);
          }, 0);

          burnedPostsRef.current = restoredBurnedPosts;
          setBurnedPosts(new Set(restoredBurnedPosts));

          setAnsweredPostIndexes(restoredAnsweredPostIndexes);
          setSolvedPostIndexes(restoredSolvedPostIndexes);
          setCorrectAnswersCount(restoredSolvedPostIndexes.length);
          setScore(baseScore + restoredScore);
          setCollectedEscapeRewards(
            pendingEscapeRewards.sort((a, b) => a.postIndex - b.postIndex)
          );

          nextPostIndex = resolveRestoredPostIndex({
            routeOrder: restoredRouteOrder,
            answeredPostIndexes: restoredAnsweredPostIndexes,
            snapshotCurrentPostIndex: storedProgressSnapshot?.currentPostIndex,
            enforceRouteOrder: distributedCircularEnabled,
          });
        }

        const restoreTargetQuestion = questions[nextPostIndex];
        const restoredDistanceToNextPost =
          !usesStandardStudentLocationExperience &&
          restoredLat !== null &&
          restoredLng !== null &&
          restoreTargetQuestion &&
          Number.isFinite(restoreTargetQuestion.lat) &&
          Number.isFinite(restoreTargetQuestion.lng)
            ? getDistance(
                restoredLat,
                restoredLng,
                restoreTargetQuestion.lat,
                restoreTargetQuestion.lng
              )
            : null;
        const shouldResumeOpenQuestion =
          storedProgressSnapshot?.showQuestion === true &&
          storedProgressSnapshot.currentPostIndex === nextPostIndex;
        const shouldRestoreDismissedPost =
          storedProgressSnapshot?.dismissedPostIndex === nextPostIndex ? nextPostIndex : null;

        setCurrentPostIndex(nextPostIndex);
        if (shouldResumeOpenQuestion) {
          setDismissedPostIndex(null);
          if (!isTeacherGuided) {
            setShowQuestion(true);
          } else {
            setShowQuestion(false);
          }
          setDistanceState(restoredDistanceToNextPost);
        } else if (
          autoUnlockRadius !== null &&
          restoredDistanceToNextPost !== null &&
          restoredDistanceToNextPost <= autoUnlockRadius
        ) {
          setDismissedPostIndex(null);
          if (!isTeacherGuided) {
            setShowQuestion(true);
          } else {
            setShowQuestion(false);
          }
          setDistanceState(restoredDistanceToNextPost);
        } else {
          setDismissedPostIndex(shouldRestoreDismissedPost);
          setShowQuestion(false);
          setDistanceState(null);
        }
      } else {
        const fallbackPostIndex = resolveRestoredPostIndex({
          routeOrder: restoredRouteOrder,
          answeredPostIndexes: storedProgressSnapshot?.answeredPostIndexes ?? [],
          snapshotCurrentPostIndex: storedProgressSnapshot?.currentPostIndex,
          enforceRouteOrder: distributedCircularEnabled,
        });

        setCurrentPostIndex(fallbackPostIndex);
        setDismissedPostIndex(
          storedProgressSnapshot?.dismissedPostIndex === fallbackPostIndex
            ? fallbackPostIndex
            : null
        );
        setShowQuestion(
          storedProgressSnapshot?.showQuestion === true &&
            storedProgressSnapshot.currentPostIndex === fallbackPostIndex
        );
        setDistanceState(null);
      }

        if (resolvedName) {
          showResumeNotice(`Velkommen tilbage, ${resolvedName}! Genoptager løbet...`);
        }

        clearRestoreRetryTimer();
        restoreRetryCountRef.current = 0;
        setIsRestoringParticipant(false);
        hasRestoredRef.current = true;
      } finally {
        restoreInFlightRef.current = false;
      }
    };

    void restoreFromStorage();

    return () => {
      isActive = false;
    };
  }, [
    distributedCircularEnabled,
    participantId,
    questions.length,
    sessionId,
    usesStandardStudentLocationExperience,
  ]);

  const markParticipantFinished = useCallback(async () => {
    if (!sessionId || !participantId) return false;
    const finishedAt = new Date().toISOString();

    while (isMountedRef.current) {
      const { error } = await supabase
        .from("participants")
        .update({
          finished_at: finishedAt,
          lat: null,
          lng: null,
          accuracy: null,
          last_updated: finishedAt,
        })
        .eq("id", participantId)
        .eq("session_id", sessionId);

      if (!error) {
        clearStoredPlayRecoveryState();
        setParticipantId(null);
        return true;
      }

      if (!isTransientNetworkError(error)) {
        console.error("Kunne ikke gemme målgang i participants:", error);
        return false;
      }

      await waitForNetworkRetry();
    }

    return false;
  }, [
    clearStoredPlayRecoveryState,
    isTransientNetworkError,
    participantId,
    sessionId,
    supabase,
    waitForNetworkRetry,
  ]);

  const finalizeParticipantSilently = useCallback(async () => {
    const didPersist = await markParticipantFinished();

    if (!didPersist) {
      console.error("Målgang kunne ikke synkroniseres. Fortsætter stille i elev-UI.");
      clearStoredPlayRecoveryState();
      if (isMountedRef.current) {
        setParticipantId(null);
      }
    }

    return didPersist;
  }, [clearStoredPlayRecoveryState, markParticipantFinished]);

  finalizeParticipantSilentlyRunnerRef.current = finalizeParticipantSilently;

  const insertAnswerRecord = useCallback(
    async (
      selectedIndex: number,
      isCorrect: boolean,
      postNumber: number,
      questionText: string,
      questionPoints: number,
      lat: number | null,
      lng: number | null,
      options?: {
        forcedAwardedPoints?: number;
        useRobustDelivery?: boolean;
        submissionType?: StudentSubmissionType;
      }
    ): Promise<InsertAnswerResult> => {
      const activeName = playerName.trim();
      const forcedAwardedPoints = options?.forcedAwardedPoints;
      const useRobustDelivery = options?.useRobustDelivery === true;
      const submissionType = options?.submissionType ?? "quiz";
      const shouldForceAwardedPoints = typeof forcedAwardedPoints === "number";
      const resolvedAwardedPoints = shouldForceAwardedPoints
        ? Math.max(0, Math.round(forcedAwardedPoints))
        : isCorrect
          ? questionPoints
          : 0;
      const fallbackResult: InsertAnswerResult = {
        didPersist: false,
        awardedPoints: resolvedAwardedPoints,
        zoneKrigCapture: null,
        deliveryStatus: useRobustDelivery ? "retryable_error" : undefined,
        canProgress: !useRobustDelivery,
      };

      if (!sessionId || !participantId || !activeName) {
        if (useRobustDelivery) {
          captureStudentSubmissionIssue(
            "student_answer_submission_failed",
            null,
            {
              submissionType,
              stage: "submit",
              result: "rejected",
            }
          );
        }
        return fallbackResult;
      }

      const timestamp = new Date().toISOString();
      const generatedPayloads: Record<string, unknown>[] = [
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          post_index: postNumber,
          question_index: postNumber - 1,
          selected_index: selectedIndex,
          answer_index: selectedIndex,
          is_correct: isCorrect,
          awarded_points: resolvedAwardedPoints,
          question_text: questionText,
          lat,
          lng,
          answered_at: timestamp,
          ...(raceMode === "zone_krig" && teamId ? { zone_krig_team_id: teamId } : {}),
        },
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          post_index: postNumber,
          selected_index: selectedIndex,
          is_correct: isCorrect,
          awarded_points: resolvedAwardedPoints,
          answered_at: timestamp,
        },
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          question_index: postNumber - 1,
          answer_index: selectedIndex,
          is_correct: isCorrect,
          awarded_points: resolvedAwardedPoints,
          created_at: timestamp,
        },
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          selected_index: selectedIndex,
          is_correct: isCorrect,
          awarded_points: resolvedAwardedPoints,
        },
      ];
      const existingPendingAnswer = useRobustDelivery
        ? pendingLocalAnswersRef.current.find(
            (entry) =>
              entry.sessionId === sessionId &&
              entry.participantId === participantId &&
              entry.solvedPostIndex === postNumber - 1 &&
              entry.submissionType === submissionType &&
              entry.status !== "confirmed"
          ) ?? null
        : null;
      const pendingAnswerId =
        existingPendingAnswer?.id ?? createStudentSubmissionOperationId();
      const payloads =
        existingPendingAnswer?.payloads.map((payload) => ({ ...payload })) ??
        generatedPayloads;
      const pendingLocalAnswer: StoredPendingAnswer | null =
        useRobustDelivery || isCorrect
          ? {
              id: pendingAnswerId,
              sessionId,
              participantId,
              submissionType,
              status: useRobustDelivery
                ? "awaiting_confirmation"
                : "queued_offline",
              payloads,
              solvedPostIndex: postNumber - 1,
              awardedPoints:
                existingPendingAnswer?.awardedPoints ?? resolvedAwardedPoints,
              isCorrect: existingPendingAnswer?.isCorrect ?? isCorrect,
              hasLocalProgress:
                useRobustDelivery
                  ? existingPendingAnswer?.hasLocalProgress ?? false
                  : true,
              attemptCount: existingPendingAnswer?.attemptCount ?? 0,
              nextRetryAtMs: null,
            }
          : null;

      const didPersistPendingAnswer = pendingLocalAnswer
        ? queuePendingLocalAnswer(pendingLocalAnswer)
        : false;

      if (useRobustDelivery && pendingLocalAnswer) {
        beginStudentSubmission(submissionType, pendingAnswerId);

        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          if (!didPersistPendingAnswer) {
            updatePendingLocalAnswer(pendingAnswerId, (current) => ({
              ...current,
              status: "retryable_error",
              nextRetryAtMs: null,
            }));
            applyStudentSubmissionEvent({ type: "retryable_error" });
            captureStudentSubmissionIssue(
              "student_answer_submission_failed",
              pendingAnswerId,
              {
                submissionType,
                stage: "submit",
                result: "retryable",
              }
            );
            return {
              ...fallbackResult,
              deliveryStatus: "retryable_error",
              operationId: pendingAnswerId,
              canProgress: false,
            };
          }

          const queuedUpdate = updatePendingLocalAnswer(pendingAnswerId, (current) => ({
            ...current,
            status: "queued_offline",
            hasLocalProgress: true,
            nextRetryAtMs: null,
          }));
          if (
            !canProgressStudentSubmission({
              networkState: "offline",
              serverConfirmed: false,
              durablePersistenceSucceeded: queuedUpdate.persisted,
            })
          ) {
            updatePendingLocalAnswer(pendingAnswerId, (current) => ({
              ...current,
              status: "retryable_error",
              hasLocalProgress: false,
              nextRetryAtMs: null,
            }));
            applyStudentSubmissionEvent({ type: "retryable_error" });
            captureStudentSubmissionIssue(
              "student_answer_submission_failed",
              pendingAnswerId,
              {
                submissionType,
                stage: "submit",
                result: "retryable",
              }
            );
            return {
              ...fallbackResult,
              deliveryStatus: "retryable_error",
              operationId: pendingAnswerId,
              canProgress: false,
            };
          }
          applyStudentSubmissionEvent({ type: "queue_offline" });
          return {
            ...fallbackResult,
            deliveryStatus: "queued_offline",
            operationId: pendingAnswerId,
            canProgress: true,
          };
        }
      }

      if (answersTableMissingRef.current) {
        if (useRobustDelivery && pendingLocalAnswer) {
          updatePendingLocalAnswer(pendingAnswerId, (current) => ({
            ...current,
            status: "retryable_error",
          }));
          applyStudentSubmissionEvent({ type: "retryable_error" });
        }
        return fallbackResult;
      }

      if (useRobustDelivery && pendingLocalAnswer) {
        const abortController = new AbortController();
        const timeoutId = setTimeout(
          () => abortController.abort(),
          STANDARD_ANSWER_SUBMISSION_TIMEOUT_MS
        );

        try {
          const { response, body } = await sendStandardAnswerOperation(
            pendingAnswerId,
            payloads,
            abortController.signal
          );
          const responseDisposition = classifyStudentSubmissionResponse(
            response.status,
            body?.code
          );

          if (response.ok && body?.inserted === true) {
            removePendingLocalAnswer(pendingAnswerId);
            applyStudentSubmissionEvent({
              type: "confirm",
              result: body.duplicate === true ? "duplicate" : "stored",
            });

            return {
              didPersist: true,
              awardedPoints: shouldForceAwardedPoints
                ? resolvedAwardedPoints
                : typeof body.awardedPoints === "number" &&
                    Number.isFinite(body.awardedPoints)
                  ? Math.max(0, Math.round(body.awardedPoints))
                  : resolvedAwardedPoints,
              zoneKrigCapture: body.zoneKrigCapture ?? null,
              serverCorrectness: normalizeSubmitAnswerServerCorrectness(
                body.serverCorrectness
              ),
              deliveryStatus: "confirmed",
              operationId: pendingAnswerId,
              canProgress: true,
              duplicate: body.duplicate === true,
            };
          }

          if (responseDisposition === "session_closed") {
            updatePendingLocalAnswer(pendingAnswerId, (current) => ({
              ...current,
              status: "session_closed",
            }));
            applyStudentSubmissionEvent({ type: "close_session" });
            return {
              ...fallbackResult,
              deliveryStatus: "session_closed",
              operationId: pendingAnswerId,
              canProgress: false,
            };
          }

          if (responseDisposition === "reconcile_progress") {
            const reconciliation = reconcileAuthoritativeAnswerProgress(
              pendingLocalAnswer,
              body
            );
            if (reconciliation === "retry_same_operation") {
              return {
                ...fallbackResult,
                deliveryStatus: "retryable_error",
                operationId: pendingAnswerId,
                canProgress: false,
              };
            }
            if (reconciliation === "advance" || reconciliation === "complete") {
              return {
                ...fallbackResult,
                deliveryStatus: "confirmed",
                operationId: pendingAnswerId,
                canProgress: true,
                progressReconciled: true,
              };
            }

            updatePendingLocalAnswer(pendingAnswerId, (current) => ({
              ...current,
              status: "retryable_error",
              nextRetryAtMs: null,
              failureCode: "PROGRESS_RECONCILIATION_INVALID",
            }));
            applyStudentSubmissionEvent({ type: "retryable_error" });
            return {
              ...fallbackResult,
              deliveryStatus: "retryable_error",
              operationId: pendingAnswerId,
              canProgress: false,
            };
          }

          if (responseDisposition === "rejected_for_post") {
            updatePendingLocalAnswer(pendingAnswerId, (current) => ({
              ...current,
              status: "rejected",
              nextRetryAtMs: null,
              failureCode: body?.code || `HTTP_${response.status}`,
            }));
            applyStudentSubmissionEvent({ type: "reject" });
            return {
              ...fallbackResult,
              deliveryStatus: "rejected",
              operationId: pendingAnswerId,
              canProgress: false,
            };
          }

          if (responseDisposition === "recover_auth") {
            updatePendingLocalAnswer(pendingAnswerId, (current) => ({
              ...current,
              status: "retryable_error",
              nextRetryAtMs: null,
              failureCode: "AUTH_RECOVERY_FAILED",
            }));
            applyStudentSubmissionEvent({ type: "retryable_error" });
            return {
              ...fallbackResult,
              deliveryStatus: "retryable_error",
              operationId: pendingAnswerId,
              canProgress: false,
            };
          }

          updatePendingLocalAnswer(pendingAnswerId, (current) => ({
            ...current,
            status: "awaiting_confirmation",
          }));
          applyStudentSubmissionEvent({ type: "response_lost" });
          captureStudentSubmissionIssue(
            "student_answer_confirmation_uncertain",
            pendingAnswerId,
            {
              submissionType,
              stage: "confirm",
              result: "unknown",
            }
          );
          return {
            ...fallbackResult,
            deliveryStatus: "awaiting_confirmation",
            operationId: pendingAnswerId,
            canProgress: false,
          };
        } catch (error) {
          const isOffline =
            typeof navigator !== "undefined" && navigator.onLine === false;
          const isUncertain =
            isOffline ||
            (error instanceof DOMException && error.name === "AbortError") ||
            isTransientNetworkError(error);
          const initialDeliveryStatus: StudentSubmissionStatus = isOffline
            ? "queued_offline"
            : isUncertain
              ? "awaiting_confirmation"
              : "retryable_error";

          const pendingUpdate = updatePendingLocalAnswer(pendingAnswerId, (current) => ({
            ...current,
            status: initialDeliveryStatus,
            hasLocalProgress:
              initialDeliveryStatus === "queued_offline"
                ? true
                : current.hasLocalProgress,
          }));
          const deliveryStatus: StudentSubmissionStatus =
            initialDeliveryStatus === "queued_offline" &&
            !canProgressStudentSubmission({
              networkState: "offline",
              serverConfirmed: false,
              durablePersistenceSucceeded: pendingUpdate.persisted,
            })
              ? "retryable_error"
              : initialDeliveryStatus;
          if (deliveryStatus !== initialDeliveryStatus) {
            updatePendingLocalAnswer(pendingAnswerId, (current) => ({
              ...current,
              status: deliveryStatus,
              hasLocalProgress: false,
            }));
          }
          applyStudentSubmissionEvent(
            deliveryStatus === "queued_offline"
              ? { type: "queue_offline" }
              : deliveryStatus === "awaiting_confirmation"
                ? { type: "response_lost" }
                : { type: "retryable_error" }
          );
          captureStudentSubmissionIssue(
            deliveryStatus === "awaiting_confirmation"
              ? "student_answer_confirmation_uncertain"
              : "student_answer_submission_failed",
            pendingAnswerId,
            {
              submissionType,
              stage:
                deliveryStatus === "awaiting_confirmation"
                  ? "confirm"
                  : "submit",
              result:
                deliveryStatus === "retryable_error" ? "retryable" : "unknown",
            }
          );

          return {
            ...fallbackResult,
            deliveryStatus,
            operationId: pendingAnswerId,
            canProgress: deliveryStatus === "queued_offline",
          };
        } finally {
          clearTimeout(timeoutId);
        }
      }

      let retryCount = 0;
      while (isMountedRef.current && retryCount < 3) {
        try {
          const response = await fetch("/api/play/submit-answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payloads }),
          });

          const body = (await response.json().catch(() => null)) as {
            inserted?: boolean;
            awardedPoints?: number;
            error?: string;
            zoneKrigCapture?: ZoneKrigCaptureApiResult;
            serverCorrectness?: unknown;
          } | null;

          if (!response.ok) {
            console.error("Kunne ikke gemme svar via API:", body?.error ?? response.statusText);
            if (body?.error === "Admin access missing") answersTableMissingRef.current = true;
            return fallbackResult;
          }

          if (body?.inserted === true) {
            if (pendingLocalAnswer) {
              removePendingLocalAnswer(pendingAnswerId);
            }

            try {
              Sentry.addBreadcrumb({
                category: "student_submission",
                message: "student_answer_persisted",
                data: {
                  submission_type: submissionType,
                  network_state: "online",
                  stage: "confirm",
                  result: "duplicate",
                },
              });
            } catch (err) {
              // best-effort
            }

            return {
              didPersist: true,
              awardedPoints: shouldForceAwardedPoints
                ? resolvedAwardedPoints
                : typeof body.awardedPoints === "number" && Number.isFinite(body.awardedPoints)
                  ? Math.max(0, Math.round(body.awardedPoints))
                  : resolvedAwardedPoints,
              zoneKrigCapture: body.zoneKrigCapture ?? null,
              serverCorrectness: normalizeSubmitAnswerServerCorrectness(body.serverCorrectness),
            };
          }

          console.error("API returnerede ikke indsættelse:", body ?? "ukendt svar");
          return fallbackResult;
        } catch (error) {
          if (!isTransientNetworkError(error)) {
            console.error("Kunne ikke kontakte submit-answer API:", error);
            return fallbackResult;
          }

          retryCount++;
          await waitForNetworkRetry();
        }
      }

      return fallbackResult;
    },
    [
      isTransientNetworkError,
      applyStudentSubmissionEvent,
      beginStudentSubmission,
      captureStudentSubmissionIssue,
      participantId,
      playerName,
      raceMode,
      reconcileAuthoritativeAnswerProgress,
      removePendingLocalAnswer,
      sendStandardAnswerOperation,
      sessionId,
      queuePendingLocalAnswer,
      teamId,
      updatePendingLocalAnswer,
      waitForNetworkRetry,
    ]
  );

  useEffect(() => {
    if (!sessionId) return;

    let isActive = true;

    const fetchRun = async () => {
      setIsLoading(true);
      setPlayLoadError("");
      setAutoUnlockRadius(null);

      while (isActive) {
        try {
          const response = await fetch(`/api/play/session?sessionId=${encodeURIComponent(sessionId)}`, {
            cache: "no-store",
          });
          const payload = (await response.json().catch(() => null)) as PlaySessionPayload | null;

          if (!isActive) return;

          if (!response.ok) {
            if (response.status === 404 || response.status === 410) {
              clearStoredActiveParticipant();
              router.push("/join?expired=1");
              return;
            }

            setPlayLoadError(PLAY_LOAD_RETRY_MESSAGE);
            setIsLoading(false);
            return;
          }

          const parsedRadius = toFiniteNumber(payload?.radius);
          if (parsedRadius === null || parsedRadius <= 0) {
            setPlayLoadError(PLAY_SETUP_PENDING_MESSAGE);
            setIsLoading(false);
            return;
          }

          const parsedQuestions = Array.isArray(payload?.questions)
            ? payload.questions.map(parseQuestion).filter((q): q is Question => q !== null)
            : [];
          const nextRaceMode = normalizeRaceMode(payload?.raceType);
          const nextPostOrderMode = normalizePostOrderMode(payload?.postOrderMode);
          const nextTheme = normalizePlayTheme(payload?.theme);

          if (parsedQuestions.length === 0 && nextRaceMode !== "stratego") {
            setPlayLoadError(PLAY_SETUP_PENDING_MESSAGE);
          } else {
            setQuestions(parsedQuestions);
          }

          setRaceMode(nextRaceMode);
          setPostOrderMode(nextPostOrderMode);
          setTheme(nextTheme);
          setAutoUnlockRadius(Math.round(parsedRadius));
          setGpsOverride(Boolean(payload?.gpsOverride));
          setUsesStandardStudentLocationExperience(
            Boolean(payload?.usesStandardStudentLocationExperience)
          );
          setBonusAvailable(Boolean(payload?.bonusAvailable));
          setCorrectAnswersCount(0);
          setScore(0);
          setSolvedPostIndexes([]);
          setAnsweredPostIndexes([]);
          setCollectedEscapeRewards([]);
          setEscapeReward(null);
          setPostActionError(null);
          setDismissedPostIndex(null);
          setBurnedPosts(new Set());
          submissionLockRef.current = false;
          setIsSubmitting(false);
          setIsSubmittingAnswer(false);
          setShowMasterVictory(false);
          setMasterLockStatus("locked");
          setMasterLockError(null);
          setMasterLockInputState("");
          setIsLoading(false);
          return;
        } catch (error) {
          if (!isActive) return;
          if (!isTransientNetworkError(error)) {
            console.error("Kunne ikke hente play-data:", error);
            setPlayLoadError(PLAY_LOAD_RETRY_MESSAGE);
            setIsLoading(false);
            return;
          }

          await waitForNetworkRetry();
        }
      }
    };

    void fetchRun();

    return () => {
      isActive = false;
    };
  }, [isTransientNetworkError, router, sessionId, setPlayLoadError, waitForNetworkRetry]);

  useEffect(() => {
    if (!showEscapeResults || !isEscapeRace || !sessionId || !participantId) return;

    let isActive = true;

    const fetchEscapeResults = async () => {
      setIsLoadingEscapeResults(true);
      setEscapeResultsError(null);

      while (isActive) {
        try {
          const response = await fetch(
            `/api/play/placements?sessionId=${encodeURIComponent(sessionId)}&participantId=${encodeURIComponent(participantId)}`,
            {
              cache: "no-store",
            }
          );
          const payload = (await response.json().catch(() => null)) as
            | { placements?: ParticipantRow[]; error?: string }
            | null;

          if (!isActive) return;

          if (!response.ok) {
            console.error("Kunne ikke hente escape-placeringer:", payload?.error ?? "Ukendt fejl");
            setEscapeResults([]);
            setEscapeResultsError(null);
            setIsLoadingEscapeResults(false);
            return;
          }

          const rows = Array.isArray(payload?.placements) ? payload.placements : [];
          const nextResults = rows
            .filter((row) => typeof row.student_name === "string" && row.student_name.trim().length > 0)
            .map((row, index) => ({
              place: index + 1,
              studentName: row.student_name?.trim() ?? `Deltager ${index + 1}`,
              finishedAt: typeof row.finished_at === "string" ? row.finished_at : null,
            }));

          setEscapeResults(nextResults);
          setIsLoadingEscapeResults(false);
          return;
        } catch (error) {
          if (!isActive) return;
          if (!isTransientNetworkError(error)) {
            console.error("Kunne ikke hente escape-placeringer:", error);
            setEscapeResults([]);
            setEscapeResultsError(null);
            setIsLoadingEscapeResults(false);
            return;
          }

          await waitForNetworkRetry();
        }
      }
    };

    void fetchEscapeResults();

    return () => {
      isActive = false;
    };
  }, [
    isEscapeRace,
    isTransientNetworkError,
    participantId,
    sessionId,
    showEscapeResults,
    waitForNetworkRetry,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const wakeLockApi = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!shouldKeepScreenAwake || !wakeLockApi) {
      const activeSentinel = wakeLockSentinelRef.current;
      wakeLockSentinelRef.current = null;
      if (activeSentinel) {
        void activeSentinel.release().catch(() => undefined);
      }
      return;
    }

    let isDisposed = false;

    const requestWakeLock = async () => {
      if (isDisposed || document.visibilityState !== "visible") return;
      try {
        const existingSentinel = wakeLockSentinelRef.current;
        if (existingSentinel && !existingSentinel.released) return;
        const nextSentinel = await wakeLockApi.request("screen");
        if (isDisposed) {
          void nextSentinel.release().catch(() => undefined);
          return;
        }
        wakeLockSentinelRef.current = nextSentinel;
      } catch (error) {
        console.warn("Wake lock kunne ikke aktiveres:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const activeSentinel = wakeLockSentinelRef.current;
      wakeLockSentinelRef.current = null;
      if (activeSentinel) {
        void activeSentinel.release().catch(() => undefined);
      }
    };
  }, [shouldKeepScreenAwake]);

  useEffect(() => {
    if (!sessionId) {
      setLatestMessage(null);
      return;
    }

    void loadLatestTeacherMessage();
  }, [loadLatestTeacherMessage, sessionId]);

  useEffect(() => {
    if (!sessionId || circuitBreakerActive) return;

    const createSubscription = () => {
      // remove existing channel if present
      if (messageChannelRef.current) {
        void supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }

      const ch = supabase
        .channel(`student-messages-${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "session_messages",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const messageRow = payload.new as SessionTeacherMessageRow;
            if (messageRow.is_teacher && messageRow.message) {
              applyLatestTeacherMessage(messageRow);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "live_sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const nextStatus = (payload.new as { status?: string | null })?.status;
            if (nextStatus !== "finished") return;

            clearRestoreRetryTimer();
            clearStoredPlayRecoveryState();
            setParticipantId(null);
            setShowQuestion(false);
            setIsRestoringParticipant(false);
            setIsFinished(true);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "participants",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const deletedId = (payload.old as { id?: string | number | null })?.id;
            if (!deletedId || !participantId) return;
            if (String(deletedId) !== participantId) return;

            // Delay by 2s to guard against realtime replay false positives after wake-up
            if (kickConfirmTimerRef.current) clearTimeout(kickConfirmTimerRef.current);
            kickConfirmTimerRef.current = setTimeout(() => {
              kickConfirmTimerRef.current = null;
              clearRestoreRetryTimer();
              clearStoredPlayRecoveryState();
              setParticipantId(null);
              setShowQuestion(false);
              setIsRestoringParticipant(false);
              sendTelemetry("session_drop", {
                participant_id: participantId,
                session_id: sessionId,
                message: "realtime DELETE confirmed after 2s delay",
              });
              setIsKicked(true);
            }, 2000);
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            clearMessageResubscribeTimer();
            void loadLatestTeacherMessage();
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            void recoverWakeUpState("message_channel_error");

            if (messageResubscribeTimerRef.current !== null) {
              return;
            }

            messageResubscribeTimerRef.current = setTimeout(() => {
              messageResubscribeTimerRef.current = null;
              createSubscription();
            }, CHANNEL_RESUBSCRIBE_DELAY_MS);
          }
        });

      messageChannelRef.current = ch;
    };

    createSubscription();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void recoverWakeUpState("visibility_resume");
        createSubscription();
      }
    };

    const handleOnline = () => {
      void recoverWakeUpState("online_resume");
      createSubscription();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      clearMessageResubscribeTimer();
      if (kickConfirmTimerRef.current) {
        clearTimeout(kickConfirmTimerRef.current);
        kickConfirmTimerRef.current = null;
      }
      if (messageChannelRef.current) {
        void supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
    };
  }, [
    applyLatestTeacherMessage,
    circuitBreakerActive,
    clearRestoreRetryTimer,
    clearStoredPlayRecoveryState,
    clearMessageResubscribeTimer,
    loadLatestTeacherMessage,
    participantId,
    recoverWakeUpState,
    sessionId,
    supabase,
  ]);

  useEffect(() => {
    if (!sessionId || circuitBreakerActive) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        void recoverWakeUpState("auth_refresh");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [circuitBreakerActive, recoverWakeUpState, sessionId, supabase]);

  const handleWrongQuizAnswer = useCallback((selectedIndex: number, feedbackKey: string) => {
    if (quizAnswerFeedbackTimerRef.current) {
      clearTimeout(quizAnswerFeedbackTimerRef.current);
    }

    setZoneKrigCaptureFeedback(null);
    setQuizAnswerFeedback({
      key: feedbackKey,
      selectedIndex,
      tone: "error",
    });
    quizAnswerFeedbackTimerRef.current = setTimeout(() => {
      setQuizAnswerFeedback((currentFeedback) =>
        currentFeedback?.key === feedbackKey && currentFeedback.tone === "error"
          ? null
          : currentFeedback
      );
      quizAnswerFeedbackTimerRef.current = null;
      }, 1400);
  }, []);

  const requestRoleplayWrongAnswerResponse = useCallback(
    async (payload: {
      characterName: string;
      characterPersonality: string;
      question: string;
      wrongAnswer: string;
      correctAnswer: string;
    }) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, 6000);

      try {
        const response = await fetch("/api/roleplay-response", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(data?.error || "Kunne ikke hente rolle-svaret.");
        }

        const message = data?.message?.trim();
        return message || null;
      } catch (error) {
        console.error("Kunne ikke hente AI-rolle-svar:", error);
        return null;
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    []
  );

  const validateAnswerOnServer = useCallback(
    async (payload: { selectedIndex?: number; answer?: string }) => {
      if (!sessionId || !participantId) {
        throw new Error("Deltageren er ikke klar endnu. Prøv igen om et øjeblik.");
      }

      let retryCount = 0;

      while (isMountedRef.current) {
        // If we are already offline, fail fast instead of spinning
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          throw new Error(OFFLINE_VALIDATION_MESSAGE);
        }

        try {
          const response = await fetch("/api/play/validate-answer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
              sessionId,
              participantId,
              postIndex: currentPostIndex,
              ...payload,
            }),
          });

          const data = (await response.json().catch(() => null)) as ValidateAnswerPayload | null;
          if (!response.ok) {
            throw new Error(data?.error || "Svaret kunne ikke tjekkes.");
          }

          return data;
        } catch (error) {
          if (!isTransientNetworkError(error)) {
            throw error;
          }

          retryCount++;
          if (retryCount >= VALIDATE_ANSWER_MAX_RETRIES) {
            // Give up — throw so the finally block in the caller unlocks the button
            sendTelemetry("answer_submission_max_retries", {
              participant_id: participantId,
              session_id: sessionId,
              message: `postIndex=${currentPostIndex} online=${typeof navigator !== "undefined" ? String(navigator.onLine) : "unknown"}`,
            });
            throw new Error(OFFLINE_VALIDATION_MESSAGE);
          }

          await waitForNetworkRetry();
        }
      }

      return null;
    },
    [currentPostIndex, isTransientNetworkError, participantId, sessionId, waitForNetworkRetry]
  );

  useEffect(() => {
    setWrongAttempts(0);
  }, [currentPostIndex]);

  useEffect(() => {
    const pendingForCurrentPost =
      pendingLocalAnswersRef.current.find(
        (entry) =>
          entry.sessionId === sessionId &&
          entry.participantId === participantId &&
          entry.status === "session_closed"
      ) ??
      pendingLocalAnswersRef.current.find(
        (entry) =>
          entry.sessionId === sessionId &&
          entry.participantId === participantId &&
          entry.solvedPostIndex === currentPostIndex &&
          (isTerminalPendingAnswer(entry) || !entry.hasLocalProgress)
      ) ?? null;
    const nextSubmission = pendingForCurrentPost
      ? restoreStudentSubmissionState(
          pendingForCurrentPost.submissionType,
          pendingForCurrentPost.id,
          pendingForCurrentPost.status === "submitting"
            ? "awaiting_confirmation"
            : pendingForCurrentPost.status
        )
      : createIdleStudentSubmissionState();

    studentSubmissionRef.current = nextSubmission;
    setStudentSubmission(nextSubmission);
  }, [currentPostIndex, participantId, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    try {
      Sentry.addBreadcrumb({
        category: "navigation",
        message: "reach_post",
        data: {
          route_mode: distributedCircularEnabled ? "distributed" : "fixed",
        },
      });
    } catch (err) {
      // best-effort
    }
  }, [currentPostIndex, distributedCircularEnabled, sessionId]);

  const continueFromSolvedPost = async () => {
    clearRoleplayInputErrorTone();
    setPostActionError(null);

    if (raceMode === "zone_krig") {
      setDismissedPostIndex(null);
      setPhotoFeedback(null);
      setQuizAnswerFeedback(null);
      setZoneKrigCaptureFeedback(null);
      setTypedAnswerError(null);
      setEscapeReward(null);
      setRoleplayReply(null);
      setWrongAttempts(0);
      setShowQuestion(false);
      setDistanceState(null);
      return true;
    }

    const nextByLinearStep =
      currentRouteStepIndex + 1 < routeOrder.length ? routeOrder[currentRouteStepIndex + 1] : null;

    const nextRoutePostIndex = (() => {
      if (nextByLinearStep !== null) return nextByLinearStep;

      const answeredSet = new Set(answeredPostIndexesRef.current);

      // Posten er ikke besvaret (fx forkert svar på escape/typed der bare rykker videre).
      // Lineær "færdig" er korrekt her – returnér null.
      if (!answeredSet.has(currentPostIndex)) return null;

      // Posten ER besvaret. Tjek om alle poster i ruten faktisk er besvaret.
      // Hvis ja → ægte færdig. Hvis nej → routeOrder var formentlig forkert (start_offset-bug).
      if (routeOrder.every((idx) => answeredSet.has(idx))) return null;

      // Safety net: lineær step sagde færdig, men ikke alle poster er besvaret.
      // Find næste ubesvarede post i ruten.
      return getNextRoutePostIndex(routeOrder, answeredSet);
    })();

    if (nextRoutePostIndex !== null) {
      setDismissedPostIndex(null);
      setPhotoFeedback(null);
      setQuizAnswerFeedback(null);
      setZoneKrigCaptureFeedback(null);
      setTypedAnswerError(null);
      setEscapeReward(null);
      setRoleplayReply(null);
      setWrongAttempts(0);
      setShowQuestion(false);
      setDistanceState(null);
      setCurrentPostIndex(nextRoutePostIndex);
      return true;
    }

    const hasPendingStandardAnswers =
      usesStandardStudentLocationExperience &&
      pendingLocalAnswersRef.current.some(
        (entry) =>
          entry.sessionId === sessionId &&
          entry.participantId === participantId &&
          entry.status !== "confirmed"
      );
    if (hasPendingStandardAnswers) {
      finalizeAfterPendingAnswersRef.current = true;
      showResumeNotice(
        "Svaret er gemt på telefonen. Det sendes automatisk, når forbindelsen er tilbage."
      );
      return false;
    }

    if (!isEscapeRace) {
      void finalizeParticipantSilently();
    }

    setDismissedPostIndex(null);
    setPhotoFeedback(null);
    setQuizAnswerFeedback(null);
    setZoneKrigCaptureFeedback(null);
    setTypedAnswerError(null);
    setEscapeReward(null);
    setRoleplayReply(null);
    setWrongAttempts(0);
    setShowQuestion(false);
    setDistanceState(null);
    setIsFinished(true);
    return true;
  };

  useEffect(() => {
    if (
      !finalizeAfterPendingAnswersRef.current ||
      pendingLocalAnswers.length > 0
    ) {
      return;
    }

    finalizeAfterPendingAnswersRef.current = false;
    if (!isEscapeRace) {
      void finalizeParticipantSilently();
    }
    setDismissedPostIndex(null);
    setPhotoFeedback(null);
    setQuizAnswerFeedback(null);
    setZoneKrigCaptureFeedback(null);
    setTypedAnswerError(null);
    setEscapeReward(null);
    setRoleplayReply(null);
    setWrongAttempts(0);
    setShowQuestion(false);
    setDistanceState(null);
    setIsFinished(true);
  }, [
    finalizeParticipantSilently,
    isEscapeRace,
    pendingLocalAnswers.length,
  ]);

  const handleAnswer = async (
    selectedIndex: number,
    escapeBrick?: string | null,
    options?: {
      skipAnswerPersist?: boolean;
      awardedPoints?: number;
      zoneKrigCapture?: ZoneKrigCaptureApiResult;
      answerInsertResult?: InsertAnswerResult;
    }
  ) => {
    const current = questions[currentPostIndex];
    if (!current) return false;

    const postNumber = currentPostIndex + 1;
    const currentVariant = resolvePostVariant(raceMode, current);
    const feedbackKey = `${currentPostIndex}-${currentVariant}`;

    if (quizAnswerFeedbackTimerRef.current) {
      clearTimeout(quizAnswerFeedbackTimerRef.current);
      quizAnswerFeedbackTimerRef.current = null;
    }

    setZoneKrigCaptureFeedback(null);
    setTypedAnswerError(null);
    setPostActionError(null);
    const isBurnedQuizPost = currentVariant === "quiz" && burnedPostsRef.current.has(currentPostIndex);
    const usesRobustStandardDelivery =
      usesStandardStudentLocationExperience && currentVariant === "quiz";
    const wasAlreadySolved =
      solvedPostIndexesRef.current.includes(currentPostIndex);
    const expectedPoints =
      options?.awardedPoints ?? (isBurnedQuizPost ? 0 : current.points);

    // Legacy- og specialflows beholder deres eksisterende optimistiske adfærd.
    if (
      !usesRobustStandardDelivery &&
      currentVariant === "quiz" &&
      raceMode !== "zone_krig"
    ) {
      setQuizAnswerFeedback({ key: feedbackKey, selectedIndex, tone: "success" });
    }

    if (!usesRobustStandardDelivery) {
      markAnsweredPostIndex(currentPostIndex);

      if (!wasAlreadySolved) {
        setSolvedPostIndexes((prev) => [...prev, currentPostIndex].sort((a, b) => a - b));
        setCorrectAnswersCount((prev) => prev + 1);
        setScore((prev) => prev + expectedPoints);
      }
    }

    const answerInsertResult: InsertAnswerResult =
      options?.answerInsertResult ??
      (options?.skipAnswerPersist
        ? {
            didPersist: true,
            awardedPoints: expectedPoints,
            zoneKrigCapture: options.zoneKrigCapture ?? null,
          }
        : await insertAnswerRecord(
          selectedIndex,
          true,
          postNumber,
          currentVariant === "roleplay" ? getRoleplayMessage(current) : current.text,
          current.points,
          myLoc?.lat ?? null,
          myLoc?.lng ?? null,
          {
            ...(isBurnedQuizPost ? { forcedAwardedPoints: 0 } : {}),
            ...(usesRobustStandardDelivery
              ? {
                  useRobustDelivery: true,
                  submissionType: "quiz" as const,
                }
              : {}),
          }
          ));

    if (
      usesRobustStandardDelivery &&
      answerInsertResult.progressReconciled === true
    ) {
      return true;
    }

    if (
      usesRobustStandardDelivery &&
      answerInsertResult.canProgress !== true
    ) {
      setPostActionError({
        key: activeTypedAnswerKey,
        message:
          answerInsertResult.deliveryStatus === "session_closed"
            ? "Løbet er afsluttet. Svaret kan ikke længere afleveres."
            : "Svaret kunne ikke sendes endnu.",
      });
      return false;
    }

    if (usesRobustStandardDelivery) {
      setQuizAnswerFeedback({
        key: feedbackKey,
        selectedIndex,
        tone: "success",
      });
      markAnsweredPostIndex(currentPostIndex);

      if (!wasAlreadySolved) {
        markSolvedPostIndex(currentPostIndex);
        setCorrectAnswersCount((prev) => prev + 1);
        setScore((prev) => prev + answerInsertResult.awardedPoints);
      }

      markPendingAnswerLocallyProgressed(answerInsertResult.operationId);
    } else if (
      !wasAlreadySolved &&
      answerInsertResult.awardedPoints !== expectedPoints
    ) {
      setScore(
        (prev) =>
          prev - expectedPoints + answerInsertResult.awardedPoints
      );
    }

    if (
      currentVariant === "quiz" &&
      raceMode !== "zone_krig" &&
      raceMode !== "stratego" &&
      raceMode !== "escape" &&
      theme?.vm26?.enabled === true &&
      answerInsertResult.didPersist &&
      answerInsertResult.serverCorrectness?.checked === true &&
      answerInsertResult.serverCorrectness.isCorrect === true
    ) {
      triggerVm26GoalFeedback();
    }

    if (currentVariant === "escape") {
      const codeBrick = escapeBrick?.trim() || getEscapeCodeBrick(current, currentPostIndex);
      setCollectedEscapeRewards((prev) =>
        prev.some((entry) => entry.postIndex === currentPostIndex)
          ? prev
          : [...prev, { postIndex: currentPostIndex, brick: codeBrick }].sort(
              (a, b) => a.postIndex - b.postIndex
            )
      );
      setEscapeReward({
        key: `${currentPostIndex}-escape`,
        brick: codeBrick,
      });
      return true;
    }

    if (currentVariant === "quiz") {
      if (raceMode === "zone_krig") {
        setZoneKrigCaptureFeedback(buildZoneKrigCaptureFeedback(answerInsertResult.zoneKrigCapture, feedbackKey));
        // Nu hvor vi har serverens svar, kan vi vise success-knappen
        setQuizAnswerFeedback({ key: feedbackKey, selectedIndex, tone: "success" });
      }
      return true;
    }

    if (currentVariant === "photo") {
      return true;
    }

    if (currentVariant === "roleplay") {
      const characterName = getRoleplayCharacterName(current);
      setRoleplayReply({
        key: `${currentPostIndex}-roleplay`,
        message: `${characterName}: Godt svaret! Følg med mig videre...`,
        tone: "success",
        canContinue: true,
      });
      return true;
    }

    return continueFromSolvedPost();
  };

  const setPendingPlayerName = useCallback((value: string) => {
    setPendingPlayerNameState(value);
    setNameError(null);
  }, []);

  const setPendingAvatarUrl = useCallback((value: string | null) => {
    setPendingAvatarUrlState(value ?? undefined);
  }, []);

  const selectPostIndex = useCallback(
    (index: number) => {
      if (!Number.isInteger(index) || index < 0 || index >= questions.length) {
        return;
      }

      clearRoleplayInputErrorTone();
      setCurrentPostIndex(index);
      setShowQuestion(false);
      setDismissedPostIndex(null);
      setPhotoFeedback(null);
      setPostActionError(null);
      setQuizAnswerFeedback(null);
      setZoneKrigCaptureFeedback(null);
      setTypedAnswerError(null);
      setEscapeReward(null);
      setRoleplayReply(null);
      setWrongAttempts(0);
      setDistanceState(null);
    },
    [clearRoleplayInputErrorTone, questions.length]
  );

  const setMasterLockInput = useCallback((value: string) => {
    setMasterLockInputState(value);
    setMasterLockError(null);
  }, []);

  const setShowEscapeResults = useCallback((value: boolean) => {
    setShowEscapeResultsState(value);
  }, []);

  const clearDismissedPost = useCallback(() => {
    setDismissedPostIndex(null);
  }, []);

  const retryRestoreConnection = useCallback(() => {
    if (!sessionId || !participantId) {
      return;
    }

    clearRestoreRetryTimer();
    restoreRetryCountRef.current = 0;
    setPlayLoadError("");
    setIsRestoringParticipant(true);
    setRestoreRetryNonce((current) => current + 1);
  }, [clearRestoreRetryTimer, participantId, sessionId, setPlayLoadError]);

  const confirmName = useCallback(
    (name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        setNameError("Skriv dit eller jeres rigtige navn for at starte.");
        return;
      }

      if (containsBadWord(trimmedName)) {
        setNameError("Hov! Hold en god tone. Skriv jeres rigtige navne for at være med.");
        return;
      }

      if (trimmedName.length > MAX_PLAYER_NAME_LENGTH) {
        setNameError(`Navnet må højst være ${MAX_PLAYER_NAME_LENGTH} tegn langt.`);
        return;
      }

      setNameError(null);
      setPendingPlayerNameState(trimmedName);
      setPlayerName(trimmedName);
      setHasCompletedAvatarGate(false);

      if (participantId) {
        setHasConfirmedName(true);
        rememberActiveParticipant(
          participantId,
          trimmedName,
          undefined,
          undefined,
          undefined,
          undefined,
          sessionStatus
        );
        return;
      }

      void registerParticipantIdentity(trimmedName);
    },
    [
      participantId,
      registerParticipantIdentity,
      rememberActiveParticipant,
      sessionStatus,
    ]
  );

  const completeAvatarSetup = useCallback(
    (skip: boolean) => {
      const resolvedAvatarUrl = skip ? undefined : pendingAvatarUrl ?? avatarUrl;
      const resolvedPlayerName = (playerName || pendingPlayerName).trim();

      setAvatarUrl(resolvedAvatarUrl);
      setPendingAvatarUrlState(undefined);
      setHasCompletedAvatarGate(true);

      if (participantId && resolvedPlayerName) {
        rememberActiveParticipant(
          participantId,
          resolvedPlayerName,
          undefined,
          undefined,
          undefined,
          resolvedAvatarUrl ?? null,
          sessionStatus
        );
      }
    },
    [avatarUrl, participantId, pendingAvatarUrl, pendingPlayerName, playerName, rememberActiveParticipant, sessionStatus]
  );

  const submitQuizAnswer = async (selectedIndex: number) => {
    if (!activeQuestion || activePostVariant !== "quiz") return;
    if (answeredPostIndexesRef.current.includes(currentPostIndex)) return;
    if (!beginSubmission()) return;

    const feedbackKey = `${currentPostIndex}-quiz`;
    const isCorrect = selectedIndex === activeQuestion.correctIndex;

    try {
      if (usesStandardStudentLocationExperience) {
        const answerInsertResult = await insertAnswerRecord(
          selectedIndex,
          isCorrect,
          currentPostIndex + 1,
          activeQuestion.text,
          activeQuestion.points,
          myLoc?.lat ?? null,
          myLoc?.lng ?? null,
          {
            useRobustDelivery: true,
            submissionType: "quiz",
          }
        );

        if (answerInsertResult.progressReconciled === true) {
          return;
        }

        if (answerInsertResult.canProgress !== true) {
          setPostActionError({
            key: activeTypedAnswerKey,
            message:
              answerInsertResult.deliveryStatus === "session_closed"
                ? "Løbet er afsluttet. Svaret kan ikke længere afleveres."
                : "Svaret kunne ikke sendes endnu.",
          });
          return;
        }

        const resolvedIsCorrect =
          answerInsertResult.didPersist &&
          answerInsertResult.serverCorrectness?.checked === true
            ? answerInsertResult.serverCorrectness.isCorrect
            : isCorrect;

        if (resolvedIsCorrect) {
          await handleAnswer(selectedIndex, null, {
            awardedPoints: answerInsertResult.awardedPoints,
            answerInsertResult,
          });
          return;
        }

        handleWrongQuizAnswer(selectedIndex, feedbackKey);
        await new Promise<void>((resolve) => setTimeout(resolve, 1400));
        if (!isMountedRef.current) return;
        markAnsweredPostIndex(currentPostIndex);
        markPendingAnswerLocallyProgressed(answerInsertResult.operationId);
        await continueFromSolvedPost();
        return;
      }

      if (isCorrect) {
        await handleAnswer(selectedIndex, null);
      } else {
        handleWrongQuizAnswer(selectedIndex, feedbackKey);

        // Specialflows beholder deres eksisterende fire-and-forget-adfærd.
        void insertAnswerRecord(
          selectedIndex,
          false,
          currentPostIndex + 1,
          activeQuestion.text,
          activeQuestion.points,
          myLoc?.lat ?? null,
          myLoc?.lng ?? null
        );

        // Vent på at fejl-feedback er vist, marker posten som besvaret og ryk videre
        await new Promise<void>((resolve) => setTimeout(resolve, 1400));
        if (!isMountedRef.current) return;
        markAnsweredPostIndex(currentPostIndex);
        await continueFromSolvedPost();
      }
    } finally {
      endSubmission();
    }
  };

  const submitMasterCode = async (code: string) => {
    if (isSubmitting || submissionLockRef.current) return;

    const normalizedInput = normalizeMasterCode(code);
    if (!normalizedInput) {
      setMasterLockError("Indtast master-koden fra dine kode-brikker først.");
      setMasterLockShakeNonce((prev) => prev + 1);
      return;
    }

    if (!beginSubmission()) return;

    setMasterLockError(null);
    setShowMasterVictory(false);
    setIsFinalizingEscape(true);

    try {
      let payload:
        | {
            isCorrect?: boolean;
            error?: string;
          }
        | null = null;

      while (isMountedRef.current) {
        try {
          const response = await fetch("/api/play/validate-master", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
              sessionId,
              masterCode: normalizedInput,
            }),
          });
          payload = (await response.json().catch(() => null)) as
            | { isCorrect?: boolean; error?: string }
            | null;

          if (!response.ok) {
            throw new Error(payload?.error || "Master-koden kunne ikke tjekkes.");
          }

          break;
        } catch (error) {
          if (!isTransientNetworkError(error)) {
            throw error;
          }

          await waitForNetworkRetry();
        }
      }

      if (!isMountedRef.current) return;

      if (payload?.isCorrect !== true) {
        setMasterLockError("Forkert kode - prøv igen.");
        setMasterLockStatus("locked");
        setMasterLockShakeNonce((prev) => prev + 1);
        return;
      }

      void finalizeParticipantSilently();
      setMasterLockStatus("unlocked");
      setMasterLockError(null);
      setShowMasterVictory(true);
      if (masterVictoryTimerRef.current) {
        clearTimeout(masterVictoryTimerRef.current);
      }
      masterVictoryTimerRef.current = setTimeout(() => {
        setShowEscapeResultsState(true);
        masterVictoryTimerRef.current = null;
      }, 2200);
    } catch (error) {
      console.error("Master-lås kunne ikke valideres:", error);
      void finalizeParticipantSilently();
      if (!isMountedRef.current) return;
      setMasterLockStatus("unlocked");
      setMasterLockError(null);
      setShowMasterVictory(true);
      if (masterVictoryTimerRef.current) {
        clearTimeout(masterVictoryTimerRef.current);
      }
      masterVictoryTimerRef.current = setTimeout(() => {
        setShowEscapeResultsState(true);
        masterVictoryTimerRef.current = null;
      }, 2200);
    } finally {
      setIsFinalizingEscape(false);
      endSubmission();
    }
  };

  const submitTypedAnswer = async (answer: string) => {
    if (!activeQuestion || activePostVariant === "photo" || activePostVariant === "quiz") return;
    if (answeredPostIndexesRef.current.includes(currentPostIndex)) return;
    if (isSubmitting || submissionLockRef.current) return;

    if (!answer.trim()) {
      setTypedAnswerError(
        activePostVariant === "roleplay"
          ? { key: activeTypedAnswerKey, message: "Skriv et svar til karakteren først." }
          : activePostVariant === "escape"
            ? { key: activeTypedAnswerKey, message: "Skriv svaret først." }
            : { key: activeTypedAnswerKey, message: "Indtast svaret, før du bekræfter." }
      );
      return;
    }

    if (!beginSubmission()) return;

    setTypedAnswerError(null);
    setPostActionError(null);
    if (activePostVariant === "roleplay") {
      setRoleplayReply(null);
    }

    if (activePostVariant === "escape") {
      setIsCheckingEscapeAnswer(true);
    } else {
      setIsSubmittingAnswer(true);
    }

    try {
      const payload = await validateAnswerOnServer({ answer });

      if (payload?.isLocked === true) {
        markAnsweredPostIndex(currentPostIndex);
        return;
      }

      if (payload?.isCorrect !== true) {
        markAnsweredPostIndex(currentPostIndex);

        await insertAnswerRecord(
          0,
          false,
          currentPostIndex + 1,
          activePostVariant === "roleplay" ? getRoleplayMessage(activeQuestion) : activeQuestion.text,
          activeQuestion.points,
          myLoc?.lat ?? null,
          myLoc?.lng ?? null
        );

        if (activePostVariant === "roleplay") {
          // Roleplay: show AI character wrong-answer response, keep overlay open
          triggerRoleplayInputError();
          setRoleplayReply({
            key: activeTypedAnswerKey,
            message: "Tænker...",
            tone: "hint",
            canContinue: false,
            isLoading: true,
          });

          const roleplayMessage = await requestRoleplayWrongAnswerResponse({
            characterName: roleplayCharacterName || "Karakteren",
            characterPersonality: getRoleplayCharacterPersonality(activeQuestion),
            question: getRoleplayMessage(activeQuestion),
            wrongAnswer: answer.trim(),
            correctAnswer: getRoleplayCorrectAnswer(activeQuestion),
          });

          if (roleplayMessage) {
            setRoleplayReply({
              key: activeTypedAnswerKey,
              message: roleplayMessage,
              tone: "hint",
              canContinue: false,
            });
          } else {
            setRoleplayReply(null);
            setTypedAnswerError({
              key: activeTypedAnswerKey,
              message: "Forkert svar, prøv igen",
            });
          }
          return;
        }

        // All other variants (escape, typed): close overlay, show brief feedback, then advance
        setShowQuestion(false);
        setTypedAnswerError(null);
        if (wrongAnswerFeedbackTimerRef.current) {
          clearTimeout(wrongAnswerFeedbackTimerRef.current);
        }
        setWrongAnswerFeedback("Desværre, forkert svar! Du får 0 point.");
        wrongAnswerFeedbackTimerRef.current = setTimeout(() => {
          setWrongAnswerFeedback(null);
          wrongAnswerFeedbackTimerRef.current = null;
        }, 4000);
        await new Promise<void>((resolve) => setTimeout(resolve, 1400));
        if (!isMountedRef.current) return;
        await continueFromSolvedPost();
        return;
      }

      clearRoleplayInputErrorTone();
      if (activePostVariant === "escape") {
        setWrongAttempts(0);
      }
      await handleAnswer(0, payload?.brick ?? null);
    } catch (error) {
      console.error("Kunne ikke validere svar:", error);
      const msg = getAnswerValidationErrorMessage(error);
      setTypedAnswerError({
        key: activeTypedAnswerKey,
        message: msg,
      });
    } finally {
      if (activePostVariant === "escape") {
        setIsCheckingEscapeAnswer(false);
      } else {
        setIsSubmittingAnswer(false);
      }
      endSubmission();
    }
  };

  const submitPhoto = async (file: File, operationId?: string) => {
    if (
      !file ||
      !activeQuestion ||
      activePostVariant !== "photo" ||
      isAnalyzingPhoto ||
      !sessionId ||
      !participantId
    ) {
      return;
    }
    if (answeredPostIndexesRef.current.includes(currentPostIndex)) return;
    if (isSubmitting || submissionLockRef.current) return;
    if (!beginSubmission()) return;
    const isSelfie = activeQuestion.isSelfie === true;
    const usesRobustPhotoDelivery =
      usesStandardStudentLocationExperience &&
      !isSelfie &&
      typeof operationId === "string";

    if (usesRobustPhotoDelivery && operationId) {
      beginStudentSubmission("photo", operationId);
    }

    setPhotoFeedback(null);
    setPostActionError(null);
    setIsAnalyzingPhoto(true);

    try {
      Sentry.addBreadcrumb({
        category: "student_submission",
        message: "student_photo_upload_started",
        data: {
          submission_type: "photo",
          network_state:
            typeof navigator !== "undefined" && navigator.onLine === false
              ? "offline"
              : "online",
          stage: "upload",
        },
      });
    } catch (err) {
      // best-effort
    }

    let retryCount = 0;
    try {
      if (
        usesRobustPhotoDelivery &&
        typeof navigator !== "undefined" &&
        navigator.onLine === false
      ) {
        throw new Error("PHOTO_OFFLINE");
      }

      const image = await compressImageForUpload(file);
      const answeredAt = new Date().toISOString();
      let authRecoveryAttempted = false;
      let payload: SubmitPhotoResponsePayload | null = null;

      const getActiveSubmitPhotoParticipantId = () => {
        const refreshedStoredParticipant = readStoredActiveParticipant();
        if (refreshedStoredParticipant?.sessionId === sessionId) {
          return refreshedStoredParticipant.participantId;
        }

        return participantId;
      };

      const uploadPhoto = async () => {
        const activeParticipantId = getActiveSubmitPhotoParticipantId();
        const formData = new FormData();
        formData.append("image", image);
        formData.append("sessionId", sessionId);
        formData.append("participantId", activeParticipantId);
        formData.append("postIndex", String(currentPostIndex));
        formData.append("answeredAt", answeredAt);
        if (operationId) {
          formData.append("operationId", operationId);
        }

        const abortController = new AbortController();
        const timeoutId = setTimeout(
          () => abortController.abort(),
          STANDARD_ANSWER_SUBMISSION_TIMEOUT_MS
        );
        try {
          const response = await fetch("/api/play/submit-photo", {
            method: "POST",
            body: formData,
            signal: usesRobustPhotoDelivery
              ? abortController.signal
              : undefined,
          });

          const nextPayload = (await response.json().catch(() => null)) as SubmitPhotoResponsePayload | null;
          if (!response.ok || typeof nextPayload?.message !== "string") {
            const errorMessage = nextPayload?.error || "Ugyldigt svar fra foto-upload.";
            const uploadError = new Error(errorMessage) as SubmitPhotoRequestError;
            uploadError.status = response.status;
            uploadError.code = nextPayload?.code;
            uploadError.postIndex =
              typeof nextPayload?.postIndex === "number" ? nextPayload.postIndex : undefined;
            uploadError.questionCount =
              typeof nextPayload?.questionCount === "number" ? nextPayload.questionCount : undefined;
            uploadError.isParticipantAuthError = isParticipantAuthResponseError(
              response.status,
              errorMessage
            );
            throw uploadError;
          }

          return nextPayload;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      while (isMountedRef.current) {
        try {
          payload = await uploadPhoto();

          // success
          break;
        } catch (error) {
          const uploadError = error as SubmitPhotoRequestError;

          if (uploadError.isParticipantAuthError) {
            if (authRecoveryAttempted) {
              tripPlayCircuitBreaker(
                PLAY_PARTICIPANT_AUTH_EXPIRED_MESSAGE,
                "participant_auth_expired"
              );
              return;
            }

            authRecoveryAttempted = true;

            try {
              const recoveryReason = determineParticipantAuthRecoveryReason(
                uploadError.status ?? 0,
                uploadError.message
              );

              Sentry.addBreadcrumb({
                category: "student_submission",
                message: "student_photo_auth_recovery_attempt",
                data: {
                  submission_type: "photo",
                  network_state:
                    typeof navigator !== "undefined" && navigator.onLine === false
                      ? "offline"
                      : "online",
                  stage: "upload",
                  result:
                    recoveryReason === "unknown_auth_error"
                      ? "unknown"
                      : "retryable",
                },
              });
            } catch (_err) {
              // best-effort
            }

            const storedName =
              storedParticipantOnLoad?.studentName?.trim() ||
              playerNameRef.current ||
              pendingPlayerNameRef.current;
            const recoveryMethod = await recoverParticipantAuthSession(
              storedName,
              "photo_upload_auth"
            );

            if (!recoveryMethod) {
              tripPlayCircuitBreaker(
                PLAY_PARTICIPANT_AUTH_EXPIRED_MESSAGE,
                "participant_auth_expired"
              );
              return;
            }

            try {
              const recoveryReason = determineParticipantAuthRecoveryReason(
                uploadError.status ?? 0,
                uploadError.message
              );

              Sentry.addBreadcrumb({
                category: "student_submission",
                message: "student_photo_auth_recovery_succeeded",
                data: {
                  submission_type: "photo",
                  network_state: "online",
                  stage: "upload",
                  result: "duplicate",
                },
              });
            } catch (_err) {
              // best-effort
            }

            continue;
          }

          if (
            uploadError.status === 409 &&
            uploadError.code === RUN_OUT_OF_SYNC_ERROR_CODE
          ) {
            const recovered = await recoverPhotoUploadRunOutOfSync(uploadError);
            if (recovered) {
              return;
            }
          }

          if (!isTransientNetworkError(error)) {
            throw error;
          }

          retryCount++;
          try {
            Sentry.addBreadcrumb({
              category: "student_submission",
              message: "student_photo_upload_retry",
              data: {
                submission_type: "photo",
                network_state:
                  typeof navigator !== "undefined" && navigator.onLine === false
                    ? "offline"
                    : "online",
                stage: "upload",
                result: "retryable",
              },
            });
          } catch (err) {
            // best-effort
          }

          if (retryCount >= PHOTO_UPLOAD_MAX_RETRIES) {
            // surface a clear network error so outer catch shows a helpful message
            throw new Error("Netværksfejl: Prøv igen senere");
          }

          await waitForNetworkRetry();
        }
      }

      if (!payload || !isMountedRef.current) return;

      if (usesRobustPhotoDelivery) {
        applyStudentSubmissionEvent({
          type: "confirm",
          result: payload.duplicate === true ? "duplicate" : "stored",
        });
      }

      const didSaveAnswer = await handleAnswer(0, null, {
        awardedPoints:
          typeof payload.awardedPoints === "number" && Number.isFinite(payload.awardedPoints)
            ? Math.max(0, Math.round(payload.awardedPoints))
            : activeQuestion.points,
        skipAnswerPersist: payload.storedAnswer === true,
      });

      if (!didSaveAnswer) {
        // handleAnswer already updated UI; just ensure we clear analysis flag
        setIsAnalyzingPhoto(false);
        return;
      }
      if (!isMountedRef.current) return;

      const photoSuccessMessage = isSelfie
        ? `Selfie sendt! ${payload.message ?? ""}`
        : payload.message ?? "";
      await continueFromSolvedPost();
      showResumeNotice(photoSuccessMessage);
      setIsAnalyzingPhoto(false);
    } catch (error) {
      if (!isMountedRef.current) return;

      const uploadError = error as SubmitPhotoRequestError;
      const isRunOutOfSyncError =
        uploadError?.status === 409 && uploadError?.code === RUN_OUT_OF_SYNC_ERROR_CODE;
      const isSessionClosed =
        uploadError?.status === 410 ||
        uploadError?.code === "SESSION_CLOSED";
      const isExpectedPhotoRejection =
        usesRobustPhotoDelivery &&
        (uploadError?.status === 400 ||
          uploadError?.status === 413 ||
          uploadError?.status === 422 ||
          uploadError?.code === "PHOTO_OPERATION_CONFLICT" ||
          uploadError?.code === "PHOTO_SUBMISSION_CONFLICT" ||
          (uploadError?.status === 404 &&
            uploadError?.code === "POST_NOT_FOUND"));

      if (usesRobustPhotoDelivery) {
        applyStudentSubmissionEvent(
          isSessionClosed
            ? { type: "close_session" }
            : isExpectedPhotoRejection
              ? { type: "reject" }
            : { type: "retryable_error" }
        );
      }

      if (
        !isRunOutOfSyncError &&
        !isSessionClosed &&
        !isExpectedPhotoRejection
      ) {
        if (usesRobustPhotoDelivery) {
          console.error("Foto-upload fejlede i standardflowet.");
        } else {
          console.error("Foto-upload fejlede:", error);
        }

        if (usesRobustPhotoDelivery) {
          captureStudentSubmissionIssue(
            "student_photo_upload_failed",
            operationId ?? null,
            {
              submissionType: "photo",
              stage: "upload",
              result: isTransientNetworkError(error)
                ? "retryable"
                : "unknown",
            }
          );
        }
      }

      const message = isRunOutOfSyncError
        ? PHOTO_UPLOAD_RUN_OUT_OF_SYNC_MESSAGE
        : isSessionClosed
          ? "Løbet er afsluttet. Svaret kan ikke længere afleveres."
          : isExpectedPhotoRejection
            ? uploadError?.status === 413
              ? "Billedet er for stort. Vælg et mindre billede."
              : uploadError?.code === "PHOTO_SUBMISSION_CONFLICT"
                ? "Der er allerede gemt et andet svar på posten."
                : "Billedet kunne ikke bruges. Vælg et andet billede."
        : isSelfie
            ? "Vi kunne ikke uploade selfien endnu. Prøv igen med en stabil forbindelse."
            : "Billedet kunne ikke sendes endnu. Billedet er stadig valgt. Prøv igen.";

      setPhotoFeedback({
        key: activeTypedAnswerKey,
        tone: "error",
        message,
      });
    } finally {
      setIsAnalyzingPhoto(false);
      endSubmission();
    }
  };

  const setLiveLocation = useCallback((location: Location | null) => {
    setMyLoc(location);
  }, []);

  const setDistance = useCallback((nextDistance: number | null) => {
    setDistanceState(nextDistance);
  }, []);

  const stratego = useStrategoEngine({
    enabled:
      isStrategoRace &&
      Boolean(sessionId) &&
      Boolean(participantId) &&
      hasConfirmedName &&
      hasCompletedAvatarGate &&
      !isFinished &&
      !isKicked,
    isPaused: isSessionPaused,
    sessionId,
    participantId,
    myLoc,
    supabase,
  });

  const player: PlayPlayerState = {
    pendingPlayerName,
    pendingAvatarUrl,
    playerName,
    avatarUrl,
    hasConfirmedName,
    hasCompletedAvatarGate,
    nameError,
    participantId,
    teamId,
    teamColor,
    activeDisplayName,
    celebrationName,
  };

  const gps: PlayGpsState = {
    myLoc,
    distance,
    accuracy: myLoc?.accuracy ?? null,
    autoUnlockRadius,
  };

  const currentPost: PlayCurrentPostState = {
    activeQuestion,
    activePostVariant,
    activeQuestionDisplayText,
    activeTypedAnswerKey,
    activeTypedAnswerError,
    activePostActionError,
    activePhotoFeedback,
    activeQuizAnswerFeedback,
    activeQuizPostBurned,
    activeZoneKrigCaptureFeedback,
    activeEscapeReward,
    activeEscapeHint,
    activeRoleplayReply,
    activeRoleplayReplyMessage,
    roleplayCharacterName,
    roleplayAvatar,
  };

  const escape: PlayEscapeState = {
    collectedRewards: collectedEscapeRewards,
    collectedRewardsCount: collectedEscapeRewardsCount,
    escapeCodeOverview,
    escapeCodeOverviewText,
    escapeResults,
    escapeResultsError,
    isLoadingEscapeResults,
    masterLockInput,
    masterLockError,
    masterLockStatus,
    masterLockShakeNonce,
    isFinalizingEscape,
    showEscapeResults,
    showMasterVictory,
    wrongAttempts,
    myEscapePlacement,
  };

  const feedback: PlayFeedbackState = {
    studentSubmission,
    photoFeedback,
    postActionError,
    quizAnswerFeedback,
    vm26GoalFeedback,
    zoneKrigCaptureFeedback,
    escapeReward,
    roleplayReply,
    typedAnswerError,
    latestMessage,
    resumeMessage,
    wrongAnswerFeedback,
  };

  const shouldShowNameGate = !hasConfirmedName || isProvisioningParticipant;
  const shouldShowAvatarGate = false;
  const isSessionWaiting =
    sessionStatus === "waiting" ||
    sessionStatus === "scheduled" ||
    (sessionStatus === null && hasConfirmedName && Boolean(participantId));

  const screenMode: PlayScreenState["mode"] = isLoading || isRestoringParticipant
    ? "loading"
    : loadError
      ? "load_error"
      : isKicked
        ? "kicked"
        : shouldShowNameGate
          ? "name_gate"
          : shouldShowAvatarGate
            ? "avatar_gate"
          : isSessionWaiting
            ? "waiting"
          : isFinished && isEscapeRace && correctAnswersCount >= questions.length && !showEscapeResults
              ? "escape_master_lock"
              : isFinished && isEscapeRace && showEscapeResults
                ? "escape_results"
                : isFinished
                  ? "finished"
                  : "active";

  useEffect(() => {
    if (screenMode === "active" && playStartedAtMs === null) {
      setPlayStartedAtMs(Date.now());
    }
  }, [screenMode, playStartedAtMs]);

  useEffect(() => {
    if (isFinished && playFinishedAtMs === null) {
      setPlayFinishedAtMs(Date.now());
    }
  }, [isFinished, playFinishedAtMs]);

  useEffect(() => {
    if (!isFinished && playFinishedAtMs !== null) {
      setPlayFinishedAtMs(null);
    }
  }, [isFinished, playFinishedAtMs]);

  const screen: PlayScreenState = {
    mode: screenMode,
    isLoading,
    loadError,
    loadErrorVariant,
    isFinished,
    isKicked,
    playStartedAtMs,
    playFinishedAtMs,
  };
  const isNearTarget =
    Boolean(activeQuestion) &&
    (gpsOverride ||
      (distance !== null && targetVisualRadius !== null && distance <= targetVisualRadius));

  const map: PlayMapState = {
    playerLocation: myLoc,
    playerName,
    avatarUrl,
    targetLocation: activeQuestion ? { lat: activeQuestion.lat, lng: activeQuestion.lng } : null,
    targetLabel: activeQuestionDisplayText,
    targetNumber: activeQuestion ? displayPostNumber : null,
    isNearTarget,
    canOpenTarget: canOpenCurrentPost,
    distanceToTargetMeters: distance,
  };

  const progress: PlayProgressState = {
    questions,
    raceMode,
    theme,
    currentPostIndex,
    solvedPostIndexes,
    answeredPostIndexes,
    displayPostNumber,
    totalQuestions: questions.length,
    progressPercent,
    score,
    correctAnswersCount,
    dismissedPostIndex,
    showQuestion,
    currentPost,
    escape,
    feedback,
    screen,
    map,
  };

  const flags: PlayUiFlags = {
    canManualUnlock,
    canOpenCurrentPostFromDistance,
    gpsOverrideEnabled: gpsOverride,
    usesStandardStudentLocationExperience,
    hasActivePhotoSuccess,
    hasActiveQuizSuccess,
    hasAllEscapeBricks,
    hasRoleplayInputErrorTone,
    isProvisioningParticipant,
    isEscapeRace,
    isStrategoRace,
    isRoleplayImmersed,
    isSelfiePhotoTask,
    isClosing,
    isSubmitting,
    isSubmittingAnswer,
    isAnalyzingPhoto,
    isCheckingEscapeAnswer,
    isSessionPaused,
    shouldKeepScreenAwake,
    reconnectConfirmationNonce,
    pendingAnswerCount: pendingLocalAnswers.length,
    bonusAvailable,
  };

  const resetFromExpired = useCallback(() => {
    clearStoredPlayRecoveryState();
    try {
      Sentry.addBreadcrumb({
        category: "play",
        message: "play_reset_from_expired",
        level: "info",
      });
    } catch {
      // best-effort
    }
    try {
      sendTelemetry("play_reset_from_expired", {
        participant_id: participantId ?? null,
        session_id: sessionId ?? null,
        message: createClientTelemetryMessage({ reason: "participant_auth_expired" }),
      });
    } catch {
      // best-effort
    }
    if (typeof window !== "undefined") {
      window.location.assign("/join?expired=1");
    }
  }, [clearStoredPlayRecoveryState, participantId, sessionId]);

  const retrySessionStatus = useCallback(async () => {
    const snapshot = await fetchSessionStatusSnapshot();
    if (!snapshot) return;
    const nextStatus = snapshot.sessionStatus ?? null;
    setSessionStatus(nextStatus);
    setGpsOverride(snapshot.gpsOverride);
    setIsTeacherGuided(Boolean(snapshot.teacherGuided));
    if (nextStatus === "finished") {
      markPlayAsFinished();
    }
  }, [fetchSessionStatusSnapshot, markPlayAsFinished]);

  const skipCurrentPostAsEmergency = async () => {
    if (
      screenMode !== "active" ||
      !sessionId ||
      !participantId ||
      !activeQuestion ||
      !Number.isInteger(currentPostIndex) ||
      answeredPostIndexesRef.current.includes(currentPostIndex) ||
      burnedPostsRef.current.has(currentPostIndex) ||
      isSelfiePhotoTask ||
      !usesStandardStudentLocationExperience ||
      isStrategoRace ||
      raceMode === "zone_krig" ||
      isEscapeRace ||
      (activePostVariant !== "quiz" && activePostVariant !== "photo") ||
      isSubmitting ||
      submissionLockRef.current ||
      isSubmittingAnswer ||
      isAnalyzingPhoto ||
      isRestoringParticipant ||
      restoreInFlightRef.current ||
      pendingLocalAnswersRef.current.some(
        (entry) =>
          entry.sessionId === sessionId &&
          entry.participantId === participantId &&
          entry.solvedPostIndex === currentPostIndex &&
          entry.status !== "confirmed"
      )
    ) {
      return;
    }

    if (!beginSubmission()) return;

    setPostActionError(null);
    const skipOperationId =
      studentSubmissionRef.current.submissionType === "skip" &&
      studentSubmissionRef.current.operationId &&
      studentSubmissionRef.current.status !== "confirmed"
        ? studentSubmissionRef.current.operationId
        : createStudentSubmissionOperationId();
    beginStudentSubmission("skip", skipOperationId);
    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      STANDARD_ANSWER_SUBMISSION_TIMEOUT_MS
    );

    try {
      const response = await fetch("/api/play/skip-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          sessionId,
          participantId,
          postIndex: currentPostIndex,
        }),
        signal: abortController.signal,
      });

      const payload = (await response.json().catch(() => null)) as SkipPostResponsePayload | null;
      const errorMessage = payload?.error || "Vi kunne ikke springe posten over endnu. Prøv igen om et øjeblik.";

      if (!response.ok) {
        if (response.status === 409) {
          if (
            payload?.code === "SUBMISSION_CONFLICT" ||
            payload?.code === "PROGRESS_MISMATCH"
          ) {
            applyStudentSubmissionEvent({ type: "reject" });
            setPostActionError({
              key: activeTypedAnswerKey,
              message:
                payload.code === "SUBMISSION_CONFLICT"
                  ? "Posten er allerede afsluttet med en anden aflevering."
                  : "Ruten er ændret. Genindlæs løbet, før du prøver igen.",
            });
            return;
          }

          applyStudentSubmissionEvent({ type: "retryable_error" });
          captureStudentSubmissionIssue(
            "student_skip_submission_failed",
            skipOperationId,
            {
              submissionType: "skip",
              stage: "submit",
              result: "retryable",
            }
          );
          setPostActionError({
            key: activeTypedAnswerKey,
            message: "Posten kunne ikke springes over endnu. Prøv igen.",
          });
          return;
        }

        if (response.status === 401 || response.status === 403) {
          applyStudentSubmissionEvent({ type: "retryable_error" });
          if (isParticipantAuthResponseError(response.status, errorMessage)) {
            tripPlayCircuitBreaker(
              PLAY_PARTICIPANT_AUTH_EXPIRED_MESSAGE,
              "participant_auth_expired"
            );
          } else {
            setPlayLoadError(
              PLAY_PARTICIPANT_UNAUTHORIZED_REJOIN_MESSAGE,
              "participant_unauthorized_rejoin"
            );
          }
          return;
        }

        if (response.status === 404 || response.status === 410) {
          applyStudentSubmissionEvent({ type: "close_session" });
          setPostActionError({
            key: activeTypedAnswerKey,
            message: "Løbet er afsluttet. Svaret kan ikke længere afleveres.",
          });
          return;
        }

        if (response.status === 400 || response.status === 422) {
          applyStudentSubmissionEvent({ type: "reject" });
          setPostActionError({
            key: activeTypedAnswerKey,
            message: "Posten kunne ikke springes over med de aktuelle data.",
          });
          return;
        }

        applyStudentSubmissionEvent({ type: "retryable_error" });
        captureStudentSubmissionIssue(
          "student_skip_submission_failed",
          skipOperationId,
          {
            submissionType: "skip",
            stage: "submit",
            result: "retryable",
          }
        );
        setPostActionError({
          key: activeTypedAnswerKey,
          message: "Posten kunne ikke springes over endnu. Prøv igen.",
        });
        return;
      }

      if (payload?.skipped !== true) {
        applyStudentSubmissionEvent({ type: "retryable_error" });
        setPostActionError({
          key: activeTypedAnswerKey,
          message: "Posten kunne ikke springes over endnu. Prøv igen.",
        });
        return;
      }

      applyStudentSubmissionEvent({
        type: "confirm",
        result: payload.duplicate === true ? "duplicate" : "stored",
      });
      markAnsweredPostIndex(currentPostIndex);
      markBurnedPostIndex(currentPostIndex);
      await continueFromSolvedPost();
    } catch {
      if (!isMountedRef.current) return;

      applyStudentSubmissionEvent({ type: "retryable_error" });
      captureStudentSubmissionIssue(
        "student_skip_submission_failed",
        skipOperationId,
        {
          submissionType: "skip",
          stage: "submit",
          result: "retryable",
        }
      );
      setPostActionError({
        key: activeTypedAnswerKey,
        message: "Posten kunne ikke springes over endnu. Prøv igen.",
      });
    } finally {
      clearTimeout(timeoutId);
      endSubmission();
    }
  };

  const preparePhotoSubmission = useCallback(
    (operationId: string) => {
      if (
        !usesStandardStudentLocationExperience ||
        activePostVariant !== "photo" ||
        isSelfiePhotoTask
      ) {
        return;
      }

      const editingSubmission = restoreStudentSubmissionState(
        "photo",
        operationId,
        "editing"
      );
      studentSubmissionRef.current = editingSubmission;
      setStudentSubmission(editingSubmission);
    },
    [
      activePostVariant,
      isSelfiePhotoTask,
      usesStandardStudentLocationExperience,
    ]
  );

  const retryStudentSubmission = async () => {
    if (isSubmitting || submissionLockRef.current) return;

    const activeSubmission = studentSubmissionRef.current;
    if (activeSubmission.submissionType === "skip") {
      await skipCurrentPostAsEmergency();
      return;
    }

    if (activeSubmission.submissionType !== "quiz") {
      return;
    }

    const pendingAnswer = pendingLocalAnswersRef.current.find(
      (entry) =>
        entry.id === activeSubmission.operationId &&
        entry.sessionId === sessionId &&
        entry.participantId === participantId &&
        entry.solvedPostIndex === currentPostIndex &&
        !entry.hasLocalProgress
    );
    const firstPayload = pendingAnswer?.payloads[0];
    const selectedValue =
      firstPayload?.selected_index ?? firstPayload?.answer_index;
    const selectedIndex =
      typeof selectedValue === "number"
        ? selectedValue
        : typeof selectedValue === "string"
          ? Number(selectedValue)
          : Number.NaN;

    if (!Number.isInteger(selectedIndex)) {
      captureStudentSubmissionIssue(
        "student_submission_state_invalid",
        activeSubmission.operationId,
        {
          submissionType: "quiz",
          stage: "resume",
          result: "rejected",
        }
      );
      return;
    }

    await submitQuizAnswer(selectedIndex);
  };

  const startOver = useCallback(() => {
    clearStoredPlayRecoveryState();
    if (typeof window !== "undefined") {
      window.location.assign("/join");
    }
  }, [clearStoredPlayRecoveryState]);

  return {
    player,
    gps,
    progress,
    stratego,
    flags,
    actions: {
      confirmName,
      completeAvatarSetup,
      setPendingPlayerName,
      setPendingAvatarUrl,
      selectPostIndex,
      setMasterLockInput,
      setShowEscapeResults,
      dismissLatestMessage,
      clearTypedAnswerError,
      clearPostActionError,
      clearRoleplayInputErrorTone,
      clearStrategoDuelEvent: stratego.clearDuelEvent,
      triggerStrategoDuel: stratego.triggerDuel,
      unlockCurrentPost,
      dismissCurrentPost,
      clearDismissedPost,
      retryRestoreConnection,
      reloadPage: () => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      },
      resetFromExpired,
      retrySessionStatus,
      startOver,
      retryStudentSubmission,
      continueFromSolvedPost,
      skipCurrentPostAsEmergency,
      submitQuizAnswer,
      submitTypedAnswer,
      preparePhotoSubmission,
      submitPhoto,
      submitMasterCode,
      setLiveLocation,
      setDistance,
      syncParticipantLocation,
    },
  };
}
