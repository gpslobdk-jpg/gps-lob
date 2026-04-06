import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Priser | GPS Løb",
  description:
    "Se vores pakker til skoler, lærere og events. Gratis under beta frem til 1. august 2026.",
};

export default function PriserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
