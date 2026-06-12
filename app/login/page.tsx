import { headers } from "next/headers";

import LoginPageClient from "@/app/login/LoginPageClient";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export default async function LoginPage() {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);

  return <LoginPageClient initialSiteVariantKey={siteVariant.key} />;
}
