"use client";

import { Poppins, Rubik } from "next/font/google";

import { formatFeedTime, getPhotoAltText, getPhotoLabel } from "@/components/live/liveDashboardUtils";
import type { LiveAnswer } from "@/components/live/types";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type LivePhotoLightboxProps = {
  answer: LiveAnswer | null;
  onClose: () => void;
};

export default function LivePhotoLightbox({ answer, onClose }: LivePhotoLightboxProps) {
  if (!answer?.image_url) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-1400 flex items-center justify-center bg-slate-950/88 p-4 backdrop-blur-md ${poppins.className}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-4xl border border-white/10 bg-slate-900/95 shadow-[0_40px_120px_rgba(2,6,23,0.7)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
              Live foto
            </p>
            <h4 className={`mt-2 text-2xl font-black uppercase tracking-[0.14em] text-white ${rubik.className}`}>
              {answer.studentName}
            </h4>
            <p className="mt-2 text-sm text-slate-300">
              {getPhotoLabel(answer)}
              {answer.createdAt ? ` | ${formatFeedTime(answer.createdAt)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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