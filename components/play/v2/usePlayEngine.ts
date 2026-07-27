/**
 * usePlayEngine – The core game loop, built as a strict state machine.
 *
 * === THE CRUCIAL RULE ===
 * There are NO overlapping boolean flags (isSubmitting, isClosing, showQuestion).
 * Every post has ONE authoritative state expressed by `PostPhase`.
 * When the player taps an answer the phase changes to SUBMITTING **synchronously**
 * so the UI can remove answer buttons from the DOM in the same render.
 *
 * Responsibilities:
 *  1. Load session data (questions, raceMode, config).
 *  2. Restore progress from localStorage snapshot.
 *  3. Drive the post-level state machine: LOCKED → OPEN → SUBMITTING → RESOLVED.
 *  4. Orchestrate answer submission (quiz, photo, escape, roleplay).
 *  5. Advance to the next post after resolution.
 *  6. Track score, solved/answered indexes, escape codes.
 *  7. Detect session-level transitions via Realtime.
 *  8. Persist progress snapshots to localStorage.
 *
 * This hook consumes identity from usePlayAuth and location from usePlayGps
 * but never touches the DOM or geolocation APIs directly.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import type {
  ActivePostVariant,
  AnswerProgressRow,
  EscapeCodeEntry,
  EscapeResultEntry,
  MasterLockStatus,
  PhotoFeedbackState,
  PlaySessionPayload,
  PostActionErrorState,
  Question,
  QuizAnswerFeedbackState,
  RaceMode,
  RoleplayReplyState,
  StoredPlaySnapshot,
  TeacherBroadcastMessage,
  ValidateAnswerPayload,
  ZoneKrigCaptureApiResult,
  ZoneKrigCaptureFeedbackState,
} from "../types";

import {
  buildRouteOrder,
  compressImageForUpload,
  getEscapeCodeBrick,
  getNextRoutePostIndex,
  getRouteStepIndex,
  getNormalizedAnsweredPostIndex,
  normalizeRaceMode,
  parseQuestion,
  readStoredPlaySnapshot,
  resolvePostVariant,
  saveStoredPlaySnapshot,
  toFiniteNumber,
} from "../playUtils";

import { DEFAULT_QUESTION_POINTS } from "@/utils/questionPoints";
import {
  POST_ORDER_MODES,
  normalizePostOrderMode,
  type ActivePostOrderMode,
} from "@/lib/routes/postOrderPolicy";

import type { PlayAuthIdentity } from "./usePlayAuth";
import type { PlayGpsState } from "./usePlayGPS";
import {
  enqueueAnswer,
  initOfflineSyncLoop,
  destroyOfflineSyncLoop,
  isNetworkError,
  subscribeToQueue,
  type OfflineQueueEntry,
} from "./offlineSync";

// ---------------------------------------------------------------------------
// Post-level state machine (THE core concept)
// ---------------------------------------------------------------------------

/**
 * Every post lives in exactly ONE of these phases at any time.
 * Transitions are synchronous and uni-directional within a single attempt:
 *
 *   LOCKED  →  OPEN  →  SUBMITTING  →  RESOLVED
 *     ↑                                    │
 *     └────────────────────────────────────┘  (advance to next post)
 */
export type PostPhase =
  | "LOCKED"       // player hasn't reached the post yet (GPS or sequence gate)
  | "OPEN"         // question is visible, answer buttons are rendered
  | "SUBMITTING"   // an answer was tapped – buttons removed, API in-flight
  | "RESOLVED";    // server responded – feedback is showing

// ---------------------------------------------------------------------------
// Session-level state machine
// ---------------------------------------------------------------------------

export type SessionPhase =
  | "loading"            // fetching session data from server
  | "waiting"            // session exists but teacher hasn't started it
  | "active"             // the run is live
  | "paused"             // teacher paused the session
  | "finished"           // all posts completed or teacher ended session
  | "error";             // unrecoverable error

// ---------------------------------------------------------------------------
// Feedback bundle (replaces scattered feedback states)
// ---------------------------------------------------------------------------

export interface PostFeedback {
  quiz: QuizAnswerFeedbackState;
  photo: PhotoFeedbackState;
  escape: { rewardBrick: string | null; hint: string };
  roleplay: RoleplayReplyState;
  zoneKrig: ZoneKrigCaptureFeedbackState;
  actionError: PostActionErrorState;
  wrongAnswer: string | null;
  typedAnswerError: string | null;
}

// ---------------------------------------------------------------------------
// Escape sub-state (only relevant for escape races)
// ---------------------------------------------------------------------------

export interface EscapeSubState {
  collectedBricks: EscapeCodeEntry[];
  masterLockInput: string;
  masterLockError: string | null;
  masterLockStatus: MasterLockStatus;
  masterLockShakeNonce: number;
  wrongAttempts: number;
  isFinalizing: boolean;
  showResults: boolean;
  showMasterVictory: boolean;
  results: EscapeResultEntry[];
  resultsError: string | null;
  isLoadingResults: boolean;
}

// ---------------------------------------------------------------------------
// Engine state (the single source of truth)
// ---------------------------------------------------------------------------

