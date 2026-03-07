"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/AuthProvider";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";

export default function DashboardAuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (isLoading || user || hasRedirectedRef.current) return;

    hasRedirectedRef.current = true;
    const query = searchParams.toString();
    const nextPath = `${pathname}${query ? `?${query}` : ""}`;

    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [isLoading, pathname, router, searchParams, user]);

  if (isLoading) {
    return (
      <AuthLoadingScreen
        title="Åbner dit dashboard"
        description="Vi læser din session færdig, så du lander det rigtige sted uden auth-flicker."
      />
    );
  }

  if (!user) {
    return (
      <AuthLoadingScreen
        title="Sender dig til login"
        description="Vi fandt ikke en aktiv session endnu og åbner login for dig."
      />
    );
  }

  return <>{children}</>;
}
