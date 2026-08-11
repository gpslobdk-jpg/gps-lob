import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

test.describe("standard student answer server idempotency", () => {
  test("operationId is optional for old clients and accepts only opaque UUIDs", () => {
    const route = source("app/api/play/submit-answer/route.ts");
    const parserStart = route.indexOf("function parseClientOperationId");
    const parserEnd = route.indexOf(
      "function isArrayOfRecords",
      parserStart
    );
    const parser = route.slice(parserStart, parserEnd);

    expect(route).toContain("operationId?: unknown");
    expect(parser).toContain(
      'value === undefined || value === null || value === ""'
    );
    expect(parser).toContain("provided: false");
    expect(parser).toContain("valid: true");
    expect(parser).toContain("value.trim().toLowerCase()");
    expect(parser).toContain("CLIENT_OPERATION_ID_PATTERN.test(normalized)");
    expect(route).toContain(
      "client_operation_id: standardOperationId"
    );
  });

  test("operation id gracefully falls back before the migration is applied", () => {
    const route = source("app/api/play/submit-answer/route.ts");
    const lookupStart = route.indexOf(
      "async function findExistingAnswerByOperationId"
    );
    const lookupEnd = route.indexOf(
      "async function maybeStampRunStartedAt",
      lookupStart
    );
    const operationLookup = route.slice(lookupStart, lookupEnd);
    const standardBlockStart = route.indexOf(
      "if (isStandardStudentSubmission) {"
    );
    const standardBlockEnd = route.indexOf(
      "for (const payload of sanitizedPayloads)",
      standardBlockStart
    );
    const standardBlock = route.slice(standardBlockStart, standardBlockEnd);

    expect(operationLookup).toContain("if (isMissingColumnError(error))");
    expect(operationLookup).toContain("return null");
    expect(standardBlock).toMatch(
      /const legacyPayload(?:: Record<string, unknown>)? = \{ \.\.\.operationPayload \}/
    );
    expect(standardBlock).toContain("delete legacyPayload.client_operation_id");
    expect(standardBlock).toContain("return [operationPayload, legacyPayload]");
  });

  test("standard quiz answers use server correctness before points and persistence", () => {
    const route = source("app/api/play/submit-answer/route.ts");
    const canonicalizerStart = route.indexOf(
      "async function canonicalizeStandardAnswerPayload"
    );
    const canonicalizerEnd = route.indexOf(
      "async function createStandardDuplicateResponse",
      canonicalizerStart
    );
    const canonicalizer = route.slice(canonicalizerStart, canonicalizerEnd);
    const standardBlockStart = route.indexOf(
      "if (isStandardStudentSubmission) {"
    );
    const standardBlockEnd = route.indexOf(
      "for (const payload of sanitizedPayloads)",
      standardBlockStart
    );
    const standardBlock = route.slice(standardBlockStart, standardBlockEnd);

    expect(canonicalizer).toContain(
      "const serverCorrectness = await resolveServerCorrectness(payload, runCache)"
    );
    expect(canonicalizer).toContain("is_correct:");
    expect(canonicalizer).toContain(
      "serverCorrectness?.checked === true && serverCorrectness.isCorrect === true"
    );
    expect(canonicalizer).toContain("return withAwardedPoints(");
    expect(standardBlock).toContain(
      "canonicalizeStandardAnswerPayload(payload, runCache)"
    );
    expect(
      standardBlock.indexOf("canonicalizeStandardAnswerPayload(payload, runCache)")
    ).toBeLessThan(standardBlock.indexOf("client_operation_id: standardOperationId"));
  });

  test("participant identity wins and name fallback is restricted to legacy rows", () => {
    const route = source("app/api/play/submit-answer/route.ts");
    const lookupStart = route.indexOf("async function findExistingAnswerRecord");
    const lookupEnd = route.indexOf(
      "async function findExistingAnswerByOperationId",
      lookupStart
    );
    const lookup = route.slice(lookupStart, lookupEnd);

    expect(lookup.indexOf('column: "participant_id"')).toBeGreaterThan(-1);
    expect(lookup.indexOf('column: "student_name"')).toBeGreaterThan(
      lookup.indexOf('column: "participant_id"')
    );
    expect(lookup).toContain('query = query.is("participant_id", null)');
  });

  test("new route and session checks are gated to raw standard race types", () => {
    const route = source("app/api/play/submit-answer/route.ts");

    expect(route).toContain(
      "const hasRequestedOperationId = Boolean(asTrimmedString(body.operationId))"
    );
    expect(route).toContain("if (!run && hasRequestedOperationId)");
    expect(route).toContain(
      "usesStandardStudentLocationExperience(rawRaceType)"
    );
    expect(route).toContain("if (isStandardStudentSubmission) {");
    expect(route).toContain("validateStandardSubmissionSafety({");
    expect(route).toContain("answeredPostIndexes: [...answeredPostIndexes].sort");
    expect(route).toContain('"answeredPostIndexes" in safetyResult');
    expect(route).toContain("STANDARD_SUBMISSION_SESSION_STATUSES");
    expect(route).toContain("getServerRouteOrder(");

    // The existing special-game capture branch remains available outside the
    // standard-only safety block.
    expect(route).toContain(
      "const zoneKrigCapture = await maybeCaptureZone("
    );
  });

  test("a standard unique conflict re-queries and returns duplicate success", () => {
    const route = source("app/api/play/submit-answer/route.ts");
    const conflictStart = route.indexOf(
      "isUniqueViolationError(error)"
    );
    const conflictEnd = route.indexOf(
      "if (isMissingColumnError(error))",
      conflictStart
    );
    const conflictHandler = route.slice(conflictStart, conflictEnd);
    const duplicateResponseStart = route.indexOf(
      "async function createStandardDuplicateResponse"
    );
    const duplicateResponseEnd = route.indexOf(
      "async function resolveZoneKrigTeamId",
      duplicateResponseStart
    );
    const duplicateResponse = route.slice(
      duplicateResponseStart,
      duplicateResponseEnd
    );

    expect(conflictStart).toBeGreaterThan(-1);
    expect(conflictHandler).toContain("findExistingAnswerByOperationId(");
    expect(conflictHandler).toContain("findExistingAnswerRecord(");
    expect(conflictHandler).toContain("createStandardDuplicateResponse(");
    expect(duplicateResponse).toContain("inserted: true");
    expect(duplicateResponse).toContain("isLocked: true");
    expect(duplicateResponse).toContain("duplicate: true");
  });

  test("migration is additive, preflights duplicates, and replaces the name lock last", () => {
    const sql = source(
      "supabase/migrations/202607280001_student_answer_idempotency.sql"
    );
    const normalized = sql.toLowerCase();

    expect(normalized).toContain(
      "add column if not exists client_operation_id uuid"
    );
    expect(normalized).toContain(
      "group by session_id, participant_id, question_index"
    );
    expect(normalized).toContain("having count(*) > 1");
    expect(normalized).toContain("raise exception");
    expect(normalized).not.toMatch(/\bupdate\b/);
    expect(normalized).not.toMatch(/\bdelete\b/);

    const participantPostIndex = normalized.indexOf(
      "create unique index if not exists answers_session_participant_question_uidx"
    );
    const participantOperationIndex = normalized.indexOf(
      "create unique index if not exists answers_participant_operation_uidx"
    );
    const legacyNameIndex = normalized.indexOf(
      "create unique index if not exists answers_legacy_student_question_uidx"
    );
    const oldNameIndexDrop = normalized.indexOf(
      "drop index if exists public.answers_participant_question_index_uidx"
    );

    expect(participantPostIndex).toBeGreaterThan(-1);
    expect(participantOperationIndex).toBeGreaterThan(participantPostIndex);
    expect(legacyNameIndex).toBeGreaterThan(participantOperationIndex);
    expect(oldNameIndexDrop).toBeGreaterThan(legacyNameIndex);
    expect(normalized).toContain("where participant_id is null");
    expect(normalized).toContain("client_operation_id is not null");
  });
});
