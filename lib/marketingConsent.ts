export const MARKETING_CONSENT_SOURCE = "self_service_web";

export type MarketingConsentPayload = {
  consent: boolean;
};

type BuildMarketingConsentUpdateOptions = {
  userId: string;
  consent: boolean;
  canonicalConsentText: string;
  now?: Date;
};

export function parseMarketingConsentPayload(value: unknown): MarketingConsentPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "consent") {
    return null;
  }

  const consent = (value as Record<string, unknown>).consent;
  return typeof consent === "boolean" ? { consent } : null;
}

export function buildMarketingConsentUpdate({
  userId,
  consent,
  canonicalConsentText,
  now = new Date(),
}: BuildMarketingConsentUpdateOptions) {
  const consentedAt = consent ? now.toISOString() : null;

  return {
    id: userId,
    marketing_consent: consent,
    marketing_consent_at: consentedAt,
    marketing_consent_text: consent ? canonicalConsentText : null,
    marketing_consent_source: MARKETING_CONSENT_SOURCE,
  };
}
