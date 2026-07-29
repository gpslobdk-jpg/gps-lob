import { NextResponse } from "next/server";

import {
  buildMarketingConsentUpdate,
  parseMarketingConsentPayload,
  type MarketingConsentPayload,
} from "@/lib/marketingConsent";
import { getSiteCopy } from "@/lib/siteCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";
import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export async function POST(request: Request) {
  const requestPath = new URL(request.url).pathname;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Du skal være logget ind." }, { status: 401 });
  }

  let payload: MarketingConsentPayload | null = null;
  try {
    payload = parseMarketingConsentPayload(await request.json());
  } catch {
    // The generic validation response below deliberately covers malformed JSON.
  }

  if (!payload) {
    return NextResponse.json(
      { error: "Samtykke skal angives som et ja eller nej." },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
  }

  const siteVariant = resolveSiteVariantFromHeaders(request.headers);
  const canonicalConsentText = getSiteCopy(siteVariant.key).login.marketingConsentStorageText;
  const consentUpdate = buildMarketingConsentUpdate({
    userId: user.id,
    consent: payload.consent,
    canonicalConsentText,
  });

  const { error: updateError } = await adminSupabase
    .from("profiles")
    .upsert(consentUpdate, { onConflict: "id" });

  if (updateError) {
    await logHandledServerError({
      route: "/api/profile/marketing-consent",
      method: "POST",
      status: 500,
      error: updateError,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json(
      { error: "Kunne ikke gemme samtykket." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    marketingConsent: payload.consent,
    marketingConsentAt: consentUpdate.marketing_consent_at,
  });
}
