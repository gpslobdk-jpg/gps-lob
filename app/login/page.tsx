"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const getSiteUrl = () => {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (configured) {
      const trimmed = configured.replace(/\/+$/, "");
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
      return `https://${trimmed}`;
    }

    const origin = window.location.origin.replace(/\/+$/, "");
    const isLocalhost =
      origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
    if (isLocalhost) {
      return origin;
    }
    return origin.replace(/^http:\/\//, "https://");
  };

  const handleOAuthLogin = async (provider: "google" | "facebook" | "azure") => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${getSiteUrl()}/api/auth/callback`,
        ...(provider === "azure" ? { scopes: "email" } : {}),
      },
    });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-t from-emerald-100 via-sky-50 to-sky-300 p-4 lg:bg-none lg:bg-transparent">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 hidden h-full w-full object-cover -z-20 lg:block"
        src="/promo.mp4"
      />
      <div className="fixed inset-0 hidden bg-gradient-to-b from-sky-900/10 to-emerald-900/50 backdrop-blur-[3px] -z-10 lg:block" />

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
        className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-white/50 bg-white/80 p-10 text-center shadow-2xl backdrop-blur-md"
      >
        <div className="relative z-10">
          <div className="flex justify-center">
            <Image
              src="/gpslogo.png"
              alt="GPSLOB.DK Logo"
              width={200}
              height={96}
              priority
              className="w-48 max-w-[200px] object-contain drop-shadow-[0_10px_20px_rgba(5,150,105,0.18)]"
            />
          </div>

          <h1 className="mt-4 text-center text-2xl font-bold text-emerald-950 sm:text-3xl">
            Velkommen til gpsløb.dk
          </h1>

          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            className="mt-6 h-12 w-full rounded-full border border-emerald-200 bg-white/90 px-5 text-base font-semibold text-emerald-950 shadow-sm transition-all duration-300 hover:bg-white"
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
            onClick={() => handleOAuthLogin("azure")}
            className="mt-3 h-12 w-full rounded-full border border-emerald-200 bg-white/90 px-5 text-base font-semibold text-emerald-950 shadow-sm transition-all duration-300 hover:bg-white"
          >
            <span className="flex items-center justify-center gap-3">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                <rect x="2" y="2" width="9" height="9" fill="#f35325" />
                <rect x="13" y="2" width="9" height="9" fill="#81bc06" />
                <rect x="2" y="13" width="9" height="9" fill="#05a6f0" />
                <rect x="13" y="13" width="9" height="9" fill="#ffba08" />
              </svg>
              Log ind med Microsoft
            </span>
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-emerald-200" />
            <span className="text-xs uppercase tracking-widest text-emerald-700/80">
              eller log ind med e-mail
            </span>
            <div className="h-px flex-1 bg-emerald-200" />
          </div>

          <form className="space-y-4">
            <div className="text-left">
              <label className="mb-1 block text-sm font-medium text-emerald-900">Email</label>
              <input
                type="email"
                placeholder="Email"
                className="w-full rounded-xl border border-emerald-100 bg-white/60 px-4 py-3 text-emerald-950 placeholder:text-emerald-700/50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div className="text-left">
              <label className="mb-1 block text-sm font-medium text-emerald-900">Adgangskode</label>
              <input
                type="password"
                placeholder="Adgangskode"
                className="w-full rounded-xl border border-emerald-100 bg-white/60 px-4 py-3 text-emerald-950 placeholder:text-emerald-700/50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>

            <motion.button
              type="button"
              className="w-full rounded-full bg-emerald-600 px-5 py-3 text-base font-bold text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:bg-emerald-700"
            >
              Log ind / Opret
            </motion.button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-xs text-emerald-700 transition hover:text-emerald-800"
            >
              &larr; Tilbage til forsiden
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
