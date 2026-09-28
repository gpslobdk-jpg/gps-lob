export type Printpakke = {
  activityType: string;
  description: string;
  duration: string;
  gradeLevel: string;
  illustration: string;
  illustrationAlt: string;
  publicPreview: string;
  slug: string;
  subject: string;
  title: string;
  version: string;
};

/**
 * Public catalogue data only. Teacher answers and protected file locations live
 * in the server-only download module, so this value is safe to pass to a Client
 * Component for search and filters.
 */
export const PRINTPAKKER = [
  {
    slug: "efteraarsmysteriet",
    version: "1.0",
    title: "Efterårsmysteriet",
    description: "Et matematikmysterium med seks poster, sporbrikker og en fælles afsløring.",
    subject: "Matematik",
    gradeLevel: "5.-6. klasse",
    activityType: "Makkerløb ved bordene",
    duration: "55-60 min.",
    illustration: "/printpakker/afteraarsmysteriet-hero.png",
    illustrationAlt: "Elever samarbejder om et efterårsmysterium med papirer og lygter i skolegården.",
    publicPreview: "/printpakker/afteraarsmysteriet-forhaandsvisning.pdf",
  },
] as const satisfies readonly Printpakke[];

export type PrintpakkeSlug = (typeof PRINTPAKKER)[number]["slug"];

export function getPrintpakke(slug: string): Printpakke | undefined {
  return PRINTPAKKER.find((printpakke) => printpakke.slug === slug);
}

export function getPrintpakkeFilterOptions() {
  return {
    subjects: [...new Set(PRINTPAKKER.map((printpakke) => printpakke.subject))],
    gradeLevels: [...new Set(PRINTPAKKER.map((printpakke) => printpakke.gradeLevel))],
    activityTypes: [...new Set(PRINTPAKKER.map((printpakke) => printpakke.activityType))],
  };
}
