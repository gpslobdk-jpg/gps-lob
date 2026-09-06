"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, type LucideIcon, Share2, UserCircle, WifiOff } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { poppins, rubik } from "@/lib/fonts";
import { useEffect, useState } from "react";
import { QRCode } from "react-qrcode-logo";

import PostOrderSummary from "@/components/routes/PostOrderSummary";
import type { ActivePostOrderMode } from "@/lib/routes/postOrderPolicy";
import phoneAnimation from "@/public/phone.json";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const IOS_PREP_STEPS = [
  "Åbn i Safari",
  "Tryk Del",
  'Vælg "Føj til hjemmeskærm"',
  "Åbn fra ikonet",
];

const ANDROID_PREP_STEPS = [
  "Åbn i Chrome",
  "Tryk menu",
  'Vælg "Føj til startskærm" eller "Installér app"',
  "Åbn fra ikonet",
];

type MobilePrepCardProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  steps?: string[];
};

function MobilePrepCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  steps = [],
}: MobilePrepCardProps) {
  return (
    <article className="flex h-full flex-col rounded-[1.6rem] border border-white/10 bg-white/6 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.22)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-emerald-100 shadow-[0_10px_24px_rgba(16,185,129,0.16)]">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/72">{eyebrow}</p>
          <h3 className={`mt-1 text-lg font-black text-white ${rubik.className}`}>{title}</h3>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">{description}</p>

      {steps.length > 0 ? (
        <ol className="mt-4 space-y-2.5">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300/22 bg-emerald-400/10 text-[11px] font-bold text-emerald-100">
                {index + 1}
              </span>
              <span className="text-sm leading-6 text-slate-100">{step}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 inline-flex w-fit items-center rounded-full border border-emerald-300/18 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
          Brug mobildata, hvis eleverne har svært ved at komme ind.
        </div>
      )}
    </article>
  );
}

type TeacherLiveLobbyProps = {
  joinPin: string;
  students: string[];
  isLoading: boolean;
  onStartSession: () => Promise<void>;
  startHint?: string | null;
  postOrderMode?: ActivePostOrderMode;
  postCount?: number;
  previewStartOffsets?: number[];
};

export default function TeacherLiveLobby({
  joinPin,
  students,
  isLoading,
  onStartSession,
  startHint = null,
  postOrderMode,
  postCount = 0,
  previewStartOffsets = [],
}: TeacherLiveLobbyProps) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setOrigin(window.location.origin);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <motion.main
      key="waiting"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
      className={`relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 p-6 text-white md:p-12 ${poppins.className}`}
    >
      <div className="fixed inset-0 -z-20" aria-hidden="true">
        <Image
          src="/brand/heroes/adventure-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-sky-950/42 via-slate-950/36 to-emerald-950/62 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-4xl rounded-[3rem] border border-white/50 bg-white/85 p-8 text-center shadow-2xl backdrop-blur-md md:p-14">
        <section className="w-full">
          <h1 className={`mx-auto max-w-3xl text-xl font-bold text-emerald-800 md:text-2xl ${rubik.className}`}>
            Log ind i lobbyen på SkoleGPS.dk eller scan QR-koden herunder
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
              value={`${origin}/join?pin=${joinPin}`}
              size={200}
              bgColor="#ffffff"
              fgColor="#050816"
              qrStyle="dots"
              eyeRadius={10}
            />
          </div>
        </section>

        <section className="mt-8 w-full rounded-[2rem] border border-slate-900/8 bg-linear-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-5 text-left shadow-[0_24px_70px_rgba(15,23,42,0.22)] md:px-6 md:py-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/72">
                Bedste oplevelse på mobilen
              </p>
              <h2 className={`mt-2 text-2xl font-black text-white md:text-[2rem] ${rubik.className}`}>
                Gør mobilen klar før start
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300 md:text-[15px]">
                Vis gerne disse hurtige råd, mens eleverne scanner QR-koden eller skriver pinkoden.
              </p>
            </div>

            <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold text-slate-200">
              Kort fortalt: stabilt net, rigtig browser og ikon på hjemmeskærmen
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <MobilePrepCard
              icon={WifiOff}
              eyebrow="Netværk"
              title="Hvis nettet driller"
              description="På nogle skolenetværk kan forbindelsen være ustabil. Hvis eleverne har svært ved at komme ind, så prøv at slå Wi-Fi fra og bruge mobildata."
            />

            <MobilePrepCard
              icon={Share2}
              eyebrow="iPhone / Safari"
              title="Åbn fra hjemmeskærmen"
              description="Åbn linket i Safari. Tilføj derefter SkoleGPS til hjemmeskærmen, og åbn fra ikonet for en mere stabil oplevelse."
              steps={IOS_PREP_STEPS}
            />

            <MobilePrepCard
              icon={Download}
              eyebrow="Android / Chrome"
              title="Installér eller føj til startskærm"
              description="Åbn linket i Chrome. Vælg derefter “Føj til startskærm” eller “Installér app”, og åbn SkoleGPS fra ikonet."
              steps={ANDROID_PREP_STEPS}
            />
          </div>
        </section>

        <section className="mt-7 w-full">
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

        {postOrderMode ? (
          <PostOrderSummary
            mode={postOrderMode}
            postCount={postCount}
            participantCount={students.length}
            startOffsets={previewStartOffsets}
            actual={false}
          />
        ) : null}

        {startHint ? (
          <p className="mt-7 text-sm font-semibold text-emerald-800/80">{startHint}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void onStartSession()}
          className={`mx-auto mt-8 w-full rounded-full border border-emerald-500/30 bg-emerald-600 px-12 py-5 text-xl font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 hover:bg-emerald-700 md:w-auto md:text-3xl ${rubik.className}`}
        >
          START LØBET
        </button>
      </div>
    </motion.main>
  );
}
