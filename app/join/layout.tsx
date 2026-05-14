import type { Metadata } from "next";
import { headers } from "next/headers";

import JoinPage from "@/app/join/page";
import { getSiteCopy } from "@/lib/siteCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const siteCopy = getSiteCopy(siteVariant.key);
  return {
    title: siteCopy.metadata.joinTitle,
    description: siteCopy.metadata.joinDescription,
  };
}

export default async function JoinLayout({ children: _children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);

  return <JoinPage initialSiteVariantKey={siteVariant.key} />;
}
