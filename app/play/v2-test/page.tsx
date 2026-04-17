"use client";

import PlayInterfaceV2 from "@/components/play/v2/PlayInterfaceV2";

/**
 * Test harness page – renders PlayInterfaceV2 directly.
 * Only used during development / Playwright tests.
 */
export default function PlayV2TestPage() {
  return <PlayInterfaceV2 />;
}
