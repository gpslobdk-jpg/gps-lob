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
const MAX_ERROR_NESTING_DEPTH = 3;
const MAX_RETRY_ATTEMPTS_TO_REPORT = 100;
const SAFE_TOKEN_PATTERN = /^[a-zA-Z0-9_.:/-]+$/;
const PROVIDER_REQUEST_ID_PATTERN = /^(?:req|request|chatcmpl|resp|cmpl|gen|run)[_-][a-zA-Z0-9_-]+$/i;
const RETRY_REASONS = new Set(["maxRetriesExceeded", "errorNotRetryable", "abort"]);
const PROVIDER_REQUEST_ID_HEADER_NAMES = [
  "x-request-id",
  "request-id",
  "openai-request-id",
] as const;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : null;
}

function readField(record: UnknownRecord, field: string) {
  try {
    return record[field];
  } catch {
    return undefined;
  }
}

function safeToken(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || !SAFE_TOKEN_PATTERN.test(trimmed)) return undefined;
  if (/^(?:sk-|bearer|eyj)/i.test(trimmed)) return undefined;
  return trimmed;
}

function safeStatus(value: unknown) {
  const numericValue =
    typeof value === "string" && /^\d{3}$/.test(value) ? Number(value) : value;
  return typeof numericValue === "number" &&
    Number.isInteger(numericValue) &&
    numericValue >= 100 &&
    numericValue <= 599
    ? numericValue
    : undefined;
}

function safeProviderCode(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return safeToken(value, 80);
}

function safeRetryReason(value: unknown) {
  const reason = safeToken(value, 40);
  return reason && RETRY_REASONS.has(reason) ? reason : undefined;
}

function getCandidates(error: unknown) {
  const candidates: UnknownRecord[] = [];
  let current = asRecord(error);

  for (let depth = 0; current && depth < MAX_ERROR_NESTING_DEPTH; depth += 1) {
    candidates.push(current);
    const nestedError = asRecord(readField(current, "error"));
    if (nestedError) candidates.push(nestedError);
    const data = asRecord(readField(current, "data"));
    if (data) {
      candidates.push(data);
      const dataError = asRecord(readField(data, "error"));
      if (dataError) candidates.push(dataError);
    }
    current = asRecord(readField(current, "cause"));
  }

  return candidates;
}

function getRetryErrorDetails(error: unknown) {
  if (getLynbyggerErrorName(error) !== "AI_RetryError") return {};

  const retryError = asRecord(error);
  if (!retryError) return {};

  const errorsValue = readField(retryError, "errors");
  const errors = Array.isArray(errorsValue) ? errorsValue : undefined;
  const providerAttemptCount =
    errors && errors.length > 0 && errors.length <= MAX_RETRY_ATTEMPTS_TO_REPORT
      ? errors.length
      : undefined;
  const lastError = readField(retryError, "lastError");
  const lastArrayError = errors && errors.length > 0 ? errors[errors.length - 1] : undefined;
  const nestedError = asRecord(lastError)
    ? lastError
    : asRecord(lastArrayError)
      ? lastArrayError
      : undefined;

  return {
    retryReason: safeRetryReason(readField(retryError, "reason")),
    providerAttemptCount,
    nestedError,
  };
}

function firstDefined<T>(values: Array<T | undefined>) {
  return values.find((value): value is T => value !== undefined);
}

function getHeaderRequestId(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const headers = value as { get?: (name: string) => unknown } & UnknownRecord;
  const getHeader = typeof headers.get === "function" ? headers.get.bind(headers) : undefined;

  for (const headerName of PROVIDER_REQUEST_ID_HEADER_NAMES) {
    let candidate: unknown;
    try {
      const titleCaseHeaderName = headerName
        .split("-")
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join("-");
      candidate = getHeader
        ? getHeader(headerName)
        : readField(headers, headerName) ??
          readField(headers, titleCaseHeaderName) ??
          readField(headers, headerName.toUpperCase());
    } catch {
      candidate = undefined;
    }
    const requestId = safeToken(candidate, 128);
    if (requestId && PROVIDER_REQUEST_ID_PATTERN.test(requestId)) return requestId;
  }

  return undefined;
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

  const errorRecord = asRecord(error);
  return safeToken(errorRecord ? readField(errorRecord, "name") : undefined, 80) ?? "UnknownError";
}

