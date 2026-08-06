import type { Metadata } from "next";

import RunExecutionShareClient from "@/app/del/afvikling/RunExecutionShareClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Delt SkoleGPS-løb",
  description: "Hent din egen kopi af et SkoleGPS-løb.",
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

export default function RunExecutionSharePage() {
  return <RunExecutionShareClient />;
}
