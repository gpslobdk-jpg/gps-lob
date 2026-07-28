import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { usesStandardStudentLocationExperience } from "../lib/location/studentLocationState";

const photoRoutePath = join(
  process.cwd(),
  "app",
  "api",
  "play",
  "submit-photo",
  "route.ts"
);
const skipRoutePath = join(
  process.cwd(),
  "app",
  "api",
  "play",
  "skip-post",
  "route.ts"
);

const photoRouteSource = readFileSync(photoRoutePath, "utf8");
const skipRouteSource = readFileSync(skipRoutePath, "utf8");

test.describe("student photo delivery backend contract", () => {
  test("uses a validated stable operationId only for the standard flow", () => {
    expect(photoRouteSource).toContain('formData.get("operationId")');
    expect(photoRouteSource).toContain("PHOTO_OPERATION_ID_PATTERN");
    expect(photoRouteSource).toContain('"INVALID_OPERATION_ID"');
    expect(photoRouteSource).toContain(
      "usesStandardStudentLocationExperience("
    );
    expect(photoRouteSource).toMatch(
      /const parsedOperationId =\s*isStandardStudentSubmission && !isSelfiePhotoTask\s*\?\s*parsePhotoSubmissionOperationId\(operationIdEntry\)/
    );
    expect(photoRouteSource).toMatch(
      /createStorageUploadNonce\(\s*answeredAt:\s*string,\s*operationId:\s*string\s*\|\s*null/
    );
    expect(photoRouteSource).toMatch(
      /if\s*\(operationId\)\s*\{\s*return operationId\.toLowerCase\(\)/
    );
    expect(photoRouteSource).toContain(
      'answeredAt.replace(/[^a-zA-Z0-9_-]/g, "")'
    );
  });

  test("keeps legacy photo and selfie uploads on answeredAt with upsert", () => {
    expect(photoRouteSource).toContain("upsert: operationId === null");
    expect(photoRouteSource).toContain(
      "createdByRequest: operationId !== null && !uploadError"
    );
    expect(photoRouteSource).toMatch(
      /isStandardStudentSubmission && !isSelfiePhotoTask\s*\?\s*parsePhotoSubmissionOperationId\(operationIdEntry\)\s*:\s*\{[\s\S]*?value:\s*null/
    );
  });

  test("looks up participant identity before legacy student-name fallback", () => {
    const participantLookupIndex = photoRouteSource.indexOf(
      'column: "participant_id" as const'
    );
    const studentNameLookupIndex = photoRouteSource.indexOf(
      'column: "student_name" as const'
    );

    expect(participantLookupIndex).toBeGreaterThan(-1);
    expect(studentNameLookupIndex).toBeGreaterThan(participantLookupIndex);
    expect(photoRouteSource).toContain(
      'query = query.is("participant_id", null)'
    );
  });

  test("checks stable requests before buffering and keeps legacy size behavior plus HEIC", () => {
    expect(photoRouteSource).toContain(
      "const PHOTO_UPLOAD_MAX_BYTES = 12 * 1024 * 1024"
    );
    expect(photoRouteSource).toContain('"PHOTO_TOO_LARGE"');
    expect(photoRouteSource).toContain(
      "if (operationId && isPhotoUploadTooLarge(imageEntry.size))"
    );
    expect(photoRouteSource).toContain('startsWith("image/")');
    expect(photoRouteSource).not.toMatch(
      /image\/(?:heic|heif).*(?:reject|unsupported|invalid)/i
    );

    const sizeCheckIndex = photoRouteSource.indexOf(
      "isPhotoUploadTooLarge(imageEntry.size)"
    );
    const parseIndex = photoRouteSource.indexOf(
      "const image = await parseUploadedImage(imageEntry)"
    );
    expect(sizeCheckIndex).toBeGreaterThan(-1);
    expect(parseIndex).toBeGreaterThan(sizeCheckIndex);
  });

  test("reuses a stable storage object and reconciles a unique insert race", () => {
    expect(photoRouteSource).toContain("upsert: operationId === null");
    expect(photoRouteSource).toContain(
      "isStorageObjectAlreadyExistsError(uploadError)"
    );
    expect(photoRouteSource).toContain(
      "findExistingPhotoAnswerByOperationId("
    );
    expect(photoRouteSource).toContain(
      "client_operation_id: operationId"
    );
    expect(photoRouteSource).toContain(
      "const existingAfterConflict = await findExistingPhotoAnswer("
    );
    expect(photoRouteSource).toContain("duplicate: true");
    expect(photoRouteSource).toContain(".remove([storagePath])");
    expect(photoRouteSource).toContain(
      "shouldRemovePhotoUploadAfterDuplicate({"
    );
    expect(photoRouteSource).toMatch(
      /if\s*\(!operationId\)\s*\{\s*await removeNewPhotoUpload\([\s\S]*?Billedet kolliderede med en anden aflevering/
    );
  });

  test("distinguishes a session lookup failure from a closed session", () => {
    const lookupStart = photoRouteSource.indexOf(
      "async function fetchActiveSession"
    );
    const lookupEnd = photoRouteSource.indexOf(
      "async function fetchAnsweredPhotoProgress",
      lookupStart
    );
    const lookup = photoRouteSource.slice(lookupStart, lookupEnd);

    expect(lookup).toContain("return { ok: false as const }");
    expect(lookup).toContain("ok: true as const");
    expect(photoRouteSource).toContain('"SESSION_LOOKUP_FAILED"');
    expect(photoRouteSource).toMatch(
      /if\s*\(!activeSessionLookup\.ok\)\s*\{[\s\S]*?SESSION_LOOKUP_FAILED[\s\S]*?status:\s*503/
    );
  });

  test("does not add photo paths, blobs, or participant identifiers to new client telemetry", () => {
    expect(photoRouteSource).not.toMatch(
      /Sentry\.(?:captureException|addBreadcrumb|withScope)/
    );
    expect(photoRouteSource).not.toMatch(
      /console\.(?:error|warn|log)\([^)]*storagePath/
    );
    expect(photoRouteSource).not.toMatch(
      /console\.(?:error|warn|log)\([^)]*(?:image\.buffer|operationId)/
    );
  });
});

test.describe("student skip delivery backend contract", () => {
  test("standard policy is fail-closed for every named special flow", () => {
    for (const raceType of [
      "quiz",
      "manuel",
      "manual",
      "dansk",
      "engelsk",
      "matematik",
      "foto",
      "photo",
    ]) {
      expect(
        usesStandardStudentLocationExperience(raceType),
        raceType
      ).toBe(true);
    }

    for (const raceType of [
      "zone_krig",
      "stratego",
      "escape",
      "find_bedrageren",
      "stjerneloeb",
      "podcast",
      "musikquiz",
      "scanner",
      "selfie",
      "unknown-special",
      "",
    ]) {
      expect(
        usesStandardStudentLocationExperience(raceType),
        raceType
      ).toBe(false);
    }

    const policyGuardIndex = skipRouteSource.indexOf(
      "if (!isStandardSkipRaceType(rawRaceType))"
    );
    const normalizedModeIndex = skipRouteSource.indexOf(
      "const raceMode = normalizeRaceMode(rawRaceType)"
    );
    expect(policyGuardIndex).toBeGreaterThan(-1);
    expect(normalizedModeIndex).toBeGreaterThan(policyGuardIndex);
    expect(skipRouteSource).toContain('"SPECIAL_FLOW_EXCLUDED"');
  });

  test("already answered and insert-race paths return duplicate success", () => {
    expect(skipRouteSource).toMatch(
      /if\s*\(answeredPostIndexes\.has\(requestedPostIndex\)\)\s*\{[\s\S]*?kind:\s*"duplicate"/
    );
    expect(skipRouteSource).toContain("findExistingAnswerOutcome(");
    expect(skipRouteSource).toContain("isSkipEquivalentOutcome(");
    expect(skipRouteSource).toContain("createSkipDuplicateResponse({");
    expect(skipRouteSource).toContain('"SUBMISSION_CONFLICT"');
    expect(skipRouteSource).toMatch(
      /if\s*\(isSkipEquivalentOutcome\(storedOutcomeAfterConflict\)\)\s*\{[\s\S]*?return createSkipDuplicateResponse/
    );
  });

  test("real route mismatch remains 409 and closed sessions have a stable code", () => {
    expect(skipRouteSource).toContain('"PROGRESS_MISMATCH"');
    expect(skipRouteSource).toMatch(
      /code:\s*"PROGRESS_MISMATCH",[\s\S]*?\{\s*status:\s*409\s*\}/
    );
    expect(skipRouteSource).toContain('"SESSION_CLOSED"');
    expect(skipRouteSource).toMatch(
      /code:\s*"SESSION_CLOSED",[\s\S]*?\{\s*status:\s*410\s*\}/
    );
  });

  test("skip remains server-confirmed only and does not create an offline queue", () => {
    expect(skipRouteSource).not.toContain("localStorage");
    expect(skipRouteSource).not.toContain("indexedDB");
    expect(skipRouteSource).not.toContain("enqueue");
    expect(skipRouteSource).toContain("skipped: true");
  });
});
