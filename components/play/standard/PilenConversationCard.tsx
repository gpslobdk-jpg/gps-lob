"use client";

import {
  ArrowDown,
  CheckCircle2,
  Headphones,
  Loader2,
  Mic,
  RefreshCcw,
  Square,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CharacterConversationError,
  foundationCharacterConversationService,
  type CharacterConversationErrorCode,
  type CharacterConversationHandle,
  type CharacterConversationStatus,
  type CharacterConversationStopReason,
} from "@/lib/characterConversation";
import {
  isPilenRealtimeClientEnabled,
  realtimeCharacterConversationService,
} from "@/lib/characterRealtimeClient";
import type { CharacterPostConfig } from "@/lib/characterPosts";
import { PILEN_STUDENT_AI_NOTICE } from "@/lib/pilenProductCopy";

type PilenConversationCardProps = {
  config: CharacterPostConfig;
  sessionId: string;
  postIndex: number;
  disabled: boolean;
  onCompletePost: () => Promise<void>;
};

type ConversationPhase = "ready" | "starting" | "active" | "ended" | "error";

const primaryButtonClassName =
  "inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-5 py-3 text-base font-black text-slate-950 shadow-[0_16px_36px_rgba(16,185,129,0.28)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/80 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

function getErrorMessage(code: CharacterConversationErrorCode | null) {
  switch (code) {
    case "MICROPHONE_DENIED":
      return "Microphone access is off. Allow it in your browser settings, then try again.";
    case "MICROPHONE_UNAVAILABLE":
      return "The microphone is busy or unavailable. Check it and try again.";
    case "UNSUPPORTED_BROWSER":
      return "This browser cannot start the voice conversation. Try Safari or Chrome.";
    case "PARTICIPANT_UNAUTHORIZED":
      return "Your participant login has expired. Rejoin the run before trying again.";
    case "POST_LOCKED":
      return "GPS needs a fresh, accurate position at this post. Wait a moment, then try again.";
    case "POST_UNAVAILABLE":
      return "This is no longer your current post. Return to the map and open the correct post.";
    case "RATE_LIMITED":
      return "There have been several starts. Wait one minute, then try again.";
    case "FEATURE_UNAVAILABLE":
      return "Voice is not available in this environment yet.";
    default:
      return "The connection was interrupted. Check the network and try again.";
  }
}

