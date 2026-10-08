import type { SiteVariantKey } from "@/lib/siteVariant";

// One intentional switch for the seasonal student entry. Turning this false
// restores the ordinary blue join experience without changing any join, PWA,
// QR, or gameplay contract.
export const STUDENT_AUTUMN_PORTAL_ENABLED = true;

export const STUDENT_AUTUMN_PORTAL_SESSION_KEY = "skolegps.golden-portal.seen.v1";

// Set only by the established standalone root -> /join hand-off. The portal
// consumes this short-lived token so ordinary in-app /join navigation can
// never trigger the cinematic opening.
export const STUDENT_AUTUMN_PORTAL_LAUNCH_KEY = "skolegps.golden-portal.launch.v1";

export function isStudentAutumnPortalEnabled(siteVariantKey: SiteVariantKey) {
  return STUDENT_AUTUMN_PORTAL_ENABLED && siteVariantKey === "gpslob";
}
