import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import {
  asTrimmedString,
  fetchParticipantLocationState,
  fetchRunForSession,
  getPhotoMissionConfig,
  getLocationDistanceMeters,
  getServerPositionValidationRadius,
  resolveQuestionVariant,
} from "@/app/api/play/_shared";
import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { getAwardedPoints } from "@/utils/questionPoints";

export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type UploadedPhotoInput = {
  buffer: Buffer;
  mimeType: string;
  openAiImageUrl: string;
};

type AnalyzePhotoResult = {
  isMatch: boolean;
  message: string;
  awardedPoints?: number;
  imageUrl: string | null;
  storedAnswer: boolean;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

type UploadedPhoto = {
  imageUrl: string | null;
};

type ParticipantIdentityRow = {
  id?: string | null;
  student_name?: string | null;
};

type ActiveSessionRow = {
  id?: string | null;
};

type SupabaseApiClientOptions = {
  participantId?: string;
  sessionId?: string;
};

function asPostIndex(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isMissingColumnError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") {
    return true;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("column");
}

function buildParticipantHeaders(options: SupabaseApiClientOptions = {}) {
  return {
    ...(options.participantId ? { "x-participant-id": options.participantId } : {}),
    ...(options.sessionId ? { "x-session-id": options.sessionId } : {}),
  };
}

function getSupabaseApiClient(options: SupabaseApiClientOptions = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: buildParticipantHeaders(options),
    },
  });
}

function buildOpenAiImageUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function parseUploadedImage(file: File): Promise<UploadedPhotoInput | null> {
  const mimeType = file.type.trim().toLowerCase();
  if (!mimeType.startsWith("image/")) {
    return null;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength === 0) {
    return null;
  }

  return {
    buffer,
    mimeType,
    openAiImageUrl: buildOpenAiImageUrl(buffer, mimeType),
  };
}

function getImageFileExtension(mimeType: string) {
  const rawSubtype = mimeType.split("/")[1]?.toLowerCase() ?? "jpg";
  const normalizedSubtype = rawSubtype.replace(/[^a-z0-9]/g, "");

  if (normalizedSubtype === "jpeg") return "jpg";
  return normalizedSubtype || "jpg";
}

function createStorageUploadNonce() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildStoragePath(
  sessionId: string,
  participantId: string,
  postIndex: number,
  mimeType: string
) {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "") || "session";
  const safeParticipantId = participantId.replace(/[^a-zA-Z0-9_-]/g, "") || "participant";
  const extension = getImageFileExtension(mimeType);
  const uploadNonce = createStorageUploadNonce();
  return `${safeSessionId}/${safeParticipantId}/${uploadNonce}-${postIndex}.${extension}`;
}

function getQuestionText(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return "";
  return asTrimmedString(rawQuestion.text);
}

function getQuestionCoordinates(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return null;

  const lat = asFiniteNumber(rawQuestion.lat);
  const lng = asFiniteNumber(rawQuestion.lng);
  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
}

async function validateParticipantPosition(
  sessionId: string,
  participantId: string,
  rawQuestion: unknown,
  adminSupabase: AdminSupabaseClient,
  validationRadiusMeters: number
) {
  const questionCoordinates = getQuestionCoordinates(rawQuestion);
  if (!questionCoordinates) {
    return "Posten mangler gyldige GPS-koordinater.";
  }

  const participantState = await fetchParticipantLocationState(sessionId, participantId, adminSupabase);
  const participantLat = asFiniteNumber(participantState?.lat);
  const participantLng = asFiniteNumber(participantState?.lng);
  if (participantLat === null || participantLng === null) {
    return "Vi mangler din seneste GPS-position. Gå tættere på posten og prøv igen.";
  }

  const distanceToPost = getLocationDistanceMeters(
    participantLat,
    participantLng,
    questionCoordinates.lat,
    questionCoordinates.lng
  );
  if (distanceToPost > validationRadiusMeters) {
    return "Du skal være tættere på posten, før billedet kan godkendes.";
  }

  return null;
}

