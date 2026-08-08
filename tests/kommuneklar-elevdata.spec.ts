import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  canTeacherAccessAnswerPhoto,
  getProtectedAnswerPhotoUrl,
  GPS_LOCATION_TTL_MS,
  isFreshStudentLocation,
  PHOTO_RETENTION_DAYS,
  SECURITY_LOG_RETENTION_DAYS,
  shouldExposeStudentLocation,
  STUDENT_DATA_RETENTION_DAYS,
} from "../lib/studentData/privacyPolicy";
import { sanitizeObservabilityUrl } from "../lib/observability/privacy";

function source(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

const migration = source(
  "supabase",
  "migrations",
  "202608070001_kommuneklar_elevdata.sql"
);
const photoRoute = source(
  "app",
  "api",
  "teacher",
  "answers",
  "[answerId]",
  "photo",
  "route.ts"
);
const uploadRoute = source("app", "api", "play", "submit-photo", "route.ts");
const locationRoute = source("app", "api", "play", "location", "route.ts");
const participantRoute = source("app", "api", "play", "participant", "route.ts");
const answerRoute = source("app", "api", "play", "submit-answer", "route.ts");
const retentionFunction = source(
  "supabase",
  "functions",
  "student-data-retention",
  "index.ts"
);
const resultsPage = source(
  "app",
  "dashboard",
  "resultater",
  "[runId]",
  "page.tsx"
);

test.describe("Kommuneklar elevdata", () => {
  test("teacher A can access only the photo linked to teacher A's answer", () => {
    expect(
      canTeacherAccessAnswerPhoto({
        teacherUserId: "teacher-a",
        runOwnerId: "teacher-a",
        answerId: "answer-a",
        photoAnswerId: "answer-a",
        answerSessionId: "session-a",
        photoSessionId: "session-a",
        answerParticipantId: "participant-a",
        photoParticipantId: "participant-a",
      })
    ).toBe(true);

    expect(
      canTeacherAccessAnswerPhoto({
        teacherUserId: "teacher-a",
        runOwnerId: "teacher-b",
        answerId: "answer-b",
        photoAnswerId: "answer-b",
        answerSessionId: "session-b",
        photoSessionId: "session-b",
        answerParticipantId: "participant-b",
        photoParticipantId: "participant-b",
      })
    ).toBe(false);

    expect(
      canTeacherAccessAnswerPhoto({
        teacherUserId: null,
        runOwnerId: "teacher-a",
        answerId: "answer-a",
        photoAnswerId: "answer-a",
        answerSessionId: "session-a",
        photoSessionId: "session-a",
        answerParticipantId: "participant-a",
        photoParticipantId: "participant-a",
      })
    ).toBe(false);
  });

  test("photo route checks ownership and streams bytes without exposing a signed URL", () => {
    const authIndex = photoRoute.indexOf("await supabase.auth.getUser()");
    const runOwnerIndex = photoRoute.indexOf('.eq("user_id", user.id)');
    const adminIndex = photoRoute.indexOf("createAdminClient()");
    const downloadIndex = photoRoute.indexOf(".download(");

    expect(authIndex).toBeGreaterThan(-1);
    expect(runOwnerIndex).toBeGreaterThan(authIndex);
    expect(adminIndex).toBeGreaterThan(runOwnerIndex);
    expect(downloadIndex).toBeGreaterThan(adminIndex);
    expect(photoRoute).toContain("canTeacherAccessAnswerPhoto");
    expect(photoRoute).toContain("private, no-store");
    expect(photoRoute).toContain('"Referrer-Policy": "no-referrer"');
    expect(photoRoute).not.toContain("createSignedUrl");
    expect(photoRoute).not.toContain("NextResponse.redirect");
  });

  test("private upload stores only a protected app URL and private metadata", () => {
    expect(getProtectedAnswerPhotoUrl("answer-id")).toBe(
      "/api/teacher/answers/answer-id/photo"
    );
    expect(uploadRoute).toContain("resolveParticipantRequestContext");
    expect(uploadRoute).toContain("fetchActiveSession");
    expect(uploadRoute).toContain("registerParticipantPhotoObject");
    expect(uploadRoute).toContain("getProtectedAnswerPhotoUrl(answerId)");
    expect(uploadRoute).toContain("sanitizeUploadedPhoto");
    expect(uploadRoute).toContain("consume_participant_photo_upload_limit");
    expect(uploadRoute).not.toContain("getPublicUrl");
    expect(uploadRoute).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  test("migration makes the bucket private and hides object paths from browser roles", () => {
    expect(migration).toMatch(
      /'participant-uploads',[\s\S]*?false,[\s\S]*?12582912/
    );
    expect(migration).toContain(
      "alter table public.participant_photo_objects enable row level security"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.participant_photo_objects from public, anon, authenticated"
    );
    expect(migration).toContain("drop policy if exists %I on storage.objects");
    expect(migration).toContain(
      "'/api/teacher/answers/' || a.id::text || '/photo'"
    );
  });

  test("deleted answers lose both metadata and the private Storage object", () => {
    expect(migration).toContain(
      "answer_id uuid primary key references public.answers(id) on delete cascade"
    );
    expect(resultsPage).toContain("deleteParticipantPhotosForSessions");
    expect(resultsPage.indexOf("deleteParticipantPhotosForSessions")).toBeLessThan(
      resultsPage.indexOf('from(tableName).delete()')
    );
    expect(photoRoute).toContain('.from("participant_photo_objects")');
    expect(photoRoute).toContain("if (photoObjectError || !photoObject?.object_path)");
  });

  test("GPS expires after 15 minutes and is hidden for finished sessions", () => {
    const now = Date.parse("2026-08-07T12:00:00.000Z");
    expect(GPS_LOCATION_TTL_MS).toBe(15 * 60 * 1000);
    expect(isFreshStudentLocation("2026-08-07T11:45:00.000Z", now)).toBe(true);
    expect(isFreshStudentLocation("2026-08-07T11:44:59.999Z", now)).toBe(false);
    expect(
      shouldExposeStudentLocation({
        sessionStatus: "running",
        finishedAt: null,
        lastUpdated: "2026-08-07T11:50:00.000Z",
        nowMs: now,
      })
    ).toBe(true);
    expect(
      shouldExposeStudentLocation({
        sessionStatus: "finished",
        finishedAt: null,
        lastUpdated: "2026-08-07T11:59:00.000Z",
        nowMs: now,
      })
    ).toBe(false);
  });

  test("GPS is cleared on client leave, finish, session close and scheduled expiry", () => {
    expect(locationRoute).toContain("export async function DELETE");
    expect(locationRoute).toContain("clearParticipantLocationById");
    expect(participantRoute).toContain("shouldExposeStudentLocation");
    expect(migration).toContain("participants_clear_location_on_finish");
    expect(migration).toContain("live_sessions_clear_locations_on_close");
    expect(migration).toContain("or p.last_updated is null");
    expect(migration).toContain("p.last_updated < p_now - interval '15 minutes'");
    expect(answerRoute).toContain("delete sanitizedPayload.lat");
    expect(answerRoute).toContain("delete sanitizedPayload.longitude");
    expect(migration).toContain("new.lat := null");
    expect(migration).toContain("new.lng := null");
  });

  test("unified retention uses fixed photo, student-data and safe-log periods", () => {
    expect(PHOTO_RETENTION_DAYS).toBe(30);
    expect(STUDENT_DATA_RETENTION_DAYS).toBe(90);
    expect(SECURITY_LOG_RETENTION_DAYS).toBe(30);
    expect(migration).toContain("p_now - interval '30 days'");
    expect(migration).toContain("p_now - interval '90 days'");
    expect(migration).toContain("student_data_retention_anchor_at");
    expect(migration).toContain("student_data_retention_one_running_idx");
    expect(migration).toContain("list_student_photo_orphan_candidates");
    expect(migration).toContain("student_data_retention_runs");
    expect(migration).toContain("status in ('running', 'succeeded', 'failed')");
    expect(migration).toContain("configure_student_data_retention_cron");
    expect(migration).not.toContain(
      "select public.configure_student_data_retention_cron("
    );
  });

  test("retention finalizes DB only after Storage deletion and logs no paths", () => {
    const storageDeleteIndex = retentionFunction.indexOf(".remove(pathChunk)");
    const finalizeIndex = retentionFunction.indexOf(
      '"finalize_student_photo_retention"'
    );

    expect(storageDeleteIndex).toBeGreaterThan(-1);
    expect(finalizeIndex).toBeGreaterThan(storageDeleteIndex);
    expect(retentionFunction).not.toContain("console.log");
    const consoleLines = retentionFunction
      .split(/\r?\n/)
      .filter((line) => /console\.(?:info|warn|error)\(/.test(line));
    expect(consoleLines.join("\n")).not.toMatch(/object_path|pathChunk/);
    expect(retentionFunction).toContain("student_data_retention_failed");
  });

  test("photo and signed Storage paths are redacted from observability", () => {
    expect(
      sanitizeObservabilityUrl(
        "https://skolegps.dk/api/teacher/answers/11111111-1111-4111-8111-111111111111/photo?x=1"
      )
    ).toBe("https://skolegps.dk/api/teacher/answers/[redacted]/photo");
    expect(
      sanitizeObservabilityUrl(
        "https://project.supabase.co/storage/v1/object/sign/participant-uploads/session/private.jpg?token=secret"
      )
    ).toBe(
      "https://project.supabase.co/storage/v1/object/[redacted]/participant-uploads/[redacted]"
    );
  });

  test("manual run deletion stays scoped to the authenticated run owner", () => {
    expect(resultsPage).toContain('.eq("user_id", user.id)');
    expect(resultsPage).toContain('.eq("teacher_id", user.id)');
    expect(resultsPage).toContain('.eq("teacher_id", user.id)');
    expect(migration).toMatch(
      /answers_teacher_select[\s\S]*?gr\.user_id = auth\.uid\(\)/
    );
  });
});
