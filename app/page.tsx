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

export default async function Home() {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const isNativeGpslobApp = userAgent.includes("GPSLobApp");
  const isMobileBrowser = /iPad|iPhone|iPod|Android|Mobile\//i.test(userAgent);

  // The public teacher page is useful before JavaScript finishes (or when it
  // is disabled), whereas mobile browsers retain the established client-side
  // redirect into /join. Native and Postløb keep their dedicated client flows.
  if (!isNativeGpslobApp && !isMobileBrowser && siteVariant.key !== "postlob") {
    return <TeacherHomepage />;
  }

  return (
    <HomePageClient
      isNativeGpslobApp={isNativeGpslobApp}
      siteVariantKey={siteVariant.key}
    />
  );
}
