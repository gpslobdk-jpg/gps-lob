import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const ROOT = process.cwd();

function source(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function section(
  value: string,
  startMarker: string,
  endMarker: string
) {
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker, start + startMarker.length);
  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(
    0
  );
  expect(end, `Missing end marker: ${endMarker}`).toBeGreaterThan(start);
  return value.slice(start, end);
}

const gameStateSource = source("components/play/GameState.tsx");
const interfaceSource = source("components/play/PlayInterface.tsx");
const statusSource = source("components/play/StudentSubmissionStatus.tsx");
const playUtilsSource = source("components/play/playUtils.ts");

test.describe("standard student submission client contract", () => {
  test("server progress wins after normal, duplicate, photo, and skip success", () => {
    const applyProgress = section(
      gameStateSource,
      "const applyAuthoritativeProgressSnapshot = useCallback(",
      "\n  const reconcileAuthoritativeAnswerProgress"
    );
    expect(applyProgress).toContain("normalizeAuthoritativeProgressSnapshot(");
    expect(applyProgress).toContain("answeredPostIndexesRef.current = normalized.answeredPostIndexes");
    expect(applyProgress).toContain("if (normalized.isFinished)");
    expect(applyProgress).toContain("setCurrentPostIndex(expectedPostIndex)");

    const standardInsert = section(
      gameStateSource,
      "const insertAnswerRecord = useCallback(",
      "const fetchRun = async () => {"
    );
    expect(standardInsert).toContain("authoritativeProgress,");
    expect(gameStateSource).toContain("applyAuthoritativeProgressSnapshot(");
    expect(gameStateSource).toContain("{ deferNavigation: true }");
    expect(gameStateSource).toContain("deferredAuthoritativeProgressRef.current");

    const photoSubmit = section(
      gameStateSource,
      "const submitPhoto = async",
      "\n  const skipCurrentPostAsEmergency = async"
    );
    expect(photoSubmit).toContain("applyAuthoritativeProgressSnapshot(payload)");
    expect(photoSubmit.indexOf("applyAuthoritativeProgressSnapshot(payload)")).toBeLessThan(
      photoSubmit.indexOf("await continueFromSolvedPost();")
    );

    const skipSubmit = section(
      gameStateSource,
      "const skipCurrentPostAsEmergency = async () => {",
      "\n  const preparePhotoSubmission"
    );
    expect(skipSubmit).toContain("applyAuthoritativeProgressSnapshot(payload)");
    expect(skipSubmit).not.toContain("await continueFromSolvedPost();");
  });

  test("participant restore prefers the authenticated server progress snapshot", () => {
    const participantRoute = source("app/api/play/participant/route.ts");
    const restore = section(
      gameStateSource,
      "const restoreFromStorage = async () => {",
      "\n    void restoreFromStorage();"
    );

    expect(participantRoute).toContain("fetchAuthoritativeProgressSnapshot({");
    expect(participantRoute).toContain('searchParams.get("includeProgress") === "1"');
    expect(participantRoute).toContain("...(includeProgress ? { progress } : {})");
    expect(gameStateSource).toContain('"&includeProgress=1"');
    expect(participantRoute).toContain('"Cache-Control": "no-store"');
    expect(restore).toContain("authoritativeProgress");
    expect(restore).toContain("authoritativeProgress.answeredPostIndexes");
    expect(restore).toContain("authoritativeProgress?.isFinished");
  });

  test("queues before sending and reuses the same opaque operation id", () => {
    const insertion = section(
      gameStateSource,
      "const insertAnswerRecord = useCallback(",
      "const fetchRun = async () => {"
    );
    const queuePosition = insertion.indexOf(
      "queuePendingLocalAnswer(pendingLocalAnswer)"
    );
    const requestPosition = insertion.indexOf(
      "sendStandardAnswerOperation("
    );

    expect(queuePosition).toBeGreaterThanOrEqual(0);
    expect(requestPosition).toBeGreaterThan(queuePosition);
    expect(insertion).toMatch(
      /existingPendingAnswer\?\.id\s*\?\?\s*createStudentSubmissionOperationId\(\)/
    );
    const sender = section(
      gameStateSource,
      "const sendStandardAnswerOperation = useCallback(",
      "\n  const clearRestoreRetryTimer"
    );
    expect(sender).toMatch(
      /body:\s*JSON\.stringify\(\{\s*operationId,\s*payloads\s*\}\)/
    );
    expect(sender).toContain("result = await sendOnce()");
    expect(sender).toContain("Exactly one auth recovery and one resend");

    const replay = section(
      gameStateSource,
      "const replayPendingLocalAnswers = useCallback(async () => {",
      "\n  pendingAnswerReplayRunnerRef.current ="
    );
    expect(replay).toMatch(
      /sendStandardAnswerOperation\(\s*pendingAnswer\.id,\s*pendingAnswer\.payloads,\s*abortController\.signal\s*\)/
    );
    expect(replay).toContain("for (const pendingAnswer of queuedAnswers)");
    expect(replay).toContain("break;");

    const retry = section(
      gameStateSource,
      "const retryStudentSubmission = async () => {",
      "\n  const startOver = useCallback"
    );
    expect(retry).toContain(
      "entry.id === activeSubmission.operationId"
    );
    expect(retry).toContain("await submitQuizAnswer(selectedIndex)");
  });

  test("keeps uncertain and offline answers durably queued until confirmation", () => {
    const queueMutation = section(
      gameStateSource,
      "const updatePendingLocalAnswers = useCallback(",
      "\n  const markPendingAnswerLocallyProgressed"
    );
    expect(queueMutation).toContain(
      "pendingLocalAnswersRef.current = next"
    );
    expect(queueMutation).toContain("setPendingLocalAnswers(next)");
    expect(queueMutation).toMatch(
      /savePendingAnswersForStoredPlaySnapshot\(\s*sessionId,\s*participantId,\s*next\s*\)/
    );
    expect(queueMutation).toContain("persisted");
    expect(queueMutation).toContain("return [...current, pendingAnswer]");

    const insertion = section(
      gameStateSource,
      "const insertAnswerRecord = useCallback(",
      "const fetchRun = async () => {"
    );
    expect(insertion).toMatch(
      /navigator\.onLine === false[\s\S]*?status:\s*"queued_offline"[\s\S]*?deliveryStatus:\s*"queued_offline"[\s\S]*?canProgress:\s*true/
    );
    expect(insertion).toMatch(
      /if \(!didPersistPendingAnswer\)[\s\S]*?deliveryStatus:\s*"retryable_error"[\s\S]*?canProgress:\s*false/
    );
    expect(insertion).toMatch(
      /status:\s*"awaiting_confirmation"[\s\S]*?type:\s*"response_lost"[\s\S]*?deliveryStatus:\s*"awaiting_confirmation"[\s\S]*?canProgress:\s*false/
    );

    const confirmed = section(
      insertion,
      "if (response.ok && body?.inserted === true) {",
      '\n          if (responseDisposition === "session_closed")'
    );
    expect(confirmed).toContain(
      "removePendingLocalAnswer(pendingAnswerId)"
    );
    expect(confirmed).toContain(
      'body.duplicate === true ? "duplicate" : "stored"'
    );

    expect(playUtilsSource).toContain(
      "export function savePendingAnswersForStoredPlaySnapshot"
    );
    expect(playUtilsSource).toMatch(
      /candidate\.status === "submitting"\s*\?\s*"awaiting_confirmation"/
    );
  });

  test("scopes terminal queue conflicts and rescues legacy progress locks", () => {
    const replay = section(
      gameStateSource,
      "const replayPendingLocalAnswers = useCallback(async () => {",
      "\n  pendingAnswerReplayRunnerRef.current ="
    );
    const terminalPosition = replay.indexOf(
      "if (isTerminalPendingAnswer(pendingAnswer))"
    );
    const replayPosition = replay.indexOf(
      "if (!pendingAnswer.hasLocalProgress)"
    );
    expect(terminalPosition).toBeGreaterThanOrEqual(0);
    expect(replayPosition).toBeGreaterThan(terminalPosition);
    expect(replay).toMatch(
      /restoreStudentSubmissionState\(\s*pendingAnswer\.submissionType,\s*pendingAnswer\.id,\s*pendingAnswer\.status\s*\)/
    );
    expect(replay).toMatch(
      /pendingAnswer\.status === "rejected"[\s\S]*?continue;/
    );

    const restore = section(
      gameStateSource,
      "const restoreFromStorage = async () => {",
      "\n    void restoreFromStorage();"
    );
    expect(restore).toMatch(
      /usesStandardStudentLocationExperience\s*&&\s*isTerminalPendingAnswer\(pendingAnswer\)/
    );
    expect(restore).toMatch(
      /!pendingAnswer\.hasLocalProgress\s*\|\|\s*isTerminalPendingAnswer\(pendingAnswer\)/
    );
    expect(restore).toContain("rescueLegacyRejectedStudentSubmissions(");
    expect(gameStateSource).toMatch(
      /entry\.status === "session_closed"[\s\S]*?entry\.solvedPostIndex === currentPostIndex[\s\S]*?isTerminalPendingAnswer\(entry\)/
    );
  });

  test("preserves a selected photo and its operation id across explicit retry", () => {
    const photoSelection = section(
      interfaceSource,
      "const handlePhotoCapture = ",
      "\n  const handlePhotoButtonClick ="
    );
    expect(photoSelection).toMatch(
      /usesStandardStudentLocationExperience\s*&&\s*!isSelfiePhotoTask/
    );
    expect(photoSelection).toMatch(
      /file,\s*previewUrl:\s*URL\.createObjectURL\(file\),\s*operationId:\s*createStudentSubmissionOperationId\(\)/
    );
    expect(photoSelection).toMatch(
      /actions\.submitPhoto\(\s*pendingPhotoSelection\.file,\s*pendingPhotoSelection\.operationId\s*\)/
    );
    expect(photoSelection).toContain(
      'studentSubmission.submissionType === "photo"'
    );

    const previewCleanup = section(
      interfaceSource,
      "const isCurrentPostAnswered =",
      "\n  const clearLockedPostFeedback"
    );
    expect(previewCleanup).toContain(
      "URL.revokeObjectURL(previewUrl)"
    );
    expect(previewCleanup).toMatch(
      /pendingPhotoSelection\.key !== activeTypedAnswerKey\s*\|\|\s*hasActivePhotoSuccess\s*\|\|\s*isCurrentPostAnswered/
    );
    expect(previewCleanup).not.toContain("activePhotoFeedback");

    expect(interfaceSource).toContain('alt="Det valgte billede"');
    expect(interfaceSource).toContain("Vælg et andet billede");
    expect(interfaceSource).toContain("Aflever billede");
    expect(interfaceSource).toContain("Sender billedet…");

    const photoDelivery = section(
      gameStateSource,
      "const submitPhoto = async ",
      "const setLiveLocation = useCallback"
    );
    expect(photoDelivery).toMatch(
      /usesStandardStudentLocationExperience\s*&&\s*!isSelfie\s*&&\s*typeof operationId === "string"/
    );
    expect(photoDelivery).toContain(
      'formData.append("operationId", operationId)'
    );
    expect(photoDelivery).toContain(
      'beginStudentSubmission("photo", operationId)'
    );
    expect(photoDelivery).toMatch(
      /try\s*\{[\s\S]*?await fetch\("\/api\/play\/submit-photo"[\s\S]*?await response\.json\(\)[\s\S]*?\}\s*finally\s*\{\s*clearTimeout\(timeoutId\)/
    );
    expect(photoDelivery).toContain(
      'uploadError?.code === "PHOTO_OPERATION_CONFLICT"'
    );
    expect(photoDelivery).toContain(
      'uploadError?.code === "PHOTO_SUBMISSION_CONFLICT"'
    );
  });

  test("renders honest accessible delivery states and an explicit retry target", () => {
    for (const copy of [
      "Sender dit svar…",
      "Svaret er gemt",
      "Svaret er gemt på telefonen",
      "Det sendes automatisk, når forbindelsen er tilbage.",
      "Svaret kunne ikke sendes endnu.",
      "Billedet er stadig valgt. Prøv igen.",
      "Posten kunne ikke springes over endnu. Prøv igen.",
      "Løbet er afsluttet.",
      "Svaret kan ikke længere afleveres.",
      "Prøv igen",
    ]) {
      expect(statusSource).toContain(copy);
    }

    expect(statusSource).toContain('role="status"');
    expect(statusSource).toContain('aria-live="polite"');
    expect(statusSource).toContain('aria-atomic="true"');
    expect(statusSource).toContain("min-h-[56px]");
    expect(statusSource).toContain("motion-reduce:animate-none");
    expect(interfaceSource).toMatch(
      /<StudentSubmissionStatus[\s\S]*?state=\{studentSubmission\}[\s\S]*?onRetry=\{retryActiveSubmission\}/
    );
  });

  test("gates robust delivery and emergency skip to ordinary standard flows", () => {
    expect(gameStateSource).toMatch(
      /usesRobustStandardDelivery\s*=\s*usesStandardStudentLocationExperience\s*&&\s*currentVariant === "quiz"/
    );
    expect(gameStateSource).toContain(
      "// Legacy- og specialflows beholder deres eksisterende optimistiske adfærd."
    );
    expect(gameStateSource).toMatch(
      /usesRobustPhotoDelivery\s*=\s*usesStandardStudentLocationExperience\s*&&\s*!isSelfie\s*&&\s*typeof operationId === "string"/
    );
    expect(interfaceSource).toMatch(
      /usesStandardStudentLocationExperience\s*&&\s*!isSelfiePhotoTask[\s\S]*?setPendingPhotoSelection\(nextSelection\)[\s\S]*?return;\s*\}\s*void actions\.submitPhoto\(file\)/
    );

    const skip = section(
      gameStateSource,
      "const skipCurrentPostAsEmergency = async () => {",
      "\n  const retryStudentSubmission ="
    );
    for (const guard of [
      "!usesStandardStudentLocationExperience",
      "isStrategoRace",
      'raceMode === "zone_krig"',
      "isEscapeRace",
      '(activePostVariant !== "quiz" && activePostVariant !== "photo")',
    ]) {
      expect(skip).toContain(guard);
    }
    expect(skip).toMatch(
      /studentSubmissionRef\.current\.submissionType === "skip"[\s\S]*?studentSubmissionRef\.current\.operationId[\s\S]*?\?\s*studentSubmissionRef\.current\.operationId\s*:\s*createStudentSubmissionOperationId\(\)/
    );
  });

  test("reports only allowlisted, deduplicated privacy-safe metadata", () => {
    const telemetry = section(
      gameStateSource,
      "const captureStudentSubmissionIssue = useCallback(",
      "\n  const applyStudentSubmissionEvent = useCallback"
    );
    expect(telemetry).toContain(
      'const dedupeKey = `${operationId ?? "none"}:${category}:${metadata.stage}`'
    );
    expect(telemetry).toContain(
      "reportedSubmissionEventsRef.current.has(dedupeKey)"
    );
    expect(telemetry).toContain(
      "reportedSubmissionEventsRef.current.add(dedupeKey)"
    );

    const extrasMatch = telemetry.match(
      /scope\.setExtras\(\{([\s\S]*?)\}\);/
    );
    expect(extrasMatch).not.toBeNull();
    const extras = extrasMatch?.[1] ?? "";

    const allowedKeys = [
      "submission_type",
      "network_state",
      "stage",
      "result",
      "queue_length",
      "route_mode",
    ];
    for (const key of allowedKeys) {
      expect(extras).toMatch(new RegExp(`\\b${key}\\s*:`));
    }

    const actualKeys = Array.from(
      extras.matchAll(/^\s*([a-z_]+)\s*:/gm),
      (match) => match[1]
    );
    expect(actualKeys).toEqual(allowedKeys);
    expect(extras).not.toMatch(
      /\b(?:operation_id|session_id|participant_id|student_name|answer|question|post_index|content|image|photo|file|path|lat|lng|coordinates?)\s*:/i
    );
    expect(telemetry).toContain("Sentry.captureMessage(category)");
  });
});
