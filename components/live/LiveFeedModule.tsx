"use client";

import { poppins, rubik } from "@/lib/fonts";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

import {
  buildLiveFeed,
  formatFeedTime,
  getPhotoAltText,
  getPhotoLabel,
} from "@/components/live/liveDashboardUtils";
import type { LiveAnswer, SessionMessage } from "@/components/live/types";

type LiveFeedModuleProps = {
  liveAnswers: LiveAnswer[];
  hasAnswersTable: boolean;
  messages: SessionMessage[];
  onSelectPhoto: (answer: LiveAnswer) => void;
  onClose: () => void;
};

export default function LiveFeedModule({
  liveAnswers,
  hasAnswersTable,
  messages,
  onSelectPhoto,
  onClose,
}: LiveFeedModuleProps) {
  const liveFeed = useMemo(
    () => buildLiveFeed(hasAnswersTable, liveAnswers, messages),
    [hasAnswersTable, liveAnswers, messages]
  );

  return (
    <section className={`flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-slate-950 text-white ${poppins.className}`}>
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-emerald-50 transition hover:bg-emerald-400/18"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbage til Kort
            </button>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/70">
              Modul
            </p>
            <h2 className={`mt-2 text-3xl font-black uppercase tracking-[0.16em] text-white ${rubik.className}`}>
              Live Feed
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Seneste svar, fotobeviser og beskeder i én samlet stream.
            </p>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          <span>Realtime events</span>
          <span>{liveFeed.length}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {!hasAnswersTable ? (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
              `answers` mangler, så feedet viser kun beskeder lige nu.
            </div>
          ) : null}

          {liveFeed.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-6 text-sm text-slate-300">
              Ingen aktivitet endnu.
            </div>
          ) : (
            liveFeed.map((item) =>
              item.type === "answer" ? (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-4 ${
                    item.answer.isCorrect === false
                      ? "border-red-500/25 bg-red-500/10 shadow-[0_12px_30px_rgba(239,68,68,0.10)]"
                      : "border-emerald-500/20 bg-emerald-500/10 shadow-[0_12px_30px_rgba(16,185,129,0.12)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${
                        item.answer.isCorrect === false
                          ? "text-red-300/80"
                          : "text-emerald-200/75"
                      }`}>
                        {item.answer.isCorrect === false
                          ? "Forkert svar"
                          : item.answer.image_url
                            ? "Foto uploadet"
                            : "Korrekt svar"}
                      </p>
                      <p className="mt-2 truncate text-sm font-semibold text-white">
                        {item.answer.studentName}
                      </p>
                    </div>
                    <span className={`text-xs ${
                      item.answer.isCorrect === false ? "text-red-200/70" : "text-emerald-100/80"
                    }`}>
                      {formatFeedTime(item.answer.createdAt)}
                    </span>
                  </div>
                  <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
                    item.answer.isCorrect === false
                      ? "border-red-500/15 bg-slate-950/35 text-red-100/90"
                      : "border-emerald-500/15 bg-slate-950/35 text-slate-200"
                  }`}>
                    {item.answer.isCorrect === false
                      ? item.answer.postNumber !== null
                        ? `Svarede forkert ved Post ${item.answer.postNumber} — 0 point`
                        : "Svarede forkert — 0 point"
                      : item.answer.postNumber !== null
                        ? `Løste post ${item.answer.postNumber}`
                        : "Løste en post"}
                  </div>
                  {item.answer.image_url ? (
                    <button
                      type="button"
                      onClick={() => onSelectPhoto(item.answer)}
                      className="group mt-3 flex w-full items-center gap-3 rounded-[1.35rem] border border-white/10 bg-slate-950/35 p-3 text-left transition hover:border-emerald-300/30 hover:bg-slate-950/55"
                    >
                      <div className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_12px_24px_rgba(15,23,42,0.35)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.answer.image_url}
                          alt={getPhotoAltText(item.answer)}
                          loading="lazy"
                          className="h-20 w-20 object-cover transition duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/75">
                          Foto-preview
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-white">
                          {getPhotoLabel(item.answer)}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">Klik for at se billedet stort.</p>
                      </div>
                    </button>
                  ) : null}
                </div>
              ) : (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-4 shadow-[0_12px_30px_rgba(2,6,23,0.22)] ${
                    item.message.is_teacher
                      ? "border-emerald-500/20 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-900/75"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {item.message.is_teacher ? "Broadcast" : "Elevbesked"}
                      </p>
                      <p className="mt-2 truncate text-sm font-semibold text-white">
                        {item.message.sender_name}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatFeedTime(item.message.created_at)}
                    </span>
                  </div>
                  <div className="mt-3 wrap-break-word whitespace-pre-wrap rounded-2xl border border-slate-500/15 bg-slate-950/35 px-4 py-3 text-sm leading-relaxed text-slate-200">
                    {item.message.message}
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>
    </section>
  );
}