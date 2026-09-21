import type { Metadata } from "next";

import OevekortPublicShareClient from "@/components/oevekort/OevekortPublicShareClient";

export const metadata: Metadata = {
  title: "Delte Øvekort – SkoleGPS",
  description: "Øv et kortsæt, som din lærer har delt.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OevekortPublicSharePage() {
  return <OevekortPublicShareClient />;
}
