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

export type RunScheduleReadState = "missing" | "valid" | "error";
export type RunScheduleReadResult = {
  schedule: RunSchedule | null;
  state: RunScheduleReadState;
};

export type RunScheduleGate = "scheduled" | "active" | "expired" | "error";
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

const missingScheduleResult = (): RunScheduleReadResult => ({
  schedule: null,
  state: "missing",
});

const invalidScheduleResult = (): RunScheduleReadResult => ({
  schedule: null,
  state: "error",
});

const validScheduleResult = (schedule: RunSchedule): RunScheduleReadResult => ({
  schedule,
  state: "valid",
});

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

const parseScheduleObjectDetailed = (value: Record<string, unknown>): RunScheduleReadResult => {
  if (!hasScheduleShape(value)) {
    return missingScheduleResult();
  }

  const schedule = parseScheduleObject(value);
  return schedule ? validScheduleResult(schedule) : invalidScheduleResult();
};

const parseScheduleFromFieldValueDetailed = (value: unknown): RunScheduleReadResult => {
  if (!value) {
    return missingScheduleResult();
  }

  if (typeof value === "string") {
    const markerIndex = value.lastIndexOf(SCHEDULE_MARKER);
    const trimmedValue = value.trim();
    const jsonPayload =
      markerIndex >= 0 ? value.slice(markerIndex + SCHEDULE_MARKER.length).trim() : trimmedValue;

    if (!jsonPayload.startsWith("{")) {
      return markerIndex >= 0 ? invalidScheduleResult() : missingScheduleResult();
    }

    const parsed = tryParseJson(jsonPayload);
    return parsed ? parseScheduleFromFieldValueDetailed(parsed) : invalidScheduleResult();
  }

  if (!isRecord(value)) {
    return missingScheduleResult();
  }

  if (Object.prototype.hasOwnProperty.call(value, SCHEDULE_PROPERTY)) {
    const nestedValue = value[SCHEDULE_PROPERTY];
    if (!isRecord(nestedValue)) {
      return invalidScheduleResult();
    }

    return parseScheduleObjectDetailed(nestedValue);
  }

  if (Object.prototype.hasOwnProperty.call(value, LEGACY_SCHEDULE_PROPERTY)) {
    const legacyNestedValue = value[LEGACY_SCHEDULE_PROPERTY];
    if (!isRecord(legacyNestedValue)) {
      return invalidScheduleResult();
    }

    return parseScheduleObjectDetailed(legacyNestedValue);
  }

  return parseScheduleObjectDetailed(value);
};

const parseScheduleFromFieldValue = (value: unknown): RunSchedule | null =>
  parseScheduleFromFieldValueDetailed(value).schedule;

export const inspectRunSchedule = (run: RunRecord): RunScheduleReadResult => {
  for (const key of SCHEDULE_STORAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(run, key)) {
      continue;
    }

    const result = parseScheduleFromFieldValueDetailed(run[key]);
    if (result.state === "valid" || result.state === "error") {
      return result;
    }
  }

  return missingScheduleResult();
};

export const getRunSchedule = (run: RunRecord): RunSchedule | null =>
  inspectRunSchedule(run).schedule;

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
  scheduleOrResult: RunSchedule | RunScheduleReadResult | null | undefined,
  now = Date.now()
): RunScheduleGate => {
  const schedule =
    isRecord(scheduleOrResult) && "state" in scheduleOrResult
      ? scheduleOrResult.schedule
      : scheduleOrResult;
  const state =
    isRecord(scheduleOrResult) && "state" in scheduleOrResult ? scheduleOrResult.state : "valid";

  if (state === "error") {
    return "error";
  }

  const startAt = schedule?.startAt ? Date.parse(schedule.startAt) : Number.NaN;
  const endAt = schedule?.endAt ? Date.parse(schedule.endAt) : Number.NaN;

  if ((schedule?.startAt && !Number.isFinite(startAt)) || (schedule?.endAt && !Number.isFinite(endAt))) {
    return "error";
  }

  if (Number.isFinite(endAt) && now >= endAt) {
    return "expired";
  }

  if (Number.isFinite(startAt) && now < startAt) {
    return "scheduled";
  }

  return "active";
};
