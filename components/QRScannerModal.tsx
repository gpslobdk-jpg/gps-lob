"use client";

import { Camera, Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Html5Qrcode, Html5QrcodeCameraScanConfig, Html5QrcodeFullConfig } from "html5-qrcode";

type ScanTarget =
  | {
      kind: "internal";
      href: string;
    }
  | {
      kind: "external";
      href: string;
    };

const qrButtonClassName =
  "inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-slate-950/70 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.15)] backdrop-blur-xl transition-all hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-200";

function resolveScanTarget(value: string): ScanTarget | null {
  const trimmedValue = value.trim();
  if (!trimmedValue || typeof window === "undefined") return null;

  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue) || trimmedValue.startsWith("/");
  if (looksLikeUrl) {
    try {
      const parsedUrl = trimmedValue.startsWith("/")
        ? new URL(trimmedValue, window.location.origin)
        : new URL(trimmedValue);
      const pinFromUrl = (parsedUrl.searchParams.get("pin") ?? "").replace(/\D/g, "").slice(0, 6);

      if (pinFromUrl) {
        return {
          kind: "internal",
          href: `/join?pin=${pinFromUrl}`,
        };
      }

      if (parsedUrl.origin === window.location.origin) {
        return {
          kind: "internal",
          href: `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`,
        };
      }

      return {
        kind: "external",
        href: parsedUrl.toString(),
      };
    } catch {
      // Fall through and try simple PIN parsing instead.
    }
  }

  const matchedPin = trimmedValue.match(/\d{4,6}/)?.[0] ?? trimmedValue.replace(/\D/g, "").slice(0, 6);
  if (!matchedPin) return null;

  return {
    kind: "internal",
    href: `/join?pin=${matchedPin}`,
  };
}

export default function QRScannerModal() {
  const router = useRouter();
  const scannerRegionId = useId().replace(/:/g, "-");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isActive = true;
    let hasResolvedScan = false;

    const stopScanner = async () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;

      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {
        // Ignore stop errors during cleanup.
      }

      try {
        scanner.clear();
      } catch {
        // Ignore clear errors during cleanup.
      }
    };

    const startScanner = async () => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setScanError("Din browser understøtter ikke kameraadgang til QR-scanning.");
        return;
      }

      setIsStarting(true);
      setScanError(null);

      try {
        const scannerHost = document.getElementById(scannerRegionId);
        if (scannerHost) {
          scannerHost.innerHTML = "";
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!isActive) return;

        const scannerConfig: Html5QrcodeFullConfig = {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        };
        const scanner = new Html5Qrcode(scannerRegionId, scannerConfig);
        scannerRef.current = scanner;

        const cameraConfig: MediaTrackConstraints = {
          facingMode: { ideal: "environment" },
        };
        const scanConfig: Html5QrcodeCameraScanConfig = {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
        };

        await scanner.start(
          cameraConfig,
          scanConfig,
          async (decodedText) => {
            if (!isActive || hasResolvedScan) return;

            const target = resolveScanTarget(decodedText);
            if (!target) {
              setScanError("QR-koden kunne ikke forstås. Prøv en anden kode.");
              return;
            }

            hasResolvedScan = true;
            await stopScanner();
            if (!isActive) return;

            setIsOpen(false);

            if (target.kind === "internal") {
              router.push(target.href);
              return;
            }

            window.location.href = target.href;
          },
          () => {
            // Ignore frame-by-frame decode misses.
          }
        );
      } catch (error) {
        console.error("Fejl ved start af QR-scanner:", error);
        if (!isActive) return;

        setScanError("Kameraadgang blev afvist eller kunne ikke startes. Prøv igen.");
        await stopScanner();
      } finally {
        if (isActive) {
          setIsStarting(false);
        }
      }
    };

    void startScanner();

    return () => {
      isActive = false;
      void stopScanner();
    };
  }, [isOpen, router, scannerRegionId]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setScanError(null);
          setIsOpen(true);
        }}
        className={qrButtonClassName}
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        <span>Scan QR</span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-[1.75rem] border border-emerald-500/25 bg-slate-950/95 p-5 text-white shadow-[0_24px_60px_rgba(2,6,23,0.52)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Luk QR-scanner"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-12">
              <p className="text-xs font-semibold tracking-[0.24em] text-emerald-300 uppercase">Scan dig ind</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Ret kameraet mod QR-koden</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Tillad kameraadgang, og hold QR-koden foran kameraet. Vi sender dig direkte videre til løbet, så snart
                koden er læst.
              </p>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div
                id={scannerRegionId}
                className="min-h-[280px] overflow-hidden rounded-[1.15rem] bg-slate-950 [&>div]:!border-0 [&_canvas]:rounded-[1rem] [&_video]:h-full [&_video]:w-full [&_video]:rounded-[1rem] [&_video]:object-cover"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
              <span>{isStarting ? "Starter kamera..." : "QR-scanneren er klar."}</span>
              {isStarting ? <Loader2 className="h-4 w-4 animate-spin text-emerald-300" aria-hidden="true" /> : null}
            </div>

            {scanError ? (
              <p className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {scanError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
