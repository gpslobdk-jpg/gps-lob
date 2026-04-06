import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | GPS Løb",
  description:
    "Log ind på GPSLØB.DK for at oprette løb, følge klassen live og hente resultater.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
