import { isOevekortUuid, normalizeOevekortShareToken } from "@/lib/oevekort";
import {
  hasDatabaseMessage,
  oevekortJson,
  readOevekortJson,
  readRpcRow,
  reportOevekortRouteFailure,
} from "@/app/api/oevekort/_shared";
import { hashOevekortShareToken } from "@/lib/oevekortServer";
import { createAdminClient } from "@/utils/supabase/admin";

const ROUTE = "/api/oevekort/public";

type PublicShareRow = {
  public_set_title: string;
  public_set_cards: unknown;
};

type PublicCard = {
  id: string;
  front: string;
  back: string;
  acceptedAnswers: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPublicCards(value: unknown): PublicCard[] | null {
  if (!Array.isArray(value) || !value.length) return null;

  const cards: PublicCard[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
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

export async function POST(request: Request) {
  try {
    const body = await readOevekortJson(request);
    const token = normalizeOevekortShareToken(body?.token);
    const tokenHash = hashOevekortShareToken(token);
    if (!token || !tokenHash) {
      return oevekortJson(
        { error: "Delingslinket er ugyldigt eller deaktiveret.", terminal: true },
        404
      );
    }

    const admin = createAdminClient();
    if (!admin) {
      return oevekortJson(
        { error: "Øvekort er midlertidigt utilgængeligt." },
        503
      );
    }

    const { data, error } = await admin.rpc("read_oevekort_public_share", {
      p_token_hash: tokenHash,
    });
    if (error) {
      if (hasDatabaseMessage(error, "oevekort_share_invalid_or_inactive")) {
        return oevekortJson(
          { error: "Delingslinket er ugyldigt eller deaktiveret.", terminal: true },
          404
        );
      }
      throw error;
    }

    const row = readRpcRow<PublicShareRow>(data);
    const cards = row ? toPublicCards(row.public_set_cards) : null;
    if (!row || typeof row.public_set_title !== "string" || !cards) {
      return oevekortJson(
        { error: "Delingslinket er ugyldigt eller deaktiveret.", terminal: true },
        404
      );
    }

    return oevekortJson({
      set: {
        title: row.public_set_title,
        cards,
      },
    });
  } catch (error) {
    await reportOevekortRouteFailure(ROUTE, "POST", "public-read", error);
    return oevekortJson({ error: "Sættet kunne ikke hentes. Prøv igen." }, 500);
  }
}
