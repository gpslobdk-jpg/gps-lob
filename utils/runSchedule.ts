const SCHEDULE_MARKER = "[gpslob_schedule]";
const SCHEDULE_PROPERTY = "schedule";
const LEGACY_SCHEDULE_PROPERTY = "gpslobSchedule";

const SCHEDULE_STORAGE_KEYS = [
  "description",
  "metadata",
  "meta",
  "settings",
  "config",
  "notes",
  "details",
  "topic",
] as const;

export type RunSchedule = {
  startAt: string | null;
  endAt: string | null;
};

export type RunScheduleGate = "scheduled" | "active" | "expired";
export type RunRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeDateValue = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const hasScheduleShape = (value: Record<string, unknown>) =>
  Object.prototype.hasOwnProperty.call(value, "startAt") ||
  Object.prototype.hasOwnProperty.call(value, "endAt");

export const normalizeRunSchedule = (value: Partial<RunSchedule> | null | undefined) => {
  const startAt = normalizeDateValue(value?.startAt);
  const endAt = normalizeDateValue(value?.endAt);

  if (!startAt && !endAt) {
    return null;
  }

  return { startAt, endAt } satisfies RunSchedule;
};

export const hasRunSchedule = (schedule: RunSchedule | null | undefined) =>
  Boolean(schedule?.startAt || schedule?.endAt);

const parseScheduleObject = (value: Record<string, unknown>) => {
  if (!hasScheduleShape(value)) {
    return null;
  }

  return normalizeRunSchedule({
    startAt: normalizeDateValue(value.startAt),
    endAt: normalizeDateValue(value.endAt),
  });
};

const parseScheduleFromFieldValue = (value: unknown): RunSchedule | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const markerIndex = value.lastIndexOf(SCHEDULE_MARKER);
    const jsonPayload =
      markerIndex >= 0 ? value.slice(markerIndex + SCHEDULE_MARKER.length).trim() : value.trim();

    if (!jsonPayload.startsWith("{")) {
      return null;
    }

    const parsed = tryParseJson(jsonPayload);
    return parsed ? parseScheduleFromFieldValue(parsed) : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const nestedValue = value[SCHEDULE_PROPERTY];
  if (isRecord(nestedValue)) {
    return parseScheduleObject(nestedValue);
  }

  const legacyNestedValue = value[LEGACY_SCHEDULE_PROPERTY];
  if (isRecord(legacyNestedValue)) {
    return parseScheduleObject(legacyNestedValue);
  }

  return parseScheduleObject(value);
};

export const getRunSchedule = (run: RunRecord): RunSchedule | null => {
  for (const key of SCHEDULE_STORAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(run, key)) {
      continue;
    }

    const parsedSchedule = parseScheduleFromFieldValue(run[key]);
    if (parsedSchedule) {
      return parsedSchedule;
    }
  }

  return null;
};

const removeScheduleFromObject = (value: Record<string, unknown>) => {
  const nextValue: Record<string, unknown> = { ...value };
  const hasNestedSchedule =
    isRecord(value[SCHEDULE_PROPERTY]) || isRecord(value[LEGACY_SCHEDULE_PROPERTY]);
  delete nextValue[SCHEDULE_PROPERTY];
  delete nextValue[LEGACY_SCHEDULE_PROPERTY];

  if (!hasNestedSchedule && parseScheduleObject(value)) {
    delete nextValue.startAt;
    delete nextValue.endAt;
  }

  return nextValue;
};

const stripStoredSchedule = (value: string) => {
  const markerIndex = value.lastIndexOf(SCHEDULE_MARKER);

  if (markerIndex >= 0) {
    return value.slice(0, markerIndex).trimEnd();
  }

  const trimmedValue = value.trim();
  const parsedValue = trimmedValue.startsWith("{") ? tryParseJson(trimmedValue) : null;

  if (isRecord(parsedValue) && parseScheduleFromFieldValue(parsedValue)) {
    const nextValue = removeScheduleFromObject(parsedValue);
    return Object.keys(nextValue).length > 0 ? JSON.stringify(nextValue) : "";
  }

  return value.trimEnd();
};

const resolveScheduleStorageKey = (run: RunRecord) => {
  if (Object.prototype.hasOwnProperty.call(run, "description")) {
    return "description";
  }

  return "description";
};

const writeScheduleToFieldValue = (currentValue: unknown, schedule: RunSchedule | null) => {
  if (isRecord(currentValue)) {
    const nextValue = removeScheduleFromObject(currentValue);
    return schedule ? { ...nextValue, [SCHEDULE_PROPERTY]: schedule } : nextValue;
  }

  if (typeof currentValue === "string") {
    const trimmedValue = currentValue.trim();
    const parsedValue = trimmedValue.startsWith("{") ? tryParseJson(trimmedValue) : null;

    if (isRecord(parsedValue)) {
      const nextValue = removeScheduleFromObject(parsedValue);
      if (schedule) {
        nextValue[SCHEDULE_PROPERTY] = schedule;
      }

      return Object.keys(nextValue).length > 0 ? JSON.stringify(nextValue) : "";
    }
  }

  const baseText = typeof currentValue === "string" ? stripStoredSchedule(currentValue) : "";

  if (!schedule) {
    return baseText;
  }

  const serializedSchedule = JSON.stringify(schedule);
  return baseText.length > 0
    ? `${baseText}\n\n${SCHEDULE_MARKER}${serializedSchedule}`
    : `${SCHEDULE_MARKER}${serializedSchedule}`;
};

export const buildRunScheduleUpdate = (
  run: RunRecord,
  schedule: Partial<RunSchedule> | null | undefined
) => {
  const key = resolveScheduleStorageKey(run);
  const normalizedSchedule = normalizeRunSchedule(schedule);
  const updates: Record<string, unknown> = {
    [key]: writeScheduleToFieldValue(run[key], normalizedSchedule),
  };

  for (const storageKey of SCHEDULE_STORAGE_KEYS) {
    if (storageKey === key || !Object.prototype.hasOwnProperty.call(run, storageKey)) {
      continue;
    }

    if (parseScheduleFromFieldValue(run[storageKey])) {
      updates[storageKey] = writeScheduleToFieldValue(run[storageKey], null);
    }
  }

  return {
    key,
    value: updates[key],
    updates,
  };
};

export const getRunScheduleGate = (
  schedule: RunSchedule | null | undefined,
  now = Date.now()
): RunScheduleGate => {
  const startAt = schedule?.startAt ? Date.parse(schedule.startAt) : Number.NaN;
  const endAt = schedule?.endAt ? Date.parse(schedule.endAt) : Number.NaN;

  if (Number.isFinite(endAt) && now >= endAt) {
    return "expired";
  }

  if (Number.isFinite(startAt) && now < startAt) {
    return "scheduled";
  }

  return "active";
};
