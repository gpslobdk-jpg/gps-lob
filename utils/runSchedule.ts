const SCHEDULE_MARKER = "[gpslob_schedule]";
const SCHEDULE_PROPERTY = "gpslobSchedule";

const SCHEDULE_STORAGE_KEYS = [
  "metadata",
  "description",
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

    try {
      const parsed = JSON.parse(jsonPayload) as unknown;
      return parseScheduleFromFieldValue(parsed);
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) {
    return null;
  }

  const directMatch = parseScheduleObject(value);
  if (directMatch) {
    return directMatch;
  }

  const nestedValue = value[SCHEDULE_PROPERTY];
  return isRecord(nestedValue) ? parseScheduleObject(nestedValue) : null;
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

const stripStoredSchedule = (value: string) => {
  const markerIndex = value.lastIndexOf(SCHEDULE_MARKER);

  if (markerIndex >= 0) {
    return value.slice(0, markerIndex).trimEnd();
  }

  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("{") && parseScheduleFromFieldValue(trimmedValue)) {
    return "";
  }

  return value.trimEnd();
};

const resolveScheduleStorageKey = (run: RunRecord) => {
  for (const key of SCHEDULE_STORAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(run, key)) {
      continue;
    }

    if (parseScheduleFromFieldValue(run[key])) {
      return key;
    }
  }

  for (const key of SCHEDULE_STORAGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(run, key)) {
      return key;
    }
  }

  return "topic";
};

const writeScheduleToFieldValue = (currentValue: unknown, schedule: RunSchedule | null) => {
  if (isRecord(currentValue)) {
    const nextValue: Record<string, unknown> = { ...currentValue };

    if (schedule) {
      nextValue[SCHEDULE_PROPERTY] = schedule;
    } else {
      delete nextValue[SCHEDULE_PROPERTY];
    }

    return nextValue;
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

  return {
    key,
    value: writeScheduleToFieldValue(run[key], normalizedSchedule),
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
