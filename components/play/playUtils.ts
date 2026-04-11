import type {
  ActivePostVariant,
  AnswerProgressRow,
  EscapeCodeEntry,
  Question,
  RaceMode,
  StoredActiveParticipant,
  SupabaseErrorLike,
} from "./types";
import { getQuestionPoints } from "@/utils/questionPoints";

export const ACTIVE_PARTICIPANT_STORAGE_KEY = "gpslob_active_participant";
export const MANUAL_UNLOCK_RADIUS = 50;
export const AUTO_UNLOCK_CONFIRMATION_HITS = 2;
export const LOCATION_SYNC_INTERVAL_MS = 8000;
export const LOCATION_SYNC_DISTANCE_METERS = 3;
export const GPS_JUMP_FILTER_MIN_DISTANCE_METERS = 35;
export const GPS_JUMP_FILTER_MAX_SPEED_METERS_PER_SECOND = 15;
export const BAD_WORDS = ["tissemand", "lort", "pik", "fisse", "idiot", "bøsse", "luder", "snot"];
export const FIREWORKS_LOTTIE_URL = "https://assets2.lottiefiles.com/packages/lf20_touohxv0.json";
export const wrapTextClass = "break-words [overflow-wrap:anywhere] hyphens-auto";

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function containsBadWord(value: string) {
  const normalized = value.toLocaleLowerCase("da-DK");
  return BAD_WORDS.some((word) => normalized.includes(word));
}

export function isMissingColumnError(error: SupabaseErrorLike | null | undefined) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column/i.test(error.message ?? "");
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getNormalizedAnsweredPostIndex(row: AnswerProgressRow) {
  const questionIndex = toFiniteNumber(row.question_index);
  if (questionIndex !== null && questionIndex >= 0) {
    return questionIndex;
  }

  const postNumber = toFiniteNumber(row.post_index);
  if (postNumber !== null && postNumber > 0) {
    return postNumber - 1;
  }

  return null;
}

export function toIntegerStartOffset(value: unknown) {
  const parsed = toFiniteNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

export function supportsStaggeredStart(raceMode: RaceMode) {
  return raceMode === "quiz" || raceMode === "photo";
}

export function normalizeStartOffset(startOffset: number, questionCount: number) {
  if (!Number.isInteger(startOffset) || questionCount <= 1) return 0;
  return ((startOffset % questionCount) + questionCount) % questionCount;
}

export function buildRouteOrder(questionCount: number, startOffset: number, staggerEnabled: boolean) {
  if (questionCount <= 0) return [];

  const normalizedOffset = staggerEnabled ? normalizeStartOffset(startOffset, questionCount) : 0;
  return Array.from({ length: questionCount }, (_, index) => (index + normalizedOffset) % questionCount);
}

export function getNextRoutePostIndex(routeOrder: number[], completedPosts: Set<number>) {
  for (const postIndex of routeOrder) {
    if (!completedPosts.has(postIndex)) {
      return postIndex;
    }
  }

  return null;
}

export function getRouteStepIndex(routeOrder: number[], currentPostIndex: number) {
  const routeStepIndex = routeOrder.indexOf(currentPostIndex);
  return routeStepIndex >= 0 ? routeStepIndex : 0;
}

export function readStoredActiveParticipant(): StoredActiveParticipant | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_PARTICIPANT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredActiveParticipant>;
    if (!parsed.participantId || !parsed.sessionId) return null;
    const startOffset = toIntegerStartOffset(parsed.startOffset) ?? 0;
    return {
      participantId: parsed.participantId,
      sessionId: parsed.sessionId,
      studentName: parsed.studentName ?? "",
      startOffset,
      savedAt: parsed.savedAt ?? "",
      teamId: typeof parsed.teamId === "string" ? parsed.teamId : null,
      teamColor: typeof parsed.teamColor === "string" ? parsed.teamColor : null,
      avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : null,
      sessionStatus: typeof parsed.sessionStatus === "string" ? parsed.sessionStatus : null,
    };
  } catch {
    return null;
  }
}

export function saveStoredActiveParticipant(value: StoredActiveParticipant) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_PARTICIPANT_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn("Kunne ikke gemme aktiv deltager lokalt:", error);
  }
}

export function clearStoredActiveParticipant() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_PARTICIPANT_STORAGE_KEY);
  } catch (error) {
    console.warn("Kunne ikke rydde aktiv deltager lokalt:", error);
  }
}

