import type { Metadata } from "next";
import { Poppins, Rubik } from "next/font/google";

import { SkemaPilotWizard } from "./SkemaPilotWizard";

export const metadata: Metadata = {
  title: "SkemaPilot – GPSLØB",
  description: "Klikbar prototype på et kommende skemaværktøj til små skoler, friskoler og privatskoler.",
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
