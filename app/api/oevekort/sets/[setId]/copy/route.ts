import { isOevekortUuid } from "@/lib/oevekort";
import {
  getOevekortOwnerAccess,
  hasDatabaseMessage,
  isSameOriginRequest,
  oevekortJson,
  readRpcRow,
  reportOevekortRouteFailure,
} from "@/app/api/oevekort/_shared";

const ROUTE = "/api/oevekort/sets/[setId]/copy";

type RouteContext = { params: Promise<{ setId: string }> };

type CopiedSetRow = {
  copied_set_id: string;
  copied_set_created_at: string;
  copied_set_updated_at: string;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) {
      return oevekortJson({ error: "Ugyldig forespørgsel." }, 403);
    }

    const { setId } = await context.params;
    if (!isOevekortUuid(setId)) {
      return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);
    }

    const access = await getOevekortOwnerAccess();
    if (!access.ok) return access.response;

    const { data, error } = await access.value.admin.rpc("copy_oevekort_set", {
      p_source_set_id: setId,
      p_owner_id: access.value.userId,
    });
    if (error) {
      if (hasDatabaseMessage(error, "oevekort_set_unavailable")) {
        return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);
      }
      throw error;
    }

    const row = readRpcRow<CopiedSetRow>(data);
    if (!row || !isOevekortUuid(row.copied_set_id)) {
      throw new Error("oevekort_copy_result_invalid");
    }

    return oevekortJson(
      {
        set: {
          id: row.copied_set_id,
          createdAt: row.copied_set_created_at,
          updatedAt: row.copied_set_updated_at,
        },
      },
      201
    );
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "POST", "owner-copy", error);
    return oevekortJson({ error: "Sættet kunne ikke kopieres. Prøv igen." }, 500);
  }
}
