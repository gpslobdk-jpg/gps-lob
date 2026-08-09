const LOCAL_ORIGIN_PATTERN = /^http:\/\/(?:[a-z0-9-]+\.)?localhost(?::\d{1,5})?$|^http:\/\/127\.0\.0\.1(?::\d{1,5})?$/;

export const FAMILY_SSO_TTL_SECONDS = 90;
export const FAMILY_SSO_CLOCK_SKEW_SECONDS = 30;
export const FAMILY_SSO_REQUEST_PATTERN = /^[A-Za-z0-9_-]{32,96}$/;

export function isFamilySsoEnabled() {
  return process.env.FAMILY_SSO_ENABLED === "true";
}

export function getDagensTavleSsoOrigin() {
  const raw = process.env.DAGENSTAVLE_SSO_ORIGIN?.trim();
  if (!raw) return null;

  try {
    const origin = new URL(raw).origin;
    const isAllowed =
      origin === "https://dagenstavle.dk" ||
      origin.endsWith(".vercel.app") && origin.startsWith("https://") ||
      process.env.NODE_ENV !== "production" && LOCAL_ORIGIN_PATTERN.test(origin);
    return isAllowed ? origin : null;
  } catch {
    return null;
  }
}

export function getFamilySsoExchangeSecret() {
  const secret = process.env.FAMILY_SSO_EXCHANGE_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function isTrustedSkoleGpsRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") !== "same-origin") return false;
  if (origin === "https://skolegps.dk") return true;
  return process.env.NODE_ENV !== "production" && LOCAL_ORIGIN_PATTERN.test(origin);
}

export function getSafeDagensTavlePath(value: unknown, fallback = "/skema") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }

  let decoded = value;
  try {
    for (let pass = 0; pass < 2; pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return fallback;
  }
  if (
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(decoded) ||
    decoded.split(/[?#]/, 1)[0].split("/").includes("..")
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://dagenstavle.dk");
    if (parsed.origin !== "https://dagenstavle.dk") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
