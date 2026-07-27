// Telemetry: fire-and-forget client-side event logger.
// Two built-in guards keep this from spamming the server:
//   Klippekort — max SESSION_LIMIT calls per browser session (across all event types)
//   Karantæne  — same event_type can only be sent once per QUARANTINE_MS

const SESSION_LIMIT = 20;
const QUARANTINE_MS = 60_000;

const TELEMETRY_MESSAGE_MAX_STRING_LENGTH = 120;
const TELEMETRY_MESSAGE_MAX_TOTAL_LENGTH = 480;

type TelemetryPlatform = "ios" | "android" | "other";

type TelemetryBrowserFamily =
  | "safari"
  | "chrome"
  | "chrome_ios"
  | "firefox"
  | "firefox_ios"
  | "edge"
  | "edge_ios"
  | "samsung_internet"
  | "android_webview"
  | "ios_webview"
  | "facebook_in_app"
  | "instagram_in_app"
  | "snapchat_in_app"
  | "capacitor"
  | "other";

export type ClientTelemetryContext = {
  platform: TelemetryPlatform;
  browser_family: TelemetryBrowserFamily;
  is_ios: boolean;
  is_android: boolean;
  is_webview: boolean;
  is_standalone: boolean;
  online: boolean | null;
};

type TelemetryJsonValue =
  | string
  | number
  | boolean
  | null
  | TelemetryJsonValue[]
  | { [key: string]: TelemetryJsonValue };

const TELEMETRY_SENSITIVE_KEY_PATTERN =
  /(^|_|-|\b)(pin|name|student|token|access_token|refresh_token|jwt|lat|lng|latitude|longitude|coords|location|answer|photo|image|file|cookie|useragent|user_agent|ua|session|participant)(_|-|\b|$)/i;

let sessionCallCount = 0;
const lastSentAt = new Map<string, number>();

function sanitizeTelemetryString(value: string) {
  return value
    .replace(/\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "<redacted-token>")
    .replace(/\b[A-Za-z0-9+/=_-]{40,}\b/g, "<redacted-base64>")
    .replace(/\b0x?[A-Fa-f0-9]{32,}\b/g, "<redacted-hex>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TELEMETRY_MESSAGE_MAX_STRING_LENGTH);
}

function sanitizeTelemetryValue(value: unknown, key?: string): TelemetryJsonValue | undefined {
  const normalizedKey = key?.toLowerCase();
  const compactKey = normalizedKey?.replace(/[^a-z0-9]/g, "") ?? "";
  const containsSensitiveSessionKey = compactKey.includes("session");
  const containsSensitiveParticipantKey = compactKey.includes("participant");
  const containsSensitiveUserAgentKey = compactKey.includes("useragent") || compactKey === "ua";

  if (
    key &&
    (TELEMETRY_SENSITIVE_KEY_PATTERN.test(key) ||
      containsSensitiveSessionKey ||
      containsSensitiveParticipantKey ||
      containsSensitiveUserAgentKey)
  ) {
    return "[redacted]";
  }

  if (typeof value === "string") {
    return sanitizeTelemetryString(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizeTelemetryValue(item))
      .filter((item): item is TelemetryJsonValue => item !== undefined);

    return sanitizedItems;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entryKey, entryValue]) => [entryKey, sanitizeTelemetryValue(entryValue, entryKey)] as const)
      .filter(([, entryValue]) => entryValue !== undefined);

    return Object.fromEntries(entries) as { [key: string]: TelemetryJsonValue };
  }

  return undefined;
}

