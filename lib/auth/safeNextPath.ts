import { RUN_EXECUTION_SHARE_PATH } from "@/lib/runExecutionShare";

const DEFAULT_NEXT_PATH = "/dashboard";
const SAFE_PATH_ORIGINS = "https://safe-next.invalid";
const SAFE_PREFIXES = ["/dashboard", "/opret"] as const;
const FAMILY_SSO_START_PATH = "/api/family-sso/start";

function hasSafePrefix(pathname: string) {
  return SAFE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function decodePathnameFully(pathname: string) {
  let decoded = pathname;

  for (let pass = 0; pass < 4; pass += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }

    if (next === decoded) return decoded;
    decoded = next;
  }

  return null;
}

export function getSafeNextPath(value: unknown) {
  const requested = typeof value === "string" ? value.trim() : "";

  if (
    !requested.startsWith("/") ||
    requested.startsWith("//") ||
    requested.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(requested)
  ) {
    return DEFAULT_NEXT_PATH;
  }

  try {
    const parsed = new URL(requested, SAFE_PATH_ORIGINS);
    if (parsed.origin !== SAFE_PATH_ORIGINS) return DEFAULT_NEXT_PATH;

    const decodedPathname = decodePathnameFully(parsed.pathname);
    if (!decodedPathname) return DEFAULT_NEXT_PATH;

    if (
      decodedPathname.startsWith("//") ||
      decodedPathname.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(decodedPathname) ||
      /(?:^|\/)\.{1,2}(?:\/|$)/.test(decodedPathname)
    ) {
      return DEFAULT_NEXT_PATH;
    }

    const isAllowed =
      decodedPathname === RUN_EXECUTION_SHARE_PATH ||
      decodedPathname === FAMILY_SSO_START_PATH ||
      hasSafePrefix(decodedPathname);

    if (!isAllowed) return DEFAULT_NEXT_PATH;

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return DEFAULT_NEXT_PATH;
  }
}
