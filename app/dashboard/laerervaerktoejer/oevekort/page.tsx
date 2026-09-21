import type { Metadata } from "next";

import OevekortTeacherClient from "@/components/oevekort/OevekortTeacherClient";

export const metadata: Metadata = {
  title: "Øvekort – SkoleGPS",
  description: "Lav, del, vis og print faglige øvekort.",
};

export const dynamic = "force-dynamic";

export default function OevekortPage() {
  return <OevekortTeacherClient />;
}
