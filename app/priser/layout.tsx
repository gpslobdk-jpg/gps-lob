import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Priser | GPS Løb",
  description:
    "Se vores pakker til skoler, lærere og events. Gratis frem til efter efterårsferien.",
};

export default function PriserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
