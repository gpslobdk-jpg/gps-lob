import "driver.js/dist/driver.css";

import type { Metadata } from "next";

import { AuthProvider } from "@/components/AuthProvider";
import OnboardingTour from "@/components/OnboardingTour";

export const metadata: Metadata = {
  title: "Login | GPS Løb",
  description:
    "Log ind på GPSLØB.DK for at oprette løb, følge klassen live og hente resultater.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <OnboardingTour />
    </AuthProvider>
  );
}