export function buildSafeLynbyggerErrorMetadata(error: unknown, context: LynbyggerErrorContext) {
  const retryDetails = getRetryErrorDetails(error);
  const candidates = getCandidates(retryDetails.nestedError ?? error);
  const nestedErrorName = retryDetails.nestedError
    ? getLynbyggerErrorName(retryDetails.nestedError)
    : undefined;
  const providerStatus = firstDefined(
    candidates.flatMap((candidate) => [
      safeStatus(readField(candidate, "status")),
      safeStatus(readField(candidate, "statusCode")),
      safeStatus(readField(candidate, "httpStatus")),
      safeStatus(readField(candidate, "httpStatusCode")),
      safeStatus(asRecord(readField(candidate, "response"))?.status),
      safeStatus(asRecord(readField(candidate, "response"))?.statusCode),
    ]),
  );
  const providerCode = firstDefined(
    candidates.flatMap((candidate) => [
      safeProviderCode(readField(candidate, "code")),
      safeProviderCode(readField(candidate, "errorCode")),
      safeProviderCode(readField(candidate, "error_code")),
    ]),
  );
  const providerType = firstDefined(
    candidates.flatMap((candidate) => [
      safeToken(readField(candidate, "type"), 80),
      safeToken(readField(candidate, "errorType"), 80),
      safeToken(readField(candidate, "error_type"), 80),
    ]),
  );
  const directRequestId = firstDefined(
    candidates.flatMap((candidate) => [
      safeToken(readField(candidate, "requestID"), 128),
      safeToken(readField(candidate, "requestId"), 128),
      safeToken(readField(candidate, "request_id"), 128),
      safeToken(readField(candidate, "providerRequestId"), 128),
      safeToken(readField(candidate, "provider_request_id"), 128),
    ]),
  );
  const headerRequestId = firstDefined(
    candidates.flatMap((candidate) => [
      getHeaderRequestId(readField(candidate, "headers")),
      getHeaderRequestId(readField(candidate, "responseHeaders")),
      getHeaderRequestId(asRecord(readField(candidate, "response"))?.headers),
    ]),
  );
  const requestIdCandidate = directRequestId ?? headerRequestId;
  const providerRequestId =
    requestIdCandidate && PROVIDER_REQUEST_ID_PATTERN.test(requestIdCandidate)
      ? requestIdCandidate
      : undefined;
  const providerModel = firstDefined(
    candidates.flatMap((candidate) => [
      safeToken(readField(candidate, "model"), 100),
      safeToken(readField(candidate, "modelId"), 100),
      safeToken(readField(candidate, "model_id"), 100),
    ]),
  );
  const providerOperation = firstDefined(
    candidates.flatMap((candidate) => [
      safeToken(readField(candidate, "operation"), 100),
      safeToken(readField(candidate, "operationName"), 100),
      safeToken(readField(candidate, "operation_name"), 100),
      safeToken(readField(candidate, "apiOperation"), 100),
      safeToken(readField(candidate, "api_operation"), 100),
    ]),
  );

  return {
    pipelinePhase: context.pipelinePhase,
    errorName: getLynbyggerErrorName(error),
    ...(retryDetails.retryReason === undefined
      ? {}
      : { retryReason: retryDetails.retryReason }),
    ...(retryDetails.providerAttemptCount === undefined
      ? {}
      : { providerAttemptCount: retryDetails.providerAttemptCount }),
    ...(nestedErrorName === undefined ? {} : { nestedErrorName }),
    ...(providerStatus === undefined ? {} : { providerStatus }),
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(providerType === undefined ? {} : { providerType }),
    ...(providerRequestId === undefined ? {} : { providerRequestId }),
    ...(providerModel === undefined ? {} : { providerModel }),
    ...(providerOperation === undefined ? {} : { providerOperation }),
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
