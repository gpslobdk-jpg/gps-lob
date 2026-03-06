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
  const [isIntroMuted, setIsIntroMuted] = useState(true);
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

    const frame = window.requestAnimationFrame(() => {
      setShowIntroModal(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const closeIntroModal = () => {
    setShowIntroModal(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hasSeenIntro", "true");
    }
  };

  const toggleIntroSound = () => {
    setIsIntroMuted((prev) => {
      const nextMuted = !prev;
      if (introVideoRef.current) {
        introVideoRef.current.muted = nextMuted;
        void introVideoRef.current.play().catch(() => undefined);
      }
      return nextMuted;
    });
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

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
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
        </div>
      </main>

      <footer className="relative mx-auto w-full max-w-4xl px-6 pb-8 pt-3">
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
        {showIntroModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/90 p-5 text-white shadow-2xl shadow-emerald-950/40 backdrop-blur-xl sm:p-6"
            >
              <button
                type="button"
                onClick={closeIntroModal}
                className="absolute right-3 top-3 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Luk introduktion"
              >
                <span aria-hidden="true" className="text-base font-semibold">
                  ×
                </span>
              </button>

              <h2 className="mb-4 pr-10 text-xl font-bold text-emerald-50 sm:text-2xl">
                Velkommen til GPSLØB.DK
              </h2>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <video
                  ref={introVideoRef}
                  src="/introvideo.mp4"
                  autoPlay
                  muted={isIntroMuted}
                  playsInline
                  preload="metadata"
                  className="h-full w-full rounded-2xl object-cover"
                  onLoadedData={() => {
                    void introVideoRef.current?.play().catch(() => undefined);
                  }}
                />
                <button
                  type="button"
                  onClick={toggleIntroSound}
                  className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/60"
                  aria-label={isIntroMuted ? "Slå lyd til" : "Slå lyd fra"}
                >
                  {isIntroMuted ? "Lyd til" : "Lyd fra"}
                </button>
              </div>

              <button
                type="button"
                onClick={closeIntroModal}
                className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-base font-bold text-emerald-950 transition hover:bg-emerald-400"
              >
                Kom i gang
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AIChatButton />
    </div>
  );
}
