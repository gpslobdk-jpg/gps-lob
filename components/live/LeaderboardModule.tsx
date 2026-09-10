"use client";

import { poppins, rubik } from "@/lib/fonts";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildLeaderboardEntries, getStudentInitials } from "@/components/live/liveDashboardUtils";
import type { LiveAnswer, LiveStudentLocation } from "@/components/live/types";

type LeaderboardModuleProps = {
  activeStudents: LiveStudentLocation[];
  allParticipants?: LiveStudentLocation[];
  liveAnswers: LiveAnswer[];
  hasParticipantsTable: boolean;
  onRemoveParticipant: (
    student: LiveStudentLocation
  ) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
};

export default function LeaderboardModule({
  activeStudents,
  allParticipants,
  liveAnswers,
  hasParticipantsTable,
  onRemoveParticipant,
  onClose,
}: LeaderboardModuleProps) {
  const [openActionMenuForId, setOpenActionMenuForId] = useState<string | null>(null);
  const [participantPendingRemoval, setParticipantPendingRemoval] =
    useState<LiveStudentLocation | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const cancelRemovalButtonRef = useRef<HTMLButtonElement | null>(null);
  const leaderboard = useMemo(
    () => buildLeaderboardEntries(activeStudents, allParticipants, liveAnswers),
    [activeStudents, allParticipants, liveAnswers]
  );

  useEffect(() => {
    if (!participantPendingRemoval) return;
    cancelRemovalButtonRef.current?.focus();
  }, [participantPendingRemoval]);

  const openRemovalConfirmation = (student: LiveStudentLocation) => {
    setOpenActionMenuForId(null);
    setRemoveError(null);
    setParticipantPendingRemoval(student);
  };

  const closeRemovalConfirmation = () => {
    if (isRemoving) return;
    setRemoveError(null);
    setParticipantPendingRemoval(null);
  };

  const confirmParticipantRemoval = async () => {
    if (!participantPendingRemoval || isRemoving) return;

    setIsRemoving(true);
    setRemoveError(null);
    const result = await onRemoveParticipant(participantPendingRemoval);
    setIsRemoving(false);

    if (result.ok) {
      setParticipantPendingRemoval(null);
      return;
    }

    setRemoveError(result.error || "Holdet kunne ikke fjernes. Prøv igen.");
  };

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

                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`Handlinger for ${entry.student.name}`}
                      aria-expanded={openActionMenuForId === entry.student.id}
                      aria-controls={`participant-actions-${entry.student.id}`}
                      disabled={!hasParticipantsTable || isRemoving}
                      onClick={() =>
                        setOpenActionMenuForId((current) =>
                          current === entry.student.id ? null : entry.student.id
                        )
                      }
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-100 transition hover:border-slate-400 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                    </button>
                    {openActionMenuForId === entry.student.id ? (
                      <div
                        id={`participant-actions-${entry.student.id}`}
                        role="menu"
                        aria-label={`Handlinger for ${entry.student.name}`}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setOpenActionMenuForId(null);
                        }}
                        className="absolute right-0 top-12 z-20 min-w-36 rounded-xl border border-slate-600 bg-slate-900 p-1 shadow-xl"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => openRemovalConfirmation(entry.student)}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                        >
                          Fjern hold
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {participantPendingRemoval ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-5"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeRemovalConfirmation();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-participant-title"
            aria-describedby="remove-participant-description"
            className="w-full max-w-md rounded-3xl border border-slate-600 bg-slate-900 p-6 shadow-2xl"
          >
            <h3 id="remove-participant-title" className="text-xl font-black text-white">
              Fjern hold
            </h3>
            <p id="remove-participant-description" className="mt-3 text-sm leading-6 text-slate-200">
              Fjern &ldquo;{participantPendingRemoval.name}&rdquo; fra løbet? Holdet kan ikke
              fortsætte. De andre hold fortsætter som før.
            </p>
            {removeError ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-rose-200">
                {removeError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                ref={cancelRemovalButtonRef}
                type="button"
                onClick={closeRemovalConfirmation}
                disabled={isRemoving}
                className="rounded-xl border border-slate-500 px-4 py-2.5 text-sm font-bold text-slate-100 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={() => void confirmParticipantRemoval()}
                disabled={isRemoving}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRemoving ? "Fjerner…" : "Fjern hold"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