function resolveBrowserFamily(
  userAgent: string,
  isCapacitorApp: boolean,
  isIos: boolean,
  isAndroid: boolean,
  isKnownInApp: boolean,
  isAndroidWebView: boolean,
  isIosWebView: boolean
): TelemetryBrowserFamily {
  if (isCapacitorApp) return "capacitor";
  if (/FBAN|FBAV/i.test(userAgent)) return "facebook_in_app";
  if (/Instagram/i.test(userAgent)) return "instagram_in_app";
  if (/Snapchat/i.test(userAgent)) return "snapchat_in_app";
  if (isKnownInApp) return "other";
  if (isAndroidWebView) return "android_webview";
  if (isIosWebView) return "ios_webview";
  if (/SamsungBrowser/i.test(userAgent)) return "samsung_internet";
  if (/CriOS/i.test(userAgent)) return "chrome_ios";
  if (/FxiOS/i.test(userAgent)) return "firefox_ios";
  if (/EdgiOS/i.test(userAgent)) return "edge_ios";
  if (isAndroid && /EdgA/i.test(userAgent)) return "edge";
  if (isAndroid && /Firefox/i.test(userAgent)) return "firefox";
  if (isAndroid && /Chrome/i.test(userAgent)) return "chrome";
  if (isIos && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent)) return "safari";

  return "other";
}

export function getClientTelemetryContext(): ClientTelemetryContext {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      platform: "other",
      browser_family: "other",
      is_ios: false,
      is_android: false,
      is_webview: false,
      is_standalone: false,
      online: null,
    };
  }

  const userAgent = window.navigator.userAgent ?? "";
  const isAppleTouchMac =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  const isIos = /iPad|iPhone|iPod/i.test(userAgent) || isAppleTouchMac;
  const isAndroid = /Android/i.test(userAgent);
  const isCapacitorApp = typeof (window as Window & { Capacitor?: unknown }).Capacitor !== "undefined";
  const isKnownInApp = /FBAN|FBAV|Instagram|Snapchat/i.test(userAgent);
  const isAndroidWebView = !isCapacitorApp && isAndroid && /\bwv\b/i.test(userAgent);
  const isIosWebView = isIos && /AppleWebKit/i.test(userAgent) && !/Safari/i.test(userAgent);
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  const isStandalone =
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    Boolean(navigatorWithStandalone.standalone);

  return {
    platform: isIos ? "ios" : isAndroid ? "android" : "other",
    browser_family: resolveBrowserFamily(
      userAgent,
      isCapacitorApp,
      isIos,
      isAndroid,
      isKnownInApp,
      isAndroidWebView,
      isIosWebView
    ),
    is_ios: isIos,
    is_android: isAndroid,
    is_webview: isKnownInApp || isAndroidWebView || isIosWebView,
    is_standalone: isStandalone,
    online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
  };
}

export function buildTelemetryMessage(payload: Record<string, unknown>): string {
  const sanitized = sanitizeTelemetryValue(payload);
  const stringified = JSON.stringify(sanitized ?? {});

  return stringified.length > TELEMETRY_MESSAGE_MAX_TOTAL_LENGTH
    ? JSON.stringify({ reason: "payload_clipped" })
    : stringified;
}

export function createClientTelemetryMessage(payload: Record<string, unknown> = {}): string {
  return buildTelemetryMessage({ ...getClientTelemetryContext(), ...payload });
}

export function sendTelemetry(
  event_type: string,
  data: {
    participant_id?: string | null;
    session_id?: string | null;
    message?: string;
  } = {}
): void {
  // Klippekort: hard cap per browser session
  if (sessionCallCount >= SESSION_LIMIT) return;

  // Karantæne: same event_type may not fire more than once per 60s
  const last = lastSentAt.get(event_type);
  if (last !== undefined && Date.now() - last < QUARANTINE_MS) return;

  sessionCallCount++;
  lastSentAt.set(event_type, Date.now());

  const body = JSON.stringify({
    event_type,
    participant_id: null,
    session_id: null,
    message: data.message ?? null,
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // Beacon: browser queues this outside the JS event loop — true fire-and-forget
      navigator.sendBeacon("/api/telemetry", new Blob([body], { type: "application/json" }));
    } else {
      // Fallback: keepalive ensures the request survives page unload
      void fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently swallow — telemetry must never throw or affect the caller
  }
}
