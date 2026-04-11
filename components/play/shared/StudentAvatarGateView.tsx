"use client";

import Image from "next/image";
import { Camera, ChevronLeft, ImagePlus } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

import { compressAvatarImage } from "../playUtils";
import StudentOnboardingShell, {
  getStudentOnboardingToneStyles,
  type StudentOnboardingTone,
} from "./StudentOnboardingShell";

type StudentAvatarGateViewProps = {
  tone?: StudentOnboardingTone;
  title: string;
  description: string;
  playerName: string;
  avatarPreviewUrl?: string;
  previewAlt: string;
  helperText: string;
  captureLabel: string;
  replaceLabel: string;
  confirmLabel: string;
  skipLabel: string;
  onPreviewChange: (value: string | null) => void;
  onComplete: (skip: boolean) => void;
  onBack?: () => void;
};

export default function StudentAvatarGateView({
  tone = "emerald",
  title,
  description,
  playerName,
  avatarPreviewUrl,
  previewAlt,
  helperText,
  captureLabel,
  replaceLabel,
  confirmLabel,
  skipLabel,
  onPreviewChange,
  onComplete,
  onBack,
}: StudentAvatarGateViewProps) {
  const styles = getStudentOnboardingToneStyles(tone);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const previewShellClass =
    tone === "cyan"
      ? "relative h-36 w-36 overflow-hidden rounded-full border border-cyan-200/30 bg-slate-950 shadow-[0_0_0_6px_rgba(34,211,238,0.12),0_0_34px_rgba(34,211,238,0.18)]"
      : "relative h-36 w-36 overflow-hidden rounded-full border border-emerald-200/30 bg-slate-950 shadow-[0_0_0_6px_rgba(16,185,129,0.12),0_0_34px_rgba(52,211,153,0.18)]";
  const previewPlaceholderClass =
    tone === "cyan"
      ? "bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.24),transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))]"
      : "bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.22),transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))]";
  const secondaryButtonClass =
    tone === "cyan"
      ? "inline-flex w-full items-center justify-center gap-2 rounded-[1.35rem] border border-cyan-300/25 bg-cyan-500/12 px-4 py-3 text-sm font-black tracking-[0.08em] text-cyan-50 transition hover:bg-cyan-500/18"
      : "inline-flex w-full items-center justify-center gap-2 rounded-[1.35rem] border border-emerald-300/25 bg-emerald-500/12 px-4 py-3 text-sm font-black tracking-[0.08em] text-emerald-50 transition hover:bg-emerald-500/18";
  const primaryButtonClass =
    tone === "cyan"
      ? "inline-flex w-full items-center justify-center rounded-[1.4rem] bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/45"
      : "inline-flex w-full items-center justify-center rounded-[1.4rem] bg-gradient-to-r from-emerald-400 to-sky-400 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#03110d] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65";

  const handleAvatarCapture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const nextAvatarUrl = await compressAvatarImage(file);
      onPreviewChange(nextAvatarUrl);
      setCaptureError(null);
    } catch (error) {
      console.error("Kunne ikke laese avatar-billedet lokalt:", error);
      setCaptureError("Billedet kunne ikke læses. Prøv igen.");
    }
  };

  return (
    <StudentOnboardingShell tone={tone} step={2} title={title} description={description}>
      <div className="space-y-5">
        <div className={`rounded-[1.5rem] border px-4 py-4 ${tone === "cyan" ? "border-cyan-300/20 bg-cyan-500/10" : "border-emerald-300/20 bg-emerald-500/10"}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${styles.eyebrowClass}`}>
            Hold klar
          </p>
          <p className="mt-2 text-xl font-black text-white">{playerName || "Jeres hold"}</p>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className={previewShellClass}>
            {avatarPreviewUrl ? (
              <Image
                src={avatarPreviewUrl}
                alt={previewAlt}
                fill
                className="object-cover"
                unoptimized
                loader={({ src }) => src}
              />
            ) : (
              <div className={`flex h-full w-full items-center justify-center ${previewPlaceholderClass}`}>
                <Camera className="h-12 w-12 text-white/80" />
              </div>
            )}
          </div>

          <p className={`max-w-sm text-sm leading-6 ${styles.descriptionClass}`}>{helperText}</p>
        </div>

        {captureError ? (
          <div className="rounded-[1.35rem] border border-rose-300/30 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-100">
            {captureError}
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleAvatarCapture}
          className="hidden"
        />

        <div className="space-y-3">
          <button type="button" onClick={() => inputRef.current?.click()} className={secondaryButtonClass}>
            <ImagePlus className="h-4 w-4" />
            {avatarPreviewUrl ? replaceLabel : captureLabel}
          </button>

          <button type="button" onClick={() => onComplete(false)} disabled={!avatarPreviewUrl} className={primaryButtonClass}>
            {confirmLabel}
          </button>

          <button
            type="button"
            onClick={() => onComplete(true)}
            className="inline-flex w-full items-center justify-center rounded-[1.35rem] border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/8 hover:text-white"
          >
            {skipLabel}
          </button>

          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[1.25rem] px-4 py-2 text-sm font-semibold text-white/55 transition hover:text-white/82"
            >
              <ChevronLeft className="h-4 w-4" />
              Tilbage
            </button>
          ) : null}
        </div>
      </div>
    </StudentOnboardingShell>
  );
}