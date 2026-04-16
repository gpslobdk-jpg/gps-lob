import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Poppins, Rubik } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import OnboardingTour from "@/components/OnboardingTour";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: "GPSLOB.DK - Stjerneløb for hele klassen",
  description: "Byg, del og følg med live.",
  icons: {
    apple: "/logomobil1.png",
    icon: "/mobillogo2.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GPS Løb",
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
      </head>
      <body className={`${poppins.variable} ${rubik.variable} font-sans antialiased bg-[#0a1128]`}>
        <ErrorBoundary>
          <AuthProvider>
            {children}
            <OnboardingTour />
            <Analytics />
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
