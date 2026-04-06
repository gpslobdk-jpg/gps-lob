"use client";

import { useState } from "react";

import { useIosKioskMode } from "@/hooks/useIosKioskMode";

export function FullscreenWarning() {
  const showWarning = useIosKioskMode();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!showWarning || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 z-[9999] w-[90vw] max-w-md -translate-x-1/2">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-50 p-4 shadow-2xl backdrop-blur-md dark:border-amber-400/20 dark:bg-amber-950/95">
        <div className="pr-8">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
            📱 Få hele spillet med!
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-amber-800 dark:text-amber-200/90">
            For at undgå at knapperne forsvinder, anbefaler vi at spille i fuld skærm. Tryk på &apos;Del&apos;-ikonet og vælg &apos;Føj til hjemmeskærm&apos;.
          </p>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-700 transition-colors hover:bg-amber-200/60 hover:text-amber-950 dark:text-amber-400 dark:hover:bg-amber-800/50 dark:hover:text-amber-50"
          aria-label="Luk advarsel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}