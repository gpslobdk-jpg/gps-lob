"use client";

import { poppins, rubik } from "@/lib/fonts";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

import { buildLeaderboardEntries, getStudentInitials } from "@/components/live/liveDashboardUtils";
import type { LiveAnswer, LiveStudentLocation } from "@/components/live/types";

type LeaderboardModuleProps = {
  activeStudents: LiveStudentLocation[];
  allParticipants?: LiveStudentLocation[];
  liveAnswers: LiveAnswer[];
  hasParticipantsTable: boolean;
  onKickParticipant: (student: LiveStudentLocation) => Promise<void>;
  onClose: () => void;
};

export default function LeaderboardModule({
  activeStudents,
  allParticipants,
  liveAnswers,
  hasParticipantsTable,
  onKickParticipant,
  onClose,
}: LeaderboardModuleProps) {
  const leaderboard = useMemo(
    () => buildLeaderboardEntries(activeStudents, allParticipants, liveAnswers),
    [activeStudents, allParticipants, liveAnswers]
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
              Leaderboard
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Rangliste, score og hurtige lærerhandlinger i fuld skærm.
            </p>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          <span>Rangliste</span>
          <span>Point</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {leaderboard.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-6 text-sm text-slate-300">
              Ingen aktive deltagere lige nu.
            </div>
          ) : (
            leaderboard.map((entry, index) => (
              <div
                key={`leaderboard-${entry.student.id}`}
                className="rounded-[1.6rem] border border-slate-800 bg-slate-900/75 p-4 shadow-[0_16px_40px_rgba(2,6,23,0.45)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-sm font-black uppercase text-white shadow-inner shadow-black/40">
                    {getStudentInitials(entry.student.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {entry.student.name}
                        </p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                          #{index + 1} i feltet
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/70">
                          Score
                        </p>
                        <p className="text-lg font-black text-white">{entry.score}</p>
                        <p className="mt-1 text-[11px] text-emerald-100/70">
                          {entry.correctAnswers} rigtige
                          {entry.wrongAnswers > 0 ? (
                            <span className="text-red-300/70"> · {entry.wrongAnswers} forkerte</span>
                          ) : null}
                        </p>
                        {entry.elapsedTimeMs !== null ? (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {Math.floor(entry.elapsedTimeMs / 60_000)}m {Math.floor((entry.elapsedTimeMs % 60_000) / 1_000)}s
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-400">
                        <span>Progress</span>
                        <span>{entry.progressPercent}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-emerald-400 via-emerald-500 to-cyan-400 shadow-[0_0_18px_rgba(16,185,129,0.45)]"
                          style={{ width: `${entry.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  {entry.student.finished_at ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                      <span className="h-2 w-2 rounded-full bg-white/90" />
                      Færdig
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      Aktiv deltager
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => void onKickParticipant(entry.student)}
                    disabled={!hasParticipantsTable}
                    className="rounded-full border border-emerald-500/30 bg-emerald-500/12 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-100 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Fjern
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}