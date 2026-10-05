import type { Metadata } from "next";
import { headers } from "next/headers";

import HomePageClient from "@/components/HomePageClient";
import TeacherHomepage from "@/components/home/TeacherHomepage";
import { getSiteCopy } from "@/lib/siteCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const siteCopy = getSiteCopy(siteVariant.key);

  return {
    title: siteCopy.metadata.homeTitle,
    description: siteCopy.metadata.homeDescription,
  };
}

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const resolvedSearchParams = await searchParams;
  const isNativeGpslobApp = userAgent.includes("GPSLobApp");
  // Keep the established student handoff intact. The Mobile/ token includes
  // iPadOS browsers that present a desktop-shaped user agent.
  const isMobileBrowser = /iPad|iPhone|iPod|Android|Mobile\//i.test(userAgent);
  // Preserve every existing callback-shaped root URL, including duplicated or
  // empty `code` values. HomePageClient owns its callback semantics.
  const hasAuthCallbackCode = Object.prototype.hasOwnProperty.call(resolvedSearchParams, "code");

  // The public teacher front page is intentionally server-rendered, so its
  // content and links remain usable without JavaScript. The existing native,
  // mobile/student, Postløb and auth-callback contracts keep their dedicated
  // client flow below.
  if (!isNativeGpslobApp && !isMobileBrowser && siteVariant.key !== "postlob" && !hasAuthCallbackCode) {
    return <TeacherHomepage />;
  }

  return (
    <HomePageClient
      isNativeGpslobApp={isNativeGpslobApp}
      siteVariantKey={siteVariant.key}
    />
  );
}
