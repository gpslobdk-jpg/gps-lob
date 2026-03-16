import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { PostgrestError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";

const BETA_PLAN = "beta";
const BETA_ACCESS_EXPIRES_AT = "2026-08-01T00:00:00.000Z";
const OAUTH_TIMEOUT_MS = 8_000;
const BETA_SEED_TIMEOUT_MS = 2_500;
const ONBOARD_CHECK_TIMEOUT_MS = 1_200;

type ProfileSeedRow = {
  id: string;
  plan_type: string | null;
  access_expires_at: string | null;
};

function redirectToLogin(origin: string, error: string) {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", error);
  return NextResponse.redirect(loginUrl);
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    }),
  ]);
}

async function ensureBetaAccess(userId: string) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return;
  }

  try {
    const { data: existingProfile, error: profileError } = await withTimeout<{
      data: ProfileSeedRow | null;
      error: PostgrestError | null;
    }>(
      adminSupabase
        .from("profiles")
        .select("id, plan_type, access_expires_at")
        .eq("id", userId)
        .maybeSingle(),
      BETA_SEED_TIMEOUT_MS,
      "beta_lookup"
    );

    if (profileError) {
      console.error("Kunne ikke læse profile til beta-seeding:", profileError);
      return;
    }

    const betaExpiry = new Date(BETA_ACCESS_EXPIRES_AT);
    const currentExpiry = existingProfile?.access_expires_at
      ? new Date(existingProfile.access_expires_at)
      : null;
    const shouldSeedPlan =
      !existingProfile || !existingProfile.plan_type || existingProfile.plan_type === "free";
    const shouldSeedExpiry =
      shouldSeedPlan ||
      (existingProfile?.plan_type === BETA_PLAN && (!currentExpiry || currentExpiry < betaExpiry));

    if (!shouldSeedPlan && !shouldSeedExpiry) {
      return;
    }

    const { error: upsertError } = await withTimeout<{
      error: PostgrestError | null;
    }>(
      adminSupabase.from("profiles").upsert(
        {
          id: userId,
          ...(shouldSeedPlan ? { plan_type: BETA_PLAN } : {}),
          ...(shouldSeedExpiry ? { access_expires_at: BETA_ACCESS_EXPIRES_AT } : {}),
        },
        { onConflict: "id" }
      ),
      BETA_SEED_TIMEOUT_MS,
      "beta_upsert"
    );

    if (upsertError) {
      console.error("Kunne ikke skrive beta-adgang til profiles:", upsertError);
    }
  } catch (error) {
    console.error("Beta-seeding fejlede uden at blokere login:", error);
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const safeOrigin =
    forwardedHost && forwardedProto
      ? `${forwardedProto}://${forwardedHost}`
      : requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const nextPath =
    requestedNext && requestedNext.startsWith("/dashboard") ? requestedNext : "/dashboard";

  if (!code) {
    console.log("Auth callback: missing code in query", requestUrl.href);
    return redirectToLogin(safeOrigin, "missing_oauth_code");
  }

  try {
    console.log("Auth callback: Hit callback", { url: requestUrl.href });
    const providerError = requestUrl.searchParams.get("error");
    const providerErrorDescription = requestUrl.searchParams.get("error_description");
    if (providerError) {
      console.warn("Auth callback: provider returned error", { providerError, providerErrorDescription });
      return redirectToLogin(safeOrigin, `${providerError}${providerErrorDescription ? ": " + providerErrorDescription : ""}`);
    }
    const cookieStore = await cookies();
    console.log("Auth callback: cookies acquired");
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          },
        },
      }
    );

    console.log("Auth callback: exchanging code for session");
    const exchangeResult = await withTimeout(
      supabase.auth.exchangeCodeForSession(code),
      OAUTH_TIMEOUT_MS,
      "oauth_exchange"
    ).catch((err) => {
      console.error("Auth callback: exchangeCodeForSession failed/timeout", err);
      return null;
    });

    if (!exchangeResult) {
      console.error("Auth callback: exchange result null — treating as failure");
      return redirectToLogin(safeOrigin, "oauth_exchange_failed");
    }

    const { error: exchangeError, data: exchangeData } = exchangeResult as any;
    if (exchangeError) {
      console.error("Auth callback: exchange returned error", exchangeError);
      return redirectToLogin(safeOrigin, "oauth_exchange_failed");
    }

    console.log("Auth callback: Session exchanged", { sessionId: exchangeData?.session?.access_token ? true : false });

    console.log("Auth callback: fetching user from supabase");
    const userResult = await withTimeout(supabase.auth.getUser(), OAUTH_TIMEOUT_MS, "oauth_user").catch((err) => {
      console.error("Auth callback: getUser failed/timeout", err);
      return null;
    });

    if (!userResult) {
      console.error("Auth callback: getUser returned null — treating as missing user");
      return redirectToLogin(safeOrigin, "oauth_user_missing");
    }

    const { data: userData, error: userError } = userResult as any;
    const user = userData?.user ?? null;
    if (userError || !user) {
      console.error("Auth callback: getUser returned error or no user", { userError, user });
      return redirectToLogin(safeOrigin, "oauth_user_missing");
    }

    console.log("Auth callback: user fetched", { userId: user.id });

      // QUICK onboard check: if the user has no saved runs, redirect them directly
      // to the welcome/onboarding flow. This is a fast, best-effort check with a
      // short timeout — if it fails we fall back to the normal redirect.
      try {
        const adminSupabase = createAdminClient();
        if (adminSupabase) {
          const { data: runsData, error: runsError } = await withTimeout(
            adminSupabase
              .from("gps_runs")
              .select("id")
              .eq("user_id", user.id)
              .limit(1),
            ONBOARD_CHECK_TIMEOUT_MS,
            "onboard_lookup"
          );

          if (!runsError) {
            const hasRuns = Array.isArray(runsData) && runsData.length > 0;
            if (!hasRuns) {
              return NextResponse.redirect(`${safeOrigin}/dashboard/velkommen`);
            }
          }
        }
      } catch (err) {
        // best-effort: if anything fails here (timeout, admin client missing),
        // continue with the normal flow so login doesn't block.
        console.warn("Onboard check failed or timed out, continuing with regular redirect:", err);
      }

    await ensureBetaAccess(user.id);

    return NextResponse.redirect(`${safeOrigin}${nextPath}`);
  } catch (error) {
    console.error("OAuth callback crashede:", error);
    return redirectToLogin(safeOrigin, "oauth_callback_failed");
  }
}
