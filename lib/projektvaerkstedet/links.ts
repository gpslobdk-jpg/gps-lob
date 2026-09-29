import { getFamilySsoOrigin, getSafeFamilySsoPath } from "@/lib/familySso/config";

export const PROJECT_WORKSHOP_PATH = "/projektvaerkstedet";
export const PROJECT_WORKSHOP_NEWS_PATH = "/nyheder/projektvaerkstedet";

const PRINTMIT_WORKSHOP_PATH = "/projekter";
const PRINTMIT_FALLBACK_ORIGIN = "https://printmitarbejdsark.dk";

/**
 * Opens the protected PrintMit workshop index through the existing Family SSO
 * boundary. The public SkoleGPS page deliberately passes no project, class,
 * pupil, or browser-state data across products.
 */
export function getProjectWorkshopStartHref() {
  const origin = getFamilySsoOrigin("printmitarbejdsark") ?? PRINTMIT_FALLBACK_ORIGIN;
  const target = new URL("/auth/family-sso/start", origin);

  target.searchParams.set(
    "next",
    getSafeFamilySsoPath("printmitarbejdsark", PRINTMIT_WORKSHOP_PATH, PRINTMIT_WORKSHOP_PATH),
  );
  target.searchParams.set("source", "skolegps");

  return target.toString();
}
