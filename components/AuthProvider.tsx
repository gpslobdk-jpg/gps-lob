"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    const LOADING_GRACE_MS = 700;

    const hydrateAuth = async () => {
      try {
        const {
          data: { session: activeSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(activeSession ?? null);
        setUser(activeSession?.user ?? null);
      } catch (error) {
        console.error("Kunne ikke indlæse session:", error);
      } finally {
        // Defer clearing isLoading for a short grace period so that any
        // onAuthStateChange subscription has a chance to run and update
        // the session. This prevents a brief auth-flash where the client
        // believes there is no session before the subscription fires.
        if (isMounted) {
          graceTimer = setTimeout(() => {
            graceTimer = null;
            if (isMounted) setIsLoading(false);
          }, LOADING_GRACE_MS);
        }
      }
    };

    void hydrateAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      // Clear any pending grace timer and mark loading finished immediately
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo(
    () => ({
      session,
      user,
      isLoading,
    }),
    [isLoading, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth skal bruges inde i AuthProvider.");
  }

  return context;
}
