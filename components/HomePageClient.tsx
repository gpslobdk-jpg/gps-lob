"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileCheck, Lock, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Lottie from "lottie-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import MobileInSchoolBanner from "@/components/MobileInSchoolBanner";
import QRScannerModal from "@/components/QRScannerModal";
import { getSiteCopy } from "@/lib/siteCopy";
import type { SiteVariantKey } from "@/lib/siteVariant";
import natureAnimation from "@/public/nature.json";

// WelcomeModal removed — onboarding flow deprecated

type HomePageClientProps = {
  isNativeGpslobApp: boolean;
  siteVariantKey: SiteVariantKey;
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

type CapacitorDebugBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

type HomePageWindow = Window & {
  Capacitor?: CapacitorDebugBridge;
};

type NativeDebugSnapshot = {
  isNativeGpslobAppProp: boolean;
  isCapacitorAppState: boolean;
  capacitorType: string;
  hasCapacitor: boolean;
  capacitorPlatform: string;
  capacitorIsNativePlatform: string;
  userAgent: string;
  isStandaloneDisplayMode: boolean;
  href: string;
};

const latest = {
  version: "19/6",
  date: "2026-06-19",
  dateLabel: "19. juni 2026",
  type: "minor",
  title: "GPSLøb bliver til SkoleGPS.dk",
  summary:
    "Nyt navn, samme funktioner: GPSLøb har fået nyt domæne, SkoleGPS.dk. Dine løb, login og arkiv fortsætter.",
  items: [
    {
      title: "Samme platform og samme funktioner",
      description:
        "Du kan stadig oprette løb, bruge QR-koder, følge klassen live og finde tidligere løb i arkivet.",
    },
    {
      title: "Brug SkoleGPS.dk fremover",
      description:
        "gpslob.dk virker fortsat i en overgangsperiode, men vi anbefaler lærere at bruge skolegps.dk fremover.",
    },
  ],
};

const SKOLEGPS_FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/1649785632764130";
const FACEBOOK_GROUP_MODAL_STORAGE_KEY = "skolegps-facebook-group-2026-dismissed";

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
    quote: "Ser spændende ud. Det bliver godt at bruge i praksis.",
    position: "bottom-[13%] right-[14%]",
    animation: {
      y: [0, 11, 0, -6, 0],
      x: [0, -4, 0, 5, 0],
      rotate: [0, -1, 0, 1.2, 0],
    },
  },
];

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

function formatDebugBoolean(value: boolean) {
  return value ? "ja" : "nej";
}

