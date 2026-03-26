import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";

type LiveSessionRow = {
  run_id?: string | null;
};

type RunRow = {
  questions?: unknown;
  description?: unknown;
  raceType?: unknown;
  race_type?: unknown;
};

type ParticipantStartRow = {
  start_offset?: number | string | null;
  run_started_at?: string | null;
};

type ParticipantLocationRow = {
  lat?: number | string | null;
  lng?: number | string | null;
};

export type QuestionVariant = "quiz" | "photo" | "escape" | "roleplay" | "unknown";

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function fetchSessionRow(sessionId: string, adminSupabase: AdminSupabaseClient) {
  const { data, error } = await adminSupabase
    .from("live_sessions")
    .select("run_id")
    .eq("id", sessionId)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data?.[0] ?? null) as LiveSessionRow | null;
}

async function fetchRunRow(runId: string, adminSupabase: AdminSupabaseClient) {
  const { data, error } = await adminSupabase
    .from("gps_runs")
    .select("*")
    .eq("id", runId)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data?.[0] ?? null) as RunRow | null;
}

export async function fetchRunForSession(sessionId: string) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    throw new Error(ADMIN_ACCESS_MISSING_MESSAGE);
  }

  const sessionRow = await fetchSessionRow(sessionId, adminSupabase);
  const runId = asTrimmedString(sessionRow?.run_id);
  if (!runId) return null;

  return await fetchRunRow(runId, adminSupabase);
}

export function normalizeRaceMode(value: unknown) {
  if (typeof value !== "string") return "unknown";

  switch (value.trim().toLocaleLowerCase("da-DK")) {
    case "quiz":
    case "manuel":
    case "manual":
    case "matematik":
    case "math":
    case "dansk":
    case "danish":
    case "engelsk":
    case "english":
    case "scanner":
    case "bogscanner":
    case "bookscanner":
    case "qrscanner":
      return "quiz";
    case "foto":
    case "photo":
    case "selfie":
      return "photo";
    case "escape":
    case "escape_room":
    case "escaperoom":
      return "escape";
    case "rollespil":
    case "roleplay":
    case "role_play":
    case "tidsmaskinen":
      return "roleplay";
    default:
      return "unknown";
  }
}

export function supportsServerStaggeredStart(raceMode: unknown) {
  const normalizedRaceMode = normalizeRaceMode(raceMode);
  return normalizedRaceMode === "quiz" || normalizedRaceMode === "photo";
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeServerStartOffset(startOffset: unknown, questionCount: number) {
  const parsedStartOffset = toFiniteNumber(startOffset);
  if (parsedStartOffset === null || !Number.isInteger(parsedStartOffset) || questionCount <= 1) {
    return 0;
  }

  return ((parsedStartOffset % questionCount) + questionCount) % questionCount;
}

export function getServerRouteOrder(
  questionCount: number,
  startOffset: unknown,
  staggerEnabled: boolean
) {
  if (questionCount <= 0) return [] as number[];

  const normalizedStartOffset = staggerEnabled
    ? normalizeServerStartOffset(startOffset, questionCount)
    : 0;

  return Array.from({ length: questionCount }, (_, index) =>
    (index + normalizedStartOffset) % questionCount
  );
}

export function getFirstRoutePostIndexForParticipant(
  questionCount: number,
  startOffset: unknown,
  raceMode: unknown
) {
  const routeOrder = getServerRouteOrder(
    questionCount,
    startOffset,
    supportsServerStaggeredStart(raceMode)
  );

  return routeOrder[0] ?? null;
}

export function getAnsweredPostIndex(payload: Record<string, unknown>) {
  const questionIndex = toFiniteNumber(payload.question_index);
  if (questionIndex !== null && Number.isInteger(questionIndex) && questionIndex >= 0) {
    return questionIndex;
  }

  const postIndex = toFiniteNumber(payload.post_index);
  if (postIndex !== null && Number.isInteger(postIndex)) {
    return postIndex >= 1 ? postIndex - 1 : postIndex;
  }

  return null;
}

export async function fetchParticipantStartState(
  sessionId: string,
  participantId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("participants")
    .select("start_offset,run_started_at")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .maybeSingle<ParticipantStartRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function fetchParticipantLocationState(
  sessionId: string,
  participantId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("participants")
    .select("lat,lng")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .maybeSingle<ParticipantLocationRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export function getLocationDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}

export function normalizeMasterCode(value: string) {
  return value.toLocaleUpperCase("da-DK").replace(/[^0-9A-ZÆØÅ]/g, "");
}

export function extractMasterCode(description: unknown) {
  if (!isRecord(description) && typeof description !== "string") {
    return "";
  }

  if (isRecord(description)) {
    return normalizeMasterCode(asTrimmedString(description.masterCode));
  }

  const trimmed = description.trim();
  if (!trimmed.startsWith("{")) return "";

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed)) return "";
    return normalizeMasterCode(asTrimmedString(parsed.masterCode));
  } catch {
    return "";
  }
}

