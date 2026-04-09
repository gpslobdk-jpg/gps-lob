import { headers } from "next/headers";

import HomePageClient from "@/components/HomePageClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";

  return <HomePageClient isNativeGpslobApp={userAgent.includes("GPSLobApp")} />;
}
