"use client";

import { Poppins, Rubik } from "next/font/google";
import { X } from "lucide-react";

import { getPhotoAltText, getPhotoLabel } from "@/components/live/liveDashboardUtils";
import type { LiveAnswer } from "@/components/live/types";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type LivePhotosModuleProps = {
  photoAnswers: LiveAnswer[];
  hasAnswersTable: boolean;
  onSelectPhoto: (answer: LiveAnswer) => void;
  onClose: () => void;
};

export default function LivePhotosModule({
  photoAnswers,
  hasAnswersTable,
  onSelectPhoto,
  onClose,
}: LivePhotosModuleProps) {
  return (
    <section className={`flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-slate-950 text-white ${poppins.className}`}>
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/70">
              Modul
            </p>
            <h2 className={`mt-2 text-3xl font-black uppercase tracking-[0.16em] text-white ${rubik.className}`}>
              Live Fotos
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Åbn foto-strømmen i fuld skærm og gennemse alle indsendte billeder.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white transition hover:bg-white/10"
            aria-label="Luk live fotos"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          <span>Foto-strøm</span>
          <span>{photoAnswers.length}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {!hasAnswersTable ? (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
              `answers` mangler, så foto-strømmen er ikke tilgængelig lige nu.
            </div>
          ) : null}

          {photoAnswers.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-6 text-sm text-slate-300">
              Ingen live-fotos endnu.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {photoAnswers.map((answer) =>
                answer.image_url ? (
                  <button
                    key={`photo-${answer.id}`}
                    type="button"
                    onClick={() => onSelectPhoto(answer)}
                    className="group rounded-[1.4rem] border border-white/10 bg-slate-900/75 p-2 text-left shadow-[0_16px_30px_rgba(2,6,23,0.3)] transition hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-slate-900/90"
                  >
                    <div className="aspect-square overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={answer.image_url}
                        alt={getPhotoAltText(answer)}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="px-1 pb-1 pt-3">
                      <p className="truncate text-sm font-semibold text-white">{answer.studentName}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        {getPhotoLabel(answer)}
                      </p>
                    </div>
                  </button>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}