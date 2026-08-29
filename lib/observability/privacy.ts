export const REDACTED_OBSERVABILITY_VALUE = "[redacted]";
export const CIRCULAR_OBSERVABILITY_VALUE = "[circular]";
export const TRUNCATED_OBSERVABILITY_VALUE = "[truncated]";
export const UNSANITIZABLE_OBSERVABILITY_VALUE = "[unavailable]";

const MAX_OBSERVABILITY_DEPTH = 24;
const MAX_OBSERVABILITY_NODES = 5_000;
const MAX_OBSERVABILITY_COLLECTION_SIZE = 250;
const MAX_OBSERVABILITY_STRING_LENGTH = 20_000;
const TRUNCATED_COLLECTION_KEY = "__truncated__";

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const RUN_EXECUTION_SHARE_TOKEN_PATTERN =
  /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g;
const JOIN_CODE_PATTERN =
  /\b(?=[0-9A-ZÆØÅ]{6}\b)(?=[0-9A-ZÆØÅ]*\d)[0-9A-ZÆØÅ]{6}\b/giu;
const SENSITIVE_INLINE_VALUE_PATTERN =
  /(\b(?:pin|join[_ -]?code|session[_ -]?(?:id|code|pin)|participant[_ -]?id|student[_ -]?name|team[_ -]?name|holdnavn|auth[_ -]?token|access[_ -]?token|refresh[_ -]?token|qr[_ -]?(?:code|content)|answer|selected[_ -]?index|latitude|longitude|lat|lng|transcript|audio|microphone|utterance|conversation)\b["']?\s*(?::|=|\bis\b)\s*)(?:"[^"]*"|'[^']*'|[^,\s;}\]]+)/giu;

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
    compactKey === "token" ||
    compactKey.includes("sharetoken") ||
    compactKey === "jwt" ||
    compactKey === "answer" ||
    compactKey.includes("transcript") ||
    compactKey.includes("audio") ||
    compactKey.includes("microphone") ||
    compactKey.includes("utterance") ||
    compactKey.includes("conversation") ||
    compactKey.includes("studentquestion") ||
    compactKey.includes("characterresponse") ||
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
    compactKey.includes("location") ||
    compactKey === "ip" ||
    compactKey === "ipaddress" ||
    compactKey === "remoteaddr"
  );
}

