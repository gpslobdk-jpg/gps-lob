"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AutumnPortalMascot } from "@/components/pwa/GoldenPortalVisuals";
import {
  STUDENT_AUTUMN_PORTAL_LAUNCH_KEY,
  STUDENT_AUTUMN_PORTAL_SESSION_KEY,
} from "@/lib/studentExperienceSeason";

const JOIN_FLOW_ACTIVE_EVENT = "skolegps:join-flow-active";
const INTRO_TOTAL_MS = 5_000;
const PORTAL_EXIT_MS = 220;

type IntroStep = 0 | 1 | 2 | 3 | 4;

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isStandaloneStudentPwa() {
  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(navigatorWithStandalone.standalone)
  );
}

function isNativeCapacitorApp() {
  return typeof (window as Window & { Capacitor?: unknown }).Capacitor !== "undefined";
}

function readSessionValue(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // A locked-down browser may show the skippable intro again on reload, but
    // never loses access to the real entry actions.
  }
}

function hasFreshStandaloneLaunch() {
  try {
    return window.sessionStorage.getItem(STUDENT_AUTUMN_PORTAL_LAUNCH_KEY) === "fresh";
  } catch {
    return false;
  }
}

function consumeFreshStandaloneLaunch() {
  if (!hasFreshStandaloneLaunch()) {
    return false;
  }

  try {
    window.sessionStorage.removeItem(STUDENT_AUTUMN_PORTAL_LAUNCH_KEY);
  } catch {
    return false;
  }

  return true;
}

