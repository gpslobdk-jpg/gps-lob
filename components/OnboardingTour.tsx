"use client";

import { driver, type PopoverDOM } from "driver.js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const LEGACY_TOUR_SEEN_KEY = "gpslob-tour-seen";
const LEGACY_TOUR_STEP_KEY = "gpslob-tour-step";
const TOUR_FINISHED_KEY = "gpslob_tour_finished";
const TOUR_STEP_KEY = "gpslob_tour_step";

type TourStep = {
  index: number;
  path: string;
  selector: string;
  title: string;
  description: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  nextPath?: string;
  nextButtonLabel?: string;
  showNextButton?: boolean;
  done?: boolean;
};

const TOUR_STEPS: TourStep[] = [
  {
    index: 0,
    path: "/login",
    selector: '[data-tour="login-organizer-entry"]',
    title: "Log ind som arrangør",
    description: "Velkommen! Start med at logge ind her for at styre dine løb.",
    side: "bottom",
    align: "center",
    nextPath: "/dashboard",
    showNextButton: false,
  },
  {
    index: 1,
    path: "/dashboard",
    selector: '[data-tour="dashboard-create-run"]',
    title: "Her starter magien",
    description: "Her starter magien. Klik her for at lave dit første ræs.",
    side: "bottom",
    align: "center",
    nextPath: "/dashboard/opret",
  },
  {
    index: 2,
    path: "/dashboard/opret",
    selector: '[data-tour="opret-build-from-scratch"]',
    title: "Byg med fuld kontrol",
    description: "Vælg denne for fuld kontrol over dine poster.",
    side: "bottom",
    align: "start",
    nextPath: "/dashboard/opret/valg",
  },
  {
    index: 3,
    path: "/dashboard/opret/valg",
    selector: '[data-tour="valg-classic-quiz"]',
    title: "Start med Klassisk Quiz",
    description: "Vores mest populære type. Perfekt til en tur i skoven!",
    side: "bottom",
    align: "start",
    nextButtonLabel: "Færdig",
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
  window.localStorage.setItem(TOUR_FINISHED_KEY, "true");
  window.localStorage.removeItem(TOUR_STEP_KEY);
};

const migrateLegacyState = () => {
  if (window.localStorage.getItem(TOUR_FINISHED_KEY) === "true") return;

  if (window.localStorage.getItem(LEGACY_TOUR_SEEN_KEY) === "true") {
    window.localStorage.setItem(TOUR_FINISHED_KEY, "true");
    window.localStorage.removeItem(LEGACY_TOUR_STEP_KEY);
    return;
  }

  const legacyStep = window.localStorage.getItem(LEGACY_TOUR_STEP_KEY);
  if (legacyStep && !window.localStorage.getItem(TOUR_STEP_KEY)) {
    window.localStorage.setItem(TOUR_STEP_KEY, legacyStep);
  }
};

const syncStepWithPath = (pathname: string, currentStep: number) => {
  if (pathname === "/login") {
    return currentStep;
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
  pathname === "/login" ||
  pathname === "/dashboard" ||
  pathname === "/dashboard/opret" ||
  pathname === "/dashboard/opret/valg";

const isElementVisible = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();

  return rect.width > 0 && rect.height > 0;
};

const setSkipButtonLabel = (popover: PopoverDOM) => {
  popover.closeButton.innerText = "Spring over";
  popover.closeButton.classList.add("gpslob-tour-skip-btn");
  popover.footerButtons.prepend(popover.closeButton);
};

const openNextRoute = (router: ReturnType<typeof useRouter>, nextPath?: string) => {
  if (!nextPath) return;
  router.push(nextPath);
};

export default function OnboardingTour() {
  const pathname = usePathname();
  const router = useRouter();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname) return;

    migrateLegacyState();
    if (window.localStorage.getItem(TOUR_FINISHED_KEY) === "true") return;

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
    let cleanupTargetClick: (() => void) | null = null;

    const teardown = () => {
      cleanupTargetClick?.();
      cleanupTargetClick = null;
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

      const handleTargetAdvance = () => {
        if (nextStep.done) {
          completeTour();
          teardown();
          return;
        }

        setStoredStep(nextStep.index + 1);
      };

      if (targetElement instanceof HTMLElement) {
        const clickHandler = () => {
          handleTargetAdvance();
        };
        targetElement.addEventListener("click", clickHandler, { once: true });
        cleanupTargetClick = () => {
          targetElement.removeEventListener("click", clickHandler);
        };
      }

      const driverObj = driver({
        animate: true,
        allowClose: true,
        overlayOpacity: 0.58,
        overlayColor: "rgba(15, 23, 42, 0.72)",
        stagePadding: 10,
        stageRadius: 18,
        disableActiveInteraction: false,
        showProgress: true,
        smoothScroll: true,
        popoverClass: "gpslob-tour-popover",
        nextBtnText: nextStep.nextButtonLabel ?? (nextStep.done ? "Færdig" : "Videre"),
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
              showButtons: nextStep.showNextButton === false ? ["close"] : ["next", "close"],
              onPopoverRender: (popover) => {
                setSkipButtonLabel(popover);
              },
              onNextClick: () => {
                if (nextStep.done) {
                  completeTour();
                  teardown();
                  return;
                }

                setStoredStep(nextStep.index + 1);
                teardown();
                openNextRoute(router, nextStep.nextPath);
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
