"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { sendTelemetry } from "@/utils/telemetry";

import type {
  AnswerProgressRow,
  EscapeCodeEntry,
  EscapeResultEntry,
  EscapeRewardState,
  GpsErrorState,
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
  PlayMapState,
  PlayPlayerState,
  PlayProgressState,
  PlayScreenState,
  PlaySessionPayload,
  PlayUiFlags,
  PostActionErrorState,
  Question,
  QuizAnswerFeedbackState,
  RaceMode,
  RoleplayReplyState,
  TeacherBroadcastMessage,
  ValidateAnswerPayload,
  WakeLockSentinelLike,
  ZoneKrigCaptureFeedbackState,
  ZoneKrigCaptureStatus,
} from "./types";
import {
  MANUAL_UNLOCK_RADIUS,
  buildRouteOrder,
  clearStoredActiveParticipant,
  compressImageForUpload,
  containsBadWord,
  formatPhotoFailureMessage,
  getDistance,
  getEscapeCodeBrick,
  getEscapeCodeEntriesFromRows,
  getGpsErrorContent,
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
  reloadPage,
  resolvePostVariant,
  saveStoredActiveParticipant,
  supportsStaggeredStart,
  toFiniteNumber,
  toIntegerStartOffset,
} from "./playUtils";
import { useStrategoEngine } from "./useStrategoEngine";
import { enqueueOfflineAnswer, readOfflineQueue, removeOfflineEntry } from "./playOfflineQueue";
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

const LOCATION_SYNC_404_STRIKE_LIMIT = 5;
const LOCATION_SYNC_RECOVERY_CHECK_COOLDOWN_MS = 15000;
const MAX_PLAYER_NAME_LENGTH = 20;
const OFFLINE_VALIDATION_MESSAGE = "Forbindelsen driller lidt. Prøv igen om et øjeblik.";
const ANSWER_VALIDATION_RETRY_MESSAGE = "Vi tjekker lige svaret. Prøv igen om et øjeblik.";
const PLAY_LOAD_RETRY_MESSAGE = "Vi gør løbet klar. Prøv igen om et øjeblik.";
const PLAY_SETUP_PENDING_MESSAGE = "Løbet bliver gjort klar lige nu. Prøv igen om et øjeblik.";
const RESTORE_RETRY_DELAY_MS = 2500;
const NETWORK_RETRY_DELAY_MS = 3000;

type ZoneKrigCaptureApiResult = {
  status?: ZoneKrigCaptureStatus;
  shieldRemainingSeconds?: number | null;
} | null;

