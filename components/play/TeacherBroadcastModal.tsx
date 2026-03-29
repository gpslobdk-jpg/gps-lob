"use client";

import { AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect } from "react";

import { wrapTextClass } from "./playUtils";
import type { TeacherBroadcastMessage } from "./types";

type TeacherBroadcastModalProps = {
  message: TeacherBroadcastMessage | null;
  onDismiss: () => void;
};

function formatCreatedAt(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function TeacherBroadcastModal({ message, onDismiss }: TeacherBroadcastModalProps) {
  useEffect(() => {
    if (!message) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [message, onDismiss]);

  if (!message || typeof document === "undefined") {
    return null;
  }

  const sentAtLabel = formatCreatedAt(message.createdAt);

  return createPortal(
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-slate-950/82 px-4 py-6 backdrop-blur-md">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.16),transparent_30%)]" />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-cyan-300/30 bg-slate-950/92 p-6 text-white shadow-[0_40px_120px_rgba(2,6,23,0.75)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_34%)]" />

        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/12 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.18)]">
            <AlertCircle className="h-7 w-7" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/80">
              Besked fra læreren
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Stop op og læs dette
            </h2>
            {sentAtLabel ? (
              <p className="mt-2 text-sm font-medium text-cyan-100/70">Sendt kl. {sentAtLabel}</p>
            ) : null}
            <p className={`mt-6 text-lg leading-8 text-white sm:text-[1.35rem] sm:leading-9 ${wrapTextClass}`}>
              {message.message}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="relative mt-8 inline-flex min-h-[60px] w-full items-center justify-center rounded-[1.35rem] border border-cyan-200/60 bg-cyan-300 px-5 py-4 text-base font-black uppercase tracking-[0.24em] text-slate-950 shadow-[0_24px_50px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200"
        >
          Forstået
        </button>
      </div>
    </div>,
    document.body
  );
}