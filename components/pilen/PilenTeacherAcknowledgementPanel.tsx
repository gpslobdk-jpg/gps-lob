import Link from "next/link";

import {
  PILEN_PRIVACY_LINK_LABEL,
  PILEN_PRIVACY_PATH,
  PILEN_TEACHER_AI_NOTICE,
  PILEN_TEACHER_PERMISSION_CONFIRMATION,
} from "@/lib/pilenProductCopy";

type PilenTeacherAcknowledgementPanelProps = {
  status: "loading" | "required" | "accepted" | "error";
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onRetry?: () => void;
};

export default function PilenTeacherAcknowledgementPanel({
  status,
  checked,
  disabled = false,
  onCheckedChange,
  onRetry,
}: PilenTeacherAcknowledgementPanelProps) {
  return (
    <section
      data-testid="pilen-teacher-acknowledgement"
      className="rounded-2xl border border-sky-300/25 bg-sky-400/8 p-4 text-sm text-slate-100"
    >
      <p className="leading-6">{PILEN_TEACHER_AI_NOTICE}</p>

      {status === "accepted" ? (
        <p className="mt-3 font-semibold text-emerald-200">
          Din bekræftelse til den aktuelle tekstversion er registreret.
        </p>
      ) : (
        <label className="mt-3 flex cursor-pointer items-start gap-3 leading-6">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
            disabled={disabled || status === "loading" || status === "error"}
            className="mt-1 h-4 w-4 shrink-0 accent-sky-400"
          />
          <span>{PILEN_TEACHER_PERMISSION_CONFIRMATION}</span>
        </label>
      )}

      {status === "loading" ? (
        <p className="mt-2 text-xs text-slate-300">Kontrollerer tidligere bekræftelse…</p>
      ) : null}
      {status === "error" ? (
        <div className="mt-2 text-xs font-semibold text-amber-200">
          <p>Bekræftelsen kan ikke kontrolleres lige nu.</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={disabled}
              className="mt-2 underline underline-offset-4 disabled:opacity-60"
            >
              Prøv igen
            </button>
          ) : null}
        </div>
      ) : null}

      <Link
        href={PILEN_PRIVACY_PATH}
        className="mt-3 inline-flex text-xs font-semibold text-sky-200 underline underline-offset-4 hover:text-sky-100"
      >
        {PILEN_PRIVACY_LINK_LABEL}
      </Link>
    </section>
  );
}
