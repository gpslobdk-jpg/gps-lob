"use client";

import dynamic from "next/dynamic";
import { Camera, CheckCircle2, Cloud, CloudOff, KeyRound, Loader2, RefreshCcw, XCircle } from "lucide-react";
import Image from "next/image";
import { poppins, rubik } from "@/lib/fonts";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

import { useParams } from "next/navigation";
import type { PlayActions, PlayUiState } from "./types";
import {
  FIREWORKS_LOTTIE_URL,
  formatFinishedAt,
  formatPlacement,
  getRoleplayMessage,
  looksLikeImageSource,
  wrapTextClass,
} from "./playUtils";
import QuestionTtsButton from "./QuestionTtsButton";
import StudentSubmissionStatus from "./StudentSubmissionStatus";
import TeacherBroadcastModal from "./TeacherBroadcastModal";
import StudentNameGateView from "./shared/StudentNameGateView";
import StandardStudentPlayExperience from "./standard/StandardStudentPlayExperience";
import WifiConnectionTip from "@/components/WifiConnectionTip";
import trophyAnimation from "@/public/trophy.json";
import { getGamerTitle } from "@/utils/gamerTitle";
import { createStudentSubmissionOperationId } from "@/lib/submissions/studentSubmissionState";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
const LottiePlayer = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false }
);

type PlayInterfaceProps = {
  ui: PlayUiState;
  actions: PlayActions;
  children?: ReactNode;
};

type PendingPhotoSelection = {
  key: string;
  file: File;
  previewUrl: string;
  operationId: string;
};

