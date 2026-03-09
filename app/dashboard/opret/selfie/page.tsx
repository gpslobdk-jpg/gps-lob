import { Suspense } from "react";

import SelfieBuilderClient from "./SelfieBuilderClient";

export const runtime = "edge";

export default function SelfieBuilderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-rose-950" />}>
      <SelfieBuilderClient />
    </Suspense>
  );
}