export interface PlayEngineState {
  sessionPhase: SessionPhase;
  postPhase: PostPhase;
  questions: Question[];
  raceMode: RaceMode;
  activePostVariant: ActivePostVariant;
  currentPostIndex: number;
  activeQuestion: Question | undefined;
  solvedPostIndexes: number[];
  answeredPostIndexes: number[];
  burnedPosts: Set<number>;
  score: number;
  correctAnswersCount: number;
  displayPostNumber: number;
  totalQuestions: number;
  progressPercent: number;
  feedback: PostFeedback;
  escape: EscapeSubState | null;
  latestMessage: TeacherBroadcastMessage | null;
  resumeMessage: string | null;
  playStartedAtMs: number | null;
  playFinishedAtMs: number | null;
  errorMessage: string | null;
  /** Number of answers queued offline, waiting for sync. */
  pendingOfflineCount: number;
}

// ---------------------------------------------------------------------------
// Engine actions
// ---------------------------------------------------------------------------

export interface PlayEngineActions {
  submitQuizAnswer: (selectedIndex: number) => void;
  submitPhoto: (file: File) => void;
  submitTypedAnswer: (answer: string) => void;
  submitRoleplayMessage: (message: string) => void;
  setMasterLockInput: (value: string) => void;
  submitMasterCode: () => void;
  manualUnlock: () => void;
  advanceToNextPost: () => void;
  dismissQuestion: () => void;
  dismissLatestMessage: () => void;
  retryLoad: () => void;
}

// ---------------------------------------------------------------------------
// Hook params & return
// ---------------------------------------------------------------------------

export interface UsePlayEngineParams {
  sessionId: string | undefined;
  identity: PlayAuthIdentity | null;
  gps: PlayGpsState;
}

