"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileCheck, Lock, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Lottie from "lottie-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import AIChatButton from "@/components/AIChatButton";
import MobileInSchoolBanner from "@/components/MobileInSchoolBanner";
import QRScannerModal from "@/components/QRScannerModal";
import { changelogEntries } from "@/lib/changelog";
import natureAnimation from "@/public/nature.json";

// WelcomeModal removed — onboarding flow deprecated

type HomePageClientProps = {
  isNativeGpslobApp: boolean;
};

type ZenBubble = {
  name: string;
  quote: string;
  position: string;
  label?: string;
  animation: {
    y: number[];
    x: number[];
    rotate: number[];
  };
};

type NativeAppWelcomeProps = {
  onReady: () => void;
  shouldReduceMotion: boolean;
};

const JOIN_PIN_LENGTH = 6;
const latest = {
  version: "Appstatus 27/04",
  date: "2026-04-27",
  type: "minor",
  title: "App-status 27/04",
  summary: "GPS Løb arbejder nu på apps til både Google Play og App Store.",
  items: [
    {
      title: "Apps på vej",
      description:
        "Vi arbejder på at gøre GPS Løb klar som app til både Android og iPhone. Følg med på opdateringssiden!",
    },
  ],
};

function formatDisplayDate(isoDate: string) {
  const [yearString, monthString, dayString] = isoDate.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

const zenBubbles: ZenBubble[] = [
  {
    name: "Eva Marie",
    quote: "Mindblown – G.E.N.I.A.L.T! Den smarte generator fungerede over al forventning.",
    position: "top-[14%] left-[10%]",
    animation: {
      y: [0, -10, 0, 8, 0],
      x: [0, 4, 0, -3, 0],
      rotate: [0, 1, 0, -1, 0],
    },
  },
  {
    name: "Karsten",
    quote: "Det her er ret fedt! Jeppe reagerer lynhurtigt.",
    position: "top-[18%] right-[11%]",
    animation: {
      y: [0, 9, 0, -7, 0],
      x: [0, -5, 0, 3, 0],
      rotate: [0, -1.5, 0, 1, 0],
    },
  },
  {
    name: "Sille",
    label: "SILLE, LÆRER",
    quote: "Det virker bare pisse fedt!! Eleverne er meget motiverede.",
    position: "top-[45%] right-[5%]",
    animation: {
      y: [0, -7, 0, 9, 0],
      x: [0, 6, 0, -5, 0],
      rotate: [0, 1.2, 0, -1, 0],
    },
  },
  {
    name: "Thomas",
    quote: "Det ser super fint ud. Glæder mig til at bruge det i praksis.",
    position: "bottom-[18%] left-[16%]",
    animation: {
      y: [0, -8, 0, 10, 0],
      x: [0, 3, 0, -4, 0],
      rotate: [0, 0.8, 0, -0.8, 0],
    },
  },
  {
    name: "Mette",
    quote: "Ser spændende ud \ud83d\udc40 \u2b50\u2b50\u2b50\u2b50\u2b50",
    position: "bottom-[13%] right-[14%]",
    animation: {
      y: [0, 11, 0, -6, 0],
      x: [0, -4, 0, 5, 0],
      rotate: [0, -1, 0, 1.2, 0],
    },
  },
];

function OrganizerHint() {
  return (
    <div className="lg:hidden">
      <div className="rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-left shadow-[0_0_24px_rgba(15,23,42,0.22)] backdrop-blur-xl">
        <p className="flex items-start gap-2 text-xs leading-5 text-slate-200/80 sm:text-sm">
          <span className="mt-0.5 shrink-0 text-sm text-sky-200" aria-hidden>
            {"\u2139\uFE0F"}
          </span>
          <span>
            {
              "Er du arrangør eller lærer, der skal oprette et løb? \u{1F6E0}\uFE0F Så skal du hoppe over på en computer på gpslob.dk. Her på mobilen kan du kun deltage i løb."
            }
          </span>
        </p>
      </div>
    </div>
  );
}

function NativeAppWelcome({ onReady, shouldReduceMotion }: NativeAppWelcomeProps) {
  const pulseAnimation = shouldReduceMotion
    ? undefined
    : {
        scale: [1, 1.16, 1],
        opacity: [0.7, 1, 0.7],
      };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#082f49_0%,#0a3b3b_42%,#020617_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.26),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(14,165,233,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_34%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-300/18 blur-3xl" />
      <div className="absolute -left-16 bottom-12 h-56 w-56 rounded-full bg-emerald-400/18 blur-3xl" />
      <div className="absolute right-0 top-24 h-52 w-52 rounded-full bg-sky-400/12 blur-3xl" />

      <motion.div
        className="absolute left-[12%] top-[14%] h-5 w-5 rounded-full border border-cyan-100/70 bg-cyan-300/30 shadow-[0_0_18px_rgba(103,232,249,0.55)]"
        animate={pulseAnimation}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[14%] top-[30%] h-4 w-4 rounded-full border border-emerald-100/60 bg-emerald-300/25 shadow-[0_0_16px_rgba(52,211,153,0.45)]"
        animate={pulseAnimation}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
      <motion.div
        className="absolute bottom-[18%] left-[18%] h-3.5 w-3.5 rounded-full border border-sky-100/60 bg-sky-300/25 shadow-[0_0_16px_rgba(56,189,248,0.42)]"
        animate={pulseAnimation}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />

      <div className="pointer-events-none absolute inset-x-6 top-[20%] h-56 rounded-[36px] border border-white/10 bg-white/6 backdrop-blur-md sm:inset-x-8">
        <svg viewBox="0 0 320 180" className="h-full w-full" aria-hidden="true">
          <path
            d="M26 132C60 98 102 54 144 82C177 104 185 155 226 137C265 119 280 77 300 40"
            fill="none"
            stroke="rgba(186,230,253,0.72)"
            strokeWidth="4"
            strokeDasharray="8 10"
            strokeLinecap="round"
          />
          <circle cx="26" cy="132" r="8" fill="rgba(45,212,191,0.95)" />
          <circle cx="144" cy="82" r="8" fill="rgba(125,211,252,0.95)" />
          <circle cx="226" cy="137" r="8" fill="rgba(52,211,153,0.95)" />
          <circle cx="300" cy="40" r="10" fill="rgba(253,224,71,0.95)" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-6 py-8 sm:px-8">
        <div className="space-y-6 pt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/85 backdrop-blur-md">
            Elev-app
          </div>

          <div className="rounded-[32px] border border-white/12 bg-slate-950/28 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.38)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100/70">
                  Mission start
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
                  {"Velkommen til GPS L\u00f8b"}
                </h1>
              </div>

              <div className="relative mt-1 h-16 w-16 shrink-0">
                <motion.div
                  className="absolute inset-0 rounded-full bg-emerald-300/18 blur-md"
                  animate={pulseAnimation}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="absolute left-1/2 top-[42%] h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/65 bg-emerald-300/22" />
                <div className="absolute left-1/2 top-[68%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[4px] border border-white/65 bg-emerald-300/22" />
                <div className="absolute left-1/2 top-[42%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
              </div>
            </div>

            <p className="mt-5 text-lg leading-8 text-slate-100/92">
              {
                "Gl\u00e6d dig! Om lidt skal du ud og bev\u00e6ge dig, finde poster og l\u00f8se opgaver."
              }
            </p>
            <p className="mt-4 text-sm leading-6 text-emerald-50/82">
              {
                "N\u00e5r din l\u00e6rer siger til, kan du indtaste l\u00f8bskoden eller scanne QR-koden."
              }
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-cyan-200/18 bg-cyan-200/10 px-3 py-2 text-xs font-semibold tracking-[0.2em] text-cyan-50 uppercase">
                GPS
              </span>
              <span className="rounded-full border border-emerald-200/18 bg-emerald-200/10 px-3 py-2 text-xs font-semibold tracking-[0.2em] text-emerald-50 uppercase">
                Poster
              </span>
              <span className="rounded-full border border-sky-200/18 bg-sky-200/10 px-3 py-2 text-xs font-semibold tracking-[0.2em] text-sky-50 uppercase">
                Missioner
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pb-4">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/26 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.24em] text-cyan-100/70 uppercase">
              <span>Rute klar</span>
              <span>3 poster</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs font-semibold text-slate-100/88">
              <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">Find poster</div>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">Scan QR</div>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
                {"L\u00f8s mission"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onReady}
            className="flex w-full items-center justify-center gap-3 rounded-[28px] bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 px-6 py-5 text-lg font-black tracking-[0.08em] text-slate-950 shadow-[0_20px_50px_rgba(20,184,166,0.35)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>Jeg er klar</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePageClient({ isNativeGpslobApp }: HomePageClientProps) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [isMuted, setIsMuted] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isCapacitorApp, setIsCapacitorApp] = useState(isNativeGpslobApp);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
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
    const video = backgroundVideoRef.current;
    if (!video) return;

    video.muted = isMuted;
    video.volume = isMuted ? 0 : 1;
    void video.play().catch(() => undefined);
  }, [isMuted]);

  useEffect(() => {
    setIsCapacitorApp(typeof (window as any).Capacitor !== "undefined");
  }, []);

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

    const cleanedCode = code.replace(/\D/g, "").slice(0, JOIN_PIN_LENGTH);
    if (cleanedCode.length === 0) {
      setCodeError("Husk at skrive koden først!");
      return;
    }
    if (cleanedCode.length !== JOIN_PIN_LENGTH) {
      setCodeError(`Koden skal bestå af ${JOIN_PIN_LENGTH} tal.`);
      return;
    }
    setCodeError("");
    setIsJoining(true);
    router.push(`/join?pin=${cleanedCode}`);
  };

  const handleAppReady = () => {
    router.push("/join");
  };

  if (isCapacitorApp) {
    return (
      <NativeAppWelcome
        onReady={handleAppReady}
        shouldReduceMotion={Boolean(shouldReduceMotion)}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden text-slate-100">
      <video
        ref={backgroundVideoRef}
        src="/introvideo.mp4"
        autoPlay
        loop
        muted={isMuted}
        playsInline
        controls={false}
        preload="auto"
        className="fixed top-0 left-0 h-full w-full object-cover -z-20"
      />
      <div className="fixed inset-0 -z-10 bg-slate-950/70 backdrop-blur-[2px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.16),transparent_35%),radial-gradient(circle_at_85%_95%,rgba(14,165,233,0.1),transparent_40%),radial-gradient(rgba(148,163,184,0.08)_1px,transparent_1px)] bg-size-[100%_100%,100%_100%,20px_20px] lg:hidden" />
      <div className="pointer-events-none fixed inset-0 -z-10 hidden lg:block">
        {zenBubbles.map((bubble, index) => (
          <motion.div
            key={bubble.name}
            className={`absolute max-w-50 bg-transparent p-4 ${bubble.position}`}
            animate={shouldReduceMotion ? undefined : bubble.animation}
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    duration: 12 + index * 1.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }
            }
          >
            <p className="text-base leading-relaxed font-medium italic text-white/90 sm:text-lg">
              {bubble.quote}
            </p>
            <p className="mt-3 block text-xs font-bold tracking-[0.16em] text-emerald-400 sm:text-sm">
              {bubble.label ?? `${bubble.name.toUpperCase()} - Lærer`}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Welcome modal removed; no onboarding modal shown */}

      <div className="relative z-20 mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 md:px-8 md:pt-6">
        <div className="mx-auto max-w-4xl">
          <MobileInSchoolBanner variant="home" />
        </div>
      </div>

      <main className="relative mx-auto flex w-full flex-1 flex-col justify-center px-4 py-8 md:hidden">
        <section className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg space-y-3">
            <div className="my-4 flex flex-wrap justify-center gap-3">
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
              <QRScannerModal />
            </div>
            <div className="rounded-3xl border border-emerald-500/30 bg-slate-950/80 p-5 shadow-[0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-xl">
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-center text-sm font-semibold tracking-wide text-slate-200">
                  Indtast løbskode
                </p>
                <input
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, "").slice(0, JOIN_PIN_LENGTH));
                    if (codeError) setCodeError("");
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={JOIN_PIN_LENGTH}
                  autoComplete="one-time-code"
                  placeholder="Indtast 6-cifret pinkode"
                  className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-5 text-center font-mono text-base font-black tracking-[0.16em] text-emerald-400 outline-none placeholder:font-sans placeholder:text-sm placeholder:font-semibold placeholder:tracking-normal placeholder:text-slate-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/25 sm:px-5 sm:py-6 sm:text-lg sm:placeholder:text-base"
                />
                <button
                  type="submit"
                  disabled={isJoining}
                  aria-busy={isJoining}
                  className="w-full rounded-3xl bg-emerald-500 px-6 py-8 text-3xl font-bold tracking-wide text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
                >
                  {isJoining ? "Åbner løbet..." : "Deltag"}
                </button>
                {codeError ? (
                  <p className="text-center text-sm font-semibold text-rose-200">{codeError}</p>
                ) : null}
              </form>
            </div>
            <div className="relative z-20 mt-6 flex flex-wrap justify-center gap-4 text-xs text-white/60 sm:gap-6 sm:text-sm">
              <Link href="/ophavsret" className="transition-colors hover:text-white">
                Ophavsret
              </Link>
              <Link href="/gdpr" className="transition-colors hover:text-white">
                GDPR & Privatliv
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-white">
                Databehandling
              </Link>
            </div>
            {!isNativeGpslobApp ? <OrganizerHint /> : null}
          </div>
        </section>
      </main>

      <main className="relative mx-auto hidden w-full max-w-lg flex-1 flex-col justify-center px-6 py-10 md:flex">
        <section className="space-y-6">
          <div className="flex justify-center">
            <div className="relative h-52 w-full max-w-75">
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
                  alt={"GPSLØB.DK logo"}
                  width={320}
                  height={140}
                  priority
                  className="h-auto w-full max-w-55 object-contain drop-shadow-[0_10px_20px_rgba(5,46,22,0.18)]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center">
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
          </div>

          <div className="rounded-3xl border border-emerald-500/30 bg-slate-950/80 p-8 text-center shadow-[0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-emerald-400">
              Til arrangører & lærere
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
              Byg aktive GPS-løb på minutter
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-300">
              Log ind for at oprette løb, hente resultater og styre klassen live. Elever deltager fra mobilen.
            </p>

            <Link
              href="/login"
              data-tour="home-organizer-login"
              className="mt-6 block w-full rounded-2xl bg-emerald-500 px-4 py-4 text-base font-black tracking-[0.08em] text-slate-950 shadow-[0_0_32px_rgba(16,185,129,0.28)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_44px_rgba(16,185,129,0.38)]"
            >
              Log ind
            </Link>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/gdpr"
                className="rounded-full border border-white/10 bg-white/4 px-3 py-2 transition-all hover:border-white/20 hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/50 uppercase sm:text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/80" />
                  <span>PRIVACY BY DESIGN</span>
                </span>
              </Link>

              <Link
                href="/privacy"
                className="rounded-full border border-white/10 bg-white/4 px-3 py-2 transition-all hover:border-white/20 hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/50 uppercase sm:text-xs">
                  <Lock className="h-3.5 w-3.5 text-emerald-300/80" />
                  <span>SIKKER DATABEHANDLING</span>
                </span>
              </Link>

              <Link
                href="/ophavsret"
                className="rounded-full border border-white/10 bg-white/4 px-3 py-2 transition-all hover:border-white/20 hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/50 uppercase sm:text-xs">
                  <FileCheck className="h-3.5 w-3.5 text-emerald-300/80" />
                  <span>COPYDAN-PARAT</span>
                </span>
              </Link>

              <Link
                href="/opdateringer"
                className="group relative block rounded-3xl border border-amber-400/20 bg-amber-400/6 px-4 py-3 transition-all hover:border-amber-400/30 hover:bg-amber-400/10"
              >
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.22em] text-amber-200/70 uppercase sm:text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-amber-300/90" />
                  <span>Seneste opdatering</span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                  </span>

                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold text-white sm:text-[15px]">
                      🚀 Version {latest.version}
                    </span>
                    <span className="mt-1 block text-xs font-medium tracking-wide text-amber-100/70 sm:text-[13px]">
                      {formatDisplayDate(latest.date)}
                    </span>
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <div className="hidden md:block">
        <AIChatButton />
      </div>
    </div>
  );
}
