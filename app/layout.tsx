import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import OnboardingTour from "@/components/OnboardingTour";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "GPSLOB.DK - Stjerneløb for hele klassen",
  description: "Byg, del og følg med live.",
  icons: {
    apple: "/icon-512x512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GPSløb",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <head>
        <link rel="preload" href="/introvideo.mp4" as="video" type="video/mp4" />
        <meta name="theme-color" content="#020617" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/logomobil1.png" />
        <link rel="icon" href="/mobillogo2.png" sizes="512x512" />
      </head>
      <body className={`${poppins.variable} font-sans antialiased bg-[#0a1128]`}>
        <AuthProvider>
          {children}
          <OnboardingTour />
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  );
}
