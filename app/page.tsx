"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

const OnboardingModal = dynamic(() => import("@/components/OnboardingModal"), {
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
    <div className="relative min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(148,163,184,0.2),transparent_40%),radial-gradient(circle_at_50%_120%,rgba(30,41,59,0.6),transparent_55%)]" />

      <OnboardingModal forceOpenToken={showIntroToken} />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <section className="space-y-6">
          <div className="flex justify-center">
            <Image
              src="/gpslogo.png"
              alt="GPSLØB.DK logo"
              width={320}
              height={140}
              priority
              className="h-auto w-full max-w-[210px] object-contain"
            />
          </div>

          <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-xl shadow-black/35">
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                placeholder="Indtast løbskode"
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-4 text-center text-xl font-bold tracking-[0.18em] text-white outline-none placeholder:tracking-normal placeholder:text-slate-400 focus:border-cyan-400/75 focus:ring-2 focus:ring-cyan-400/30"
              />
              <button
                type="submit"
                disabled={code.length !== 5}
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-base font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Deltag
              </button>
            </form>
          </div>

          <Link
            href="/dashboard/opret"
            className="block w-full rounded-2xl border border-slate-500 bg-slate-800/60 px-4 py-3 text-center text-base font-semibold text-slate-100 transition hover:bg-slate-700/70"
          >
            Opret nyt løb
          </Link>
        </section>

        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => setShowIntroToken((prev) => prev + 1)}
            className="text-sm font-medium text-slate-300 underline decoration-slate-500 underline-offset-4 transition hover:text-white"
          >
            Hvad er GPSLØB.DK? 🤔
          </button>
        </div>
      </main>
    </div>
  );
}
