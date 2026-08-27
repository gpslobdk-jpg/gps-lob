export const LYNBYGGER_PIPELINE_PHASES = [
  "candidate_generation",
  "candidate_parse",
  "candidate_validation",
  "reviewer",
  "rewrite",
  "final_normalization",
] as const;

export type LynbyggerPipelinePhase = (typeof LYNBYGGER_PIPELINE_PHASES)[number];

type LynbyggerErrorContext = {
  pipelinePhase: LynbyggerPipelinePhase;
  model: string;
  operation: string;
  correlationId: string;
};

type UnknownRecord = Record<string, unknown>;

const observedErrors = new WeakSet<object>();
const SAFE_TOKEN_PATTERN = /^[a-zA-Z0-9_.:/-]+$/;
const PROVIDER_REQUEST_ID_PATTERN = /^(?:req|request|chatcmpl|resp|cmpl|gen|run)[_-][a-zA-Z0-9_-]+$/i;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : null;
}

function safeToken(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || !SAFE_TOKEN_PATTERN.test(trimmed)) return undefined;
  if (/^(?:sk-|bearer|eyj)/i.test(trimmed)) return undefined;
  return trimmed;
}

function safeStatus(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

function getCandidates(error: unknown) {
  const candidates: UnknownRecord[] = [];
  let current = asRecord(error);

  for (let depth = 0; current && depth < 3; depth += 1) {
    candidates.push(current);
    const nestedError = asRecord(current.error);
    if (nestedError) candidates.push(nestedError);
    const data = asRecord(current.data);
    if (data) {
      candidates.push(data);
      const dataError = asRecord(data.error);
      if (dataError) candidates.push(dataError);
    }
    current = asRecord(current.cause);
  }

  return candidates;
}

function firstDefined<T>(values: Array<T | undefined>) {
  return values.find((value): value is T => value !== undefined);
}

function getHeaderRequestId(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const headers = value as { get?: (name: string) => unknown } & UnknownRecord;
  const candidate =
    typeof headers.get === "function"
      ? headers.get("x-request-id")
      : headers["x-request-id"] ?? headers["X-Request-Id"];
  const requestId = safeToken(candidate, 128);
  return requestId && PROVIDER_REQUEST_ID_PATTERN.test(requestId) ? requestId : undefined;
}

export function classifyLynbyggerGenerationPhase(
  error: unknown,
  fallback: LynbyggerPipelinePhase,
) {
  const errorName = getLynbyggerErrorName(error).toLowerCase();
  if (/parse|json|noobjectgenerated/.test(errorName)) return "candidate_parse" as const;
  if (/validation|schema|zod|typevalidation/.test(errorName)) {
    return "candidate_validation" as const;
  }
  return fallback;
}

export function getLynbyggerErrorName(error: unknown) {
  if (error instanceof Error) {
    return safeToken(error.name, 80) ?? "Error";
  }

  return safeToken(asRecord(error)?.name, 80) ?? "UnknownError";
}

export function buildSafeLynbyggerErrorMetadata(error: unknown, context: LynbyggerErrorContext) {
  const candidates = getCandidates(error);
  const providerStatus = firstDefined(
    candidates.flatMap((candidate) => [
      safeStatus(candidate.status),
      safeStatus(candidate.statusCode),
      safeStatus(asRecord(candidate.response)?.status),
    ]),
  );
  const providerCode = firstDefined(
    candidates.map((candidate) => safeToken(candidate.code, 80)),
  );
  const providerType = firstDefined(
    candidates.map((candidate) => safeToken(candidate.type, 80)),
  );
  const directRequestId = firstDefined(
    candidates.flatMap((candidate) => [
      safeToken(candidate.requestID, 128),
      safeToken(candidate.requestId, 128),
      safeToken(candidate.request_id, 128),
    ]),
  );
  const headerRequestId = firstDefined(
    candidates.flatMap((candidate) => [
      getHeaderRequestId(candidate.headers),
      getHeaderRequestId(candidate.responseHeaders),
      getHeaderRequestId(asRecord(candidate.response)?.headers),
    ]),
  );
  const requestIdCandidate = directRequestId ?? headerRequestId;
  const providerRequestId =
    requestIdCandidate && PROVIDER_REQUEST_ID_PATTERN.test(requestIdCandidate)
      ? requestIdCandidate
      : undefined;

  return {
    pipelinePhase: context.pipelinePhase,
    errorName: getLynbyggerErrorName(error),
    ...(providerStatus === undefined ? {} : { providerStatus }),
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(providerType === undefined ? {} : { providerType }),
    ...(providerRequestId === undefined ? {} : { providerRequestId }),
    model: context.model,
    operation: context.operation,
    correlationId: context.correlationId,
  };
}

export function logLynbyggerPipelineError(error: unknown, context: LynbyggerErrorContext) {
  const errorObject = asRecord(error);
  if (errorObject && observedErrors.has(errorObject)) return;

  console.error("Lynbygger AI pipeline failure.", buildSafeLynbyggerErrorMetadata(error, context));
  if (errorObject) observedErrors.add(errorObject);
}
