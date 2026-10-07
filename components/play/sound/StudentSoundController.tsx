"use client";

import { ChevronUp, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import Mascot from "@/components/brand/Mascot";
import type { PlayUiState } from "@/components/play/types";

type StudentSoundMode = "music-effects" | "effects-only" | "muted";
type EffectName = "tap" | "post" | "correct" | "finish";

type StudentSoundPlayers = {
  music: HTMLAudioElement;
  effects: Record<EffectName, HTMLAudioElement>;
};

const SOUND_PREFERENCE_STORAGE_KEY = "skolegps.student-sound.preference.v1";

const AUDIO_ASSET = {
  music: "/audio/elev/mission-loop.mp3",
  finish: "/audio/elev/i-maal-sting.mp3",
  tap: "/audio/elev/tap.mp3",
  post: "/audio/elev/post.mp3",
  correct: "/audio/elev/correct.mp3",
} as const;

const MODE_COPY: Record<StudentSoundMode, string> = {
  "music-effects": "Musik + spillyde",
  "effects-only": "Kun spillyde",
  muted: "Uden spillyd",
};

function isStoredMode(value: string | null): value is StudentSoundMode {
  return value === "music-effects" || value === "effects-only" || value === "muted";
}

function readStoredMode(): StudentSoundMode {
  try {
    const stored = window.localStorage.getItem(SOUND_PREFERENCE_STORAGE_KEY);
    return isStoredMode(stored) ? stored : "muted";
  } catch {
    return "muted";
  }
}

function storeMode(mode: StudentSoundMode) {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_STORAGE_KEY, mode);
  } catch {
    // Indstillinger er frivillige. Spillet fortsætter lydløst, hvis lageret er lukket.
  }
}

function subscribeToStoredMode() {
  return () => undefined;
}

function isSpeechActive() {
  return typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking;
}

function createAudio(src: string, volume: number, loop = false) {
  const audio = new Audio();
  audio.src = src;
  audio.preload = "metadata";
  audio.volume = volume;
  audio.loop = loop;
  return audio;
}

/**
 * A read-only, opt-in player for the scoped standard quiz experience.
 * It deliberately owns no gameplay callbacks, does no network work itself,
 * and never creates an audio element before an explicit student gesture.
 */