export function sanitizeObservabilityUrl(value: string) {
  const sanitizePath = (pathname: string) =>
    pathname
      .replace(/^\/play\/[^/]+/i, "/play/[sessionId]")
      .replace(
        /^\/find-bedrageren\/(?!join(?:\/|$))[^/]+/i,
        "/find-bedrageren/[sessionId]"
      )
      .replace(
        /^\/del\/afvikling\/[^/]+/i,
        "/del/afvikling/[redacted]"
      )
      .replace(
        /^\/api\/teacher\/answers\/[^/]+\/photo/i,
        "/api/teacher/answers/[redacted]/photo"
      )
      .replace(
        /^\/storage\/v1\/object\/(?:public|authenticated|sign)\/participant-uploads\/.*/i,
        "/storage/v1/object/[redacted]/participant-uploads/[redacted]"
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

type SanitizationState = {
  ancestors: WeakSet<object>;
  remainingNodes: number;
};

function sanitizeJsonString(
  value: string,
  state: SanitizationState,
  depth: number
) {
  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith("{") && !trimmedValue.startsWith("[")) {
    return null;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(trimmedValue);
  } catch {
    return null;
  }

  const sanitizedValue = sanitizeObservabilityDataInternal(
    parsedValue,
    "",
    depth + 1,
    state
  );

  try {
    return JSON.stringify(sanitizedValue);
  } catch {
    return JSON.stringify(UNSANITIZABLE_OBSERVABILITY_VALUE);
  }
}

function sanitizeObservabilityString(
  value: string,
  key: string,
  state: SanitizationState,
  depth: number
) {
  if (value.length > MAX_OBSERVABILITY_STRING_LENGTH) {
    return TRUNCATED_OBSERVABILITY_VALUE;
  }

  const sanitizedJson = sanitizeJsonString(value, state, depth);
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
    .replace(RUN_EXECUTION_SHARE_TOKEN_PATTERN, REDACTED_OBSERVABILITY_VALUE)
    .replace(UUID_PATTERN, REDACTED_OBSERVABILITY_VALUE)
    .replace(
      SENSITIVE_INLINE_VALUE_PATTERN,
      `$1${REDACTED_OBSERVABILITY_VALUE}`
    )
    .replace(JOIN_CODE_PATTERN, REDACTED_OBSERVABILITY_VALUE);
}

function sanitizeObservabilityDataInternal(
  value: unknown,
  key: string,
  depth: number,
  state: SanitizationState
): unknown {
  if (key && isSensitiveObservabilityKey(key)) {
    return REDACTED_OBSERVABILITY_VALUE;
  }

  if (state.remainingNodes <= 0) {
    return TRUNCATED_OBSERVABILITY_VALUE;
  }
  state.remainingNodes -= 1;

  if (typeof value === "string") {
    return sanitizeObservabilityString(value, key, state, depth);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (value === undefined) {
    return value;
  }

  if (value && typeof value === "object") {
    if (depth >= MAX_OBSERVABILITY_DEPTH) {
      return TRUNCATED_OBSERVABILITY_VALUE;
    }

    if (state.ancestors.has(value)) {
      return CIRCULAR_OBSERVABILITY_VALUE;
    }

    state.ancestors.add(value);

    try {
      if (Array.isArray(value)) {
        const outputLength = Math.min(
          value.length,
          MAX_OBSERVABILITY_COLLECTION_SIZE
        );
        const sanitizedArray = new Array<unknown>(outputLength);

        for (let index = 0; index < outputLength; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, index);
          if (!descriptor) {
            continue;
          }

          sanitizedArray[index] =
            "value" in descriptor
              ? sanitizeObservabilityDataInternal(
                  descriptor.value,
                  "",
                  depth + 1,
                  state
                )
              : UNSANITIZABLE_OBSERVABILITY_VALUE;
        }

        if (value.length > MAX_OBSERVABILITY_COLLECTION_SIZE) {
          sanitizedArray.push(TRUNCATED_OBSERVABILITY_VALUE);
        }

        return sanitizedArray;
      }

      const entryKeys = Object.keys(value);
      const sanitizedEntries: Array<[string, unknown]> = [];

      for (const entryKey of entryKeys.slice(
        0,
        MAX_OBSERVABILITY_COLLECTION_SIZE
      )) {
        const descriptor = Object.getOwnPropertyDescriptor(value, entryKey);
        const sanitizedValue =
          descriptor && "value" in descriptor
            ? sanitizeObservabilityDataInternal(
                descriptor.value,
                entryKey,
                depth + 1,
                state
              )
            : UNSANITIZABLE_OBSERVABILITY_VALUE;

        sanitizedEntries.push([entryKey, sanitizedValue]);
      }

      if (entryKeys.length > MAX_OBSERVABILITY_COLLECTION_SIZE) {
        sanitizedEntries.push([
          TRUNCATED_COLLECTION_KEY,
          TRUNCATED_OBSERVABILITY_VALUE,
        ]);
      }

      return Object.fromEntries(sanitizedEntries);
    } finally {
      state.ancestors.delete(value);
    }
  }

  return UNSANITIZABLE_OBSERVABILITY_VALUE;
}

export function sanitizeObservabilityData(
  value: unknown,
  key = ""
): unknown {
  try {
    return sanitizeObservabilityDataInternal(value, key, 0, {
      ancestors: new WeakSet<object>(),
      remainingNodes: MAX_OBSERVABILITY_NODES,
    });
  } catch {
    return UNSANITIZABLE_OBSERVABILITY_VALUE;
  }
}

export function sanitizeObservabilityObject<T extends object>(
  value: T
): T | null {
  try {
    const sanitizedValue = sanitizeObservabilityData(value);
    if (
      !sanitizedValue ||
      typeof sanitizedValue !== "object" ||
      Array.isArray(sanitizedValue)
    ) {
      return null;
    }

    return sanitizedValue as T;
  } catch {
    return null;
  }
}

export function sanitizeSentryEvent<T extends object>(event: T): T | null {
  try {
    const sanitizedEvent = sanitizeObservabilityObject(event);
    if (!sanitizedEvent) {
      return null;
    }

    const eventRecord = sanitizedEvent as Record<string, unknown>;
    eventRecord.user = undefined;
    eventRecord.server_name = undefined;

    if (eventRecord.request && typeof eventRecord.request === "object") {
      const request = eventRecord.request as Record<string, unknown>;
      request.cookies = undefined;
      request.data = undefined;
      request.env = undefined;
      request.headers = undefined;
      request.query_string = undefined;
    }

    if (eventRecord.contexts && typeof eventRecord.contexts === "object") {
      const contexts = eventRecord.contexts as Record<string, unknown>;
      contexts.app = undefined;
      contexts.cloud_resource = undefined;
      contexts.culture = undefined;
      contexts.device = undefined;
      contexts.gpu = undefined;
      contexts.os = undefined;
      contexts.runtime = undefined;
    }

    return sanitizedEvent;
  } catch {
    return null;
  }
}
