"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import Lottie from "lottie-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import AIChatButton from "@/components/AIChatButton";
import natureAnimation from "@/public/nature.json";

const WelcomeModal = dynamic(() => import("@/components/WelcomeModal"), {
  ssr: false,
});

export default function Home() {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [showIntroToken, setShowIntroToken] = useState(0);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [showMobileIntroModal, setShowMobileIntroModal] = useState(false);
  const [isIntroMuted, setIsIntroMuted] = useState(true);
  const [isIntroVideoLoaded, setIsIntroVideoLoaded] = useState(false);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("code")) return;

    const callbackUrl = new URL("/api/auth/callback", window.location.origin);
    callbackUrl.search = params.toString();
    if (!callbackUrl.searchParams.get("next")) {
      callbackUrl.searchParams.set("next", "/dashboard");
    }

    window.location.replace(callbackUrl.toString());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSeenIntro = window.localStorage.getItem("hasSeenIntro");
    if (hasSeenIntro) return;
    const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) return;
      if (isMobileViewport) {
        setShowMobileIntroModal(true);
        return;
      }
      setShowIntroModal(true);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const closeIntroModal = () => {
    setShowIntroModal(false);
    setShowMobileIntroModal(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hasSeenIntro", "true");
    }
  };

  const enableIntroSound = () => {
    setIsIntroMuted(false);
    if (introVideoRef.current) {
      introVideoRef.current.muted = false;
      introVideoRef.current.volume = 1;
      void introVideoRef.current.play().catch(() => undefined);
    }
  };

  const handleIntroVideoLoaded = () => {
    setIsIntroVideoLoaded(true);
    void introVideoRef.current?.play().catch(() => undefined);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanedCode = code.replace(/\D/g, "").slice(0, 5);
    if (cleanedCode.length === 0) {
      setCodeError("Husk at skrive koden først!");
      return;
    }
    if (cleanedCode.length !== 5) {
      setCodeError("Koden skal bestå af 5 tal.");
      return;
    }
    setCodeError("");
    router.push(`/join?pin=${cleanedCode}`);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-sky-100 via-green-50 to-emerald-100/50 text-slate-900">
      <video
        src="/promo.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="fixed top-0 left-0 hidden h-full w-full object-cover -z-20 lg:block"
      />
      <div className="fixed inset-0 hidden bg-emerald-900/22 -z-10 lg:block" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.45),transparent_35%),radial-gradient(circle_at_85%_95%,rgba(16,185,129,0.22),transparent_40%),radial-gradient(rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:100%_100%,100%_100%,20px_20px] lg:hidden" />

      <WelcomeModal forceOpenToken={showIntroToken} />

      <main className="relative mx-auto flex w-full flex-1 flex-col justify-center px-4 py-8 md:hidden">
        <section className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/20 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-center text-sm font-semibold tracking-wide text-white/90">
                Indtast løbskode
              </p>
              <input
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 5));
                  if (codeError) setCodeError("");
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                placeholder="Indtast løbskode"
                className="w-full rounded-3xl border border-emerald-200/80 bg-white px-6 py-8 text-center text-3xl font-black tracking-[0.24em] text-emerald-950 outline-none placeholder:tracking-normal placeholder:text-emerald-900/45 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/25"
              />
              <button
                type="submit"
                className="w-full rounded-3xl bg-emerald-600 px-6 py-8 text-3xl font-black text-white transition active:scale-[0.99]"
              >
                Deltag
              </button>
              {codeError ? (
                <p className="text-center text-sm font-semibold text-rose-200">{codeError}</p>
              ) : null}
            </form>
          </div>
        </section>
      </main>

      <main className="relative mx-auto hidden w-full max-w-md flex-1 flex-col justify-center px-6 py-10 md:flex">
        <section className="space-y-6">
          <div className="flex justify-center">
            <div className="relative h-52 w-full max-w-[300px]">
              <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
                <Lottie
                  animationData={natureAnimation}
                  loop={true}
                  autoplay={true}
                  className="h-44 w-44 opacity-70 sm:h-56 sm:w-56"
                />
              </div>
              <div className="relative z-20 flex h-full items-center justify-center">
                <Image
                  src="/gpslogo.png"
                  alt={"GPSL\u00d8B.DK logo"}
                  width={320}
                  height={140}
                  priority
                  className="h-auto w-full max-w-[220px] object-contain drop-shadow-[0_10px_20px_rgba(5,46,22,0.18)]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/80 p-5 shadow-2xl shadow-emerald-900/20 backdrop-blur-md">
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 5));
                  if (codeError) setCodeError("");
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                placeholder={"Indtast l\u00f8bskode"}
                className="w-full rounded-2xl border border-emerald-200 bg-white/85 px-4 py-4 text-center text-xl font-bold tracking-[0.18em] text-emerald-950 outline-none placeholder:tracking-normal placeholder:text-emerald-800/55 focus:border-emerald-500/75 focus:ring-2 focus:ring-emerald-500/25"
              />
              <button
                type="submit"
                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-base font-black text-white transition hover:bg-emerald-700"
              >
                Deltag
              </button>
              {codeError ? (
                <p className="text-center text-xs font-medium text-rose-700">{codeError}</p>
              ) : null}
            </form>
          </div>

          <Link
            href="/login"
            data-tour="home-organizer-login"
            className="block w-full rounded-2xl border border-white/55 bg-white/55 px-4 py-3 text-center text-base font-semibold text-emerald-950 transition hover:bg-white/75"
          >
            {"Log ind for arrang\u00f8rer"}
          </Link>
        </section>

        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => setShowIntroToken((prev) => prev + 1)}
            className="text-sm font-medium text-emerald-900 underline decoration-emerald-600/60 underline-offset-4 transition hover:text-emerald-700"
          >
            {"Hvad er GPSL\u00d8B.DK? \u{1F914}"}
          </button>
          <Link
            href="/privacy"
            className="mt-4 block text-sm text-emerald-950 opacity-70 transition-opacity hover:opacity-100"
          >
            Privatlivspolitik &amp; Vilkår
          </Link>
        </div>
      </main>

      <footer className="relative mx-auto hidden w-full max-w-4xl px-6 pb-8 pt-3 md:block">
        <div className="flex flex-col items-center gap-3 text-center text-sm text-slate-600 sm:flex-row sm:justify-between sm:text-left">
          <div>
            <a
              href="mailto:gpslobdk@gmail.com"
              className="transition hover:text-emerald-700"
            >
              Support: gpslobdk@gmail.com
            </a>
          </div>

          <p>{"\u00a9 2026 gpsl\u00f8b.dk"}</p>
        </div>
      </footer>

      <AnimatePresence>
        {showMobileIntroModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur-xl md:hidden"
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full max-w-md rounded-3xl border border-white/20 bg-slate-900/70 p-6 text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
            >
              <p className="text-center text-lg font-semibold leading-relaxed text-white">
                Velkommen til GPS Løb! Indtast koden fra din lærer/arrangør for at
                starte eventyret.
              </p>
              <button
                type="button"
                onClick={closeIntroModal}
                className="mt-6 w-full rounded-2xl bg-emerald-500 px-5 py-4 text-xl font-black text-white transition active:scale-[0.99]"
              >
                OK
              </button>
            </motion.div>
          </motion.div>
        ) : null}

        {showIntroModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-[120] hidden bg-slate-950/65 backdrop-blur-xl md:block"
          >
            <motion.div
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative h-screen w-screen overflow-hidden border border-white/10 bg-emerald-950/90 text-white"
            >
              <button
                type="button"
                onClick={closeIntroModal}
                className="absolute right-4 top-4 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-slate-950/45 p-4 text-white/80 shadow-lg shadow-black/25 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
                aria-label="Luk introduktion"
              >
                <span aria-hidden="true" className="text-4xl font-bold leading-none">
                  ×
                </span>
              </button>

              <div
                className={`absolute inset-0 transition-opacity duration-500 ${
                  isIntroVideoLoaded ? "opacity-0" : "opacity-100"
                }`}
              >
                <Image
                  src="/intro-poster.jpg"
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover"
                />
              </div>

              <video
                ref={introVideoRef}
                src="/introvideo.mp4"
                poster="/intro-poster.jpg"
                autoPlay
                muted={isIntroMuted}
                playsInline
                preload="auto"
                className={`h-full w-full object-cover transition-opacity duration-500 ${
                  isIntroVideoLoaded ? "opacity-100" : "opacity-0"
                }`}
                onLoadedData={handleIntroVideoLoaded}
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/55 via-transparent to-slate-950/45" />

              {isIntroMuted ? (
                <button
                  type="button"
                  onClick={enableIntroSound}
                  className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-xl border border-white/20 bg-emerald-950/80 px-6 py-4 text-base font-bold text-white shadow-xl shadow-black/30 backdrop-blur-md transition hover:bg-emerald-900/85"
                  aria-label="Slå lyd til"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                  </svg>
                  <span>Slå lyd til</span>
                </button>
              ) : null}

              <p className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-2xl bg-slate-950/55 px-6 py-3 text-center text-lg font-bold text-emerald-50/90 shadow-lg shadow-black/25 backdrop-blur-md sm:text-xl">
                Tryk på X for at lukke introen
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AIChatButton />
    </div>
  );
}
