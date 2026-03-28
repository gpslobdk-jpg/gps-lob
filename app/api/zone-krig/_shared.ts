import { createAdminClient } from "@/utils/supabase/admin";

const DEFAULT_ZONE_RADIUS_METERS = 30;

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type ZoneKrigQuestionRecord = {
  lat?: unknown;
  lng?: unknown;
  radius?: unknown;
  radius_m?: unknown;
};

type ZoneKrigRunRecord = {
  questions?: unknown;
  race_type?: unknown;
  raceType?: unknown;
};

type GameZoneInsertRow = {
  session_id: string;
  zone_index: number;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  owner_team_id: null;
  shield_until: null;
};

function asFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toPositiveInteger(value: unknown, fallback: number) {
  const parsed = asFiniteNumber(value);
  if (parsed === null) {
    return fallback;
  }

  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : fallback;
}

function toZoneRows(sessionId: string, questions: unknown): GameZoneInsertRow[] {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.flatMap((question, index) => {
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      return [];
    }

    const candidate = question as ZoneKrigQuestionRecord;
    const lat = asFiniteNumber(candidate.lat);
    const lng = asFiniteNumber(candidate.lng);

    if (lat === null || lng === null) {
      return [];
    }

    const radius = toPositiveInteger(
      candidate.radius_m ?? candidate.radius,
      DEFAULT_ZONE_RADIUS_METERS
    );

    return [
      {
        session_id: sessionId,
        zone_index: index,
        center_lat: lat,
        center_lng: lng,
        radius_m: radius,
        owner_team_id: null,
        shield_until: null,
      },
    ];
  });
}

export function isZoneKrigRaceType(value: unknown) {
  return typeof value === "string" && value.trim().toLocaleLowerCase("da-DK") === "zone_krig";
}

export async function initializeZoneKrigZones(
  sessionId: string,
  run: ZoneKrigRunRecord | null | undefined,
  adminSupabase: AdminSupabaseClient
) {
  if (!sessionId || !isZoneKrigRaceType(run?.race_type ?? run?.raceType)) {
    return { initialized: false, zoneCount: 0 };
  }

  const zoneRows = toZoneRows(sessionId, run?.questions);
  if (zoneRows.length === 0) {
    return { initialized: true, zoneCount: 0 };
  }

  const { data: existingZones, error: existingZonesError } = await adminSupabase
    .from("game_zones")
    .select("zone_index")
    .eq("session_id", sessionId);

  if (existingZonesError) {
    throw new Error(existingZonesError.message ?? "Kunne ikke hente eksisterende Zone Krig-zoner.");
  }

  const existingZoneIndexes = new Set(
    (existingZones ?? [])
      .map((zone) => (typeof zone?.zone_index === "number" ? zone.zone_index : null))
      .filter((zoneIndex): zoneIndex is number => zoneIndex !== null)
  );

  const missingZoneRows = zoneRows.filter((zone) => !existingZoneIndexes.has(zone.zone_index));
  if (missingZoneRows.length === 0) {
    return {
      initialized: true,
      zoneCount: zoneRows.length,
    };
  }

  const { error } = await adminSupabase.from("game_zones").insert(missingZoneRows);

  if (error) {
    if (error.code === "23505") {
      return {
        initialized: true,
        zoneCount: zoneRows.length,
      };
    }

    throw new Error(error.message ?? "Kunne ikke initialisere Zone Krig-zoner.");
  }

  return {
    initialized: true,
    zoneCount: zoneRows.length,
  };
}