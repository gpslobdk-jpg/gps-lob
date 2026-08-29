"use client";

import { ArrowDown, CheckCircle2, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  foundationCharacterConversationService,
  type CharacterConversationHandle,
  type CharacterConversationStopReason,
} from "@/lib/characterConversation";
import type { CharacterPostConfig } from "@/lib/characterPosts";

type PilenConversationCardProps = {
  config: CharacterPostConfig;
  disabled: boolean;
  onCompletePost: () => Promise<void>;
};

type ConversationPhase = "ready" | "starting" | "active" | "ended";

const primaryButtonClassName =
  "inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-5 py-3 text-base font-black text-slate-950 shadow-[0_16px_36px_rgba(16,185,129,0.28)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/80 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

export default function PilenConversationCard({
  config,
  disabled,
  onCompletePost,
}: PilenConversationCardProps) {
  const [phase, setPhase] = useState<ConversationPhase>("ready");
  const [remainingSeconds, setRemainingSeconds] = useState(
    config.maxDurationSeconds,
  );
  const [isCompleting, setIsCompleting] = useState(false);
  const handleRef = useRef<CharacterConversationHandle | null>(null);

  const stopConversation = useCallback(
    async (reason: CharacterConversationStopReason) => {
      const handle = handleRef.current;
      handleRef.current = null;
      if (handle) {
        await handle.stop(reason);
      }
      setPhase("ended");
    },
    [],
  );

  useEffect(() => {
    if (phase !== "active") return;

    const intervalId = window.setInterval(() => {
      const handle = handleRef.current;
      if (!handle) return;
      const elapsedSeconds = Math.floor((Date.now() - handle.startedAtMs) / 1000);
      const nextRemaining = Math.max(
        0,
        config.maxDurationSeconds - elapsedSeconds,
      );
      setRemainingSeconds(nextRemaining);
      if (nextRemaining === 0) {
        window.clearInterval(intervalId);
        void stopConversation("time_limit");
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [config.maxDurationSeconds, phase, stopConversation]);

  useEffect(() => {
    return () => {
      const handle = handleRef.current;
      handleRef.current = null;
      if (handle) {
        void handle.stop("component_unmounted");
      }
    };
  }, []);

  const startConversation = async () => {
    if (phase !== "ready" || disabled) return;
    setPhase("starting");
    const handle = await foundationCharacterConversationService.start({
      config,
      locationContext: { placeDescription: config.placeDescription },
    });
    handleRef.current = handle;
    setRemainingSeconds(config.maxDurationSeconds);
    setPhase("active");
  };

  const completePost = async () => {
    if (isCompleting || disabled) return;
    setIsCompleting(true);
    try {
      await onCompletePost();
    } finally {
      setIsCompleting(false);
    }
  };

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
          <button
            type="button"
            onClick={() => void startConversation()}
            disabled={disabled || phase === "starting"}
            className={primaryButtonClassName}
          >
            <Mic aria-hidden="true" className="h-5 w-5" />
            {phase === "starting" ? "Getting Pilen ready…" : "Talk to Pilen"}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-white/58">
            Voice is not connected in this preview. No sound or conversation is recorded or saved.
          </p>
        </div>
      ) : null}

      {phase === "active" ? (
        <div className="mt-6 rounded-2xl border border-emerald-200/25 bg-emerald-400/10 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-black text-emerald-100">Pilen is ready</p>
              <p className="mt-1 text-sm text-white/70">
                This foundation shows the safe conversation state without opening the microphone.
              </p>
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