async function uploadPhotoToStorage(
  image: UploadedPhotoInput,
  sessionId: string,
  participantId: string,
  postIndex: number,
  adminSupabase: AdminSupabaseClient
): Promise<UploadedPhoto> {
  const storagePath = buildStoragePath(sessionId, participantId, postIndex, image.mimeType);
  const { error: uploadError } = await adminSupabase.storage
    .from("participant-uploads")
    .upload(storagePath, image.buffer, {
      contentType: image.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Kunne ikke uploade deltagerbillede til Storage:", uploadError);
    return { imageUrl: null };
  }

  const {
    data: { publicUrl },
  } = adminSupabase.storage.from("participant-uploads").getPublicUrl(storagePath);

  return {
    imageUrl: publicUrl || null,
  };
}

async function fetchParticipantIdentity(sessionId: string, participantId: string) {
  const supabase = getSupabaseApiClient({ participantId, sessionId });
  if (!supabase) {
    console.error("Supabase-klienten til deltageropslag er ikke konfigureret.");
    return null;
  }

  const { data, error } = await supabase
    .from("participants")
    .select("id,student_name")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .maybeSingle<ParticipantIdentityRow>();

  if (error) {
    console.error("Kunne ikke hente deltageridentitet til fotoanalyse:", error);
    return null;
  }

  return data ?? null;
}

async function fetchActiveSession(
  sessionId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("live_sessions")
    .select("id")
    .eq("id", sessionId)
    .in("status", ["waiting", "running"])
    .maybeSingle<ActiveSessionRow>();

  if (error) {
    console.error("Kunne ikke validere aktiv live-session til fotoanalyse:", error);
    return null;
  }

  return data ?? null;
}

async function persistPhotoAnalysisResult({
  sessionId,
  participantId,
  studentName,
  postIndex,
  questionText,
  awardedPoints,
  isMatch,
  message,
  imageUrl,
}: {
  sessionId: string;
  participantId: string;
  studentName: string;
  postIndex: number;
  questionText: string;
  awardedPoints: number;
  isMatch: boolean;
  message: string;
  imageUrl: string | null;
}) {
  const normalizedStudentName = studentName.trim();
  if (!normalizedStudentName) {
    return false;
  }

  const supabase = getSupabaseApiClient({ participantId, sessionId });
  if (!supabase) {
    console.error("Supabase-klienten til fotoresultater er ikke konfigureret.");
    return false;
  }

  const timestamp = new Date().toISOString();
  const basePayload = {
    session_id: sessionId,
    participant_id: participantId,
    student_name: normalizedStudentName,
    post_index: postIndex + 1,
    question_index: postIndex,
    selected_index: 0,
    answer_index: 0,
    is_correct: isMatch,
    awarded_points: awardedPoints,
    question_text: questionText,
    answered_at: timestamp,
    created_at: timestamp,
  };

  const payloads: Record<string, unknown>[] = [
    {
      ...basePayload,
      image_url: imageUrl,
      analysis_message: message,
    },
    {
      ...basePayload,
      analysis_message: message,
    },
    basePayload,
  ];

  for (const payload of payloads) {
    const { error } = await supabase.from("answers").insert(payload);
    if (!error) return true;
    if (isMissingColumnError(error)) continue;

    console.error("Kunne ikke gemme fotoanalyse i answers:", error);
    return false;
  }

  return false;
}

function normalizeAnalysisResult(raw: unknown): AnalyzePhotoResult | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  const isMatch = candidate.isMatch;
  const message = candidate.message;

  if (typeof isMatch !== "boolean") return null;
  if (typeof message !== "string" || message.trim().length === 0) return null;

  return {
    isMatch,
    message: message.trim(),
    imageUrl: null,
    storedAnswer: false,
  };
}

