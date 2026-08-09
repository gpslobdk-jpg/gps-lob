import { NextResponse } from "next/server";

import {
  FAMILY_SSO_REQUEST_PATTERN,
  getDagensTavleSsoOrigin,
  isFamilySsoEnabled,
} from "@/lib/familySso/config";
import { digestFamilySsoValue } from "@/lib/familySso/crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToDagensTavle(origin: string, requestId: string | null, result: string) {
  const target = new URL("/auth/family-sso/complete", origin);
  if (requestId) target.searchParams.set("request", requestId);
  target.searchParams.set("result", result);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function GET(request: Request) {
  const destinationOrigin = getDagensTavleSsoOrigin();
  if (!destinationOrigin) return new NextResponse("SSO er ikke konfigureret.", { status: 503 });

  const requestId = new URL(request.url).searchParams.get("request");
  if (!requestId || !FAMILY_SSO_REQUEST_PATTERN.test(requestId)) {
    return redirectToDagensTavle(destinationOrigin, null, "invalid");
  }
  if (!isFamilySsoEnabled()) {
    return redirectToDagensTavle(destinationOrigin, requestId, "disabled");
  }

  const admin = createAdminClient();
  if (!admin) return redirectToDagensTavle(destinationOrigin, requestId, "unavailable");

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id || !user.email || !user.email_confirmed_at) {
    return redirectToDagensTavle(destinationOrigin, requestId, "login");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return redirectToDagensTavle(destinationOrigin, requestId, "role");

  const { data: adminUserData, error: adminUserError } = await admin.auth.admin.getUserById(user.id);
  const adminUser = adminUserData?.user;
  const bannedUntil = adminUser?.banned_until ? Date.parse(adminUser.banned_until) : Number.NaN;
  if (
    adminUserError ||
    !adminUser ||
    (Number.isFinite(bannedUntil) && bannedUntil > Date.now())
  ) {
    return redirectToDagensTavle(destinationOrigin, requestId, "disabled-account");
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
    return redirectToDagensTavle(destinationOrigin, requestId, "expired");
  }

  return redirectToDagensTavle(destinationOrigin, requestId, "authorized");
}
