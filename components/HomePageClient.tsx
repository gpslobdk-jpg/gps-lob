"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Compass, Menu, MapPin, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import Mascot from "@/components/brand/Mascot";
import RoutePath from "@/components/brand/RoutePath";
import MobileInSchoolBanner from "@/components/MobileInSchoolBanner";
import QRScannerModal from "@/components/QRScannerModal";
import { getSiteCopy } from "@/lib/siteCopy";
import type { SiteVariantKey } from "@/lib/siteVariant";

// WelcomeModal removed — onboarding flow deprecated

type HomePageClientProps = {
  isNativeGpslobApp: boolean;
  siteVariantKey: SiteVariantKey;
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

function HomeScenicBackground({ isPostlob }: { isPostlob: boolean }) {
  const desktopImage = isPostlob ? "/intro-poster.jpg" : "/brand/heroes/adventure-hero.webp";
  const mobileImage = isPostlob ? "/intro-poster.jpg" : "/brand/heroes/adventure-hero-mobile.webp";

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="home-static-background"
        className="fixed inset-0 -z-20 overflow-hidden bg-sky-100"
      >
        <Image
          src={desktopImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hidden object-cover object-center skolegps-scenic-drift md:block"
        />
        <Image
          src={mobileImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center skolegps-scenic-drift md:hidden"
        />
        {!isPostlob ? (
          <RoutePath className="skolegps-route-drift absolute bottom-[11%] right-[-9rem] h-28 w-[44rem] opacity-40 md:bottom-[13%] md:right-[8%] md:h-32 md:w-[50rem]" />
        ) : null}
      </div>
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.82)_42%,rgba(255,255,255,0.46)_75%,rgba(255,255,255,0.2)_100%)]" />
      <div className="fixed inset-x-0 bottom-0 -z-10 h-48 bg-[linear-gradient(0deg,rgba(244,251,255,1),transparent)]" />
    </>
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

function formatDebugBoolean(value: boolean) {
  return value ? "ja" : "nej";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden text-slate-950">
      <HomeScenicBackground isPostlob={siteVariantKey === "postlob"} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(34,164,71,0.12),transparent_30%)]" />
      {/* Welcome modal removed; no onboarding modal shown */}

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-3 rounded-full bg-white/82 px-4 py-2 shadow-sm backdrop-blur transition hover:bg-white">
          <Image
            src={siteVariantKey === "postlob" ? "/postlob-logo.png" : "/skolegps-logo.svg"}
            alt={homeCopy.logoAlt}
            width={256}
            height={72}
            priority
            className="h-auto w-48 sm:w-56"
          />
        </Link>
        <nav className="hidden items-center gap-5 lg:flex" aria-label="Hovedmenu">
          <Link href="#saadan-virker-det" className="text-sm font-bold text-slate-700 transition hover:text-sky-800">
            Sådan virker det
          </Link>
          <Link href="#laerervaerktoejer" className="text-sm font-bold text-slate-700 transition hover:text-sky-800">
            Lærerværktøjer
          </Link>
          <Link
            href="/login"
            data-tour="home-organizer-login"
            className="text-sm font-bold text-slate-700 transition hover:text-sky-800"
          >
            {homeCopy.desktop.loginButton}
          </Link>
          <Link
            href="/login?next=%2Fdashboard%2Fopret%2Fvalg"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(3,119,216,0.22)] transition hover:bg-sky-700"
          >
            Opret et løb
          </Link>
        </nav>
        <div className="relative lg:hidden">
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="home-mobile-menu"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-4 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(3,119,216,0.22)] transition hover:bg-sky-700"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            Menu
          </button>
          {isMobileMenuOpen ? (
            <div id="home-mobile-menu" className="absolute right-0 top-[calc(100%+0.6rem)] z-30 grid w-64 gap-1 rounded-2xl border border-sky-100 bg-white p-2 shadow-xl">
              <Link href="#saadan-virker-det" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-sky-50">
                Sådan virker det
              </Link>
              <Link href="#laerervaerktoejer" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-sky-50">
                Lærerværktøjer
              </Link>
              <Link href="/login" data-tour="home-organizer-login" className="rounded-xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-sky-50">
                {homeCopy.desktop.loginButton}
              </Link>
              <Link href="/login?next=%2Fdashboard%2Fopret%2Fvalg" className="rounded-xl bg-[var(--skolegps-blue-strong)] px-3 py-3 text-sm font-black text-white hover:bg-sky-700">
                Opret et løb
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pb-8 pt-1 sm:px-6 lg:px-8">
        <section className="pt-1">
          <MobileInSchoolBanner variant="home" />
        </section>
        <section className="grid items-center gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.34fr)] lg:py-14">
          <div className="max-w-3xl skolegps-soft-enter">
            <p className="inline-flex rounded-full border border-sky-200 bg-white/78 px-4 py-2 text-xs font-black uppercase text-sky-800 shadow-sm backdrop-blur">
              {homeCopy.desktop.organizerEyebrow}
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.98] text-[var(--skolegps-deep-navy)] drop-shadow-[0_10px_22px_rgba(255,255,255,0.65)] sm:text-6xl lg:text-7xl">
              {siteVariantKey === "postlob" ? homeCopy.desktop.organizerTitle : "Få undervisningen ud at gå"}
            </h1>
            <p className="mt-5 max-w-2xl text-xl font-black text-[var(--skolegps-navy)] sm:text-2xl">
              {siteVariantKey === "postlob"
                ? homeCopy.desktop.organizerDescription
                : "SkoleGPS gør det enkelt at bruge mobilen til en voksenstyret aktivitet uden for klasselokalet."}
            </p>
            <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-slate-700 sm:text-lg">
              Vælg et forløb, send klassen ud og følg med, når det giver mening.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/login?next=%2Fdashboard%2Fopret%2Fvalg"
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[var(--skolegps-green)] px-6 py-3 text-base font-black text-white shadow-[0_16px_32px_rgba(34,164,71,0.24)] transition hover:bg-green-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-green-600"
              >
                <MapPin className="h-5 w-5" aria-hidden="true" />
                Opret et løb
              </Link>
              <Link href="#laerervaerktoejer" className="inline-flex min-h-13 items-center justify-center px-3 py-3 text-base font-black text-sky-800 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-950">
                Se lærerværktøjer
              </Link>
              {siteVariantKey === "postlob" ? (
                <Link
                  href="/join"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-sky-200 bg-white/84 px-6 py-3 text-base font-black text-[var(--skolegps-deep-navy)] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                >
                  {homeCopy.desktop.joinButton}
                </Link>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-bold text-slate-600">Gratis undervisningsværktøj</p>

            <div id="saadan-virker-det" className="mt-10 grid scroll-mt-6 gap-3 sm:grid-cols-3">
              {[
                ["1. Vælg et forløb", "Start med det, du vil have klassen til at undersøge.", BookOpen],
                ["2. Send klassen ud", "Eleverne bruger ruten og opgaverne på stedet.", MapPin],
                ["3. Følg med", "Se den aktivitet, du har brug for at kunne se undervejs.", Compass],
              ].map(([title, text, Icon]) => (
                <div
                  key={title as string}
                  className="rounded-2xl border border-white/70 bg-white/72 p-4 shadow-sm backdrop-blur"
                >
                  <Icon className="h-5 w-5 text-sky-700" aria-hidden="true" />
                  <p className="mt-3 text-sm font-black text-[var(--skolegps-deep-navy)]">
                    {title as string}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{text as string}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden min-h-[19rem] lg:block">
            <RoutePath className="absolute left-[-10%] top-28 h-24 w-[125%] opacity-50" />
            {siteVariantKey !== "postlob" ? (
              <div className="absolute right-4 top-9 rounded-3xl border border-white/70 bg-white/76 p-5 shadow-sm backdrop-blur">
                <Mascot variant="wave" size="md" priority className="mx-auto" />
                <p className="mt-2 max-w-44 text-center text-sm font-bold leading-5 text-slate-700">
                  Klar til at tage læringen med udenfor?
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section id="laerervaerktoejer" className="mt-8 grid scroll-mt-6 gap-5 rounded-3xl border border-sky-100 bg-white/76 p-6 shadow-sm backdrop-blur sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
          <div>
            <div className="flex items-center gap-3 text-sky-800">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <p className="text-xs font-black tracking-[0.18em] uppercase">Lærerværktøjer</p>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">
              Planlæg, start og behold overblikket
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Byg et forløb i ro, start det med klassen og brug kun de værktøjer, der hjælper undervejs.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <Link href="/login?next=%2Fdashboard%2Flaerervaerktoejer" className="inline-flex min-h-11 items-center justify-center rounded-full border border-sky-200 bg-white px-5 py-2 text-sm font-black text-sky-800 transition hover:border-sky-300 hover:bg-sky-50">
              Åbn lærerværktøjer
            </Link>
            <Link href="/join" className="text-sm font-bold text-slate-600 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-800">
              Deltag i et løb som elev
            </Link>
            {siteVariantKey === "postlob" ? (
              <QRScannerModal buttonClassName="justify-center py-3 text-sm" copy={siteCopy.qrScanner} />
            ) : null}
          </div>
        </section>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-3 py-8 text-xs font-semibold text-slate-600">
          <Link href="/om" className="transition hover:text-sky-800">Om SkoleGPS</Link>
          <Link href="/gdpr" className="transition hover:text-sky-800">{homeCopy.legalLinks.gdpr}</Link>
          <Link href="/privacy" className="transition hover:text-sky-800">{homeCopy.legalLinks.privacy}</Link>
          <Link href="/it-afdelinger" className="transition hover:text-sky-800">Til IT og databeskyttelse</Link>
          <Link href="/ophavsret" className="transition hover:text-sky-800">Ophavsret</Link>
          <span className="basis-full text-slate-500">© 2026 SkoleGPS · Gratis undervisningsværktøj</span>
        </footer>
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
