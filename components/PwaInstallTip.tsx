"use client";

import { Download, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PwaInstallTipProps = {
  variant?: "default" | "highlight";
  className?: string;
};

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

type InstallSurfaceState = {
  isStandalone: boolean;
  isIosSafari: boolean;
};

function readInstallSurfaceState(): InstallSurfaceState {
  if (typeof window === "undefined") {
    return { isStandalone: false, isIosSafari: false };
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  const userAgent = window.navigator.userAgent ?? "";
  const isAppleMobile =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/i.test(userAgent);

  return {
    isStandalone:
      window.matchMedia("(display-mode: standalone)").matches || Boolean(navigatorWithStandalone.standalone),
    isIosSafari: isAppleMobile && isSafari,
  };
}

export default function PwaInstallTip({
  variant = "default",
  className = "",
}: PwaInstallTipProps) {
  const isHighlight = variant === "highlight";
  const [isReady, setIsReady] = useState(false);
  const [surfaceState, setSurfaceState] = useState<InstallSurfaceState>({
    isStandalone: false,
    isIosSafari: false,
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncSurfaceState = () => {
      setSurfaceState(readInstallSurfaceState());
      setIsReady(true);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
      syncSurfaceState();
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowIosHint(false);
      syncSurfaceState();
    };

    syncSurfaceState();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const canUseNativePrompt = Boolean(deferredPrompt);
  const shouldShow = useMemo(() => {
    if (!isReady || surfaceState.isStandalone) return false;
    return canUseNativePrompt || surfaceState.isIosSafari;
  }, [canUseNativePrompt, isReady, surfaceState.isIosSafari, surfaceState.isStandalone]);

  const helperText = canUseNativePrompt
    ? "Åbn SkoleGPS som app med den indbyggede installationsdialog."
    : showIosHint
      ? 'Tryk på Del i Safari og vælg "Føj til hjemmeskærm".'
      : "Installér SkoleGPS som app for hurtigere adgang og en renere oplevelse.";

  const handleInstall = async () => {
    if (deferredPrompt) {
      setIsPromptOpen(true);
      try {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => null);
      } finally {
        setDeferredPrompt(null);
        setIsPromptOpen(false);
        setSurfaceState(readInstallSurfaceState());
      }
      return;
    }

    setShowIosHint((current) => !current);
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <aside
      className={`relative overflow-hidden rounded-[2rem] border px-5 py-4 text-left shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur-xl ${
        isHighlight
          ? "border-emerald-300/30 bg-slate-950/88 ring-1 ring-emerald-300/20 md:px-6 md:py-5"
          : "border-emerald-400/20 bg-slate-950/75"
      } ${className}`.trim()}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl ${
          isHighlight ? "bg-emerald-300/20" : "bg-emerald-400/16"
        }`}
      />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/70">
            APP
          </p>
          <h3 className="mt-1 text-base font-black text-white md:text-lg">Installér SkoleGPS</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{helperText}</p>
        </div>

        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={isPromptOpen}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-black uppercase tracking-[0.2em] transition ${
            isHighlight
              ? "border-emerald-300/35 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              : "border-emerald-400/30 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {canUseNativePrompt ? <Download className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isPromptOpen ? "Åbner..." : "Installér app"}
        </button>
      </div>
    </aside>
  );
}
