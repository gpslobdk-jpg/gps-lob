import { headers } from "next/headers";
import type { MetadataRoute } from "next";

import { getSiteCopy } from "@/lib/siteCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const siteCopy = getSiteCopy(siteVariant.key);

  return {
    name: siteCopy.metadata.manifestName,
    short_name: siteCopy.metadata.manifestShortName,
    description: siteCopy.metadata.manifestDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#071f5b",
    theme_color: "#0b5ed7",
    icons: [
      {
        src: "/icons/skolegps-pilen-any-192-v1.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/skolegps-pilen-any-512-v1.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/skolegps-pilen-maskable-192-v1.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/skolegps-pilen-maskable-512-v1.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