export default function StudentSoundController({
  sessionId,
  ui,
  isLocationGuidanceVisible,
}: {
  sessionId: string;
  ui: PlayUiState;
  isLocationGuidanceVisible: boolean;
}) {
  const storedMode = useSyncExternalStore<StudentSoundMode>(
    subscribeToStoredMode,
    readStoredMode,
    (): StudentSoundMode => "muted",
  );
  const [modeOverride, setModeOverride] = useState<StudentSoundMode | null>(null);
  const mode = modeOverride ?? storedMode;
  const [hasChosenForThisVisit, setHasChosenForThisVisit] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isActivatedByGesture, setIsActivatedByGesture] = useState(false);
  const [needsExplicitResume, setNeedsExplicitResume] = useState(false);
  const playersRef = useRef<StudentSoundPlayers | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modeRef = useRef<StudentSoundMode>("muted");
  const activatedRef = useRef(false);
  const needsResumeRef = useRef(false);
  const previousQuestionVisibleRef = useRef(false);
  const signalBaselineSetRef = useRef(false);
  const seenSignalKeysRef = useRef(new Set<string>());
  const teacherMessageBaselineRef = useRef<string | null | undefined>(undefined);

  const {
    progress,
    flags,
  } = ui;
  const {
    showQuestion,
    currentPostIndex,
    currentPost,
    feedback,
    screen,
  } = progress;
  const studentSubmission = feedback.studentSubmission;

  const pauseAll = useCallback(() => {
    const players = playersRef.current;
    if (!players) {
      return;
    }

    players.music.pause();
    for (const effect of Object.values(players.effects)) {
      effect.pause();
    }
  }, []);

  const pauseMusic = useCallback(() => {
    playersRef.current?.music.pause();
  }, []);

  const ensurePlayers = useCallback(() => {
    if (playersRef.current) {
      return playersRef.current;
    }

    const players: StudentSoundPlayers = {
      music: createAudio(AUDIO_ASSET.music, 0.16, true),
      effects: {
        tap: createAudio(AUDIO_ASSET.tap, 0.28),
        post: createAudio(AUDIO_ASSET.post, 0.34),
        correct: createAudio(AUDIO_ASSET.correct, 0.42),
        finish: createAudio(AUDIO_ASSET.finish, 0.44),
      },
    };
    playersRef.current = players;
    return players;
  }, []);

  const playEffect = useCallback((name: EffectName) => {
    const players = playersRef.current;
    if (
      !players ||
      !activatedRef.current ||
      needsResumeRef.current ||
      modeRef.current === "muted" ||
      document.hidden ||
      isSpeechActive()
    ) {
      return;
    }

    const effect = players.effects[name];
    try {
      effect.pause();
      effect.currentTime = 0;
      void effect.play().catch(() => {
        // Browser audio can fail for many harmless reasons. Silence is safe.
      });
    } catch {
      // A stale media element is not allowed to affect gameplay.
    }
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    activatedRef.current = isActivatedByGesture;
  }, [isActivatedByGesture]);

  useEffect(() => {
    needsResumeRef.current = needsExplicitResume;
  }, [needsExplicitResume]);

  useEffect(() => {
    const stopForHiddenPage = () => {
      if (!document.hidden) {
        return;
      }

      pauseAll();
      if (activatedRef.current) {
        activatedRef.current = false;
        needsResumeRef.current = true;
        setIsActivatedByGesture(false);
        setNeedsExplicitResume(true);
      }
    };

    document.addEventListener("visibilitychange", stopForHiddenPage);
    return () => document.removeEventListener("visibilitychange", stopForHiddenPage);
  }, [pauseAll]);

  useEffect(() => {
    if (!flags.isSessionPaused || !activatedRef.current) {
      return;
    }

    pauseAll();
    needsResumeRef.current = true;
    queueMicrotask(() => setNeedsExplicitResume(true));
  }, [flags.isSessionPaused, pauseAll]);

  useEffect(() => {
    const messageKey = feedback.latestMessage?.key ?? null;
    if (teacherMessageBaselineRef.current === undefined) {
      teacherMessageBaselineRef.current = messageKey;
      return;
    }

    if (messageKey && messageKey !== teacherMessageBaselineRef.current && activatedRef.current) {
      pauseAll();
      needsResumeRef.current = true;
      queueMicrotask(() => setNeedsExplicitResume(true));
    }
    teacherMessageBaselineRef.current = messageKey;
  }, [feedback.latestMessage?.key, pauseAll]);

  useEffect(() => {
    const questionSignalKey = currentPost.activeTypedAnswerKey
      ? `${sessionId}:post:${currentPostIndex}:${currentPost.activeTypedAnswerKey}`
      : null;
    const hasAuthoritativeQuizSuccess =
      flags.hasActiveQuizSuccess &&
      currentPost.activeQuizAnswerFeedback?.tone === "success" &&
      currentPost.activeQuizAnswerFeedback.key === currentPost.activeTypedAnswerKey &&
      studentSubmission.operationId !== null &&
      studentSubmission.status === "confirmed" &&
      studentSubmission.serverConfirmed;
    const successSignalKey = hasAuthoritativeQuizSuccess
      ? `${sessionId}:correct:${studentSubmission.operationId}:${currentPost.activeQuizAnswerFeedback?.key}`
      : null;
    const hasAuthoritativeFinish =
      screen.mode === "finished" && progress.hasAuthoritativeCompletion;
    // The completion timestamp is written in a separate GameState effect. A
    // session-scoped key therefore prevents that harmless follow-up render
    // from becoming a second finish cue for the same verified result.
    const finishSignalKey = hasAuthoritativeFinish ? `${sessionId}:finish` : null;

    if (!signalBaselineSetRef.current) {
      previousQuestionVisibleRef.current = showQuestion;
      if (successSignalKey) {
        seenSignalKeysRef.current.add(successSignalKey);
      }
      if (finishSignalKey) {
        seenSignalKeysRef.current.add(finishSignalKey);
      }
      signalBaselineSetRef.current = true;
      return;
    }

    if (
      !previousQuestionVisibleRef.current &&
      showQuestion &&
      questionSignalKey &&
      !seenSignalKeysRef.current.has(questionSignalKey)
    ) {
      seenSignalKeysRef.current.add(questionSignalKey);
      playEffect("post");
    }
    previousQuestionVisibleRef.current = showQuestion;

    if (successSignalKey && !seenSignalKeysRef.current.has(successSignalKey)) {
      seenSignalKeysRef.current.add(successSignalKey);
      playEffect("correct");
    }

    if (finishSignalKey && !seenSignalKeysRef.current.has(finishSignalKey)) {
      pauseMusic();
      seenSignalKeysRef.current.add(finishSignalKey);
      playEffect("finish");
    }
  }, [
    currentPost.activeQuizAnswerFeedback?.key,
    currentPost.activeQuizAnswerFeedback?.tone,
    currentPost.activeTypedAnswerKey,
    currentPostIndex,
    flags.hasActiveQuizSuccess,
    pauseMusic,
    playEffect,
    progress.hasAuthoritativeCompletion,
    screen.mode,
    sessionId,
    showQuestion,
    studentSubmission.operationId,
    studentSubmission.serverConfirmed,
    studentSubmission.status,
  ]);

  const musicMayPlay =
    isActivatedByGesture &&
    !needsExplicitResume &&
    mode === "music-effects" &&
    !showQuestion &&
    !flags.isSessionPaused &&
    screen.mode === "active" &&
    !feedback.latestMessage &&
    !isSpeechActive();

  useEffect(() => {
    const music = playersRef.current?.music;
    if (!music) {
      return;
    }

    if (!musicMayPlay || needsResumeRef.current || document.hidden) {
      music.pause();
      return;
    }

    void music.play().catch(() => {
      // Keep the game usable if an OS/browser rejects playback.
    });
  }, [musicMayPlay]);

  useEffect(() => {
    return () => {
      pauseAll();
      playersRef.current = null;
    };
  }, [pauseAll]);

  const restoreSettingsFocus = () => {
    window.requestAnimationFrame(() => settingsTriggerRef.current?.focus());
  };

  const activate = (nextMode: StudentSoundMode, shouldRestoreSettingsFocus = false) => {
    setModeOverride(nextMode);
    storeMode(nextMode);
    setHasChosenForThisVisit(true);
    setIsSettingsOpen(false);

    if (shouldRestoreSettingsFocus) {
      restoreSettingsFocus();
    }

    if (nextMode === "muted") {
      activatedRef.current = false;
      needsResumeRef.current = false;
      setIsActivatedByGesture(false);
      setNeedsExplicitResume(false);
      pauseAll();
      return;
    }

    const players = ensurePlayers();
    modeRef.current = nextMode;
    activatedRef.current = true;
    needsResumeRef.current = false;
    setIsActivatedByGesture(true);
    setNeedsExplicitResume(false);

    if (
      nextMode === "music-effects" &&
      !showQuestion &&
      !flags.isSessionPaused &&
      screen.mode === "active" &&
      !feedback.latestMessage &&
      !document.hidden &&
      !isSpeechActive()
    ) {
      void players.music.play().catch(() => {
        // A rejection means only that this browser stays silent.
      });
    }

    playEffect("tap");
  };

  const isSafeControlMoment =
    screen.mode === "active" &&
    currentPost.activePostVariant === "quiz" &&
    !showQuestion &&
    !isLocationGuidanceVisible &&
    !flags.isSessionPaused &&
    !feedback.latestMessage;

  if (!isSafeControlMoment) {
    return null;
  }

  if (!hasChosenForThisVisit) {
    return (
      <aside
        aria-label="Valgfri spillyd"
        data-testid="student-sound-controller"
        className="fixed inset-x-3 bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+5rem))] z-[2250] mx-auto max-w-sm rounded-[1.5rem] border border-sky-200/25 bg-slate-950/95 p-4 text-white shadow-[0_20px_56px_rgba(2,6,23,0.52)] backdrop-blur-xl"
      >
        <div className="flex items-start gap-3">
          <Mascot size="xs" variant="guide" className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black">Gør missionen levende</h2>
            <p className="mt-1 text-sm leading-5 text-slate-200">Musik, bløde klik og små sejrslyde.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            data-testid="student-sound-enable"
            onClick={() => activate("music-effects")}
            className="min-h-11 rounded-xl bg-sky-400 px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          >
            Tænd spillets lyd
          </button>
          <button
            type="button"
            data-testid="student-sound-continue-silent"
            onClick={() => activate("muted")}
            className="min-h-11 rounded-xl border border-white/16 bg-white/5 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          >
            Fortsæt uden lyd
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Spillyd"
      data-testid="student-sound-controller"
      className="fixed right-3 bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+5rem))] z-[2250] max-w-[calc(100vw-1.5rem)] text-white"
    >
      {isSettingsOpen ? (
        <div className="mb-2 w-72 rounded-[1.35rem] border border-sky-200/25 bg-slate-950/95 p-3 shadow-[0_20px_56px_rgba(2,6,23,0.52)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black">Spillyd</p>
            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(false);
                restoreSettingsFocus();
              }}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-sky-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
            >
              <ChevronUp aria-hidden="true" className="h-4 w-4" /> Luk
            </button>
          </div>
          <div className="mt-2 grid gap-1.5" role="group" aria-label="Vælg spillyd">
            {(Object.keys(MODE_COPY) as StudentSoundMode[]).map((choice) => (
              <button
                key={choice}
                type="button"
                data-testid={`student-sound-mode-${choice}`}
                aria-pressed={mode === choice}
                onClick={() => activate(choice, true)}
                className={`min-h-10 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200 ${
                  mode === choice
                    ? "bg-sky-400 text-slate-950"
                    : "bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {MODE_COPY[choice]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {needsExplicitResume && mode !== "muted" ? (
        <button
          type="button"
          data-testid="student-sound-resume"
          onClick={() => activate(mode)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200/30 bg-slate-950/95 px-4 text-sm font-bold shadow-lg backdrop-blur-xl transition hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          <Volume2 aria-hidden="true" className="h-4 w-4 text-sky-200" />
          Tænd lyd igen
        </button>
      ) : (
        <button
          type="button"
          data-testid="student-sound-settings"
          ref={settingsTriggerRef}
          aria-expanded={isSettingsOpen}
          onClick={() => {
            if (isActivatedByGesture && mode !== "muted") {
              playEffect("tap");
            }
            setIsSettingsOpen((open) => !open);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200/30 bg-slate-950/95 px-4 text-sm font-bold shadow-lg backdrop-blur-xl transition hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          {mode === "muted" ? (
            <VolumeX aria-hidden="true" className="h-4 w-4 text-slate-300" />
          ) : (
            <Volume2 aria-hidden="true" className="h-4 w-4 text-sky-200" />
          )}
          Lyd: {mode === "muted" ? "Fra" : mode === "effects-only" ? "Effekter" : "Til"}
        </button>
      )}
    </aside>
  );
}
