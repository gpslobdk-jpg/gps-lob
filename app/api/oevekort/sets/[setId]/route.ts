import {
  isOevekortUuid,
  parseOevekortSetInput,
} from "@/lib/oevekort";
import {
  getOevekortOwnerAccess,
  hasDatabaseMessage,
  isSameOriginRequest,
  oevekortJson,
  readOevekortJson,
  readRpcRow,
  reportOevekortRouteFailure,
} from "@/app/api/oevekort/_shared";

const ROUTE = "/api/oevekort/sets/[setId]";

type RouteContext = { params: Promise<{ setId: string }> };

type OevekortSetRow = {
  set_id: string;
  set_title: string;
  set_created_at: string;
  set_updated_at: string;
  set_cards: unknown;
};

type UpdateOevekortSetRow = {
  set_id: string;
  set_updated_at: string;
};

type OevekortCardResponse = {
  id: string;
  front: string;
  back: string;
  acceptedAnswers: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toCards(value: unknown): OevekortCardResponse[] | null {
  if (!Array.isArray(value)) return null;

  const cards: OevekortCardResponse[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    if (
      !isOevekortUuid(item.id) ||
      typeof item.front !== "string" ||
      typeof item.back !== "string" ||
      !Array.isArray(item.acceptedAnswers) ||
      !item.acceptedAnswers.every((answer) => typeof answer === "string")
    ) {
      return null;
    }

    cards.push({
      id: item.id,
      front: item.front,
      back: item.back,
      acceptedAnswers: item.acceptedAnswers,
    });
  }

  return cards;
}

async function getSetId(context: RouteContext) {
  const { setId } = await context.params;
  return isOevekortUuid(setId) ? setId : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const setId = await getSetId(context);
    if (!setId) return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);

    const access = await getOevekortOwnerAccess();
    if (!access.ok) return access.response;

    const { data, error } = await access.value.admin.rpc("get_oevekort_set", {
      p_set_id: setId,
      p_owner_id: access.value.userId,
    });
    if (error) throw error;

    const row = readRpcRow<OevekortSetRow>(data);
    const cards = row ? toCards(row.set_cards) : null;
    if (!row || !isOevekortUuid(row.set_id) || !cards) {
      return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);
    }

    return oevekortJson({
      set: {
        id: row.set_id,
        title: row.set_title,
        createdAt: row.set_created_at,
        updatedAt: row.set_updated_at,
        cards,
      },
    });
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "GET", "owner-read", error);
    return oevekortJson({ error: "Sættet kunne ikke hentes." }, 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) {
      return oevekortJson({ error: "Ugyldig forespørgsel." }, 403);
    }

    const setId = await getSetId(context);
    if (!setId) return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);

    const access = await getOevekortOwnerAccess();
    if (!access.ok) return access.response;

    const body = await readOevekortJson(request);
    const parsed = parseOevekortSetInput(body);
    if (!parsed.ok) {
      return oevekortJson({ error: "Ret felterne og prøv igen.", errors: parsed.errors }, 400);
    }

    const { data, error } = await access.value.admin.rpc("update_oevekort_set", {
      p_set_id: setId,
      p_owner_id: access.value.userId,
      p_title: parsed.value.title,
      p_cards: parsed.value.cards,
    });
    if (error) {
      if (hasDatabaseMessage(error, "oevekort_set_unavailable")) {
        return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);
      }
      if (hasDatabaseMessage(error, "oevekort_invalid_payload")) {
        return oevekortJson({ error: "Ret felterne og prøv igen." }, 400);
      }
      throw error;
    }

    const row = readRpcRow<UpdateOevekortSetRow>(data);
    if (!row || !isOevekortUuid(row.set_id)) {
      throw new Error("oevekort_update_result_invalid");
    }

    return oevekortJson({
      set: {
        id: row.set_id,
        updatedAt: row.set_updated_at,
      },
    });
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "PUT", "owner-update", error);
    return oevekortJson({ error: "Sættet kunne ikke gemmes. Prøv igen." }, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  return PUT(request, context);
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

    const { error } = await access.value.admin.rpc("delete_oevekort_set", {
      p_set_id: setId,
      p_owner_id: access.value.userId,
    });
    if (error) {
      if (hasDatabaseMessage(error, "oevekort_set_unavailable")) {
        return oevekortJson({ error: "Sættet blev ikke fundet." }, 404);
      }
      throw error;
    }

    return oevekortJson({ deleted: true });
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "DELETE", "owner-delete", error);
    return oevekortJson({ error: "Sættet kunne ikke slettes. Prøv igen." }, 500);
  }
}
