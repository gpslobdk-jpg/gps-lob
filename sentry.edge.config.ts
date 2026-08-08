// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  sanitizeObservabilityObject,
  sanitizeSentryEvent,
} from "./lib/observability/privacy";

Sentry.init({
  dsn: "https://31175c8fd32fcc439aaa2479b9191608@o4511262707351552.ingest.de.sentry.io/4511262710038608",
  enabled: process.env.SENTRY_ENABLED === "true",
  environment:
    process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Avoid automatic request/IP/header enrichment in production events.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,

  beforeSend(event) {
    return sanitizeSentryEvent(event);
  },
  beforeSendTransaction(event) {
    return sanitizeSentryEvent(event);
  },
  beforeSendLog(log) {
    return sanitizeObservabilityObject(log);
  },
});
