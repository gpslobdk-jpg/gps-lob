export const REDACTED_OBSERVABILITY_VALUE = "[redacted]";

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const JOIN_CODE_PATTERN =
  /\b(?=[0-9A-ZÆØÅ]{6}\b)(?=[0-9A-ZÆØÅ]*\d)[0-9A-ZÆØÅ]{6}\b/giu;
const SENSITIVE_INLINE_VALUE_PATTERN =
  /(\b(?:pin|join[_ -]?code|session[_ -]?(?:id|code|pin)|participant[_ -]?id|student[_ -]?name|team[_ -]?name|holdnavn|auth[_ -]?token|access[_ -]?token|refresh[_ -]?token|qr[_ -]?(?:code|content)|answer|selected[_ -]?index|latitude|longitude|lat|lng)\b["']?\s*(?::|=|\bis\b)\s*)(?:"[^"]*"|'[^']*'|[^,\s;}\]]+)/giu;

function isSensitiveObservabilityKey(key: string) {
  const compactKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

  return (
    compactKey === "pin" ||
    compactKey === "code" ||
    compactKey === "name" ||
    compactKey === "username" ||
    compactKey === "email" ||
    compactKey === "user" ||
    compactKey === "student" ||
    compactKey === "team" ||
    compactKey === "participant" ||
    compactKey === "authorization" ||
    compactKey === "query" ||
    compactKey === "querystring" ||
    compactKey === "searchparams" ||
    compactKey === "cookie" ||
    compactKey === "cookies" ||
    compactKey === "setcookie" ||
    compactKey === "qr" ||
    compactKey === "qrcode" ||
    compactKey === "qrcontent" ||
    compactKey.includes("joincode") ||
    compactKey.includes("studentname") ||
    compactKey.includes("teamname") ||
    compactKey.includes("sessionid") ||
    compactKey.includes("sessioncode") ||
    compactKey.includes("sessionpin") ||
    compactKey.includes("participantid") ||
    compactKey.includes("authtoken") ||
    compactKey.includes("accesstoken") ||
    compactKey.includes("refreshtoken") ||
    compactKey === "jwt" ||
    compactKey === "answer" ||
    compactKey.includes("selectedindex") ||
    compactKey.includes("awardedpoints") ||
    compactKey.includes("postindex") ||
    compactKey.includes("postnumber") ||
    compactKey.includes("photo") ||
    compactKey.includes("image") ||
    compactKey === "lat" ||
    compactKey === "lng" ||
    compactKey.includes("latitude") ||
    compactKey.includes("longitude") ||
    compactKey.includes("coords") ||
    compactKey.includes("location")
  );
}

export function sanitizeObservabilityUrl(value: string) {
  const sanitizePath = (pathname: string) =>
    pathname
      .replace(/^\/play\/[^/]+/i, "/play/[sessionId]")
      .replace(
        /^\/find-bedrageren\/(?!join(?:\/|$))[^/]+/i,
        "/find-bedrageren/[sessionId]"
      );

  try {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
    const parsed = new URL(value, "https://privacy.invalid");
    parsed.pathname = sanitizePath(parsed.pathname);
    parsed.search = "";
    parsed.hash = "";

    return isAbsolute ? parsed.toString() : parsed.pathname;
  } catch {
    return value.split("?")[0]?.split("#")[0] ?? value;
  }
}

function sanitizeJsonString(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith("{") && !trimmedValue.startsWith("[")) {
    return null;
  }

  try {
    return JSON.stringify(sanitizeObservabilityData(JSON.parse(trimmedValue)));
  } catch {
    return null;
  }
}

function sanitizeObservabilityString(value: string, key = "") {
  const sanitizedJson = sanitizeJsonString(value);
  if (sanitizedJson !== null) {
    return sanitizedJson;
  }

  let sanitizedValue = value;

  if (/(^|_|-)(url|href|route|path|referer|referrer)($|_|-)/i.test(key)) {
    if (/^(?:[a-z][a-z0-9+.-]*:\/\/|\/)/i.test(sanitizedValue)) {
      sanitizedValue = sanitizeObservabilityUrl(sanitizedValue);
    }
  }

  return sanitizedValue
    .replace(
      /(?:https?:\/\/|\/)[^\s"'?]+(?:\?[^\s"']*)?/gi,
      (candidate) => sanitizeObservabilityUrl(candidate)
    )
    .replace(BEARER_TOKEN_PATTERN, REDACTED_OBSERVABILITY_VALUE)
    .replace(JWT_PATTERN, REDACTED_OBSERVABILITY_VALUE)
    .replace(UUID_PATTERN, REDACTED_OBSERVABILITY_VALUE)
    .replace(
      SENSITIVE_INLINE_VALUE_PATTERN,
      `$1${REDACTED_OBSERVABILITY_VALUE}`
    )
    .replace(JOIN_CODE_PATTERN, REDACTED_OBSERVABILITY_VALUE);
}

export function sanitizeObservabilityData(
  value: unknown,
  key = ""
): unknown {
  if (key && isSensitiveObservabilityKey(key)) {
    return REDACTED_OBSERVABILITY_VALUE;
  }

  if (typeof value === "string") {
    return sanitizeObservabilityString(value, key);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObservabilityData(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeObservabilityData(entryValue, entryKey),
      ])
    );
  }

  return value;
}

export function sanitizeSentryEvent<T>(event: T): T {
  const sanitizedEvent = sanitizeObservabilityData(event) as T;

  if (sanitizedEvent && typeof sanitizedEvent === "object") {
    (sanitizedEvent as Record<string, unknown>).user = undefined;
  }

  return sanitizedEvent;
}
