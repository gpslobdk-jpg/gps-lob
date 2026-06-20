import type { Metadata } from "next";
import { Poppins, Rubik } from "next/font/google";

import { SkemaPilotWizard } from "./SkemaPilotWizard";

export const metadata: Metadata = {
  title: "SkemaPilot – SkoleGPS",
  description: "Lav en visuel skemakladde, fordel fag, lærere og lokaler, og gem kladden lokalt i browseren.",
};

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function SkemaPilotPage() {
  return <SkemaPilotWizard poppinsClassName={poppins.className} rubikClassName={rubik.className} />;
}
