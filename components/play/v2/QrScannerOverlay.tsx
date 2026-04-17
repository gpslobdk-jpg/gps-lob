"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import type {
  Html5Qrcode,
  Html5QrcodeCameraScanConfig,
  Html5QrcodeFullConfig,
} from "html5-qrcode";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QrScannerOverlayProps {
  /** Whether the overlay is mounted and scanning. */
  isOpen: boolean;
  /** Called when the user taps close / backdrop. */
  onClose: () => void;
  /**
   * Called with the extracted PIN string when a valid QR code is decoded.
   * The overlay auto-closes after calling this.
   */
  onCodeDetected: (pin: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Attempt to extract a 4–6 digit PIN from a scanned QR value. */
function extractPin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // If it looks like a URL, try to pull ?pin= from it.
  const urlLike =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.startsWith("/");
  if (urlLike) {
    try {
      const parsed = trimmed.startsWith("/")
        ? new URL(trimmed, "https://placeholder.local")
        : new URL(trimmed);
      const pinParam = (parsed.searchParams.get("pin") ?? "")
        .replace(/\D/g, "")
        .slice(0, 6);
      if (pinParam.length >= 4) return pinParam;
    } catch {
      // Fall through.
    }
  }

  // Otherwise treat the whole value as a raw pin or try to extract digits.
  const digits = trimmed.match(/\d{4,6}/)?.[0] ?? trimmed.replace(/\D/g, "").slice(0, 6);
  return digits.length >= 4 ? digits : null;
}

function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

async function disposeScanner(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    if (scanner.isScanning) await scanner.stop();
  } catch { /* noop */ }
  try {
    scanner.clear();
  } catch { /* noop */ }
}

function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError")
      return "Kamera-adgang nægtet. Tillad kamera i din browsers indstillinger.";
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError")
      return "Vi kunne ikke finde et kamera på denne enhed.";
    if (error.name === "NotReadableError" || error.name === "TrackStartError")
      return "Kameraet er allerede i brug af en anden app.";
  }
  return "Kameraet kunne ikke startes lige nu. Prøv igen.";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function QrScannerOverlay({ isOpen, onClose, onCodeDetected }: QrScannerOverlayProps) {
  const regionId = useId().replace(/:/g, "-");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  // Stable ref for the callback so the scanner closure never stales.
  const callbackRef = useRef(onCodeDetected);
  callbackRef.current = onCodeDetected;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // ---- Cleanup helper ----
  const teardown = useCallback(async () => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    const s = scannerRef.current;
    scannerRef.current = null;
    await disposeScanner(s);
  }, []);

  // ---- Expose test hook on window so Playwright can simulate a scan ----
  useEffect(() => {
    if (!isOpen) return;
    const w = window as Window & { __qrTestHook?: (pin: string) => void };
    w.__qrTestHook = (pin: string) => {
      // Haptic
      try { navigator.vibrate?.(80); } catch { /* noop */ }
      setFlash(true);
      setTimeout(() => {
        callbackRef.current(pin);
        closeRef.current();
      }, 250);
    };
    return () => { delete w.__qrTestHook; };
  }, [isOpen]);

  // ---- Scanner lifecycle ----
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    let resolved = false;

    const start = async () => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraError("Din browser understøtter ikke kameraadgang.");
        return;
      }

      setIsStarting(true);
      setCameraError(null);

      try {
        // Probe permission first.
        const probe = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = probe;
        if (!active) {
          await teardown();
          return;
        }
        stopMediaStream(probe);
        streamRef.current = null;

        // Ensure the host element is clear.
        const host = document.getElementById(regionId);
        if (host) host.innerHTML = "";

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );
        if (!active) return;

        const scannerCfg: Html5QrcodeFullConfig = {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        };
        const scanner = new Html5Qrcode(regionId, scannerCfg);
        scannerRef.current = scanner;

        const camCfg: MediaTrackConstraints = { facingMode: "environment" };
        const scanCfg: Html5QrcodeCameraScanConfig = {
          fps: 15, // high frame-rate for instant feel
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        };

        await scanner.start(camCfg, scanCfg, async (decodedText) => {
          if (!active || resolved) return;
          const pin = extractPin(decodedText);
          if (!pin) return;

          resolved = true;

          // Haptic feedback.
          try {
            navigator.vibrate?.(80);
          } catch { /* noop */ }

          // Visual flash.
          setFlash(true);

          // Short delay so user sees the flash, then propagate.
          await new Promise((r) => setTimeout(r, 250));

          await teardown();
          if (!active) return;

          callbackRef.current(pin);
          closeRef.current();
        }, () => { /* missed frame — ignore */ });
      } catch (err) {
        if (!active) return;
        setCameraError(getCameraErrorMessage(err));
        await teardown();
      } finally {
        if (active) setIsStarting(false);
      }
    };

    void start();

    return () => {
      active = false;
      void teardown();
    };
  }, [isOpen, regionId, teardown]);

  // Reset flash when overlay opens/closes.
  useEffect(() => {
    if (!isOpen) setFlash(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      data-testid="qr-scanner-overlay"
    >
      {/* Flash overlay — full-screen white burst, fades quickly */}
      {flash && (
        <div
          className="pointer-events-none absolute inset-0 z-[130] animate-[qr-flash_0.4s_ease-out_forwards] bg-white"
          data-testid="qr-flash"
        />
      )}

      <div
        className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-emerald-500/20 bg-slate-950/95 p-5 shadow-2xl shadow-emerald-500/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          aria-label="Luk scanner"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition hover:text-white"
          data-testid="qr-close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="pt-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Scan QR
          </p>
          <h2 className="mt-1 text-lg font-black text-white">
            Ret kameraet mod koden
          </h2>
        </div>

        {/* Camera viewport with pulsing scan frame */}
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          {/* Camera feed host */}
          <div
            id={regionId}
            className="min-h-[280px] [&>div]:!border-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            data-testid="qr-viewfinder"
          />

          {/* Pulsing scan-frame corners — absolutely positioned over the feed */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="relative h-[200px] w-[200px] animate-[scan-pulse_2s_ease-in-out_infinite]"
              data-testid="qr-scan-frame"
            >
              {/* TL corner */}
              <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l-[3px] border-t-[3px] border-emerald-400" />
              {/* TR corner */}
              <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r-[3px] border-t-[3px] border-emerald-400" />
              {/* BL corner */}
              <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-emerald-400" />
              {/* BR corner */}
              <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b-[3px] border-r-[3px] border-emerald-400" />
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="flex items-center gap-2 text-sm text-white/50">
          {isStarting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <span>Starter kamera…</span>
            </>
          ) : cameraError ? (
            <span className="text-center text-red-300">{cameraError}</span>
          ) : (
            <span className="text-emerald-300/70">Hold QR-koden inden for rammen</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(QrScannerOverlay);
