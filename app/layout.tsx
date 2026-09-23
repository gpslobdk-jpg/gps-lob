import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import { headers } from "next/headers";
import { poppins, rubik } from "@/lib/fonts";
import "./globals.css";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import PrivacySafeAnalytics from "@/components/PrivacySafeAnalytics";

import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
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
      apple: "/icons/skolegps-pilen-apple-touch-180-v1.png",
      icon: "/icons/skolegps-pilen-any-512-v1.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: siteCopy.metadata.manifestName,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b5ed7",
  width: "device-width",
  initialScale: 1,
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
          <ServiceWorkerRegister />
          <PrivacySafeAnalytics />
        </ErrorBoundary>
      </body>
    </html>
  );
}