export function normalizeEscapeAnswer(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function getNormalizedAnswers(rawQuestion: unknown) {
  if (!isRecord(rawQuestion) || !Array.isArray(rawQuestion.answers)) {
    return ["", "", "", ""];
  }

  const answers = rawQuestion.answers.map((item) => (typeof item === "string" ? item.trim() : ""));
  while (answers.length < 4) answers.push("");
  return answers.slice(0, 4);
}

export function inferEscapeQuestion(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return false;

  const answers = getNormalizedAnswers(rawQuestion);
  const [answer0 = "", answer1 = "", answer2 = "", answer3 = ""] = answers;
  const aiPrompt =
    typeof rawQuestion.aiPrompt === "string"
      ? rawQuestion.aiPrompt.trim()
      : typeof rawQuestion.ai_prompt === "string"
        ? rawQuestion.ai_prompt.trim()
        : "";

  const hasRoleplayMeta = Boolean(answer2);
  const hasPrimaryAndReward = Boolean(answer0) && Boolean(answer1) && !answer2 && !answer3;
  const hasOnlyPrimaryAnswer = Boolean(answer0) && !answer1 && !answer2 && !answer3;

  return !hasRoleplayMeta && (hasPrimaryAndReward || (hasOnlyPrimaryAnswer && Boolean(aiPrompt)));
}

export function resolveQuestionVariant(raceMode: unknown, rawQuestion: unknown): QuestionVariant {
  if (isRecord(rawQuestion)) {
    const rawType = asTrimmedString(rawQuestion.type);
    if (rawType === "ai_image") return "photo";
  }

  const normalizedRaceMode = normalizeRaceMode(raceMode);
  if (normalizedRaceMode !== "unknown") {
    return normalizedRaceMode;
  }

  if (!isRecord(rawQuestion)) return "unknown";

  const rawType = asTrimmedString(rawQuestion.type);
  const [answer0 = "", answer1 = "", answer2 = "", answer3 = ""] = getNormalizedAnswers(rawQuestion);
  if (Boolean(answer2) && !answer3) return "roleplay";
  if (inferEscapeQuestion(rawQuestion)) return "escape";
  if (rawType === "multiple_choice" || Boolean(answer0) || Boolean(answer1) || Boolean(answer3)) {
    return "quiz";
  }

  return "unknown";
}

export function sanitizeQuestionForPlay(rawQuestion: unknown, variant: QuestionVariant) {
  if (!isRecord(rawQuestion)) return rawQuestion;

  const answers = getNormalizedAnswers(rawQuestion);

  if (variant === "escape") {
    return {
      ...rawQuestion,
      answers: ["", "", "", ""],
      correctIndex: null,
    };
  }

  if (variant === "photo") {
    return {
      ...rawQuestion,
      answers: ["", "", "", ""],
      aiPrompt: "",
      ai_prompt: "",
      correctIndex: null,
    };
  }

  if (variant === "roleplay") {
    return {
      ...rawQuestion,
      answers: ["", answers[1] ?? "", answers[2] ?? "", answers[3] ?? ""],
      correctIndex: null,
    };
  }

  return {
    ...rawQuestion,
    correctIndex: null,
  };
}

export function extractEscapeCodeBrick(rawQuestion: unknown, postIndex: number) {
  if (!isRecord(rawQuestion)) return String(postIndex + 1);

  const rawReward =
    asTrimmedString(rawQuestion.answers && Array.isArray(rawQuestion.answers) ? rawQuestion.answers[1] : "") ||
    asTrimmedString(rawQuestion.aiPrompt) ||
    asTrimmedString(rawQuestion.ai_prompt) ||
    `Kode-brik ${postIndex + 1}`;

  const upper = rawReward.toLocaleUpperCase("da-DK");
  const standaloneMatch = upper.match(/(?:^|[^0-9A-ZÆØÅ])([0-9A-ZÆØÅ])(?:$|[^0-9A-ZÆØÅ])/u);
  if (standaloneMatch?.[1]) {
    return standaloneMatch[1];
  }

  const normalized = normalizeMasterCode(rawReward);
  if (normalized.length === 1) return normalized;
  if (normalized.length > 0) return normalized.slice(-1);
  return String(postIndex + 1);
}

export function getExpectedAnswer(rawQuestion: unknown) {
  const correctIndex = getCorrectIndex(rawQuestion);
  if (correctIndex === null) return "";

  const answers = getNormalizedAnswers(rawQuestion);
  return asTrimmedString(answers[correctIndex]);
}

export function getCorrectIndex(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) return null;

  const answers = getNormalizedAnswers(rawQuestion);
  const rawCorrectIndex =
    typeof rawQuestion.correctIndex === "number" && Number.isInteger(rawQuestion.correctIndex)
      ? rawQuestion.correctIndex
      : null;

  if (rawCorrectIndex === null) return null;
  if (rawCorrectIndex < 0 || rawCorrectIndex >= answers.length) return null;
  return rawCorrectIndex;
}

export function getPhotoMissionConfig(rawQuestion: unknown) {
  if (!isRecord(rawQuestion)) {
    return {
      targetObject: "",
      isSelfie: false,
    };
  }

  const answers = getNormalizedAnswers(rawQuestion);

  return {
    targetObject:
      answers[0] ||
      asTrimmedString(rawQuestion.aiPrompt) ||
      asTrimmedString(rawQuestion.ai_prompt),
    isSelfie: rawQuestion.isSelfie === true || rawQuestion.is_selfie === true,
  };
}
