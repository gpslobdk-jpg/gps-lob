"use client";

import { driver } from "driver.js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const TOUR_SEEN_KEY = "gpslob-tour-seen";
const TOUR_STEP_KEY = "gpslob-tour-step";

type TourStep = {
  index: number;
  path: string;
  selector: string;
  title: string;
  description: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  nextPath?: string;
  done?: boolean;
};

const TOUR_STEPS: TourStep[] = [
  {
    index: 0,
    path: "/",
    selector: '[data-tour="home-organizer-login"]',
    title: "Start her som arrangør",
    description:
      "Det her er indgangen til builderen. Klik her, hvis du vil oprette og styre dine egne GPS-løb.",
    side: "top",
    align: "center",
    nextPath: "/login",
  },
  {
    index: 1,
    path: "/dashboard",
    selector: '[data-tour="dashboard-create-run"]',
    title: "Her opretter du dit første løb",
    description:
      "Når du er landet i Udsigtsposten, er det her dit vigtigste næste klik. Herfra går du videre til selve oprettelsen.",
    side: "bottom",
    align: "center",
    nextPath: "/dashboard/opret",
  },
  {
    index: 2,
    path: "/dashboard/opret",
    selector: '[data-tour="opret-build-from-scratch"]',
    title: "Vælg den manuelle vej først",
    description:
      "Byg fra bunden er den bedste start, hvis du vil lære platformen hurtigt at kende og selv styre flowet.",
    side: "bottom",
    align: "start",
    nextPath: "/dashboard/opret/valg",
  },
  {
    index: 3,
    path: "/dashboard/opret/valg",
    selector: '[data-tour="valg-classic-quiz"]',
    title: "Begynd med Klassisk Quiz-løb",
    description:
      "Det er den mest ligetil builder og den hurtigste måde at forstå poster, spørgsmål og ruteopsætning på.",
    side: "bottom",
    align: "start",
    done: true,
  },
];

const getStoredStep = () => {
  const rawValue = window.localStorage.getItem(TOUR_STEP_KEY);
  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return 0;
  }

  return parsedValue;
};

const setStoredStep = (step: number) => {
  window.localStorage.setItem(TOUR_STEP_KEY, String(step));
};

const completeTour = () => {
  window.localStorage.setItem(TOUR_SEEN_KEY, "true");
  window.localStorage.removeItem(TOUR_STEP_KEY);
};

const syncStepWithPath = (pathname: string, currentStep: number) => {
  if (pathname === "/login") {
    return Math.max(currentStep, 1);
  }

  if (pathname === "/dashboard") {
    return Math.max(currentStep, 1);
  }

  if (pathname === "/dashboard/opret") {
    return Math.max(currentStep, 2);
  }

  if (pathname === "/dashboard/opret/valg") {
    return Math.max(currentStep, 3);
  }

  if (
    pathname.startsWith("/dashboard/opret/") &&
    pathname !== "/dashboard/opret" &&
    pathname !== "/dashboard/opret/valg"
  ) {
    completeTour();
    return Number.MAX_SAFE_INTEGER;
  }

  return currentStep;
};

const canShowTourOnPath = (pathname: string) =>
  pathname === "/" ||
  pathname === "/dashboard" ||
  pathname === "/dashboard/opret" ||
  pathname === "/dashboard/opret/valg";

const isElementVisible = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();

  return rect.width > 0 && rect.height > 0;
};

export default function OnboardingTour() {
  const pathname = usePathname();
  const router = useRouter();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname) return;
    if (window.localStorage.getItem(TOUR_SEEN_KEY) === "true") return;

    const rawStoredStep = getStoredStep();
    const storedStep = syncStepWithPath(pathname, rawStoredStep);
    if (Number.isFinite(storedStep) && storedStep !== rawStoredStep) {
      setStoredStep(storedStep);
    }
    if (!Number.isFinite(storedStep)) return;
    if (!canShowTourOnPath(pathname)) return;

    const nextStep = TOUR_STEPS.find((step) => step.index === storedStep && step.path === pathname);
    if (!nextStep) return;

    let cancelled = false;
    let attemptCount = 0;

    const teardown = () => {
      driverRef.current?.destroy();
      driverRef.current = null;
    };

    const openStep = () => {
      if (cancelled) return;

      const blockingDialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
      const targetElement = document.querySelector(nextStep.selector);

      if ((blockingDialog && !targetElement?.closest(".driver-popover")) || !isElementVisible(targetElement)) {
        if (attemptCount < 24) {
          attemptCount += 1;
          window.setTimeout(openStep, 250);
        }
        return;
      }

      teardown();

      const driverObj = driver({
        animate: true,
        allowClose: true,
        overlayOpacity: 0.58,
        overlayColor: "rgba(15, 23, 42, 0.72)",
        stagePadding: 10,
        stageRadius: 18,
        showProgress: true,
        smoothScroll: true,
        popoverClass: "gpslob-tour-popover",
        nextBtnText: nextStep.done ? "Færdig" : "Videre",
        prevBtnText: "Tilbage",
        doneBtnText: "Færdig",
        onCloseClick: () => {
          completeTour();
          teardown();
        },
        steps: [
          {
            element: nextStep.selector,
            popover: {
              title: nextStep.title,
              description: nextStep.description,
              side: nextStep.side ?? "bottom",
              align: nextStep.align ?? "start",
              showButtons: ["next", "close"],
              onNextClick: () => {
                if (nextStep.done) {
                  completeTour();
                  teardown();
                  return;
                }

                setStoredStep(nextStep.index + 1);
                teardown();

                if (nextStep.nextPath) {
                  router.push(nextStep.nextPath);
                }
              },
              onCloseClick: () => {
                completeTour();
                teardown();
              },
            },
          },
        ],
      });

      driverRef.current = driverObj;
      driverObj.drive();
    };

    const frame = window.requestAnimationFrame(openStep);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      teardown();
    };
  }, [pathname, router]);

  return null;
}