function FacebookGroupModal({ shouldShow }: { shouldShow: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!shouldShow) {
        setIsOpen(false);
        return;
      }

      try {
        setIsOpen(window.localStorage.getItem(FACEBOOK_GROUP_MODAL_STORAGE_KEY) !== "true");
      } catch {
        setIsOpen(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [shouldShow]);

  const handleClose = () => {
    try {
      window.localStorage.setItem(FACEBOOK_GROUP_MODAL_STORAGE_KEY, "true");
    } catch {
      // If storage is blocked, the close button should still work for this visit.
    }

    setIsOpen(false);
  };

  if (!shouldShow || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/72 px-4 py-6 text-slate-950 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="facebook-group-modal-title"
        className="w-full max-w-lg rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_24px_80px_rgba(2,6,23,0.38)] sm:p-7"
      >
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
          Fællesskab for lærere
        </p>
        <h2
          id="facebook-group-modal-title"
          className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl"
        >
          Følg med i SkoleGPS-gruppen
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
          Meld dig ind i Facebook-gruppen skolegps.dk, hvor lærere kan få nyheder,
          dele erfaringer, følge udviklingen og ønske nye funktioner.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <a
            href={SKOLEGPS_FACEBOOK_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-500"
            onClick={handleClose}
          >
            Gå til Facebook-gruppen
          </a>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-emerald-200 hover:text-emerald-800"
          >
            Ikke nu
          </button>
        </div>
      </section>
    </div>
  );
}

function shouldRedirectMobileRootToJoin(
  browserWindow: HomePageWindow,
  isNativeGpslobApp: boolean
) {
  if (browserWindow.location.pathname !== "/") {
    return false;
  }

  const params = new URLSearchParams(browserWindow.location.search);
  if (params.has("code")) {
    return false;
  }

  const userAgent = browserWindow.navigator.userAgent;
  const isCapacitorApp = typeof browserWindow.Capacitor !== "undefined";
  const isMobileBrowser =
    /iPad|iPhone|iPod|Android/i.test(userAgent) ||
    (browserWindow.navigator.platform === "MacIntel" &&
      browserWindow.navigator.maxTouchPoints > 1);

  return (
    isMobileBrowser &&
    !isNativeGpslobApp &&
    !isCapacitorApp &&
    !userAgent.includes("GPSLobApp")
  );
}

function NativeDebugPanel({ snapshot }: { snapshot: NativeDebugSnapshot }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[2200] p-3 sm:p-4">
      <div className="mx-auto max-w-5xl rounded-2xl border border-amber-300/30 bg-slate-950/92 p-4 text-xs text-amber-50 shadow-[0_20px_50px_rgba(2,6,23,0.5)] backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-amber-200/85">
          <span>Native debug</span>
          <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[10px]">
            debugNative=1
          </span>
        </div>

        <div className="grid gap-2 font-mono text-[11px] leading-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>isNativeGpslobApp prop: {String(snapshot.isNativeGpslobAppProp)}</div>
          <div>isCapacitorApp state: {String(snapshot.isCapacitorAppState)}</div>
          <div>typeof window.Capacitor: {snapshot.capacitorType}</div>
          <div>window.Capacitor findes: {formatDebugBoolean(snapshot.hasCapacitor)}</div>
          <div>Capacitor.getPlatform(): {snapshot.capacitorPlatform}</div>
          <div>Capacitor.isNativePlatform(): {snapshot.capacitorIsNativePlatform}</div>
          <div>display-mode standalone: {String(snapshot.isStandaloneDisplayMode)}</div>
          <div className="sm:col-span-2 lg:col-span-3 break-all">navigator.userAgent: {snapshot.userAgent}</div>
          <div className="sm:col-span-2 lg:col-span-3 break-all">window.location.href: {snapshot.href}</div>
        </div>
      </div>
    </div>
  );
}

export default function HomePageClient({ isNativeGpslobApp, siteVariantKey }: HomePageClientProps) {
  const siteCopy = getSiteCopy(siteVariantKey);
  const homeCopy = siteCopy.home;
  const [isCapacitorApp, setIsCapacitorApp] = useState(isNativeGpslobApp);
  const [shouldUseLightMobileRoot, setShouldUseLightMobileRoot] = useState<boolean | null>(
    isNativeGpslobApp ? false : null
  );
  const [nativeDebugSnapshot, setNativeDebugSnapshot] = useState<NativeDebugSnapshot | null>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileRootRedirectStartedRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("code")) return;

    const fallbackId = window.setTimeout(() => {
      setShouldUseLightMobileRoot(false);
    }, 500);

    const callbackUrl = new URL("/api/auth/callback", window.location.origin);
    callbackUrl.search = params.toString();
    if (!callbackUrl.searchParams.get("next")) {
      callbackUrl.searchParams.set("next", "/dashboard");
    }

    window.location.replace(callbackUrl.toString());

    return () => window.clearTimeout(fallbackId);
  }, []);

  useEffect(() => {
    const browserWindow = window as HomePageWindow;
    const nextShouldUseLightMobileRoot = shouldRedirectMobileRootToJoin(
      browserWindow,
      isNativeGpslobApp
    );

    if (nextShouldUseLightMobileRoot) {
      if (!mobileRootRedirectStartedRef.current) {
        mobileRootRedirectStartedRef.current = true;
        window.location.replace("/join");
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldUseLightMobileRoot(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isNativeGpslobApp]);

  useEffect(() => {
    if (shouldUseLightMobileRoot !== false) return;

    const video = backgroundVideoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    void video.play().catch(() => undefined);
  }, [shouldUseLightMobileRoot]);

  useEffect(() => {
    const browserWindow = window as HomePageWindow;
    const capacitor = browserWindow.Capacitor;
    const nextIsCapacitorApp = typeof capacitor !== "undefined";

    const params = new URLSearchParams(browserWindow.location.search);
    let nextNativeDebugSnapshot: NativeDebugSnapshot | null = null;

    if (params.get("debugNative") === "1") {
      let capacitorPlatform = "ikke tilgaengelig";
      if (typeof capacitor?.getPlatform === "function") {
        try {
          capacitorPlatform = capacitor.getPlatform();
        } catch {
          capacitorPlatform = "fejl";
        }
      }

      let capacitorIsNativePlatform = "ikke tilgaengelig";
      if (typeof capacitor?.isNativePlatform === "function") {
        try {
          capacitorIsNativePlatform = String(capacitor.isNativePlatform());
        } catch {
          capacitorIsNativePlatform = "fejl";
        }
      }

      nextNativeDebugSnapshot = {
        isNativeGpslobAppProp: isNativeGpslobApp,
        isCapacitorAppState: nextIsCapacitorApp,
        capacitorType: typeof capacitor,
        hasCapacitor: typeof capacitor !== "undefined",
        capacitorPlatform,
        capacitorIsNativePlatform,
        userAgent: navigator.userAgent,
        isStandaloneDisplayMode: window.matchMedia("(display-mode: standalone)").matches,
        href: browserWindow.location.href,
      };
    }

    const updateId = window.setTimeout(() => {
      setIsCapacitorApp(nextIsCapacitorApp);
      setNativeDebugSnapshot(nextNativeDebugSnapshot);
    }, 0);

    return () => window.clearTimeout(updateId);
  }, [isNativeGpslobApp]);

  const handleAppReady = () => {
    router.push("/join");
  };

  if (shouldUseLightMobileRoot !== false) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-sm font-semibold tracking-[0.18em] text-emerald-100 uppercase">
          Aabner elevstart...
        </div>
        {nativeDebugSnapshot ? <NativeDebugPanel snapshot={nativeDebugSnapshot} /> : null}
      </>
    );
  }

  const pageContent = isCapacitorApp ? (
    <NativeAppWelcome
      onReady={handleAppReady}
      shouldReduceMotion={Boolean(shouldReduceMotion)}
    />
  ) : (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden text-slate-100">
      <FacebookGroupModal shouldShow={siteVariantKey === "gpslob"} />
        {siteVariantKey !== "postlob" ? (
          <video
            ref={backgroundVideoRef}
            src="/skolegpsforside.mp4"
            autoPlay
            muted
            loop
            playsInline
            poster="/intro-poster.jpg"
            preload="auto"
            className="fixed top-0 left-0 h-full w-full object-cover -z-20"
          />
        ) : (
          <>
            <div
              aria-hidden="true"
              className="fixed inset-0 -z-20 hidden lg:block pointer-events-none"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-sky-900/60 to-slate-950/90" />

              <svg
                viewBox="0 0 1200 600"
                preserveAspectRatio="xMidYMid slice"
                className="w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-hidden="true"
              >
                <path
                  d="M100 480 C 300 380 500 300 700 260 C 880 230 1000 160 1100 120"
                  fill="none"
                  stroke="rgba(148,163,184,0.12)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute left-[12%] top-[72%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/90 shadow-[0_0_14px_rgba(45,212,191,0.4)] animate-pulse" />
              <div className="absolute left-[40%] top-[60%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/90 shadow-[0_0_14px_rgba(125,211,252,0.4)] animate-pulse" />
              <div className="absolute left-[65%] top-[45%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/90 shadow-[0_0_14px_rgba(253,224,71,0.4)] animate-pulse" />
              <div className="absolute left-[82%] top-[30%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/90 shadow-[0_0_14px_rgba(103,232,249,0.4)] animate-pulse" />

              <div className="postlob-moving-dot" />

              <style>{`
                .postlob-moving-dot{
                  position:absolute;
                  left:12%;
                  top:72%;
                  width:10px;
                  height:10px;
                  border-radius:9999px;
                  transform:translate(-50%,-50%);
                  background:linear-gradient(90deg,#7ee3d3,#60a5fa);
                  box-shadow:0 0 18px rgba(96,165,250,0.35);
                  animation:postlob-move 5s linear infinite;
                }
                @keyframes postlob-move {
                  0% { left:12%; top:72% }
                  25% { left:40%; top:60% }
                  50% { left:65%; top:45% }
                  75% { left:82%; top:30% }
                  100% { left:12%; top:72% }
                }
                @media (prefers-reduced-motion: reduce) {
                  .postlob-moving-dot, .animate-pulse { animation: none !important; }
                }
              `}</style>
            </div>

            <div
              aria-hidden="true"
              className="fixed top-0 left-0 h-full w-full -z-20 bg-cover bg-center bg-[url('/intro-poster.jpg')] lg:hidden"
            />
          </>
        )}
      <div className="fixed inset-0 -z-10 bg-slate-950/70 backdrop-blur-[2px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.16),transparent_35%),radial-gradient(circle_at_85%_95%,rgba(14,165,233,0.1),transparent_40%),radial-gradient(rgba(148,163,184,0.08)_1px,transparent_1px)] bg-size-[100%_100%,100%_100%,20px_20px] lg:hidden" />
      <div className="pointer-events-none fixed inset-0 -z-10 hidden lg:block">
        {homeCopy.showTestimonials ? zenBubbles.map((bubble, index) => (
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
        )) : null}
      </div>

      {/* Welcome modal removed; no onboarding modal shown */}

      {homeCopy.showDanishOnlyExtras ? (
        <div className="relative z-20 mx-auto hidden w-full max-w-6xl px-4 pt-4 sm:px-6 md:block md:px-8 md:pt-6">
          <div className="mx-auto max-w-4xl">
            <MobileInSchoolBanner variant="home" />
          </div>
        </div>
      ) : null}

      <main className="relative mx-auto flex w-full flex-1 flex-col justify-center px-4 py-8 md:hidden">
        <section className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/78 p-6 text-center shadow-[0_18px_50px_rgba(2,6,23,0.38)] backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
                {homeCopy.brandLabel}
              </p>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                {homeCopy.mobile.title}
              </h1>
            </div>

            <div className="rounded-[2rem] border border-emerald-400/25 bg-slate-950/82 p-6 shadow-[0_18px_50px_rgba(16,185,129,0.14)] backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/75">
                {homeCopy.mobile.studentEyebrow}
              </p>
              <p className="mt-3 text-base leading-7 text-slate-100/92">
                {homeCopy.mobile.studentDescription}
              </p>

              <div className="mt-5 space-y-3">
                <QRScannerModal buttonClassName="w-full justify-center py-4 text-sm" copy={siteCopy.qrScanner} />

                <Link
                  href="/join"
                  className="flex min-h-[56px] w-full items-center justify-center rounded-[1.4rem] border border-white/12 bg-white/6 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:border-white/20 hover:bg-white/10"
                >
                    {homeCopy.mobile.joinCodeButton}
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-950/74 p-6 shadow-[0_18px_50px_rgba(2,6,23,0.3)] backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/75">
                {homeCopy.mobile.teacherEyebrow}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-200/88">
                {homeCopy.mobile.teacherDescription}
              </p>

              <Link
                href="/login"
                className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-[1.4rem] border border-sky-200/18 bg-sky-200/8 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-sky-50 transition hover:border-sky-200/28 hover:bg-sky-200/12"
              >
                {homeCopy.mobile.loginButton}
              </Link>
            </div>
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
                  src={siteVariantKey === "postlob" ? "/postlob-logo.png" : "/skolegps-logo.svg"}
                  alt={homeCopy.logoAlt}
                  width={320}
                  height={140}
                  priority
                  className="h-auto w-full max-w-55 object-contain drop-shadow-[0_10px_20px_rgba(5,46,22,0.18)]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-500/30 bg-slate-950/80 p-8 text-center shadow-[0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-emerald-400">
              {homeCopy.desktop.organizerEyebrow}
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
              {homeCopy.desktop.organizerTitle}
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-300">
              {homeCopy.desktop.organizerDescription}
            </p>

            {homeCopy.showDanishOnlyExtras ? (
              <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-4 text-left">
                <p className="text-sm font-black leading-6 text-emerald-50">
                  GPSLøb bliver til SkoleGPS.dk
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Nyt navn, samme funktioner. Dine løb, login og arkiv fortsætter, og
                  gpslob.dk virker stadig i en overgangsperiode.
                </p>
              </div>
            ) : null}

            <Link
              href="/login"
              data-tour="home-organizer-login"
              className="mt-6 block w-full rounded-2xl bg-emerald-500 px-4 py-4 text-base font-black tracking-[0.08em] text-slate-950 shadow-[0_0_32px_rgba(16,185,129,0.28)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_44px_rgba(16,185,129,0.38)]"
            >
              {homeCopy.desktop.loginButton}
            </Link>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/gdpr"
                className="rounded-full border border-white/10 bg-white/4 px-3 py-2 transition-all hover:border-white/20 hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/50 uppercase sm:text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/80" />
                  <span>{homeCopy.legalLinks.gdpr}</span>
                </span>
              </Link>

              <Link
                href="/privacy"
                className="rounded-full border border-white/10 bg-white/4 px-3 py-2 transition-all hover:border-white/20 hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/50 uppercase sm:text-xs">
                  <Lock className="h-3.5 w-3.5 text-emerald-300/80" />
                  <span>{homeCopy.legalLinks.privacy}</span>
                </span>
              </Link>

              <Link
                href="/ophavsret"
                className="rounded-full border border-white/10 bg-white/4 px-3 py-2 transition-all hover:border-white/20 hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/50 uppercase sm:text-xs">
                  <FileCheck className="h-3.5 w-3.5 text-emerald-300/80" />
                  <span>{homeCopy.legalLinks.ophavsret}</span>
                </span>
              </Link>

              {homeCopy.showDanishOnlyExtras ? (
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
                      Version {latest.version}
                    </span>
                    <span className="mt-1 block text-xs font-medium tracking-wide text-amber-100/70 sm:text-[13px]">
                      {latest.dateLabel ?? formatDisplayDate(latest.date)}
                    </span>
                    <span className="mt-2 block text-xs font-semibold leading-5 text-white/90 sm:text-sm">
                      {latest.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-amber-100/70">
                      {latest.summary}
                    </span>
                  </span>
                </div>
              </Link>
              ) : null}
            </div>
          </div>
        </section>
      </main>

    </div>
  );

  return (
    <>
      {pageContent}
      {nativeDebugSnapshot ? <NativeDebugPanel snapshot={nativeDebugSnapshot} /> : null}
    </>
  );
}