export interface UsePlayEngineReturn {
  state: PlayEngineState;
  actions: PlayEngineActions;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type SubmitAnswerApiResponse = {
  inserted?: boolean;
  awardedPoints?: number;
  error?: string;
  zoneKrigCapture?: ZoneKrigCaptureApiResult;
} | null;

type ResolvedAnswerResult = {
  isCorrect: boolean;
  awardedPoints: number;
  brick: string | null;
  zoneKrigCapture: ZoneKrigCaptureApiResult;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_FEEDBACK: PostFeedback = {
  quiz: null,
  photo: null,
  escape: { rewardBrick: null, hint: "" },
  roleplay: null,
  zoneKrig: null,
  actionError: null,
  wrongAnswer: null,
  typedAnswerError: null,
};

const SNAPSHOT_DEBOUNCE_MS = 1_500;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function sortUniqueIndexes(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function usePlayEngine(params: UsePlayEngineParams): UsePlayEngineReturn {
  const { sessionId, identity, gps } = params;
  const participantId = identity?.participantId ?? null;
  const startOffset = identity?.startOffset ?? 0;
  const playerName = identity?.studentName ?? "";
  const teamId = identity?.teamId ?? null;

  // =========================================================================
  // Session-level state
  // =========================================================================
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [raceMode, setRaceMode] = useState<RaceMode>("unknown");
  const [postOrderMode, setPostOrderMode] = useState<ActivePostOrderMode>(
    POST_ORDER_MODES.FIXED
  );
  const [autoUnlockRadius, setAutoUnlockRadius] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestMessage, setLatestMessage] = useState<TeacherBroadcastMessage | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [playStartedAtMs, setPlayStartedAtMs] = useState<number | null>(null);
  const [playFinishedAtMs, setPlayFinishedAtMs] = useState<number | null>(null);
  const loadRetryNonceRef = useRef(0);
  const [loadRetryNonce, setLoadRetryNonce] = useState(0);

  // =========================================================================
  // Post-level state machine — THE single source of truth
  // =========================================================================
  const [postPhase, setPostPhase] = useState<PostPhase>("LOCKED");
  const [currentPostIndex, setCurrentPostIndex] = useState(0);

  // =========================================================================
  // Progress tracking
  // =========================================================================
  const [score, setScore] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [solvedPostIndexes, setSolvedPostIndexes] = useState<number[]>([]);
  const [answeredPostIndexes, setAnsweredPostIndexes] = useState<number[]>([]);
  const [burnedPosts, setBurnedPosts] = useState<Set<number>>(new Set());

  // Refs that mirror state for use inside async closures without stale reads.
  const solvedRef = useRef<Set<number>>(new Set());
  const answeredRef = useRef<Set<number>>(new Set());
  const burnedRef = useRef<Set<number>>(new Set());

  // Keep refs in sync.
  useEffect(() => { solvedRef.current = new Set(solvedPostIndexes); }, [solvedPostIndexes]);
  useEffect(() => { answeredRef.current = new Set(answeredPostIndexes); }, [answeredPostIndexes]);
  useEffect(() => { burnedRef.current = new Set(burnedPosts); }, [burnedPosts]);

  // =========================================================================
  // Offline sync queue
  // =========================================================================
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  useEffect(() => {
    initOfflineSyncLoop();
    const unsub = subscribeToQueue((q) => setPendingOfflineCount(q.length));
    return () => {
      unsub();
      destroyOfflineSyncLoop();
    };
  }, []);

  // =========================================================================
  // Feedback (RESOLVED phase data)
  // =========================================================================
  const [feedback, setFeedback] = useState<PostFeedback>(EMPTY_FEEDBACK);

  // =========================================================================
  // Escape sub-state
  // =========================================================================
  const [escapeState, setEscapeState] = useState<EscapeSubState>({
    collectedBricks: [],
    masterLockInput: "",
    masterLockError: null,
    masterLockStatus: "locked",
    masterLockShakeNonce: 0,
    wrongAttempts: 0,
    isFinalizing: false,
    showResults: false,
    showMasterVictory: false,
    results: [],
    resultsError: null,
    isLoadingResults: false,
  });

  // =========================================================================
  // Refs for race-condition safety
  // =========================================================================
  const isMountedRef = useRef(true);
  const postPhaseRef = useRef<PostPhase>(postPhase);

  // Synchronise the ref on every render so async closures always see latest.
  postPhaseRef.current = postPhase;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // =========================================================================
  // Derived values (pure, no side effects)
  // =========================================================================
  const routeOrder = useMemo(
    () =>
      buildRouteOrder(
        questions.length,
        startOffset,
        postOrderMode === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
      ),
    [postOrderMode, questions.length, startOffset],
  );

  const currentRouteStepIndex = getRouteStepIndex(routeOrder, currentPostIndex);
  const displayPostNumber = routeOrder.length > 0 ? currentRouteStepIndex + 1 : 0;
  const totalQuestions = questions.length;
  const progressPercent =
    totalQuestions > 0
      ? Math.round((solvedPostIndexes.length / totalQuestions) * 100)
      : 0;
  const activeQuestion = questions[currentPostIndex];
  const activePostVariant: ActivePostVariant = activeQuestion
    ? resolvePostVariant(raceMode, activeQuestion)
    : "unknown";
  const isEscapeRace = raceMode === "escape" || activePostVariant === "escape";

  // =========================================================================
  // 1. SESSION LOADING — fetch /api/play/session
  // =========================================================================
  useEffect(() => {
    if (!sessionId) return;

    let active = true;
    setSessionPhase("loading");
    setErrorMessage(null);

    const load = async () => {
      try {
        const res = await fetch(
          `/api/play/session?sessionId=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        const payload = (await res.json().catch(() => null)) as PlaySessionPayload | null;
        if (!active) return;

        if (!res.ok) {
          setSessionPhase("error");
          setErrorMessage("Vi gør løbet klar. Prøv igen om et øjeblik.");
          return;
        }

        const radius = toFiniteNumber(payload?.radius);
        if (radius === null || radius <= 0) {
          setSessionPhase("error");
          setErrorMessage("Løbet bliver gjort klar lige nu. Prøv igen om et øjeblik.");
          return;
        }

        const parsed = Array.isArray(payload?.questions)
          ? (payload!.questions as unknown[]).map(parseQuestion).filter((q): q is Question => q !== null)
          : [];
        const mode = normalizeRaceMode(payload?.raceType);
        const nextPostOrderMode = normalizePostOrderMode(payload?.postOrderMode);

        if (parsed.length === 0 && mode !== "stratego") {
          setSessionPhase("error");
          setErrorMessage("Løbet bliver gjort klar lige nu. Prøv igen om et øjeblik.");
          return;
        }

        setQuestions(parsed);
        setRaceMode(mode);
        setPostOrderMode(nextPostOrderMode);
        setAutoUnlockRadius(Math.round(radius));
        setSessionPhase("active");
      } catch {
        if (!active) return;
        setSessionPhase("error");
        setErrorMessage("Vi gør løbet klar. Prøv igen om et øjeblik.");
      }
    };

    void load();
    return () => { active = false; };
  }, [sessionId, loadRetryNonce]);

  // =========================================================================
  // 2. PROGRESS RESTORE — read localStorage + answers table
  // =========================================================================
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (
      sessionPhase !== "active" ||
      !sessionId ||
      !participantId ||
      questions.length === 0 ||
      hasRestoredRef.current
    ) {
      return;
    }

    hasRestoredRef.current = true;

    const snapshot = readStoredPlaySnapshot();
    if (!snapshot || snapshot.sessionId !== sessionId || snapshot.participantId !== participantId) {
      // No snapshot — start from the first route post.
      const firstIndex = routeOrder[0] ?? 0;
      setCurrentPostIndex(firstIndex);
      setPostPhase("LOCKED");
      setPlayStartedAtMs(Date.now());
      return;
    }

    // Restore from snapshot.
    const restoredSolved = sortUniqueIndexes(snapshot.solvedPostIndexes ?? []);
    const restoredAnswered = sortUniqueIndexes(snapshot.answeredPostIndexes ?? []);
    const restoredBurned = new Set<number>(snapshot.burnedPosts ?? []);

    setSolvedPostIndexes(restoredSolved);
    setAnsweredPostIndexes(restoredAnswered);
    setBurnedPosts(restoredBurned);
    setScore(snapshot.score ?? 0);
    setCorrectAnswersCount(snapshot.correctAnswersCount ?? 0);
    setPlayStartedAtMs(snapshot.playStartedAtMs ?? Date.now());

    // Determine which post to resume on.
    const completedSet = new Set(restoredAnswered);
    const snapshotIdx = snapshot.currentPostIndex;
    const canResume =
      typeof snapshotIdx === "number" &&
      snapshotIdx >= 0 &&
      snapshotIdx < questions.length &&
      !completedSet.has(snapshotIdx);

    const nextIdx = canResume
      ? snapshotIdx
      : getNextRoutePostIndex(routeOrder, completedSet) ?? routeOrder[0] ?? 0;

    setCurrentPostIndex(nextIdx);
    setPostPhase("LOCKED");

    // Check if the run was already complete.
    if (restoredAnswered.length >= questions.length) {
      setSessionPhase("finished");
      setPlayFinishedAtMs(snapshot.playFinishedAtMs ?? Date.now());
    }

    setResumeMessage("Dit fremskridt er gendannet. Fortsæt missionen!");
  }, [sessionPhase, sessionId, participantId, questions.length, routeOrder]);

  // Clear resume message after a timeout.
  useEffect(() => {
    if (!resumeMessage) return;
    const timer = setTimeout(() => setResumeMessage(null), 5_000);
    return () => clearTimeout(timer);
  }, [resumeMessage]);

  // =========================================================================
  // 3. AUTO-TRANSITION: LOCKED → OPEN when in range
  // =========================================================================
  useEffect(() => {
    if (postPhase !== "LOCKED") return;
    if (sessionPhase !== "active") return;
    if (!activeQuestion) return;

    // GPS override or player is in range → open the post.
    if (gps.gpsOverrideActive || gps.isInRange) {
      setPostPhase("OPEN");
      setFeedback(EMPTY_FEEDBACK);
    }
  }, [postPhase, sessionPhase, activeQuestion, gps.gpsOverrideActive, gps.isInRange]);

  // =========================================================================
  // 4. SNAPSHOT PERSISTENCE — debounced save to localStorage
  // =========================================================================
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId || !participantId || questions.length === 0) return;
    if (sessionPhase === "loading" || sessionPhase === "error") return;

    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);

    snapshotTimerRef.current = setTimeout(() => {
      const snap: StoredPlaySnapshot = {
        participantId,
        sessionId,
        currentPostIndex,
        solvedPostIndexes,
        answeredPostIndexes,
        burnedPosts: Array.from(burnedPosts),
        correctAnswersCount,
        score,
        showQuestion: postPhase === "OPEN" || postPhase === "SUBMITTING" || postPhase === "RESOLVED",
        dismissedPostIndex: null,
        playStartedAtMs,
        playFinishedAtMs,
        pendingAnswers: [],
        savedAt: new Date().toISOString(),
      };
      saveStoredPlaySnapshot(snap);
    }, SNAPSHOT_DEBOUNCE_MS);

    return () => {
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    };
  }, [
    sessionId, participantId, currentPostIndex, solvedPostIndexes,
    answeredPostIndexes, burnedPosts, correctAnswersCount, score,
    postPhase, playStartedAtMs, playFinishedAtMs, questions.length, sessionPhase,
  ]);

  // =========================================================================
  // API HELPERS (pure functions, no state reads — receive everything as args)
  // =========================================================================

  /** Call /api/play/validate-answer */
  const callValidateAnswer = useCallback(
    async (args: {
      sessionId: string;
      participantId: string;
      postIndex: number;
      selectedIndex?: number;
      answer?: string;
    }): Promise<ValidateAnswerPayload | null> => {
      const res = await fetch("/api/play/validate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(args),
      });
      const data = (await res.json().catch(() => null)) as ValidateAnswerPayload | null;
      if (!res.ok) throw new Error(data?.error ?? "Svaret kunne ikke tjekkes.");
      return data;
    },
    [],
  );

  /** Call /api/play/submit-answer to persist the answer record. */
  const callSubmitAnswer = useCallback(
    async (args: {
      sessionId: string;
      participantId: string;
      studentName: string;
      postIndex: number;
      selectedIndex: number;
      isCorrect: boolean;
      awardedPoints: number;
      questionText: string;
      lat: number | null;
      lng: number | null;
      teamId: string | null;
    }): Promise<SubmitAnswerApiResponse> => {
      const now = new Date().toISOString();
      const postNumber = args.postIndex + 1;
      const payloads = [
        {
          session_id: args.sessionId,
          participant_id: args.participantId,
          student_name: args.studentName,
          post_index: postNumber,
          question_index: args.postIndex,
          selected_index: args.selectedIndex,
          answer_index: args.selectedIndex,
          is_correct: args.isCorrect,
          awarded_points: args.awardedPoints,
          question_text: args.questionText,
          lat: args.lat,
          lng: args.lng,
          answered_at: now,
          ...(args.teamId ? { zone_krig_team_id: args.teamId } : {}),
        },
        {
          session_id: args.sessionId,
          participant_id: args.participantId,
          student_name: args.studentName,
          post_index: postNumber,
          selected_index: args.selectedIndex,
          is_correct: args.isCorrect,
          awarded_points: args.awardedPoints,
          answered_at: now,
        },
        {
          session_id: args.sessionId,
          participant_id: args.participantId,
          student_name: args.studentName,
          question_index: args.postIndex,
          answer_index: args.selectedIndex,
          is_correct: args.isCorrect,
          awarded_points: args.awardedPoints,
          created_at: now,
        },
        {
          session_id: args.sessionId,
          participant_id: args.participantId,
          student_name: args.studentName,
          selected_index: args.selectedIndex,
          is_correct: args.isCorrect,
          awarded_points: args.awardedPoints,
        },
      ];

      const res = await fetch("/api/play/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payloads }),
      });
      return (await res.json().catch(() => null)) as SubmitAnswerApiResponse;
    },
    [],
  );

  // =========================================================================
  // CORE STATE MUTATIONS — called after API resolves
  // =========================================================================

  /** Record a post as answered (correct or not). */
  const markAnswered = useCallback((idx: number) => {
    setAnsweredPostIndexes((prev) =>
      prev.includes(idx) ? prev : sortUniqueIndexes([...prev, idx]),
    );
  }, []);

  /** Record a post as solved + update score. */
  const markSolved = useCallback((idx: number, points: number) => {
    setSolvedPostIndexes((prev) => {
      if (prev.includes(idx)) return prev;
      return sortUniqueIndexes([...prev, idx]);
    });
    setCorrectAnswersCount((prev) => prev + 1);
    setScore((prev) => prev + points);
  }, []);

  /** Record a post as burned (wrong answer). */
  const markBurned = useCallback((idx: number) => {
    setBurnedPosts((prev) => {
      if (prev.has(idx)) return prev;
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  }, []);

  // =========================================================================
  // SUBMIT QUIZ ANSWER — the synchronous guillotine
  // =========================================================================
  const submitQuizAnswer = useCallback(
    (selectedIndex: number) => {
      // ---- GUARD: only allowed from OPEN phase ----
      if (postPhaseRef.current !== "OPEN") return;
      if (!sessionId || !participantId || !activeQuestion) return;

      // ---- SYNCHRONOUS GUILLOTINE: remove buttons from DOM this render ----
      // flushSync forces React to commit the DOM update synchronously within
      // the click handler, ensuring answer buttons are gone before any
      // re-entrant click can reach them.
      flushSync(() => {
        setPostPhase("SUBMITTING");
      });
      postPhaseRef.current = "SUBMITTING"; // mirror for re-entrant safety

      // Capture everything needed in locals so the async closure uses no stale state.
      const capturedPostIndex = currentPostIndex;
      const capturedQuestion = activeQuestion;
      const capturedVariant = activePostVariant;
      const capturedSessionId = sessionId;
      const capturedParticipantId = participantId;
      const capturedPlayerName = playerName;
      const capturedTeamId = teamId;
      const capturedLat = gps.location?.lat ?? null;
      const capturedLng = gps.location?.lng ?? null;
      const capturedIsBurned = burnedRef.current.has(capturedPostIndex);

      const run = async () => {
        try {
          // Step 1: validate answer via server
          const validation = await callValidateAnswer({
            sessionId: capturedSessionId,
            participantId: capturedParticipantId,
            postIndex: capturedPostIndex,
            selectedIndex,
          });

          if (!isMountedRef.current) return;

          const isCorrect = validation?.isCorrect === true;
          const serverPoints =
            typeof validation?.awardedPoints === "number"
              ? Math.max(0, Math.round(validation.awardedPoints))
              : capturedQuestion.points;
          const awardedPoints = isCorrect
            ? capturedIsBurned ? 0 : serverPoints
            : 0;
          const brick = validation?.brick ?? null;

          // Step 2: persist the answer record
          const submitResult = await callSubmitAnswer({
            sessionId: capturedSessionId,
            participantId: capturedParticipantId,
            studentName: capturedPlayerName,
            postIndex: capturedPostIndex,
            selectedIndex,
            isCorrect,
            awardedPoints,
            questionText: capturedQuestion.text,
            lat: capturedLat,
            lng: capturedLng,
            teamId: capturedTeamId,
          });

          if (!isMountedRef.current) return;

          // Step 3: update progress sets
          markAnswered(capturedPostIndex);

          if (isCorrect) {
            markSolved(capturedPostIndex, awardedPoints);
          } else {
            markBurned(capturedPostIndex);
          }

          // Step 4: collect escape brick if applicable
          if (isCorrect && capturedVariant === "escape" && brick) {
            setEscapeState((prev) => ({
              ...prev,
              collectedBricks: prev.collectedBricks.some((e) => e.postIndex === capturedPostIndex)
                ? prev.collectedBricks
                : [...prev.collectedBricks, { postIndex: capturedPostIndex, brick }].sort(
                    (a, b) => a.postIndex - b.postIndex,
                  ),
            }));
          }

          // Step 5: build feedback and transition to RESOLVED
          const feedbackKey = `${capturedPostIndex}-${selectedIndex}`;
          setFeedback({
            ...EMPTY_FEEDBACK,
            quiz: {
              key: feedbackKey,
              selectedIndex,
              tone: isCorrect ? "success" : "error",
            },
            wrongAnswer: isCorrect ? null : "Desværre, forkert svar!",
          });
          setPostPhase("RESOLVED");
          postPhaseRef.current = "RESOLVED";
        } catch (err) {
          if (!isMountedRef.current) return;
          console.error("Quiz submit failed:", err);

          if (isNetworkError(err)) {
            // ---- OFFLINE QUEUE: persist answer for later sync ----
            const now = new Date().toISOString();
            const postNumber = capturedPostIndex + 1;
            enqueueAnswer({
              id: `${capturedSessionId}-${capturedPostIndex}-${Date.now()}`,
              submittedAt: now,
              postIndex: capturedPostIndex,
              payloads: [
                {
                  session_id: capturedSessionId,
                  participant_id: capturedParticipantId,
                  student_name: capturedPlayerName,
                  post_index: postNumber,
                  question_index: capturedPostIndex,
                  selected_index: selectedIndex,
                  answer_index: selectedIndex,
                  is_correct: false,
                  awarded_points: 0,
                  question_text: capturedQuestion.text,
                  lat: capturedLat,
                  lng: capturedLng,
                  answered_at: now,
                  ...(capturedTeamId ? { zone_krig_team_id: capturedTeamId } : {}),
                },
              ],
            });

            markAnswered(capturedPostIndex);
            markBurned(capturedPostIndex);
            setFeedback({
              ...EMPTY_FEEDBACK,
              actionError: {
                key: `${capturedPostIndex}-offline`,
                message: "Venter på sync — dit svar er gemt lokalt.",
              },
            });
            setPostPhase("RESOLVED");
            postPhaseRef.current = "RESOLVED";
            return;
          }

          // Non-network error — show generic error feedback.
          markAnswered(capturedPostIndex);
          markBurned(capturedPostIndex);
          setFeedback({
            ...EMPTY_FEEDBACK,
            actionError: {
              key: `${capturedPostIndex}-error`,
              message: "Forbindelsen driller lidt. Dit svar kunne ikke tjekkes.",
            },
          });
          setPostPhase("RESOLVED");
          postPhaseRef.current = "RESOLVED";
        }
      };

      void run();
    },
    [
      sessionId, participantId, activeQuestion, currentPostIndex,
      activePostVariant, playerName, teamId, gps.location,
      callValidateAnswer, callSubmitAnswer, markAnswered, markSolved, markBurned,
    ],
  );

  // =========================================================================
  // SUBMIT TYPED ANSWER (escape / free-text / AI-validated)
  // =========================================================================
  const submitTypedAnswer = useCallback(
    (answer: string) => {
      if (postPhaseRef.current !== "OPEN") return;
      if (!sessionId || !participantId || !activeQuestion) return;
      if (!answer.trim()) {
        setFeedback((prev) => ({
          ...prev,
          typedAnswerError: "Indtast svaret, før du bekræfter.",
        }));
        return;
      }

      // ---- SYNCHRONOUS GUILLOTINE ----
      flushSync(() => {
        setPostPhase("SUBMITTING");
      });
      postPhaseRef.current = "SUBMITTING";

      const capturedPostIndex = currentPostIndex;
      const capturedQuestion = activeQuestion;
      const capturedVariant = activePostVariant;
      const capturedSessionId = sessionId;
      const capturedParticipantId = participantId;
      const capturedPlayerName = playerName;
      const capturedTeamId = teamId;
      const capturedLat = gps.location?.lat ?? null;
      const capturedLng = gps.location?.lng ?? null;

      const run = async () => {
        try {
          const validation = await callValidateAnswer({
            sessionId: capturedSessionId,
            participantId: capturedParticipantId,
            postIndex: capturedPostIndex,
            answer: answer.trim(),
          });
          if (!isMountedRef.current) return;

          const isCorrect = validation?.isCorrect === true;
          const awardedPoints = isCorrect ? capturedQuestion.points : 0;
          const brick = validation?.brick ?? null;

          await callSubmitAnswer({
            sessionId: capturedSessionId,
            participantId: capturedParticipantId,
            studentName: capturedPlayerName,
            postIndex: capturedPostIndex,
            selectedIndex: 0,
            isCorrect,
            awardedPoints,
            questionText: capturedQuestion.text,
            lat: capturedLat,
            lng: capturedLng,
            teamId: capturedTeamId,
          });
          if (!isMountedRef.current) return;

          markAnswered(capturedPostIndex);
          if (isCorrect) {
            markSolved(capturedPostIndex, awardedPoints);
            if (capturedVariant === "escape" && brick) {
              setEscapeState((prev) => ({
                ...prev,
                collectedBricks: prev.collectedBricks.some((e) => e.postIndex === capturedPostIndex)
                  ? prev.collectedBricks
                  : [...prev.collectedBricks, { postIndex: capturedPostIndex, brick }].sort(
                      (a, b) => a.postIndex - b.postIndex,
                    ),
              }));
            }
          } else {
            markBurned(capturedPostIndex);
          }

          setFeedback({
            ...EMPTY_FEEDBACK,
            escape: {
              rewardBrick: isCorrect ? (brick ?? getEscapeCodeBrick(capturedQuestion, capturedPostIndex)) : null,
              hint: "",
            },
            wrongAnswer: isCorrect ? null : "Desværre, forkert svar! Du får 0 point.",
          });
          setPostPhase("RESOLVED");
          postPhaseRef.current = "RESOLVED";
        } catch (err) {
          if (!isMountedRef.current) return;

          if (isNetworkError(err)) {
            const now = new Date().toISOString();
            const postNumber = capturedPostIndex + 1;
            enqueueAnswer({
              id: `${capturedSessionId}-${capturedPostIndex}-${Date.now()}`,
              submittedAt: now,
              postIndex: capturedPostIndex,
              payloads: [
                {
                  session_id: capturedSessionId,
                  participant_id: capturedParticipantId,
                  student_name: capturedPlayerName,
                  post_index: postNumber,
                  question_index: capturedPostIndex,
                  selected_index: 0,
                  answer_index: 0,
                  is_correct: false,
                  awarded_points: 0,
                  question_text: capturedQuestion.text,
                  lat: capturedLat,
                  lng: capturedLng,
                  answered_at: now,
                },
              ],
            });

            markAnswered(capturedPostIndex);
            markBurned(capturedPostIndex);
            setFeedback({
              ...EMPTY_FEEDBACK,
              actionError: {
                key: `${capturedPostIndex}-offline`,
                message: "Venter på sync — dit svar er gemt lokalt.",
              },
            });
            setPostPhase("RESOLVED");
            postPhaseRef.current = "RESOLVED";
            return;
          }

          markAnswered(capturedPostIndex);
          markBurned(capturedPostIndex);
          setFeedback({
            ...EMPTY_FEEDBACK,
            actionError: {
              key: `${capturedPostIndex}-error`,
              message: "Forbindelsen driller lidt. Prøv igen om et øjeblik.",
            },
          });
          setPostPhase("RESOLVED");
          postPhaseRef.current = "RESOLVED";
        }
      };

      void run();
    },
    [
      sessionId, participantId, activeQuestion, currentPostIndex,
      activePostVariant, playerName, teamId, gps.location,
      callValidateAnswer, callSubmitAnswer, markAnswered, markSolved, markBurned,
    ],
  );

  // =========================================================================
  // SUBMIT PHOTO
  // =========================================================================
  const submitPhoto = useCallback(
    (file: File) => {
      if (postPhaseRef.current !== "OPEN") return;
      if (!sessionId || !participantId || !activeQuestion) return;

      flushSync(() => {
        setPostPhase("SUBMITTING");
      });
      postPhaseRef.current = "SUBMITTING";

      const capturedPostIndex = currentPostIndex;
      const capturedQuestion = activeQuestion;
      const capturedSessionId = sessionId;
      const capturedParticipantId = participantId;

      const run = async () => {
        try {
          // Compress before upload: max 1200px, JPEG ≤ 512 KB.
          const compressed = await compressImageForUpload(file);

          const formData = new FormData();
          formData.append("image", compressed);
          formData.append("sessionId", capturedSessionId);
          formData.append("participantId", capturedParticipantId);
          formData.append("postIndex", String(capturedPostIndex));
          formData.append("answeredAt", new Date().toISOString());

          const res = await fetch("/api/play/submit-photo", {
            method: "POST",
            body: formData,
          });
          const body = (await res.json().catch(() => null)) as {
            message?: string;
            awardedPoints?: number;
            storedAnswer?: boolean;
            error?: string;
          } | null;

          if (!isMountedRef.current) return;

          if (!res.ok || typeof body?.message !== "string") {
            throw new Error(body?.error ?? "Foto-upload fejlede.");
          }

          const pts =
            typeof body.awardedPoints === "number" && Number.isFinite(body.awardedPoints)
              ? Math.max(0, Math.round(body.awardedPoints))
              : capturedQuestion.points;

          markAnswered(capturedPostIndex);
          markSolved(capturedPostIndex, pts);

          const isSelfie = capturedQuestion.isSelfie === true;
          setFeedback({
            ...EMPTY_FEEDBACK,
            photo: {
              key: `${capturedPostIndex}-photo`,
              tone: "success",
              message: isSelfie ? `Selfie sendt! ${body.message}` : body.message,
            },
          });
          setPostPhase("RESOLVED");
          postPhaseRef.current = "RESOLVED";
        } catch (err) {
          if (!isMountedRef.current) return;
          const msg =
            err instanceof Error ? err.message : "Billedet kunne ikke uploades. Prøv igen.";
          setFeedback({
            ...EMPTY_FEEDBACK,
            photo: { key: `${capturedPostIndex}-photo-err`, tone: "error", message: msg },
          });
          // Stay in SUBMITTING → allow retry by going back to OPEN.
          setPostPhase("OPEN");
          postPhaseRef.current = "OPEN";
        }
      };

      void run();
    },
    [sessionId, participantId, activeQuestion, currentPostIndex, markAnswered, markSolved],
  );

  // =========================================================================
  // SUBMIT ROLEPLAY MESSAGE
  // =========================================================================
  const submitRoleplayMessage = useCallback(
    (message: string) => {
      // Delegates to the same typed-answer path (server handles roleplay via variant).
      submitTypedAnswer(message);
    },
    [submitTypedAnswer],
  );

  // =========================================================================
  // ESCAPE MASTER CODE
  // =========================================================================
  const setMasterLockInput = useCallback((value: string) => {
    setEscapeState((prev) => ({ ...prev, masterLockInput: value, masterLockError: null }));
  }, []);

  const submitMasterCode = useCallback(() => {
    if (!sessionId) return;
    const code = escapeState.masterLockInput.trim();
    if (!code) {
      setEscapeState((prev) => ({
        ...prev,
        masterLockError: "Indtast master-koden fra dine kode-brikker først.",
        masterLockShakeNonce: prev.masterLockShakeNonce + 1,
      }));
      return;
    }

    setEscapeState((prev) => ({ ...prev, isFinalizing: true, masterLockError: null }));

    const run = async () => {
      try {
        const res = await fetch("/api/play/validate-master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ sessionId, masterCode: code }),
        });
        const body = (await res.json().catch(() => null)) as { isCorrect?: boolean; error?: string } | null;

        if (!isMountedRef.current) return;

        if (!res.ok || body?.isCorrect !== true) {
          setEscapeState((prev) => ({
            ...prev,
            isFinalizing: false,
            masterLockError: "Forkert kode - prøv igen.",
            masterLockStatus: "locked" as MasterLockStatus,
            masterLockShakeNonce: prev.masterLockShakeNonce + 1,
            wrongAttempts: prev.wrongAttempts + 1,
          }));
          return;
        }

        setEscapeState((prev) => ({
          ...prev,
          isFinalizing: false,
          masterLockStatus: "unlocked" as MasterLockStatus,
          masterLockError: null,
          showMasterVictory: true,
        }));

        // After a short delay, show results.
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setEscapeState((prev) => ({ ...prev, showResults: true }));
          setSessionPhase("finished");
          setPlayFinishedAtMs(Date.now());
        }, 2_200);
      } catch {
        if (!isMountedRef.current) return;
        // On failure, still unlock (matches v1 graceful degradation).
        setEscapeState((prev) => ({
          ...prev,
          isFinalizing: false,
          masterLockStatus: "unlocked" as MasterLockStatus,
          showMasterVictory: true,
        }));
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setEscapeState((prev) => ({ ...prev, showResults: true }));
          setSessionPhase("finished");
          setPlayFinishedAtMs(Date.now());
        }, 2_200);
      }
    };

    void run();
  }, [sessionId, escapeState.masterLockInput]);

  // =========================================================================
  // NAVIGATION ACTIONS
  // =========================================================================

  /** Manually unlock (GPS override / teacher override). */
  const manualUnlock = useCallback(() => {
    if (postPhaseRef.current !== "LOCKED") return;
    setPostPhase("OPEN");
    postPhaseRef.current = "OPEN";
    setFeedback(EMPTY_FEEDBACK);
  }, []);

  /** Advance from RESOLVED to the next post (→ LOCKED on the new post). */
  const advanceToNextPost = useCallback(() => {
    if (postPhaseRef.current !== "RESOLVED") return;

    const completed = new Set([...answeredRef.current, currentPostIndex]);

    // Zone krig: stay on the same map, don't auto-advance.
    if (raceMode === "zone_krig") {
      setFeedback(EMPTY_FEEDBACK);
      setPostPhase("LOCKED");
      postPhaseRef.current = "LOCKED";
      return;
    }

    const nextIdx = getNextRoutePostIndex(routeOrder, completed);

    if (nextIdx !== null) {
      setCurrentPostIndex(nextIdx);
      setFeedback(EMPTY_FEEDBACK);
      setPostPhase("LOCKED");
      postPhaseRef.current = "LOCKED";
      return;
    }

    // All posts done.
    if (!isEscapeRace) {
      setSessionPhase("finished");
      setPlayFinishedAtMs(Date.now());
    }
    setFeedback(EMPTY_FEEDBACK);
    setPostPhase("LOCKED");
    postPhaseRef.current = "LOCKED";
  }, [currentPostIndex, raceMode, routeOrder, isEscapeRace]);

  /** Dismiss the question without answering (go back to map view). */
  const dismissQuestion = useCallback(() => {
    if (postPhaseRef.current === "SUBMITTING") return; // can't dismiss mid-flight
    setPostPhase("LOCKED");
    postPhaseRef.current = "LOCKED";
    setFeedback(EMPTY_FEEDBACK);
  }, []);

  const dismissLatestMessage = useCallback(() => {
    setLatestMessage(null);
  }, []);

  const retryLoad = useCallback(() => {
    loadRetryNonceRef.current++;
    setLoadRetryNonce(loadRetryNonceRef.current);
  }, []);

  // =========================================================================
  // ASSEMBLE RETURN VALUE
  // =========================================================================
  const state: PlayEngineState = useMemo(
    () => ({
      sessionPhase,
      postPhase,
      questions,
      raceMode,
      activePostVariant,
      currentPostIndex,
      activeQuestion,
      solvedPostIndexes,
      answeredPostIndexes,
      burnedPosts,
      score,
      correctAnswersCount,
      displayPostNumber,
      totalQuestions,
      progressPercent,
      feedback,
      escape: isEscapeRace ? escapeState : null,
      latestMessage,
      resumeMessage,
      playStartedAtMs,
      playFinishedAtMs,
      errorMessage,
      pendingOfflineCount,
    }),
    [
      sessionPhase, postPhase, questions, raceMode, activePostVariant,
      currentPostIndex, activeQuestion, solvedPostIndexes, answeredPostIndexes,
      burnedPosts, score, correctAnswersCount, displayPostNumber, totalQuestions,
      progressPercent, feedback, isEscapeRace, escapeState, latestMessage,
      resumeMessage, playStartedAtMs, playFinishedAtMs, errorMessage,
      pendingOfflineCount,
    ],
  );

  const actions: PlayEngineActions = useMemo(
    () => ({
      submitQuizAnswer,
      submitPhoto,
      submitTypedAnswer,
      submitRoleplayMessage,
      setMasterLockInput,
      submitMasterCode,
      manualUnlock,
      advanceToNextPost,
      dismissQuestion,
      dismissLatestMessage,
      retryLoad,
    }),
    [
      submitQuizAnswer, submitPhoto, submitTypedAnswer, submitRoleplayMessage,
      setMasterLockInput, submitMasterCode, manualUnlock, advanceToNextPost,
      dismissQuestion, dismissLatestMessage, retryLoad,
    ],
  );

  return { state, actions };
}
