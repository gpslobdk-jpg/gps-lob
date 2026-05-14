export const SITE_VARIANTS = {
  gpslob: {
    key: "gpslob",
    brandName: "GPS Løb",
    domain: "gpslob.dk",
    htmlLang: "da",
    intlLocale: "da-DK",
  },
  postlob: {
    key: "postlob",
    brandName: "Postløp",
    domain: "postlob.net",
    htmlLang: "nb",
    intlLocale: "nb-NO",
  },
} as const;

export type SiteVariantKey = keyof typeof SITE_VARIANTS;
export type SiteVariant = (typeof SITE_VARIANTS)[SiteVariantKey];

export const DEFAULT_SITE_VARIANT = SITE_VARIANTS.gpslob;

const POSTLOB_HOSTS = new Set(["postlob.net", "www.postlob.net"]);

type HeadersLike = {
  get(name: string): string | null;
};

function normalizeHost(host: string | null | undefined) {
  return host?.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

export function resolveSiteVariantFromHost(host: string | null | undefined): SiteVariant {
  const normalizedHost = normalizeHost(host);

  if (POSTLOB_HOSTS.has(normalizedHost)) {
    return SITE_VARIANTS.postlob;
  }

  return DEFAULT_SITE_VARIANT;
}

export function resolveSiteVariantFromHeaders(requestHeaders: HeadersLike): SiteVariant {
  return resolveSiteVariantFromHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  );
}

export function getSiteVariant(siteVariantKey: SiteVariantKey) {
  return SITE_VARIANTS[siteVariantKey];
}