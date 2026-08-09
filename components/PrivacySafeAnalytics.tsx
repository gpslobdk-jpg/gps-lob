"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

import { RUN_EXECUTION_SHARE_PATH } from "@/lib/runExecutionShare";

export function filterPrivacySafeAnalyticsEvent(event: BeforeSendEvent) {
  try {
    const url = new URL(event.url, "https://analytics.invalid");
    if (
      url.pathname === RUN_EXECUTION_SHARE_PATH ||
      /^\/api\/teacher\/answers\/[^/]+\/photo$/i.test(url.pathname) ||
      url.pathname.includes("/storage/v1/object/sign/participant-uploads/")
    ) {
      return null;
    }

    return event;
  } catch {
    return event;
  }
}

export default function PrivacySafeAnalytics() {
  return <Analytics beforeSend={filterPrivacySafeAnalyticsEvent} />;
}
