import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import { headers } from "next/headers";
import { poppins, rubik } from "@/lib/fonts";
import "./globals.css";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import PrivacySafeAnalytics from "@/components/PrivacySafeAnalytics";

import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PwaLaunchExperience from "@/components/pwa/PwaLaunchExperience";
import { getSiteCopy } from "@/lib/siteCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const siteCopy = getSiteCopy(siteVariant.key);

  return {
    title: siteCopy.metadata.homeTitle,
    description: siteCopy.metadata.homeDescription,
    icons: {
      apple: "/logomobil1.png",
      icon: "/mobillogo2.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: siteCopy.metadata.manifestName,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);

  return (
    <html lang={siteVariant.htmlLang}>
      <head />
      <body className={`${poppins.variable} ${rubik.variable} font-sans antialiased bg-[#0a1128]`}>
        <ErrorBoundary>
          {children}
          <PwaLaunchExperience brandName={getSiteCopy(siteVariant.key).metadata.manifestName} />
          <ServiceWorkerRegister />
          <PrivacySafeAnalytics />
        </ErrorBoundary>
      </body>
    </html>
  );
}

