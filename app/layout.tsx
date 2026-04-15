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
        {/* ===== MAINTENANCE MODE OVERLAY ===== */}
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 overflow-hidden">
          {/* Subtle emerald gradient blobs */}
          <div className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-emerald-900/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-800/15 blur-3xl" />

          <div className="relative mx-4 max-w-lg rounded-2xl border border-emerald-500/20 bg-emerald-950/30 px-8 py-12 text-center shadow-2xl backdrop-blur-xl sm:px-12">
            <div className="mb-2 text-5xl">🛠️</div>
            <h1 className="font-[family-name:var(--font-rubik)] text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Vi holder pause i 3 dage
            </h1>
            <p className="mt-6 font-[family-name:var(--font-poppins)] text-base leading-relaxed text-slate-300 sm:text-lg">
              Vi bliver desværre nødt til at lukke siden ned de næste tre dage for at få bugt med de
              sidste børnesygdomme. En kæmpe tak til alle jer, der har hjulpet med at teste!
            </p>
            <p className="mt-4 font-[family-name:var(--font-poppins)] text-base leading-relaxed text-slate-300 sm:text-lg">
              Vi vender stærkt tilbage med en forbedret version, der bliver helt gratis at bruge.
              Vi ses snart!
            </p>
            <div className="mt-8 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-400">
              Tilbage snart ✨
            </div>
          </div>
        </div>
        {/* ===== END MAINTENANCE OVERLAY ===== */}

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
