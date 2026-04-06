"use client";

import { Poppins, Rubik } from "next/font/google";
import { type FormEvent, useMemo, useState } from "react";

import type {
  LiveAnswer,
  LiveStudentLocation,
  SessionMessage,
} from "@/components/live/types";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type TeacherLiveSidebarProps = {
  activeStudents: LiveStudentLocation[];
  allParticipants?: LiveStudentLocation[];
  joinPin: string;
  hasParticipantsTable: boolean;
  gpsOverride: boolean;
  isUpdatingGpsOverride: boolean;
  liveAnswers: LiveAnswer[];
  hasAnswersTable: boolean;
  messages: SessionMessage[];
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => Promise<void>;
  onToggleGpsOverride: () => Promise<void>;
  onKickParticipant: (student: LiveStudentLocation) => Promise<void>;
};

type SidebarTab = "leaderboard" | "feed" | "photos";

type LeaderboardEntry = {
  student: LiveStudentLocation;
  score: number;
  correctAnswers: number;
  progressPercent: number;
};

type FeedItem =
  | {
      id: string;
      type: "answer";
      createdAt: string | null;
      answer: LiveAnswer;
    }
  | {
      id: string;
      type: "message";
      createdAt: string | null;
      message: SessionMessage;
    };

function formatFeedTime(value: string | null | undefined) {
  if (!value) return "Nu";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nu";

  return date.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStudentInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getPhotoLabel(answer: LiveAnswer) {
  return answer.postNumber !== null ? `Post ${answer.postNumber}` : "Foto-mission";
}

function getPhotoAltText(answer: LiveAnswer) {
  return `${answer.studentName} - ${getPhotoLabel(answer)}`;
}

export default function TeacherLiveSidebar({
  activeStudents,
  allParticipants,
  joinPin,
  hasParticipantsTable,
  gpsOverride,
  isUpdatingGpsOverride,
  liveAnswers,
  hasAnswersTable,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onToggleGpsOverride,
  onKickParticipant,
}: TeacherLiveSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("leaderboard");
  const [selectedPhoto, setSelectedPhoto] = useState<LiveAnswer | null>(null);

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const participants = allParticipants ?? activeStudents;
    const scores = new Map<string, number>();
    const correctAnswers = new Map<string, number>();

    for (const answer of liveAnswers) {
      if (answer.isCorrect !== true) continue;
      const scoreKey = answer.participantId ?? answer.studentName;
      scores.set(scoreKey, (scores.get(scoreKey) ?? 0) + answer.awardedPoints);
      correctAnswers.set(scoreKey, (correctAnswers.get(scoreKey) ?? 0) + 1);
    }

    const highestScore = Math.max(1, ...participants.map((student) => scores.get(student.id) ?? 0));

    return [...participants]
      .map((student) => {
        const score = scores.get(student.id) ?? scores.get(student.name) ?? 0;

        return {
          student,
          score,
          correctAnswers:
            correctAnswers.get(student.id) ?? correctAnswers.get(student.name) ?? 0,
          progressPercent: Math.max(8, Math.round((score / highestScore) * 100)),
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
        return a.student.name.localeCompare(b.student.name, "da");
      });
  }, [activeStudents, allParticipants, liveAnswers]);

  const liveFeed = useMemo<FeedItem[]>(() => {
    const answerItems: FeedItem[] = hasAnswersTable
      ? liveAnswers.map((answer) => ({
          id: `answer-${answer.id}`,
          type: "answer",
          createdAt: answer.createdAt,
          answer,
        }))
      : [];

    const messageItems: FeedItem[] = messages.map((message, index) => ({
      id: `message-${message.sender_name}-${message.created_at ?? index}`,
      type: "message",
      createdAt: message.created_at ?? null,
      message,
    }));

    return [...answerItems, ...messageItems].sort((a, b) => {
      const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTs - aTs;
    });
  }, [hasAnswersTable, liveAnswers, messages]);

  const photoAnswers = useMemo(
    () => liveAnswers.filter((answer) => Boolean(answer.image_url)),
    [liveAnswers]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSendMessage();
  };

  return (
    <aside
      className={`ml-4 flex h-full w-1/3 flex-col overflow-hidden rounded-[2rem] border border-slate-500/30 bg-slate-900/80 shadow-[0_30px_80px_rgba(15,23,42,0.58)] backdrop-blur-xl ${poppins.className}`}
    >
      <div className="border-b border-slate-500/30 px-6 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300/70">
              Control Center
            </p>
            <h3
              className={`mt-2 text-2xl font-black tracking-[0.18em] text-white uppercase ${rubik.className}`}
            >
              Live Pulse
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Overblik over elever, fremdrift, billeder og beskeder i realtid.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-right shadow-[0_0_30px_rgba(16,185,129,0.16)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
              Online nu
            </p>
            <p className="mt-1 text-2xl font-black text-white">{activeStudents.length}</p>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-amber-300/25 bg-amber-300/10 px-4 py-4 shadow-[0_16px_40px_rgba(251,191,36,0.12)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/75">
            Live PIN
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="font-mono text-3xl font-black tracking-[0.38em] text-amber-50">
              {joinPin}
            </p>
            <span className="rounded-full border border-amber-200/20 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-50/80">
              Sig den højt
            </span>
          </div>
        </div>

        {!hasParticipantsTable ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-100">
            `participants` mangler, så kick-funktionen er i fallback-mode.
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-3 rounded-2xl border border-slate-500/30 bg-slate-950/55 p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("leaderboard")}
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
              activeTab === "leaderboard"
                ? "bg-emerald-500 text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.35)]"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            Leaderboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("feed")}
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
              activeTab === "feed"
                ? "bg-emerald-500 text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.35)]"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            Live Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("photos")}
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
              activeTab === "photos"
                ? "bg-emerald-500 text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.35)]"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            Foto-strøm
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "leaderboard" ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-500/20 px-6 py-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                <span>Rangliste</span>
                <span>Point</span>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {leaderboard.length === 0 ? (
                <div className="rounded-[1.5rem] border border-slate-500/20 bg-slate-950/40 px-5 py-6 text-sm text-slate-300">
                  Ingen aktive deltagere lige nu.
                </div>
              ) : (
                leaderboard.map((entry, index) => (
                  <div
                    key={`leaderboard-${entry.student.id}`}
                    className="rounded-[1.6rem] border border-slate-500/20 bg-slate-950/45 p-4 shadow-[0_16px_40px_rgba(2,6,23,0.45)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-500/30 bg-slate-800 text-sm font-black uppercase text-white shadow-inner shadow-black/40">
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
                              {entry.correctAnswers} rigtige svar
                            </p>
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
                        <span className="rounded-full border border-slate-500/30 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
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
        ) : activeTab === "feed" ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-500/20 px-6 py-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                <span>Realtime events</span>
                <span>{liveFeed.length}</span>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {!hasAnswersTable ? (
                <div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                  `answers` mangler, så feedet viser kun beskeder lige nu.
                </div>
              ) : null}

              {liveFeed.length === 0 ? (
                <div className="rounded-[1.5rem] border border-slate-500/20 bg-slate-950/40 px-5 py-6 text-sm text-slate-300">
                  Ingen aktivitet endnu.
                </div>
              ) : (
                liveFeed.map((item) =>
                  item.type === "answer" ? (
                    <div
                      key={item.id}
                      className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-4 shadow-[0_12px_30px_rgba(16,185,129,0.12)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
                            {item.answer.image_url ? "Foto godkendt" : "Korrekt svar"}
                          </p>
                          <p className="mt-2 truncate text-sm font-semibold text-white">
                            {item.answer.studentName}
                          </p>
                        </div>
                        <span className="text-xs text-emerald-100/80">
                          {formatFeedTime(item.answer.createdAt)}
                        </span>
                      </div>
                      <div className="mt-3 rounded-2xl border border-emerald-500/15 bg-slate-950/35 px-4 py-3 text-sm text-slate-200">
                        {item.answer.postNumber !== null
                          ? `Løste post ${item.answer.postNumber}`
                          : "Løste en post"}
                      </div>
                      {item.answer.image_url ? (
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(item.answer)}
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
                      className={`rounded-[1.5rem] border p-4 shadow-[0_12px_30px_rgba(2,6,23,0.22)] ${
                        item.message.is_teacher
                          ? "border-emerald-500/20 bg-emerald-500/10"
                          : "border-slate-500/20 bg-slate-950/45"
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
              <div className="mt-3 break-words whitespace-pre-wrap rounded-2xl border border-slate-500/15 bg-slate-950/35 px-4 py-3 text-sm leading-relaxed text-slate-200">
                        {item.message.message}
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-500/20 px-6 py-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                <span>Foto-strøm</span>
                <span>{photoAnswers.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden px-4 py-4">
              <div className="space-y-3">
                {!hasAnswersTable ? (
                  <div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                    `answers` mangler, så foto-strømmen er ikke tilgængelig lige nu.
                  </div>
                ) : null}

                {photoAnswers.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-slate-500/20 bg-slate-950/40 px-5 py-6 text-sm text-slate-300">
                    Ingen live-fotos endnu.
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {photoAnswers.map((answer) =>
                        answer.image_url ? (
                          <button
                            key={`photo-${answer.id}`}
                            type="button"
                            onClick={() => setSelectedPhoto(answer)}
                            className="group rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-2 text-left shadow-[0_16px_30px_rgba(2,6,23,0.3)] transition hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-slate-950/60"
                          >
                            <div className="aspect-square overflow-hidden rounded-[1rem] border border-white/10 bg-slate-950">
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
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-500/30 bg-slate-950/55 px-5 py-5"
      >
        <div className="mb-5 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-4 shadow-[0_12px_30px_rgba(34,211,238,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                God Mode
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                Slå GPS-krav fra for hele sessionen.
              </p>
              <p className="mt-1 text-xs text-cyan-100/75">
                Bruges til indendørs spil eller test uden fysisk GPS-lås.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onToggleGpsOverride()}
              disabled={isUpdatingGpsOverride}
              aria-pressed={gpsOverride}
              className={`inline-flex min-w-38 items-center justify-center rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                gpsOverride
                  ? "border-cyan-200/40 bg-cyan-300 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.28)]"
                  : "border-white/15 bg-white/8 text-white hover:bg-white/12"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isUpdatingGpsOverride ? "Gemmer..." : gpsOverride ? "Aktiv" : "Slå til"}
            </button>
          </div>
        </div>

        <label
          htmlFor="god-mode-broadcast"
          className="mb-3 block text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200/75"
        >
          Broadcast
        </label>
        <div className="flex gap-3">
          <input
            id="god-mode-broadcast"
            type="text"
            value={newMessage}
            onChange={(event) => onNewMessageChange(event.target.value)}
            placeholder="Send en besked til alle elever..."
            className="flex-1 rounded-2xl border border-emerald-500/25 bg-slate-900/90 px-4 py-3 text-sm text-white shadow-[0_0_24px_rgba(16,185,129,0.12)] placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-[0_16px_30px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
          >
            Send
          </button>
        </div>
      </form>

      {selectedPhoto?.image_url ? (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/88 p-4 backdrop-blur-md"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/95 shadow-[0_40px_120px_rgba(2,6,23,0.7)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
                  Live foto
                </p>
                <h4 className={`mt-2 text-2xl font-black uppercase tracking-[0.14em] text-white ${rubik.className}`}>
                  {selectedPhoto.studentName}
                </h4>
                <p className="mt-2 text-sm text-slate-300">
                  {getPhotoLabel(selectedPhoto)}
                  {selectedPhoto.createdAt ? ` | ${formatFeedTime(selectedPhoto.createdAt)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-white/10"
              >
                Luk
              </button>
            </div>

            <div className="max-h-[85vh] overflow-y-auto p-4 md:p-6">
              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPhoto.image_url}
                  alt={getPhotoAltText(selectedPhoto)}
                  className="h-auto max-h-[72vh] w-full object-contain bg-slate-950"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
