const LOCAL_ORIGIN_PATTERN = /^http:\/\/(?:[a-z0-9-]+\.)?localhost(?::\d{1,5})?$|^http:\/\/127\.0\.0\.1(?::\d{1,5})?$/;
const SKOLEGPS_PRODUCTION_ORIGIN = "https://www.skolegps.dk";

export const FAMILY_SSO_TTL_SECONDS = 90;
export const FAMILY_SSO_CLOCK_SKEW_SECONDS = 30;
export const FAMILY_SSO_REQUEST_PATTERN = /^[A-Za-z0-9_-]{32,96}$/;
export const FAMILY_SSO_AUDIENCES = ["dagenstavle", "printmitarbejdsark"] as const;

export type FamilySsoAudience = (typeof FAMILY_SSO_AUDIENCES)[number];

const destinations: Record<FamilySsoAudience, {
  canonicalOrigin: string;
  originVariable: "DAGENSTAVLE_SSO_ORIGIN" | "PRINTMITARBEJDSARK_SSO_ORIGIN";
  fallbackPath: string;
}> = {
  dagenstavle: {
    canonicalOrigin: "https://dagenstavle.dk",
    originVariable: "DAGENSTAVLE_SSO_ORIGIN",
    fallbackPath: "/skema",
  },
  printmitarbejdsark: {
    canonicalOrigin: "https://printmitarbejdsark.dk",
    originVariable: "PRINTMITARBEJDSARK_SSO_ORIGIN",
    fallbackPath: "/lav",
  },
};

export function isFamilySsoEnabled() {
  return process.env.FAMILY_SSO_ENABLED === "true";
}

export function isFamilySsoAudienceEnabled(audience: FamilySsoAudience) {
  return isFamilySsoEnabled() && (
    audience === "dagenstavle" || process.env.PRINTMITARBEJDSARK_ENABLED === "true"
  );
}

export function getFamilySsoAudience(value: unknown): FamilySsoAudience | null {
  if (value === null || value === undefined || value === "") return "dagenstavle";
  return FAMILY_SSO_AUDIENCES.find((audience) => audience === value) ?? null;
}

export function getFamilySsoOrigin(audience: FamilySsoAudience) {
  const destination = destinations[audience];
  const raw = process.env[destination.originVariable]?.trim();
  if (!raw) return null;

  try {
    const origin = new URL(raw).origin;
    const isDagensTavlePreview = audience === "dagenstavle" &&
      origin.endsWith(".vercel.app") && origin.startsWith("https://");
    const isPrintMitStableDeployment = audience === "printmitarbejdsark" &&
      [
        "https://printmitarbejdsark.vercel.app",
        "https://print-mit-arbejdsark-preview.vercel.app",
      ].includes(origin);
    const isAllowed =
      origin === destination.canonicalOrigin ||
      isDagensTavlePreview ||
      isPrintMitStableDeployment ||
      process.env.NODE_ENV !== "production" && LOCAL_ORIGIN_PATTERN.test(origin);
    return isAllowed ? origin : null;
  } catch {
    return null;
  }
}

export function getDagensTavleSsoOrigin() {
  return getFamilySsoOrigin("dagenstavle");
}

export function getFamilySsoExchangeSecret(audience: FamilySsoAudience = "dagenstavle") {
  const raw = audience === "printmitarbejdsark"
    ? process.env.PRINTMITARBEJDSARK_SSO_EXCHANGE_SECRET
    : process.env.FAMILY_SSO_EXCHANGE_SECRET;
  const secret = raw?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function getSafeFamilySsoPath(
  audience: FamilySsoAudience,
  value: unknown,
  fallback = destinations[audience].fallbackPath,
) {
  if (audience === "dagenstavle") return getSafeDagensTavlePath(value, fallback);
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;

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
  ) return fallback;

  try {
    const canonicalOrigin = destinations[audience].canonicalOrigin;
    const parsed = new URL(value, canonicalOrigin);
    return parsed.origin === canonicalOrigin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function isTrustedSkoleGpsRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") !== "same-origin") return false;
  if (origin === SKOLEGPS_PRODUCTION_ORIGIN) return true;
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