export function reloadPage() {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export function parseQuestion(raw: unknown): Question | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const answers = Array.isArray(candidate.answers)
    ? candidate.answers
        .slice(0, 4)
        .map((item) => (typeof item === "string" ? item : ""))
    : ["", "", "", ""];
  while (answers.length < 4) answers.push("");

  const correctIndex = Number(candidate.correctIndex);
  const rawType = candidate.type;
  const type: Question["type"] =
    rawType === "multiple_choice" || rawType === "ai_image" ? rawType : "unknown";
  const aiPrompt =
    typeof candidate.aiPrompt === "string"
      ? candidate.aiPrompt
      : typeof candidate.ai_prompt === "string"
        ? candidate.ai_prompt
        : "";

  return {
    type,
    postType:
      candidate.postType === "intro" || candidate.post_type === "intro"
        ? "intro"
        : "quiz",
    text: typeof candidate.text === "string" ? candidate.text : "",
    aiPrompt: aiPrompt || undefined,
    hint: typeof candidate.hint === "string" ? candidate.hint : undefined,
    answers,
    correctIndex:
      Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex <= 3
        ? correctIndex
        : null,
    points: getQuestionPoints(candidate),
    lat,
    lng,
    mediaUrl: typeof candidate.mediaUrl === "string" ? candidate.mediaUrl : "",
    isSelfie: candidate.isSelfie === true || candidate.is_selfie === true,
  };
}

export function inferPostVariant(question: Question): ActivePostVariant {
  if (question.type === "ai_image") return "photo";
  if (question.type === "unknown") return "unknown";

  const [answer0 = "", answer1 = "", answer2 = "", answer3 = ""] = question.answers;
  const hasRoleplayMeta = Boolean(answer2.trim());
  const hasPrimaryAndReward =
    Boolean(answer0.trim()) && Boolean(answer1.trim()) && !answer2.trim() && !answer3.trim();
  const hasOnlyPrimaryAnswer =
    Boolean(answer0.trim()) && !answer1.trim() && !answer2.trim() && !answer3.trim();

  if (hasRoleplayMeta && !answer3.trim()) return "roleplay";
  if (hasPrimaryAndReward) return "escape";
  if (hasOnlyPrimaryAnswer && question.aiPrompt?.trim()) return "escape";
  return "quiz";
}

export function normalizeRaceMode(value: unknown): RaceMode {
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
    case "zone_krig":
    case "zonekrig":
      return "zone_krig";
    case "stratego":
    case "live_stratego":
    case "live-stratego":
      return "stratego";
    default:
      return "unknown";
  }
}

export function resolvePostVariant(raceMode: RaceMode, question: Question): ActivePostVariant {
  if (question.type === "ai_image") {
    return "photo";
  }

  if (raceMode === "zone_krig") {
    return "quiz";
  }

  if (raceMode === "stratego") {
    return "unknown";
  }

  if (raceMode !== "unknown") {
    return raceMode;
  }

  return inferPostVariant(question);
}

export function getRoleplayCharacterName(question: Question) {
  const hasDedicatedMessage = Boolean(question.aiPrompt?.trim());
  if (hasDedicatedMessage) {
    return question.text.trim() || question.answers[1]?.trim() || "Ukendt karakter";
  }

  return question.answers[1]?.trim() || question.text.trim() || "Ukendt karakter";
}

export function getRoleplayAvatar(question: Question) {
  return question.answers[2]?.trim() || "";
}

export function getRoleplayCharacterPersonality(question: Question) {
  return (
    question.answers[3]?.trim() ||
    question.aiPrompt?.trim() ||
    "teatralsk, levende og en smule kryptisk"
  );
}

export function getRoleplayCorrectAnswer(question: Question) {
  return question.answers[0]?.trim() || "";
}

export function extractEscapeCodeBrick(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const upper = trimmed.toLocaleUpperCase("da-DK");
  const standaloneMatch = upper.match(/(?:^|[^0-9A-ZÃ†Ã˜Ã…])([0-9A-ZÃ†Ã˜Ã…])(?:$|[^0-9A-ZÃ†Ã˜Ã…])/u);
  if (standaloneMatch?.[1]) {
    return standaloneMatch[1];
  }

  const normalized = normalizeMasterCode(trimmed);
  if (normalized.length === 1) return normalized;
  if (normalized.length > 0) return normalized.slice(-1);
  return "";
}

export function getEscapeCodeBrick(question: Question, postIndex: number) {
  const rawReward =
    question.answers[1]?.trim() ||
    question.aiPrompt?.trim() ||
    `Kode-brik ${postIndex + 1}`;

  return extractEscapeCodeBrick(rawReward) || String(postIndex + 1);
}

export function getEscapeCodeEntriesFromRows(rows: AnswerProgressRow[], questions: Question[]) {
  const seen = new Set<number>();
  const collected: EscapeCodeEntry[] = [];

  for (const row of rows) {
    if (row.is_correct !== true) continue;

    const postFromPostIndex = toFiniteNumber(row.post_index);
    const postFromQuestionIndex = toFiniteNumber(row.question_index);
    const normalizedPostNumber =
      postFromPostIndex ?? (postFromQuestionIndex === null ? null : postFromQuestionIndex + 1);
    const postIndex = normalizedPostNumber === null ? null : normalizedPostNumber - 1;

    if (postIndex === null || postIndex < 0 || postIndex >= questions.length || seen.has(postIndex)) {
      continue;
    }

    seen.add(postIndex);
    collected.push({
      postIndex,
      brick: getEscapeCodeBrick(questions[postIndex], postIndex),
    });
  }

  return collected.sort((a, b) => a.postIndex - b.postIndex);
}

export function getRoleplayMessage(question: Question) {
  return question.aiPrompt?.trim() || question.text.trim();
}

