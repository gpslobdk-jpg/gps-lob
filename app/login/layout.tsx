import "driver.js/dist/driver.css";

import type { Metadata } from "next";
import { headers } from "next/headers";

import { AuthProvider } from "@/components/AuthProvider";
import OnboardingTour from "@/components/OnboardingTour";
import { getSiteCopy } from "@/lib/siteCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const siteCopy = getSiteCopy(siteVariant.key);

  return {
    title: siteCopy.metadata.loginTitle,
    description: siteCopy.metadata.loginDescription,
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <OnboardingTour />
    </AuthProvider>
  );
}
