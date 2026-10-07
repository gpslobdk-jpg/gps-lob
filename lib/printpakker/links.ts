export const PRINTPAKKE_DOWNLOAD_VARIANTS = [
  "whole-colour",
  "whole-ink-saver",
  "student",
  "answer-key",
  "teacher-guide",
  "student-ink-saver",
  "stations",
  "stations-ink-saver",
  "answer-sheet",
  "answer-sheet-ink-saver",
  "answer-key-ink-saver",
  "teacher-guide-ink-saver",
  "support",
  "support-ink-saver",
] as const;

export type PrintpakkeDownloadVariant = (typeof PRINTPAKKE_DOWNLOAD_VARIANTS)[number];

export function isPrintpakkeDownloadVariant(value: string): value is PrintpakkeDownloadVariant {
  return (PRINTPAKKE_DOWNLOAD_VARIANTS as readonly string[]).includes(value);
}

export function buildPrintpakkeDownloadHref(
  slug: string,
  variant: PrintpakkeDownloadVariant,
) {
  return `/api/printpakker/${slug}/${variant}`;
}

/**
 * Kept inside the existing /dashboard safe-next boundary. The landing route
 * validates both values and only then returns the teacher to the public pack
 * page, where the separately guarded download route still checks the session.
 */
export function buildPrintpakkeLoginReturnPath(
  slug: string,
  variant: PrintpakkeDownloadVariant,
) {
  const query = new URLSearchParams({ download: variant, slug });
  return `/dashboard/laerervaerktoejer/printpakker?${query.toString()}`;
}
