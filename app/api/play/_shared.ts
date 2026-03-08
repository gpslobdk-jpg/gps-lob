type LiveSessionRow = {
  run_id?: string | null;
};

type RunRow = {
  questions?: unknown;
  description?: unknown;
  raceType?: unknown;
  race_type?: unknown;
};

export type QuestionVariant = "quiz" | "photo" | "escape" | "roleplay" | "unknown";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error("Supabase er ikke konfigureret.");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function fetchSupabaseRows<T>(path: string) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Supabase-opslag fejlede.");
  }

  return (await response.json()) as T[];
}

export async function fetchRunForSession(sessionId: string) {
  const sessionRows = await fetchSupabaseRows<LiveSessionRow>(
    `live_sessions?id=eq.${encodeURIComponent(sessionId)}&select=run_id&limit=1`
  );
  const runId = asTrimmedString(sessionRows[0]?.run_id);
  if (!runId) return null;

  const runRows = await fetchSupabaseRows<RunRow>(
    `gps_runs?id=eq.${encodeURIComponent(runId)}&select=questions,description,raceType,race_type&limit=1`
  );

  return runRows[0] ?? null;
}

export function normalizeRaceMode(value: unknown) {
  if (typeof value !== "string") return "unknown";

  switch (value.trim().toLocaleLowerCase("da-DK")) {
    case "quiz":
    case "manuel":
    case "manual":
      return "quiz";
    case "foto":
    case "photo":
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
  const normalizedRaceMode = normalizeRaceMode(raceMode);
  if (normalizedRaceMode !== "unknown") {
    return normalizedRaceMode;
  }

  if (!isRecord(rawQuestion)) return "unknown";

  const rawType = asTrimmedString(rawQuestion.type);
  if (rawType === "ai_image") return "photo";

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
