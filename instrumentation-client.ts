// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  sanitizeObservabilityObject,
  sanitizeSentryEvent,
} from "@/lib/observability/privacy";
import { ensureBugsnag } from "@/utils/observability";

function sanitizeClientTelemetryObject<T extends object>(value: T): T | null {
  try {
    return sanitizeObservabilityObject(value);
  } catch {
    return null;
  }
}

function sanitizeClientSentryEvent<T extends object>(event: T): T | null {
  try {
    return sanitizeSentryEvent(event);
  } catch {
    return null;
  }
}

Sentry.init({
  dsn: "https://31175c8fd32fcc439aaa2479b9191608@o4511262707351552.ingest.de.sentry.io/4511262710038608",
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Avoid automatic request/IP/header enrichment in browser events.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
  // Ignore noisy Leaflet runtime errors reported from some browsers/clients
  ignoreErrors: [
    "undefined is not an object (evaluating 't._leaflet_pos')",
    "Cannot read properties of undefined (reading '_leaflet_pos')",
  ],
  beforeBreadcrumb(breadcrumb) {
    return sanitizeClientTelemetryObject(breadcrumb);
  },
  beforeSendTransaction(event) {
    return sanitizeClientSentryEvent(event);
  },
  beforeSendLog(log) {
    return sanitizeClientTelemetryObject(log);
  },
  // Add a beforeSend filter to drop specific Facebook iOS WebView noise
  beforeSend(event) {
    const userAgentHeader =
      event?.request?.headers?.["User-Agent"] ??
      event?.request?.headers?.["user-agent"] ??
      (typeof navigator !== "undefined" ? navigator.userAgent : undefined);

    // Check if the event contains the specific error message
    const isWebkitError =
      event?.exception?.values?.some((exception) =>
        exception.value?.includes("window.webkit.messageHandlers") ||
        exception.value?.includes("evaluating 'window.webkit.messageHandlers'")
      );

    // Check if the browser or user-agent indicates Facebook iOS WebView
    const isFacebookWebView =
      event?.contexts?.browser?.name === "Facebook" ||
      userAgentHeader?.includes("FBAN/FBIOS") ||
      userAgentHeader?.includes("FBAV");

    // Drop the event if both conditions are met
    if (isWebkitError && isFacebookWebView) {
      return null;
    }

    // Drop iOS Safari SecurityError from service worker registration.
    // next-pwa/Workbox injects window.workbox.register() without a .catch(),
    // so Safari private browsing / MDM restrictions cause an unhandled rejection.
    // The app continues to work normally (NetworkOnly fallback); this is noise.
    const isSwLoadFailed = event?.exception?.values?.some(
      (exception) =>
        exception.value?.includes("sw.js load failed") ||
        (exception.type === "SecurityError" &&
          exception.value?.includes("sw.js"))
    );
    const mechanismType =
      event?.exception?.values?.[0]?.mechanism?.type;
    if (isSwLoadFailed && mechanismType === "onunhandledrejection") {
      return null;
    }

    return sanitizeClientSentryEvent(event);
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Initialize Bugsnag client-side (best-effort). Disabled if no API key.
try {
  if (window.location.pathname !== "/del/afvikling") {
    ensureBugsnag();
  }
} catch {}
