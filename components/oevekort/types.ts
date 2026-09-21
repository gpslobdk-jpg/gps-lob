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

export type OevekortApiError = {
  error?: string;
  errors?: Array<{ field?: string; message?: string }>;
};

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
