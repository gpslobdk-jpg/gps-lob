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
  readRpcRows,
  reportOevekortRouteFailure,
} from "@/app/api/oevekort/_shared";

const ROUTE = "/api/oevekort/sets";

type OevekortSetListRow = {
  set_id: string;
  set_title: string;
  card_count: number;
  set_created_at: string;
  set_updated_at: string;
  sharing_active: boolean;
  share_created_at: string | null;
  share_expires_at: string | null;
};

type CreateOevekortSetRow = {
  set_id: string;
  set_created_at: string;
  set_updated_at: string;
};

function toSetSummary(row: OevekortSetListRow) {
  if (
    !isOevekortUuid(row.set_id) ||
    typeof row.set_title !== "string" ||
    typeof row.card_count !== "number"
  ) {
    return null;
  }

  return {
    id: row.set_id,
    title: row.set_title,
    cardCount: row.card_count,
    createdAt: row.set_created_at,
    updatedAt: row.set_updated_at,
    share: {
      active: Boolean(row.sharing_active),
      createdAt: row.share_created_at,
      expiresAt: row.share_expires_at,
    },
  };
}

export async function GET() {
  try {
    const access = await getOevekortOwnerAccess();
    if (!access.ok) return access.response;

    const { data, error } = await access.value.admin.rpc("list_oevekort_sets", {
      p_owner_id: access.value.userId,
    });
    if (error) throw error;

    const sets = readRpcRows<OevekortSetListRow>(data)
      .map(toSetSummary)
      .filter((set): set is NonNullable<typeof set> => Boolean(set));

    return oevekortJson({ sets });
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "GET", "owner-list", error);
    return oevekortJson({ error: "Dine Øvekort kunne ikke hentes." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return oevekortJson({ error: "Ugyldig forespørgsel." }, 403);
    }

    const access = await getOevekortOwnerAccess();
    if (!access.ok) return access.response;

    const body = await readOevekortJson(request);
    const parsed = parseOevekortSetInput(body);
    if (!parsed.ok) {
      return oevekortJson({ error: "Ret felterne og prøv igen.", errors: parsed.errors }, 400);
    }

    const { data, error } = await access.value.admin.rpc("create_oevekort_set", {
      p_owner_id: access.value.userId,
      p_title: parsed.value.title,
      p_cards: parsed.value.cards,
    });
    if (error) {
      if (hasDatabaseMessage(error, "oevekort_invalid_payload")) {
        return oevekortJson({ error: "Ret felterne og prøv igen." }, 400);
      }
      throw error;
    }

    const row = readRpcRow<CreateOevekortSetRow>(data);
    if (!row || !isOevekortUuid(row.set_id)) {
      throw new Error("oevekort_create_result_invalid");
    }

    return oevekortJson(
      {
        set: {
          id: row.set_id,
          createdAt: row.set_created_at,
          updatedAt: row.set_updated_at,
        },
      },
      201
    );
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "POST", "owner-create", error);
    return oevekortJson({ error: "Sættet kunne ikke gemmes. Prøv igen." }, 500);
  }
}
