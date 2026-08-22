import { NextResponse } from "next/server";

import {
  FAMILY_SSO_REQUEST_PATTERN,
  getFamilySsoAudience,
  getFamilySsoOrigin,
  isFamilySsoAudienceEnabled,
} from "@/lib/familySso/config";
import type { FamilySsoAudience } from "@/lib/familySso/config";
import { digestFamilySsoValue } from "@/lib/familySso/crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToDestination(
  origin: string,
  audience: FamilySsoAudience,
  requestId: string | null,
  result: string,
) {
  const target = new URL("/auth/family-sso/complete", origin);
  if (requestId) target.searchParams.set("request", requestId);
  if (audience !== "dagenstavle") target.searchParams.set("audience", audience);
  target.searchParams.set("result", result);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const audience = getFamilySsoAudience(requestUrl.searchParams.get("audience"));
  if (!audience) {
    return new NextResponse("SSO-modtageren er ugyldig.", {
      status: 400,
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
    });
  }
  const destinationOrigin = getFamilySsoOrigin(audience);
  if (!destinationOrigin) return new NextResponse("SSO er ikke konfigureret.", { status: 503 });

  const requestId = requestUrl.searchParams.get("request");
  if (!requestId || !FAMILY_SSO_REQUEST_PATTERN.test(requestId)) {
    return redirectToDestination(destinationOrigin, audience, null, "invalid");
  }
  if (!isFamilySsoAudienceEnabled(audience)) {
    return redirectToDestination(destinationOrigin, audience, requestId, "disabled");
  }

  const admin = createAdminClient();
  if (!admin) return redirectToDestination(destinationOrigin, audience, requestId, "unavailable");

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id || !user.email || !user.email_confirmed_at) {
    return redirectToDestination(destinationOrigin, audience, requestId, "login");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return redirectToDestination(destinationOrigin, audience, requestId, "role");

  const { data: adminUserData, error: adminUserError } = await admin.auth.admin.getUserById(user.id);
  const adminUser = adminUserData?.user;
  const bannedUntil = adminUser?.banned_until ? Date.parse(adminUser.banned_until) : Number.NaN;
  if (
    adminUserError ||
    !adminUser ||
    (Number.isFinite(bannedUntil) && bannedUntil > Date.now())
  ) {
    return redirectToDestination(destinationOrigin, audience, requestId, "disabled-account");
  }

  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";
  const identityProvider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : "supabase";

  const { data: authorizationResult, error: authorizationError } = await admin.rpc(
    "authorize_family_sso_request",
    {
      p_request_hash: digestFamilySsoValue(requestId),
      p_user_id: user.id,
      p_verified_email: user.email,
      p_display_name: displayName,
      p_identity_provider: identityProvider,
      p_destination_origin: destinationOrigin,
    }
  );
  if (authorizationError || authorizationResult !== "authorized") {
    return redirectToDestination(destinationOrigin, audience, requestId, "expired");
  }

  return redirectToDestination(destinationOrigin, audience, requestId, "authorized");
}
