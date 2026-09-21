import type { Metadata } from "next";

import OevekortSetPresentation from "@/components/oevekort/OevekortSetPresentation";

export const metadata: Metadata = {
  title: "Print Øvekort – SkoleGPS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OevekortPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const { set } = await searchParams;
  return <OevekortSetPresentation mode="print" setId={set} />;
}
