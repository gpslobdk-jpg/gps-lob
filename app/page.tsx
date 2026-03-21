import { headers } from "next/headers";

import HomePageClient from "@/components/HomePageClient";

export default async function Home() {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";

  return <HomePageClient isNativeGpslobApp={userAgent.includes("GPSLobApp")} />;
}
