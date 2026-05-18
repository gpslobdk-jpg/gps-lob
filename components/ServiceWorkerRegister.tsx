"use client";

import { useEffect } from "react";
import { sendTelemetry } from "@/utils/telemetry";

export default function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production builds; keep dev environment unchanged
    if (process.env.NODE_ENV !== "production") return;

    const tryRegister = async () => {
      try {
        // Prefer the Workbox helper if present (next-pwa exposes `window.workbox`)
        const anyWindow = window as any;
        if (anyWindow.workbox && typeof anyWindow.workbox.register === "function") {
          await anyWindow.workbox.register();
        } else {
          await navigator.serviceWorker.register("/sw.js");
        }
      } catch (err: unknown) {
        const e: any = err as any;
        const name = e?.name ?? "";
        const message = String(e?.message ?? e ?? "");
        const lower = message.toLowerCase();

        // Known benign failure patterns (Safari private browsing, MDM, quota, offline, etc.)
        const isKnownSwRejection =
          name === "SecurityError" ||
          lower.includes("sw.js") ||
          lower.includes("serviceworker") ||
          lower.includes("failed to register") ||
          lower.includes("failed to fetch") ||
          lower.includes("quota") ||
          lower.includes("denied") ||
          lower.includes("not allowed");

        if (isKnownSwRejection) {
          try {
            sendTelemetry("sw_registration_failed", { message });
          } catch (_) {}
          // Swallow known, noisy registration failures so they don't become unhandled rejections.
          // Still log locally for diagnostics.
          // eslint-disable-next-line no-console
          console.warn("ServiceWorker registration failed (handled):", name, message);
          return;
        }

        // Unknown errors: rethrow so global handlers (Sentry) can capture them.
        throw err;
      }
    };

    tryRegister().catch((error: unknown) => {
      // Swallow to avoid unhandled promise rejection noise.
      // eslint-disable-next-line no-console
      console.warn("Service worker registration failed (handled):", error);
    });
  }, []);

  return null;
}
