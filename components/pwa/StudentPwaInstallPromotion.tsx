"use client";

import Image from "next/image";
import { Download, Plus, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_STORAGE_KEY = "skolegps.pwa.install-dismissed-at.v1";
const INSTALLED_STORAGE_KEY = "skolegps.pwa.install-confirmed.v1";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const PROMOTION_DELAY_MS = 1_000;

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type InstallPlatform = "android" | "ios" | null;

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone)
  );
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent ?? "";
  const isAppleMobile =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/i.test(userAgent);
  return isAppleMobile && isSafari;
}

function isEmbeddedBrowser() {
  const userAgent = window.navigator.userAgent ?? "";
  const isCapacitor = typeof (window as Window & { Capacitor?: unknown }).Capacitor !== "undefined";
  return (
    /FBAN|FBAV|Instagram|Snapchat/i.test(userAgent) ||
    (!isCapacitor && /Android/i.test(userAgent) && /; wv\)|\bwv\b/i.test(userAgent)) ||
    (/iPhone|iPad|iPod/i.test(userAgent) && /AppleWebKit/i.test(userAgent) && !/Safari/i.test(userAgent))
  );
}

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
    // Installation remains available for this page even in restricted modes.
  }
}

function isDismissedWithinCooldown() {
  const dismissedAt = Number(readStorage(DISMISS_STORAGE_KEY));
  return Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

function readInitialInstallSurface(): { isHidden: boolean; platform: InstallPlatform } {
  if (typeof window === "undefined") {
    return { isHidden: false, platform: null };
  }

  const isHidden =
    isStandaloneApp() ||
    readStorage(INSTALLED_STORAGE_KEY) === "installed" ||
    isDismissedWithinCooldown() ||
    isEmbeddedBrowser();

  return {
    isHidden,
    platform: !isHidden && isIosSafari() ? "ios" : null,
  };
}

export default function StudentPwaInstallPromotion({ brandName }: { brandName: string }) {
  const [initialSurface] = useState(readInitialInstallSurface);
  const [isReady, setIsReady] = useState(false);
  const [isHidden, setIsHidden] = useState(initialSurface.isHidden);
  const [platform, setPlatform] = useState<InstallPlatform>(initialSurface.platform);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    const hideWhenInstalled = () => {
      if (isStandaloneApp()) {
        setIsHidden(true);
        setDeferredPrompt(null);
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandaloneApp() && !isEmbeddedBrowser() && !isDismissedWithinCooldown()) {
        setPlatform("android");
        setDeferredPrompt(event as BeforeInstallPromptEvent);
      }
    };

    const handleAppInstalled = () => {
      writeStorage(INSTALLED_STORAGE_KEY, "installed");
      setDeferredPrompt(null);
      setIsHidden(true);
    };

    const readyTimer = window.setTimeout(() => setIsReady(true), PROMOTION_DELAY_MS);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery.addEventListener("change", hideWhenInstalled);
    document.documentElement.dataset.pwaInstallListener = "ready";

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", hideWhenInstalled);
      delete document.documentElement.dataset.pwaInstallListener;
    };
  }, []);

  const dismiss = () => {
    writeStorage(DISMISS_STORAGE_KEY, String(Date.now()));
    setDeferredPrompt(null);
    setIsHidden(true);
  };

  const install = async () => {
    if (!deferredPrompt || isPrompting) {
      return;
    }

    setIsPrompting(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === "dismissed") {
        writeStorage(DISMISS_STORAGE_KEY, String(Date.now()));
      }
      setDeferredPrompt(null);
      setIsHidden(true);
    } finally {
      setIsPrompting(false);
    }
  };

  const shouldShow = isReady && !isHidden && (platform === "ios" || Boolean(deferredPrompt));

  if (!shouldShow) {
    return null;
  }

  return (
    <aside
      aria-labelledby="student-pwa-install-title"
      data-platform={platform ?? undefined}
      data-testid="student-pwa-install-promotion"
      className="student-pwa-promotion fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] mx-auto w-[calc(100%-1.5rem)] max-w-md overflow-hidden rounded-[1.65rem] border border-emerald-200/20 bg-slate-950/94 p-3.5 text-white shadow-[0_22px_70px_rgba(2,6,23,0.54)] ring-1 ring-white/[0.06] backdrop-blur-2xl sm:p-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(52,211,153,0.16),transparent_40%),linear-gradient(125deg,rgba(255,255,255,0.035),transparent_55%)]" />

      <div className="relative flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-emerald-200/15 bg-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.16)]">
          <Image src="/icon-192x192.png" alt="" fill sizes="48px" className="scale-[1.8] object-cover" />
        </div>

        <div className="min-w-0 flex-1 pr-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/65">{brandName} APP</p>
          <h2 id="student-pwa-install-title" className="mt-0.5 text-base font-black tracking-tight text-white">
            Få {brandName} som app
          </h2>

          {platform === "ios" ? (
            <ol className="mt-3 grid gap-2 text-[13px] leading-5 text-slate-200">
              <li className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-400/12 text-sky-200"><Share2 className="h-4 w-4" /></span>
                <span><strong className="text-white">1.</strong> Tryk på Del i Safari</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/12 text-emerald-200"><Plus className="h-4 w-4" /></span>
                <span><strong className="text-white">2.</strong> Vælg &quot;Føj til hjemmeskærm&quot;</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-400/12 text-cyan-200"><Download className="h-4 w-4" /></span>
                <span><strong className="text-white">3.</strong> Vælg &quot;Åbn som webapp&quot;</span>
              </li>
            </ol>
          ) : (
            <>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-300">
                Åbn direkte fra hjemmeskærmen – helt uden browserlinjen.
              </p>
              <button
                type="button"
                onClick={() => void install()}
                disabled={isPrompting}
                className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-wait disabled:opacity-65"
              >
                <Download className="h-4 w-4" />
                {isPrompting ? "Åbner…" : "Installer app"}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Luk beskeden om installation"
          className="absolute -right-1 -top-1 flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <style jsx>{`
        .student-pwa-promotion {
          animation: student-pwa-promotion-enter 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes student-pwa-promotion-enter {
          from { opacity: 0; transform: translateY(-18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .student-pwa-promotion { animation: none; }
        }
      `}</style>
    </aside>
  );
}
