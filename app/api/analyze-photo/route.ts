import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import {
  asTrimmedString,
  fetchRunForSession,
  getPhotoMissionConfig,
  resolveQuestionVariant,
} from "@/app/api/play/_shared";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type AnalyzePhotoPayload = {
  image?: unknown;
  sessionId?: unknown;
  participantId?: unknown;
  postIndex?: unknown;
};

type AnalyzePhotoResult = {
  isMatch: boolean;
  message: string;
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

function asPostIndex(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingColumnError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") {
    return true;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("column");
}

function getSupabaseApiClient() {
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
  });
}

function parseImageDataUri(image: string) {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1]?.trim();
  const base64Payload = match[2]?.trim();

  if (!mimeType || !base64Payload) return null;

  try {
    return {
      mimeType,
      buffer: Buffer.from(base64Payload, "base64"),
    };
  } catch {
    return null;
  }
}

function getImageFileExtension(mimeType: string) {
  const rawSubtype = mimeType.split("/")[1]?.toLowerCase() ?? "jpg";
  const normalizedSubtype = rawSubtype.replace(/[^a-z0-9]/g, "");

  if (normalizedSubtype === "jpeg") return "jpg";
  return normalizedSubtype || "jpg";
}

function buildStoragePath(sessionId: string, postIndex: number, mimeType: string) {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "") || "session";
  const extension = getImageFileExtension(mimeType);
  return `${safeSessionId}/${Date.now()}-${postIndex}.${extension}`;
}

function getQuestionText(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return "";
  return asTrimmedString(rawQuestion.text);
}

async function uploadPhotoToStorage(image: string, sessionId: string, postIndex: number): Promise<UploadedPhoto> {
  const supabase = getSupabaseApiClient();
  if (!supabase) {
    console.error("Supabase Storage er ikke konfigureret. Springer upload over.");
    return { imageUrl: null };
  }

  const parsedImage = parseImageDataUri(image);
  if (!parsedImage) {
    console.error("Kunne ikke parse data-URI til billedeupload.");
    return { imageUrl: null };
  }

  const storagePath = buildStoragePath(sessionId, postIndex, parsedImage.mimeType);
  const { error: uploadError } = await supabase.storage
    .from("participant-uploads")
    .upload(storagePath, parsedImage.buffer, {
      contentType: parsedImage.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Kunne ikke uploade deltagerbillede til Storage:", uploadError);
    return { imageUrl: null };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("participant-uploads").getPublicUrl(storagePath);

  return {
    imageUrl: publicUrl || null,
  };
}

async function fetchParticipantIdentity(sessionId: string, participantId: string) {
  const supabase = getSupabaseApiClient();
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

async function persistPhotoAnalysisResult({
  sessionId,
  participantId,
  studentName,
  postIndex,
  questionText,
  isMatch,
  message,
  imageUrl,
}: {
  sessionId: string;
  participantId: string;
  studentName: string;
  postIndex: number;
  questionText: string;
  isMatch: boolean;
  message: string;
  imageUrl: string | null;
}) {
  const normalizedStudentName = studentName.trim();
  if (!normalizedStudentName) {
    return false;
  }

  const supabase = getSupabaseApiClient();
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
  let payload: AnalyzePhotoPayload;

  try {
    payload = (await req.json()) as AnalyzePhotoPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  try {
    const image = asTrimmedString(payload.image);
    const sessionId = asTrimmedString(payload.sessionId);
    const participantId = asTrimmedString(payload.participantId);
    const postIndex = asPostIndex(payload.postIndex);

    if (!image || !sessionId || !participantId || postIndex === null) {
      return NextResponse.json({ error: "Billede eller postdata mangler." }, { status: 400 });
    }

    if (!image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Billedet skal være et base64 data-URI." }, { status: 400 });
    }

    const run = await fetchRunForSession(sessionId);
    if (!run || !Array.isArray(run.questions) || postIndex >= run.questions.length) {
      return NextResponse.json({ error: "Foto-posten kunne ikke findes." }, { status: 404 });
    }

    const participant = await fetchParticipantIdentity(sessionId, participantId);
    const studentName = asTrimmedString(participant?.student_name);
    if (!studentName) {
      return NextResponse.json({ error: "Deltageren kunne ikke findes." }, { status: 404 });
    }

    const rawQuestion = run.questions[postIndex];
    const variant = resolveQuestionVariant(run.raceType ?? run.race_type, rawQuestion);
    if (variant !== "photo") {
      return NextResponse.json({ error: "Denne post bruger ikke foto-dommeren." }, { status: 400 });
    }

    const { targetObject, isSelfie } = getPhotoMissionConfig(rawQuestion);
    if (!targetObject) {
      return NextResponse.json({ error: "Foto-posten mangler et gyldigt motiv." }, { status: 400 });
    }

    const uploadedPhoto = await uploadPhotoToStorage(image, sessionId, postIndex);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY mangler i miljøet." }, { status: 500 });
    }

    const systemPrompt = `Du er en sjov og opmuntrende dommer i et udendørs GPS-løb for børn og voksne. Din opgave er at vurdere, om det uploadede billede ${
      isSelfie
        ? `er en selfie, hvor mindst ét ansigt er tydeligt, og om motivet ${targetObject} også er synligt i baggrunden eller samme billede`
        : `indeholder det anmodede motiv: ${targetObject}`
    }.
Returner KUN et validt JSON-objekt med dette format:
{"isMatch": true/false, "message": "kort, varm feedback på dansk til deltagerne"}`;

    const userPrompt = isSelfie
      ? `Vurder om dette er en selfie ved ${targetObject}. Giv positiv, kort feedback på dansk.`
      : `Vurder om dette billede viser ${targetObject}. Giv positiv, kort feedback på dansk.`;

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
              image_url: image,
              detail: "high",
            },
          ],
        },
      ],
    });

    const normalizedResult = normalizeAnalysisResult(aiResponse.output_text ? JSON.parse(aiResponse.output_text) : null);
    if (!normalizedResult) {
      return NextResponse.json({ error: "AI-svaret kunne ikke forstås." }, { status: 502 });
    }

    let storedAnswer = false;
    if (normalizedResult.isMatch) {
      storedAnswer = await persistPhotoAnalysisResult({
        sessionId,
        participantId,
        studentName,
        postIndex,
        questionText: getQuestionText(rawQuestion),
        isMatch: normalizedResult.isMatch,
        message: normalizedResult.message,
        imageUrl: uploadedPhoto.imageUrl,
      });
    }

    return NextResponse.json({
      ...normalizedResult,
      imageUrl: uploadedPhoto.imageUrl,
      storedAnswer,
    });
  } catch (error) {
    console.error("Fotoanalyse fejlede:", error);
    return NextResponse.json({ error: "Fotoanalysen fejlede." }, { status: 500 });
  }
}
