"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ComponentType, FormEvent, useEffect, useState } from "react";
import PlayerBase from "react-lottie-player";
import runnerJson from "../public/runner.json";
import { createClient } from "@/utils/supabase/client";

const OnboardingModal = dynamic(() => import("@/components/OnboardingModal"), {
  ssr: false,
});

const Player = PlayerBase as unknown as ComponentType<{
  animationData: unknown;
  loop?: boolean;
  play?: boolean;
  style?: { width?: number; height?: number };
  className?: string;
}>;

export default function Home() {
  const [code, setCode] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.push("/dashboard");
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
    } catch (error) {
      console.error("Google login fejlede:", error);
      setIsLoggingIn(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanedCode = code.replace(/\D/g, "").slice(0, 5);
    if (cleanedCode.length !== 5) {
      return;
    }
    router.push(`/${cleanedCode}`);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a1128] font-sans text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_85%,rgba(168,85,247,0.2),transparent_46%)]" />
      <div className="pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-violet-500/15 blur-[140px]" />

      <OnboardingModal />

      <main className="relative mx-auto min-h-screen w-full max-w-6xl flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto gap-4 sm:gap-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 130, damping: 18 }}
          className="w-full max-w-3xl"
        >
          <Image
            src="/gpslogo.png"
            alt="GPSLOB.DK Logo"
            width={600}
            height={300}
            className="mx-auto w-full max-w-[200px] sm:max-w-[250px] object-contain drop-shadow-[0_0_16px_rgba(34,211,238,0.38)]"
            priority
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}
          className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 pb-1"
        >
          Stjerneløb med mobiltelefonen!
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-cyan-100/80 text-base md:text-lg font-light tracking-wide mt-1 text-center"
        >
          Digitalt orienteringsløb og skattejagt for hele klassen. Byg på 60
          sekunder, slip dem løs og følg med live.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5, ease: "easeOut" }}
          className="relative flex h-40 w-40 items-center justify-center sm:h-56 sm:w-56"
        >
          <div className="pointer-events-none absolute h-32 w-32 rounded-full bg-cyan-500/20 blur-3xl sm:h-48 sm:w-48" />
          <motion.div
            className="relative z-10 scale-[0.82] sm:scale-100"
            animate={{ y: [-10, 10, -10] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Player
              animationData={runnerJson}
              loop
              play
              className="w-40 h-40 sm:w-56 sm:h-56 object-contain"
            />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.55, ease: "easeOut" }}
          className="w-full max-w-[380px] mx-auto space-y-2"
        >
          <motion.div
            whileHover={{
              scale: 1.05,
              boxShadow:
                "0px 0px 28px rgba(34,211,238,0.7), 0px 0px 44px rgba(168,85,247,0.35)",
            }}
            whileTap={{ scale: 0.99 }}
            className="rounded-2xl"
          >
            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              disabled={isLoggingIn}
              className="w-full py-4 px-6 rounded-2xl font-extrabold text-lg md:text-xl text-white bg-gradient-to-r from-cyan-500 to-blue-600 border border-cyan-300/50 shadow-[0_0_20px_rgba(34,211,238,0.6)] hover:shadow-[0_0_35px_rgba(34,211,238,0.9)] transition-all duration-300 uppercase tracking-wider"
            >
              {isLoggingIn ? "LOGGER IND..." : "OPRET NYT LØB NU"}
            </button>
          </motion.div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-5">
            <h2 className="text-lg font-semibold text-slate-100 sm:text-xl">
              Har du en kode?
            </h2>
            <form onSubmit={handleSubmit} className="mt-2 space-y-2">
              <input
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 5));
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                placeholder="12345"
                className="w-full rounded-xl border border-white/20 bg-slate-950/60 px-4 py-2.5 text-center text-2xl font-bold tracking-[0.32em] text-cyan-200 outline-none placeholder:tracking-[0.2em] placeholder:text-slate-500 focus:border-cyan-300/75 focus:shadow-[0_0_14px_rgba(34,211,238,0.45)]"
              />

              <motion.button
                type="submit"
                disabled={code.length !== 5}
                whileHover={
                  code.length === 5
                    ? {
                        scale: 1.03,
                        boxShadow:
                          "0px 0px 22px rgba(34,211,238,0.58), 0px 0px 34px rgba(168,85,247,0.3)",
                      }
                    : undefined
                }
                whileTap={code.length === 5 ? { scale: 0.99 } : undefined}
                className="w-full rounded-xl border border-cyan-300/45 bg-cyan-400/20 px-4 py-2.5 text-base font-semibold text-cyan-50 shadow-[0_0_12px_rgba(34,211,238,0.35)] transition hover:bg-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Start løb
              </motion.button>
            </form>
          </section>
        </motion.div>
      </main>
    </div>
  );
}

