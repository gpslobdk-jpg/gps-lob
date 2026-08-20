"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export const DASHBOARD_QUICK_GUIDE_EVENT = "skolegps:open-quick-guide";
export const DASHBOARD_QUICK_GUIDE_VISIBILITY_EVENT = "skolegps:quick-guide-visibility";
export const DASHBOARD_QUICK_GUIDE_SEEN_KEY = "skolegps.dashboard-quick-guide.v1.seen";
const DASHBOARD_QUICK_GUIDE_STEP_KEY = "skolegps.dashboard-quick-guide.v1.step";

type GuideView = "closed" | "intro" | "create" | "lynbygger" | "finish";

type HighlightRect = {
  height: number;
  left: number;
  top: number;
  width: number;
  view: "create" | "lynbygger";
};

const guideSteps: Record<Exclude<GuideView, "closed" | "intro">, {
  body: string;
  label: string;
  target?: string;
}> = {
  create: {
    body: "Her starter du, når du vil lave et nyt løb.",
    label: "Trin 1 af 3",
    target: '[data-tour="dashboard-create-run"]',
  },
  lynbygger: {
    body: "Er du ny, er Lynbyggeren den hurtigste vej.",
    label: "Trin 2 af 3",
    target: '[data-tour="valg-lynbygger"]',
  },
  finish: {
    body: "Lav indhold, placér posterne på kortet, og start løbet.",
    label: "Trin 3 af 3",
  },
};

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Guiden er ekstra hjælp. Dashboardet skal fortsat virke uden localStorage.
  }
}

function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Guiden er ekstra hjælp. Dashboardet skal fortsat virke uden localStorage.
  }
}

