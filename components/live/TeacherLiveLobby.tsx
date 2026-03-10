"use client";

import { AnimatePresence, motion } from "framer-motion";
import { UserCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { QRCode } from "react-qrcode-logo";

import phoneAnimation from "@/public/phone.json";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type TeacherLiveLobbyProps = {
  joinPin: string;
  students: string[];
  isLoading: boolean;
  onStartSession: () => Promise<void>;
};

export default function TeacherLiveLobby({
  joinPin,
  students,
  isLoading,
  onStartSession,
}: TeacherLiveLobbyProps) {
  return (
    <motion.main
      key="waiting"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
      className={`relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-t from-emerald-100 via-sky-50 to-sky-300 p-6 text-white md:p-12 lg:bg-none lg:bg-transparent ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed left-0 top-0 hidden h-full w-full object-cover -z-20 lg:block"
        src="/arkiv-bg.mp4"
      />
      <div className="fixed inset-0 hidden bg-gradient-to-b from-sky-900/20 to-emerald-900/60 backdrop-blur-[3px] -z-10 lg:block" />

      <div className="relative z-10 w-full max-w-4xl rounded-[3rem] border border-white/50 bg-white/85 p-8 text-center shadow-2xl backdrop-blur-md md:p-14">
        <section className="w-full">
          <h1 className={`mx-auto max-w-3xl text-xl font-bold text-emerald-800 md:text-2xl ${rubik.className}`}>
            Log ind i lobbyen på gpslob.dk eller scan qr koden herunder
          </h1>
          <p className={`mb-8 mt-5 text-7xl font-black tracking-widest text-emerald-950 drop-shadow-sm md:text-9xl ${rubik.className}`}>
            {joinPin}
          </p>
        </section>

        <section className="mt-8 flex w-full flex-col items-center justify-center gap-10 md:flex-row">
          <div className="h-48 w-48 md:h-64 md:w-64">
            <Lottie animationData={phoneAnimation} loop={true} />
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-[0_0_25px_rgba(255,255,255,0.25)]">
            <QRCode
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/join?pin=${joinPin}`}
              size={200}
              bgColor="#ffffff"
              fgColor="#050816"
              qrStyle="dots"
              eyeRadius={10}
            />
          </div>
        </section>

        <section className="mt-8 w-full">
          <h2 className={`text-xl font-black tracking-wide text-emerald-800 uppercase md:text-2xl ${rubik.className}`}>
            DELTAGERE KLAR: {students.length}
          </h2>

          <div className="mt-4 flex flex-wrap gap-3">
            <AnimatePresence>
              {students.map((name, index) => (
                <motion.div
                  key={`${name}-${index}`}
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -8 }}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/60 px-5 py-2 font-medium text-emerald-900 shadow-sm"
                >
                  <UserCircle className="h-4 w-4 text-emerald-700" />
                  {name}
                </motion.div>
              ))}
            </AnimatePresence>

            {!isLoading && students.length === 0 ? (
              <p className="text-sm text-emerald-700">Ingen deltagere har joinet endnu.</p>
            ) : null}
          </div>
        </section>

        <button
          type="button"
          onClick={() => void onStartSession()}
          className={`mx-auto mt-8 w-full rounded-full border border-emerald-500/30 bg-emerald-600 px-12 py-5 text-xl font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-emerald-700 md:w-auto md:text-3xl ${rubik.className}`}
        >
          START LØBET! 🏁
        </button>
      </div>
    </motion.main>
  );
}
