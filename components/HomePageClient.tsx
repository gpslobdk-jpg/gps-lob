"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileCheck, Lock, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Lottie from "lottie-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import AIChatButton from "@/components/AIChatButton";
import MobileInSchoolBanner from "@/components/MobileInSchoolBanner";
import QRScannerModal from "@/components/QRScannerModal";
import natureAnimation from "@/public/nature.json";

// WelcomeModal removed — onboarding flow deprecated

type HomePageClientProps = {
  isNativeGpslobApp: boolean;
};

const zenBubbles = [
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

export default function HomePageClient({ isNativeGpslobApp }: HomePageClientProps) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [legalModal, setLegalModal] = useState<"ophavsret" | "gdpr" | "databehandling" | null>(null);
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

  const legalModalContent = (() => {
    switch (legalModal) {
      case "ophavsret":
        return {
          title: "Ophavsret",
          body: "Her kommer teksten om ophavsret, brug af materialer og ansvarlig anvendelse af indhold i GPSLOB.DK.",
        };
      case "gdpr":
        return {
          title: "GDPR & Privatliv",
          body: "Her kommer teksten om GDPR, privatliv, datasikkerhed og hvordan personoplysninger behandles i GPSLOB.DK.",
        };
      case "databehandling":
        return {
          title: "Databehandling",
          body: "Her kommer teksten om databehandling, opbevaring, sletning og de praktiske rammer for behandling af data i GPSLOB.DK.",
        };
      default:
        return null;
    }
  })();

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
            className={`absolute max-w-[200px] bg-transparent p-4 ${bubble.position}`}
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
              {bubble.name.toUpperCase()} - Lærer
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
            <div className="relative z-20 mt-6 flex flex-wrap justify-center gap-4 text-xs text-white/60 sm:gap-6 sm:text-sm">
              <button
                type="button"
                onClick={() => setLegalModal("ophavsret")}
                className="transition-colors hover:text-white"
              >
                Ophavsret
              </button>
              <button
                type="button"
                onClick={() => setLegalModal("gdpr")}
                className="transition-colors hover:text-white"
              >
                GDPR & Privatliv
              </button>
              <button
                type="button"
                onClick={() => setLegalModal("databehandling")}
                className="transition-colors hover:text-white"
              >
                Databehandling
              </button>
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
              <button
                type="button"
                onClick={() => setLegalModal("gdpr")}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 transition-all cursor-pointer hover:border-white/20 hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/50 uppercase sm:text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/80" />
                  <span>PRIVACY BY DESIGN</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLegalModal("databehandling")}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 transition-all cursor-pointer hover:border-white/20 hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/50 uppercase sm:text-xs">
                  <Lock className="h-3.5 w-3.5 text-emerald-300/80" />
                  <span>SIKKER DATABEHANDLING</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLegalModal("ophavsret")}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 transition-all cursor-pointer hover:border-white/20 hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/50 uppercase sm:text-xs">
                  <FileCheck className="h-3.5 w-3.5 text-emerald-300/80" />
                  <span>COPYDAN-PARAT</span>
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {legalModal && legalModalContent ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setLegalModal(null)}
        >
          <div
            className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-emerald-800/50 bg-emerald-950/95 p-8 text-white shadow-2xl backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Luk juridisk modal"
              onClick={() => setLegalModal(null)}
              className="absolute top-4 right-4 text-xl font-semibold text-white/70 transition-colors hover:text-white"
            >
              X
            </button>
            <div className="mt-2 text-left">
              {legalModal === "ophavsret" ? (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white">Ophavsret &amp; Eksemplarfremstilling</h2>
                  <p className="text-sm leading-7 text-white/80 sm:text-base">
                    GPSLØB.DK opererer udelukkende som en digital facilitator for undervisere (Zero Data
                    Retention). Vi bygger ikke et bibliotek og lagrer ikke ophavsretligt beskyttede tekster eller
                    billeder på vores servere efter endt AI-bearbejdning.
                  </p>
                  <p className="text-sm leading-7 text-white/80 sm:text-base">
                    Brugen af platformens tekst- og billedscanningsværktøjer forudsætter, at den enkelte bruger
                    (underviseren) har rettighederne til at digitalisere det pågældende materiale, eller at brugen
                    er dækket af institutionens gældende aftaler med Copydan Tekst &amp; Node for den pågældende
                    klasse. Ansvaret for eksemplarfremstillingen påhviler brugeren.
                  </p>
                </div>
              ) : legalModal === "gdpr" ? (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white">GDPR &amp; Privatlivspolitik</h2>
                  <p className="text-sm leading-7 text-white/80 sm:text-base">
                    GPSLØB.DK er designet med Privacy by Design. Elever kan deltage i løb fuldstændig anonymt via
                    en adgangskode uden behov for at oprette en brugerprofil. Vi indsamler ingen personfølsomme
                    oplysninger (PII) om eleverne.
                  </p>
                  <p className="text-sm leading-7 text-white/80 sm:text-base">
                    For lærere og arrangører behandler vi udelukkende de data (navn og e-mail), der er strengt
                    nødvendige for at levere tjenesten, jf. Databeskyttelsesforordningens (GDPR) art. 6, stk. 1,
                    litra b. Data videregives aldrig til tredjepart med henblik på markedsføring.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white">Databehandleraftale &amp; AI-Infrastruktur</h2>
                  <p className="text-sm leading-7 text-white/80 sm:text-base">
                    For skoler og kommuner, der opretter institutionsaftaler, fungerer GPSLØB.DK som
                    Databehandler. Al infrastruktur og datalagring hostes inden for EU/EØS på sikre servere.
                  </p>
                  <p className="text-sm leading-7 text-white/80 sm:text-base">
                    Platformen integrerer med underdatabehandlere (LLM-udbydere) for at muliggøre automatisk
                    spørgsmålsgenerering. Disse integrationer foretages udelukkende via lukkede Enterprise-API&apos;er,
                    hvilket sikrer, at brugerens input-data (tekster, prompts) aldrig anvendes til at træne
                    offentlige sprogmodeller.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="hidden md:block">
        <AIChatButton />
      </div>
    </div>
  );
}
