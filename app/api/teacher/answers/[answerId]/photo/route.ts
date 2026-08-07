import { NextResponse } from "next/server";

import {
  canTeacherAccessAnswerPhoto,
  PARTICIPANT_UPLOADS_BUCKET,
  PHOTO_SIGNED_URL_TTL_SECONDS,
} from "@/lib/studentData/privacyPolicy";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function unavailable(status = 404) {
  return NextResponse.json(
    { error: status === 401 ? "Du skal være logget ind." : "Billedet kunne ikke findes." },
    { status, headers: PRIVATE_RESPONSE_HEADERS }
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ answerId: string }> }
) {
  const { answerId } = await context.params;
  if (!UUID_PATTERN.test(answerId)) return unavailable();

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return unavailable(401);

  const { data: answer, error: answerError } = await supabase
    .from("answers")
    .select("id,session_id,participant_id")
    .eq("id", answerId)
    .maybeSingle<{
      id: string;
      session_id: string;
      participant_id: string | null;
    }>();

  if (answerError || !answer?.session_id) {
    return unavailable();
  }

  const { data: session, error: sessionError } = await supabase
    .from("live_sessions")
    .select("id,run_id")
    .eq("id", answer.session_id)
    .maybeSingle<{ id: string; run_id: string }>();

  if (sessionError || !session?.run_id) return unavailable();

  const { data: ownedRun, error: runError } = await supabase
    .from("gps_runs")
    .select("id,user_id")
    .eq("id", session.run_id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; user_id: string }>();

  if (runError || !ownedRun) return unavailable();

  const adminSupabase = createAdminClient();
  if (!adminSupabase) return unavailable();

  let photoObjectQuery = adminSupabase
    .from("participant_photo_objects")
    .select("answer_id,session_id,participant_id,object_path")
    .eq("answer_id", answer.id)
    .eq("session_id", answer.session_id);

  photoObjectQuery = answer.participant_id
    ? photoObjectQuery.eq("participant_id", answer.participant_id)
    : photoObjectQuery.is("participant_id", null);

  const { data: photoObject, error: photoObjectError } =
    await photoObjectQuery.maybeSingle<{
      answer_id: string;
      session_id: string;
      participant_id: string | null;
      object_path: string;
    }>();

  if (photoObjectError || !photoObject?.object_path) return unavailable();
  if (
    !canTeacherAccessAnswerPhoto({
      teacherUserId: user.id,
      runOwnerId: ownedRun.user_id,
      answerId: answer.id,
      photoAnswerId: photoObject.answer_id,
      answerSessionId: answer.session_id,
      photoSessionId: photoObject.session_id,
      answerParticipantId: answer.participant_id,
      photoParticipantId: photoObject.participant_id,
    })
  ) {
    return unavailable();
  }

  const { data: signedPhoto, error: signedPhotoError } = await adminSupabase.storage
    .from(PARTICIPANT_UPLOADS_BUCKET)
    .createSignedUrl(photoObject.object_path, PHOTO_SIGNED_URL_TTL_SECONDS);

  if (signedPhotoError || !signedPhoto?.signedUrl) return unavailable();

  const response = NextResponse.redirect(signedPhoto.signedUrl, 307);
  for (const [name, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
