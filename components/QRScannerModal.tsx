"use client";

import { Camera, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Html5Qrcode, Html5QrcodeCameraScanConfig, Html5QrcodeFullConfig } from "html5-qrcode";

import { resolveSafeJoinQrTarget } from "@/lib/join/studentJoin";
import { getSiteCopy, type QrScannerCopy } from "@/lib/siteCopy";
import { DEFAULT_SITE_VARIANT } from "@/lib/siteVariant";
import { captureAppMessage } from "@/utils/observability";

type QRScannerModalProps = {
  buttonClassName?: string;
  copy?: QrScannerCopy;
  onCodeScanned?: (code: string) => boolean | void | Promise<boolean | void>;
};

const defaultQrScannerCopy = getSiteCopy(DEFAULT_SITE_VARIANT.key).qrScanner;

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

function getCameraErrorMessage(error: unknown, copy: QrScannerCopy) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return copy.errors.permissionDenied;
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return copy.errors.noCamera;
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return copy.errors.busy;
    }
  }

  return copy.errors.generic;
}

function isExpectedCameraError(error: unknown) {
  return (
    error instanceof DOMException &&
    [
      "NotAllowedError",
      "SecurityError",
      "NotFoundError",
      "DevicesNotFoundError",
      "NotReadableError",
      "TrackStartError",
    ].includes(error.name)
  );
}

function isIgnorableScannerAbortError(reason: unknown) {
  if (reason instanceof DOMException && reason.name === "AbortError") {
    return true;
  }

  if (reason instanceof Error) {
    const message = reason.message.trim();
    return (
      reason.name === "AbortError" ||
      message.includes("AbortError: The operation was aborted") ||
      message === "The operation was aborted."
    );
  }

  if (typeof reason === "string") {
    const message = reason.trim();
    return (
      message.includes("AbortError: The operation was aborted") ||
      message === "The operation was aborted."
    );
  }

  return false;
}

