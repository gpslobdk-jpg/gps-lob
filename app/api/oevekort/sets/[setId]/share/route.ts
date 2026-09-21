import {
  buildOevekortShareLink,
  isOevekortUuid,
  parseOevekortShareExpiry,
} from "@/lib/oevekort";
import {
  getOevekortOwnerAccess,
  hasDatabaseMessage,
  isSameOriginRequest,
  oevekortJson,
  readOevekortJson,
  readRpcRow,
  reportOevekortRouteFailure,
  requestOrigin,
} from "@/app/api/oevekort/_shared";
import {
  generateOevekortShareToken,
  hashOevekortShareToken,
} from "@/lib/oevekortServer";

const ROUTE = "/api/oevekort/sets/[setId]/share";

type RouteContext = { params: Promise<{ setId: string }> };

type OevekortShareRow = {
  share_id: string;
  share_created_at: string;
  share_expires_at: string | null;
  sharing_active?: boolean;
};

function toShare(row: OevekortShareRow) {
  if (!isOevekortUuid(row.share_id)) return null;

  return {
    id: row.share_id,
    createdAt: row.share_created_at,
    expiresAt: row.share_expires_at,
    active: row.sharing_active ?? true,
  };
}

async function getSetId(context: RouteContext) {
  const { setId } = await context.params;
  return isOevekortUuid(setId) ? setId : null;
}

function ownerShareUnavailable(error: unknown) {
  return (
    hasDatabaseMessage(error, "oevekort_set_unavailable") ||
    hasDatabaseMessage(error, "oevekort_share_unavailable")
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const setId = await getSetId(context);
    if (!setId) return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);

    const access = await getOevekortOwnerAccess();
    if (!access.ok) return access.response;

    const { data, error } = await access.value.admin.rpc(
      "get_oevekort_share_status",
      {
        p_set_id: setId,
        p_owner_id: access.value.userId,
      }
    );
    if (error) {
      if (hasDatabaseMessage(error, "oevekort_set_unavailable")) {
        return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);
      }
      throw error;
    }

    const row = readRpcRow<OevekortShareRow>(data);
    const share = row ? toShare(row) : null;
    return oevekortJson({ share });
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "GET", "owner-share-status", error);
    return oevekortJson({ error: "Delingen kunne ikke hentes." }, 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) {
      return oevekortJson({ error: "Ugyldig forespørgsel." }, 403);
    }

    const setId = await getSetId(context);
    if (!setId) return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);

    const access = await getOevekortOwnerAccess();
    if (!access.ok) return access.response;

    const body = await readOevekortJson(request);
    if (!body) return oevekortJson({ error: "Ugyldig forespørgsel." }, 400);

    const expiry = parseOevekortShareExpiry(body.expiresAt);
    if (!expiry.ok) return oevekortJson({ error: expiry.error.message, errors: [expiry.error] }, 400);

    const token = generateOevekortShareToken();
    const tokenHash = hashOevekortShareToken(token);
    const origin = requestOrigin(request);
    const shareUrl = origin ? buildOevekortShareLink(origin, token) : null;
    if (!tokenHash || !shareUrl) {
      throw new Error("oevekort_share_link_build_failed");
    }

    const { data, error } = await access.value.admin.rpc("create_oevekort_share", {
      p_set_id: setId,
      p_owner_id: access.value.userId,
      p_token_hash: tokenHash,
      p_expires_at: expiry.value,
    });
    if (error) {
      if (hasDatabaseMessage(error, "oevekort_set_unavailable")) {
        return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);
      }
      if (
        hasDatabaseMessage(error, "oevekort_share_expiry_invalid") ||
        hasDatabaseMessage(error, "oevekort_share_token_invalid")
      ) {
        return oevekortJson({ error: "Delingsindstillingerne er ugyldige." }, 400);
      }
      throw error;
    }

    const row = readRpcRow<OevekortShareRow>(data);
    const share = row ? toShare(row) : null;
    if (!share) throw new Error("oevekort_share_create_result_invalid");

    // This is deliberately the only endpoint response that contains the bearer link.
    return oevekortJson({ share, shareUrl }, 201);
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "POST", "owner-share-create", error);
    return oevekortJson({ error: "Delingslinket kunne ikke oprettes. Prøv igen." }, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) {
      return oevekortJson({ error: "Ugyldig forespørgsel." }, 403);
    }

    const setId = await getSetId(context);
    if (!setId) return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);

    const access = await getOevekortOwnerAccess();
    if (!access.ok) return access.response;

    const body = await readOevekortJson(request);
    if (!body) return oevekortJson({ error: "Ugyldig forespørgsel." }, 400);

    const expiry = parseOevekortShareExpiry(body.expiresAt);
    if (!expiry.ok) return oevekortJson({ error: expiry.error.message, errors: [expiry.error] }, 400);

    const { data, error } = await access.value.admin.rpc(
      "update_oevekort_share_expiry",
      {
        p_set_id: setId,
        p_owner_id: access.value.userId,
        p_expires_at: expiry.value,
      }
    );
    if (error) {
      if (ownerShareUnavailable(error)) {
        return oevekortJson({ error: "Delingslinket blev ikke fundet." }, 404);
      }
      if (hasDatabaseMessage(error, "oevekort_share_expiry_invalid")) {
        return oevekortJson({ error: "Udløbstidspunktet er ugyldigt." }, 400);
      }
      throw error;
    }

    const row = readRpcRow<OevekortShareRow>(data);
    const share = row ? toShare(row) : null;
    if (!share) throw new Error("oevekort_share_update_result_invalid");

    return oevekortJson({ share });
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "PATCH", "owner-share-expiry", error);
    return oevekortJson({ error: "Delingen kunne ikke opdateres. Prøv igen." }, 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) {
      return oevekortJson({ error: "Ugyldig forespørgsel." }, 403);
    }

    const setId = await getSetId(context);
    if (!setId) return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);

    const access = await getOevekortOwnerAccess();
    if (!access.ok) return access.response;

    const { error } = await access.value.admin.rpc("revoke_oevekort_share", {
      p_set_id: setId,
      p_owner_id: access.value.userId,
    });
    if (error) {
      if (ownerShareUnavailable(error)) {
        return oevekortJson({ error: "Delingslinket blev ikke fundet." }, 404);
      }
      throw error;
    }

    return oevekortJson({ revoked: true });
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "DELETE", "owner-share-revoke", error);
    return oevekortJson({ error: "Delingslinket kunne ikke lukkes. Prøv igen." }, 500);
  }
}
