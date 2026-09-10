import type { LiveStudentLocation } from "@/components/live/types";

export type ParticipantRosterEntry = LiveStudentLocation;

export type ParticipantRosterEvent = {
  type: "INSERT" | "UPDATE" | "DELETE";
  row: Pick<ParticipantRosterEntry, "id"> & Partial<ParticipantRosterEntry>;
  /** Supabase commit timestamp when available. */
  eventTimestamp?: string | null;
};

type ParticipantRosterMutation = {
  revision: number;
  deleted: boolean;
  eventTimestamp: string | null;
};

export type ParticipantRosterState = {
  entries: ParticipantRosterEntry[];
  /**
   * Monotonic local ordering for realtime changes. A REST snapshot captures
   * this value when it starts, so a slower response cannot undo a later
   * INSERT, UPDATE or DELETE event.
   */
  revision: number;
  mutations: Record<string, ParticipantRosterMutation>;
};

function normalizeEntry(
  row: Pick<ParticipantRosterEntry, "id"> & Partial<ParticipantRosterEntry>
): ParticipantRosterEntry | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name =
    typeof row.name === "string" && row.name.trim()
      ? row.name.trim()
      : typeof row.student_name === "string"
        ? row.student_name.trim()
        : "";

  if (!id || !name) return null;

  return {
    id,
    name,
    student_name: name,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    updated_at: row.updated_at ?? null,
    last_updated: row.last_updated ?? null,
    run_started_at: row.run_started_at ?? null,
    finished_at: row.finished_at ?? null,
    startOffset: row.startOffset ?? null,
  };
}

function byId(entries: ParticipantRosterEntry[]) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function timestampMs(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function eventTimestamp(
  event: ParticipantRosterEvent,
  previous: ParticipantRosterEntry | undefined
) {
  const candidate =
    event.eventTimestamp ??
    event.row.updated_at ??
    event.row.last_updated ??
    previous?.updated_at ??
    previous?.last_updated ??
    null;
  return timestampMs(candidate) === null ? null : candidate;
}

function isOlderEvent(
  nextTimestamp: string | null,
  previousTimestamp: string | null | undefined
) {
  const next = timestampMs(nextTimestamp);
  const previous = timestampMs(previousTimestamp);
  return next !== null && previous !== null && next < previous;
}

export function createParticipantRoster(
  rows: Array<Pick<ParticipantRosterEntry, "id"> & Partial<ParticipantRosterEntry>>
): ParticipantRosterState {
  const entries = Array.from(
    rows.reduce((next, row) => {
      const entry = normalizeEntry(row);
      if (entry) next.set(entry.id, entry);
      return next;
    }, new Map<string, ParticipantRosterEntry>()).values()
  );

  return {
    entries,
    revision: 0,
    mutations: {},
  };
}

/** Apply a Supabase participant event by stable participant id, never by name. */
export function applyParticipantRosterEvent(
  current: ParticipantRosterState,
  event: ParticipantRosterEvent
): ParticipantRosterState {
  const id = typeof event.row.id === "string" ? event.row.id.trim() : "";
  if (!id) return current;

  const revision = current.revision + 1;
  const entriesById = byId(current.entries);
  const mutations = { ...current.mutations };
  const previous = entriesById.get(id);
  const previousMutation = current.mutations[id];
  const nextEventTimestamp = eventTimestamp(event, previous);

  if (isOlderEvent(nextEventTimestamp, previousMutation?.eventTimestamp)) {
    return current;
  }

  if (
    event.type !== "DELETE" &&
    isOlderEvent(nextEventTimestamp, previous?.updated_at ?? previous?.last_updated)
  ) {
    return current;
  }

  if (event.type === "DELETE") {
    entriesById.delete(id);
    mutations[id] = { revision, deleted: true, eventTimestamp: nextEventTimestamp };
  } else {
    const nextEntry = normalizeEntry(event.row);
    if (!nextEntry) return current;

    entriesById.set(id, {
      ...previous,
      ...nextEntry,
      // Explicit nulls are privacy-significant and must clear stale data.
      lat: nextEntry.lat,
      lng: nextEntry.lng,
      updated_at: nextEntry.updated_at ?? previous?.updated_at ?? null,
      last_updated: nextEntry.last_updated ?? previous?.last_updated ?? null,
      run_started_at: nextEntry.run_started_at ?? previous?.run_started_at ?? null,
      finished_at: nextEntry.finished_at ?? previous?.finished_at ?? null,
      startOffset: nextEntry.startOffset ?? previous?.startOffset ?? null,
    });
    mutations[id] = { revision, deleted: false, eventTimestamp: nextEventTimestamp };
  }

  return {
    entries: Array.from(entriesById.values()),
    revision,
    mutations,
  };
}

/**
 * Merge an authoritative REST snapshot without allowing an event received
 * after that request began to be rolled back by an older response.
 */
export function mergeParticipantRosterSnapshot(
  current: ParticipantRosterState,
  rows: Array<Pick<ParticipantRosterEntry, "id"> & Partial<ParticipantRosterEntry>>,
  snapshotRevision: number
): ParticipantRosterState {
  const entriesById = byId(createParticipantRoster(rows).entries);
  const currentById = byId(current.entries);
  const pendingMutations: Record<string, ParticipantRosterMutation> = {};

  for (const [id, mutation] of Object.entries(current.mutations)) {
    if (mutation.revision <= snapshotRevision) continue;

    pendingMutations[id] = mutation;
    if (mutation.deleted) {
      entriesById.delete(id);
      continue;
    }

    const currentEntry = currentById.get(id);
    if (currentEntry) entriesById.set(id, currentEntry);
  }

  return {
    entries: Array.from(entriesById.values()),
    revision: current.revision,
    mutations: pendingMutations,
  };
}
