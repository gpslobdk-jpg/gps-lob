"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const handleOAuthLogin = async (provider: "google" | "facebook") => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0a1128] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.14),transparent_40%),radial-gradient(circle_at_80%_85%,rgba(99,102,241,0.18),transparent_45%)]" />

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
        className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-10 w-full max-w-md shadow-2xl relative overflow-hidden"
      >
        <div className="absolute -top-12 right-0 h-32 w-32 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -bottom-12 left-0 h-36 w-36 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative z-10">
          <div className="flex justify-center">
            <Image
              src="/gpslogo.png"
              alt="GPSLOB.DK Logo"
              width={200}
              height={96}
              priority
              className="w-48 max-w-[200px] object-contain drop-shadow-[0_0_16px_rgba(34,211,238,0.38)]"
            />
          </div>

          <h1 className="mt-4 text-center text-2xl sm:text-3xl font-bold text-white [text-shadow:0_0_14px_rgba(34,211,238,0.35)]">
            Velkommen til gpsløb.dk
          </h1>

          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            className="mt-6 h-12 w-full rounded-2xl bg-white px-5 text-base font-semibold text-slate-900 shadow-[0_0_22px_rgba(255,255,255,0.14)] transition-transform hover:scale-[1.02]"
          >
            <span className="flex items-center justify-center gap-3">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  fill="#4285F4"
                  d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h5.9a5.05 5.05 0 0 1-2.2 3.31v2.75h3.56c2.09-1.92 3.24-4.75 3.24-8.08Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.93 0 5.4-.97 7.2-2.65l-3.56-2.75c-.97.65-2.2 1.04-3.64 1.04-2.8 0-5.16-1.9-6-4.45H2.3v2.8A10.9 10.9 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6 14.19a6.53 6.53 0 0 1-.33-2.19c0-.76.12-1.5.33-2.19V7.01H2.3A10.98 10.98 0 0 0 1 12c0 1.77.43 3.45 1.3 4.99l2.86-2.8H6Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.36c1.6 0 3.04.56 4.17 1.63l3.13-3.13C17.4 2.07 14.93 1 12 1 7.73 1 4.05 3.42 2.3 7.01L6 9.81c.84-2.55 3.2-4.45 6-4.45Z"
                />
              </svg>
              Log ind med Google
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin("facebook")}
            className="mt-3 h-12 w-full rounded-2xl bg-[#1877F2] px-5 text-base font-semibold text-white shadow-[0_0_18px_rgba(24,119,242,0.45)] transition-transform hover:scale-[1.02]"
          >
            <span className="flex items-center justify-center gap-3">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-white">
                <path d="M13.5 21v-7h2.3l.4-3h-2.7V9.2c0-.9.2-1.5 1.5-1.5H16V5.1c-.2 0-1-.1-1.9-.1-2.3 0-3.9 1.4-3.9 4V11H8v3h2.2v7h3.3Z" />
              </svg>
              Log ind med Facebook
            </span>
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-widest text-white/30">
              eller log ind med e-mail
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              className="w-full rounded-xl bg-black/20 px-4 py-3 text-white placeholder:text-white/40 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Adgangskode"
              className="w-full rounded-xl bg-black/20 px-4 py-3 text-white placeholder:text-white/40 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
            />

            <motion.button
              type="button"
              animate={{
                boxShadow: [
                  "0 0 15px rgba(34,211,238,0.5)",
                  "0 0 24px rgba(34,211,238,0.72)",
                  "0 0 15px rgba(34,211,238,0.5)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-base font-bold text-white shadow-[0_0_15px_rgba(34,211,238,0.5)]"
            >
              Log ind / Opret
            </motion.button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-xs text-white/45 transition hover:text-white/70"
            >
              &larr; Tilbage til forsiden
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