type InsertAnswerResult = {
  didPersist: boolean;
  awardedPoints: number;
  zoneKrigCapture: ZoneKrigCaptureApiResult;
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
        message: `Korrekt svar! Men zonen er beskyttet i ${formatShieldRemainingTime(captureResult.shieldRemainingSeconds)} endnu. Prøv igen senere.`,
        shieldRemainingSeconds: captureResult.shieldRemainingSeconds ?? undefined,
      };
    case "already_owned":
      return {
        key,
        status: "already_owned",
        message: "I ejer allerede denne zone. Godt forsvaret!",
      };
    case "zone_missing":
      return {
        key,
        status: "zone_missing",
        message: "Korrekt svar, men zonen kunne ikke opdateres endnu. Prøv igen om lidt.",
      };
    case "game_over":
      return {
        key,
        status: "game_over",
        message: "Spillet er slut! Flere zoner kan ikke overtages nu.",
      };
    default:
      return null;
  }
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

  const isStoredParticipantFreshJoin = useMemo(() => {
    if (!storedParticipantOnLoad?.savedAt) return false;
    try {
      const savedTime = new Date(storedParticipantOnLoad.savedAt).getTime();
      const now = Date.now();
      const ageMs = now - savedTime;
      return ageMs < 30000;
    } catch {
      return false;
    }
  }, [storedParticipantOnLoad?.savedAt]);

  const [pendingPlayerName, setPendingPlayerNameState] = useState(
    () => storedParticipantOnLoad?.studentName || initialNameCandidate
  );
  const [playerName, setPlayerName] = useState(() => storedParticipantOnLoad?.studentName || "");
  const [hasConfirmedName, setHasConfirmedName] = useState(
    () => Boolean(storedParticipantOnLoad?.studentName)
  );
  const [questions, setQuestions] = useState<Question[]>([]);
  const [raceMode, setRaceMode] = useState<RaceMode>("unknown");
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [myLoc, setMyLoc] = useState<Location | null>(null);
  const [distance, setDistanceState] = useState<number | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [gpsError, setGpsErrorState] = useState<GpsErrorState | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isKicked, setIsKicked] = useState(false);
  const [latestMessage, setLatestMessage] = useState<TeacherBroadcastMessage | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<PhotoFeedbackState>(null);
  const [postActionError, setPostActionError] = useState<PostActionErrorState>(null);
  const [quizAnswerFeedback, setQuizAnswerFeedback] = useState<QuizAnswerFeedbackState>(null);
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
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [score, setScore] = useState(0);
  const [solvedPostIndexes, setSolvedPostIndexes] = useState<number[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [gpsOverride, setGpsOverride] = useState(false);
  const [autoUnlockRadius, setAutoUnlockRadius] = useState<number | null>(null);
  const [locationSyncErrors, setLocationSyncErrors] = useState(0);
  const [restoreRetryNonce, setRestoreRetryNonce] = useState(0);
  const [isRestoringParticipant, setIsRestoringParticipant] = useState(false);

  const answersTableMissingRef = useRef(false);
  const hasRestoredRef = useRef(!Boolean(storedParticipantOnLoad) || isStoredParticipantFreshJoin);
  const resumeMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playStartedAtMs, setPlayStartedAtMs] = useState<number | null>(null);
  const [playFinishedAtMs, setPlayFinishedAtMs] = useState<number | null>(null);
  const quizAnswerFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleplayInputErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockSentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const messageChannelRef = useRef<RealtimeChannel | null>(null);
  const dismissedLatestMessageKeyRef = useRef<string | null>(null);
  const masterVictoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kickConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submissionLockRef = useRef(false);
  const isMountedRef = useRef(true);
  const solvedPostIndexesRef = useRef<number[]>([]);
  const locationSyncErrorsRef = useRef(0);
  const locationSyncSuspendedRef = useRef(false);
  const locationSyncRecoveryCheckInFlightRef = useRef(false);
  const locationSyncRecoveryCheckCooldownUntilRef = useRef(0);
  const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState(false);
  const offlineFlushInFlightRef = useRef(false);
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

    const messageClient = createClient({ authScope: "participant" });
    const { data, error } = await messageClient
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

  const rememberActiveParticipant = useCallback(
    (
      nextParticipantId: string,
      nextStudentName: string,
      nextStartOffset?: number | null,
      nextTeamId?: string | null,
      nextTeamColor?: string | null
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
      });
    },
    [sessionId, startOffset, teamColor, teamId]
  );

  const registerParticipantIdentity = useCallback(
    async (nextStudentName: string) => {
      const normalizedName = nextStudentName.trim();
      if (!sessionId || !normalizedName || isProvisioningParticipant) {
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
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              participantId?: string;
              studentName?: string;
              startOffset?: number;
              teamId?: string | null;
              teamColor?: string | null;
              error?: string;
            }
          | null;

        if (!response.ok || !payload?.participantId) {
          throw new Error(payload?.error || "Kunne ikke klargøre deltageren.");
        }

        const resolvedName = (payload.studentName ?? normalizedName).trim() || normalizedName;
        const resolvedStartOffset = toIntegerStartOffset(payload.startOffset) ?? 0;
        const resolvedTeamId = typeof payload.teamId === "string" ? payload.teamId : null;
        const resolvedTeamColor = typeof payload.teamColor === "string" ? payload.teamColor : null;
        setPendingPlayerNameState(resolvedName);
        setPlayerName(resolvedName);
        setHasConfirmedName(true);
        setNameError(null);
        setTeamId(resolvedTeamId);
        setTeamColor(resolvedTeamColor);
        const initialRouteOrder = buildRouteOrder(
          questions.length,
          resolvedStartOffset,
          supportsStaggeredStart(raceMode)
        );
        if (initialRouteOrder.length > 0) {
          setCurrentPostIndex(initialRouteOrder[0] ?? 0);
        }
        rememberActiveParticipant(
          payload.participantId,
          resolvedName,
          resolvedStartOffset,
          resolvedTeamId,
          resolvedTeamColor
        );
        return true;
      } catch (error) {
        console.error("Kunne ikke registrere deltageridentitet:", error);
        setHasConfirmedName(false);
        setNameError("Vi kunne ikke starte løbet lige nu. Prøv igen.");
        return false;
      } finally {
        setIsProvisioningParticipant(false);
      }
    },
    [isProvisioningParticipant, questions.length, raceMode, rememberActiveParticipant, sessionId]
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
    () => buildRouteOrder(questions.length, startOffset, supportsStaggeredStart(raceMode)),
    [questions.length, raceMode, startOffset]
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

  const fetchParticipantSnapshot = useCallback(
    async (targetParticipantId: string) => {
      if (!sessionId) {
        return { data: null as ParticipantRow | null, error: null };
      }

      const runQuery = (selectClause: string) =>
        supabase
          .from("participants")
          .select(selectClause)
          .eq("id", targetParticipantId)
          .eq("session_id", sessionId)
          .maybeSingle<ParticipantRow>();

      let result = await runQuery("id,session_id,student_name,lat,lng,finished_at,start_offset");
      if (result.error && isMissingColumnError(result.error)) {
        result = await runQuery("id,session_id,student_name,lat,lng,finished_at");
      }

      return result;
    },
    [sessionId, supabase]
  );

  const resetLocationSyncRecovery = useCallback(() => {
    locationSyncErrorsRef.current = 0;
    locationSyncSuspendedRef.current = false;
    locationSyncRecoveryCheckCooldownUntilRef.current = 0;
    setLocationSyncErrors(0);
  }, []);

  const flushOfflineQueue = useCallback(async () => {
    if (offlineFlushInFlightRef.current) return;
    const queue = readOfflineQueue();
    if (queue.length === 0) return;

    offlineFlushInFlightRef.current = true;
    setIsSyncingOfflineQueue(true);

    try {
      // Process entries from oldest to newest.
      // We re-read the queue each iteration so concurrent enqueues are picked up.
      let current = readOfflineQueue();
      while (current.length > 0 && isMountedRef.current) {
        const entry = current[0];
        try {
          const response = await fetch("/api/play/submit-answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payloads: entry.payloads }),
          });

          if (response.ok || response.status === 400 || response.status === 403) {
            // Success or permanent client error — remove from queue either way
            removeOfflineEntry(0);
          } else {
            // Transient server error — stop flushing, will retry later
            break;
          }
        } catch {
          // Network error — stop flushing, will retry on next trigger
          break;
        }
        current = readOfflineQueue();
      }
    } finally {
      offlineFlushInFlightRef.current = false;
      if (isMountedRef.current) {
        setIsSyncingOfflineQueue(readOfflineQueue().length > 0);
      }
    }
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

  const clearRestoreRetryTimer = useCallback(() => {
    if (restoreRetryTimerRef.current !== null) {
      clearTimeout(restoreRetryTimerRef.current);
      restoreRetryTimerRef.current = null;
    }
  }, []);

  const scheduleRestoreRetry = useCallback(
    () => {
      if (restoreRetryTimerRef.current !== null) {
        return;
      }

      setIsRestoringParticipant(true);
      restoreRetryTimerRef.current = setTimeout(() => {
        restoreRetryTimerRef.current = null;
        setRestoreRetryNonce((current) => current + 1);
      }, RESTORE_RETRY_DELAY_MS);
    },
    []
  );

  const markPlayAsFinished = useCallback(() => {
    clearRestoreRetryTimer();
    resetLocationSyncRecovery();
    clearStoredActiveParticipant();
    setParticipantId(null);
    setShowQuestion(false);
    setIsKicked(false);
    setIsFinished(true);
    setIsRestoringParticipant(false);
  }, [clearRestoreRetryTimer, resetLocationSyncRecovery]);

  const runAuthoritativeLocationSyncCheck = useCallback(async () => {
    if (!sessionId || !participantId || locationSyncRecoveryCheckInFlightRef.current) {
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
        console.warn("Session-check returnerede midlertidigt 404/410. Bevarer lokal deltagerstate.");
        scheduleRestoreRetry();
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

      const { data: liveSessionRow, error: liveSessionError } = await supabase
        .from("live_sessions")
        .select("status,gps_override")
        .eq("id", sessionId)
        .maybeSingle<LiveSessionStatusRow>();

      if (liveSessionError) {
        console.error("Kunne ikke hente live session-status efter positionsfejl:", liveSessionError);
        return;
      }

      const nextSessionStatus = liveSessionRow?.status ?? null;
      setSessionStatus(nextSessionStatus);
      setGpsOverride(Boolean(liveSessionRow?.gps_override));

      if (nextSessionStatus === "finished") {
        markPlayAsFinished();
        return;
      }

      const { data: participantSnapshot, error: participantSnapshotError } =
        await fetchParticipantSnapshot(participantId);

      if (participantSnapshotError) {
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
    fetchParticipantSnapshot,
    markPlayAsFinished,
    participantId,
    resetLocationSyncRecovery,
    scheduleRestoreRetry,
    sessionId,
    sessionStatus,
    supabase,
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
    resetLocationSyncRecovery();
  }, [participantId, resetLocationSyncRecovery, sessionId]);

  useEffect(() => {
    return () => {
      clearRestoreRetryTimer();
    };
  }, [clearRestoreRetryTimer]);

  useEffect(() => {
    if (questions.length === 0 || isFinished || correctAnswersCount > 0 || routeOrder.length === 0) return;

    const firstRoutePostIndex = routeOrder[0] ?? 0;
    setCurrentPostIndex((current) => (current === firstRoutePostIndex ? current : firstRoutePostIndex));
  }, [correctAnswersCount, isFinished, questions.length, routeOrder]);

  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;

    // Fetch initial session status
    (async () => {
      try {
        const { data, error } = await supabase
          .from("live_sessions")
          .select("status,gps_override")
          .eq("id", sessionId)
          .limit(1)
          .single();

        if (!mounted) return;
        if (!error && data) {
          setSessionStatus((data as LiveSessionStatusRow).status ?? null);
          setGpsOverride(Boolean((data as LiveSessionStatusRow).gps_override));
        }
      } catch (err) {
        console.error("Kunne ikke hente session-status:", err);
      }
    })();

    // Realtime subscription to status updates
    const channel = supabase
      .channel(`session-status-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          try {
            const nextRow = payload.new as LiveSessionStatusRow | null;
            setSessionStatus(nextRow?.status ?? null);
            setGpsOverride(Boolean(nextRow?.gps_override));
          } catch (error) {
            console.error("Fejl ved behandling af live_sessions-opdatering:", error);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [sessionId, supabase]);
  const escapeCodeByPostIndex = new Map(
    collectedEscapeRewards.map((entry) => [entry.postIndex, entry.brick] as const)
  );
  const escapeCodeOverview = isEscapeRace
    ? questions.map((_, index) => escapeCodeByPostIndex.get(index) ?? "_")
    : [];
  const escapeCodeOverviewText = escapeCodeOverview.join(" ");
  const isBlockingGpsError =
    !gpsOverride && (gpsError === "permission_denied" || gpsError === "unsupported");
  const gpsErrorContent = isBlockingGpsError ? getGpsErrorContent(gpsError) : null;
  const gpsWarningContent =
    !gpsOverride && gpsError && !isBlockingGpsError ? getGpsErrorContent(gpsError) : null;
  const shouldKeepScreenAwake =
    !isLoading &&
    !isRestoringParticipant &&
    !loadError &&
    !isBlockingGpsError &&
    !isFinished &&
    !isKicked &&
    hasConfirmedName &&
    (questions.length > 0 || isStrategoRace);
  const canManualUnlock =
    !showQuestion &&
    (gpsOverride ||
      (distance !== null &&
        autoUnlockRadius !== null &&
        ((distance > autoUnlockRadius && distance <= MANUAL_UNLOCK_RADIUS) ||
          dismissedPostIndex === currentPostIndex)));

  const clearTypedAnswerError = useCallback(() => {
    setTypedAnswerError(null);
  }, []);

  const clearPostActionError = useCallback(() => {
    setPostActionError(null);
  }, []);

  const unlockCurrentPost = useCallback(() => {
    clearRoleplayInputErrorTone();
    setDismissedPostIndex(null);
    setPhotoFeedback(null);
    setPostActionError(null);
    setQuizAnswerFeedback(null);
    setZoneKrigCaptureFeedback(null);
    setEscapeReward(null);
    setRoleplayReply(null);
    setShowQuestion(true);
  }, [clearRoleplayInputErrorTone]);

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
      if (!sessionId || !participantId) return;

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
            void supabase.auth.refreshSession().catch(() => undefined);
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
    return () => {
      isMountedRef.current = false;
      if (resumeMessageTimerRef.current) {
        clearTimeout(resumeMessageTimerRef.current);
      }
      if (quizAnswerFeedbackTimerRef.current) {
        clearTimeout(quizAnswerFeedbackTimerRef.current);
      }
      if (roleplayInputErrorTimerRef.current) {
        clearTimeout(roleplayInputErrorTimerRef.current);
      }
      if (masterVictoryTimerRef.current) {
        clearTimeout(masterVictoryTimerRef.current);
      }
    };
  }, []);

  // Offline answer queue: flush on reconnect, app resume, and initial mount
  useEffect(() => {
    // Attempt an initial flush in case items were queued in a previous session
    void flushOfflineQueue();

    const handleOnline = () => void flushOfflineQueue();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void flushOfflineQueue();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flushOfflineQueue]);

  useEffect(() => {
    if (
      !sessionId ||
      !participantId ||
      (questions.length === 0 && !isStrategoRace) ||
      hasRestoredRef.current
    ) {
      return;
    }

    let isActive = true;
    setIsRestoringParticipant(true);
    clearRestoreRetryTimer();

    const restoreFromStorage = async () => {
      const storedName = storedParticipantOnLoad?.studentName?.trim() || playerName || initialStudentName;
      const storedStartOffset = storedParticipantOnLoad?.startOffset ?? 0;
      if (storedName) {
        setPlayerName(storedName);
        setPendingPlayerNameState(storedName);
        setHasConfirmedName(true);
        setNameError(null);
        rememberActiveParticipant(participantId, storedName, storedStartOffset);
      }

      let participantData: ParticipantRow | null = null;
      let didResolveParticipant = false;

      const { data, error: participantError } = await fetchParticipantSnapshot(participantId);

      if (!isActive) return;

      if (participantError) {
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

          const { data: retryData, error: retryError } = await fetchParticipantSnapshot(participantId);

          if (!isActive) break;

          if (retryError) {
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
      const restoredStartOffset =
        toIntegerStartOffset(participantData?.start_offset) ?? storedStartOffset;
      const restoredRouteOrder = buildRouteOrder(
        questions.length,
        restoredStartOffset,
        supportsStaggeredStart(raceMode)
      );
      const firstRoutePostIndex = restoredRouteOrder[0] ?? 0;
      setStartOffset(restoredStartOffset);

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
        clearStoredActiveParticipant();
        setParticipantId(null);
        setIsFinished(true);
        setIsRestoringParticipant(false);
        hasRestoredRef.current = true;
        return;
      }

      if (resolvedName) {
        let nextPostIndex = firstRoutePostIndex;
        let answersData: AnswerProgressRow[] | null = null;
        let answersError: { code?: string; message?: string } | null = null;

        const answersWithPointsResult = await supabase
          .from("answers")
          .select("post_index,question_index,is_correct,awarded_points")
          .eq("participant_id", participantId)
          .eq("session_id", sessionId);

        if (answersWithPointsResult.error && isMissingColumnError(answersWithPointsResult.error)) {
          const fallbackAnswersResult = await supabase
            .from("answers")
            .select("post_index,question_index,is_correct")
            .eq("participant_id", participantId)
            .eq("session_id", sessionId);

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
        } else if (answersData) {
          const rows = answersData as AnswerProgressRow[];
          const confirmedCorrectPosts = new Set<number>();
          let restoredScore = 0;
          for (const row of rows) {
            if (row.is_correct !== true) continue;
            const normalizedPostIndex = getNormalizedAnsweredPostIndex(row);
            if (normalizedPostIndex === null || normalizedPostIndex < 0) continue;
            confirmedCorrectPosts.add(normalizedPostIndex);

            const storedAwardedPoints = toFiniteNumber(row.awarded_points);
            restoredScore +=
              storedAwardedPoints !== null
                ? Math.max(0, Math.round(storedAwardedPoints))
                : questions[normalizedPostIndex]?.points ?? DEFAULT_QUESTION_POINTS;
          }
          const restoredSolvedPostIndexes = [...confirmedCorrectPosts].sort((a, b) => a - b);
          setSolvedPostIndexes(restoredSolvedPostIndexes);
          setCorrectAnswersCount(restoredSolvedPostIndexes.length);
          setScore(restoredScore);
          setCollectedEscapeRewards(getEscapeCodeEntriesFromRows(rows, questions));

          if (
            !isStrategoRace &&
            questions.length > 0 &&
            raceMode !== "zone_krig" &&
            confirmedCorrectPosts.size >= questions.length
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

          nextPostIndex =
            raceMode === "zone_krig"
              ? (questions[currentPostIndex] ? currentPostIndex : firstRoutePostIndex)
              : getNextRoutePostIndex(restoredRouteOrder, confirmedCorrectPosts) ?? firstRoutePostIndex;
        }

        const restoreTargetQuestion = questions[nextPostIndex];
        const restoredDistanceToNextPost =
          restoredLat !== null &&
          restoredLng !== null &&
          restoreTargetQuestion &&
          Number.isFinite(restoreTargetQuestion.lat) &&
          Number.isFinite(restoreTargetQuestion.lng)
            ? getDistance(restoredLat, restoredLng, restoreTargetQuestion.lat, restoreTargetQuestion.lng)
            : null;

        setCurrentPostIndex(nextPostIndex);
        if (
          autoUnlockRadius !== null &&
          restoredDistanceToNextPost !== null &&
          restoredDistanceToNextPost <= autoUnlockRadius
        ) {
          setDismissedPostIndex(null);
          setShowQuestion(true);
          setDistanceState(restoredDistanceToNextPost);
        } else {
          setShowQuestion(false);
          setDistanceState(null);
        }
      } else {
        setCurrentPostIndex(firstRoutePostIndex);
        setShowQuestion(false);
        setDistanceState(null);
      }

      if (resolvedName) {
        showResumeNotice(`Velkommen tilbage, ${resolvedName}! Genoptager løbet...`);
      }

      clearRestoreRetryTimer();
      setIsRestoringParticipant(false);
      hasRestoredRef.current = true;
    };

    void restoreFromStorage();

    return () => {
      isActive = false;
    };
    }, [
    clearRestoreRetryTimer,
    fetchParticipantSnapshot,
    sessionId,
    participantId,
    questions,
    questions.length,
    raceMode,
    isStrategoRace,
    autoUnlockRadius,
    restoreRetryNonce,
    scheduleRestoreRetry,
    supabase,
    playerName,
    currentPostIndex,
    initialStudentName,
    storedParticipantOnLoad,
    rememberActiveParticipant,
    showResumeNotice,
  ]);

  const markParticipantFinished = useCallback(async () => {
    if (!sessionId || !participantId) return false;
    const finishedAt = new Date().toISOString();

    while (isMountedRef.current) {
      const { error } = await supabase
        .from("participants")
        .update({ finished_at: finishedAt })
        .eq("id", participantId)
        .eq("session_id", sessionId);

      if (!error) {
        clearStoredActiveParticipant();
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
  }, [isTransientNetworkError, participantId, sessionId, supabase, waitForNetworkRetry]);

  const finalizeParticipantSilently = useCallback(async () => {
    const didPersist = await markParticipantFinished();

    if (!didPersist) {
      console.error("Målgang kunne ikke synkroniseres. Fortsætter stille i elev-UI.");
      clearStoredActiveParticipant();
      if (isMountedRef.current) {
        setParticipantId(null);
      }
    }

    return didPersist;
  }, [markParticipantFinished]);

  const insertAnswerRecord = useCallback(
    async (
      selectedIndex: number,
      isCorrect: boolean,
      postNumber: number,
      questionText: string,
      questionPoints: number,
      lat: number | null,
      lng: number | null
    ): Promise<InsertAnswerResult> => {
      const activeName = playerName.trim();
      const fallbackResult: InsertAnswerResult = {
        didPersist: false,
        awardedPoints: isCorrect ? questionPoints : 0,
        zoneKrigCapture: null,
      };

      if (!sessionId || !participantId || !activeName) {
        console.error("Svar kunne ikke forberedes til submit-answer API. Fortsætter stille i elev-UI.", {
          hasSessionId: Boolean(sessionId),
          hasParticipantId: Boolean(participantId),
          hasPlayerName: Boolean(activeName),
        });
        return fallbackResult;
      }

      if (answersTableMissingRef.current) {
        console.error("submit-answer API er tidligere fejlet permanent. Fortsætter stille i elev-UI.");
        return fallbackResult;
      }

      const timestamp = new Date().toISOString();
      const payloads: Record<string, unknown>[] = [
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          post_index: postNumber,
          question_index: postNumber - 1,
          selected_index: selectedIndex,
          answer_index: selectedIndex,
          is_correct: isCorrect,
          awarded_points: isCorrect ? questionPoints : 0,
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
          awarded_points: isCorrect ? questionPoints : 0,
          answered_at: timestamp,
        },
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          question_index: postNumber - 1,
          answer_index: selectedIndex,
          is_correct: isCorrect,
          awarded_points: isCorrect ? questionPoints : 0,
          created_at: timestamp,
        },
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          selected_index: selectedIndex,
          is_correct: isCorrect,
          awarded_points: isCorrect ? questionPoints : 0,
        },
      ];

      while (isMountedRef.current) {
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
          } | null;

          if (!response.ok) {
            console.error("Kunne ikke gemme svar via API:", body?.error ?? response.statusText);
            if (body?.error === "Admin access missing") answersTableMissingRef.current = true;
            return fallbackResult;
          }

          if (body?.inserted === true) {
            // Successful submit — flush any queued offline answers in the background
            void flushOfflineQueue();
            return {
              didPersist: true,
              awardedPoints:
                typeof body.awardedPoints === "number" && Number.isFinite(body.awardedPoints)
                  ? Math.max(0, Math.round(body.awardedPoints))
                  : isCorrect
                    ? questionPoints
                    : 0,
              zoneKrigCapture: body.zoneKrigCapture ?? null,
            };
          }

          console.error("API returnerede ikke indsættelse:", body ?? "ukendt svar");
          return fallbackResult;
        } catch (error) {
          if (!isTransientNetworkError(error)) {
            console.error("Kunne ikke kontakte submit-answer API:", error);
            enqueueOfflineAnswer(payloads);
            sendTelemetry("answer_queued_offline", { reason: "non_transient_error" });
            return fallbackResult;
          }

          await waitForNetworkRetry();
        }
      }

      // Component unmounted during retry loop — queue so it is not lost
      if (!isMountedRef.current) {
        enqueueOfflineAnswer(payloads);
      }

      return fallbackResult;
    },
    [
      isTransientNetworkError,
      participantId,
      playerName,
      raceMode,
      sessionId,
      teamId,
      waitForNetworkRetry,
    ]
  );

  useEffect(() => {
    if (!sessionId) return;

    let isActive = true;

    const fetchRun = async () => {
      setIsLoading(true);
      setLoadError("");
      setAutoUnlockRadius(null);

      while (isActive) {
        try {
          const response = await fetch(`/api/play/session?sessionId=${encodeURIComponent(sessionId)}`, {
            cache: "no-store",
          });
          const payload = (await response.json().catch(() => null)) as PlaySessionPayload | null;

          if (!isActive) return;

          if (!response.ok) {
            setLoadError(PLAY_LOAD_RETRY_MESSAGE);
            setIsLoading(false);
            return;
          }

          const parsedRadius = toFiniteNumber(payload?.radius);
          if (parsedRadius === null || parsedRadius <= 0) {
            setLoadError(PLAY_SETUP_PENDING_MESSAGE);
            setIsLoading(false);
            return;
          }

          const parsedQuestions = Array.isArray(payload?.questions)
            ? payload.questions.map(parseQuestion).filter((q): q is Question => q !== null)
            : [];
          const nextRaceMode = normalizeRaceMode(payload?.raceType);

          if (parsedQuestions.length === 0 && nextRaceMode !== "stratego") {
            setLoadError(PLAY_SETUP_PENDING_MESSAGE);
          } else {
            setQuestions(parsedQuestions);
          }

          setRaceMode(nextRaceMode);
          setAutoUnlockRadius(Math.round(parsedRadius));
          setGpsOverride(Boolean(payload?.gpsOverride));
          setCorrectAnswersCount(0);
          setScore(0);
          setSolvedPostIndexes([]);
          setCollectedEscapeRewards([]);
          setEscapeReward(null);
          setPostActionError(null);
          setDismissedPostIndex(null);
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
            setLoadError(PLAY_LOAD_RETRY_MESSAGE);
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
  }, [isTransientNetworkError, sessionId, waitForNetworkRetry]);

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
    if (!sessionId) return;

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
            clearStoredActiveParticipant();
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
              clearStoredActiveParticipant();
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
        .subscribe();

      messageChannelRef.current = ch;
    };

    createSubscription();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Proactively refresh JWT so realtime + API calls don't fail with 401
        void supabase.auth.refreshSession().catch(() => undefined);

        // re-subscribe to ensure channel is active after sleep
        void loadLatestTeacherMessage();
        createSubscription();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (kickConfirmTimerRef.current) {
        clearTimeout(kickConfirmTimerRef.current);
        kickConfirmTimerRef.current = null;
      }
      if (messageChannelRef.current) {
        void supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
    };
  }, [applyLatestTeacherMessage, clearRestoreRetryTimer, loadLatestTeacherMessage, participantId, sessionId, supabase]);

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
    }, 900);
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

      while (isMountedRef.current) {
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

    const nextRoutePostIndex =
      currentRouteStepIndex + 1 < routeOrder.length ? routeOrder[currentRouteStepIndex + 1] : null;

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

    if (!isEscapeRace) {
      await finalizeParticipantSilently();
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

  const handleAnswer = async (
    selectedIndex: number,
    escapeBrick?: string | null,
    options?: { skipAnswerPersist?: boolean; awardedPoints?: number }
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

    if (currentVariant === "quiz") {
      setQuizAnswerFeedback(null);
    }
    setZoneKrigCaptureFeedback(null);
    setTypedAnswerError(null);
    setPostActionError(null);

    const answerInsertResult = options?.skipAnswerPersist
      ? {
          didPersist: true,
          awardedPoints: options.awardedPoints ?? current.points,
          zoneKrigCapture: null,
        }
      : await insertAnswerRecord(
          selectedIndex,
          true,
          postNumber,
          currentVariant === "roleplay" ? getRoleplayMessage(current) : current.text,
          current.points,
          myLoc?.lat ?? null,
          myLoc?.lng ?? null
        );

    if (!solvedPostIndexesRef.current.includes(currentPostIndex)) {
      setSolvedPostIndexes((prev) => [...prev, currentPostIndex].sort((a, b) => a - b));
      setCorrectAnswersCount((prev) => prev + 1);
      setScore((prev) => prev + answerInsertResult.awardedPoints);
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
      }
      setQuizAnswerFeedback({
        key: feedbackKey,
        selectedIndex,
        tone: "success",
      });
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

      if (participantId) {
        setHasConfirmedName(true);
        rememberActiveParticipant(participantId, trimmedName);
        return;
      }

      void registerParticipantIdentity(trimmedName);
    },
    [participantId, registerParticipantIdentity, rememberActiveParticipant]
  );

  const submitQuizAnswer = async (selectedIndex: number) => {
    const current = questions[currentPostIndex];
    if (!current || resolvePostVariant(raceMode, current) !== "quiz") return;
    if (isSubmitting || submissionLockRef.current) return;
    if (!beginSubmission()) return;

    const feedbackKey = `${currentPostIndex}-quiz`;
    setTypedAnswerError(null);
    setPostActionError(null);
    setZoneKrigCaptureFeedback(null);
    setIsSubmittingAnswer(true);

    try {
      const payload = await validateAnswerOnServer({ selectedIndex });
      if (payload?.isCorrect === true) {
        await handleAnswer(selectedIndex);
      } else {
        handleWrongQuizAnswer(selectedIndex, feedbackKey);
      }
    } catch (error) {
      console.error("Kunne ikke validere quiz-svar:", error);
      const msg = getAnswerValidationErrorMessage(error);
      setTypedAnswerError({
        key: feedbackKey,
        message: msg,
      });
    } finally {
      setIsSubmittingAnswer(false);
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

      await finalizeParticipantSilently();
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
      await finalizeParticipantSilently();
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

      if (payload?.isCorrect !== true) {
        if (activePostVariant === "roleplay") {
          triggerRoleplayInputError();
          setRoleplayReply({
            key: activeTypedAnswerKey,
            message: "Tænker...",
            tone: "hint",
            canContinue: false,
            isLoading: true,
          });
        }
        if (activePostVariant === "escape") {
          setWrongAttempts((current) => current + 1);
        }

        if (activePostVariant === "roleplay") {
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
            return;
          }

          setRoleplayReply(null);
          setTypedAnswerError({
            key: activeTypedAnswerKey,
            message: "Forkert svar, prøv igen",
          });
          return;
        }

        setTypedAnswerError({
          key: activeTypedAnswerKey,
          message: "Svaret passer ikke endnu. Prøv igen.",
        });
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

  const submitPhoto = async (file: File) => {
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
    if (isSubmitting || submissionLockRef.current) return;
    if (!beginSubmission()) return;
    const isSelfie = activeQuestion.isSelfie === true;

    setPhotoFeedback(null);
    setPostActionError(null);
    setIsAnalyzingPhoto(true);

    try {
      const image = await compressImageForUpload(file);
      let payload:
        | {
            isMatch?: boolean;
            message?: string;
            awardedPoints?: number;
            imageUrl?: string | null;
            storedAnswer?: boolean;
            error?: string;
          }
        | null = null;

      while (isMountedRef.current) {
        try {
          const formData = new FormData();
          formData.append("image", image);
          formData.append("sessionId", sessionId);
          formData.append("participantId", participantId);
          formData.append("postIndex", String(currentPostIndex));

          const response = await fetch("/api/analyze-photo", {
            method: "POST",
            body: formData,
          });

          payload = (await response.json()) as {
            isMatch?: boolean;
            message?: string;
            awardedPoints?: number;
            imageUrl?: string | null;
            storedAnswer?: boolean;
            error?: string;
          };

          if (
            !response.ok ||
            typeof payload.isMatch !== "boolean" ||
            typeof payload.message !== "string"
          ) {
            throw new Error(payload.error || "Ugyldigt svar fra billedanalysen.");
          }

          break;
        } catch (error) {
          if (!isTransientNetworkError(error)) {
            throw error;
          }

          await waitForNetworkRetry();
        }
      }

      if (!payload || !isMountedRef.current) return;

      if (!isMountedRef.current) return;

      if (!payload.isMatch) {
        setIsAnalyzingPhoto(false);
        setPhotoFeedback({
          key: activeTypedAnswerKey,
          tone: "error",
          message: formatPhotoFailureMessage(payload.message ?? "", isSelfie),
        });
        return;
      }

      const didSaveAnswer = await handleAnswer(0, null, {
        awardedPoints:
          typeof payload.awardedPoints === "number" && Number.isFinite(payload.awardedPoints)
            ? Math.max(0, Math.round(payload.awardedPoints))
            : activeQuestion.points,
        skipAnswerPersist: payload.storedAnswer === true,
      });
      if (!didSaveAnswer) {
        setIsAnalyzingPhoto(false);
        return;
      }
      if (!isMountedRef.current) return;

      setPhotoFeedback({
        key: activeTypedAnswerKey,
        tone: "success",
        message: isSelfie ? `Selfie godkendt! ${payload.message ?? ""}` : payload.message ?? "",
      });
      setIsAnalyzingPhoto(false);
    } catch (error) {
      console.error("Fotoanalyse fejlede:", error);
      if (!isMountedRef.current) return;
      setIsAnalyzingPhoto(false);
      setPhotoFeedback({
        key: activeTypedAnswerKey,
        tone: "error",
        message: isSelfie
          ? "Vi kunne ikke læse selfien helt endnu. Prøv igen med bedre lys og få både ansigt og baggrund tydeligt med."
          : "Ups, AI'en er lidt træt. Prøv at tage billedet igen.",
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

  const setGpsError = useCallback((error: GpsErrorState | null) => {
    setGpsErrorState(error);
  }, []);

  const stratego = useStrategoEngine({
    enabled:
      isStrategoRace &&
      Boolean(sessionId) &&
      Boolean(participantId) &&
      hasConfirmedName &&
      !isFinished &&
      !isKicked,
    isPaused: isSessionPaused,
    sessionId,
    participantId,
    myLoc,
    gpsError,
    supabase,
  });

  const player: PlayPlayerState = {
    pendingPlayerName,
    playerName,
    hasConfirmedName,
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
    autoUnlockRadius,
    gpsError,
    gpsErrorContent,
    gpsWarningContent,
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
    photoFeedback,
    postActionError,
    quizAnswerFeedback,
    zoneKrigCaptureFeedback,
    escapeReward,
    roleplayReply,
    typedAnswerError,
    latestMessage,
    resumeMessage,
  };

  const screenMode: PlayScreenState["mode"] = isLoading || isRestoringParticipant
    ? "loading"
    : loadError
      ? "load_error"
      : isKicked
        ? "kicked"
        : (sessionStatus === "waiting" || sessionStatus === "scheduled")
          ? "waiting"
          : (!hasConfirmedName || isProvisioningParticipant) && !isFinished
          ? "name_gate"
          : isBlockingGpsError && !isFinished
            ? "gps_blocked"
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
    isFinished,
    isKicked,
    playStartedAtMs,
    playFinishedAtMs,
  };

  const map: PlayMapState = {
    playerLocation: myLoc,
    playerName,
    targetLocation: activeQuestion ? { lat: activeQuestion.lat, lng: activeQuestion.lng } : null,
    targetLabel: activeQuestionDisplayText,
  };

  const progress: PlayProgressState = {
    questions,
    raceMode,
    currentPostIndex,
    solvedPostIndexes,
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
    gpsOverrideEnabled: gpsOverride,
    hasActivePhotoSuccess,
    hasActiveQuizSuccess,
    hasAllEscapeBricks,
    hasRoleplayInputErrorTone,
    isBlockingGpsError,
    isProvisioningParticipant,
    isEscapeRace,
    isStrategoRace,
    isRoleplayImmersed,
    isSelfiePhotoTask,
    isSubmitting,
    isSubmittingAnswer,
    isAnalyzingPhoto,
    isCheckingEscapeAnswer,
    isSessionPaused,
    isSyncingOfflineQueue,
    shouldKeepScreenAwake,
  };

  return {
    player,
    gps,
    progress,
    stratego,
    flags,
    actions: {
      confirmName,
      setPendingPlayerName,
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
      reloadPage,
      continueFromSolvedPost,
      submitQuizAnswer,
      submitTypedAnswer,
      submitPhoto,
      submitMasterCode,
      setLiveLocation,
      setDistance,
      setGpsError,
      syncParticipantLocation,
    },
  };
}
