export type OevekortCard = {
  acceptedAnswers: string[];
  back: string;
  front: string;
  id: string;
};

export type OevekortSet = {
  cards: OevekortCard[];
  createdAt: string;
  id: string;
  title: string;
  updatedAt: string;
};

export type OevekortShareStatus = {
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
  id: string;
};

export type OevekortSetSummary = {
  cardCount: number;
  createdAt: string;
  id: string;
  share: {
    active: boolean;
    createdAt: string | null;
    expiresAt: string | null;
  };
  title: string;
  updatedAt: string;
};

export type OevekortPublicSet = Pick<OevekortSet, "cards" | "title">;

export type OevekortApiError = {
  error?: string;
  errors?: Array<{ field?: string; message?: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * API responses are runtime data, even when the server and client share TypeScript
 * types. These guards keep a partial or stale response from reaching an editor,
 * board, printout, or learner activity where a property dereference would fail.
 */
export function isOevekortCard(value: unknown): value is OevekortCard {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.front) &&
    isNonEmptyString(value.back) &&
    Array.isArray(value.acceptedAnswers) &&
    value.acceptedAnswers.every((answer) => typeof answer === "string")
  );
}

export function isOevekortPublicSet(value: unknown): value is OevekortPublicSet {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.title) &&
    Array.isArray(value.cards) &&
    value.cards.length > 0 &&
    value.cards.every(isOevekortCard)
  );
}

export function isOevekortSet(value: unknown): value is OevekortSet {
  if (!isOevekortPublicSet(value) || !isRecord(value)) return false;
  const candidate = value as Record<string, unknown>;

  return (
    isNonEmptyString(candidate.id) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

export function isOevekortShareStatus(
  value: unknown,
): value is OevekortShareStatus {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    typeof value.createdAt === "string" &&
    (typeof value.expiresAt === "string" || value.expiresAt === null) &&
    typeof value.active === "boolean"
  );
}

export function isOevekortSetSummary(
  value: unknown,
): value is OevekortSetSummary {
  if (!isRecord(value) || !isRecord(value.share)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    typeof value.cardCount === "number" &&
    Number.isFinite(value.cardCount) &&
    value.cardCount >= 0 &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.share.active === "boolean" &&
    (typeof value.share.createdAt === "string" || value.share.createdAt === null) &&
    (typeof value.share.expiresAt === "string" || value.share.expiresAt === null)
  );
}

export async function readOevekortResponse<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  });

  let body: T | OevekortApiError = {};
  try {
    body = (await response.json()) as T;
  } catch {
    // A failed JSON response is intentionally treated as a generic API error.
  }

  return { body, response };
}

export function getOevekortError(
  body: unknown,
  fallback: string,
) {
  if (!body || typeof body !== "object") return fallback;
  const candidate = body as OevekortApiError;
  return typeof candidate.error === "string" && candidate.error.trim()
    ? candidate.error
    : fallback;
}

export function formatOevekortDate(value: string | null | undefined) {
  if (!value) return "Uden udløb";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Ukendt tidspunkt";

  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}
