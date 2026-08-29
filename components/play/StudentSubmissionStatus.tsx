import {
  CheckCircle2,
  CloudOff,
  Loader2,
  RefreshCcw,
  TriangleAlert,
} from "lucide-react";

import type { StudentSubmissionState } from "@/lib/submissions/studentSubmissionState";

type StudentSubmissionStatusProps = {
  state: StudentSubmissionState;
  onRetry?: () => void;
  retryDisabled?: boolean;
};

export default function StudentSubmissionStatus({
  state,
  onRetry,
  retryDisabled = false,
}: StudentSubmissionStatusProps) {
  if (state.status === "idle" || state.status === "editing") {
    return null;
  }

  const canRetry =
    Boolean(onRetry) &&
    (state.status === "awaiting_confirmation" ||
      state.status === "retryable_error");
  const isCharacterCompletion = state.submissionType === "character";
  const retryTitle =
    state.submissionType === "photo"
      ? "Billedet kunne ikke sendes endnu."
      : state.submissionType === "skip"
        ? "Posten kunne ikke springes over endnu. Prøv igen."
        : isCharacterCompletion
          ? "Posten kunne ikke gemmes endnu."
          : "Svaret kunne ikke sendes endnu.";
  const retryDetail =
    state.submissionType === "photo"
      ? "Billedet er stadig valgt. Prøv igen."
      : state.submissionType === "skip"
        ? null
        : "Prøv igen, så tjekker vi, om det allerede er gemt.";

  const content = (() => {
    switch (state.status) {
      case "submitting":
        return {
          icon: (
            <Loader2
              aria-hidden="true"
              className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none"
            />
          ),
          title: isCharacterCompletion ? "Gemmer posten…" : "Sender dit svar…",
          detail: null,
          className:
            "border-amber-300/35 bg-amber-500/12 text-amber-50",
        };
      case "queued_offline":
        return {
          icon: <CloudOff aria-hidden="true" className="h-5 w-5 shrink-0" />,
          title: isCharacterCompletion
            ? "Posten er gemt på telefonen"
            : "Svaret er gemt på telefonen",
          detail:
            "Det sendes automatisk, når forbindelsen er tilbage.",
          className: "border-sky-300/35 bg-sky-500/12 text-sky-50",
        };
      case "confirmed":
        return {
          icon: (
            <CheckCircle2
              aria-hidden="true"
              className="h-5 w-5 shrink-0"
            />
          ),
          title: isCharacterCompletion ? "Posten er gemt" : "Svaret er gemt",
          detail: null,
          className:
            "border-emerald-300/35 bg-emerald-500/12 text-emerald-50",
        };
      case "awaiting_confirmation":
        return {
          icon: (
            <RefreshCcw aria-hidden="true" className="h-5 w-5 shrink-0" />
          ),
          title: retryTitle,
          detail: retryDetail,
          className:
            "border-orange-300/35 bg-orange-500/12 text-orange-50",
        };
      case "retryable_error":
        return {
          icon: (
            <TriangleAlert
              aria-hidden="true"
              className="h-5 w-5 shrink-0"
            />
          ),
          title: retryTitle,
          detail: retryDetail,
          className:
            "border-orange-300/35 bg-orange-500/12 text-orange-50",
        };
      case "rejected":
        return {
          icon: (
            <TriangleAlert
              aria-hidden="true"
              className="h-5 w-5 shrink-0"
            />
          ),
          title: isCharacterCompletion
            ? "Posten kunne ikke afsluttes."
            : "Svaret kunne ikke afleveres.",
          detail: "Bliv på posten og få hjælp af læreren.",
          className: "border-rose-300/35 bg-rose-500/12 text-rose-50",
        };
      case "session_closed":
        return {
          icon: (
            <TriangleAlert
              aria-hidden="true"
              className="h-5 w-5 shrink-0"
            />
          ),
          title: "Løbet er afsluttet.",
          detail: isCharacterCompletion
            ? "Posten kan ikke længere gemmes."
            : "Svaret kan ikke længere afleveres.",
          className: "border-slate-400/35 bg-slate-500/12 text-slate-50",
        };
      default:
        return null;
    }
  })();

  if (!content) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`rounded-2xl border px-4 py-4 text-sm shadow-sm ${content.className}`}
    >
      <div className="flex items-start gap-3">
        {content.icon}
        <div className="min-w-0 flex-1">
          <p className="font-bold">{content.title}</p>
          {content.detail ? (
            <p className="mt-1 leading-relaxed opacity-90">{content.detail}</p>
          ) : null}
        </div>
      </div>

      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retryDisabled}
          className="mt-4 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border border-current/30 bg-slate-950/35 px-5 py-3 font-black uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw aria-hidden="true" className="h-4 w-4" />
          Prøv igen
        </button>
      ) : null}
    </div>
  );
}
