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

type QRScannerModalProps = {
  buttonClassName?: string;
};

const qrButtonClassName =
  "inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-slate-950/70 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.15)] backdrop-blur-xl transition-all hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-200";

function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function disposeScanner(scanner: Html5Qrcode | null) {
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
}

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Kamera-adgang naegtet. For at bruge scanneren skal du tillade kamera i din browsers indstillinger (ofte oppe i adressebaren). Ellers kan du lukke denne boks og taste pinkoden manuelt.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "Vi kunne ikke finde et kamera paa denne enhed. Du kan lukke denne boks og taste pinkoden manuelt.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "Kameraet er allerede i brug af en anden app eller browser-fane. Luk denne boks og proev igen, eller tast pinkoden manuelt.";
    }
  }

  return "Kameraet kunne ikke startes lige nu. Du kan proeve igen eller lukke denne boks og taste pinkoden manuelt.";
}

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

export default function QRScannerModal({ buttonClassName = "" }: QRScannerModalProps) {
  const router = useRouter();
  const scannerRegionId = useId().replace(/:/g, "-");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const permissionStreamRef = useRef<MediaStream | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const closeModal = () => {
    stopMediaStream(permissionStreamRef.current);
    permissionStreamRef.current = null;

    const scanner = scannerRef.current;
    scannerRef.current = null;
    void disposeScanner(scanner);

    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isActive = true;
    let hasResolvedScan = false;

    const stopScanner = async () => {
      stopMediaStream(permissionStreamRef.current);
      permissionStreamRef.current = null;

      const scanner = scannerRef.current;
      scannerRef.current = null;
      await disposeScanner(scanner);
    };

    const startScanner = async () => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setCameraError(
          "Din browser understotter ikke kameraadgang til QR-scanning. Du kan lukke denne boks og taste pinkoden manuelt."
        );
        return;
      }

      setIsStarting(true);
      setCameraError(null);
      setScanError(null);

      try {
        const permissionProbeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        permissionStreamRef.current = permissionProbeStream;

        if (!isActive) {
          await stopScanner();
          return;
        }

        stopMediaStream(permissionProbeStream);
        permissionStreamRef.current = null;

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
          facingMode: "environment",
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
              setScanError("QR-koden kunne ikke forstaas. Proev en anden kode.");
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

        setCameraError(getCameraErrorMessage(error));
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
          setCameraError(null);
          setScanError(null);
          setIsOpen(true);
        }}
        className={`${qrButtonClassName} ${buttonClassName}`.trim()}
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        <span>Scan QR</span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-md rounded-[1.75rem] border border-emerald-500/25 bg-slate-950/95 p-5 text-white shadow-[0_24px_60px_rgba(2,6,23,0.52)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Luk QR-scanner"
              onClick={closeModal}
              className="absolute top-4 right-4 rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-12">
              <p className="text-xs font-semibold tracking-[0.24em] text-emerald-300 uppercase">Scan dig ind</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Ret kameraet mod QR-koden</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Tillad kameraadgang, og hold QR-koden foran kameraet. Vi sender dig direkte videre til loebet, saa
                snart koden er laest.
              </p>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div
                id={scannerRegionId}
                className="min-h-[280px] overflow-hidden rounded-[1.15rem] bg-slate-950 [&>div]:!border-0 [&_canvas]:rounded-[1rem] [&_video]:h-full [&_video]:w-full [&_video]:rounded-[1rem] [&_video]:object-cover"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
              <span>
                {isStarting
                  ? "Starter kamera..."
                  : cameraError
                    ? "Kameraet kunne ikke startes."
                    : "QR-scanneren er klar."}
              </span>
              {isStarting ? <Loader2 className="h-4 w-4 animate-spin text-emerald-300" aria-hidden="true" /> : null}
            </div>

            {cameraError ? (
              <p className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                {cameraError}
              </p>
            ) : null}

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