export function getQuestionDisplayText(question: Question, variant: ActivePostVariant) {
  return variant === "roleplay" ? getRoleplayMessage(question) : question.text;
}

export function looksLikeImageSource(value: string) {
  return /^(https?:\/\/|\/|data:image\/)/i.test(value.trim());
}

export function formatPhotoFailureMessage(message: string, isSelfie: boolean) {
  const trimmed = message.trim();
  if (!isSelfie) {
    return trimmed || "Prøv igen med et tydeligere billede.";
  }

  if (!trimmed) {
    return "Tæt på! Prøv igen med både ansigtet og baggrunden tydeligt i billedet.";  
  }

  const normalized = trimmed.toLocaleLowerCase("da-DK");
  if (normalized.includes("ansigt") || normalized.includes("baggrund") || normalized.includes("motiv")) {
    return trimmed;
  }

  return `Tæt på! ${trimmed}`;
}

export function readFileAsDataUri(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Kunne ikke læse billedet som tekst."));
    };
    reader.onerror = () => reject(new Error("Kunne ikke læse billedet."));
    reader.readAsDataURL(file);
  });
}

export const compressAvatarImage = async (file: File, maxSize: number = 200): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Filen er ikke et billede.");
  }

  const sourceDataUrl = await readFileAsDataUri(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Kunne ikke indlæse billedet."));
    nextImage.src = sourceDataUrl;
  });

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("Billedet har ugyldige dimensioner.");
  }

  const longestSide = Math.max(sourceWidth, sourceHeight);
  const normalizedMaxSize = Number.isFinite(maxSize) && maxSize > 0 ? maxSize : 200;
  const scale = longestSide > normalizedMaxSize ? normalizedMaxSize / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas er ikke tilgængelig.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", 0.8);
};

const PHOTO_UPLOAD_MAX_DIMENSION = 1200;
const PHOTO_UPLOAD_MAX_BYTES = 512 * 1024;
const PHOTO_UPLOAD_INITIAL_QUALITY = 0.82;
const PHOTO_UPLOAD_MIN_QUALITY = 0.45;
const PHOTO_UPLOAD_RESIZE_STEP = 0.85;
const PHOTO_UPLOAD_MIN_DIMENSION = 480;
const PHOTO_UPLOAD_MAX_ATTEMPTS = 8;

function blobToUploadFile(blob: Blob, originalFileName: string) {
  const normalized = originalFileName.trim();
  const lastDot = normalized.lastIndexOf(".");
  const baseName = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
  const nextFileName = `${baseName || "photo-upload"}.jpg`;

  return new File([blob], nextFileName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

function drawImageToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return false;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return true;
}

export function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Kunne ikke indlæse billedet."));
    image.src = src;
  });
}

export async function compressImageForUpload(file: File) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const longestSide = Math.max(sourceWidth, sourceHeight, 1);
    const scale =
      longestSide > PHOTO_UPLOAD_MAX_DIMENSION ? PHOTO_UPLOAD_MAX_DIMENSION / longestSide : 1;
    let targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    let targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    let quality = PHOTO_UPLOAD_INITIAL_QUALITY;
    let bestBlob: Blob | null = null;

    for (let attempt = 0; attempt < PHOTO_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
      const didDraw = drawImageToCanvas(canvas, image, targetWidth, targetHeight);
      if (!didDraw) {
        return file;
      }

      const blob = await canvasToBlob(canvas, quality);
      if (!blob) {
        return file;
      }

      bestBlob = blob;
      if (blob.size <= PHOTO_UPLOAD_MAX_BYTES) {
        return blobToUploadFile(blob, file.name);
      }

      if (quality > PHOTO_UPLOAD_MIN_QUALITY) {
        quality = Math.max(PHOTO_UPLOAD_MIN_QUALITY, quality - 0.12);
        continue;
      }

      const nextLongestSide = Math.max(targetWidth, targetHeight) * PHOTO_UPLOAD_RESIZE_STEP;
      if (nextLongestSide < PHOTO_UPLOAD_MIN_DIMENSION) {
        break;
      }

      targetWidth = Math.max(1, Math.round(targetWidth * PHOTO_UPLOAD_RESIZE_STEP));
      targetHeight = Math.max(1, Math.round(targetHeight * PHOTO_UPLOAD_RESIZE_STEP));
      quality = Math.min(PHOTO_UPLOAD_INITIAL_QUALITY, quality + 0.08);
    }

    if (bestBlob) {
      return blobToUploadFile(bestBlob, file.name);
    }

    return file;
  } catch (error) {
    console.error("Kunne ikke komprimere billedet lokalt:", error);
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function normalizeMasterCode(value: string) {
  return value.toLocaleUpperCase("da-DK").replace(/[^0-9A-ZÃ†Ã˜Ã…]/g, "");
}

export function formatPlacement(position: number) {
  if (position === 1) return "1. plads";
  return `${position}. plads`;
}

export function formatFinishedAt(value: string | null) {
  if (!value) return "Tidspunkt mangler";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Tidspunkt mangler";
  }

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}
