import type { Metadata } from "next";
import { poppins, rubik } from "@/lib/fonts";

import { SkemaPilotWizard } from "./SkemaPilotWizard";

export const metadata: Metadata = {
  title: "SkemaPilot – SkoleGPS",
  description: "Lav en visuel skemakladde, fordel fag, lærere og lokaler, og gem kladden lokalt i browseren.",
};

export default function SkemaPilotPage() {
  return <SkemaPilotWizard poppinsClassName={poppins.className} rubikClassName={rubik.className} />;
}
