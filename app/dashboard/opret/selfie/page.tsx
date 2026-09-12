import { Suspense } from "react";

import legacyBuilderStyles from "@/components/builders/LegacyBuilderSurface.module.css";
import SelfieBuilderClient from "./SelfieBuilderClient";

export const runtime = "edge";

export default function SelfieBuilderPage() {
  return (
    <Suspense fallback={<div className={`min-h-screen ${legacyBuilderStyles.shell}`} />}>
      <SelfieBuilderClient />
    </Suspense>
  );
}
