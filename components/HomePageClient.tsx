"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
      </footer>
    </>
  );
    const video = backgroundVideoRef.current;
    if (!video) return;

    video.muted = isMuted;
    video.volume = isMuted ? 0 : 1;
    void video.play().catch(() => undefined);
  }, [isMuted]);

  const toggleBackgroundSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (!backgroundVideoRef.current) return;

    backgroundVideoRef.current.muted = nextMuted;
    backgroundVideoRef.current.volume = nextMuted ? 0 : 1;
    void backgroundVideoRef.current.play().catch(() => undefined);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isJoining) return;

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
    setIsJoining(true);
    router.push(`/join?pin=${cleanedCode}`);
  };



  return (
    <>
      {/* ...eksisterende kode for video, overlays, main, mv... */}

      {/* Svævende citat-bobler (kun desktop) */}
      <div className="hidden lg:block pointer-events-none">
        {testimonialBubbles.map((bubble, i) => {
          const positions = [
            "top-[12%] left-[18%]",
            "top-[38%] right-[14%]",
            "bottom-[18%] left-[28%]",
            "bottom-[12%] right-[22%]"
          ];
          const floatVariants = {
            float: {
              y: [0, -8, 0, 8, 0],
              transition: {
                duration: 13 + i * 2,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }
          };
          return (
            <motion.div
              key={bubble.name}
              className={`absolute z-10 ${positions[i]} w-42.5 h-22.5 flex flex-col items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-[0_0_32px_0_rgba(16,185,129,0.10)] backdrop-blur-md select-none`}
              variants={floatVariants}
              animate="float"
              style={{ filter: "drop-shadow(0 0 12px rgba(16,185,129,0.10))" }}
            >
              <span className="block text-xs italic text-white/90 text-center px-4 leading-snug">
                {bubble.quote}
              </span>
              <span className="mt-2 text-[10px] text-white/80 font-semibold text-center">
                {bubble.name}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* ...eksisterende kode for main, footer osv... */}
      <div className="relative z-20 mx-auto mb-4 hidden w-full max-w-4xl flex-wrap items-center justify-center gap-3 px-4 md:flex">
        <button
          type="button"
          onClick={toggleBackgroundSound}
          aria-pressed={!isMuted}
          className="inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-slate-950/70 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.15)] backdrop-blur-xl transition-all hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {isMuted ? (
              <>
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <>
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </>
            )}
          </svg>
          <span>{isMuted ? "Slå lyd til" : "Slå lyd fra"}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowIntroToken((prev) => prev + 1)}
          className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/60 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-[0_0_24px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all hover:border-emerald-500/30 hover:bg-slate-900/80 hover:text-emerald-300"
        >
          <span>{"Hvad er GPSLØB.DK? \u{1F914}"}</span>
        </button>
      </div>

      <footer className="relative mx-auto hidden w-full max-w-4xl px-6 pb-8 pt-3 md:block">
        <div className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-slate-400">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/gdpr" className="transition hover:underline">
              GDPR &amp; Elevernes data
            </Link>
            <Link href="/privacy" className="transition hover:underline">
              Privatlivspolitik &amp; Vilkår
            </Link>
            <Link href="/ophavsret" className="transition hover:underline">
              Ophavsret &amp; AI
            </Link>
            <Link
              href="/teknologi"
              className="font-medium text-slate-200 transition hover:underline"
            >
              Læs om teknikken bag
            </Link>
          </div>
          <a
            href="mailto:gpslobdk@gmail.com"
            className="transition hover:text-emerald-300"
          >
            Support: gpslobdk@gmail.com
          </a>
          <p>{"\u00a9 2026 gpsløb.dk"}</p>
        </div>
      </footer>
    </>
  );

      <div className="relative z-20 mx-auto mb-4 hidden w-full max-w-4xl flex-wrap items-center justify-center gap-3 px-4 md:flex">
        <button
          type="button"
          onClick={toggleBackgroundSound}
          aria-pressed={!isMuted}
          className="inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-slate-950/70 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.15)] backdrop-blur-xl transition-all hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {isMuted ? (
              <>
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <>
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </>
            )}
          </svg>
          <span>{isMuted ? "Slå lyd til" : "Slå lyd fra"}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowIntroToken((prev) => prev + 1)}
          className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/60 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-[0_0_24px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all hover:border-emerald-500/30 hover:bg-slate-900/80 hover:text-emerald-300"
        >
          <span>{"Hvad er GPSL\u00d8B.DK? \u{1F914}"}</span>
        </button>
      </div>

      <footer className="relative mx-auto hidden w-full max-w-4xl px-6 pb-8 pt-3 md:block">
        <div className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-slate-400">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/gdpr" className="transition hover:underline">
              GDPR &amp; Elevernes data
            </Link>
            <Link href="/privacy" className="transition hover:underline">
              Privatlivspolitik &amp; Vilkår
            </Link>
            <Link href="/ophavsret" className="transition hover:underline">
              Ophavsret &amp; AI
            </Link>
            <Link
              href="/teknologi"
              className="font-medium text-slate-200 transition hover:underline"
            >
              Læs om teknikken bag
            </Link>
          </div>
          <a
            href="mailto:gpslobdk@gmail.com"
            className="transition hover:text-emerald-300"
          >
            Support: gpslobdk@gmail.com
          </a>
          <p>{"\u00a9 2026 gpsl\u00f8b.dk"}</p>
        </div>
      </footer>

      <div className="hidden md:block">
        <AIChatButton />
      </div>
    </div>
  );
}
