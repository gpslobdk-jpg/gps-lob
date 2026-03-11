"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  ValidateAnswerPayload,
  WakeLockSentinelLike,
} from "./types";
import {
  AUTO_UNLOCK_RADIUS,
  MANUAL_UNLOCK_RADIUS,
  clearStoredActiveParticipant,
  compressImageForUpload,
  containsBadWord,
  formatPhotoFailureMessage,
  getEscapeCodeBrick,
  getEscapeCodeEntriesFromRows,
  getGpsErrorContent,
  getNormalizedAnsweredPostIndex,
  getQuestionDisplayText,
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
  toFiniteNumber,
} from "./playUtils";
import { createClient } from "@/utils/supabase/client";

type UsePlayGameStateParams = {
  sessionId?: string;
  initialStudentName?: string;
};

export function usePlayGameState({
  sessionId,
  initialStudentName = "",
}: UsePlayGameStateParams): PlayGameState {
  const [supabase] = useState(() => createClient());

  const initialNameCandidate = initialStudentName || "";
  const storedParticipantOnLoad = useMemo(() => {
    if (!sessionId) return null;
    const stored = readStoredActiveParticipant();
    if (!stored) return null;
    if (stored.sessionId !== sessionId) {
      clearStoredActiveParticipant();
      return null;
    }
    return stored;
  }, [sessionId]);

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
  const [latestMessage, setLatestMessage] = useState<string | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<PhotoFeedbackState>(null);
  const [postActionError, setPostActionError] = useState<PostActionErrorState>(null);
  const [quizAnswerFeedback, setQuizAnswerFeedback] = useState<QuizAnswerFeedbackState>(null);
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
  const [isProvisioningParticipant, setIsProvisioningParticipant] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);

  const answersTableMissingRef = useRef(false);
  const hasRestoredRef = useRef(!Boolean(storedParticipantOnLoad));
  const resumeMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quizAnswerFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleplayInputErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockSentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const masterVictoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submissionLockRef = useRef(false);
  const isMountedRef = useRef(true);
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

  const rememberActiveParticipant = useCallback(
    (nextParticipantId: string, nextStudentName: string) => {
      if (!sessionId || !nextParticipantId) return;
      const normalizedName = nextStudentName.trim();
      setParticipantId(nextParticipantId);
      saveStoredActiveParticipant({
        participantId: nextParticipantId,
        sessionId,
        studentName: normalizedName,
        savedAt: new Date().toISOString(),
      });
    },
    [sessionId]
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
          | { participantId?: string; studentName?: string; error?: string }
          | null;

        if (!response.ok || !payload?.participantId) {
          throw new Error(payload?.error || "Kunne ikke klargøre deltageren.");
        }

        const resolvedName = (payload.studentName ?? normalizedName).trim() || normalizedName;
        setPendingPlayerNameState(resolvedName);
        setPlayerName(resolvedName);
        setHasConfirmedName(true);
        setNameError(null);
        rememberActiveParticipant(payload.participantId, resolvedName);
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
    [isProvisioningParticipant, rememberActiveParticipant, sessionId]
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
  const escapeCodeByPostIndex = new Map(
    collectedEscapeRewards.map((entry) => [entry.postIndex, entry.brick] as const)
  );
  const escapeCodeOverview = isEscapeRace
    ? questions.map((_, index) => escapeCodeByPostIndex.get(index) ?? "_")
    : [];
  const escapeCodeOverviewText = escapeCodeOverview.join(" ");
  const gpsErrorContent =
    gpsError === "permission_denied"
      ? {
          title: "Hov! GPS-adgang mangler ðŸ›‘",
          message:
            "Du har afvist GPS-adgang. PÃ¥ iPhone: Tryk pÃ¥ 'Aa' i adressebaren for at tillade. PÃ¥ Android/Chrome: Tryk pÃ¥ hÃ¦ngelÃ¥sen ved siden af webadressen.",
          helper: "NÃ¥r GPS-adgangen er tilladt, kan lÃ¸bet finde dine poster igen.",
        }
      : gpsError === "position_unavailable"
        ? {
            title: "Vi kan ikke finde dig prÃ¦cist endnu ðŸ“",
            message:
              "Vi kan ikke finde din prÃ¦cise placering lige nu. SÃ¸rg for at du er udenfor og har frit udsyn til himlen.",
            helper: "PrÃ¸v at bevÃ¦ge dig et Ã¸jeblik og vent et par sekunder, sÃ¥ finder GPS'en ofte signal igen.",
          }
        : gpsError === "unsupported"
          ? {
              title: "GPS er ikke tilgÃ¦ngelig pÃ¥ denne enhed",
              message:
                "Din browser eller enhed giver ikke adgang til GPS her. PrÃ¸v i en nyere mobilbrowser med lokalitet slÃ¥et til.",
              helper: "Ã…bn siden i Safari pÃ¥ iPhone eller Chrome pÃ¥ Android og prÃ¸v igen.",
            }
          : gpsError === "timeout"
            ? {
                title: "GPS'en svarer for langsomt â³",
                message: "GPS-sÃ¸gningen tog for lang tid. Tjek din internetforbindelse og prÃ¸v igen.",
                helper: "Det hjÃ¦lper ofte at genindlÃ¦se siden og stÃ¥ et sted med bedre signal.",
              }
            : null;
  const isBlockingGpsError = gpsError === "permission_denied" || gpsError === "unsupported";
  const gpsWarningContent =
    gpsError && !isBlockingGpsError ? getGpsErrorContent(gpsError) : null;
  const shouldKeepScreenAwake =
    !isLoading &&
    !loadError &&
    !isBlockingGpsError &&
    !isFinished &&
    !isKicked &&
    hasConfirmedName &&
    questions.length > 0;
  const canManualUnlock =
    !showQuestion &&
    distance !== null &&
    ((distance > AUTO_UNLOCK_RADIUS && distance <= MANUAL_UNLOCK_RADIUS) ||
      dismissedPostIndex === currentPostIndex);

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
    setEscapeReward(null);
    setRoleplayReply(null);
    setShowQuestion(true);
  }, [clearRoleplayInputErrorTone]);

  const dismissCurrentPost = useCallback(() => {
    clearRoleplayInputErrorTone();
    setPhotoFeedback(null);
    setPostActionError(null);
    setQuizAnswerFeedback(null);
    setTypedAnswerError(null);
    setShowQuestion(false);
    setDismissedPostIndex(currentPostIndex);
  }, [clearRoleplayInputErrorTone, currentPostIndex]);

  const syncParticipantLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!sessionId || !participantId) return;

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
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          console.error("Kunne ikke opdatere deltagerposition:", payload?.error ?? response.statusText);
          return;
        }

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
    [participantId, pendingPlayerName, playerName, rememberActiveParticipant, sessionId]
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

  useEffect(() => {
    if (!sessionId || !participantId || questions.length === 0 || hasRestoredRef.current) return;

    let isActive = true;

    const restoreFromStorage = async () => {
      const storedName = storedParticipantOnLoad?.studentName?.trim() || playerName || initialStudentName;
      if (storedName) {
        setPlayerName(storedName);
        setPendingPlayerNameState(storedName);
        setHasConfirmedName(true);
        setNameError(null);
        rememberActiveParticipant(participantId, storedName);
      }

      let participantData: ParticipantRow | null = null;
      let didResolveParticipant = false;

      const { data, error: participantError } = await supabase
        .from("participants")
        .select("id,session_id,student_name,lat,lng,finished_at")
        .eq("id", participantId)
        .eq("session_id", sessionId)
        .maybeSingle<ParticipantRow>();

      if (!isActive) return;

      if (participantError) {
        console.error("Kunne ikke genskabe deltagerdata fra participants:", participantError);
      } else {
        didResolveParticipant = true;
        participantData = data ?? null;
      }

      if (didResolveParticipant && !participantData) {
        clearStoredActiveParticipant();
        setParticipantId(null);
        setShowQuestion(false);
        setIsKicked(true);
        hasRestoredRef.current = true;
        return;
      }

      const restoredName =
        typeof participantData?.student_name === "string"
          ? participantData.student_name.trim()
          : "";

      const resolvedName = restoredName || storedName;
      if (resolvedName) {
        setPlayerName(resolvedName);
        setPendingPlayerNameState(resolvedName);
        setHasConfirmedName(true);
        setNameError(null);
      }

      if (participantData?.id && resolvedName) {
        rememberActiveParticipant(String(participantData.id), resolvedName);
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
        hasRestoredRef.current = true;
        return;
      }

      if (resolvedName) {
        const { data: answersData, error: answersError } = await supabase
          .from("answers")
          .select("post_index,question_index,is_correct")
          .eq("participant_id", participantId);

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
          for (const row of rows) {
            if (row.is_correct !== true) continue;
            const normalizedPostIndex = getNormalizedAnsweredPostIndex(row);
            if (normalizedPostIndex === null || normalizedPostIndex < 0) continue;
            confirmedCorrectPosts.add(normalizedPostIndex);
          }
          setCorrectAnswersCount(confirmedCorrectPosts.size);
          setCollectedEscapeRewards(getEscapeCodeEntriesFromRows(rows, questions));

          let highestCompletedPost = 0;
          for (const row of rows) {
            if (row.is_correct === false) continue;
            const normalizedPostIndex = getNormalizedAnsweredPostIndex(row);
            const normalizedPostNumber =
              normalizedPostIndex === null ? null : normalizedPostIndex + 1;
            if (
              normalizedPostNumber !== null &&
              normalizedPostNumber > highestCompletedPost
            ) {
              highestCompletedPost = normalizedPostNumber;
            }
          }

          if (highestCompletedPost >= questions.length) {
            setShowQuestion(false);
            setDistanceState(null);
            setEscapeReward(null);
            setRoleplayReply(null);
            setMasterLockStatus("locked");
            setMasterLockError(null);
            setMasterLockInputState("");
            setIsFinished(true);
            showResumeNotice("Dine kode-brikker er gendannet. Master-låsen er klar.");
            hasRestoredRef.current = true;
            return;
          }

          const nextPostNumber = Math.max(1, highestCompletedPost + 1);
          const nextPostIndex = Math.min(nextPostNumber, questions.length) - 1;
          setCurrentPostIndex(nextPostIndex);
          setShowQuestion(false);
          setDistanceState(null);
        }
      }

      if (resolvedName) {
        showResumeNotice(`Velkommen tilbage, ${resolvedName}! Genoptager løbet...`);
      }

      hasRestoredRef.current = true;
    };

    void restoreFromStorage();

    return () => {
      isActive = false;
    };
  }, [
    sessionId,
    participantId,
    questions,
    questions.length,
    supabase,
    playerName,
    initialStudentName,
    storedParticipantOnLoad,
    rememberActiveParticipant,
    showResumeNotice,
  ]);

  const markParticipantFinished = useCallback(async () => {
    if (!sessionId || !participantId) return false;
    const finishedAt = new Date().toISOString();

    const { error } = await supabase
      .from("participants")
      .update({ finished_at: finishedAt })
      .eq("id", participantId)
      .eq("session_id", sessionId);

    if (error) {
      console.error("Kunne ikke gemme målgang i participants:", error);
      return false;
    }
    clearStoredActiveParticipant();
    setParticipantId(null);
    return true;
  }, [participantId, sessionId, supabase]);

  const insertAnswerRecord = useCallback(
    async (
      selectedIndex: number,
      isCorrect: boolean,
      postNumber: number,
      questionText: string,
      lat: number | null,
      lng: number | null
    ) => {
      const activeName = playerName.trim();
      if (!sessionId || !participantId || !activeName || answersTableMissingRef.current) return false;

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
          question_text: questionText,
          lat,
          lng,
          answered_at: timestamp,
        },
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          post_index: postNumber,
          selected_index: selectedIndex,
          is_correct: isCorrect,
          answered_at: timestamp,
        },
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          question_index: postNumber - 1,
          answer_index: selectedIndex,
          is_correct: isCorrect,
          created_at: timestamp,
        },
        {
          session_id: sessionId,
          participant_id: participantId,
          student_name: activeName,
          selected_index: selectedIndex,
          is_correct: isCorrect,
        },
      ];

      for (const payload of payloads) {
        const { error } = await supabase.from("answers").insert(payload);
        if (!error) return true;
        if (error.code === "PGRST205") {
          answersTableMissingRef.current = true;
          return false;
        }
        if (isMissingColumnError(error)) continue;
        console.error("Kunne ikke gemme svar i answers:", error);
        return false;
      }

      return false;
    },
    [participantId, playerName, sessionId, supabase]
  );

  useEffect(() => {
    if (!sessionId) return;

    let isActive = true;

    const fetchRun = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await fetch(`/api/play/session?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as PlaySessionPayload | null;

        if (!isActive) return;

        if (!response.ok) {
          setLoadError(payload?.error || "Kunne ikke hente løbet.");
          setIsLoading(false);
          return;
        }

        const parsedQuestions = Array.isArray(payload?.questions)
          ? payload.questions.map(parseQuestion).filter((q): q is Question => q !== null)
          : [];

        if (parsedQuestions.length === 0) {
          setLoadError("Dette løb har ingen gyldige GPS-poster endnu.");
        } else {
          setQuestions(parsedQuestions);
        }

        setRaceMode(normalizeRaceMode(payload?.raceType));
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
      } catch (error) {
        if (!isActive) return;
        console.error("Kunne ikke hente play-data:", error);
        setLoadError("Kunne ikke hente løbet.");
        setIsLoading(false);
      }
    };

    void fetchRun();

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!showEscapeResults || !isEscapeRace || !sessionId) return;

    let isActive = true;

    const fetchEscapeResults = async () => {
      setIsLoadingEscapeResults(true);
      setEscapeResultsError(null);

      const loadPlacements = async (table: "participants" | "session_students") =>
        supabase
          .from(table)
          .select("student_name,finished_at")
          .eq("session_id", sessionId)
          .not("finished_at", "is", null)
          .order("finished_at", { ascending: true });

      let result = await loadPlacements("participants");
      if (result.error?.code === "PGRST205") {
        result = await loadPlacements("session_students");
      }

      if (!isActive) return;

      if (result.error) {
        console.error("Kunne ikke hente escape-placeringer:", result.error);
        setEscapeResults([]);
        setEscapeResultsError("Placeringen kunne ikke hentes endnu. Prøv igen om et øjeblik.");
        setIsLoadingEscapeResults(false);
        return;
      }

      const rows = Array.isArray(result.data) ? (result.data as ParticipantRow[]) : [];
      const nextResults = rows
        .filter((row) => typeof row.student_name === "string" && row.student_name.trim().length > 0)
        .map((row, index) => ({
          place: index + 1,
          studentName: row.student_name?.trim() ?? `Deltager ${index + 1}`,
          finishedAt: typeof row.finished_at === "string" ? row.finished_at : null,
        }));

      setEscapeResults(nextResults);
      setIsLoadingEscapeResults(false);
    };

    void fetchEscapeResults();

    return () => {
      isActive = false;
    };
  }, [isEscapeRace, sessionId, showEscapeResults, supabase]);

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
    if (!sessionId) return;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const messageChannel = supabase
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
          const messageRow = payload.new as { is_teacher?: boolean; message?: string | null };
          if (messageRow.is_teacher && messageRow.message) {
            setLatestMessage(messageRow.message);
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => setLatestMessage(null), 8000);
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

          clearStoredActiveParticipant();
          setParticipantId(null);
          setShowQuestion(false);
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

          clearStoredActiveParticipant();
          setParticipantId(null);
          setShowQuestion(false);
          setIsKicked(true);
        }
      )
      .subscribe();

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      void supabase.removeChannel(messageChannel);
    };
  }, [participantId, sessionId, supabase]);

  const handleWrongQuizAnswer = useCallback((selectedIndex: number, feedbackKey: string) => {
    if (quizAnswerFeedbackTimerRef.current) {
      clearTimeout(quizAnswerFeedbackTimerRef.current);
    }

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
    setTypedAnswerError({
      key: feedbackKey,
      message: "Forkert svar. Prøv igen.",
    });
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
      const response = await fetch("/api/play/validate-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          sessionId,
          postIndex: currentPostIndex,
          ...payload,
        }),
      });

      const data = (await response.json().catch(() => null)) as ValidateAnswerPayload | null;
      if (!response.ok) {
        throw new Error(data?.error || "Svaret kunne ikke tjekkes.");
      }

      return data;
    },
    [currentPostIndex, sessionId]
  );

  useEffect(() => {
    setWrongAttempts(0);
  }, [currentPostIndex]);

  const continueFromSolvedPost = async () => {
    clearRoleplayInputErrorTone();
    setPostActionError(null);
    if (currentPostIndex + 1 < questions.length) {
      setDismissedPostIndex(null);
      setPhotoFeedback(null);
      setQuizAnswerFeedback(null);
      setTypedAnswerError(null);
      setEscapeReward(null);
      setRoleplayReply(null);
      setWrongAttempts(0);
      setShowQuestion(false);
      setDistanceState(null);
      setCurrentPostIndex((prev) => prev + 1);
      return true;
    }

    if (!isEscapeRace) {
      const didFinish = await markParticipantFinished();
      if (!didFinish) {
        setPostActionError({
          key: activeTypedAnswerKey,
          message: "Netværksfejl - prøv igen",
        });
        return false;
      }
    }

    setDismissedPostIndex(null);
    setPhotoFeedback(null);
    setQuizAnswerFeedback(null);
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
    options?: { skipAnswerPersist?: boolean }
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
    setTypedAnswerError(null);
    setPostActionError(null);

    const didSaveAnswer = options?.skipAnswerPersist
      ? true
      : await insertAnswerRecord(
          selectedIndex,
          true,
          postNumber,
          currentVariant === "roleplay" ? getRoleplayMessage(current) : current.text,
          myLoc?.lat ?? null,
          myLoc?.lng ?? null
        );

    if (!didSaveAnswer) {
      if (currentVariant === "photo") {
        setPhotoFeedback({
          key: feedbackKey,
          tone: "error",
          message: "Netværksfejl - prøv igen",
        });
      } else {
        setTypedAnswerError({
          key: feedbackKey,
          message: "Netværksfejl - prøv igen",
        });
      }
      return false;
    }

    setCorrectAnswersCount((prev) => prev + 1);

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
      setTypedAnswerError({
        key: feedbackKey,
        message: "Netværksfejl - prøv igen",
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
      const payload = (await response.json().catch(() => null)) as
        | { isCorrect?: boolean; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Master-koden kunne ikke tjekkes.");
      }

      if (payload?.isCorrect !== true) {
        setMasterLockError("Forkert kode - prøv igen.");
        setMasterLockStatus("locked");
        setMasterLockShakeNonce((prev) => prev + 1);
        return;
      }

      const didFinish = await markParticipantFinished();
      if (!didFinish) {
        setMasterLockError("Netværksfejl - prøv igen");
        setMasterLockStatus("locked");
        setMasterLockShakeNonce((prev) => prev + 1);
        return;
      }
      setMasterLockStatus("unlocked");
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
      setMasterLockError("Master-låsen kunne ikke tjekkes lige nu. Prøv igen.");
      setMasterLockStatus("locked");
      setMasterLockShakeNonce((prev) => prev + 1);
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
      setTypedAnswerError({
        key: activeTypedAnswerKey,
        message: "Netværksfejl - prøv igen",
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
      const response = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image,
          sessionId,
          participantId,
          postIndex: currentPostIndex,
        }),
      });

      const payload = (await response.json()) as {
        isMatch?: boolean;
        message?: string;
        imageUrl?: string | null;
        storedAnswer?: boolean;
        error?: string;
      };

      if (!response.ok || typeof payload.isMatch !== "boolean" || typeof payload.message !== "string") {
        throw new Error(payload.error || "Ugyldigt svar fra billedanalysen.");
      }

      if (!isMountedRef.current) return;

      if (!payload.isMatch) {
        setIsAnalyzingPhoto(false);
        setPhotoFeedback({
          key: activeTypedAnswerKey,
          tone: "error",
          message: formatPhotoFailureMessage(payload.message, isSelfie),
        });
        return;
      }

      const didSaveAnswer = await handleAnswer(0, null, {
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
        message: isSelfie ? `Selfie godkendt! ${payload.message}` : payload.message,
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

  const player: PlayPlayerState = {
    pendingPlayerName,
    playerName,
    hasConfirmedName,
    nameError,
    participantId,
    activeDisplayName,
    celebrationName,
  };

  const gps: PlayGpsState = {
    myLoc,
    distance,
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
    escapeReward,
    roleplayReply,
    typedAnswerError,
    latestMessage,
    resumeMessage,
  };

  const screenMode: PlayScreenState["mode"] = isLoading
    ? "loading"
    : loadError
      ? "load_error"
      : isKicked
        ? "kicked"
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

  const screen: PlayScreenState = {
    mode: screenMode,
    isLoading,
    loadError,
    isFinished,
    isKicked,
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
    totalQuestions: questions.length,
    progressPercent,
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
    hasActivePhotoSuccess,
    hasActiveQuizSuccess,
    hasAllEscapeBricks,
    hasRoleplayInputErrorTone,
    isBlockingGpsError,
    isProvisioningParticipant,
    isEscapeRace,
    isRoleplayImmersed,
    isSelfiePhotoTask,
    isSubmitting,
    isSubmittingAnswer,
    isAnalyzingPhoto,
    isCheckingEscapeAnswer,
    shouldKeepScreenAwake,
  };

  return {
    player,
    gps,
    progress,
    flags,
    actions: {
      confirmName,
      setPendingPlayerName,
      setMasterLockInput,
      setShowEscapeResults,
      clearTypedAnswerError,
      clearPostActionError,
      clearRoleplayInputErrorTone,
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
