"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Gamepad2, UserSearch } from "lucide-react";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const gameCards = [
  {
    title: "Find Bedrageren",
    label: "SOCIALT BLUFF-SPIL",
    description:
      "Eleverne får roller og et hemmeligt ord. Én eller flere er bedragere og skal bluffe sig gennem diskussionen.",
    howItWorks:
      "Sådan fungerer det: Læreren opretter et ord, eleverne får roller på mobilen, klassen diskuterer, stemmer og ser til sidst, om bedrageren blev afsløret.",
    flow: "Læreren vælger ord -> elever får roller -> diskussion -> afstemning -> resultat",
    cta: "Opret spil",
    href: "/dashboard/opret/find-bedrageren",
  },
];

export default function MobilspilPage() {
  return (
    <main
      className={`relative min-h-screen overflow-x-hidden bg-slate-950 px-6 py-8 text-white md:px-10 lg:px-12 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="fixed inset-0 h-full w-full object-cover opacity-60"
        src="/baggrundbilledespilside.mp4"
      />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.28),transparent_28%),radial-gradient(circle_at_82%_24%,rgba(168,85,247,0.24),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.82),rgba(15,23,42,0.7)_42%,rgba(3,7,18,0.88))]" />
      <div className="fixed inset-0 bg-slate-950/42 backdrop-blur-[1px]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm font-bold text-white/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition hover:border-cyan-200/42 hover:bg-white/16 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 shadow-[0_16px_44px_rgba(8,145,178,0.16)] backdrop-blur-xl sm:inline-flex">
            <Gamepad2 className="h-4 w-4" />
            Mobilspil
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <div className="inline-flex rounded-full border border-cyan-200/22 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100 shadow-[0_16px_44px_rgba(8,145,178,0.13)] backdrop-blur-xl">
              Game hub
            </div>
            <h1
              className={`mt-6 text-5xl font-black tracking-tight text-white drop-shadow-[0_18px_40px_rgba(0,0,0,0.5)] md:text-7xl ${rubik.className}`}
            >
              Mobilspil
            </h1>
            <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-200/88 md:text-lg">
              Vælg et spil, som eleverne spiller på mobilen. Opsætningen er enkel og trin-for-trin. Selve spillet foregår på elevernes mobiler.
            </p>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.62, delay: 0.08, ease: "easeOut" }}
            className="grid gap-5"
            aria-label="Mobilspil"
          >
            {gameCards.map((game) => (
              <article
                key={game.href}
                className="group relative overflow-hidden rounded-[2rem] border border-white/16 bg-white/10 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.42),0_18px_42px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl transition duration-300 hover:border-cyan-100/32 hover:bg-white/14 focus-within:border-cyan-100/38 focus-within:bg-white/14 md:p-7"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.3),transparent_42%),linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.035))]" />
                <div className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] border border-white/10" />

                <div className="relative z-10 flex flex-col gap-7">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/24 bg-cyan-200/12 text-cyan-50 shadow-[0_18px_46px_rgba(34,211,238,0.16)]">
                      <UserSearch className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/82">
                        {game.label}
                      </p>
                      <h2 className={`mt-2 text-3xl font-black tracking-tight text-white ${rubik.className}`}>
                        {game.title}
                      </h2>
                      <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-200/82 md:text-base">
                        {game.description}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/12 bg-slate-950/22 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 group-hover:border-cyan-100/30 group-hover:bg-cyan-50/10 group-focus-within:border-cyan-100/34 group-focus-within:bg-cyan-50/10">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-cyan-100/78">
                      Sådan fungerer det
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-200/84">{game.howItWorks}</p>
                    <p className="mt-3 rounded-[0.875rem] border border-white/10 bg-white/8 px-3 py-2 text-[0.72rem] font-black text-cyan-50/82 transition duration-300 group-hover:border-cyan-100/28 group-hover:text-cyan-50 group-focus-within:border-cyan-100/28 group-focus-within:text-cyan-50">
                      {game.flow}
                    </p>
                  </div>

                  <Link
                    href={game.href}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-100/24 bg-cyan-300/16 px-5 py-3 text-sm font-black text-cyan-50 shadow-[0_18px_44px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:border-cyan-100/44 hover:bg-cyan-300/24 md:w-fit"
                  >
                    {game.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </motion.section>
        </section>
      </div>
    </main>
  );
}
