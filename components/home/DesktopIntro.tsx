"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./DesktopIntro.module.css";

const INTRO_DURATION_MS = 10_000;

type NavigatorWithIntroCapabilities = Navigator & {
  connection?: {
    saveData?: boolean;
  };
  standalone?: boolean;
};

// This lives for the lifetime of the document's JavaScript context. It prevents
// a React re-render, Strict Mode effect replay, or bfcache restore from opening
// a second automatic intro in the same document.
let automaticIntroEvaluatedForDocument = false;
let automaticIntroPendingForDocument = false;

function canAutomaticallyOpenIntro() {
  const navigatorWithCapabilities = navigator as NavigatorWithIntroCapabilities;
  const isIpadDesktopMode =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isCapacitorShell = typeof (window as Window & { Capacitor?: unknown }).Capacitor !== "undefined";
  const modernNavigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const isHistoryTraversal = modernNavigation?.type === "back_forward";

  return (
    window.location.pathname === "/" &&
    window.location.search.length === 0 &&
    window.location.hash.length === 0 &&
    document.visibilityState === "visible" &&
    !document.hidden &&
    !window.matchMedia("(max-width: 767px)").matches &&
    !window.matchMedia("(display-mode: standalone)").matches &&
    !navigatorWithCapabilities.standalone &&
    !isIpadDesktopMode &&
    !isCapacitorShell &&
    !isHistoryTraversal &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !navigatorWithCapabilities.connection?.saveData
  );
}

