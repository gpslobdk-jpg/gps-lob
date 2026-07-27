export const JOIN_CODE_LENGTH = 6;

const OFFICIAL_JOIN_HOSTS = new Set([
  "gpslob.dk",
  "www.gpslob.dk",
  "skolegps.dk",
  "www.skolegps.dk",
  "postlob.net",
  "www.postlob.net",
]);

export type SafeJoinQrTarget =
  | {
      kind: "code";
      code: string;
    }
  | {
      kind: "internal-route";
      href: "/find-bedrageren/join";
    };

export function normalizeJoinCode(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .toLocaleUpperCase("da-DK")
    .replace(/[\s-]+/g, "")
    .replace(/[^0-9A-ZÆØÅ]/g, "")
    .slice(0, JOIN_CODE_LENGTH);
}

export function isCompleteJoinCode(value: unknown) {
  if (typeof value !== "string" || /[^0-9A-ZÆØÅ\s-]/iu.test(value)) {
    return false;
  }

  return (
    value.toLocaleUpperCase("da-DK").replace(/[\s-]+/g, "").length ===
    JOIN_CODE_LENGTH
  );
}

function isTrustedJoinOrigin(url: URL, currentOrigin?: string) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false;
  }

  if (currentOrigin) {
    try {
      if (url.origin === new URL(currentOrigin).origin) {
        return true;
      }
    } catch {
      // Ignore an invalid caller-provided origin and use the fixed allowlist.
    }
  }

  return OFFICIAL_JOIN_HOSTS.has(url.hostname.toLocaleLowerCase("en-US"));
}

export function resolveSafeJoinQrTarget(
  value: unknown,
  currentOrigin?: string
): SafeJoinQrTarget | null {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const looksLikeUrl =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue) ||
    trimmedValue.startsWith("/");

  if (looksLikeUrl) {
    try {
      const parsedUrl = trimmedValue.startsWith("/")
        ? new URL(trimmedValue, currentOrigin ?? "https://gpslob.dk")
        : new URL(trimmedValue);
      const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "") || "/";

      if (!isTrustedJoinOrigin(parsedUrl, currentOrigin)) {
        return null;
      }

      if (normalizedPath === "/find-bedrageren/join") {
        return {
          kind: "internal-route",
          href: "/find-bedrageren/join",
        };
      }

      if (normalizedPath !== "/join") {
        return null;
      }

      const rawCode = parsedUrl.searchParams.get("pin");
      const code = normalizeJoinCode(rawCode);
      return isCompleteJoinCode(rawCode) ? { kind: "code", code } : null;
    } catch {
      return null;
    }
  }

  if (!/^[0-9A-ZÆØÅ\s-]+$/iu.test(trimmedValue)) {
    return null;
  }

  const code = normalizeJoinCode(trimmedValue);
  return isCompleteJoinCode(trimmedValue) ? { kind: "code", code } : null;
}

export function extractJoinCodeFromQr(value: unknown, currentOrigin?: string) {
  const target = resolveSafeJoinQrTarget(value, currentOrigin);
  return target?.kind === "code" ? target.code : null;
}
