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
    expect(photoRouteSource).toContain("const answerId = crypto.randomUUID()");
    expect(photoRouteSource).toContain("buildPhotoStoragePath(");
    expect(photoRouteSource).toContain("answerId,");
    expect(photoRouteSource).not.toContain("createStorageUploadNonce");
  });

  test("uses non-overwriting random storage objects for every photo flow", () => {
    expect(photoRouteSource).toContain("upsert: false");
    expect(photoRouteSource).toContain("createdByRequest: true");
    expect(photoRouteSource).toMatch(
      /isStandardStudentSubmission && !isSelfiePhotoTask\s*\?\s*parsePhotoSubmissionOperationId\(operationIdEntry\)\s*:\s*\{[\s\S]*?value:\s*null/
    );
    expect(photoRouteSource).toContain("const answerId = crypto.randomUUID()");
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

  test("checks size before decoding and rejects files that are not real supported images", () => {
    expect(photoRouteSource).toContain("PHOTO_UPLOAD_MAX_BYTES");
    expect(photoRouteSource).toContain('"PHOTO_TOO_LARGE"');
    expect(photoRouteSource).toContain(
      "if (imageEntry.size > PHOTO_UPLOAD_MAX_BYTES)"
    );
    expect(photoRouteSource).toContain("sanitizeUploadedPhoto(imageEntry)");
    expect(photoRouteSource).not.toContain('startsWith("image/")');

    const sizeCheckIndex = photoRouteSource.indexOf(
      "imageEntry.size > PHOTO_UPLOAD_MAX_BYTES"
    );
    const sanitizeIndex = photoRouteSource.indexOf(
      "image = await sanitizeUploadedPhoto(imageEntry)"
    );
    expect(sizeCheckIndex).toBeGreaterThan(-1);
    expect(sanitizeIndex).toBeGreaterThan(sizeCheckIndex);
  });

  test("cleans the fresh random object when a unique insert race is reconciled", () => {
    expect(photoRouteSource).toContain("upsert: false");
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
    expect(photoRouteSource).not.toContain("isStorageObjectAlreadyExistsError");
  });

  test("distinguishes a session lookup failure from a closed session", () => {
    const lookupStart = photoRouteSource.indexOf(
      "async function fetchActiveSession"
    );
    const lookupEnd = photoRouteSource.indexOf(
      "async function findExistingPhotoAnswer",
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

  test("normal and duplicate robust photo responses share authoritative progression", () => {
    const duplicateResponse = photoRouteSource.slice(
      photoRouteSource.indexOf("async function createPhotoDuplicateResponse"),
      photoRouteSource.indexOf("async function insertPhotoAnswerWithOperationFallback")
    );
    const normalResponseStart = photoRouteSource.indexOf(
      "const progressSnapshot = usesRobustStandardPhotoDelivery"
    );
    const normalResponse = photoRouteSource.slice(
      normalResponseStart,
      photoRouteSource.indexOf("} catch (error)", normalResponseStart)
    );

    expect(photoRouteSource).toContain("fetchAuthoritativeProgressSnapshot");
    expect(duplicateResponse).toContain("fetchAuthoritativeProgressSnapshot({");
    expect(duplicateResponse).toContain("...progressSnapshot");
    expect(normalResponse).toContain("fetchAuthoritativeProgressSnapshot({");
    expect(normalResponse).toContain("progressSnapshot ?? {}");
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

  test("normal, duplicate, and final skip responses return authoritative progression", () => {
    const duplicateResponse = skipRouteSource.slice(
      skipRouteSource.indexOf("function createSkipDuplicateResponse"),
      skipRouteSource.indexOf("function createSkipOutcomeConflictResponse")
    );
    const normalResponseStart = skipRouteSource.lastIndexOf(
      "await maybeStampRunStartedAt("
    );
    const normalResponse = skipRouteSource.slice(
      normalResponseStart,
      skipRouteSource.indexOf("} catch (error)", normalResponseStart)
    );

    expect(skipRouteSource).toContain("fetchAuthoritativeProgressSnapshot");
    expect(duplicateResponse).toContain("...progressSnapshot");
    expect(normalResponse).toContain("refreshProgressSnapshot()");
    expect(normalResponse).toContain("...progressSnapshot");
  });
});