export default function PilenConversationCard({
  config,
  sessionId,
  postIndex,
  disabled,
  onCompletePost,
}: PilenConversationCardProps) {
  const realtimeEnabled = isPilenRealtimeClientEnabled();
  const [phase, setPhase] = useState<ConversationPhase>("ready");
  const [status, setStatus] =
    useState<CharacterConversationStatus>("connecting");
  const [errorCode, setErrorCode] =
    useState<CharacterConversationErrorCode | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(
    config.maxDurationSeconds,
  );
  const [isCompleting, setIsCompleting] = useState(false);
  const handleRef = useRef<CharacterConversationHandle | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const stopConversation = useCallback(
    async (reason: CharacterConversationStopReason) => {
      const handle = handleRef.current;
      handleRef.current = null;
      const abortController = abortControllerRef.current;
      abortControllerRef.current = null;
      if (handle) await handle.stop(reason);
      abortController?.abort();
      if (mountedRef.current) setPhase("ended");
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      const handle = handleRef.current;
      handleRef.current = null;
      if (handle) void handle.stop("component_unmounted");
    };
  }, []);

  useEffect(() => {
    const stopForNavigation = () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      const handle = handleRef.current;
      handleRef.current = null;
      if (handle) void handle.stop("navigation");
    };
    const stopWhenHidden = () => {
      if (document.visibilityState !== "hidden") return;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      const handle = handleRef.current;
      handleRef.current = null;
      if (handle) void handle.stop("page_hidden");
      if (mountedRef.current) setPhase("ready");
    };

    window.addEventListener("pagehide", stopForNavigation);
    window.addEventListener("beforeunload", stopForNavigation);
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      window.removeEventListener("pagehide", stopForNavigation);
      window.removeEventListener("beforeunload", stopForNavigation);
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, []);

  useEffect(() => {
    if (phase !== "active") return;
    const intervalId = window.setInterval(() => {
      const handle = handleRef.current;
      if (!handle) return;
      const nextRemaining = Math.max(
        0,
        config.maxDurationSeconds -
          Math.floor((Date.now() - handle.startedAtMs) / 1000),
      );
      setRemainingSeconds(nextRemaining);
      if (nextRemaining === 0) void stopConversation("time_limit");
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [config.maxDurationSeconds, phase, stopConversation]);

  const startConversation = async () => {
    if ((phase !== "ready" && phase !== "error") || disabled) return;
    setPhase("starting");
    setStatus("connecting");
    setErrorCode(null);
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const service = realtimeEnabled
      ? realtimeCharacterConversationService
      : foundationCharacterConversationService;

    try {
      const handle = await service.start({
        config,
        locationContext: { placeDescription: config.placeDescription },
        signal: abortController.signal,
        sessionId,
        postIndex,
        onStatusChange: (nextStatus) => {
          if (mountedRef.current) setStatus(nextStatus);
        },
        onEnded: () => {
          abortControllerRef.current = null;
          handleRef.current = null;
          if (mountedRef.current) setPhase("ended");
        },
        onFailure: (error) => {
          abortControllerRef.current = null;
          handleRef.current = null;
          if (!mountedRef.current) return;
          setErrorCode(error.code);
          setPhase("error");
        },
      });
      if (!mountedRef.current) {
        await handle.stop("component_unmounted");
        return;
      }
      handleRef.current = handle;
      setRemainingSeconds(config.maxDurationSeconds);
      if (!realtimeEnabled) setStatus("listening");
      setPhase("active");
    } catch (error) {
      if (!mountedRef.current) return;
      if (abortController.signal.aborted) {
        setPhase("ready");
        return;
      }
      abortControllerRef.current = null;
      setErrorCode(
        error instanceof CharacterConversationError
          ? error.code
          : "NETWORK_ERROR",
      );
      setPhase("error");
    }
  };

  const completePost = async () => {
    if (isCompleting || disabled) return;
    const handle = handleRef.current;
    handleRef.current = null;
    const abortController = abortControllerRef.current;
    abortControllerRef.current = null;
    if (handle) await handle.stop("student_finished");
    abortController?.abort();
    setIsCompleting(true);
    try {
      await onCompletePost();
    } finally {
      if (mountedRef.current) setIsCompleting(false);
    }
  };

  const activeStatusCopy = !realtimeEnabled
    ? "Pilen is ready"
    : status === "speaking"
      ? "Pilen is speaking"
      : status === "listening"
        ? "Pilen is listening"
        : "Connecting securely";

  return (
    <div
      data-testid="pilen-conversation-card"
      className="rounded-[1.75rem] border border-sky-200/20 bg-[linear-gradient(160deg,rgba(14,116,144,0.3),rgba(15,23,42,0.96)_58%)] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.5)] sm:p-7"
    >
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-sky-100/30 bg-sky-300/15 shadow-[0_0_40px_rgba(125,211,252,0.16)]">
        <ArrowDown aria-hidden="true" className="h-12 w-12 text-sky-100" />
      </div>

      <div className="mt-5 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200/80">
          You found Pilen
        </p>
        <h1 className="mt-2 text-3xl font-black text-white">Pilen</h1>
        <p className="mt-3 text-base leading-7 text-white/78">
          Talk briefly with Pilen in English about {config.topic}.
        </p>
      </div>

      <dl className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-bold text-sky-200">Place</dt>
          <dd className="mt-1 text-white/80">{config.placeDescription}</dd>
        </div>
        <div>
          <dt className="font-bold text-sky-200">Level</dt>
          <dd className="mt-1 text-white/80">{config.gradeLevel}</dd>
        </div>
      </dl>

      {phase === "ready" || phase === "starting" ? (
        <div className="mt-6">
          <p
            lang="da"
            className="mb-4 rounded-2xl border border-sky-200/20 bg-sky-200/8 px-4 py-3 text-center text-sm font-semibold leading-6 text-sky-50"
          >
            {PILEN_STUDENT_AI_NOTICE}
          </p>
          <button
            type="button"
            onClick={() => void startConversation()}
            disabled={disabled || phase === "starting"}
            className={primaryButtonClassName}
          >
            {phase === "starting" ? (
              <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            ) : (
              <Mic aria-hidden="true" className="h-5 w-5" />
            )}
            {phase === "starting" ? "Getting Pilen ready…" : "Talk to Pilen"}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-white/58">
            {realtimeEnabled
              ? "Audio is sent live for this short AI conversation. SkoleGPS does not record or save it."
              : "Voice is not connected in this preview. No sound or conversation is recorded or saved."}
          </p>
        </div>
      ) : null}

      {phase === "active" ? (
        <div
          className="mt-6 rounded-2xl border border-emerald-200/25 bg-emerald-400/10 p-4"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              {status === "speaking" ? (
                <Volume2
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100"
                />
              ) : (
                <Headphones
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100"
                />
              )}
              <div>
                <p className="font-black text-emerald-100">
                  {activeStatusCopy}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {realtimeEnabled
                    ? "Stay by the post. You can stop at any time."
                    : "This foundation shows the safe conversation state without opening the microphone."}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-slate-950/70 px-3 py-2 font-mono text-sm font-bold text-emerald-100">
              {remainingSeconds}s
            </span>
          </div>
          <button
            type="button"
            onClick={() => void stopConversation("student_finished")}
            className="mt-4 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-950 px-5 py-3 font-black text-white"
          >
            <Square aria-hidden="true" className="h-4 w-4" />
            End conversation
          </button>
        </div>
      ) : null}

      {phase === "error" ? (
        <div
          className="mt-6 rounded-2xl border border-amber-200/30 bg-amber-400/10 p-4"
          role="alert"
        >
          <p className="font-black text-amber-100">Pilen could not connect</p>
          <p className="mt-2 text-sm leading-6 text-white/76">
            {getErrorMessage(errorCode)}
          </p>
          <button
            type="button"
            onClick={() => void startConversation()}
            disabled={disabled}
            className="mt-4 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-950 px-5 py-3 font-black text-white"
          >
            <RefreshCcw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
          <button
            type="button"
            onClick={() => void completePost()}
            disabled={disabled || isCompleting}
            className={`${primaryButtonClassName} mt-3`}
          >
            {isCompleting ? "Finishing post…" : "Finish post without voice"}
          </button>
        </div>
      ) : null}

      {phase === "ended" ? (
        <div className="mt-6 rounded-2xl border border-emerald-200/30 bg-emerald-400/12 p-4">
          <div className="flex items-center gap-3 text-emerald-100">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0" />
            <p className="font-black">Conversation ended</p>
          </div>
          <button
            type="button"
            onClick={() => void completePost()}
            disabled={disabled || isCompleting}
            className={`${primaryButtonClassName} mt-4`}
          >
            {isCompleting ? "Finishing post…" : "Finish post"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
