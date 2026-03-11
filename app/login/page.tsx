"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthLoadingScreen
          title="Gør login klar"
          description="Vi læser din session, så du ikke bliver sendt rundt unødigt."
        />
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const TOUR_FINISHED_KEY = "gpslob_tour_finished";
  const TOUR_STEP_KEY = "gpslob_tour_step";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const searchParamsString = searchParams.toString();
  const hasCodeParam = searchParams.has("code");
  const hasOAuthHash =
    typeof window !== "undefined" &&
    (window.location.hash.includes("access_token") ||
      window.location.hash.includes("refresh_token"));
  const safeNextPath = (() => {
    const requested = searchParams.get("next")?.trim() ?? "";
    return requested.startsWith("/dashboard") ? requested : "/dashboard";
  })();

  useEffect(() => {
    if (!hasCodeParam) return;

    const callbackUrl = new URL("/api/auth/callback", window.location.origin);
    callbackUrl.search = searchParamsString;
    if (!callbackUrl.searchParams.get("next")) {
      callbackUrl.searchParams.set("next", safeNextPath);
    }

    window.location.replace(callbackUrl.toString());
  }, [hasCodeParam, safeNextPath, searchParamsString]);

  useEffect(() => {
    if (isAuthLoading || isRedirecting || hasCodeParam || !user) return;
    router.replace(safeNextPath);
  }, [hasCodeParam, isAuthLoading, isRedirecting, router, safeNextPath, user]);

  const handleOAuthLogin = async (provider: "google" | "facebook" | "azure") => {
    setIsRedirecting(true);

    if (typeof window !== "undefined" && window.localStorage.getItem(TOUR_FINISHED_KEY) !== "true") {
      window.localStorage.setItem(TOUR_STEP_KEY, "1");
    }

    const supabase = createClient();
    const callbackUrl = new URL("/api/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", safeNextPath);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
        ...(provider === "azure" ? { scopes: "email" } : {}),
      },
    });

    if (error) {
      console.error("OAuth-login fejlede:", error);
      setIsRedirecting(false);
    }
  };

  if (isAuthLoading || isRedirecting || hasCodeParam || hasOAuthHash || !!user) {
    return (
      <AuthLoadingScreen
        title="Logger dig ind"
        description="Vi læser din session og sender dig videre til dashboardet uden auth-flicker."
      />
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src="/bg-loop.mp4"
      />
      <div className="absolute inset-0 z-10 bg-slate-950/70" />

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
        className="relative z-20 w-full max-w-md overflow-hidden rounded-[2.5rem] border border-emerald-500/30 bg-slate-950/80 p-10 text-center shadow-[0_0_50px_rgba(16,185,129,0.2)] backdrop-blur-xl"
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

          <h1 className="mt-4 text-center text-2xl font-bold text-white sm:text-3xl">
            Velkommen til gpsløb.dk
          </h1>

          <div
            data-tour="login-organizer-entry"
            className="mt-6 rounded-[1.75rem] border border-emerald-500/20 bg-slate-950/70 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
              Log ind for arrangører
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Brug en af disse login-metoder for at åbne dashboardet og styre dine løb.
            </p>

            <button
              type="button"
              onClick={() => void handleOAuthLogin("google")}
              className="mt-4 h-12 w-full rounded-full border border-emerald-500/20 bg-slate-900 px-5 text-base font-semibold text-slate-200 shadow-inner transition-all duration-300 hover:border-emerald-500/60 hover:bg-slate-800"
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
              onClick={() => void handleOAuthLogin("azure")}
              className="mt-3 h-12 w-full rounded-full border border-emerald-500/20 bg-slate-900 px-5 text-base font-semibold text-slate-200 shadow-inner transition-all duration-300 hover:border-emerald-500/60 hover:bg-slate-800"
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
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-emerald-500/20" />
            <span className="text-xs uppercase tracking-widest text-emerald-400">
              eller log ind med e-mail
            </span>
            <div className="h-px flex-1 bg-emerald-500/20" />
          </div>

          <form className="space-y-4">
            <div className="text-left">
              <label className="mb-1 block text-sm font-medium text-emerald-400">Email</label>
              <input
                type="email"
                placeholder="Email"
                className="w-full rounded-xl border border-emerald-500/30 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="text-left">
              <label className="mb-1 block text-sm font-medium text-emerald-400">Adgangskode</label>
              <input
                type="password"
                placeholder="Adgangskode"
                className="w-full rounded-xl border border-emerald-500/30 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <motion.button
              type="button"
              className="w-full rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-base font-bold text-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.14)] transition-all duration-300 hover:scale-[1.02] hover:bg-emerald-500 hover:text-slate-950"
            >
              Log ind / Opret
            </motion.button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-xs text-emerald-400 transition hover:text-emerald-300"
            >
              &larr; Tilbage til forsiden
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
