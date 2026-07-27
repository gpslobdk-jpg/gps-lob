"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  DEFAULT_SITE_VARIANT,
  type SiteVariantKey,
} from "@/lib/siteVariant";

const JoinSiteVariantContext = createContext<SiteVariantKey>(
  DEFAULT_SITE_VARIANT.key
);

export function JoinSiteVariantProvider({
  children,
  initialSiteVariantKey,
}: {
  children: ReactNode;
  initialSiteVariantKey: SiteVariantKey;
}) {
  return (
    <JoinSiteVariantContext.Provider value={initialSiteVariantKey}>
      {children}
    </JoinSiteVariantContext.Provider>
  );
}

export function useInitialJoinSiteVariant() {
  return useContext(JoinSiteVariantContext);
}