export default function QRScannerModal({
  buttonClassName = "",
  copy = defaultQrScannerCopy,
  onCodeScanned,
}: QRScannerModalProps) {
  const router = useRouter();
  const scannerRegionId = useId().replace(/:/g, "-");
  const titleId = `${scannerRegionId}-title`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const permissionStreamRef = useRef<MediaStream | null>(null);
  const scannerStreamsRef = useRef<Set<MediaStream>>(new Set());
  const restoreGetUserMediaRef = useRef<(() => void) | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [shouldStartCamera, setShouldStartCamera] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const stopTrackedScannerStreams = useCallback(() => {
    scannerStreamsRef.current.forEach((stream) => stopMediaStream(stream));
    scannerStreamsRef.current.clear();
  }, []);

  const closeModal = useCallback(() => {
    restoreGetUserMediaRef.current?.();
    restoreGetUserMediaRef.current = null;
    stopMediaStream(permissionStreamRef.current);
    permissionStreamRef.current = null;
    stopTrackedScannerStreams();

    const scanner = scannerRef.current;
    scannerRef.current = null;
    void disposeScanner(scanner);

    setShouldStartCamera(false);
    setIsStarting(false);
    setIsOpen(false);
  }, [stopTrackedScannerStreams]);

  useEffect(() => {
    if (!isOpen || !shouldStartCamera) {
      return;
    }

    let isActive = true;
    let hasResolvedScan = false;

    const stopScanner = async () => {
      restoreGetUserMediaRef.current?.();
      restoreGetUserMediaRef.current = null;
      stopMediaStream(permissionStreamRef.current);
      permissionStreamRef.current = null;
      stopTrackedScannerStreams();

      const scanner = scannerRef.current;
      scannerRef.current = null;
      await disposeScanner(scanner);
    };

    // Narrow guard: html5-qrcode may call video.play() in a separate async
    // context after scanner.start() resolves, so NotAllowedError can escape
    // our try/catch as an unhandled rejection on iOS/WKWebView.
    // Only active while this modal instance is mounted (isActive flag).
    const handlePlayRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const isAbortError = isIgnorableScannerAbortError(reason);

      // During teardown (!isActive): silently suppress scanner AbortErrors so they
      // don't surface as unhandled rejections while scanner.stop() is in flight.
      if (!isActive) {
        if (isAbortError) event.preventDefault();
        return;
      }

      // AbortError while active means the modal was closed while the camera was
      // still starting – suppress silently, no error UI needed.
      if (isAbortError) {
        event.preventDefault();
        return;
      }

      const isMediaNotAllowed =
        (reason instanceof DOMException &&
          (reason.name === "NotAllowedError" || reason.name === "SecurityError")) ||
        (typeof (reason as { message?: unknown })?.message === "string" &&
          /not allowed|permission/i.test((reason as { message: string }).message));
      if (!isMediaNotAllowed) return;
      event.preventDefault();
      setCameraError(copy.errors.permissionDenied);
      setIsStarting(false);
      void stopScanner();
    };

    window.addEventListener("unhandledrejection", handlePlayRejection);

    const handleDecodedText = async (decodedText: string) => {
      if (!isActive || hasResolvedScan) return;

      const target = resolveSafeJoinQrTarget(
        decodedText,
        window.location.origin
      );
      if (!target) {
        setScanError(copy.scanFailed);
        return;
      }

      hasResolvedScan = true;
      await stopScanner();
      if (!isActive) return;

      if (target.kind === "internal-route") {
        setShouldStartCamera(false);
        setIsOpen(false);
        router.push(target.href);
        return;
      }

      try {
        const accepted = onCodeScanned
          ? await onCodeScanned(target.code)
          : undefined;

        if (accepted === false) {
          hasResolvedScan = false;
          setScanError(copy.scanFailed);
          setShouldStartCamera(false);
          return;
        }
      } catch {
        hasResolvedScan = false;
        setScanError(copy.scanFailed);
        setShouldStartCamera(false);
        return;
      }

      if (!isActive) return;

      setShouldStartCamera(false);
      setIsOpen(false);

      if (!onCodeScanned) {
        router.push(`/join?pin=${encodeURIComponent(target.code)}`);
      }
    };

    const testWindow = window as Window & {
      __joinQrTestHook?: (value: string) => void;
    };
    testWindow.__joinQrTestHook = (value) => {
      void handleDecodedText(value);
    };

    const startScanner = async () => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setCameraError(
          copy.errors.unsupported
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

        const mediaDevices = navigator.mediaDevices;
        const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
        const restoreGetUserMedia = () => {
          if (mediaDevices.getUserMedia === trackedGetUserMedia) {
            mediaDevices.getUserMedia = originalGetUserMedia;
          }
          if (restoreGetUserMediaRef.current === restoreGetUserMedia) {
            restoreGetUserMediaRef.current = null;
          }
        };
        const trackedGetUserMedia: MediaDevices["getUserMedia"] = async (
          constraints,
        ) => {
          restoreGetUserMedia();
          const stream = await originalGetUserMedia(constraints);
          scannerStreamsRef.current.add(stream);
          if (!isActive) {
            stopMediaStream(stream);
          }
          return stream;
        };
        mediaDevices.getUserMedia = trackedGetUserMedia;
        restoreGetUserMediaRef.current = restoreGetUserMedia;

        await scanner.start(
          cameraConfig,
          scanConfig,
          handleDecodedText,
          () => {
            // Ignore frame-by-frame decode misses.
          }
        );

        // Closing while html5-qrcode is still starting can make the original
        // cleanup run before isScanning becomes true. Dispose once more after
        // start resolves so a late camera stream cannot survive the modal.
        if (!isActive || scannerRef.current !== scanner) {
          await disposeScanner(scanner);
        }
      } catch (error) {
        if (!isActive) return;

        setCameraError(getCameraErrorMessage(error, copy));
        if (!isExpectedCameraError(error)) {
          captureAppMessage("qr_scanner_initialization_failed", {
            category: "qr_scanner_initialization_failed",
            routeType: "student_join",
            online:
              typeof navigator.onLine === "boolean" ? navigator.onLine : null,
          });
        }
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
      delete testWindow.__joinQrTestHook;
      // Keep the listener alive until stopScanner completes so it can suppress
      // any AbortError that html5-qrcode emits during video teardown.
      void stopScanner().finally(() => {
        window.removeEventListener("unhandledrejection", handlePlayRejection);
      });
    };
  }, [
    copy,
    isOpen,
    onCodeScanned,
    router,
    scannerRegionId,
    shouldStartCamera,
    stopTrackedScannerStreams,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeModal, isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCameraError(null);
          setScanError(null);
          setShouldStartCamera(false);
          setIsOpen(true);
        }}
        className={`${qrButtonClassName} ${buttonClassName}`.trim()}
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        <span>{copy.buttonLabel}</span>
      </button>

      {isOpen ? createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeModal}
          data-testid="join-qr-dialog-backdrop"
        >
          <div
            className="relative w-full max-w-md rounded-[1.75rem] border border-emerald-500/25 bg-slate-950/95 p-5 text-white shadow-[0_24px_60px_rgba(2,6,23,0.52)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="join-qr-dialog"
          >
            <button
              type="button"
              aria-label={copy.closeAriaLabel}
              onClick={closeModal}
              className="absolute top-4 right-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              data-testid="join-qr-close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-12">
              <p className="text-xs font-semibold tracking-[0.24em] text-emerald-300 uppercase">{copy.eyebrow}</p>
              <h2
                id={titleId}
                className="mt-2 text-2xl font-black tracking-tight text-white"
              >
                {copy.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {copy.description}
              </p>
            </div>

            {shouldStartCamera ? (
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div
                  id={scannerRegionId}
                  className="min-h-[280px] overflow-hidden rounded-[1.15rem] bg-slate-950 [&>div]:!border-0 [&_canvas]:rounded-[1rem] [&_video]:h-full [&_video]:w-full [&_video]:rounded-[1rem] [&_video]:object-cover"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCameraError(null);
                  setScanError(null);
                  setShouldStartCamera(true);
                }}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
                data-testid="join-qr-start"
              >
                {copy.startButtonLabel}
              </button>
            )}

            {shouldStartCamera ? (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>
                  {isStarting
                    ? copy.startingCamera
                    : cameraError
                      ? copy.failed
                      : copy.ready}
                </span>
                {isStarting ? (
                  <Loader2
                    className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none text-emerald-300"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ) : null}

            {cameraError ? (
              <p
                className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50"
                role="alert"
              >
                {cameraError}
              </p>
            ) : null}

            {scanError ? (
              <p
                className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                role="alert"
              >
                {scanError}
              </p>
            ) : null}

            <p className="mt-4 text-sm leading-6 text-slate-300">
              {copy.manualFallback}
            </p>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
