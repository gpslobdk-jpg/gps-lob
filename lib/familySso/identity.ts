import { FAMILY_SSO_REQUEST_PATTERN, FAMILY_SSO_TTL_SECONDS } from "./config";

export function isActiveFamilySsoUser(user: {
  email?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
}, now = Date.now()) {
  const bannedUntil = user.banned_until ? Date.parse(user.banned_until) : Number.NaN;
  return Boolean(
    user.email &&
    user.email_confirmed_at &&
    (!Number.isFinite(bannedUntil) || bannedUntil <= now)
  );
}

export function createPrintMitIdentity({
  subject,
  email,
  requestId,
  now = Date.now(),
}: {
  subject: string;
  email: string;
  requestId: string;
  now?: number;
}) {
  if (!subject || !email || !FAMILY_SSO_REQUEST_PATTERN.test(requestId)) return null;
  return {
    version: 1 as const,
    issuer: "skolegps" as const,
    audience: "printmitarbejdsark" as const,
    subject,
    email,
    issuedAt: now,
    expiresAt: now + FAMILY_SSO_TTL_SECONDS * 1000,
    requestId,
  };
}