export async function POST(req: Request) {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ugyldig foresporgsel." }, { status: 400 });
  }

  try {
    const imageEntry = formData.get("image");
    const sessionId = asTrimmedString(formData.get("sessionId"));
    const participantId = asTrimmedString(formData.get("participantId"));
    const postIndex = asPostIndex(formData.get("postIndex"));

    if (!(imageEntry instanceof File) || !sessionId || !participantId || postIndex === null) {
      return NextResponse.json({ error: "Billede eller postdata mangler." }, { status: 400 });
    }

    const image = await parseUploadedImage(imageEntry);
    if (!image) {
      return NextResponse.json({ error: "Billedfilen er ugyldig." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    const run = await fetchRunForSession(sessionId);
    if (!run || !Array.isArray(run.questions) || postIndex >= run.questions.length) {
      return NextResponse.json({ error: "Foto-posten kunne ikke findes." }, { status: 404 });
    }

    const activeSession = await fetchActiveSession(sessionId, adminSupabase);
    if (!activeSession?.id) {
      return NextResponse.json({ error: "Sessionen er ikke aktiv laengere." }, { status: 404 });
    }

    const participant = await fetchParticipantIdentity(sessionId, participantId);
    const studentName = asTrimmedString(participant?.student_name);
    if (!studentName) {
      return NextResponse.json({ error: "Deltageren kunne ikke findes." }, { status: 404 });
    }

    const rawQuestion = run.questions[postIndex];
    const validationRadiusMeters = getServerPositionValidationRadius(run);
    const variant = resolveQuestionVariant(run.raceType ?? run.race_type, rawQuestion);
    if (variant !== "photo") {
      return NextResponse.json(
        { error: "Denne post bruger ikke foto-dommeren." },
        { status: 400 }
      );
    }

    const positionValidationError = await validateParticipantPosition(
      sessionId,
      participantId,
      rawQuestion,
      adminSupabase,
      validationRadiusMeters
    );
    if (positionValidationError) {
      return NextResponse.json({ error: positionValidationError }, { status: 403 });
    }

    const { targetObject, isSelfie } = getPhotoMissionConfig(rawQuestion);
    if (!targetObject) {
      return NextResponse.json(
        { error: "Foto-posten mangler et gyldigt motiv." },
        { status: 400 }
      );
    }

    const uploadedPhoto = await uploadPhotoToStorage(
      image,
      sessionId,
      participantId,
      postIndex,
      adminSupabase
    );

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY mangler i miljoet." }, { status: 500 });
    }

    const systemPrompt = `Du er en sjov og opmuntrende dommer i et udendoers GPS-loeb for boern og voksne. Din opgave er at vurdere, om det uploadede billede ${
      isSelfie
        ? `er en selfie, hvor mindst et ansigt er tydeligt, og om motivet ${targetObject} ogsaa er synligt i baggrunden eller samme billede`
        : `indeholder det anmodede motiv: ${targetObject}`
    }.
Returner KUN et validt JSON-objekt med dette format:
{"isMatch": true/false, "message": "kort, varm feedback paa dansk til deltagerne"}`;

    const userPrompt = isSelfie
      ? `Vurder om dette er en selfie ved ${targetObject}. Giv positiv, kort feedback paa dansk.`
      : `Vurder om dette billede viser ${targetObject}. Giv positiv, kort feedback paa dansk.`;

    const aiResponse = await openai.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      max_output_tokens: 180,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: userPrompt },
            {
              type: "input_image",
              image_url: image.openAiImageUrl,
              detail: "high",
            },
          ],
        },
      ],
    });

    const normalizedResult = normalizeAnalysisResult(
      aiResponse.output_text ? JSON.parse(aiResponse.output_text) : null
    );
    if (!normalizedResult) {
      return NextResponse.json({ error: "AI-svaret kunne ikke forstaas." }, { status: 502 });
    }

    let storedAnswer = false;
    const awardedPoints = getAwardedPoints(rawQuestion, normalizedResult.isMatch);
    if (normalizedResult.isMatch) {
      storedAnswer = await persistPhotoAnalysisResult({
        sessionId,
        participantId,
        studentName,
        postIndex,
        questionText: getQuestionText(rawQuestion),
        awardedPoints,
        isMatch: normalizedResult.isMatch,
        message: normalizedResult.message,
        imageUrl: uploadedPhoto.imageUrl,
      });
    }

    return NextResponse.json({
      ...normalizedResult,
      awardedPoints,
      imageUrl: uploadedPhoto.imageUrl,
      storedAnswer,
    });
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Fotoanalyse fejlede:", error);
    return NextResponse.json({ error: "Fotoanalysen fejlede." }, { status: 500 });
  }
}