function isVisibleFocusTarget(element: HTMLElement | null) {
  if (!element?.isConnected) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

export default function DashboardQuickGuide() {
  const pathname = usePathname();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const manualTriggerRef = useRef<HTMLElement | null>(null);
  const dialogFocusFrameRef = useRef<number | null>(null);
  const returnFocusFrameRef = useRef<number | null>(null);
  const [view, setView] = useState<GuideView>("closed");
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const isGuideOpen = view !== "closed";

  const markGuideSeen = useCallback(() => {
    writeStorage(DASHBOARD_QUICK_GUIDE_SEEN_KEY, "true");
  }, []);

  const setActiveStep = useCallback((step: "create" | "lynbygger" | "finish") => {
    setView(step);
  }, []);

  const returnFocus = useCallback(() => {
    if (returnFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(returnFocusFrameRef.current);
    }

    returnFocusFrameRef.current = window.requestAnimationFrame(() => {
      const manualTrigger = manualTriggerRef.current;
      const routeFallback = pathname === "/dashboard/opret/valg"
        ? document.querySelector<HTMLElement>('[data-tour="valg-lynbygger"]')
        : pathname === "/dashboard"
          ? document.querySelector<HTMLElement>('[data-tour="dashboard-create-run"]')
          : document.querySelector<HTMLElement>("h1");
      const focusTarget = isVisibleFocusTarget(manualTrigger)
        ? manualTrigger
        : isVisibleFocusTarget(routeFallback)
          ? routeFallback
          : null;

      if (focusTarget) {
        if (focusTarget.tabIndex < 0) focusTarget.tabIndex = -1;
        focusTarget.focus({ preventScroll: true });
      }

      manualTriggerRef.current = null;
      returnFocusFrameRef.current = null;
    });
  }, [pathname]);

  const closeGuide = useCallback(() => {
    markGuideSeen();
    removeStorage(DASHBOARD_QUICK_GUIDE_STEP_KEY);
    setView("closed");
    returnFocus();
  }, [markGuideSeen, returnFocus]);

  useEffect(() => {
    let frame = 0;
    const hasSeenGuide = readStorage(DASHBOARD_QUICK_GUIDE_SEEN_KEY) === "true";
    removeStorage(DASHBOARD_QUICK_GUIDE_STEP_KEY);

    if (hasSeenGuide) return;

    if (pathname === "/dashboard") {
      manualTriggerRef.current = null;
      frame = window.requestAnimationFrame(() => setView("intro"));
    }

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const handleManualOpen = () => {
      manualTriggerRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      setView("intro");
    };
    window.addEventListener(DASHBOARD_QUICK_GUIDE_EVENT, handleManualOpen);
    return () => window.removeEventListener(DASHBOARD_QUICK_GUIDE_EVENT, handleManualOpen);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isGuideOpen) {
      root.dataset.dashboardQuickGuide = "active";
    } else {
      delete root.dataset.dashboardQuickGuide;
    }
    window.dispatchEvent(
      new CustomEvent<boolean>(DASHBOARD_QUICK_GUIDE_VISIBILITY_EVENT, { detail: isGuideOpen })
    );

    return () => {
      if (!isGuideOpen) return;
      delete root.dataset.dashboardQuickGuide;
      window.dispatchEvent(
        new CustomEvent<boolean>(DASHBOARD_QUICK_GUIDE_VISIBILITY_EVENT, { detail: false })
      );
    };
  }, [isGuideOpen]);

  useEffect(() => () => {
    if (dialogFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(dialogFocusFrameRef.current);
    }
    if (returnFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(returnFocusFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (view === "closed") return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGuide();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    dialogFocusFrameRef.current = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
      dialogFocusFrameRef.current = null;
    });

    return () => {
      if (dialogFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(dialogFocusFrameRef.current);
        dialogFocusFrameRef.current = null;
      }
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeGuide, view]);

  useLayoutEffect(() => {
    if (view !== "create" && view !== "lynbygger") {
      return;
    }

    const highlightView = view;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let repositionFrame: number | null = null;
    let attempts = 0;
    let repositionAttempts = 0;
    const updateHighlight = () => {
      const target = document.querySelector<HTMLElement>(guideSteps[highlightView].target ?? "");
      if (!target) {
        attempts += 1;
        if (attempts < 50) retryTimer = setTimeout(updateHighlight, 100);
        return;
      }

      const rect = target.getBoundingClientRect();
      const isCompactViewport = window.matchMedia("(max-width: 639px)").matches;
      if (isCompactViewport && repositionAttempts < 3) {
        const panelRect = dialogRef.current?.getBoundingClientRect();
        const viewportTop = window.visualViewport?.offsetTop ?? 0;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const safeTop = Math.max(viewportTop + 16, (panelRect?.bottom ?? viewportTop + 220) + 16);
        const safeBottom = viewportTop + viewportHeight - 16;
        const availableHeight = Math.max(0, safeBottom - safeTop);
        const desiredTop = safeTop + Math.max(0, (availableHeight - rect.height) / 2);
        const scrollDelta = rect.top - desiredTop;

        if ((rect.top < safeTop || rect.bottom > safeBottom) && Math.abs(scrollDelta) > 1) {
          repositionAttempts += 1;
          window.scrollBy({ top: scrollDelta, behavior: "auto" });
          repositionFrame = window.requestAnimationFrame(updateHighlight);
          return;
        }
      }

      setHighlightRect({
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        view: highlightView,
      });
    };

    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, true);
    window.visualViewport?.addEventListener("resize", updateHighlight);
    window.visualViewport?.addEventListener("scroll", updateHighlight);
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (repositionFrame !== null) window.cancelAnimationFrame(repositionFrame);
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight, true);
      window.visualViewport?.removeEventListener("resize", updateHighlight);
      window.visualViewport?.removeEventListener("scroll", updateHighlight);
    };
  }, [pathname, view]);

  if (view === "closed") return null;

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])') ?? []
    ).filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const isHighlightStep = view === "create" || view === "lynbygger";
  const highlightStyle: CSSProperties | undefined = isHighlightStep && highlightRect?.view === view
    ? {
        height: highlightRect.height + 12,
        left: highlightRect.left - 6,
        top: highlightRect.top - 6,
        width: highlightRect.width + 12,
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-[10000]">
      {view === "intro" ? (
        <div className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm" aria-hidden="true" />
      ) : highlightStyle ? (
        <div
          data-testid="quick-guide-highlight"
          className="pointer-events-none fixed rounded-[2.25rem] border-4 border-cyan-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.78),0_0_38px_rgba(103,232,249,0.9)]"
          style={highlightStyle}
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm" aria-hidden="true" />
      )}

      <div
        className={`pointer-events-none absolute inset-0 flex px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] ${view === "intro" ? "items-center justify-center" : "items-start justify-center sm:items-center"}`}
      >
        <div
          ref={dialogRef}
          data-testid="quick-guide-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-guide-title"
          aria-describedby="quick-guide-description"
          onKeyDown={handleDialogKeyDown}
          className="pointer-events-auto relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[1.75rem] border border-cyan-200/35 bg-slate-950/96 p-6 text-left text-white shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:p-7"
        >
          <button
            type="button"
            onClick={closeGuide}
            aria-label="Luk den korte guide"
            className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/8 text-lg font-semibold text-white transition hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            ×
          </button>

          {view === "intro" ? (
            <>
              <p className="pr-12 text-xs font-bold tracking-[0.2em] text-cyan-200 uppercase">Kort guide</p>
              <h2 id="quick-guide-title" className="mt-3 pr-12 text-2xl font-black tracking-tight">
                Velkommen til SkoleGPS
              </h2>
              <p id="quick-guide-description" className="mt-3 text-sm leading-6 text-slate-200">
                Vil du se, hvordan du laver dit første løb? Det tager under ét minut.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    markGuideSeen();
                    if (pathname !== "/dashboard") router.push("/dashboard");
                    setActiveStep("create");
                  }}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  Vis mig rundt
                </button>
                <button
                  type="button"
                  onClick={closeGuide}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/20 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  Jeg finder selv
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="pr-12 text-xs font-bold tracking-[0.2em] text-cyan-200 uppercase">
                {guideSteps[view].label}
              </p>
              <h2 id="quick-guide-title" className="mt-3 pr-12 text-xl font-black tracking-tight">
                Dit første løb
              </h2>
              <p id="quick-guide-description" className="mt-3 text-sm leading-6 text-slate-200">
                {guideSteps[view].body}
              </p>
              <div className="mt-6">
                {view === "create" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveStep("lynbygger");
                      router.push("/dashboard/opret/valg");
                    }}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    Videre
                  </button>
                ) : view === "lynbygger" ? (
                  <button
                    type="button"
                    onClick={() => setActiveStep("finish")}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    Videre
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      closeGuide();
                      router.push("/dashboard/opret/lynbygger");
                    }}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    Start med Lynbyggeren
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