export default function DesktopIntro() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const enterButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const initialFocusFrameRef = useRef<number | null>(null);
  const openIntroFrameRef = useRef<number | null>(null);
  const returnFocusFrameRef = useRef<number | null>(null);
  const remainingDurationRef = useRef(INTRO_DURATION_MS);

  const closeIntro = useCallback((restoreFocus = true) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    remainingDurationRef.current = 0;
    setIsPlaying(false);
    setIsOpen(false);

    if (!restoreFocus) return;

    if (returnFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(returnFocusFrameRef.current);
    }

    returnFocusFrameRef.current = window.requestAnimationFrame(() => {
      returnFocusFrameRef.current = null;
      const previousElement = previouslyFocusedElementRef.current;

      if (previousElement?.isConnected) {
        previousElement.focus({ preventScroll: true });
      }
    });
  }, []);

  // The component has identical null output on the server and during hydration.
  // Browser-only capability checks happen only after the page has become interactive.
  useEffect(() => {
    if (automaticIntroEvaluatedForDocument || automaticIntroPendingForDocument) return;

    if (!canAutomaticallyOpenIntro()) {
      automaticIntroEvaluatedForDocument = true;
      return;
    }

    automaticIntroPendingForDocument = true;
    openIntroFrameRef.current = window.requestAnimationFrame(() => {
      openIntroFrameRef.current = null;
      automaticIntroPendingForDocument = false;

      if (automaticIntroEvaluatedForDocument) return;

      automaticIntroEvaluatedForDocument = true;
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      previouslyFocusedElementRef.current =
        activeElement && activeElement !== document.body
          ? activeElement
          : document.querySelector<HTMLElement>("[data-homepage-primary-cta]");
      remainingDurationRef.current = INTRO_DURATION_MS;
      setIsPlaying(true);
      setIsOpen(true);
    });

    return () => {
      if (openIntroFrameRef.current !== null) {
        window.cancelAnimationFrame(openIntroFrameRef.current);
        openIntroFrameRef.current = null;
        automaticIntroPendingForDocument = false;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      if (initialFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(initialFocusFrameRef.current);
      }

      if (openIntroFrameRef.current !== null) {
        window.cancelAnimationFrame(openIntroFrameRef.current);
      }

      if (returnFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(returnFocusFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const compactViewportQuery = window.matchMedia("(max-width: 767px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const closeIfNoLongerSupported = () => {
      if (compactViewportQuery.matches || reducedMotionQuery.matches) {
        closeIntro();
      }
    };
    const closeWhenHidden = () => {
      if (document.visibilityState !== "visible") {
        closeIntro(false);
      }
    };
    const closeBeforePageIsHidden = () => closeIntro(false);

    initialFocusFrameRef.current = window.requestAnimationFrame(() => {
      initialFocusFrameRef.current = null;
      enterButtonRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeIntro();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("aria-hidden"));

      if (focusableElements.length === 0) return;

      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstFocusableElement) {
        event.preventDefault();
        lastFocusableElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    };

    const previousBodyOverflow = document.body.style.overflow;
    const backgroundElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== overlayRef.current,
    );
    const backgroundState = backgroundElements.map((element) => ({
      ariaHidden: element.getAttribute("aria-hidden"),
      element,
      inert: element.inert,
    }));

    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", closeWhenHidden);
    window.addEventListener("pagehide", closeBeforePageIsHidden);
    compactViewportQuery.addEventListener("change", closeIfNoLongerSupported);
    reducedMotionQuery.addEventListener("change", closeIfNoLongerSupported);

    return () => {
      if (initialFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(initialFocusFrameRef.current);
        initialFocusFrameRef.current = null;
      }

      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", closeWhenHidden);
      window.removeEventListener("pagehide", closeBeforePageIsHidden);
      compactViewportQuery.removeEventListener("change", closeIfNoLongerSupported);
      reducedMotionQuery.removeEventListener("change", closeIfNoLongerSupported);
      document.body.style.overflow = previousBodyOverflow;
      backgroundState.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }
      });
    };
  }, [closeIntro, isOpen]);

  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const remainingDuration = remainingDurationRef.current;

    if (remainingDuration <= 0) {
      const finishFrame = window.requestAnimationFrame(() => closeIntro());
      return () => window.cancelAnimationFrame(finishFrame);
    }

    const startedAt = window.performance.now();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      remainingDurationRef.current = 0;
      closeIntro();
    }, remainingDuration);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (remainingDurationRef.current > 0) {
        const elapsed = window.performance.now() - startedAt;
        remainingDurationRef.current = Math.max(0, remainingDurationRef.current - elapsed);
      }
    };
  }, [closeIntro, isOpen, isPlaying]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} ref={overlayRef}>
      <section
        aria-describedby="homepage-intro-description"
        aria-labelledby="homepage-intro-title"
        aria-modal="true"
        className={styles.dialog}
        data-testid="homepage-intro"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className={`${styles.scene} ${isPlaying ? "" : styles.paused}`.trim()}
          data-testid="homepage-intro-scene"
        >
          <Image
            alt=""
            className={styles.sceneImage}
            fill
            priority
            sizes="100vw"
            src="/brand/heroes/adventure-hero.webp"
          />
          <div className={styles.sceneShade} />
          <div className={styles.sunlight} />

          <svg className={styles.route} viewBox="0 0 1000 600" focusable="false">
            <path d="M-34 506C168 456 174 335 354 385c159 44 184 144 333 70 116-58 144-162 341-126" />
            <circle cx="180" cy="434" r="12" />
            <circle cx="515" cy="455" r="12" />
            <circle cx="826" cy="261" r="14" />
          </svg>

          <div className={styles.mascot}>
            <Image
              alt=""
              className={styles.mascotImage}
              fill
              sizes="(max-width: 1024px) 190px, 290px"
              src="/brand/mascot/skolegps-pin.webp"
            />
          </div>

          <div className={styles.toolTrail}>
            <span className={`${styles.toolMarker} ${styles.gpsMarker}`}>GPS-løb</span>
            <span className={`${styles.toolMarker} ${styles.worksheetMarker}`}>Arbejdsark</span>
            <span className={`${styles.toolMarker} ${styles.boardMarker}`}>Dagens Tavle</span>
          </div>

          <div aria-hidden="true" className={styles.boardPreview} data-testid="homepage-intro-board-preview">
            <span>DAGENS TAVLE</span>
            <strong>Dagens program.<br />Samlet.</strong>
            <small>Teksteksempel · ikke et skærmbillede</small>
          </div>
        </div>

        <div className={styles.content}>
          <p className={styles.eyebrow}>Læring i den virkelige verden</p>
          <h2 id="homepage-intro-title">Mere liv i undervisningen.</h2>
          <p id="homepage-intro-description">
            En kort, lydløs introduktion til GPS-løb, arbejdsark og Dagens Tavle: Dagens program.
            Samlet. Du kan altid gå direkte videre.
          </p>
        </div>

        <div className={styles.controls}>
          <button
            className={styles.enterButton}
            data-testid="homepage-intro-enter"
            onClick={() => closeIntro()}
            ref={enterButtonRef}
            type="button"
          >
            Gå til SkoleGPS <span aria-hidden="true">→</span>
          </button>
          <button
            aria-pressed={!isPlaying}
            className={styles.secondaryButton}
            data-testid="homepage-intro-pause"
            onClick={() => setIsPlaying((wasPlaying) => !wasPlaying)}
            type="button"
          >
            {isPlaying ? "Pause intro" : "Fortsæt intro"}
          </button>
          <button
            aria-label="Lyd er ikke tilgængelig i denne webanimation"
            className={styles.audioButton}
            data-testid="homepage-intro-audio"
            disabled
            type="button"
          >
            Ingen lyd i webanimationen
          </button>
        </div>

        <div className={styles.entryLinks}>
          <Link className={styles.entryLink} href="/join">
            Elev med kode
          </Link>
          <Link className={styles.entryLink} href="/login">
            Log ind som lærer
          </Link>
        </div>

        <button
          className={styles.skipButton}
          data-testid="homepage-intro-skip"
          onClick={() => closeIntro()}
          type="button"
        >
          Spring intro over
        </button>

        <p className={styles.playbackStatus} aria-live="polite">
          {isPlaying ? "Intro afspilles uden lyd." : "Intro er sat på pause."}
        </p>
      </section>
    </div>,
    document.body,
  );
}
