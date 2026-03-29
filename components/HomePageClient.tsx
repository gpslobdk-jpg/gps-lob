"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import Lottie from "lottie-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import AIChatButton from "@/components/AIChatButton";
import natureAnimation from "@/public/nature.json";

// WelcomeModal removed — onboarding flow deprecated

type HomePageClientProps = {
  isNativeGpslobApp: boolean;
};

const testimonials = [
  {
    name: "Eva Marie",
    role: "L\u00e6rer",
    quote:
      "Jeg har testet det med min klasse og jeg er mindblown - G.E.N.I.A.L.T! AI-sp\u00f8rgsm\u00e5lsgeneratoren fungerede over al forventning.",
  },
  {
    name: "Karsten",
    role: "L\u00e6rer",
    quote:
      "Det her er ret fedt! Og Jeppe reagerer lynhurtigt, hvis man melder fejl. Det er virkelig v\u00e6rd at bruge.",
  },
  {
    name: "Thomas",
    role: "L\u00e6rer",
    quote:
      "Det ser super fint ud. Jeg gl\u00e6der mig helt vildt til at pr\u00f8ve det af i praksis.",
  },
  {
    name: "Julie",
    role: "L\u00e6rer",
    quote: "Ej, det vil jeg da ogs\u00e5 mega gerne pr\u00f8ve med mine elever!",
  },
  {
    name: "Christell",
    role: "L\u00e6rer",
    quote: "A-MAZING! \ud83d\udc4f\ud83c\udffb",
  },
  {
    name: "Mette",
    role: "L\u00e6rer",
    quote: "Ser sp\u00e6ndende ud \ud83d\udc40 \u2b50\u2b50\u2b50\u2b50\u2b50",
  },
] as const;

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
              "Er du arrang\u00f8r eller l\u00e6rer, der skal oprette et l\u00f8b? \u{1F6E0}\uFE0F S\u00e5 skal du hoppe over p\u00e5 en computer p\u00e5 gpslob.dk. Her p\u00e5 mobilen kan du kun deltage i l\u00f8b."
            }
          </span>
        </p>
      </div>
    </div>
  );
}

export default function HomePageClient({ isNativeGpslobApp }: HomePageClientProps) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [, setShowIntroToken] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.16),transparent_35%),radial-gradient(circle_at_85%_95%,rgba(14,165,233,0.1),transparent_40%),radial-gradient(rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:100%_100%,100%_100%,20px_20px] lg:hidden" />

      {/* Welcome modal removed; no onboarding modal shown */}

      <main className="relative mx-auto flex w-full flex-1 flex-col justify-center px-4 py-8 md:hidden">
        <section className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg space-y-3">
            <div className="rounded-3xl border border-emerald-500/30 bg-slate-950/80 p-5 shadow-[0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-xl">
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-center text-sm font-semibold tracking-wide text-slate-200">
                  Indtast løbskode
                </p>
                <input
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 5));
                    if (codeError) setCodeError("");
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  placeholder="Indtast løbskode"
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
            {!isNativeGpslobApp ? <OrganizerHint /> : null}
          </div>
        </section>
      </main>

      <main className="relative mx-auto hidden w-full max-w-lg flex-1 flex-col justify-center px-6 py-10 md:flex">
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

          <div className="rounded-3xl border border-emerald-500/30 bg-slate-950/80 p-8 text-center shadow-[0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-emerald-400">
              Til arrangører &amp; lærere
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
          </div>
        </section>
      </main>

      <section className="relative z-20 mx-auto hidden w-full max-w-6xl px-6 pb-6 lg:block">
        <div className="mb-4 flex items-center justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/70">
              Det siger l\u00e6rerne
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              Social proof med ro i samme visuelle tone
            </h2>
          </div>
          <p className="max-w-md text-right text-sm leading-6 text-slate-300/80">
            Erfaringer fra undervisere, der allerede har pr\u00f8vet GPSL\u00d8B.DK i praksis.
          </p>
        </div>

        <div className="overflow-hidden rounded-4xl border border-emerald-500/15 bg-slate-950/35 p-3 shadow-[0_0_48px_rgba(16,185,129,0.08)] backdrop-blur-sm">
          <motion.div
            className="flex w-max gap-4"
            animate={shouldReduceMotion ? undefined : { x: ["0%", "-50%"] }}
            transition={
              shouldReduceMotion
                ? undefined
                : { duration: 38, ease: "linear", repeat: Infinity }
            }
          >
            {[0, 1].map((copyIndex) => (
              <div
                key={copyIndex}
                className="flex shrink-0 gap-4 pr-4"
                aria-hidden={copyIndex === 1}
              >
                {testimonials.map((testimonial) => (
                  <article
                    key={`${copyIndex}-${testimonial.name}`}
                    className="flex min-h-56 w-88 flex-col justify-between rounded-[1.75rem] border border-emerald-500/20 bg-slate-900/40 p-5 shadow-[0_0_28px_rgba(16,185,129,0.08)] backdrop-blur-xl"
                  >
                    <blockquote className="text-base leading-7 text-slate-100 italic">
                      \u201c{testimonial.quote}\u201d
                    </blockquote>
                    <div className="mt-5 border-t border-white/8 pt-4 text-sm text-slate-300/72">
                      <p className="font-semibold text-emerald-200/88">{testimonial.name}</p>
                      <p className="mt-1 uppercase tracking-[0.18em] text-[11px] text-slate-400/85">
                        {testimonial.role}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

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
