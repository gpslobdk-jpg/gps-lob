import type { Metadata } from "next";
import { headers } from "next/headers";

import { JoinSiteVariantProvider } from "@/app/join/JoinSiteVariantContext";
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

export default async function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);

  return (
    <JoinSiteVariantProvider initialSiteVariantKey={siteVariant.key}>
      {children}
    </JoinSiteVariantProvider>
  );
}
