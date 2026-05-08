// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { ensureBugsnag } from "@/utils/observability";

Sentry.init({
  dsn: "https://31175c8fd32fcc439aaa2479b9191608@o4511262707351552.ingest.de.sentry.io/4511262710038608",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  // Ignore noisy Leaflet runtime errors reported from some browsers/clients
  ignoreErrors: [
    "undefined is not an object (evaluating 't._leaflet_pos')",
    "Cannot read properties of undefined (reading '_leaflet_pos')",
  ],
  // Add a beforeSend filter to drop specific Facebook iOS WebView noise
  beforeSend(event) {
    // Check if the event contains the specific error message
    const isWebkitError =
      event?.exception?.values?.some((exception) =>
        exception.value?.includes("window.webkit.messageHandlers") ||
        exception.value?.includes("evaluating 'window.webkit.messageHandlers'")
      );

    // Check if the browser or user-agent indicates Facebook iOS WebView
    const isFacebookWebView =
      event?.contexts?.browser?.name === "Facebook" ||
      event?.request?.headers?.['User-Agent']?.includes("FBAN/FBIOS") ||
      event?.request?.headers?.['User-Agent']?.includes("FBAV");

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

    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Initialize Bugsnag client-side (best-effort). Disabled if no API key.
try {
  ensureBugsnag();
} catch (_) {}
