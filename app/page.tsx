"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import Lottie from "lottie-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import AIChatButton from "@/components/AIChatButton";
import natureAnimation from "@/public/nature.json";
import { createClient } from "@/utils/supabase/client";

const WelcomeModal = dynamic(() => import("@/components/WelcomeModal"), {
  ssr: false,
});

export default function Home() {
  const [code, setCode] = useState("");
  const [showIntroToken, setShowIntroToken] = useState(0);
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanedCode = code.replace(/\D/g, "").slice(0, 5);
    if (cleanedCode.length !== 5) return;
    router.push(`/${cleanedCode}`);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-sky-100 via-green-50 to-emerald-100/50 text-slate-900">
      <video
        src="/promo.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 hidden h-full w-full object-cover -z-20 lg:block"
      />
      <div className="fixed inset-0 hidden bg-emerald-900/20 backdrop-blur-[2px] -z-10 lg:block" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.45),transparent_35%),radial-gradient(circle_at_85%_95%,rgba(16,185,129,0.22),transparent_40%),radial-gradient(rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:100%_100%,100%_100%,20px_20px]" />

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
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 5))
                }
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                placeholder={"Indtast l\u00f8bskode"}
                className="w-full rounded-2xl border border-emerald-200 bg-white/85 px-4 py-4 text-center text-xl font-bold tracking-[0.18em] text-emerald-950 outline-none placeholder:tracking-normal placeholder:text-emerald-800/55 focus:border-emerald-500/75 focus:ring-2 focus:ring-emerald-500/25"
              />
              <button
                type="submit"
                disabled={code.length !== 5}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-base font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Deltag
              </button>
            </form>
          </div>

          <Link
            href="/dashboard/opret"
            className="block w-full rounded-2xl border border-white/55 bg-white/55 px-4 py-3 text-center text-base font-semibold text-emerald-950 transition hover:bg-white/75"
          >
            {"Opret nyt l\u00f8b"}
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

      <AIChatButton />
    </div>
  );
}
