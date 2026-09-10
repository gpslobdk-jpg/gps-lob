import type { Metadata } from "next";

import ChessHub from "@/components/chess/ChessHub";

export const metadata: Metadata = {
  title: "Skak i klassen – SkoleGPS",
  description: "Lær, vis og spil fysisk skak i klassen med SkoleGPS.",
};

export default function SkakPage() {
  return <ChessHub />;
}