export default function GoldenPortalIntro({
  initialEligibility,
}: {
  initialEligibility: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [step, setStep] = useState<IntroStep>(0);
  const initialEligibilityRef = useRef(initialEligibility);
  const skipButtonRef = useRef<HTMLButtonElement | null>(null);

  const dismiss = useCallback(() => {
    setIsDismissing(true);
  }, []);

  const dismissImmediately = useCallback(() => {
    setIsDismissing(false);
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (reduceMotion === null) {
      return;
    }

    const hasFreshLaunch = hasFreshStandaloneLaunch();
    if (
      !initialEligibilityRef.current ||
      reduceMotion ||
      !isStandaloneStudentPwa() ||
      isNativeCapacitorApp() ||
      readSessionValue(STUDENT_AUTUMN_PORTAL_SESSION_KEY) ||
      !hasFreshLaunch
    ) {
      if (hasFreshLaunch) {
        consumeFreshStandaloneLaunch();
      }
      return;
    }

    const showFrame = window.requestAnimationFrame(() => {
      // Strict Mode can replay this effect before a frame runs. Consume only
      // when the visible opening is actually committed, so its replay still
      // receives the same one-time launch signal.
      if (!consumeFreshStandaloneLaunch()) {
        return;
      }
      writeSessionValue(STUDENT_AUTUMN_PORTAL_SESSION_KEY, "seen");
      setIsVisible(true);
    });

    return () => window.cancelAnimationFrame(showFrame);
  }, [reduceMotion]);

  useEffect(() => {
    if (!isVisible || !isDismissing) {
      return;
    }

    const exitTimer = window.setTimeout(() => {
      setIsDismissing(false);
      setIsVisible(false);
    }, PORTAL_EXIT_MS);

    return () => window.clearTimeout(exitTimer);
  }, [isDismissing, isVisible]);

  useEffect(() => {
    if (!isVisible || isDismissing) {
      return;
    }

    const timers = [
      window.setTimeout(() => setStep(1), 1_000),
      window.setTimeout(() => setStep(2), 2_000),
      window.setTimeout(() => setStep(3), 3_200),
      window.setTimeout(() => setStep(4), 4_300),
      window.setTimeout(dismiss, INTRO_TOTAL_MS),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismiss, isDismissing, isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const handleJoinFlowActive = () => dismissImmediately();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        dismissImmediately();
      }
    };
    window.addEventListener(JOIN_FLOW_ACTIVE_EVENT, handleJoinFlowActive);
    window.addEventListener("pagehide", dismissImmediately);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(JOIN_FLOW_ACTIVE_EVENT, handleJoinFlowActive);
      window.removeEventListener("pagehide", dismissImmediately);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dismissImmediately, isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const entrySurface = document.querySelector<HTMLElement>("#student-join-surface");
    const previousOverflow = document.body.style.overflow;
    const previouslyHadAriaHidden = entrySurface?.hasAttribute("aria-hidden") ?? false;
    const previousAriaHidden = entrySurface?.getAttribute("aria-hidden") ?? null;

    entrySurface?.setAttribute("inert", "");
    entrySurface?.setAttribute("aria-hidden", "true");
    entrySurface?.setAttribute("data-golden-portal-covered", "true");
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => skipButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      entrySurface?.removeAttribute("inert");
      entrySurface?.removeAttribute("data-golden-portal-covered");
      if (previouslyHadAriaHidden) {
        entrySurface?.setAttribute("aria-hidden", previousAriaHidden ?? "true");
      } else {
        entrySurface?.removeAttribute("aria-hidden");
      }
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>("[data-testid='join-start-actions'] button")?.focus();
      });
    };
  }, [isVisible]);

  const hasRoute = step >= 1;
  const hasMascot = step >= 2;
  const hasPortal = step >= 3;
  const hasWelcome = step >= 4;

  if (!isVisible) {
    return null;
  }

  return (
    <motion.section
      data-testid="golden-portal-intro"
      role="dialog"
      aria-modal="true"
      aria-labelledby="golden-portal-title"
      initial={false}
      animate={{ opacity: isDismissing ? 0 : 1 }}
      transition={{ duration: isDismissing ? PORTAL_EXIT_MS / 1_000 : 0 }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          dismiss();
        }
        if (event.key === "Tab") {
          event.preventDefault();
          skipButtonRef.current?.focus();
        }
      }}
      className="fixed inset-0 z-[100] isolate overflow-hidden bg-[#020817] text-white"
    >
        <h1 id="golden-portal-title" className="sr-only">Den Gyldne Portal</h1>
        <motion.div
          aria-hidden="true"
          initial={{ scale: 1.045, y: -8 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 4.8, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute -inset-3 origin-center"
        >
          <Image
            src="/brand/golden-portal/forest-night.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </motion.div>
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0.94 }}
          animate={{ opacity: step === 0 ? 0.42 : 0.1 }}
          transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_50%_52%,rgba(10,39,92,0.62),rgba(2,8,31,0.96)_74%)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(2,7,25,0.08),rgba(2,7,25,0.54))]" />

        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: hasRoute ? 0.92 : 0, scale: hasRoute ? 1 : 1.04 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute inset-0 z-30"
        >
          <svg className="h-full w-full" viewBox="0 0 360 800" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="golden-portal-intro-route" x1="0" y1="1" x2="0.78" y2="0">
                <stop offset="0" stopColor="#f5b84f" stopOpacity="0.12" />
                <stop offset="0.5" stopColor="#fff0b8" stopOpacity="1" />
                <stop offset="1" stopColor="#f2ad3c" stopOpacity="0.34" />
              </linearGradient>
            </defs>
            <motion.path
              d="M184 802 C188 722 139 676 182 614 C223 549 158 504 198 428 C238 346 245 267 208 206"
              fill="none"
              stroke="url(#golden-portal-intro-route)"
              strokeLinecap="round"
              strokeWidth="3"
              strokeDasharray="1 12"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: hasRoute ? 1 : 0, opacity: hasRoute ? 1 : 0 }}
              transition={{ duration: 1.05, ease: "easeInOut" }}
            />
          </svg>
        </motion.div>

        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, x: 110, y: 72, scale: 0.76, rotate: 7 }}
          animate={hasMascot ? { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 } : { opacity: 0, x: 110, y: 72, scale: 0.76, rotate: 7 }}
          transition={{ type: "spring", stiffness: 210, damping: 16, mass: 0.72 }}
          className="pointer-events-none absolute inset-x-0 bottom-[12%] z-40 mx-auto flex w-[min(56vw,235px)] justify-center"
        >
          <AutumnPortalMascot size="hero" priority />
        </motion.div>

        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.62, rotate: -18 }}
          animate={hasPortal ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.62, rotate: -18 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute inset-x-0 bottom-[7%] z-35 mx-auto h-[min(62vw,270px)] w-[min(62vw,270px)]"
        >
          <Image
            src="/brand/golden-portal/portal-leaf-ring-v2.webp"
            alt=""
            fill
            sizes="270px"
            className="object-contain opacity-90"
          />
        </motion.div>

        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: hasWelcome ? 1 : 0, y: hasWelcome ? 0 : 14 }}
          transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-5 bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.25rem))] z-50 mx-auto max-w-sm text-center"
        >
          <p className="text-[10px] font-black tracking-[0.36em] text-amber-100/82 uppercase">Den Gyldne Portal</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white drop-shadow-[0_3px_16px_rgba(2,8,30,0.9)]">
            Klar til efterårseventyr?
          </h2>
          <p className="mt-2 text-sm font-medium text-amber-50/86">Din næste rute venter lige forude.</p>
        </motion.div>

        <button
          ref={skipButtonRef}
          type="button"
          data-testid="golden-portal-skip"
          onClick={dismiss}
          className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-[60] inline-flex min-h-11 items-center rounded-full border border-white/24 bg-slate-950/60 px-4 text-sm font-bold text-white shadow-[0_8px_24px_rgba(1,5,18,0.32)] transition hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
        >
          Spring over
        </button>
    </motion.section>
  );
}
