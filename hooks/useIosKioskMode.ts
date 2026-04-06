"use client";

import { useEffect, useState } from "react";

export function useIosKioskMode() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.navigator === "undefined") {
      return;
    }

    // 1. Tjek om enheden er iOS (iPhone, iPad, iPod)
    // Inkluderer et tjek for nyere iPads, som identificerer sig selv som Mac men understøtter touch.
    const isIos =
      /ipad|iphone|ipod/.test(window.navigator.userAgent.toLowerCase()) ||
      (window.navigator.userAgent.includes("Mac") && "ontouchend" in document);

    if (!isIos) {
      return;
    }

    // 2. Tjek om appen kører i standalone/kiosk-mode (Føj til hjemmeskærm)
    const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
    // Specifikt proprietært tjek for iOS Safari
    const isSafariStandalone =
      "standalone" in window.navigator && !!(window.navigator as any).standalone;

    // 3. Vis advarsel, hvis den IKKE er standalone
    setShowWarning(!(isStandaloneMedia || isSafariStandalone));
  }, []);

  return showWarning;
}