function Vm26PlayBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-[1.25rem] border border-amber-300/35 bg-amber-300/12 shadow-[0_16px_34px_rgba(251,191,36,0.14)] backdrop-blur-2xl ${
        compact ? "px-4 py-3 text-center" : "px-4 py-3"
      }`}
    >
      <p className={`font-black text-amber-50 ${compact ? "text-sm" : "text-base"} ${wrapTextClass}`}>
        <span aria-hidden="true">⚽</span> VM26 – Jagten på pokalen
      </p>
      <p className="mt-1 text-xs font-semibold text-amber-100/82">
        Pokaljagten er i gang
      </p>
    </div>
  );
}

const LOCKED_POST_FEEDBACK_DURATION_MS = 3200;
const LOCKED_POST_GPS_ACCURACY_MESSAGE =
  "Du er tæt på posten, men GPS'en er lidt upræcis lige nu. Vent et øjeblik, gå et par meter rundt, eller prøv mobildata.";

function safeVibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore browsers that expose vibrate but still reject the call
  }
}

type MobileHudProps = {
  mobileHudOpen: boolean;
  setMobileHudOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeDisplayName: string;
  progressPercent: number;
  score: number;
  correctAnswersCount: number;
  questionsLength: number;
  distance: number | null;
  gpsOverrideEnabled: boolean;
};

function MobileHudComponent({
  mobileHudOpen,
  setMobileHudOpen,
  activeDisplayName,
  progressPercent,
  score,
  correctAnswersCount,
  questionsLength,
  distance,
  gpsOverrideEnabled,
}: MobileHudProps) {
  return (
    <div className="w-full max-w-xl">
      <div className="flex items-center justify-between gap-3 rounded-full bg-slate-900 px-3 py-2 shadow-lg">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/90 text-sm font-black text-slate-900">
              <div className="h-2.5 w-2.5 rounded-full bg-white/90" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{activeDisplayName}</div>
              <div className="text-[11px] text-white/90">{progressPercent}% · {correctAnswersCount}/{questionsLength}</div>
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setMobileHudOpen((s) => !s)}
            aria-label={mobileHudOpen ? "Skjul info" : "Vis info"}
            aria-expanded={mobileHudOpen}
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-slate-700 px-3 py-2 text-sm font-semibold text-white"
          >
            {mobileHudOpen ? "Skjul" : "Info"}
          </button>
        </div>
      </div>

      {mobileHudOpen ? (
        <div className="mt-3 rounded-2xl border border-white/20 bg-slate-900 p-3 text-white">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{activeDisplayName}</div>
            <div className="text-sm font-mono">
              {gpsOverrideEnabled ? "God Mode" : distance !== null ? `${distance}m` : "GPS..."}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/90">
            <div>Progress: {progressPercent}%</div>
            <div>{score} point</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Waiting screen – shown while teacher hasn't started the run yet.
// ============================================================================

const STUCK_HELP_DELAY_MS = 35_000;
const LOADING_STUCK_DELAY_MS = 20_000;

function WaitingScreenContent({ actions }: { actions: PlayActions }) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showStillWaiting, setShowStillWaiting] = useState(false);
  const hasLoggedShownRef = useRef(false);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stillWaitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Log once when the waiting screen mounts
  useEffect(() => {
    mountedRef.current = true;
    if (hasLoggedShownRef.current) return () => {
      mountedRef.current = false;
    };

    hasLoggedShownRef.current = true;
    try {
      Sentry.addBreadcrumb({
        category: "play.waiting",
        message: "play_waiting_screen_shown",
        level: "info",
      });
    } catch (_err) {
      // best-effort
    }

    stuckTimerRef.current = setTimeout(() => {
      setShowHelp(true);
      try {
        Sentry.addBreadcrumb({
          category: "play.waiting",
          message: "waiting_help_shown",
          level: "info",
          data: { delayMs: STUCK_HELP_DELAY_MS },
        });
      } catch (_err) {
        // best-effort
      }
    }, STUCK_HELP_DELAY_MS);

    return () => {
      mountedRef.current = false;
      if (stuckTimerRef.current !== null) {
        clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = null;
      }
      if (stillWaitingTimerRef.current !== null) {
        clearTimeout(stillWaitingTimerRef.current);
        stillWaitingTimerRef.current = null;
      }
    };
  }, []);

  const handleRetry = async () => {
    if (isRetrying) return;
    // Clear previous helper message
    setShowStillWaiting(false);
    setIsRetrying(true);
    // best-effort tactile feedback
    safeVibrate(40);
    // Do not send a Sentry event for manual retry — it generated noise.
    try {
      await actions.retrySessionStatus();
    } finally {
      if (mountedRef.current) setIsRetrying(false);
    }

    // If component is still mounted after retry, show a short inline note
    if (!mountedRef.current) return;
    setShowStillWaiting(true);
    if (stillWaitingTimerRef.current !== null) {
      clearTimeout(stillWaitingTimerRef.current);
    }
    stillWaitingTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setShowStillWaiting(false);
      stillWaitingTimerRef.current = null;
    }, 6000);
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
      <div className="absolute inset-0 z-[2200] flex items-center justify-center bg-black/70 p-6">
        <div className="gpslob-waiting-enter w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/90">
            <div className="h-3 w-3 animate-pulse rounded-full bg-white/90" />
          </div>
          <h1 className="text-2xl font-black">Løbet er ikke startet endnu</h1>
          <p className="mt-3 text-sm text-white/90">Vi tjekker automatisk. Du behøver ikke trykke flere gange.</p>

          <WifiConnectionTip className="mt-6" />

          {showHelp && (
            <p className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-200">
              Hvis læreren allerede har startet løbet, så tryk <strong>Tjek nu</strong> eller <strong>Start forfra</strong>.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={isRetrying}
              aria-busy={isRetrying}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Tjekker status…" : "Tjek nu"}
            </button>

            <button
              type="button"
              onClick={() => actions.startOver()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Start forfra
            </button>
          </div>

          {showStillWaiting && (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Tjekket lige nu. Vent på læreren.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlayInterface({ ui, actions, children }: PlayInterfaceProps) {
  const typedAnswerInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoPickerPendingRef = useRef(false);
  const photoPickerReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileHudOpen, setMobileHudOpen] = useState(false);
  const [cameraErrorState, setCameraErrorState] = useState<{ key: string; message: string | null }>({
    key: "",
    message: null,
  });
  const [lockedPostFeedbackState, setLockedPostFeedbackState] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const lockedPostFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rageClickRef = useRef<{
    count: number;
    lastTs: number;
    resetTimer: ReturnType<typeof setTimeout> | null;
  }>({
    count: 0,
    lastTs: 0,
    resetTimer: null,
  });
  const [showRageModal, setShowRageModal] = useState(false);
  const RAGE_THRESHOLD = 3;
  const RAGE_WINDOW_MS = 2000;
  const prevOverflowRef = useRef<string | null>(null);
  const [cameraPermissionState, setCameraPermissionState] = useState<PermissionState | "unknown">("unknown");
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));
  const [showCloudSyncSuccess, setShowCloudSyncSuccess] = useState(false);
  const cloudSyncSuccessTimerRef = useRef<number | null>(null);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [isResettingFromExpired, setIsResettingFromExpired] = useState(false);
  const [showRetrySlowHint, setShowRetrySlowHint] = useState(false);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [showLoadingStuckHelp, setShowLoadingStuckHelp] = useState(false);
  const loadingStuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [skipConfirm, setSkipConfirm] = useState<{ key: string } | null>(null);
  const [pendingPhotoSelection, setPendingPhotoSelection] =
    useState<PendingPhotoSelection | null>(null);

  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";

  const { player, gps, progress, flags } = ui;
  const {
    pendingPlayerName,
    playerName,
    nameError,
    activeDisplayName,
    celebrationName,
  } = player;
  const {
    distance,
    accuracy,
    autoUnlockRadius,
  } = gps;
  const {
    questions,
    currentPostIndex,
    solvedPostIndexes,
    answeredPostIndexes,
    displayPostNumber,
    progressPercent,
    score,
    correctAnswersCount,
    dismissedPostIndex,
    showQuestion,
    currentPost,
    escape,
    feedback,
    screen,
    raceMode,
    theme,
  } = progress;
  const {
    activeQuestion,
    activePostVariant,
    activeTypedAnswerKey,
    activeTypedAnswerError,
    activePostActionError,
    activePhotoFeedback,
    activeQuizAnswerFeedback,
    activeQuizPostBurned,
    activeEscapeReward,
    activeEscapeHint,
    activeRoleplayReply,
    activeRoleplayReplyMessage,
    roleplayCharacterName,
    roleplayAvatar,
  } = currentPost;
  const {
    collectedRewardsCount: collectedEscapeRewardsCount,
    escapeCodeOverviewText,
    escapeResults,
    escapeResultsError,
    isLoadingEscapeResults,
    masterLockInput,
    masterLockError,
    masterLockStatus,
    masterLockShakeNonce,
    isFinalizingEscape,
    showMasterVictory,
    myEscapePlacement,
  } = escape;
  const {
    studentSubmission,
    latestMessage,
    resumeMessage,
    vm26GoalFeedback,
    wrongAnswerFeedback,
  } = feedback;
  const {
    canManualUnlock,
    gpsOverrideEnabled,
    usesStandardStudentLocationExperience,
    hasActivePhotoSuccess,
    hasActiveQuizSuccess,
    hasAllEscapeBricks,
    hasRoleplayInputErrorTone,
    isProvisioningParticipant,
    isEscapeRace,
    isRoleplayImmersed,
    isSelfiePhotoTask,
    isClosing,
    isSubmitting,
    isSubmittingAnswer,
    isAnalyzingPhoto,
    isCheckingEscapeAnswer,
    pendingAnswerCount,
    bonusAvailable,
  } = flags;
  const isWithinAutoUnlockRadius =
    !gpsOverrideEnabled &&
    autoUnlockRadius !== null &&
    distance !== null &&
    distance <= autoUnlockRadius;
  const showVm26Badge = theme?.vm26?.enabled === true;
  const manualUnlockBufferMeters = 20;
  const manualUnlockBufferRadius =
    autoUnlockRadius !== null ? autoUnlockRadius + manualUnlockBufferMeters : null;
  const hasActiveUnlockTarget =
    Boolean(activeQuestion) &&
    !showQuestion &&
    !solvedPostIndexes.includes(currentPostIndex) &&
    !answeredPostIndexes.includes(currentPostIndex);
  const manualUnlockDistanceToGo =
    distance !== null &&
    manualUnlockBufferRadius !== null &&
    !canManualUnlock
      ? Math.max(1, Math.ceil(distance - manualUnlockBufferRadius))
      : null;
  const isTooFarForManualUnlock =
    distance !== null &&
    manualUnlockBufferRadius !== null &&
    distance > manualUnlockBufferRadius;
  const isGpsAccuracyConcern =
    accuracy === null || (typeof accuracy === "number" && accuracy > 120);
  const isNearUnlockRadiusForDiagnostics =
    distance !== null &&
    autoUnlockRadius !== null &&
    distance <= autoUnlockRadius + 30;
  const showGpsDiagnostics =
    hasActiveUnlockTarget &&
    !gpsOverrideEnabled &&
    !canManualUnlock &&
    distance !== null &&
    (isNearUnlockRadiusForDiagnostics || isGpsAccuracyConcern);
  const distanceDiagnosticsLabel =
    distance !== null
      ? distance >= 1000
        ? `${(distance / 1000).toFixed(1)} km`
        : `${distance} m`
      : "ukendt";
  const accuracyDiagnosticsLabel =
    accuracy !== null ? `ca. ${accuracy} m` : "ukendt";
  const unlockRadiusDiagnosticsLabel =
    autoUnlockRadius !== null ? `${autoUnlockRadius} m` : "ukendt";
  const normalizedActiveDisplayName = activeDisplayName.trim().toLocaleLowerCase("da-DK");
  const tacticalHudShellClass =
    "overflow-hidden rounded-[2rem] border border-white/30 bg-slate-800 p-4 shadow-lg md:p-5";
  const tacticalHudCardClass =
    "overflow-hidden rounded-[1.6rem] border border-white/30 bg-slate-800 p-4 shadow-lg";
  const tacticalMetaLabelClass =
    "font-mono text-[11px] uppercase tracking-[0.32em] text-white/90";
  const tacticalPillClass =
    "rounded-full border border-white/30 bg-slate-700 px-3 py-1 font-mono text-xs uppercase tracking-widest text-white";
  const tacticalOverlayCardClass =
    "w-full max-w-md overflow-hidden rounded-[2rem] border border-emerald-500/50 bg-slate-950 p-5 shadow-2xl sm:p-8";
  const tacticalPrimaryButtonClass =
    `inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[1.35rem] border border-emerald-500 bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-md transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 ${rubik.className}`;
  const tacticalSecondaryButtonClass =
    `inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[1.35rem] border border-slate-600 bg-slate-800 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${rubik.className}`;
  const tacticalInputClass =
    "w-full rounded-[1.35rem] border border-emerald-500/50 bg-slate-950 px-4 py-4 text-base text-emerald-50 outline-none transition placeholder:text-white/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-70";
  const tacticalSuccessPanelClass =
    "overflow-hidden rounded-[1.9rem] border border-emerald-300/35 bg-emerald-500 p-6 text-center text-slate-950 shadow-[0_0_36px_rgba(16,185,129,0.22)] animate-pulse";
  const quizContinueButtonClass =
    `inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[1.1rem] border border-emerald-300/40 bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-[0_18px_40px_rgba(5,150,105,0.35)] transition-all hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${rubik.className}`;
  const cameraPermissionMessage = "Du skal tillade kamera-adgang i dine browser-indstillinger for at tage billedet.";
  const cameraRetryHelpMessage =
    "Hvis kameraet ikke åbner, skal du tillade kamera-adgang i dine browser-indstillinger og prøve igen.";
  const cameraError = cameraErrorState.key === activeTypedAnswerKey ? cameraErrorState.message : null;
  const lockedPostFeedback = lockedPostFeedbackState?.message ?? null;
  const isAnswerSubmissionPending = isSubmittingAnswer || isSubmitting;
  const isStandardSubmissionBlockingInput =
    usesStandardStudentLocationExperience &&
    (
      studentSubmission.status === "submitting" ||
      studentSubmission.status === "queued_offline" ||
      studentSubmission.status === "awaiting_confirmation" ||
      studentSubmission.status === "retryable_error" ||
      studentSubmission.status === "rejected" ||
      studentSubmission.status === "session_closed"
    );
  const isQuizSubmissionPending =
    !usesStandardStudentLocationExperience &&
    activePostVariant === "quiz" &&
    isAnswerSubmissionPending &&
    !activeQuizAnswerFeedback;
  const shouldQueryCameraPermission = activePostVariant === "photo";
  const isParticipantAuthExpired = screen.loadErrorVariant === "participant_auth_expired";
  const isJoinSessionMissing = screen.loadErrorVariant === "join_session_missing";
  const isParticipantUnauthorizedRejoin =
    screen.loadErrorVariant === "participant_unauthorized_rejoin";
  const isQuizPostBurned = activePostVariant === "quiz" && activeQuizPostBurned;
  const usesStandardPlayExperience =
    usesStandardStudentLocationExperience &&
    raceMode === "quiz" &&
    (activePostVariant === "quiz" || activePostVariant === "character");
  // Check BOTH arrays — solvedPostIndexes (correct answers) and answeredPostIndexes
  // (wrong answers). Either being true means the post is done and buttons must not render.
  const isCurrentPostAnswered =
    solvedPostIndexes.includes(currentPostIndex) ||
    answeredPostIndexes.includes(currentPostIndex);
  const answeredPostLockMessage = isQuizPostBurned
    ? "Allerede besvaret."
    : "Besvaret. Videre til næste post.";

  useEffect(() => {
    const previewUrl = pendingPhotoSelection?.previewUrl;
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [pendingPhotoSelection?.previewUrl]);

  useEffect(() => {
    if (
      pendingPhotoSelection &&
      (pendingPhotoSelection.key !== activeTypedAnswerKey ||
        hasActivePhotoSuccess ||
        isCurrentPostAnswered)
    ) {
      setPendingPhotoSelection(null);
    }
  }, [
    activeTypedAnswerKey,
    hasActivePhotoSuccess,
    isCurrentPostAnswered,
    pendingPhotoSelection,
  ]);

  const clearLockedPostFeedback = useCallback(() => {
    if (lockedPostFeedbackTimerRef.current !== null) {
      clearTimeout(lockedPostFeedbackTimerRef.current);
      lockedPostFeedbackTimerRef.current = null;
    }
    setLockedPostFeedbackState(null);
  }, []);

  const showLockedPostFeedback = useCallback((message: string) => {
    if (lockedPostFeedbackTimerRef.current !== null) {
      clearTimeout(lockedPostFeedbackTimerRef.current);
      lockedPostFeedbackTimerRef.current = null;
    }

    setLockedPostFeedbackState({
      key: `${Date.now()}`,
      message,
    });

    lockedPostFeedbackTimerRef.current = setTimeout(() => {
      setLockedPostFeedbackState(null);
      lockedPostFeedbackTimerRef.current = null;
    }, LOCKED_POST_FEEDBACK_DURATION_MS);
  }, []);

  const resetRageClickTracker = useCallback(() => {
    const tracker = rageClickRef.current;
    if (tracker.resetTimer) {
      clearTimeout(tracker.resetTimer);
      tracker.resetTimer = null;
    }
    tracker.count = 0;
    tracker.lastTs = 0;
  }, []);

  const registerLockedPostTap = useCallback(() => {
    const now = Date.now();
    const tracker = rageClickRef.current;

    if (now - tracker.lastTs > RAGE_WINDOW_MS) {
      resetRageClickTracker();
    }

    tracker.count += 1;
    tracker.lastTs = now;
    if (tracker.resetTimer) {
      clearTimeout(tracker.resetTimer);
    }
    tracker.resetTimer = setTimeout(() => {
      resetRageClickTracker();
    }, RAGE_WINDOW_MS);

    if (tracker.count >= RAGE_THRESHOLD) {
      setShowRageModal(true);
      resetRageClickTracker();
    }
  }, [RAGE_THRESHOLD, RAGE_WINDOW_MS, resetRageClickTracker]);

  const getLockedPostFeedbackMessage = useCallback(() => {
    if (distance === null) {
      return "Vent lidt — vi finder din position.";
    }

    if (isNearUnlockRadiusForDiagnostics && isGpsAccuracyConcern) {
      return LOCKED_POST_GPS_ACCURACY_MESSAGE;
    }

    if (isTooFarForManualUnlock) {
      return `Du er stadig ca. ${Math.max(1, Math.round(distance))} meter fra posten.`;
    }

    return "Posten kan ikke åbnes endnu.";
  }, [distance, isGpsAccuracyConcern, isNearUnlockRadiusForDiagnostics, isTooFarForManualUnlock]);

  const handleUnlockTargetTap = useCallback(() => {
    if (canManualUnlock) {
      clearLockedPostFeedback();
      safeVibrate(40);
      actions.unlockCurrentPost();
      return;
    }

    safeVibrate([20, 40, 20]);
    showLockedPostFeedback(getLockedPostFeedbackMessage());
    registerLockedPostTap();
  }, [
    actions,
    canManualUnlock,
    clearLockedPostFeedback,
    getLockedPostFeedbackMessage,
    registerLockedPostTap,
    showLockedPostFeedback,
  ]);

  useEffect(() => {
    // Afvis IKKE spørgsmålet automatisk, hvis quiz-succès-feedback er aktiv:
    // brugeren skal selv klikke "Gå til næste post" – selv hvis netværket var nede under besvarelsen.
    if (showQuestion && isCurrentPostAnswered && !hasActiveQuizSuccess) {
      actions.dismissCurrentPost();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQuestion, isCurrentPostAnswered, hasActiveQuizSuccess]);

  useEffect(() => {
    const updateOfflineState = () => {
      setIsOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);
    };

    updateOfflineState();
    window.addEventListener("online", updateOfflineState);
    window.addEventListener("offline", updateOfflineState);

    return () => {
      window.removeEventListener("online", updateOfflineState);
      window.removeEventListener("offline", updateOfflineState);
    };
  }, []);

  useEffect(() => {
    const hasConfirmedSubmission =
      usesStandardStudentLocationExperience
        ? studentSubmission.status === "confirmed"
        : hasActiveQuizSuccess;
    if (!hasConfirmedSubmission) {
      return;
    }

    setShowCloudSyncSuccess(true);
    if (cloudSyncSuccessTimerRef.current) {
      clearTimeout(cloudSyncSuccessTimerRef.current);
    }

    cloudSyncSuccessTimerRef.current = window.setTimeout(() => {
      setShowCloudSyncSuccess(false);
      cloudSyncSuccessTimerRef.current = null;
    }, 2000);
  }, [
    hasActiveQuizSuccess,
    studentSubmission.status,
    usesStandardStudentLocationExperience,
  ]);

  useEffect(() => {
    if (showQuestion || !hasActiveUnlockTarget || canManualUnlock) {
      clearLockedPostFeedback();
    }
  }, [canManualUnlock, clearLockedPostFeedback, currentPostIndex, hasActiveUnlockTarget, showQuestion]);

  useEffect(() => {
    if (showRageModal) {
      // prevent background scroll while modal is open
      prevOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else {
      if (prevOverflowRef.current !== null) {
        document.body.style.overflow = prevOverflowRef.current;
        prevOverflowRef.current = null;
      }
    }

    return () => {
      if (prevOverflowRef.current !== null) {
        document.body.style.overflow = prevOverflowRef.current;
        prevOverflowRef.current = null;
      }
    };
  }, [showRageModal]);

  useEffect(() => {
    return () => {
      if (cloudSyncSuccessTimerRef.current) {
        clearTimeout(cloudSyncSuccessTimerRef.current);
        cloudSyncSuccessTimerRef.current = null;
      }
      if (lockedPostFeedbackTimerRef.current) {
        clearTimeout(lockedPostFeedbackTimerRef.current);
        lockedPostFeedbackTimerRef.current = null;
      }
      if (rageClickRef.current.resetTimer) {
        clearTimeout(rageClickRef.current.resetTimer);
        rageClickRef.current.resetTimer = null;
      }
      if (loadingStuckTimerRef.current !== null) {
        clearTimeout(loadingStuckTimerRef.current);
        loadingStuckTimerRef.current = null;
      }
    };
  }, []);

  // Show "Hjælp, jeg sidder fast" after LOADING_STUCK_DELAY_MS when loading screen is active.
  useEffect(() => {
    if (screen.mode !== "loading") {
      setShowLoadingStuckHelp(false);
      if (loadingStuckTimerRef.current !== null) {
        clearTimeout(loadingStuckTimerRef.current);
        loadingStuckTimerRef.current = null;
      }
      return;
    }
    loadingStuckTimerRef.current = setTimeout(() => {
      setShowLoadingStuckHelp(true);
    }, LOADING_STUCK_DELAY_MS);
    return () => {
      if (loadingStuckTimerRef.current !== null) {
        clearTimeout(loadingStuckTimerRef.current);
        loadingStuckTimerRef.current = null;
      }
    };
  }, [screen.mode]);

  const clearPendingPhotoPickerState = useCallback(() => {
    photoPickerPendingRef.current = false;
    if (photoPickerReturnTimerRef.current !== null) {
      clearTimeout(photoPickerReturnTimerRef.current);
      photoPickerReturnTimerRef.current = null;
    }
  }, []);

  const setCameraError = useCallback((message: string | null) => {
    setCameraErrorState({
      key: activeTypedAnswerKey,
      message,
    });
  }, [activeTypedAnswerKey]);

  const returnToJoin = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.assign("/join");
    }
  }, []);

  const startConnectionRetry = useCallback(
    (fn: () => void) => {
      setIsRetryingConnection(true);
      setShowRetrySlowHint(false);
      retryTimersRef.current.forEach(clearTimeout);
      retryTimersRef.current = [
        setTimeout(() => setShowRetrySlowHint(true), 2000),
        // Re-enable buttons after 6 s if the page hasn't navigated away
        setTimeout(() => setIsRetryingConnection(false), 6000),
      ];
      fn();
    },
    [],
  );

  const handleRetryConnection = useCallback(() => {
    startConnectionRetry(actions.reloadPage);
  }, [startConnectionRetry, actions.reloadPage]);

  const handleRetryRestoreConnectionLocal = useCallback(() => {
    startConnectionRetry(actions.retryRestoreConnection);
  }, [startConnectionRetry, actions.retryRestoreConnection]);

  const handleResetFromExpiredWithFeedback = useCallback(() => {
    setIsResettingFromExpired(true);
    actions.resetFromExpired();
  }, [actions]);

  useEffect(() => {
    return () => {
      retryTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  
  const handleMasterLockSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void actions.submitMasterCode(masterLockInput);
  };

  const handleTypedAnswerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void actions.submitTypedAnswer(typedAnswerInputRef.current?.value ?? "");
  };

  const handlePhotoCapture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    clearPendingPhotoPickerState();
    if (!file) {
      setCameraError(cameraRetryHelpMessage);
      return;
    }
    setCameraError(null);

    if (
      usesStandardStudentLocationExperience &&
      !isSelfiePhotoTask
    ) {
      const nextSelection: PendingPhotoSelection = {
        key: activeTypedAnswerKey,
        file,
        previewUrl: URL.createObjectURL(file),
        operationId: createStudentSubmissionOperationId(),
      };
      actions.preparePhotoSubmission(nextSelection.operationId);
      setPendingPhotoSelection(nextSelection);
      return;
    }

    void actions.submitPhoto(file);
  };

  const submitPendingPhoto = () => {
    if (
      !pendingPhotoSelection ||
      pendingPhotoSelection.key !== activeTypedAnswerKey ||
      isAnswerSubmissionPending ||
      isAnalyzingPhoto
    ) {
      return;
    }

    void actions.submitPhoto(
      pendingPhotoSelection.file,
      pendingPhotoSelection.operationId
    );
  };

  const retryActiveSubmission = () => {
    if (
      studentSubmission.submissionType === "photo" &&
      pendingPhotoSelection?.key === activeTypedAnswerKey
    ) {
      submitPendingPhoto();
      return;
    }

    void actions.retryStudentSubmission();
  };

  const handlePhotoButtonClick = () => {
    setCameraError(null);
    clearPendingPhotoPickerState();

    if (cameraPermissionState === "denied") {
      setCameraError(cameraPermissionMessage);
      return;
    }

    photoPickerPendingRef.current = true;
    photoInputRef.current?.click();
  };

  useEffect(() => {
    if (!hasRoleplayInputErrorTone) return;

    const inputElement = typedAnswerInputRef.current;
    if (!inputElement || typeof inputElement.animate !== "function") {
      return;
    }

    try {
      inputElement.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-8px)" },
          { transform: "translateX(7px)" },
          { transform: "translateX(-5px)" },
          { transform: "translateX(3px)" },
          { transform: "translateX(0)" },
        ],
        {
          duration: 360,
          easing: "ease-in-out",
        }
      );
    } catch (error) {
      console.warn("Tekstfelt-animation understøttes ikke i denne browser:", error);
    }
  }, [activeTypedAnswerKey, hasRoleplayInputErrorTone]);

  useEffect(() => {
    if (!isRoleplayImmersed || activeRoleplayReply) return;

    const timeoutId = window.setTimeout(() => {
      typedAnswerInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeRoleplayReply, activeTypedAnswerKey, isRoleplayImmersed]);

  useEffect(() => {
    let isActive = true;

    if (!shouldQueryCameraPermission || typeof navigator === "undefined") {
      return () => {
        isActive = false;
      };
    }

    const permissions = navigator.permissions;
    if (!permissions || typeof permissions.query !== "function") {
      setCameraPermissionState("unknown");
      return () => {
        isActive = false;
      };
    }

    const queryCameraPermission = async () => {
      try {
        const status = await permissions.query({ name: "camera" as PermissionName });
        if (!isActive) return;
        setCameraPermissionState(status.state);
      } catch (error) {
        if (!isActive) return;
        console.warn("Kamera-tilladelse kan ikke forespørges i denne browser:", error);
        setCameraPermissionState("unknown");
      }
    };

    void queryCameraPermission();

    return () => {
      isActive = false;
    };
  }, [activePostVariant, screen.mode, shouldQueryCameraPermission]);

  useEffect(() => {
    const handlePhotoPickerReturn = () => {
      if (!photoPickerPendingRef.current || document.visibilityState === "hidden") return;

      if (photoPickerReturnTimerRef.current !== null) {
        clearTimeout(photoPickerReturnTimerRef.current);
      }

      photoPickerReturnTimerRef.current = setTimeout(() => {
        if (!photoPickerPendingRef.current) return;
        photoPickerPendingRef.current = false;
        setCameraError(cameraRetryHelpMessage);
        photoPickerReturnTimerRef.current = null;
      }, 280);
    };

    window.addEventListener("focus", handlePhotoPickerReturn);
    document.addEventListener("visibilitychange", handlePhotoPickerReturn);

    return () => {
      window.removeEventListener("focus", handlePhotoPickerReturn);
      document.removeEventListener("visibilitychange", handlePhotoPickerReturn);
      clearPendingPhotoPickerState();
    };
  }, [cameraRetryHelpMessage, clearPendingPhotoPickerState, setCameraError]);

  useEffect(() => {
    clearPendingPhotoPickerState();
  }, [activeTypedAnswerKey, clearPendingPhotoPickerState]);

  const finishedMaxScore = questions.length * 10;
  const finishedScoreRatio = finishedMaxScore > 0 ? score / finishedMaxScore : 0;
  const finishedElapsedSec =
    screen.playFinishedAtMs !== null && screen.playStartedAtMs !== null
      ? (screen.playFinishedAtMs - screen.playStartedAtMs) / 1000
      : null;
  const finishedAvgSecPerPost =
    finishedElapsedSec !== null && questions.length > 0
      ? finishedElapsedSec / questions.length
      : null;
  const gamerTitle = getGamerTitle(finishedScoreRatio, finishedAvgSecPerPost);

  let content: ReactNode;

  switch (screen.mode) {
    case "loading":
      content = (
        <div className="flex h-screen items-center justify-center bg-slate-950 text-emerald-200">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-pulse text-current">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 3v18M3 12h18M5 5l14 14M19 5 5 19" />
              </svg>
            </div>
            <p className="text-sm uppercase tracking-widest">Indlæser mission...</p>
            {showLoadingStuckHelp && (
              <div className="mt-6">
                <p className="mb-3 text-xs text-emerald-200/70">Det tager lidt længere end normalt...</p>
                <button
                  type="button"
                  onClick={handleRetryRestoreConnectionLocal}
                  disabled={isRetryingConnection}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-5 py-3 font-bold text-white transition-all active:scale-95 active:opacity-80 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRetryingConnection ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Genopretter...</>
                  ) : "Hjælp, jeg sidder fast"}
                </button>
              </div>
            )}
          </div>
        </div>
      );
      break;

    case "load_error":
      const isRestoreRecoveryError = screen.loadErrorVariant === "restore_recovery";
      content = (
        <div className="flex h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
          <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_28px_rgba(16,185,129,0.18)] backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
              {isParticipantAuthExpired ? (
                <KeyRound className="h-6 w-6" />
              ) : isJoinSessionMissing ? (
                <XCircle className="h-6 w-6" />
              ) : isParticipantUnauthorizedRejoin ? (
                <XCircle className="h-6 w-6" />
              ) : isRestoreRecoveryError ? (
                <KeyRound className="h-6 w-6" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin" />
              )}
            </div>
            <p className="text-[11px] font-semibold tracking-[0.28em] text-emerald-100/70 uppercase">
              {isParticipantAuthExpired
                ? "Adgangskort udløbet"
                : isJoinSessionMissing
                  ? "Løbet er lukket"
                  : isParticipantUnauthorizedRejoin
                    ? "Tilmeld igen"
                    : isRestoreRecoveryError
                      ? "Genskab forbindelse"
                      : "Klargør mission"}
            </p>
            <h1 className="mt-3 text-2xl font-black text-white">
              {isParticipantAuthExpired
                ? "Hov, du har været væk lidt længe!"
                : isJoinSessionMissing
                  ? "Løbet er muligvis afsluttet"
                  : isParticipantUnauthorizedRejoin
                    ? "Du skal tilmelde dig løbet igen."
                    : isRestoreRecoveryError
                      ? "Vi prøver at hente dig tilbage i løbet"
                      : "Vi gør løbet klar..."}
            </h1>
            <p className={`mt-3 text-sm text-white/80 ${wrapTextClass}`}>{screen.loadError}</p>
            {isParticipantAuthExpired ? (
              <>
                <p className="mt-3 text-xs text-white/60">
                  Dit adgangskort er udløbet. Tryk på &quot;Start forfra&quot; for at rydde op og starte en ny session.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleResetFromExpiredWithFeedback}
                    disabled={isResettingFromExpired || isRetryingConnection}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-5 py-3 font-bold text-white transition-all active:scale-95 active:opacity-80 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isResettingFromExpired ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Rydder op...</>
                    ) : "Start forfra"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRetryConnection}
                    disabled={isRetryingConnection || isResettingFromExpired}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-5 py-3 font-bold text-white transition-all active:scale-95 active:opacity-80 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRetryingConnection ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Genopretter...</>
                    ) : "Genopret forbindelse"}
                  </button>
                </div>
                {showRetrySlowHint && (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-center text-xs text-white/60">
                      Vi forsøger at genoprette forbindelsen...
                    </p>
                    <p className="text-center text-xs text-white/50">
                      Prøv at skifte til mobildata og tryk &quot;Genopret forbindelse&quot; igen.
                    </p>
                  </div>
                )}
                <WifiConnectionTip className="mt-4 text-left" />
              </>
            ) : isJoinSessionMissing ? (
              <>
                <p className="mt-3 text-xs text-white/60">
                  Vi prøver ikke automatisk igen. Gå tilbage til join-skærmen for at hente en ny kode eller vente på læreren.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={returnToJoin}
                    className="inline-flex items-center justify-center rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-5 py-3 font-bold text-white transition-all active:scale-95 active:opacity-80 hover:bg-emerald-500/30"
                  >
                    Gå til join
                  </button>
                  <button
                    type="button"
                    onClick={handleRetryConnection}
                    disabled={isRetryingConnection}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-5 py-3 font-bold text-white transition-all active:scale-95 active:opacity-80 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRetryingConnection ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Genopretter...</>
                    ) : "Prøv igen"}
                  </button>
                </div>
                {showRetrySlowHint && (
                  <p className="mt-3 text-center text-xs text-white/60">
                    Vi forsøger at genoprette forbindelsen...
                  </p>
                )}
              </>
            ) : isParticipantUnauthorizedRejoin ? (
              <>
                <p className="mt-3 text-xs text-white/60">
                  {screen.loadError}
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={returnToJoin}
                    className="inline-flex items-center justify-center rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-5 py-3 font-bold text-white transition-all active:scale-95 active:opacity-80 hover:bg-emerald-500/30"
                  >
                    Gå til join
                  </button>
                </div>
              </>
            ) : isRestoreRecoveryError ? (
              <>
                <p className="mt-3 text-xs text-white/60">
                  Din fremdrift bliver ikke nulstillet. Vi forsøger bare at genskabe forbindelsen til din deltager.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleRetryRestoreConnectionLocal}
                    disabled={isRetryingConnection || isResettingFromExpired}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-5 py-3 font-bold text-white transition-all active:scale-95 active:opacity-80 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRetryingConnection ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Genopretter...</>
                    ) : "Genopret forbindelse"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRetryConnection}
                    disabled={isRetryingConnection || isResettingFromExpired}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-5 py-3 font-bold text-white transition-all active:scale-95 active:opacity-80 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRetryingConnection ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Genopretter...</>
                    ) : "Genindlæs siden helt"}
                  </button>
                </div>
                {showRetrySlowHint && (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-center text-xs text-white/60">
                      Vi forsøger at genoprette forbindelsen...
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFromExpiredWithFeedback}
                      disabled={isResettingFromExpired}
                      className="inline-flex items-center justify-center gap-2 text-xs text-white/50 underline underline-offset-2 transition-all active:opacity-60 disabled:opacity-40"
                    >
                      {isResettingFromExpired ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Rydder op...</>
                      ) : "Start forfra (slet lokal session)"}
                    </button>
                  </div>
                )}
                <WifiConnectionTip className="mt-4 text-left" />
              </>
            ) : (
              <button
                type="button"
                onClick={handleRetryConnection}
                disabled={isRetryingConnection}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200/30 bg-white/10 px-5 py-3 font-bold text-white transition-all active:scale-95 active:opacity-80 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetryingConnection ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Genopretter...</>
                ) : "Prøv igen"}
              </button>
            )}
          </div>
        </div>
      );
      break;

    case "kicked":
      content = (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-red-950 via-[#2a0606] to-[#130303] px-6 text-white">
          <div className="w-full max-w-2xl rounded-3xl border border-red-400/40 bg-red-900/20 p-8 text-center shadow-[0_0_40px_rgba(239,68,68,0.25)] backdrop-blur-md">
            <h1 className="text-3xl font-black md:text-4xl">
              Du er blevet fjernet fra løbet af arrangøren.
            </h1>
          </div>
        </div>
      );
      break;

    case "name_gate":
      content = (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
          <StudentNameGateView
            tone="emerald"
            title="Navngiv holdet"
            description="Start med at skrive jeres holdnavn, så vi ved hvem der er på vej ind i løbet."
            label="Holdnavn"
            placeholder="Skriv holdnavn"
            helperText="Brug jeres rigtige holdnavn. Det bliver vist for læreren under løbet."
            value={pendingPlayerName}
            error={nameError}
            isSubmitting={isProvisioningParticipant}
            submitLabel="Klar"
            submittingLabel="Klargør hold..."
            onChange={actions.setPendingPlayerName}
            onSubmit={actions.confirmName}
          />
        </div>
      );
      break;

    case "escape_master_lock":
      content = (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.24),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.72)_0%,rgba(2,6,23,0.94)_52%,rgba(2,6,23,1)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(120,53,15,0.42),transparent_38%)] blur-2xl" />

          {masterLockStatus === "unlocked" ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 16 }).map((_, index) => (
                <span
                  key={`master-lock-spark-${index}`}
                  className="absolute h-3 w-3 rounded-full bg-gradient-to-br from-amber-200 via-yellow-300 to-orange-400 opacity-0 animate-[master-lock-spark_1.2s_ease-out_forwards]"
                  style={{
                    top: `${18 + (index % 5) * 12}%`,
                    left: `${10 + ((index * 6) % 80)}%`,
                    animationDelay: `${(index % 8) * 0.08}s`,
                  }}
                />
              ))}
            </div>
          ) : null}

          <div
            key={`master-lock-${masterLockStatus}-${masterLockShakeNonce}`}
            className={`relative z-10 w-full max-w-xl overflow-hidden rounded-[2rem] border p-8 shadow-[0_30px_90px_rgba(2,6,23,0.55)] backdrop-blur-xl ${
              masterLockStatus === "unlocked"
                ? "border-amber-300/40 bg-amber-900/30"
                : `${masterLockError ? "animate-[master-lock-shake_0.45s_ease-in-out]" : ""} border-white/20 bg-slate-900`
            }`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_32%)]" />

            {showMasterVictory ? (
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.16),transparent_42%)]" />
                <div className="absolute inset-0 opacity-90">
                  <LottiePlayer autoplay loop src={FIREWORKS_LOTTIE_URL} style={{ width: "100%", height: "100%" }} />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                  <div className="h-36 w-36 drop-shadow-[0_0_35px_rgba(251,191,36,0.45)]">
                    <Lottie animationData={trophyAnimation} loop={true} />
                  </div>
                  <p className="mt-4 text-xs font-semibold tracking-[0.32em] text-amber-200/80 uppercase">
                    Vinder-fejring
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-amber-50">Master-låsen er brudt op!</h2>
                  <p className="mt-3 text-sm font-semibold text-amber-100/90">Resultatet gøres klar...</p>
                </div>
              </div>
            ) : null}

            <div className="relative text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 text-6xl shadow-[0_0_35px_rgba(245,158,11,0.18)]">
                🔒
              </div>

              <p className="mt-6 text-xs font-semibold tracking-[0.32em] text-amber-200/80 uppercase">
                Master-lås
              </p>
              <h1 className="mt-3 break-words text-3xl font-black text-white md:text-4xl">
                Du er næsten i mål!
              </h1>
              <p className="mt-4 break-words text-base leading-relaxed text-amber-50/88">
                Indtast den samlede Master-kode fra alle posterne for at vinde løbet.
              </p>
              <p className="mt-3 text-sm text-white/90">
                Kode-brikker samlet: {correctAnswersCount}/{questions.length}
              </p>

              {hasAllEscapeBricks ? (
                <div className="mt-6 rounded-[1.6rem] border border-emerald-300/25 bg-emerald-500/10 px-5 py-4 text-left shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-200">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.28em] text-white/80 uppercase">
                        Klar til at vinde
                      </p>
                      <p className={`mt-2 text-base font-bold text-emerald-50 ${wrapTextClass}`}>
                        Alle kode-brikker er fundet. Indtast master-koden for at vinde løbet.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-8 rounded-[1.75rem] border border-amber-500/25 bg-amber-900/25 p-5 text-left">
                <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                  Deltager
                </p>
                <p className={`mt-2 text-xl font-black text-amber-50 ${wrapTextClass}`}>
                  {activeDisplayName}
                </p>
              </div>

              <div className="mt-4 rounded-[1.75rem] border border-amber-500/25 bg-amber-900/20 p-5 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-amber-100">
                    <KeyRound className="h-4 w-4" />
                    <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                      Kode-oversigt
                    </p>
                  </div>
                  <p className="text-xs font-bold text-amber-50">
                    {collectedEscapeRewardsCount}/{questions.length}
                  </p>
                </div>

                <p className="mt-4 text-sm text-amber-100/75">Dine brikker</p>
                <p
                  className={`mt-3 rounded-2xl border border-amber-300/12 bg-black/20 px-4 py-4 text-center text-2xl font-black tracking-[0.34em] text-amber-100 ${wrapTextClass}`}
                >
                  {escapeCodeOverviewText}
                </p>
              </div>

              <form onSubmit={handleMasterLockSubmit} className="mt-6 space-y-4">
                <input
                  type="text"
                  value={masterLockInput}
                  disabled={masterLockStatus === "unlocked" || isFinalizingEscape || isSubmitting}
                  onChange={(event) => actions.setMasterLockInput(event.target.value.toLocaleUpperCase("da-DK"))}
                  placeholder="Indtast hele master-koden"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-center text-2xl font-black tracking-[0.35em] text-amber-50 outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-default disabled:opacity-80"
                />

                {masterLockError ? (
                  <div
                    className={`rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 ${wrapTextClass}`}
                  >
                    {masterLockError}
                  </div>
                ) : null}

                {masterLockStatus === "unlocked" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-50">
                      Låsen giver efter! Resultatet venter lige foran dig.
                    </div>
                    <button
                      type="button"
                      onClick={() => actions.setShowEscapeResults(true)}
                      disabled={showMasterVictory}
                      className="w-full rounded-2xl bg-amber-400 px-5 py-4 text-base font-black tracking-[0.24em] text-slate-950 uppercase transition hover:bg-amber-300"
                    >
                      Se din placering
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={isFinalizingEscape || isSubmitting}
                    className="w-full rounded-2xl border border-amber-400/30 bg-amber-400/90 px-5 py-4 text-base font-black tracking-[0.24em] text-slate-950 uppercase transition hover:bg-amber-300"
                  >
                    {isFinalizingEscape ? "Åbner låsen..." : "Bryd låsen op"}
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      );
      break;

    case "escape_results":
      content = (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.2),transparent_30%),radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(139,92,246,0.12),transparent_24%),linear-gradient(180deg,rgba(3,7,18,0.78)_0%,rgba(2,6,23,0.92)_55%,rgba(2,6,23,1)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(120,53,15,0.4),transparent_36%)] blur-3xl" />

          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/78 p-8 shadow-[0_32px_90px_rgba(2,6,23,0.56)] backdrop-blur-2xl sm:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_28%)]" />

            <div className="relative">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold tracking-[0.32em] text-amber-200/70 uppercase">
                    Escape-finale
                  </p>
                  <h1 className={`mt-3 text-3xl font-black text-white sm:text-4xl ${wrapTextClass}`}>
                    Du klarede det!
                  </h1>
                  <p className={`mt-4 text-base leading-7 text-amber-50/85 sm:text-lg ${wrapTextClass}`}>
                    Her er placeringen, nu hvor master-låsen er brudt op og målgangen er registreret.
                  </p>
                </div>

                <div className="rounded-[1.6rem] border border-amber-300/20 bg-amber-500/10 px-5 py-4 text-left shadow-[0_18px_40px_rgba(245,158,11,0.12)]">
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                    Deltager
                  </p>
                  <p className={`mt-2 text-xl font-black text-amber-50 ${wrapTextClass}`}>
                    {activeDisplayName}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr,1.3fr]">
                <div className="rounded-[1.8rem] border border-emerald-300/18 bg-emerald-950/35 p-6 shadow-[0_20px_45px_rgba(16,185,129,0.12)] backdrop-blur-xl">
                  <p className="text-xs font-semibold tracking-[0.26em] text-white/80 uppercase">
                    Jeres placering
                  </p>

                  {isLoadingEscapeResults ? (
                    <div className="mt-5 flex items-center gap-3 text-emerald-100/80">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className={wrapTextClass}>Henter ranglisten...</span>
                    </div>
                  ) : myEscapePlacement ? (
                    <>
                      <p className="mt-4 text-5xl font-black text-emerald-200">
                        {formatPlacement(myEscapePlacement.place)}
                      </p>
                      <p className={`mt-3 text-sm text-emerald-50/80 ${wrapTextClass}`}>
                        Registreret kl. {formatFinishedAt(myEscapePlacement.finishedAt)}
                      </p>
                    </>
                  ) : (
                    <p className={`mt-4 text-sm text-emerald-50/80 ${wrapTextClass}`}>
                      Jeres placering bliver opdateret, så snart målgangen er synkroniseret.
                    </p>
                  )}
                </div>

                <div className="rounded-[1.8rem] border border-violet-300/18 bg-violet-950/24 p-6 shadow-[0_20px_45px_rgba(91,33,182,0.14)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold tracking-[0.26em] text-violet-200/70 uppercase">
                      Rangliste
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-white/60 uppercase">
                      {escapeResults.length} deltagere
                    </span>
                  </div>

                  {isLoadingEscapeResults ? (
                    <div className="mt-5 flex items-center gap-3 text-violet-100/80">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className={wrapTextClass}>Henter placeringer...</span>
                    </div>
                  ) : escapeResultsError ? (
                    <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-violet-100/85">
                      <p className={wrapTextClass}>Placeringerne synkroniserer stadig. Kig igen om et øjeblik.</p>
                    </div>
                  ) : escapeResults.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {escapeResults.map((entry) => {
                        const isCurrentTeam =
                          entry.studentName.trim().toLocaleLowerCase("da-DK") ===
                          normalizedActiveDisplayName;

                        return (
                          <div
                            key={`${entry.studentName}-${entry.place}`}
                            className={`rounded-[1.35rem] border px-4 py-3 backdrop-blur-md ${
                              isCurrentTeam
                                ? "border-amber-300/30 bg-amber-500/12 shadow-[0_16px_34px_rgba(245,158,11,0.12)]"
                                : "border-white/10 bg-black/18"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold tracking-[0.22em] text-white/45 uppercase">
                                  {formatPlacement(entry.place)}
                                </p>
                                <p className={`mt-1 text-lg font-black text-white ${wrapTextClass}`}>
                                  {entry.studentName}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-amber-100/80">
                                {formatFinishedAt(entry.finishedAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={`mt-5 text-sm text-violet-100/80 ${wrapTextClass}`}>
                      Ingen placeringer er registreret endnu.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4 text-sm text-amber-50/85 backdrop-blur-xl">
                <p className={wrapTextClass}>
                  Kig op på arrangørens skærm, hvis I også vil se den store fælles finale.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
      break;

    case "finished":
      content = (
        <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.25),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(circle_at_50%_90%,rgba(139,92,246,0.16),transparent_40%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-80">
            <LottiePlayer autoplay loop src={FIREWORKS_LOTTIE_URL} style={{ width: "100%", height: "100%" }} />
          </div>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 20 }).map((_, index) => (
              <span
                key={`student-confetti-${index}`}
                className="absolute h-2.5 w-2.5 animate-pulse rounded-full bg-gradient-to-br from-amber-300 via-emerald-300 to-violet-300 shadow-[0_0_10px_rgba(255,255,255,0.35)]"
                style={{
                  top: `${(index * 29) % 100}%`,
                  left: `${(index * 17) % 100}%`,
                  animationDelay: `${(index % 8) * 0.22}s`,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 mt-10 w-full max-w-lg rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-[0_0_45px_rgba(251,191,36,0.3)] backdrop-blur-xl">
            <div className="mx-auto mb-6 h-24 w-24 max-w-[96px] aspect-square drop-shadow-2xl sm:h-28 sm:w-28">
              <Lottie animationData={trophyAnimation} loop={true} />
            </div>
            <h1 className="mb-2 bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 bg-clip-text text-2xl md:text-4xl font-black tracking-widest text-transparent uppercase">
              Mission
              <br />
              Fuldført!
            </h1>
            <p className={`mb-3 text-base md:text-lg font-bold text-emerald-100 ${wrapTextClass}`}>
              Fantastisk gået, {playerName || "mester"}!
            </p>
            <p
              className={`mb-6 text-xs md:text-sm font-semibold tracking-wide text-amber-100 uppercase ${wrapTextClass}`}
            >
              KÆMPE TILLYKKE, {celebrationName}! Du er i mål!
            </p>
            <div className="mb-6 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold tracking-[0.26em] text-violet-200/70 uppercase">
                Officiel Skolegårds-Titel
              </p>
              <p className="mt-1 whitespace-normal break-words text-sm font-black text-violet-100">
                {gamerTitle}
              </p>
            </div>
            <div className="rounded-xl border border-white/20 bg-black/35 px-4 py-3 text-sm font-medium text-slate-100">
              Løbet er slut. Kig op på arrangørens skærm og se den store podie-fejring!
            </div>
          </div>

          {/* Bonus CTA — kun synlig hvis løbet har nok gyldige quizspørgsmål (bonusAvailable) */}
          {bonusAvailable && (
            <a
              href={`/play/${sessionId}/bonus?name=${encodeURIComponent(playerName || "")}`}
              data-testid="bonus-cta"
              className="relative z-10 mt-4 w-full max-w-lg flex flex-col items-center gap-2 rounded-3xl border border-yellow-400/40 bg-yellow-950/50 px-6 py-5 text-center shadow-[0_0_32px_rgba(251,191,36,0.15)] backdrop-blur-xl transition hover:bg-yellow-950/70 active:scale-[0.99]"
            >
              <span className="text-base font-black text-yellow-300">
                Færdig før de andre? 🏆
              </span>
              <span className="text-xs leading-relaxed text-yellow-100/70">
                Prøv bonusspillet og se, om du kan komme øverst på bonuslisten.
              </span>
              <span className="text-[11px] text-yellow-100/40">
                Bonuspoint tæller ikke med i dit normale løbsresultat.
              </span>
              <span className="mt-1 inline-block rounded-xl bg-yellow-400 px-5 py-2 text-xs font-black text-slate-900 shadow-md">
                Start bonusspil
              </span>
            </a>
          )}
        </div>
      );
      break;

    case "waiting":
      content = <WaitingScreenContent actions={actions} />;
      break;

    case "active":
      if (usesStandardPlayExperience) {
        content = (
          <StandardStudentPlayExperience
            ui={ui}
            actions={actions}
            onRetrySubmission={retryActiveSubmission}
          >
            {children}
          </StandardStudentPlayExperience>
        );
        break;
      }

      content = (
        <div
          className={`relative flex h-[100svh] min-h-[100svh] w-full flex-col overflow-hidden bg-slate-950 text-white ${poppins.className}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_80%_8%,rgba(34,197,94,0.1),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.92)_52%,rgba(2,6,23,1)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_60%)]" />

          {showVm26Badge && !isRoleplayImmersed ? (
            <div className="pointer-events-none absolute inset-x-4 top-4 z-[900] sm:hidden">
              <Vm26PlayBadge compact />
            </div>
          ) : null}

          {vm26GoalFeedback ? (
            <div className="pointer-events-none fixed inset-x-4 top-20 z-[2400] flex justify-center sm:top-6">
              <div
                key={vm26GoalFeedback.id}
                className="animate-in fade-in zoom-in-95 rounded-[1.35rem] border border-amber-200/55 bg-emerald-950/92 px-6 py-4 text-center shadow-[0_20px_60px_rgba(16,185,129,0.32)] backdrop-blur-2xl duration-200"
              >
                <p className={`text-2xl font-black text-amber-100 sm:text-3xl ${rubik.className}`}>
                  {vm26GoalFeedback.message}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-100/85">
                  Pokaljagten fortsætter
                </p>
              </div>
            </div>
          ) : null}

          <div
            className={`hidden sm:block absolute inset-x-4 top-4 z-[1000] space-y-4 transition-all duration-300 ${isRoleplayImmersed ? "pointer-events-none opacity-0 blur-md" : "opacity-100"}`}
          >
            {showVm26Badge ? <Vm26PlayBadge /> : null}
            <div className={tacticalHudShellClass}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_30%)]" />
              <div className="relative flex flex-col gap-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={tacticalPillClass}>
                        Deltager
                      </span>
                      <span className={`${tacticalPillClass} border-white/30 bg-slate-700 text-white`}>
                        Nature-Glass
                      </span>
                    </div>

                    {isEscapeRace ? (
                      <div className="overflow-hidden rounded-[1.6rem] border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-2xl">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-white">
                            <KeyRound className="h-4 w-4" />
                            <p className={tacticalMetaLabelClass}>
                              Kode-oversigt
                            </p>
                          </div>
                          <span className={`${tacticalPillClass} px-3 py-1`}>
                            {collectedEscapeRewardsCount}/{questions.length}
                          </span>
                        </div>
                        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-white/70">
                          Dine brikker
                        </p>
                        <p className={`mt-2 text-xl font-black tracking-[0.3em] text-white/90 ${wrapTextClass}`}>
                          {escapeCodeOverviewText}
                        </p>
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-[1.35fr,1fr]">
                      <div className={tacticalHudCardClass}>
                        <p className={tacticalMetaLabelClass}>
                          Deltagernavn
                        </p>
                        <p className={`mt-2 text-xl md:text-2xl font-black text-white ${wrapTextClass}`}>
                          {activeDisplayName}
                        </p>
                        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-white/70">
                          Find post {displayPostNumber} af {questions.length}
                        </p>
                      </div>

                      <div className={tacticalHudCardClass}>
                        <p className={tacticalMetaLabelClass}>
                          Afstand
                        </p>
                        <p
                          className={`mt-2 text-2xl md:text-3xl font-black ${
                            gpsOverrideEnabled || isWithinAutoUnlockRadius
                              ? "text-white"
                              : "text-white/90"
                          }`}
                        >
                          {gpsOverrideEnabled ? "God Mode" : distance !== null ? `${distance}m` : "Søger GPS..."}
                        </p>
                        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-white/70">
                          {gpsOverrideEnabled
                            ? "GPS-kravet er slået fra for denne session."
                            : autoUnlockRadius !== null
                              ? usesStandardStudentLocationExperience
                                ? "Når du er fremme, kan du selv åbne posten."
                                : `GPS låser automatisk op inden for ${autoUnlockRadius} meter.`
                              : "GPS-radius hentes..."}
                        </p>
                      </div>
                    </div>

                    <div className={tacticalHudCardClass}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={tacticalMetaLabelClass}>
                            Fremskridt
                          </p>
                          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-white/70">
                            Du er {progressPercent}% gennem ruten.
                          </p>
                        </div>
                        <p className="font-mono text-xs font-black uppercase tracking-widest text-white/90">
                          {correctAnswersCount}/{questions.length}
                        </p>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.35)] transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:items-end">
                    {!isEscapeRace ? (
                      <div className="inline-flex items-center gap-3 self-start rounded-[1.75rem] border border-white/20 bg-white/10 px-3 py-3 shadow-lg backdrop-blur-2xl md:self-auto">
                          <div className="flex h-[3.5rem] w-[3.5rem] items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
                          <div className="text-center">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-white/70">
                              Point
                            </p>
                              <div className="mt-1 flex items-center justify-center gap-2">
                                <p className="text-2xl font-black text-white md:text-3xl">{score}</p>

                                {usesStandardStudentLocationExperience &&
                                studentSubmission.status === "submitting" ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.12)]">
                                    <Cloud className="h-3.5 w-3.5 shrink-0" />
                                    <span>Sender…</span>
                                  </span>
                                ) : usesStandardStudentLocationExperience &&
                                  pendingAnswerCount > 0 &&
                                  studentSubmission.status !==
                                    "awaiting_confirmation" &&
                                  studentSubmission.status !==
                                    "retryable_error" &&
                                  studentSubmission.status !== "rejected" &&
                                  studentSubmission.status !==
                                    "session_closed" ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-100">
                                    <CloudOff className="h-3.5 w-3.5 shrink-0" />
                                    <span>Gemt på telefonen</span>
                                  </span>
                                ) : !usesStandardStudentLocationExperience &&
                                  isAnswerSubmissionPending ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.12)] animate-pulse">
                                    <Cloud className="h-3.5 w-3.5 shrink-0" />
                                    <span>Gemmer i skyen...</span>
                                  </span>
                                ) : isOffline &&
                                  !usesStandardStudentLocationExperience ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
                                    <CloudOff className="h-3.5 w-3.5 shrink-0" />
                                    <span>Gemt lokalt</span>
                                  </span>
                                ) : showCloudSyncSuccess ? (
                                  <span className="inline-flex items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-500/10 p-1.5 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <span className="sr-only">Synkroniseret</span>
                                  </span>
                                ) : null}
                              </div>
                          </div>
                        </div>
                        <div>
                          <p className={tacticalMetaLabelClass}>
                            Medalje
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white/85">
                            Dine point kommer fra de rigtige svar, ikke bare antal poster.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {hasActiveUnlockTarget &&
                    (!usesStandardStudentLocationExperience ||
                      gpsOverrideEnabled ||
                      dismissedPostIndex === currentPostIndex) ? (
                      <div className="w-full">
                        <button
                          type="button"
                          aria-disabled={!canManualUnlock}
                          onClick={handleUnlockTargetTap}
                          className={
                            canManualUnlock
                              ? "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[1.35rem] border border-emerald-300/45 bg-linear-to-r from-emerald-500 to-teal-400 px-5 py-4 text-base font-black normal-case text-slate-950 shadow-[0_18px_40px_rgba(16,185,129,0.28)] transition-all hover:brightness-110 active:scale-[0.99]"
                              : distance !== null
                                ? "inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[1.35rem] border border-rose-300/25 bg-rose-500/10 px-5 py-4 text-base font-black normal-case text-rose-50/90 shadow-[0_0_0_1px_rgba(244,63,94,0.12)] transition-all active:scale-[0.99]"
                                : "inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[1.35rem] border border-slate-600 bg-slate-800 px-5 py-4 text-base font-black normal-case text-white/70 shadow-none transition-all active:scale-[0.99]"
                          }
                        >
                          {gpsOverrideEnabled
                            ? "Åbn post (God Mode)"
                            : dismissedPostIndex === currentPostIndex
                              ? "Åbn gåden igen"
                              : canManualUnlock
                                ? "Åbn post"
                                : distance === null
                                  ? "Søger GPS..."
                                  : `Gå ${manualUnlockDistanceToGo ?? 1}m tættere på for at åbne`}
                        </button>

                        {lockedPostFeedback ? (
                          <div key={lockedPostFeedbackState?.key} className="mt-3 animate-in slide-in-from-top fade-in duration-300">
                            <div
                              role="status"
                              aria-live="polite"
                              className="flex items-start gap-3 rounded-[1.35rem] border border-amber-300/30 bg-amber-500/12 px-4 py-3 text-sm text-amber-50 shadow-[0_16px_34px_rgba(245,158,11,0.12)]"
                            >
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                              <p className={`font-semibold ${wrapTextClass}`}>{lockedPostFeedback}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {showGpsDiagnostics ? (
                      <div className="overflow-hidden rounded-[1.6rem] border border-white/20 bg-slate-900/80 p-4 shadow-lg backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className={tacticalMetaLabelClass}>
                              GPS-diagnose
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white/85">
                              Ekstra info om hvorfor posten stadig er låst.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-3 py-3">
                            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-white/55">
                              Afstand
                            </p>
                            <p className="mt-2 text-base font-black text-white">
                              {distanceDiagnosticsLabel}
                            </p>
                          </div>

                          <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-3 py-3">
                            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-white/55">
                              GPS-præcision
                            </p>
                            <p className="mt-2 text-base font-black text-white">
                              {accuracyDiagnosticsLabel}
                            </p>
                          </div>

                          <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-3 py-3">
                            <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-white/55">
                              Låser op inden for
                            </p>
                            <p className="mt-2 text-base font-black text-white">
                              {unlockRadiusDiagnosticsLabel}
                            </p>
                          </div>
                        </div>

                        {isNearUnlockRadiusForDiagnostics && isGpsAccuracyConcern ? (
                          <p className={`mt-4 text-sm leading-6 text-amber-100/90 ${wrapTextClass}`}>
                            {LOCKED_POST_GPS_ACCURACY_MESSAGE}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {resumeMessage ? (
              <div className="animate-in slide-in-from-top fade-in duration-500">
                <div className="flex items-start gap-3 rounded-[1.5rem] border border-white/20 bg-slate-800 p-4 shadow-lg">
                  <div className="mt-0.5 rounded-full border border-white/20 bg-slate-700 p-2 text-white">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className={`text-sm font-medium text-white ${wrapTextClass}`}>{resumeMessage}</div>
                </div>
              </div>
            ) : null}

            {wrongAnswerFeedback ? (
              <div className="animate-in slide-in-from-top fade-in duration-500">
                <div className="flex items-start gap-3 rounded-[1.5rem] border border-red-300/30 bg-red-900/60 p-4 shadow-lg">
                  <div className="mt-0.5 rounded-full border border-red-300/30 bg-red-500/30 p-2 text-red-200">
                    <XCircle className="h-4 w-4" />
                  </div>
                  <div className={`text-sm font-semibold text-red-100 ${wrapTextClass}`}>{wrongAnswerFeedback}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={`pointer-events-none absolute inset-x-4 bottom-20 z-[950] flex justify-center transition-all duration-300 ${
              isRoleplayImmersed ? "opacity-0 blur-md" : "opacity-100"
            }`}
          >
            <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-widest text-white shadow-lg backdrop-blur-2xl">
              <span className="text-white/90">Tip:</span> Hold skærmen tændt mens du går, så arrangøren kan se dig på kortet!
            </div>
          </div>

          {/* Mobile compact HUD: visible only on small screens and keeps map visible */}
          {!isRoleplayImmersed ? (
            <div className="sm:hidden fixed inset-x-4 bottom-4 z-[1100] flex items-end justify-center">
              <MobileHudComponent
                mobileHudOpen={mobileHudOpen}
                setMobileHudOpen={setMobileHudOpen}
                activeDisplayName={activeDisplayName}
                progressPercent={progressPercent}
                score={score}
                correctAnswersCount={correctAnswersCount}
                questionsLength={questions.length}
                distance={distance}
                gpsOverrideEnabled={gpsOverrideEnabled}
              />
            </div>
          ) : null}

          <TeacherBroadcastModal
            message={latestMessage}
            onDismiss={actions.dismissLatestMessage}
          />

          {showRageModal ? (
            <div className="fixed inset-0 z-[2300] flex items-center justify-center bg-slate-950/82 px-4 py-6 backdrop-blur-md">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06),transparent_32%),radial-gradient(circle_at_bottom,rgba(34,197,94,0.06),transparent_30%)]" />
              <div className="relative w-full max-w-md overflow-hidden rounded-[1.6rem] border border-emerald-400/30 bg-gradient-to-br from-slate-900/60 to-slate-950/80 p-6 text-white shadow-[0_40px_120px_rgba(2,6,23,0.75)]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.03),transparent_34%)]" />

                <div className="relative flex flex-col items-center text-center">
                  <h2 className="text-2xl font-black">Rolig nu, hurtigløber! 🏃💨</h2>
                  <p className={`mt-4 text-sm leading-relaxed text-white/90 ${wrapTextClass}`}>
                    Knappen er rød, fordi du stadig er lidt for langt væk fra posten. Gå lidt tættere på, indtil knappen lyser GRØN! 🟢
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowRageModal(false)}
                    className="mt-6 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[1.35rem] border border-emerald-300 bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-950 shadow-md transition hover:bg-emerald-500"
                  >
                    Okay, jeg går tættere på!
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="absolute inset-0 z-[1] h-full w-full">
            {children}
          </div>

          {showQuestion && activeQuestion ? (
            <div className="animate-in fade-in zoom-in absolute inset-0 z-[2000] overflow-y-auto bg-slate-950 p-6 duration-300">
              <div className="flex min-h-full items-center justify-center">
                <div className={tacticalOverlayCardClass}>
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <span className={tacticalPillClass}>Mission Device</span>
                    <span className={tacticalMetaLabelClass}>Post {displayPostNumber}</span>
                  </div>
                  {usesStandardStudentLocationExperience ? (
                    <div className="mb-5">
                      <StudentSubmissionStatus
                        state={studentSubmission}
                        onRetry={retryActiveSubmission}
                        retryDisabled={
                          isAnswerSubmissionPending || isAnalyzingPhoto
                        }
                      />
                    </div>
                  ) : null}
                {activePostVariant === "escape" ? (
                  <div className="mb-6">
                    <h2 className={`text-2xl font-black text-white ${wrapTextClass} ${rubik.className}`}>
                      Løs gåden for at få en kode-brik
                    </h2>
                  </div>
                ) : null}

                {activeQuestion.mediaUrl &&
                activePostVariant !== "escape" &&
                activePostVariant !== "photo" ? (
                  <div className="mb-5 overflow-hidden rounded-xl border border-emerald-500/20">
                    <Image
                      src={activeQuestion.mediaUrl}
                      alt="Spørgsmålsmedie"
                      width={800}
                      height={450}
                      className="h-auto w-full object-cover"
                      unoptimized
                      loader={({ src }) => src}
                    />
                  </div>
                ) : null}

                {activePostVariant === "quiz" ? (
                  <>
                    {/* Musikquiz: audio-preview — artwork og metadata skjules for eleven */}
                    {activeQuestion.previewUrl ? (
                      <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                          🎵 Lyt til musikklippet
                        </p>
                        <audio
                          controls
                          src={activeQuestion.previewUrl}
                          className="w-full"
                        />
                      </div>
                    ) : null}

                    <div className="mb-6 flex items-start justify-between gap-3">
                      <p className={`flex-1 text-2xl font-black text-white ${wrapTextClass} ${rubik.className}`}>
                        {activeQuestion.text}
                      </p>
                      <QuestionTtsButton question={activeQuestion.text} answers={activeQuestion.answers} />
                    </div>

                    {/* PRIMITIVE GUARD: if post is answered (correct OR wrong) and no active success feedback, show lock message */}
                    {isCurrentPostAnswered && !hasActiveQuizSuccess ? (
                      <p className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                        {answeredPostLockMessage}
                      </p>
                    ) : null}

                    {/* Continue button after a correct answer (quiz success state) */}
                    {hasActiveQuizSuccess ? (
                      <div className="mt-5">
                        <div className="mb-3 rounded-2xl border border-emerald-300/30 bg-emerald-500/12 px-4 py-3 text-center text-sm font-semibold text-emerald-100">
                          Korrekt! Du får point.
                        </div>
                        <button
                          type="button"
                          onClick={() => void actions.continueFromSolvedPost()}
                          className={quizContinueButtonClass}
                        >
                          {correctAnswersCount < questions.length ? "Gå til næste post" : "Se resultat"}
                        </button>

                        {activePostActionError ? (
                          <div
                            className={`mt-3 rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                          >
                            {activePostActionError}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Answer buttons — only rendered when post is genuinely unanswered */}
                    {!isCurrentPostAnswered && !hasActiveQuizSuccess ? (
                      <>
                        {isQuizPostBurned ? (
                          <div className="rounded-[1.35rem] border border-red-300/30 bg-red-500/12 px-4 py-4 text-sm font-semibold text-red-50">
                            {answeredPostLockMessage}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {activeQuestion.answers.map((answer, idx) => {
                              const isSelectedFeedback = activeQuizAnswerFeedback?.selectedIndex === idx;
                              const isSuccessAnswer =
                                isSelectedFeedback && activeQuizAnswerFeedback?.tone === "success";
                              const isErrorAnswer =
                                isSelectedFeedback && activeQuizAnswerFeedback?.tone === "error";
                              const isAnswerDimmed = Boolean(activeQuizAnswerFeedback) && !isSelectedFeedback;

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  disabled={
                                    isClosing ||
                                    isQuizPostBurned ||
                                    Boolean(activeQuizAnswerFeedback) ||
                                    isAnswerSubmissionPending ||
                                    isStandardSubmissionBlockingInput
                                  }
                                  onClick={() => void actions.submitQuizAnswer(idx)}
                                  className={`flex min-h-[56px] w-full items-center justify-between gap-3 overflow-hidden rounded-[1.35rem] border p-4 text-left text-base font-black uppercase tracking-[0.2em] transition-all sm:text-lg ${wrapTextClass} ${rubik.className} ${
                                    isSuccessAnswer
                                      ? "border-emerald-300 bg-emerald-500 text-white shadow-[0_18px_38px_rgba(16,185,129,0.32)]"
                                    : isErrorAnswer
                                        ? "border-red-300 bg-red-500 text-white shadow-[0_18px_38px_rgba(239,68,68,0.28)]"
                                        : isAnswerDimmed
                                            ? "border-white/10 bg-slate-900/55 text-white/55 opacity-50"
                                            : "border-slate-500 bg-slate-800 text-white shadow-[0_12px_28px_rgba(15,23,42,0.5)] hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-slate-700"
                                  } disabled:cursor-default disabled:hover:translate-y-0`}
                                >
                                  <span className="flex-1">{answer}</span>
                                  {isSuccessAnswer ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : null}
                                  {isErrorAnswer ? <XCircle className="h-5 w-5 shrink-0" /> : null}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {!isQuizPostBurned && activeQuizAnswerFeedback?.tone === "error" ? (
                          <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-center text-sm font-semibold text-red-50">
                            Desværre forkert. Du får 0 point.
                          </div>
                        ) : null}

                        {!isQuizPostBurned && isQuizSubmissionPending ? (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sender svar...
                          </div>
                        ) : null}

                        {!isQuizPostBurned && activeTypedAnswerError ? (
                          <div
                            className={`mt-4 rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                          >
                            {activeTypedAnswerError}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}

                {activePostVariant === "photo" ? (
                  <div className="space-y-5 overflow-hidden">
                    <p className={`text-2xl font-black text-white sm:text-3xl ${wrapTextClass} ${rubik.className}`}>
                      {activeQuestion.text}
                    </p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      capture={isSelfiePhotoTask ? "user" : "environment"}
                      onChange={handlePhotoCapture}
                      className="hidden"
                    />

                    {!hasActivePhotoSuccess &&
                    !isCurrentPostAnswered &&
                    pendingPhotoSelection?.key === activeTypedAnswerKey ? (
                      <div className="space-y-4">
                        <div className="overflow-hidden rounded-[1.6rem] border border-white/15 bg-slate-900/80 p-2">
                          <Image
                            src={pendingPhotoSelection.previewUrl}
                            alt="Det valgte billede"
                            width={1200}
                            height={900}
                            unoptimized
                            className="max-h-[50vh] w-full rounded-[1.2rem] object-contain"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={handlePhotoButtonClick}
                            disabled={
                              isAnalyzingPhoto ||
                              isAnswerSubmissionPending ||
                              (isStandardSubmissionBlockingInput &&
                                studentSubmission.status !== "retryable_error" &&
                                studentSubmission.status !== "rejected")
                            }
                            className={tacticalSecondaryButtonClass}
                          >
                            <Camera className="h-5 w-5" />
                            Vælg et andet billede
                          </button>
                          <button
                            type="button"
                            onClick={submitPendingPhoto}
                            disabled={
                              isAnalyzingPhoto ||
                              isAnswerSubmissionPending ||
                              isStandardSubmissionBlockingInput
                            }
                            className={tacticalPrimaryButtonClass}
                          >
                            {isAnalyzingPhoto || isAnswerSubmissionPending ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                                Sender billedet…
                              </>
                            ) : (
                              <>
                                <Cloud className="h-5 w-5" />
                                Aflever billede
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : !hasActivePhotoSuccess && !isCurrentPostAnswered ? (
                      <button
                        type="button"
                        onClick={handlePhotoButtonClick}
                        disabled={isAnalyzingPhoto || isSubmitting}
                        className={`${tacticalPrimaryButtonClass} break-words hyphens-auto text-base`}
                      >
                        {isAnalyzingPhoto ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Uploader billedet...
                          </>
                        ) : (
                          <>
                            <Camera className="h-5 w-5" />
                            {isSelfiePhotoTask ? "TAG SELFIE" : "ÅBN KAMERA"}
                          </>
                        )}
                      </button>
                    ) : null}

                    {cameraError && !activePhotoFeedback && !isCurrentPostAnswered ? (
                      <div className="overflow-hidden rounded-2xl border border-amber-300/35 bg-amber-500/12 px-4 py-4 text-sm text-amber-50 shadow-[0_18px_40px_rgba(245,158,11,0.16)] backdrop-blur-md">
                        <p className={`font-semibold ${wrapTextClass}`}>{cameraError}</p>
                      </div>
                    ) : null}

                    {!hasActivePhotoSuccess && isCurrentPostAnswered ? (
                      <div className="space-y-4">
                        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                          <p className={wrapTextClass}>{answeredPostLockMessage}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void actions.continueFromSolvedPost()}
                          className={tacticalPrimaryButtonClass}
                        >
                          Gå videre
                        </button>
                      </div>
                    ) : null}

                    {activePhotoFeedback ? (
                      activePhotoFeedback.tone === "success" ? (
                        <div className="space-y-4">
                          <div className={tacticalSuccessPanelClass}>
                            <p className="font-mono text-xs font-black uppercase tracking-[0.32em] text-slate-950/70">
                              Foto sendt
                            </p>
                            <p className={`mt-3 text-xl font-black text-slate-950 ${wrapTextClass}`}>
                              {activePhotoFeedback.message}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => void actions.continueFromSolvedPost()}
                            className={tacticalPrimaryButtonClass}
                          >
                            Gå videre
                          </button>

                          {activePostActionError ? (
                            <div
                              className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                            >
                              {activePostActionError}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-2xl border border-orange-300/35 bg-orange-500/12 px-4 py-4 text-sm text-orange-50 shadow-[0_18px_40px_rgba(249,115,22,0.16)] backdrop-blur-md">
                          <p className={`font-semibold ${wrapTextClass}`}>{activePhotoFeedback.message}</p>
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}

                {activePostVariant === "escape" ? (
                  <div className="space-y-6 overflow-hidden">
                    <p className={`text-xl font-bold text-white ${wrapTextClass} ${rubik.className}`}>{activeQuestion.text}</p>

                    {activeEscapeReward ? (
                      <div className="space-y-4">
                        <div className={tacticalSuccessPanelClass}>
                          <p className="font-mono text-xs font-black uppercase tracking-[0.32em] text-slate-950/70">
                            Kode accepteret
                          </p>
                          <p className={`mt-3 text-lg font-black text-slate-950 ${wrapTextClass}`}>
                            Flot! Din kode-brik er:
                          </p>
                          <div className="mt-5 rounded-[1.6rem] border border-slate-950/10 bg-slate-950/85 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <p
                              className={`text-3xl md:text-5xl font-black tracking-[0.36em] text-emerald-300 ${wrapTextClass}`}
                            >
                              {activeEscapeReward}
                            </p>
                          </div>
                          <p className="mt-4 text-sm text-slate-950/75">
                            Brikken er gemt i din kode-oversigt.
                          </p>
                          {hasAllEscapeBricks ? (
                            <p className="mt-3 text-sm font-semibold text-slate-950/80">
                              Du har alle kode-brikker. Master-låsen er klar.
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => void actions.continueFromSolvedPost()}
                          className={tacticalPrimaryButtonClass}
                        >
                          {hasAllEscapeBricks ? "Åbn Master-lås" : "Videre til næste post"}
                        </button>

                        {activePostActionError ? (
                          <div
                            className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                          >
                            {activePostActionError}
                          </div>
                        ) : null}
                      </div>
                    ) : isCurrentPostAnswered ? (
                      <div>
                        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                          <p className={wrapTextClass}>{answeredPostLockMessage}</p>
                        </div>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleTypedAnswerSubmit}
                        className="space-y-5"
                        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
                      >
                        <div className="space-y-3">
                          <label className={tacticalMetaLabelClass}>
                            Svaret
                          </label>
                          <input
                            key={`escape-input-${activeTypedAnswerKey}`}
                            ref={typedAnswerInputRef}
                            type="text"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={isCheckingEscapeAnswer || isSubmitting}
                            onChange={() => {
                              actions.clearTypedAnswerError();
                              actions.clearPostActionError();
                            }}
                            placeholder="Skriv tallet eller ordet her"
                            className={`${tacticalInputClass} text-lg`}
                          />
                        </div>

                        {activeEscapeHint ? (
                          <div
                            className={`rounded-2xl border border-amber-300/30 bg-amber-500/12 px-4 py-3 text-sm font-semibold text-amber-50 shadow-[0_16px_34px_rgba(245,158,11,0.12)] ${wrapTextClass}`}
                          >
                            {`💡 Brug for hjælp? Hint: ${activeEscapeHint}`}
                          </div>
                        ) : null}

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={actions.dismissCurrentPost}
                            disabled={isCheckingEscapeAnswer || isSubmitting}
                            className={tacticalSecondaryButtonClass}
                          >
                            Annuller
                          </button>
                          <button
                            type="submit"
                            disabled={isCheckingEscapeAnswer || isSubmitting}
                            className={tacticalPrimaryButtonClass}
                          >
                            {isCheckingEscapeAnswer ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Tjekker...
                              </>
                            ) : (
                              "Tjek svar"
                            )}
                          </button>
                        </div>

                        {activeTypedAnswerError ? (
                          <p className={`text-sm text-emerald-200/85 ${wrapTextClass}`}>
                            {activeTypedAnswerError}
                          </p>
                        ) : null}
                      </form>
                    )}
                  </div>
                ) : null}

                {activePostVariant === "roleplay" ? (
                  activeQuestion?.postType === "intro" ? (
                    <div className="space-y-5 overflow-hidden">
                      <div className="animate-in fade-in duration-300">
                        <div className="mx-auto w-full max-w-2xl rounded-2xl bg-black/90 p-6 text-center text-amber-50 font-serif shadow-2xl">
                          <h2 className={`mb-4 text-2xl font-black ${wrapTextClass}`}>Tidsmaskinen</h2>
                          <p className={`mb-6 text-lg leading-relaxed ${wrapTextClass}`}>{getRoleplayMessage(activeQuestion)}</p>
                          <div className="mt-2">
                            {!isCurrentPostAnswered ? (
                              <button
                                type="button"
                                onClick={() => void actions.submitTypedAnswer("[LÆST]")}
                                className={`${tacticalPrimaryButtonClass} max-w-xs mx-auto`}
                              >
                                Gå videre
                              </button>
                            ) : (
                              <div className="space-y-4">
                                <div className="rounded-[1.6rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                                  <p className={wrapTextClass}>{answeredPostLockMessage}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void actions.continueFromSolvedPost()}
                                  className={tacticalPrimaryButtonClass}
                                >
                                  Fortsæt rejsen
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5 overflow-hidden">
                      <div className="overflow-hidden rounded-[1.75rem] border border-emerald-500/20 bg-slate-950/80 p-4 shadow-[0_18px_40px_rgba(16,185,129,0.12)] backdrop-blur-xl">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-950 text-2xl shadow-inner shadow-black/20">
                            {roleplayAvatar && looksLikeImageSource(roleplayAvatar) ? (
                              <Image
                                src={roleplayAvatar}
                                alt={roleplayCharacterName}
                                width={56}
                                height={56}
                                className="h-full w-full object-cover"
                                unoptimized
                                loader={({ src }) => src}
                              />
                            ) : (
                              <span>{roleplayAvatar || "🕰️"}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className={`${tacticalMetaLabelClass} ${wrapTextClass}`}>Tidsmaskinen</p>
                            <p className={`mt-1 text-lg font-black text-white ${wrapTextClass} ${rubik.className}`}>
                              {roleplayCharacterName}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="relative ml-2 overflow-hidden rounded-[1.75rem] border border-emerald-500/20 bg-slate-950/80 p-5 shadow-[0_18px_40px_rgba(16,185,129,0.12)] backdrop-blur-xl">
                        <span className="absolute -left-2 top-6 h-4 w-4 rotate-45 rounded-[0.45rem] border-l border-t border-emerald-500/20 bg-slate-950/80" />
                        <p className={`pr-1 text-lg leading-relaxed text-white sm:text-xl ${wrapTextClass}`}>
                          {getRoleplayMessage(activeQuestion)}
                        </p>
                      </div>

                      {activeRoleplayReply ? (
                        <div
                          className={`animate-in fade-in zoom-in-95 duration-300 space-y-4 overflow-hidden rounded-[1.85rem] border p-5 backdrop-blur-xl ${
                            activeRoleplayReply.tone === "success"
                              ? "border-emerald-300/30 bg-[linear-gradient(145deg,rgba(5,46,22,0.88),rgba(16,185,129,0.18))] shadow-[0_24px_55px_rgba(16,185,129,0.18)]"
                              : "border-emerald-500/20 bg-slate-950/80 shadow-[0_24px_55px_rgba(16,185,129,0.12)]"
                          }`}
                        >
                          <p className={`text-xs font-semibold tracking-[0.24em] uppercase ${wrapTextClass} ${
                            activeRoleplayReply.tone === "success" ? "text-emerald-100/75" : "text-emerald-200"
                          }`}>
                            {activeRoleplayReply.isLoading ? `${roleplayCharacterName} tænker...` : `Svar fra ${roleplayCharacterName}`}
                          </p>
                          <div className={`rounded-[1.35rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
                            activeRoleplayReply.tone === "success" ? "border-emerald-200/15 bg-white/8" : "border-emerald-500/20 bg-slate-950"
                          }`}>
                            <p className={`text-sm leading-relaxed ${wrapTextClass} text-emerald-50`}>
                              {activeRoleplayReply.isLoading ? (
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Tænker...
                                </span>
                              ) : (
                                activeRoleplayReplyMessage
                              )}
                            </p>
                          </div>
                          {activeRoleplayReply.canContinue ? (
                            <button
                              type="button"
                              onClick={() => void actions.continueFromSolvedPost()}
                              className={tacticalPrimaryButtonClass}
                            >
                              Fortsæt rejsen -&gt;
                            </button>
                          ) : null}

                          {activePostActionError ? (
                            <div className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                            >
                              {activePostActionError}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {!activeRoleplayReply?.canContinue ? (
                        isCurrentPostAnswered ? (
                          <div className="space-y-4">
                            {activeTypedAnswerError ? (
                              <p className={`text-sm text-emerald-200/85 ${wrapTextClass}`}>
                                {activeTypedAnswerError}
                              </p>
                            ) : null}

                            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                              <p className={wrapTextClass}>{answeredPostLockMessage}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => void actions.continueFromSolvedPost()}
                              className={tacticalPrimaryButtonClass}
                            >
                              Fortsæt rejsen -&gt;
                            </button>
                          </div>
                        ) : (
                          <form
                            onSubmit={handleTypedAnswerSubmit}
                            className={`overflow-hidden rounded-[1.75rem] border bg-slate-950/80 p-4 shadow-[0_18px_38px_rgba(16,185,129,0.14)] backdrop-blur-xl transition-all ${
                              hasRoleplayInputErrorTone ? "border-rose-300/45 shadow-[0_20px_45px_rgba(244,63,94,0.18)]" : "border-emerald-500/20"
                            }`}
                            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
                          >
                            <div className="flex items-end gap-3">
                              <input
                                key={`roleplay-input-${activeTypedAnswerKey}`}
                                ref={typedAnswerInputRef}
                                type="text"
                                disabled={isSubmittingAnswer || isSubmitting}
                                onChange={() => {
                                  actions.clearRoleplayInputErrorTone();
                                  actions.clearTypedAnswerError();
                                  actions.clearPostActionError();
                                }}
                                onFocus={(event) => {
                                  event.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                                placeholder={`Skriv dit svar til ${roleplayCharacterName}...`}
                                className={`min-w-0 flex-1 rounded-[1.35rem] border bg-slate-950 px-4 py-3 text-base text-emerald-50 outline-none transition placeholder:text-white/40 focus:ring-2 ${
                                  hasRoleplayInputErrorTone ? "border-rose-300/45 focus:border-rose-300/55 focus:ring-rose-300/20" : "border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-400/20"
                                } disabled:cursor-not-allowed disabled:opacity-70`}
                              />
                              <button type="submit" disabled={isAnswerSubmissionPending} className={`${tacticalPrimaryButtonClass} min-w-[11rem] shrink-0`}>
                                {isAnswerSubmissionPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sender...
                                  </>
                                ) : (
                                  "Send besked"
                                )}
                              </button>
                            </div>

                            {activeTypedAnswerError ? (
                              <p className={`mt-3 text-sm text-emerald-200/85 ${wrapTextClass}`}>{activeTypedAnswerError}</p>
                            ) : null}
                          </form>
                        )
                      ) : null}
                    </div>
                  )
                ) : null}

                {activePostVariant === "unknown" ? (
                  <div className="space-y-4 overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-950 p-5">
                    <p
                      className={`${tacticalMetaLabelClass} ${wrapTextClass}`}
                    >
                      Mission
                    </p>
                    <h3 className={`text-xl font-black text-white ${wrapTextClass} ${rubik.className}`}>Posten gør sig klar</h3>
                    <p className={`text-sm leading-relaxed text-white/90 ${wrapTextClass}`}>
                      Vent et øjeblik og prøv igen. Hvis den ikke åbner, så kig op på arrangørens skærm.
                    </p>
                  </div>
                ) : null}

                {/* Emergency skip — kun standard quiz/photo efter en post-action-fejl. */}
                {usesStandardStudentLocationExperience &&
                  !isStandardSubmissionBlockingInput &&
                  pendingAnswerCount === 0 &&
                  (activePostActionError ||
                    (activePostVariant === "photo" &&
                      activePhotoFeedback?.tone === "error")) &&
                  (activePostVariant === "quiz" || activePostVariant === "photo") &&
                  raceMode !== "zone_krig" &&
                  !isSelfiePhotoTask &&
                  !isCurrentPostAnswered &&
                  !hasActivePhotoSuccess &&
                  !hasActiveQuizSuccess ? (
                  <div className="mt-6 text-center">
                    {skipConfirm?.key !== activeTypedAnswerKey ? (
                      <button
                        type="button"
                        onClick={() => setSkipConfirm({ key: activeTypedAnswerKey })}
                        className="inline-flex min-h-[56px] items-center justify-center px-4 text-xs text-white/50 underline underline-offset-2 transition-colors hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        Stadig låst?
                      </button>
                    ) : (
                      <div className="overflow-hidden rounded-[1.6rem] border border-amber-400/20 bg-amber-500/10 p-5 text-left">
                        <p className={`mb-4 text-sm leading-relaxed text-amber-50/85 ${wrapTextClass}`}>
                          Som nødvej kan I springe posten over. I får 0 point for posten.
                        </p>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setSkipConfirm(null)}
                            disabled={isAnswerSubmissionPending || isAnalyzingPhoto}
                            className={tacticalSecondaryButtonClass}
                          >
                            Bliv på posten
                          </button>
                          <button
                            type="button"
                            disabled={isAnswerSubmissionPending || isAnalyzingPhoto}
                            onClick={() => {
                              setSkipConfirm(null);
                              void actions.skipCurrentPostAsEmergency();
                            }}
                            className={`inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[1.35rem] border border-amber-400/40 bg-amber-600 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-md transition-all hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60 ${rubik.className}`}
                          >
                            Ja, spring posten over
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              </div>
            </div>
          ) : null}
        </div>
      );
      break;

    default:
      content = null;
      break;
  }

  return (
    <>
      {content}
      <style jsx global>{`
        @keyframes master-lock-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-10px);
          }
          40% {
            transform: translateX(8px);
          }
          60% {
            transform: translateX(-6px);
          }
          80% {
            transform: translateX(4px);
          }
        }

        @keyframes master-lock-spark {
          0% {
            opacity: 0;
            transform: scale(0.2) translateY(20px);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.4) translateY(-80px);
          }
        }
      `}</style>
    </>
  );
}
