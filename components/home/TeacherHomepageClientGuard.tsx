"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

const LegacyHomePageClient = dynamic(() => import("@/components/HomePageClient"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-sm font-semibold tracking-[0.18em] text-emerald-100 uppercase">
      Aabner elevstart...
    </div>
  ),
  ssr: false,
});

type HomeWindow = Window & {
  Capacitor?: unknown;
};

type ClientMode = "teacher" | "redirecting-to-join" | "capacitor";

function isIpadOrMobileBrowser() {
  const userAgent = window.navigator.userAgent;

  return (
    /iPad|iPhone|iPod|Android|Mobile\//i.test(userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}

/**
 * The public teacher page is server-rendered for a usable no-JS document.
 * The existing root page also has browser-only routing contracts that a server
 * cannot reliably see: iPadOS can look like macOS and Capacitor is injected
 * after the request. Keep those established flows out of the teacher page.
 */
export default function TeacherHomepageClientGuard({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ClientMode>("teacher");

  useEffect(() => {
    const detectBrowserOnlyFlow = window.requestAnimationFrame(() => {
      const browserWindow = window as HomeWindow;
      const params = new URLSearchParams(browserWindow.location.search);

      // app/page.tsx preserves callback URLs on the server. This protects the
      // client boundary too if a navigation changes before hydration finishes.
      if (browserWindow.location.pathname !== "/" || params.has("code")) return;

      if (typeof browserWindow.Capacitor !== "undefined") {
        setMode("capacitor");
        return;
      }

      if (isIpadOrMobileBrowser()) {
        setMode("redirecting-to-join");
        browserWindow.location.replace("/join");
      }
    });

    return () => window.cancelAnimationFrame(detectBrowserOnlyFlow);
  }, []);

  if (mode === "capacitor") {
    return <LegacyHomePageClient isNativeGpslobApp={false} siteVariantKey="gpslob" />;
  }

  if (mode === "redirecting-to-join") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-sm font-semibold tracking-[0.18em] text-emerald-100 uppercase">
        Aabner elevstart...
      </div>
    );
  }

  return children;
}
