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
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
