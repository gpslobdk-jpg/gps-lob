"use client";

import { Player } from "@lottiefiles/react-lottie-player";
import { motion } from "framer-motion";
import { Award, Medal, Trophy } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";

import type { LiveStudentLocation } from "@/components/live/types";

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
  finishers: LiveStudentLocation[];
  winnerCelebrationName: string;
};

export default function TeacherLiveResults({
  finishers,
  winnerCelebrationName,
}: TeacherLiveResultsProps) {
  return (
    <motion.div
      key="finished"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-indigo-950 via-blue-900 to-cyan-800 px-6 py-10 text-white md:px-10 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.25),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(circle_at_50%_90%,rgba(244,114,182,0.2),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-75">
        <Player
          autoplay
          loop
          src={FIREWORKS_LOTTIE_URL}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 28 }).map((_, index) => (
          <motion.span
            key={`confetti-${index}`}
            className="absolute h-2.5 w-2.5 rounded-full bg-gradient-to-br from-yellow-300 via-pink-300 to-cyan-300 shadow-[0_0_10px_rgba(255,255,255,0.4)]"
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
        <div className="text-center">
          <h1
            className={`bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 bg-clip-text text-5xl font-black tracking-[0.16em] text-transparent uppercase drop-shadow-[0_0_30px_rgba(251,191,36,0.5)] md:text-7xl ${rubik.className}`}
          >
            Resultater
          </h1>
          <p className="mt-4 text-lg font-semibold text-emerald-100 md:text-2xl">
            KÆMPE TILLYKKE, {winnerCelebrationName}! I er GPS MESTRE!
          </p>
        </div>

        {finishers.length === 0 ? (
          <div className="mt-24 w-full max-w-2xl rounded-3xl border border-white/20 bg-white/10 p-8 text-center text-2xl font-bold text-slate-100 backdrop-blur-md">
            Ingen nåede i mål...
          </div>
        ) : (
          <div className="mt-28 flex h-[30rem] w-full flex-col items-end justify-end gap-4 md:flex-row md:gap-8">
            {finishers[1] ? (
              <div className="animate-in slide-in-from-bottom flex h-3/4 flex-col items-center duration-700 delay-300">
                <div className="rounded-t-2xl border-b-4 border-slate-200 bg-white/95 px-6 py-3 text-lg font-bold text-slate-700 shadow-xl">
                  {finishers[1].name || finishers[1].student_name}
                </div>
                <div className="flex w-32 flex-1 flex-col items-center rounded-t-lg border-x border-t border-slate-200/70 bg-gradient-to-t from-slate-500 to-slate-300 pt-6 shadow-2xl">
                  <Medal size={48} className="text-slate-100 drop-shadow-md" />
                  <span className="mt-2 text-4xl font-black text-slate-100/70">2</span>
                </div>
              </div>
            ) : null}

            {finishers[0] ? (
              <div className="animate-in slide-in-from-bottom flex h-full flex-col items-center duration-1000 delay-500">
                <div className="z-10 scale-110 rounded-t-3xl border-b-4 border-amber-200 bg-white px-8 py-4 text-2xl font-black text-amber-600 shadow-2xl">
                  {finishers[0].name || finishers[0].student_name}
                </div>
                <div className="flex w-40 flex-1 flex-col items-center rounded-t-xl border-x border-t border-yellow-200/50 bg-gradient-to-t from-amber-500 to-yellow-300 pt-8 shadow-[0_0_50px_rgba(251,191,36,0.55)]">
                  <Trophy className="w-48 h-48 object-contain mx-auto text-amber-800 drop-shadow-lg" />
                  <span className="mt-2 text-6xl font-black text-amber-700/70">1</span>
                </div>
              </div>
            ) : null}

            {finishers[2] ? (
              <div className="animate-in slide-in-from-bottom flex h-2/4 flex-col items-center duration-500 delay-100">
                <div className="rounded-t-2xl border-b-4 border-amber-900/20 bg-white/95 px-6 py-3 text-lg font-bold text-amber-800 shadow-xl">
                  {finishers[2].name || finishers[2].student_name}
                </div>
                <div className="flex w-32 flex-1 flex-col items-center rounded-t-lg border-x border-t border-orange-300/50 bg-gradient-to-t from-amber-800 to-orange-500 pt-6 shadow-2xl">
                  <Award size={48} className="text-amber-100 drop-shadow-md" />
                  <span className="mt-2 text-4xl font-black text-amber-100/70">3</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {finishers.length > 3 ? (
          <div className="mt-10 w-full max-w-3xl rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-md">
            <h3
              className={`mb-4 text-center text-xl font-bold tracking-widest text-amber-100 uppercase ${rubik.className}`}
            >
              Flot kæmpet!
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {finishers.slice(3).map((finisher, index) => (
                <div
                  key={`${finisher.id}-${index}`}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-medium text-blue-100 backdrop-blur-md"
                >
                  {index + 4}. {finisher.name || finisher.student_name}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
