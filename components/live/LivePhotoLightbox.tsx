"use client";

import { poppins, rubik } from "@/lib/fonts";
import { useId } from "react";

import { formatFeedTime, getPhotoAltText, getPhotoLabel } from "@/components/live/liveDashboardUtils";
import type { LiveAnswer } from "@/components/live/types";
import { useModalFocusTrap } from "@/components/ui/useModalFocusTrap";

type LivePhotoLightboxProps = {
  answer: LiveAnswer | null;
  onClose: () => void;
  eyebrow?: string;
  showTimestamp?: boolean;
  maxWidthClass?: string;
};

export default function LivePhotoLightbox({
  answer,
  onClose,
  eyebrow = "Live foto",
  showTimestamp = true,
  maxWidthClass = "max-w-5xl",
}: LivePhotoLightboxProps) {
  const titleId = useId();
  const dialogRef = useModalFocusTrap<HTMLDivElement>({
    open: Boolean(answer?.image_url),
    onClose,
  });

  if (!answer?.image_url) {
    return null;
  }

  return (
    <div
      className={`skolegps-teacher-dialog-backdrop fixed inset-0 z-1400 flex items-center justify-center p-4 ${poppins.className}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`skolegps-teacher-dialog w-full ${maxWidthClass} overflow-hidden rounded-4xl border border-white/10 bg-slate-900/95 shadow-[0_40px_120px_rgba(2,6,23,0.7)]`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
              {eyebrow}
            </p>
            <h2 id={titleId} className={`mt-2 text-2xl font-black uppercase tracking-[0.14em] text-white ${rubik.className}`}>
              {answer.studentName}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {getPhotoLabel(answer)}
              {showTimestamp && answer.createdAt ? ` | ${formatFeedTime(answer.createdAt)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk foto"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-white/10"
          >
            Luk
          </button>
        </div>

        <div className="max-h-[85vh] overflow-y-auto p-4 md:p-6">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={answer.image_url}
              alt={getPhotoAltText(answer)}
              className="h-auto max-h-[72vh] w-full object-contain bg-slate-950"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
