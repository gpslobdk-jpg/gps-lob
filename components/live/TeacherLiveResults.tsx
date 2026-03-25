"use client";

import { Player } from "@lottiefiles/react-lottie-player";
import { motion } from "framer-motion";
import { Award, Medal, Trophy } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import type { ReactNode } from "react";

import type { TeacherLiveStanding } from "@/components/live/types";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const FIREWORKS_LOTTIE_URL = "https://assets2.lottiefiles.com/packages/lf20_touohxv0.json";

type TeacherLiveResultsProps = {
  standings: TeacherLiveStanding[];
  totalPosts: number;
  winnerCelebrationName: string;
};

function formatStandingTime(value: string | null | undefined) {
  if (!value) return "Ingen registrering endnu";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ingen registrering endnu";

  return date.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatElapsedTime(value: number | null | undefined) {
  if (value === null || value === undefined) return "Ingen tid endnu";

  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}t ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getStatusLabel(entry: TeacherLiveStanding) {
  return entry.student.finished_at ? "I mål" : "Afsluttet ved stop";
}

function getTimeLabel(entry: TeacherLiveStanding) {
  if (entry.elapsedTimeMs === null) return "Ingen tid endnu";
  return entry.student.finished_at ? formatElapsedTime(entry.elapsedTimeMs) : `${formatElapsedTime(entry.elapsedTimeMs)}*`;
}

function getTeamName(entry: TeacherLiveStanding) {
  return entry.student.name || entry.student.student_name;
}

function PodiumCard({
  entry,
  placement,
  title,
  icon,
  accentClassName,
  panelClassName,
  totalPosts,
}: {
  entry: TeacherLiveStanding;
  placement: number;
  title: string;
  icon: ReactNode;
  accentClassName: string;
  panelClassName: string;
  totalPosts: number;
}) {
  return (
    <div className={`flex h-full flex-col rounded-4xl border border-white/15 p-4 shadow-2xl backdrop-blur-xl ${panelClassName}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/85">{title}</p>
          <h3 className="mt-2 wrap-break-word text-2xl leading-tight font-black whitespace-normal text-white">
            {getTeamName(entry)}
          </h3>
          <p className="mt-2 text-sm text-white/75">{getStatusLabel(entry)}</p>
        </div>
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-white shadow-lg ${accentClassName}`}>
          {icon}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/85">Point</p>
          <p className="mt-1 text-2xl font-black text-white">{entry.score}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/85">Rigtige svar</p>
          <p className="mt-1 text-2xl font-black text-white">{entry.correctAnswers}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/85">Tid brugt</p>
          <p className="mt-1 text-lg font-black text-white">{getTimeLabel(entry)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/70">
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 uppercase tracking-[0.16em]">
          Plads {placement}
        </span>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 uppercase tracking-[0.16em]">
          Poster: {totalPosts > 0 ? `${entry.completedPosts}/${totalPosts}` : entry.completedPosts}
        </span>
      </div>
    </div>
  );
}

export default function TeacherLiveResults({
  standings,
  totalPosts,
  winnerCelebrationName,
}: TeacherLiveResultsProps) {
  const podium = standings.slice(0, 3);

  return (
    <motion.div
      key="finished"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
      className={`relative min-h-screen overflow-hidden bg-linear-to-b from-indigo-950 via-blue-900 to-cyan-800 px-6 py-10 text-white md:px-10 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.25),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(circle_at_50%_90%,rgba(244,114,182,0.2),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-75">
        <Player autoplay loop src={FIREWORKS_LOTTIE_URL} style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 28 }).map((_, index) => (
          <motion.span
            key={`confetti-${index}`}
            className="absolute h-2.5 w-2.5 rounded-full bg-linear-to-br from-yellow-300 via-pink-300 to-cyan-300 shadow-[0_0_10px_rgba(255,255,255,0.4)]"
            style={{ left: `${(index * 17) % 100}%` }}
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: ["0vh", "105vh"], opacity: [0, 1, 0.2] }}
            transition={{
              duration: 4.5 + (index % 6) * 0.6,
              repeat: Infinity,
              ease: "linear",
              delay: (index % 10) * 0.18,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center">
        <div className="max-w-4xl text-center">
          <h1
            className={`bg-linear-to-r from-yellow-200 via-amber-300 to-yellow-100 bg-clip-text text-5xl font-black tracking-[0.16em] text-transparent uppercase drop-shadow-[0_0_30px_rgba(251,191,36,0.5)] md:text-7xl ${rubik.className}`}
          >
            Resultater
          </h1>
          <p className="mt-4 text-lg font-semibold text-emerald-100 md:text-2xl">
            {standings.length > 0
              ? `Stærkt gået, ${winnerCelebrationName}! I fører feltet ved afslutningen.`
              : "Løbet er afsluttet."}
          </p>
          <div className="mt-6 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/15 bg-slate-950/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100/85 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-md">
            <span>Sortering:</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1">Point</span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1">Rigtige svar</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Hurtigste tid</span>
          </div>
        </div>

        {standings.length === 0 ? (
          <div className="mt-24 w-full max-w-2xl rounded-3xl border border-white/20 bg-white/10 p-8 text-center text-2xl font-bold text-slate-100 backdrop-blur-md">
            Ingen deltagere er registreret endnu.
          </div>
        ) : (
          <div className="mt-16 grid w-full gap-5 md:grid-cols-3 md:items-end">
            {podium[0] ? (
              <div className="order-1 md:order-2 md:-translate-y-4">
                <PodiumCard
                  entry={podium[0]}
                  placement={1}
                  title="Vinder"
                  icon={<Trophy className="h-7 w-7" />}
                  accentClassName="border-amber-200/50 bg-amber-400/25"
                  panelClassName="bg-gradient-to-br from-amber-400/30 via-amber-300/18 to-yellow-200/10"
                  totalPosts={totalPosts}
                />
              </div>
            ) : null}

            {podium[1] ? (
              <div className="order-2 md:order-1">
                <PodiumCard
                  entry={podium[1]}
                  placement={2}
                  title="Andenplads"
                  icon={<Medal className="h-7 w-7" />}
                  accentClassName="border-slate-200/40 bg-slate-100/20"
                  panelClassName="bg-gradient-to-br from-slate-300/20 via-slate-100/10 to-white/5"
                  totalPosts={totalPosts}
                />
              </div>
            ) : null}

            {podium[2] ? (
              <div className="order-3 md:order-3">
                <PodiumCard
                  entry={podium[2]}
                  placement={3}
                  title="Tredjeplads"
                  icon={<Award className="h-7 w-7" />}
                  accentClassName="border-orange-200/35 bg-orange-400/20"
                  panelClassName="bg-gradient-to-br from-orange-400/25 via-amber-500/12 to-rose-200/10"
                  totalPosts={totalPosts}
                />
              </div>
            ) : null}
          </div>
        )}

        {standings.length > 0 ? (
          <div className="mt-10 w-full max-w-6xl rounded-4xl border border-white/20 bg-white/10 p-4 shadow-xl backdrop-blur-md md:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className={`text-center text-xl font-bold tracking-widest text-amber-100 uppercase md:text-left ${rubik.className}`}>
                  Hele Stillingen
                </h3>
                <p className="mt-2 text-sm text-blue-100/80 md:text-base">
                  Vinderen findes p\u00e5 flest point, derefter flest rigtige svar, derefter hurtigste tid.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/90 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-3">Point</div>
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-3">Rigtige svar</div>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">Tid brugt</div>
              </div>
            </div>

            <div className="space-y-3">
              {standings.map((entry, index) => (
                <div
                  key={`${entry.student.id}-${index}`}
                  className="rounded-[1.75rem] border border-white/20 bg-slate-950/20 px-4 py-4 text-blue-100 shadow-[0_20px_45px_rgba(15,23,42,0.22)] backdrop-blur-md"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,9rem))] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100">
                          Plads {index + 1}
                        </span>
                        <span className="min-w-0 basis-full truncate text-lg font-bold text-white sm:basis-auto sm:max-w-88">
                          {getTeamName(entry)}
                        </span>
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
                          {getStatusLabel(entry)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-blue-100/80">
                        {entry.firstAnswerAt
                          ? `Start kl. ${formatStandingTime(entry.firstAnswerAt)}${entry.lastActivityAt ? ` · Seneste registrering kl. ${formatStandingTime(entry.lastActivityAt)}` : ""}`
                          : "Ingen registrerede svar endnu"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-blue-50/75">
                        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                          Poster forsøgt: {totalPosts > 0 ? `${entry.completedPosts}/${totalPosts}` : entry.completedPosts}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                          Progress: {entry.progressPercent}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 lg:contents">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center lg:min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-50">
                          Point
                        </p>
                        <p className="mt-1 text-2xl font-black text-white">{entry.score}</p>
                      </div>
                      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-50">
                          Rigtige svar
                        </p>
                        <p className="mt-1 text-2xl font-black text-white">{entry.correctAnswers}</p>
                      </div>
                      <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/85">
                          Tid brugt
                        </p>
                        <p className="mt-1 text-lg font-black text-white">{getTimeLabel(entry)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-blue-50/65">* Hold uden m\u00e5lregistrering viser tid frem til seneste aktivitet.</p>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
