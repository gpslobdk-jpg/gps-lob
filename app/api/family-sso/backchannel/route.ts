import { NextResponse } from "next/server";

import {
  FAMILY_SSO_TTL_SECONDS,
  FAMILY_SSO_REQUEST_PATTERN,
  getFamilySsoAudience,
  getFamilySsoExchangeSecret,
  getFamilySsoOrigin,
  getSafeFamilySsoPath,
  isFamilySsoAudienceEnabled,
} from "@/lib/familySso/config";
import { digestFamilySsoValue, verifyFamilySsoBackchannel } from "@/lib/familySso/crypto";
import { createPrintMitIdentity, isActiveFamilySsoUser } from "@/lib/familySso/identity";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const TERMS_VERSION = "2026-08-08";

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return json({ ok: false, code: "INVALID_REQUEST" }, 413);
  }

  const rawBody = await request.text();
  if (rawBody.length > 4096) return json({ ok: false, code: "INVALID_REQUEST" }, 413);
  let parsed: JsonRecord | null = null;
  try {
    parsed = asRecord(JSON.parse(rawBody));
  } catch {
    return json({ ok: false, code: "INVALID_REQUEST" }, 400);
  }
  if (!parsed) return json({ ok: false, code: "INVALID_REQUEST" }, 400);

  const audience = getFamilySsoAudience(parsed.audience);
  if (!audience) return json({ ok: false, code: "INVALID_AUDIENCE" }, 400);
  if (!isFamilySsoAudienceEnabled(audience)) return json({ ok: false, code: "DISABLED" }, 404);
  const secret = getFamilySsoExchangeSecret(audience);
  const destinationOrigin = getFamilySsoOrigin(audience);
  const admin = createAdminClient();
  if (!secret || !destinationOrigin || !admin) {
    return json({ ok: false, code: "NOT_CONFIGURED" }, 503);
  }

  if (!verifyFamilySsoBackchannel({
    body: rawBody,
    timestamp: request.headers.get("x-family-sso-timestamp"),
    signature: request.headers.get("x-family-sso-signature"),
    secret,
  })) {
    return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  }

  const action = parsed.action;
  const requestHash = parsed.requestHash;
  const nonceHash = parsed.nonceHash;
  if (typeof action !== "string" || !isHash(requestHash)) {
    return json({ ok: false, code: "INVALID_REQUEST" }, 400);
  }

  if (action === "create") {
    if (!isHash(nonceHash)) return json({ ok: false, code: "INVALID_REQUEST" }, 400);
    const returnPath = getSafeFamilySsoPath(audience, parsed.returnPath);
    const { error } = await admin.from("family_sso_requests").insert({
      request_hash: requestHash,
      nonce_hash: nonceHash,
      destination_origin: destinationOrigin,
      return_path: returnPath,
      expires_at: new Date(Date.now() + FAMILY_SSO_TTL_SECONDS * 1000).toISOString(),
    });
    return error
      ? json({ ok: false, code: "CREATE_FAILED" }, 409)
      : json({ ok: true, expiresIn: FAMILY_SSO_TTL_SECONDS }, 201);
  }

  if (!isHash(nonceHash)) return json({ ok: false, code: "INVALID_REQUEST" }, 400);

  if (action === "inspect") {
    const { data: handoff, error } = await admin
      .from("family_sso_requests")
      .select("user_id,status,expires_at")
      .eq("request_hash", requestHash)
      .eq("nonce_hash", nonceHash)
      .eq("destination_origin", destinationOrigin)
      .maybeSingle();
    if (error || !handoff || handoff.status !== "authorized" || Date.parse(handoff.expires_at) <= Date.now()) {
      return json({ ok: false, code: "HANDOFF_INVALID" }, 410);
    }

    if (audience === "printmitarbejdsark") {
      return json({
        ok: true,
        subject: handoff.user_id,
        termsAccepted: true,
        disabled: false,
        termsVersion: null,
      });
    }

    const { data: profile } = await admin
      .from("dagenstavle_family_profiles")
      .select("terms_version,terms_accepted_at,disabled_at")
      .eq("user_id", handoff.user_id)
      .maybeSingle();
    return json({
      ok: true,
      subject: handoff.user_id,
      termsAccepted: Boolean(
        profile?.terms_accepted_at &&
        profile.terms_version === TERMS_VERSION &&
        !profile.disabled_at
      ),
      disabled: Boolean(profile?.disabled_at),
      termsVersion: TERMS_VERSION,
    });
  }

  if (action === "accept_terms") {
    if (audience !== "dagenstavle") return json({ ok: false, code: "INVALID_ACTION" }, 400);
    const { data: handoff } = await admin
      .from("family_sso_requests")
      .select("user_id,status,expires_at")
      .eq("request_hash", requestHash)
      .eq("nonce_hash", nonceHash)
      .eq("destination_origin", destinationOrigin)
      .maybeSingle();
    if (!handoff || handoff.status !== "authorized" || Date.parse(handoff.expires_at) <= Date.now()) {
      return json({ ok: false, code: "HANDOFF_INVALID" }, 410);
    }

    const { data: existingProfile } = await admin
      .from("dagenstavle_family_profiles")
      .select("disabled_at")
      .eq("user_id", handoff.user_id)
      .maybeSingle();
    if (existingProfile?.disabled_at) return json({ ok: false, code: "ACCOUNT_DISABLED" }, 403);

    const now = new Date().toISOString();
    const { error } = await admin.from("dagenstavle_family_profiles").upsert({
      user_id: handoff.user_id,
      terms_version: TERMS_VERSION,
      terms_accepted_at: now,
      last_sso_at: now,
    }, { onConflict: "user_id" });
    return error
      ? json({ ok: false, code: "TERMS_FAILED" }, 500)
      : json({ ok: true, termsVersion: TERMS_VERSION });
  }

  if (action === "invalidate") {
    await admin.rpc("invalidate_family_sso_request", {
      p_request_hash: requestHash,
      p_nonce_hash: nonceHash,
      p_destination_origin: destinationOrigin,
    });
    return json({ ok: true });
  }

  if (action !== "consume") return json({ ok: false, code: "INVALID_ACTION" }, 400);

  const requestId = parsed.requestId;
  if (
    audience === "printmitarbejdsark" &&
    (typeof requestId !== "string" ||
      !FAMILY_SSO_REQUEST_PATTERN.test(requestId) ||
      digestFamilySsoValue(requestId) !== requestHash)
  ) {
    return json({ ok: false, code: "INVALID_REQUEST" }, 400);
  }

  const { data: consumed, error: consumeError } = await admin.rpc(
    "consume_family_sso_request",
    {
      p_request_hash: requestHash,
      p_nonce_hash: nonceHash,
      p_destination_origin: destinationOrigin,
    }
  );
  const consumedRow = Array.isArray(consumed) ? consumed[0] : null;
  if (consumeError || !consumedRow?.user_id || !consumedRow?.verified_email) {
    return json({ ok: false, code: "HANDOFF_INVALID" }, 410);
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(
    consumedRow.user_id
  );
  if (userError || !userData.user || !isActiveFamilySsoUser(userData.user)) {
    return json({ ok: false, code: "ACCOUNT_DISABLED" }, 403);
  }
  if (userData.user.email?.toLowerCase() !== String(consumedRow.verified_email).toLowerCase()) {
    return json({ ok: false, code: "IDENTITY_CHANGED" }, 403);
  }

  if (audience === "printmitarbejdsark") {
    const identity = createPrintMitIdentity({
      subject: consumedRow.user_id,
      email: userData.user.email,
      requestId: String(requestId),
    });
    if (!identity) return json({ ok: false, code: "IDENTITY_INVALID" }, 500);
    return json({
      ok: true,
      identity,
      next: getSafeFamilySsoPath(audience, consumedRow.return_path),
    });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) return json({ ok: false, code: "SESSION_FAILED" }, 500);

  await admin.from("dagenstavle_family_profiles").update({
    last_sso_at: new Date().toISOString(),
  }).eq("user_id", consumedRow.user_id);

  return json({
    ok: true,
    subject: consumedRow.user_id,
    tokenHash,
    tokenType: "magiclink",
    next: getSafeFamilySsoPath(audience, consumedRow.return_path),
  });
}
