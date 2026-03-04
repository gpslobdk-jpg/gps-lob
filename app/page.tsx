"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ComponentType, FormEvent, useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

const OnboardingModal = dynamic(() => import("@/components/OnboardingModal"), {
  ssr: false,
});

type LottiePlayerProps = {
  autoplay?: boolean;
  loop?: boolean;
  src: string;
  style?: { width?: number; height?: number };
  className?: string;
};

const LottiePlayer = dynamic(
  () =>
    import("@lottiefiles/react-lottie-player").then(
      (mod) => mod.Player as unknown as ComponentType<LottiePlayerProps>
    ),
  { ssr: false }
);

const STEP_CARDS = [
  {
    step: "Opret",
    title: "Design dit løb på 60 sekunder.",
    lottieUrl: "https://lottie.host/804d166c-5e4f-4d2a-9f5b-9d48937b4f2c/fFm2WlB6yE.json",
  },
  {
    step: "Del",
    title: "Scan og start - uden besvær.",
    lottieUrl: "https://lottie.host/6b3a0423-f308-466d-965a-8b8a53e3d36e/P3uEw7Yv9U.json",
  },
  {
    step: "Følg",
    title: "Følg spændingen live.",
    lottieUrl: "https://lottie.host/57a7e112-706f-4700-8438-95d852a4e402/p9nS6L2WkE.json",
  },
] as const;

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
    <div className="relative min-h-screen w-full bg-orange-50/30 font-sans text-slate-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(251,146,60,0.22),transparent_40%),radial-gradient(circle_at_85%_12%,rgba(245,158,11,0.16),transparent_35%),radial-gradient(circle_at_50%_85%,rgba(251,191,36,0.18),transparent_44%)]" />
      <div className="pointer-events-none absolute -left-16 top-16 h-72 w-72 rounded-full bg-amber-300/35 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 bottom-12 h-72 w-72 rounded-full bg-orange-200/45 blur-[130px]" />

      <OnboardingModal />

      <main className="relative mx-auto w-full max-w-7xl px-6 py-10 md:px-10 md:py-14">
        <section className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="space-y-6"
          >
            <Image
              src="/gpslogo.png"
              alt="GPSLOB.DK Logo"
              width={620}
              height={310}
              className="w-full max-w-[230px] object-contain drop-shadow-[0_10px_24px_rgba(251,146,60,0.28)] md:max-w-[270px]"
              priority
            />

            <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-6xl">
              Eventyret starter her 🗺️
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-slate-800 md:text-xl">
              GPSLOB.DK gør det legende let at skabe uforglemmelige oplevelser i det fri. For venner, familier og virksomheder.
            </p>

            <div className="flex w-full max-w-xl flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={isLoggingIn}
                className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 py-4 text-lg font-black tracking-wide text-white shadow-xl shadow-orange-300/60 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto animate-pulse"
              >
                {isLoggingIn ? "ÅBNER..." : "Kom i gang"}
              </button>
            </div>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45, ease: "easeOut" }}
            className="rounded-3xl border border-orange-100 bg-white/95 p-6 shadow-xl shadow-orange-200/50"
          >
            <h2 className="text-2xl font-black text-slate-900">Har du en kode?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Indtast koden og hop direkte med i løbet.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
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
                className="w-full rounded-2xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-center text-2xl font-black tracking-[0.35em] text-slate-800 outline-none placeholder:tracking-[0.22em] placeholder:text-slate-400 focus:border-orange-400/70 focus:ring-2 focus:ring-orange-300/50"
              />

              <motion.button
                type="submit"
                disabled={code.length !== 5}
                whileHover={code.length === 5 ? { scale: 1.02 } : undefined}
                whileTap={code.length === 5 ? { scale: 0.99 } : undefined}
                className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-base font-bold text-white shadow-lg shadow-orange-300/55 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Start løb
              </motion.button>
            </form>
          </motion.section>
        </section>

        <section className="mt-16">
          <div className="mb-6 text-center">
            <p className="text-xs font-bold tracking-[0.2em] text-orange-500 uppercase">3 Enkle Steps</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Opret, del og følg turen live
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STEP_CARDS.map((card, index) => (
              <motion.article
                key={card.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: index * 0.08, duration: 0.45, ease: "easeOut" }}
                className="rounded-3xl border border-orange-100 bg-white p-6 shadow-xl shadow-orange-200/50"
              >
                <div className="mb-5 flex h-40 items-center justify-center rounded-2xl bg-orange-50">
                  <LottiePlayer autoplay loop src={card.lottieUrl} style={{ width: 170, height: 170 }} />
                </div>
                <p className="text-xs font-bold tracking-[0.18em] text-orange-500 uppercase">{card.step}</p>
                <h3 className="mt-2 text-xl font-black text-slate-900">{card.title}</h3>
              </motion.article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
