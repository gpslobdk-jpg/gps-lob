"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { AlertCircle, Camera, CheckCircle2, Crosshair, KeyRound, Loader2, MapPin } from "lucide-react";
import Image from "next/image";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { DivIcon } from "leaflet";

import trophyAnimation from "@/public/trophy.json";
import { createClient } from "@/utils/supabase/client";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
const LottiePlayer = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false }
);
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), {
  ssr: false,
});
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
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

type Question = {
  type: "multiple_choice" | "ai_image" | "unknown";
  text: string;
  aiPrompt?: string;
  hint?: string;
  answers: string[];
  correctIndex: number | null;
  lat: number;
  lng: number;
  mediaUrl?: string;
  isSelfie?: boolean;
};

type ActivePostVariant = "quiz" | "photo" | "escape" | "roleplay" | "unknown";
type RaceMode = ActivePostVariant;
type GpsErrorState = "permission_denied" | "position_unavailable" | "timeout" | "unsupported";
type PhotoFeedbackState = {
  key: string;
  tone: "success" | "error";
  message: string;
} | null;
type PostActionErrorState = {
  key: string;
  message: string;
} | null;
type QuizAnswerFeedbackState = {
  key: string;
  selectedIndex: number;
  tone: "success" | "error";
} | null;
type EscapeRewardState = {
  key: string;
  brick: string;
} | null;
type EscapeCodeEntry = {
  postIndex: number;
  brick: string;
};
type RoleplayReplyState = {
  key: string;
  message: string;
} | null;
type MasterLockStatus = "locked" | "unlocked";

type Location = {
  lat: number;
  lng: number;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

type StoredActiveParticipant = {
  participantId: string;
  sessionId: string;
  studentName: string;
  savedAt: string;
};

type ParticipantRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  finished_at?: string | null;
};

type EscapeResultEntry = {
  place: number;
  studentName: string;
  finishedAt: string | null;
};

type PlaySessionPayload = {
  questions?: unknown;
  raceType?: unknown;
  error?: string;
};

type AnswerProgressRow = {
  post_index?: number | string | null;
  question_index?: number | string | null;
  is_correct?: boolean | null;
};

type ValidateAnswerPayload = {
  isCorrect?: boolean;
  brick?: string | null;
  error?: string;
};

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

const ACTIVE_PARTICIPANT_STORAGE_KEY = "gpslob_active_participant";
const AUTO_UNLOCK_RADIUS = 15;
const MANUAL_UNLOCK_RADIUS = 50;
const LOCATION_SYNC_INTERVAL_MS = 4000;
const LOCATION_SYNC_DISTANCE_METERS = 5;
const BAD_WORDS = ["tissemand", "lort", "pik", "fisse", "idiot", "bøsse", "luder", "snot"];
const FIREWORKS_LOTTIE_URL = "https://assets2.lottiefiles.com/packages/lf20_touohxv0.json";
const wrapTextClass = "break-words [overflow-wrap:anywhere] hyphens-auto";

function containsBadWord(value: string) {
  const normalized = value.toLocaleLowerCase("da-DK");
  return BAD_WORDS.some((word) => normalized.includes(word));
}

function isMissingColumnError(error: SupabaseErrorLike | null | undefined) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column/i.test(error.message ?? "");
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStoredActiveParticipant(): StoredActiveParticipant | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_PARTICIPANT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredActiveParticipant>;
    if (!parsed.participantId || !parsed.sessionId) return null;
    return {
      participantId: parsed.participantId,
      sessionId: parsed.sessionId,
      studentName: parsed.studentName ?? "",
      savedAt: parsed.savedAt ?? "",
    };
  } catch {
    return null;
  }
}

function saveStoredActiveParticipant(value: StoredActiveParticipant) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_PARTICIPANT_STORAGE_KEY, JSON.stringify(value));
}

function clearStoredActiveParticipant() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_PARTICIPANT_STORAGE_KEY);
}

function reloadPage() {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

function parseQuestion(raw: unknown): Question | null {
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
    text: typeof candidate.text === "string" ? candidate.text : "",
    aiPrompt: aiPrompt || undefined,
    hint: typeof candidate.hint === "string" ? candidate.hint : undefined,
    answers,
    correctIndex:
      Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex <= 3
        ? correctIndex
        : null,
    lat,
    lng,
    mediaUrl: typeof candidate.mediaUrl === "string" ? candidate.mediaUrl : "",
    isSelfie: candidate.isSelfie === true || candidate.is_selfie === true,
  };
}

function inferPostVariant(question: Question): ActivePostVariant {
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

function normalizeRaceMode(value: unknown): RaceMode {
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

function resolvePostVariant(raceMode: RaceMode, question: Question): ActivePostVariant {
  if (raceMode !== "unknown") {
    return raceMode;
  }

  return inferPostVariant(question);
}

function getRoleplayCharacterName(question: Question) {
  const hasDedicatedMessage = Boolean(question.aiPrompt?.trim());
  if (hasDedicatedMessage) {
    return question.text.trim() || question.answers[1]?.trim() || "Ukendt karakter";
  }

  return question.answers[1]?.trim() || question.text.trim() || "Ukendt karakter";
}

function getRoleplayAvatar(question: Question) {
  return question.answers[2]?.trim() || "";
}

function extractEscapeCodeBrick(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const upper = trimmed.toLocaleUpperCase("da-DK");
  const standaloneMatch = upper.match(/(?:^|[^0-9A-ZÆØÅ])([0-9A-ZÆØÅ])(?:$|[^0-9A-ZÆØÅ])/u);
  if (standaloneMatch?.[1]) {
    return standaloneMatch[1];
  }

  const normalized = normalizeMasterCode(trimmed);
  if (normalized.length === 1) return normalized;
  if (normalized.length > 0) return normalized.slice(-1);
  return "";
}

function getEscapeCodeBrick(question: Question, postIndex: number) {
  const rawReward =
    question.answers[1]?.trim() ||
    question.aiPrompt?.trim() ||
    `Kode-brik ${postIndex + 1}`;

  return extractEscapeCodeBrick(rawReward) || String(postIndex + 1);
}

function getEscapeCodeEntriesFromRows(rows: AnswerProgressRow[], questions: Question[]) {
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

function getRoleplayMessage(question: Question) {
  return question.aiPrompt?.trim() || question.text.trim();
}

function getQuestionDisplayText(question: Question, variant: ActivePostVariant) {
  return variant === "roleplay" ? getRoleplayMessage(question) : question.text;
}

function looksLikeImageSource(value: string) {
  return /^(https?:\/\/|\/|data:image\/)/i.test(value.trim());
}

function formatPhotoFailureMessage(message: string, isSelfie: boolean) {
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

function readFileAsDataUri(file: File) {
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

function normalizeMasterCode(value: string) {
  return value.toLocaleUpperCase("da-DK").replace(/[^0-9A-ZÆØÅ]/g, "");
}

function formatPlacement(position: number) {
  if (position === 1) return "1. plads";
  return `${position}. plads`;
}

function formatFinishedAt(value: string | null) {
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

function PlayScreen() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());

  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const initialStudentName = searchParams.get("name")?.trim() || "";
  const initialNameCandidate = initialStudentName || "";
  const storedParticipantOnLoad = useMemo(() => {
    if (!sessionId) return null;
    const stored = readStoredActiveParticipant();
    if (!stored) return null;
    if (stored.sessionId !== sessionId) {
      clearStoredActiveParticipant();
      return null;
    }
    return stored;
  }, [sessionId]);
  const [pendingPlayerName, setPendingPlayerName] = useState(
    () => storedParticipantOnLoad?.studentName || initialNameCandidate
  );
  const [playerName, setPlayerName] = useState(() => storedParticipantOnLoad?.studentName || "");
  const [hasConfirmedName, setHasConfirmedName] = useState(
    () => Boolean(storedParticipantOnLoad?.studentName)
  );

  const [questions, setQuestions] = useState<Question[]>([]);
  const [raceMode, setRaceMode] = useState<RaceMode>("unknown");
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [myLoc, setMyLoc] = useState<Location | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [gpsError, setGpsError] = useState<GpsErrorState | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isKicked, setIsKicked] = useState(false);
  const [latestMessage, setLatestMessage] = useState<string | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<PhotoFeedbackState>(null);
  const [postActionError, setPostActionError] = useState<PostActionErrorState>(null);
  const [quizAnswerFeedback, setQuizAnswerFeedback] = useState<QuizAnswerFeedbackState>(null);
  const [escapeReward, setEscapeReward] = useState<EscapeRewardState>(null);
  const [collectedEscapeRewards, setCollectedEscapeRewards] = useState<EscapeCodeEntry[]>([]);
  const [roleplayReply, setRoleplayReply] = useState<RoleplayReplyState>(null);
  const [masterLockInput, setMasterLockInput] = useState("");
  const [masterLockError, setMasterLockError] = useState<string | null>(null);
  const [masterLockStatus, setMasterLockStatus] = useState<MasterLockStatus>("locked");
  const [masterLockShakeNonce, setMasterLockShakeNonce] = useState(0);
  const [isFinalizingEscape, setIsFinalizingEscape] = useState(false);
  const [showEscapeResults, setShowEscapeResults] = useState(false);
  const [escapeResults, setEscapeResults] = useState<EscapeResultEntry[]>([]);
  const [isLoadingEscapeResults, setIsLoadingEscapeResults] = useState(false);
  const [escapeResultsError, setEscapeResultsError] = useState<string | null>(null);
  const [isCheckingEscapeAnswer, setIsCheckingEscapeAnswer] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [dismissedPostIndex, setDismissedPostIndex] = useState<number | null>(null);
  const [showMasterVictory, setShowMasterVictory] = useState(false);
  const [typedAnswerError, setTypedAnswerError] = useState<{ key: string; message: string } | null>(
    null
  );
  const [hasRoleplayInputErrorTone, setHasRoleplayInputErrorTone] = useState(false);
  const [playerIcon, setPlayerIcon] = useState<DivIcon | null>(null);
  const [targetIcon, setTargetIcon] = useState<DivIcon | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(
    () => storedParticipantOnLoad?.participantId ?? null
  );
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const participantsTableMissingRef = useRef(false);
  const answersTableMissingRef = useRef(false);
  const hasRestoredRef = useRef(!Boolean(storedParticipantOnLoad));
  const resumeMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quizAnswerFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleplayInputErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockSentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const masterVictoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocationSyncRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const isLocationSyncInFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const typedAnswerInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const clearRoleplayInputErrorTone = useCallback(() => {
    if (roleplayInputErrorTimerRef.current) {
      clearTimeout(roleplayInputErrorTimerRef.current);
      roleplayInputErrorTimerRef.current = null;
    }
    setHasRoleplayInputErrorTone(false);
  }, []);

  const triggerRoleplayInputError = useCallback(() => {
    clearRoleplayInputErrorTone();
    setHasRoleplayInputErrorTone(true);
    roleplayInputErrorTimerRef.current = setTimeout(() => {
      setHasRoleplayInputErrorTone(false);
      roleplayInputErrorTimerRef.current = null;
    }, 420);

    typedAnswerInputRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(7px)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0)" },
      ],
      {
        duration: 360,
        easing: "ease-in-out",
      }
    );
  }, [clearRoleplayInputErrorTone]);

  const unlockCurrentPost = useCallback(() => {
    clearRoleplayInputErrorTone();
    setDismissedPostIndex(null);
    setPhotoFeedback(null);
    setPostActionError(null);
    setQuizAnswerFeedback(null);
    setEscapeReward(null);
    setRoleplayReply(null);
    setShowQuestion(true);
  }, [clearRoleplayInputErrorTone]);

  const dismissCurrentPost = useCallback(() => {
    clearRoleplayInputErrorTone();
    setPhotoFeedback(null);
    setPostActionError(null);
    setQuizAnswerFeedback(null);
    setTypedAnswerError(null);
    setShowQuestion(false);
    setDismissedPostIndex(currentPostIndex);
  }, [clearRoleplayInputErrorTone, currentPostIndex]);

  const showResumeNotice = useCallback((message: string) => {
    setResumeMessage(message);
    if (resumeMessageTimerRef.current) {
      clearTimeout(resumeMessageTimerRef.current);
    }
    resumeMessageTimerRef.current = setTimeout(() => {
      setResumeMessage(null);
      resumeMessageTimerRef.current = null;
    }, 5000);
  }, []);

  const rememberActiveParticipant = useCallback(
    (nextParticipantId: string, nextStudentName: string) => {
      if (!sessionId || !nextParticipantId) return;
      const normalizedName = nextStudentName.trim();
      setParticipantId(nextParticipantId);
      saveStoredActiveParticipant({
        participantId: nextParticipantId,
        sessionId,
        studentName: normalizedName,
        savedAt: new Date().toISOString(),
      });
    },
    [sessionId]
  );

  const handleNameSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = pendingPlayerName.trim();

      if (!trimmedName) {
        setNameError("Skriv dit eller jeres rigtige navn for at starte.");
        return;
      }

      if (containsBadWord(trimmedName)) {
        setNameError("Hov! Hold en god tone. Skriv jeres rigtige navne for at være med.");
        return;
      }

      setNameError(null);
      setPlayerName(trimmedName);
      setHasConfirmedName(true);

      if (participantId) {
        rememberActiveParticipant(participantId, trimmedName);
      }
    },
    [participantId, pendingPlayerName, rememberActiveParticipant]
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (resumeMessageTimerRef.current) {
        clearTimeout(resumeMessageTimerRef.current);
      }
      if (quizAnswerFeedbackTimerRef.current) {
        clearTimeout(quizAnswerFeedbackTimerRef.current);
      }
      if (roleplayInputErrorTimerRef.current) {
        clearTimeout(roleplayInputErrorTimerRef.current);
      }
      if (masterVictoryTimerRef.current) {
        clearTimeout(masterVictoryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isDisposed = false;

    if (typeof window === "undefined") return;

    void import("leaflet")
      .then((leafletModule) => {
        if (isDisposed) return;

        const leaflet = leafletModule.default ?? leafletModule;

        setPlayerIcon(
          leaflet.divIcon({
            className: "bg-transparent border-none",
            html: '<div class="w-5 h-5 rounded-full bg-emerald-400 border-2 border-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.9)]"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })
        );

        setTargetIcon(
          leaflet.divIcon({
            className: "bg-transparent border-none",
            html: '<div class="relative w-8 h-8"><div class="absolute inset-0 rounded-full bg-amber-300/20 animate-ping"></div><div class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-950 text-amber-100 font-black shadow-[0_0_18px_rgba(251,191,36,0.8)]">â—Ž</div></div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })
        );
      })
      .catch(() => {
        if (isDisposed) return;
        setPlayerIcon(null);
        setTargetIcon(null);
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !participantId || questions.length === 0 || hasRestoredRef.current) return;

    let isActive = true;

    const restoreFromStorage = async () => {
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("id,session_id,student_name,lat,lng,finished_at")
        .eq("id", participantId)
        .eq("session_id", sessionId)
        .maybeSingle<ParticipantRow>();

      if (!isActive) return;

        if (participantError) {
          if (participantError.code === "PGRST205") {
            participantsTableMissingRef.current = true;
          } else {
            console.error("Kunne ikke genskabe deltagerdata fra participants:", participantError);
          }
        hasRestoredRef.current = true;
        return;
      }

      if (!participantData) {
        clearStoredActiveParticipant();
        setParticipantId(null);
        hasRestoredRef.current = true;
        return;
      }

      const restoredName =
        typeof participantData.student_name === "string"
          ? participantData.student_name.trim()
          : "";

      const resolvedName = restoredName || playerName || initialStudentName;
      if (resolvedName) {
        setPlayerName(resolvedName);
        setPendingPlayerName(resolvedName);
        setHasConfirmedName(true);
        setNameError(null);
      }

      if (participantData.id && resolvedName) {
        rememberActiveParticipant(String(participantData.id), resolvedName);
      }

      const restoredLat = toFiniteNumber(participantData.lat);
      const restoredLng = toFiniteNumber(participantData.lng);
      if (restoredLat !== null && restoredLng !== null) {
        setMyLoc({ lat: restoredLat, lng: restoredLng });
      }

      if (participantData.finished_at) {
        clearStoredActiveParticipant();
        setParticipantId(null);
        setIsFinished(true);
        hasRestoredRef.current = true;
        return;
      }

      if (resolvedName) {
        const { data: answersData, error: answersError } = await supabase
          .from("answers")
          .select("post_index,question_index,is_correct")
          .eq("session_id", sessionId)
          .eq("student_name", resolvedName);

        if (!isActive) return;

        if (answersError) {
          if (answersError.code === "PGRST205") {
            answersTableMissingRef.current = true;
          } else {
            console.error("Kunne ikke hente deltagerens tidligere svar:", answersError);
          }
        } else if (answersData) {
          const rows = answersData as AnswerProgressRow[];
          const confirmedCorrect = rows.filter((row) => row.is_correct === true).length;
          setCorrectAnswersCount(confirmedCorrect);
          setCollectedEscapeRewards(getEscapeCodeEntriesFromRows(rows, questions));

          let highestCompletedPost = 0;
          for (const row of rows) {
            if (row.is_correct === false) continue;
            const postFromPostIndex = toFiniteNumber(row.post_index);
            const postFromQuestionIndex = toFiniteNumber(row.question_index);
            const normalizedPostNumber =
              postFromPostIndex ?? (postFromQuestionIndex === null ? null : postFromQuestionIndex + 1);
            if (
              normalizedPostNumber !== null &&
              normalizedPostNumber > highestCompletedPost
            ) {
              highestCompletedPost = normalizedPostNumber;
            }
          }

          if (highestCompletedPost >= questions.length) {
            setShowQuestion(false);
            setDistance(null);
            setEscapeReward(null);
            setRoleplayReply(null);
            setMasterLockStatus("locked");
            setMasterLockError(null);
            setMasterLockInput("");
            setIsFinished(true);
            showResumeNotice("Dine kode-brikker er gendannet. Master-låsen er klar.");
            hasRestoredRef.current = true;
            return;
          }

          const nextPostNumber = Math.max(1, highestCompletedPost + 1);
          const nextPostIndex = Math.min(nextPostNumber, questions.length) - 1;
          setCurrentPostIndex(nextPostIndex);
          setShowQuestion(false);
          setDistance(null);
        }
      }

      if (resolvedName) {
        showResumeNotice(`Velkommen tilbage, ${resolvedName}! Genoptager løbet...`);
      }

      hasRestoredRef.current = true;
    };

    void restoreFromStorage();

    return () => {
      isActive = false;
    };
  }, [
    sessionId,
    participantId,
    questions,
    questions.length,
    supabase,
    playerName,
    initialStudentName,
    rememberActiveParticipant,
    showResumeNotice,
  ]);

  const syncParticipantLocation = useCallback(
    async (lat: number, lng: number) => {
      const activeName = playerName.trim();
      if (!sessionId || !activeName) return;

      try {
        const response = await fetch("/api/play/location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            sessionId,
            studentName: activeName,
            participantId,
            lat,
            lng,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          console.error("Kunne ikke opdatere deltagerposition:", payload?.error ?? response.statusText);
          return;
        }

        const payload = (await response.json().catch(() => null)) as
          | { participantId?: string | null }
          | null;

        if (typeof payload?.participantId === "string" && payload.participantId) {
          rememberActiveParticipant(payload.participantId, activeName);
        }
      } catch (error) {
        console.error("Kunne ikke synkronisere deltagerposition:", error);
      }
    },
    [participantId, playerName, rememberActiveParticipant, sessionId]
  );

  const markParticipantFinished = useCallback(async () => {
    const activeName = playerName.trim();
    if (!sessionId || !activeName) return false;
    const finishedAt = new Date().toISOString();

    if (!participantsTableMissingRef.current) {
      const { error } = await supabase
        .from("participants")
        .update({ finished_at: finishedAt })
        .eq("session_id", sessionId)
        .eq("student_name", activeName);

      if (!error) {
        clearStoredActiveParticipant();
        setParticipantId(null);
        return true;
      }
      if (error.code === "PGRST205") {
        participantsTableMissingRef.current = true;
      } else {
        console.error("Kunne ikke gemme målgang i participants:", error);
      }
    }

    const { error: fallbackError } = await supabase
      .from("session_students")
      .update({ finished_at: finishedAt })
      .eq("session_id", sessionId)
      .eq("student_name", activeName);

    if (fallbackError) {
      console.error("Kunne ikke gemme målgangstid:", fallbackError);
      return false;
    }
    clearStoredActiveParticipant();
    setParticipantId(null);
    return true;
  }, [playerName, sessionId, supabase]);

  const insertAnswerRecord = useCallback(
    async (
      selectedIndex: number,
      isCorrect: boolean,
      postNumber: number,
      questionText: string,
      lat: number | null,
      lng: number | null
    ) => {
      const activeName = playerName.trim();
      if (!sessionId || !activeName || answersTableMissingRef.current) return false;

      const timestamp = new Date().toISOString();
      const payloads: Record<string, unknown>[] = [
        {
          session_id: sessionId,
          student_name: activeName,
          post_index: postNumber,
          question_index: postNumber - 1,
          selected_index: selectedIndex,
          answer_index: selectedIndex,
          is_correct: isCorrect,
          question_text: questionText,
          lat,
          lng,
          answered_at: timestamp,
        },
        {
          session_id: sessionId,
          student_name: activeName,
          post_index: postNumber,
          selected_index: selectedIndex,
          is_correct: isCorrect,
          answered_at: timestamp,
        },
        {
          session_id: sessionId,
          student_name: activeName,
          question_index: postNumber - 1,
          answer_index: selectedIndex,
          is_correct: isCorrect,
          created_at: timestamp,
        },
        {
          session_id: sessionId,
          student_name: activeName,
          selected_index: selectedIndex,
          is_correct: isCorrect,
        },
      ];

      for (const payload of payloads) {
        const { error } = await supabase.from("answers").insert(payload);
        if (!error) return true;
        if (error.code === "PGRST205") {
          answersTableMissingRef.current = true;
          return false;
        }
        if (isMissingColumnError(error)) continue;
        console.error("Kunne ikke gemme svar i answers:", error);
        return false;
      }

      return false;
    },
    [playerName, sessionId, supabase]
  );

  useEffect(() => {
    if (!sessionId) return;

    let isActive = true;

    const fetchRun = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await fetch(`/api/play/session?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as PlaySessionPayload | null;

        if (!isActive) return;

        if (!response.ok) {
          setLoadError(payload?.error || "Kunne ikke hente løbet.");
          setIsLoading(false);
          return;
        }

        const parsedQuestions = Array.isArray(payload?.questions)
          ? payload.questions.map(parseQuestion).filter((q): q is Question => q !== null)
          : [];

        if (parsedQuestions.length === 0) {
          setLoadError("Dette løb har ingen gyldige GPS-poster endnu.");
        } else {
          setQuestions(parsedQuestions);
        }

        setRaceMode(normalizeRaceMode(payload?.raceType));
        setCollectedEscapeRewards([]);
        setEscapeReward(null);
        setPostActionError(null);
        setDismissedPostIndex(null);
        setIsSubmittingAnswer(false);
        lastLocationSyncRef.current = null;
        isLocationSyncInFlightRef.current = false;
        setShowMasterVictory(false);
        setMasterLockStatus("locked");
        setMasterLockError(null);
        setMasterLockInput("");
        setIsLoading(false);
      } catch (error) {
        if (!isActive) return;
        console.error("Kunne ikke hente play-data:", error);
        setLoadError("Kunne ikke hente løbet.");
        setIsLoading(false);
      }
    };

    void fetchRun();

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  useEffect(() => {
    const escapeRaceActive =
      raceMode === "escape" ||
      (raceMode === "unknown" &&
        questions.length > 0 &&
        questions.every((question) => resolvePostVariant(raceMode, question) === "escape"));

    if (!showEscapeResults || !escapeRaceActive || !sessionId) return;

    let isActive = true;

    const fetchEscapeResults = async () => {
      setIsLoadingEscapeResults(true);
      setEscapeResultsError(null);

      const loadPlacements = async (table: "participants" | "session_students") =>
        supabase
          .from(table)
          .select("student_name,finished_at")
          .eq("session_id", sessionId)
          .not("finished_at", "is", null)
          .order("finished_at", { ascending: true });

      let result = await loadPlacements("participants");
      if (result.error?.code === "PGRST205") {
        result = await loadPlacements("session_students");
      }

      if (!isActive) return;

      if (result.error) {
        console.error("Kunne ikke hente escape-placeringer:", result.error);
        setEscapeResults([]);
        setEscapeResultsError("Placeringen kunne ikke hentes endnu. Prøv igen om et øjeblik.");
        setIsLoadingEscapeResults(false);
        return;
      }

      const rows = Array.isArray(result.data) ? (result.data as ParticipantRow[]) : [];
      const nextResults = rows
        .filter((row) => typeof row.student_name === "string" && row.student_name.trim().length > 0)
        .map((row, index) => ({
          place: index + 1,
          studentName: row.student_name?.trim() ?? `Deltager ${index + 1}`,
          finishedAt: typeof row.finished_at === "string" ? row.finished_at : null,
        }));

      setEscapeResults(nextResults);
      setIsLoadingEscapeResults(false);
    };

    void fetchEscapeResults();

    return () => {
      isActive = false;
    };
  }, [questions, raceMode, sessionId, showEscapeResults, supabase]);

  const shouldKeepScreenAwake =
    !isLoading &&
    !loadError &&
    !gpsError &&
    !isFinished &&
    !isKicked &&
    hasConfirmedName &&
    questions.length > 0;

  useEffect(() => {
    if (typeof document === "undefined") return;

    const wakeLockApi = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!shouldKeepScreenAwake || !wakeLockApi) {
      const activeSentinel = wakeLockSentinelRef.current;
      wakeLockSentinelRef.current = null;
      if (activeSentinel) {
        void activeSentinel.release().catch(() => undefined);
      }
      return;
    }

    let isDisposed = false;

    const requestWakeLock = async () => {
      if (isDisposed || document.visibilityState !== "visible") return;
      try {
        const existingSentinel = wakeLockSentinelRef.current;
        if (existingSentinel && !existingSentinel.released) return;
        const nextSentinel = await wakeLockApi.request("screen");
        if (isDisposed) {
          void nextSentinel.release().catch(() => undefined);
          return;
        }
        wakeLockSentinelRef.current = nextSentinel;
      } catch (error) {
        console.warn("Wake lock kunne ikke aktiveres:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const activeSentinel = wakeLockSentinelRef.current;
      wakeLockSentinelRef.current = null;
      if (activeSentinel) {
        void activeSentinel.release().catch(() => undefined);
      }
    };
  }, [shouldKeepScreenAwake]);

  useEffect(() => {
    if (questions.length === 0 || isFinished || isKicked || !hasConfirmedName || !sessionId) {
      return;
    }

    if (!navigator.geolocation) {
      queueMicrotask(() => {
        setGpsError("unsupported");
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsError(null);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMyLoc({ lat, lng });

        const target = questions[currentPostIndex];
        if (target && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
          const dist = getDistance(lat, lng, target.lat, target.lng);
          setDistance(dist);

          if (
            dist <= AUTO_UNLOCK_RADIUS &&
            !showQuestion &&
            dismissedPostIndex !== currentPostIndex
          ) {
            unlockCurrentPost();
          }

          if (dist > AUTO_UNLOCK_RADIUS && dismissedPostIndex === currentPostIndex) {
            setDismissedPostIndex(null);
          }
        }

        const lastLocationSync = lastLocationSyncRef.current;
        const hasMovedEnough =
          !lastLocationSync ||
          getDistance(lat, lng, lastLocationSync.lat, lastLocationSync.lng) >= LOCATION_SYNC_DISTANCE_METERS;
        const waitedLongEnough =
          !lastLocationSync || Date.now() - lastLocationSync.at >= LOCATION_SYNC_INTERVAL_MS;

        if ((hasMovedEnough || waitedLongEnough) && !isLocationSyncInFlightRef.current) {
          isLocationSyncInFlightRef.current = true;
          lastLocationSyncRef.current = {
            lat,
            lng,
            at: Date.now(),
          };

          try {
            await syncParticipantLocation(lat, lng);
          } finally {
            isLocationSyncInFlightRef.current = false;
          }
        }
      },
      (err) => {
        console.error("GPS Error:", err);
        if (err.code === err.PERMISSION_DENIED || err.code === 1) {
          setGpsError("permission_denied");
          return;
        }

        if (err.code === err.POSITION_UNAVAILABLE || err.code === 2) {
          setGpsError("position_unavailable");
          return;
        }

        if (err.code === err.TIMEOUT || err.code === 3) {
          setGpsError("timeout");
          return;
        }

        setGpsError("timeout");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    questions,
    currentPostIndex,
    sessionId,
    isFinished,
    isKicked,
    hasConfirmedName,
    showQuestion,
    dismissedPostIndex,
    unlockCurrentPost,
    syncParticipantLocation,
  ]);

  useEffect(() => {
    if (!sessionId) return;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const messageChannel = supabase
      .channel(`student-messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const messageRow = payload.new as { is_teacher?: boolean; message?: string | null };
          if (messageRow.is_teacher && messageRow.message) {
            setLatestMessage(messageRow.message);
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => setLatestMessage(null), 8000);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const nextStatus = (payload.new as { status?: string | null })?.status;
          if (nextStatus !== "finished") return;

          clearStoredActiveParticipant();
          setParticipantId(null);
          setShowQuestion(false);
          setIsFinished(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string | number | null })?.id;
          if (!deletedId || !participantId) return;
          if (String(deletedId) !== participantId) return;

          clearStoredActiveParticipant();
          setParticipantId(null);
          setShowQuestion(false);
          setIsKicked(true);
        }
      )
      .subscribe();

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      void supabase.removeChannel(messageChannel);
    };
  }, [participantId, sessionId, supabase]);

  const handleWrongQuizAnswer = useCallback((selectedIndex: number, feedbackKey: string) => {
    if (quizAnswerFeedbackTimerRef.current) {
      clearTimeout(quizAnswerFeedbackTimerRef.current);
    }

    setQuizAnswerFeedback({
      key: feedbackKey,
      selectedIndex,
      tone: "error",
    });
    quizAnswerFeedbackTimerRef.current = setTimeout(() => {
      setQuizAnswerFeedback((currentFeedback) =>
        currentFeedback?.key === feedbackKey && currentFeedback.tone === "error" ? null : currentFeedback
      );
      quizAnswerFeedbackTimerRef.current = null;
    }, 900);
    setTypedAnswerError({
      key: feedbackKey,
      message: "Forkert svar. Prøv igen.",
    });
  }, []);

  const validateAnswerOnServer = useCallback(
    async (payload: { selectedIndex?: number; answer?: string }) => {
      const response = await fetch("/api/play/validate-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          sessionId,
          postIndex: currentPostIndex,
          ...payload,
        }),
      });

      const data = (await response.json().catch(() => null)) as ValidateAnswerPayload | null;
      if (!response.ok) {
        throw new Error(data?.error || "Svaret kunne ikke tjekkes.");
      }

      return data;
    },
    [currentPostIndex, sessionId]
  );

  const handleAnswer = async (
    selectedIndex: number,
    escapeBrick?: string | null,
    options?: { skipAnswerPersist?: boolean }
  ) => {
    const current = questions[currentPostIndex];
    if (!current) return false;

    const postNumber = currentPostIndex + 1;
    const currentVariant = resolvePostVariant(raceMode, current);
    const feedbackKey = `${currentPostIndex}-${currentVariant}`;

    if (quizAnswerFeedbackTimerRef.current) {
      clearTimeout(quizAnswerFeedbackTimerRef.current);
      quizAnswerFeedbackTimerRef.current = null;
    }

    if (currentVariant === "quiz") {
      setQuizAnswerFeedback(null);
    }
    setTypedAnswerError(null);
    setPostActionError(null);

    const didSaveAnswer = options?.skipAnswerPersist
      ? true
      : await insertAnswerRecord(
          selectedIndex,
          true,
          postNumber,
          currentVariant === "roleplay" ? getRoleplayMessage(current) : current.text,
          myLoc?.lat ?? null,
          myLoc?.lng ?? null
        );

    if (!didSaveAnswer) {
      if (currentVariant === "photo") {
        setPhotoFeedback({
          key: feedbackKey,
          tone: "error",
          message: "Netværksfejl - prøv igen",
        });
      } else {
        setTypedAnswerError({
          key: feedbackKey,
          message: "Netværksfejl - prøv igen",
        });
      }
      return false;
    }

    setCorrectAnswersCount((prev) => prev + 1);

    if (currentVariant === "escape") {
      const codeBrick = escapeBrick?.trim() || getEscapeCodeBrick(current, currentPostIndex);
      setCollectedEscapeRewards((prev) =>
        prev.some((entry) => entry.postIndex === currentPostIndex)
          ? prev
          : [...prev, { postIndex: currentPostIndex, brick: codeBrick }].sort((a, b) => a.postIndex - b.postIndex)
      );
      setEscapeReward({
        key: `${currentPostIndex}-escape`,
        brick: codeBrick,
      });
      return true;
    }

    if (currentVariant === "quiz") {
      setQuizAnswerFeedback({
        key: feedbackKey,
        selectedIndex,
        tone: "success",
      });
      return true;
    }

    if (currentVariant === "photo") {
      return true;
    }

    if (currentVariant === "roleplay") {
      const characterName = getRoleplayCharacterName(current);
      setRoleplayReply({
        key: `${currentPostIndex}-roleplay`,
        message: `${characterName}: Godt svaret! Følg med mig videre...`,
      });
      return true;
    }

    return continueFromSolvedPost();
  };

  const activeQuestion = questions[currentPostIndex];
  const activePostVariant = activeQuestion ? resolvePostVariant(raceMode, activeQuestion) : "unknown";
  const activeQuestionDisplayText =
    activeQuestion && activePostVariant !== "unknown"
      ? getQuestionDisplayText(activeQuestion, activePostVariant)
      : activeQuestion?.text ?? "";
  const roleplayCharacterName =
    activePostVariant === "roleplay" && activeQuestion ? getRoleplayCharacterName(activeQuestion) : "";
  const roleplayAvatar = activePostVariant === "roleplay" && activeQuestion ? getRoleplayAvatar(activeQuestion) : "";
  const mapCenter: [number, number] = myLoc
    ? [myLoc.lat, myLoc.lng]
    : activeQuestion
      ? [activeQuestion.lat, activeQuestion.lng]
      : [55.6761, 12.5683];

  const mapKey = `${mapCenter[0].toFixed(4)}-${mapCenter[1].toFixed(4)}-${currentPostIndex}`;
  const canManualUnlock =
    !showQuestion &&
    distance !== null &&
    ((distance > AUTO_UNLOCK_RADIUS && distance <= MANUAL_UNLOCK_RADIUS) ||
      dismissedPostIndex === currentPostIndex);
  const celebrationName = playerName || pendingPlayerName || "Deltager";
  const progressPercent =
    questions.length > 0
      ? Math.max(0, Math.min(100, Math.round((correctAnswersCount / questions.length) * 100)))
      : 0;
  const isEscapeRace =
    raceMode === "escape" ||
    (raceMode === "unknown" &&
      questions.length > 0 &&
      questions.every((question) => resolvePostVariant(raceMode, question) === "escape"));
  const activeDisplayName = playerName || pendingPlayerName || "Deltager";
  const normalizedActiveDisplayName = activeDisplayName.trim().toLocaleLowerCase("da-DK");
  const myEscapePlacement =
    normalizedActiveDisplayName.length > 0
      ? escapeResults.find(
          (entry) =>
            entry.studentName.trim().toLocaleLowerCase("da-DK") === normalizedActiveDisplayName
        ) ?? null
      : null;
  const activeTypedAnswerKey = `${currentPostIndex}-${activePostVariant}`;
  const activeTypedAnswerError =
    typedAnswerError?.key === activeTypedAnswerKey ? typedAnswerError.message : null;
  const activePostActionError =
    postActionError?.key === activeTypedAnswerKey ? postActionError.message : null;
  const activePhotoFeedback = photoFeedback?.key === activeTypedAnswerKey ? photoFeedback : null;
  const activeQuizAnswerFeedback =
    quizAnswerFeedback?.key === activeTypedAnswerKey ? quizAnswerFeedback : null;
  const hasActiveQuizSuccess = activePostVariant === "quiz" && activeQuizAnswerFeedback?.tone === "success";
  const hasActivePhotoSuccess = activePhotoFeedback?.tone === "success";
  const isSelfiePhotoTask = activePostVariant === "photo" && activeQuestion?.isSelfie === true;
  const activeEscapeReward = escapeReward?.key === activeTypedAnswerKey ? escapeReward.brick : null;
  const activeRoleplayReply = roleplayReply?.key === activeTypedAnswerKey ? roleplayReply.message : null;
  const activeEscapeHint =
    activePostVariant === "escape" && wrongAttempts >= 3 ? activeQuestion?.hint?.trim() ?? "" : "";
  const isRoleplayImmersed = showQuestion && activePostVariant === "roleplay";
  const collectedEscapeRewardsCount = collectedEscapeRewards.length;
  const hasAllEscapeBricks = isEscapeRace && questions.length > 0 && collectedEscapeRewardsCount >= questions.length;
  const escapeCodeByPostIndex = new Map(
    collectedEscapeRewards.map((entry) => [entry.postIndex, entry.brick] as const)
  );
  const escapeCodeOverview = isEscapeRace
    ? questions.map((_, index) => escapeCodeByPostIndex.get(index) ?? "_")
    : [];
  const escapeCodeOverviewText = escapeCodeOverview.join(" ");
  const gpsErrorContent =
    gpsError === "permission_denied"
      ? {
          title: "Hov! GPS-adgang mangler 🛑",
          message:
            "Du har afvist GPS-adgang. På iPhone: Tryk på 'Aa' i adressebaren for at tillade. På Android/Chrome: Tryk på hængelåsen ved siden af webadressen.",
          helper: "Når GPS-adgangen er tilladt, kan løbet finde dine poster igen.",
        }
      : gpsError === "position_unavailable"
        ? {
            title: "Vi kan ikke finde dig præcist endnu 📍",
            message:
              "Vi kan ikke finde din præcise placering lige nu. Sørg for at du er udenfor og har frit udsyn til himlen.",
            helper: "Prøv at bevæge dig et øjeblik og vent et par sekunder, så finder GPS'en ofte signal igen.",
          }
        : gpsError === "unsupported"
          ? {
              title: "GPS er ikke tilgængelig på denne enhed",
              message:
                "Din browser eller enhed giver ikke adgang til GPS her. Prøv i en nyere mobilbrowser med lokalitet slået til.",
              helper: "Åbn siden i Safari på iPhone eller Chrome på Android og prøv igen.",
            }
          : {
              title: "GPS'en svarer for langsomt ⏳",
              message:
                "GPS-søgningen tog for lang tid. Tjek din internetforbindelse og prøv igen.",
              helper: "Det hjælper ofte at genindlæse siden og stå et sted med bedre signal.",
            };

  useEffect(() => {
    if (!isRoleplayImmersed || activeRoleplayReply) return;

    const timeoutId = window.setTimeout(() => {
      typedAnswerInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeRoleplayReply, activeTypedAnswerKey, isRoleplayImmersed]);

  useEffect(() => {
    setWrongAttempts(0);
  }, [currentPostIndex]);

  const continueFromSolvedPost = async () => {
    clearRoleplayInputErrorTone();
    setPostActionError(null);
    if (currentPostIndex + 1 < questions.length) {
      setDismissedPostIndex(null);
      setPhotoFeedback(null);
      setQuizAnswerFeedback(null);
      setTypedAnswerError(null);
      setEscapeReward(null);
      setRoleplayReply(null);
      setWrongAttempts(0);
      setShowQuestion(false);
      setDistance(null);
      setCurrentPostIndex((prev) => prev + 1);
      return true;
    }

    if (!isEscapeRace) {
      const didFinish = await markParticipantFinished();
      if (!didFinish) {
        setPostActionError({
          key: activeTypedAnswerKey,
          message: "Netværksfejl - prøv igen",
        });
        return false;
      }
    }

    setDismissedPostIndex(null);
    setPhotoFeedback(null);
    setQuizAnswerFeedback(null);
    setTypedAnswerError(null);
    setEscapeReward(null);
    setRoleplayReply(null);
    setWrongAttempts(0);
    setShowQuestion(false);
    setDistance(null);
    setIsFinished(true);
    return true;
  };

  const handleMasterLockSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedInput = normalizeMasterCode(masterLockInput);
    if (!normalizedInput) {
      setMasterLockError("Indtast master-koden fra dine kode-brikker først.");
      setMasterLockShakeNonce((prev) => prev + 1);
      return;
    }

    setMasterLockError(null);
    setShowMasterVictory(false);
    setIsFinalizingEscape(true);

    try {
      const response = await fetch("/api/play/validate-master", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          sessionId,
          masterCode: normalizedInput,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { isCorrect?: boolean; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Master-koden kunne ikke tjekkes.");
      }

      if (payload?.isCorrect !== true) {
        setMasterLockError("Forkert kode - prøv igen.");
        setMasterLockStatus("locked");
        setMasterLockShakeNonce((prev) => prev + 1);
        return;
      }

      const didFinish = await markParticipantFinished();
      if (!didFinish) {
        setMasterLockError("Netværksfejl - prøv igen");
        setMasterLockStatus("locked");
        setMasterLockShakeNonce((prev) => prev + 1);
        return;
      }
      setMasterLockStatus("unlocked");
      setShowMasterVictory(true);
      if (masterVictoryTimerRef.current) {
        clearTimeout(masterVictoryTimerRef.current);
      }
      masterVictoryTimerRef.current = setTimeout(() => {
        setShowEscapeResults(true);
        masterVictoryTimerRef.current = null;
      }, 2200);
    } catch (error) {
      console.error("Master-lås kunne ikke valideres:", error);
      setMasterLockError("Master-låsen kunne ikke tjekkes lige nu. Prøv igen.");
      setMasterLockStatus("locked");
      setMasterLockShakeNonce((prev) => prev + 1);
    } finally {
      setIsFinalizingEscape(false);
    }
  };

  const handleTypedAnswerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeQuestion || activePostVariant === "photo" || activePostVariant === "quiz") return;

    const typedAnswer = typedAnswerInputRef.current?.value ?? "";
    if (!typedAnswer.trim()) {
      setTypedAnswerError(
        activePostVariant === "roleplay"
          ? { key: activeTypedAnswerKey, message: "Skriv et svar til karakteren først." }
          : activePostVariant === "escape"
            ? { key: activeTypedAnswerKey, message: "Skriv svaret først." }
            : { key: activeTypedAnswerKey, message: "Indtast svaret, før du bekræfter." }
      );
      return;
    }

    setTypedAnswerError(null);
    setPostActionError(null);

    if (activePostVariant === "escape") {
      setIsCheckingEscapeAnswer(true);
    } else {
      setIsSubmittingAnswer(true);
    }

    try {
      const payload = await validateAnswerOnServer({ answer: typedAnswer });

      if (payload?.isCorrect !== true) {
        if (activePostVariant === "roleplay") {
          triggerRoleplayInputError();
        }
        if (activePostVariant === "escape") {
          setWrongAttempts((current) => current + 1);
        }
        setTypedAnswerError(
          activePostVariant === "roleplay"
            ? {
                key: activeTypedAnswerKey,
                message: `${roleplayCharacterName || "Karakteren"} ser uforstående ud. Prøv igen.`,
              }
            : { key: activeTypedAnswerKey, message: "Svaret passer ikke endnu. Prøv igen." }
        );
        return;
      }

      clearRoleplayInputErrorTone();
      if (activePostVariant === "escape") {
        setWrongAttempts(0);
      }
      await handleAnswer(0, payload?.brick ?? null);
    } catch (error) {
      console.error("Kunne ikke validere svar:", error);
      setTypedAnswerError({
        key: activeTypedAnswerKey,
        message: "Netværksfejl - prøv igen",
      });
    } finally {
      if (activePostVariant === "escape") {
        setIsCheckingEscapeAnswer(false);
      } else {
        setIsSubmittingAnswer(false);
      }
    }
  };

  const handlePhotoCapture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !activeQuestion || activePostVariant !== "photo" || isAnalyzingPhoto || !sessionId) return;
    const isSelfie = activeQuestion.isSelfie === true;

    setPhotoFeedback(null);
    setPostActionError(null);
    setIsAnalyzingPhoto(true);

    try {
      const image = await readFileAsDataUri(file);
      const activeStudentName = playerName.trim() || pendingPlayerName.trim();
      const response = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image,
          sessionId,
          postIndex: currentPostIndex,
          studentName: activeStudentName,
        }),
      });

      const payload = (await response.json()) as {
        isMatch?: boolean;
        message?: string;
        imageUrl?: string | null;
        storedAnswer?: boolean;
        error?: string;
      };

      if (!response.ok || typeof payload.isMatch !== "boolean" || typeof payload.message !== "string") {
        throw new Error(payload.error || "Ugyldigt svar fra billedanalysen.");
      }

      if (!isMountedRef.current) return;

      if (!payload.isMatch) {
        setIsAnalyzingPhoto(false);
        setPhotoFeedback({
          key: activeTypedAnswerKey,
          tone: "error",
          message: formatPhotoFailureMessage(payload.message, isSelfie),
        });
        return;
      }

      const didSaveAnswer = await handleAnswer(0, null, {
        skipAnswerPersist: payload.storedAnswer === true,
      });
      if (!didSaveAnswer) {
        setIsAnalyzingPhoto(false);
        return;
      }
      if (!isMountedRef.current) return;

      setPhotoFeedback({
        key: activeTypedAnswerKey,
        tone: "success",
        message: isSelfie ? `Selfie godkendt! ${payload.message}` : payload.message,
      });
      setIsAnalyzingPhoto(false);
    } catch (error) {
      console.error("Fotoanalyse fejlede:", error);
      if (!isMountedRef.current) return;
      setIsAnalyzingPhoto(false);
      setPhotoFeedback({
        key: activeTypedAnswerKey,
        tone: "error",
        message: isSelfie
          ? "Vi kunne ikke læse selfien helt endnu. Prøv igen med bedre lys og få både ansigt og baggrund tydeligt med."
          : "Ups, AI'en er lidt træt. Prøv at tage billedet igen.",
      });
    }
  };

  /* const targetIcon = useMemo(
    () =>
      L.divIcon({
        className: "bg-transparent border-none",
        html: '<div class="relative w-8 h-8"><div class="absolute inset-0 rounded-full bg-amber-300/20 animate-ping"></div><div class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-950 text-amber-100 font-black shadow-[0_0_18px_rgba(251,191,36,0.8)]">◎</div></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    []
  );

  ); */

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-emerald-200">
        <div className="text-center">
          <Crosshair className="mx-auto mb-3 h-8 w-8 animate-pulse" />
          <p className="text-sm uppercase tracking-widest">Indlæser mission...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="max-w-md rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 backdrop-blur-xl">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-300" />
          <p className={`font-semibold ${wrapTextClass}`}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (isKicked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-red-950 via-[#2a0606] to-[#130303] px-6 text-white">
        <div className="w-full max-w-2xl rounded-3xl border border-red-400/40 bg-red-900/20 p-8 text-center shadow-[0_0_40px_rgba(239,68,68,0.25)] backdrop-blur-md">
          <h1 className="text-3xl font-black md:text-4xl">
            🚫 Du er blevet fjernet fra løbet af arrangøren.
          </h1>
        </div>
      </div>
    );
  }

  if (!hasConfirmedName && !isFinished) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <form
          onSubmit={handleNameSubmit}
          className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_28px_rgba(16,185,129,0.18)] backdrop-blur-xl"
        >
          <h1 className="mb-5 text-2xl font-black tracking-wide uppercase">Klar til at starte?</h1>
          <label htmlFor="player-name" className="mb-2 block text-sm font-semibold text-emerald-100">
            Dit navn
          </label>
          <input
            id="player-name"
            type="text"
            value={pendingPlayerName}
            onChange={(event) => {
              setPendingPlayerName(event.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="Dit navn"
            className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-base text-white placeholder:text-white/45 focus:border-emerald-400/60 focus:outline-none"
          />
          <p className={`mt-3 text-sm text-white/80 ${wrapTextClass}`}>
            Skriv dit rigtige navn. Brug ikke et opdigtet navn.
          </p>
          {nameError ? (
            <div className={`mt-4 rounded-xl border border-red-400/50 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100 ${wrapTextClass}`}>
              {nameError}
            </div>
          ) : null}
          <button
            type="submit"
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-400 to-sky-400 px-4 py-3 text-base font-black tracking-wide text-[#03110d] uppercase transition-transform hover:scale-[1.01]"
          >
            Start Løb
          </button>
        </form>
      </div>
    );
  }

  if (gpsError && !isFinished) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-red-950 via-[#2a0606] to-[#130303] px-6 text-white">
        <div className="w-full max-w-2xl rounded-3xl border border-red-400/40 bg-red-900/20 p-8 shadow-[0_0_40px_rgba(239,68,68,0.25)] backdrop-blur-md">
          <div className="mb-4 flex items-center gap-3 text-red-200">
            <AlertCircle className="h-7 w-7" />
            <h1 className={`text-2xl font-black md:text-3xl ${wrapTextClass}`}>
              {gpsErrorContent.title}
            </h1>
          </div>
          <p className={`mb-5 text-red-50 ${wrapTextClass}`}>
            {gpsErrorContent.message}
          </p>
          <p className={`text-sm text-red-100/90 ${wrapTextClass}`}>{gpsErrorContent.helper}</p>
          <button
            type="button"
            onClick={reloadPage}
            className="mt-7 rounded-xl border border-red-200/60 bg-red-100 px-5 py-3 font-bold text-red-900 transition-colors hover:bg-white"
          >
            Prøv igen
          </button>
        </div>
      </div>
    );
  }

  if (isFinished && isEscapeRace && correctAnswersCount >= questions.length && !showEscapeResults) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.24),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.72)_0%,rgba(2,6,23,0.94)_52%,rgba(2,6,23,1)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(120,53,15,0.42),transparent_38%)] blur-2xl" />

        {masterLockStatus === "unlocked" ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 16 }).map((_, index) => (
              <span
                key={`master-lock-spark-${index}`}
                className="absolute h-3 w-3 rounded-full bg-gradient-to-br from-amber-200 via-yellow-300 to-orange-400 opacity-0 animate-[master-lock-spark_1.2s_ease-out_forwards]"
                style={{
                  top: `${18 + (index % 5) * 12}%`,
                  left: `${10 + (index * 6) % 80}%`,
                  animationDelay: `${(index % 8) * 0.08}s`,
                }}
              />
            ))}
          </div>
        ) : null}

        <div
          key={`master-lock-${masterLockStatus}-${masterLockShakeNonce}`}
          className={`relative z-10 w-full max-w-xl overflow-hidden rounded-[2rem] border p-8 shadow-[0_30px_90px_rgba(2,6,23,0.55)] backdrop-blur-xl ${
            masterLockStatus === "unlocked"
              ? "border-amber-300/40 bg-amber-900/30"
              : `${masterLockError ? "animate-[master-lock-shake_0.45s_ease-in-out]" : ""} border-white/10 bg-slate-900/80`
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_32%)]" />

          {showMasterVictory ? (
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.16),transparent_42%)]" />
              <div className="absolute inset-0 opacity-90">
                <LottiePlayer autoplay loop src={FIREWORKS_LOTTIE_URL} style={{ width: "100%", height: "100%" }} />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <div className="h-36 w-36 drop-shadow-[0_0_35px_rgba(251,191,36,0.45)]">
                  <Lottie animationData={trophyAnimation} loop={true} />
                </div>
                <p className="mt-4 text-xs font-semibold tracking-[0.32em] text-amber-200/80 uppercase">
                  Vinder-fejring
                </p>
                <h2 className="mt-3 text-3xl font-black text-amber-50">Master-låsen er brudt op!</h2>
                <p className="mt-3 text-sm font-semibold text-amber-100/90">
                  Resultatet gøres klar...
                </p>
              </div>
            </div>
          ) : null}

          <div className="relative text-center">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 text-6xl shadow-[0_0_35px_rgba(245,158,11,0.18)]">
              🔒
            </div>

            <p className="mt-6 text-xs font-semibold tracking-[0.32em] text-amber-200/80 uppercase">
              Master-lås
            </p>
            <h1 className="mt-3 break-words text-3xl font-black text-white md:text-4xl">
              Du er næsten i mål!
            </h1>
            <p className="mt-4 break-words text-base leading-relaxed text-amber-50/88">
              Indtast den samlede Master-kode fra alle posterne for at vinde løbet.
            </p>
            <p className="mt-3 text-sm text-white/70">
              Kode-brikker samlet: {correctAnswersCount}/{questions.length}
            </p>

            {hasAllEscapeBricks ? (
              <div className="mt-6 rounded-[1.6rem] border border-emerald-300/25 bg-emerald-500/10 px-5 py-4 text-left shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-200">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.28em] text-emerald-200/70 uppercase">
                      Klar til at vinde
                    </p>
                    <p className={`mt-2 text-base font-bold text-emerald-50 ${wrapTextClass}`}>
                      Alle kode-brikker er fundet. Indtast master-koden for at vinde løbet.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-8 rounded-[1.75rem] border border-amber-500/25 bg-amber-900/25 p-5 text-left">
              <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                Deltager
              </p>
              <p className={`mt-2 text-xl font-black text-amber-50 ${wrapTextClass}`}>
                {activeDisplayName}
              </p>
            </div>

            <div className="mt-4 rounded-[1.75rem] border border-amber-500/25 bg-amber-900/20 p-5 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-amber-100">
                  <KeyRound className="h-4 w-4" />
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                    Kode-oversigt
                  </p>
                </div>
                <p className="text-xs font-bold text-amber-50">
                  {collectedEscapeRewardsCount}/{questions.length}
                </p>
              </div>

              <p className="mt-4 text-sm text-amber-100/75">Dine brikker</p>
              <p
                className={`mt-3 rounded-2xl border border-amber-300/12 bg-black/20 px-4 py-4 text-center text-2xl font-black tracking-[0.34em] text-amber-100 ${wrapTextClass}`}
              >
                {escapeCodeOverviewText}
              </p>
            </div>

            <form onSubmit={handleMasterLockSubmit} className="mt-6 space-y-4">
              <input
                type="text"
                value={masterLockInput}
                disabled={masterLockStatus === "unlocked" || isFinalizingEscape}
                onChange={(event) => {
                  setMasterLockInput(event.target.value.toLocaleUpperCase("da-DK"));
                  if (masterLockError) setMasterLockError(null);
                }}
                placeholder="Indtast hele master-koden"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-center text-2xl font-black tracking-[0.35em] text-amber-50 outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-default disabled:opacity-80"
              />

              {masterLockError ? (
                <div className={`rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 ${wrapTextClass}`}>
                  {masterLockError}
                </div>
              ) : null}

              {masterLockStatus === "unlocked" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-50">
                    Låsen giver efter! Resultatet venter lige foran dig.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEscapeResults(true)}
                    disabled={showMasterVictory}
                    className="w-full rounded-2xl bg-amber-400 px-5 py-4 text-base font-black tracking-[0.24em] text-slate-950 uppercase transition hover:bg-amber-300"
                  >
                    Se din placering
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={isFinalizingEscape}
                  className="w-full rounded-2xl border border-amber-400/30 bg-amber-400/90 px-5 py-4 text-base font-black tracking-[0.24em] text-slate-950 uppercase transition hover:bg-amber-300"
                >
                  {isFinalizingEscape ? "Åbner låsen..." : "Bryd låsen op"}
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isFinished && isEscapeRace && showEscapeResults) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.2),transparent_30%),radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(139,92,246,0.12),transparent_24%),linear-gradient(180deg,rgba(3,7,18,0.78)_0%,rgba(2,6,23,0.92)_55%,rgba(2,6,23,1)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(120,53,15,0.4),transparent_36%)] blur-3xl" />

        <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/78 p-8 shadow-[0_32px_90px_rgba(2,6,23,0.56)] backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_28%)]" />

          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-[0.32em] text-amber-200/70 uppercase">
                  Escape-finale
                </p>
                <h1 className={`mt-3 text-3xl font-black text-white sm:text-4xl ${wrapTextClass}`}>
                  Du klarede det!
                </h1>
                <p className={`mt-4 text-base leading-7 text-amber-50/85 sm:text-lg ${wrapTextClass}`}>
                  Her er placeringen, nu hvor master-låsen er brudt op og målgangen er registreret.
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-amber-300/20 bg-amber-500/10 px-5 py-4 text-left shadow-[0_18px_40px_rgba(245,158,11,0.12)]">
                <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                  Deltager
                </p>
                <p className={`mt-2 text-xl font-black text-amber-50 ${wrapTextClass}`}>
                  {activeDisplayName}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr,1.3fr]">
              <div className="rounded-[1.8rem] border border-emerald-300/18 bg-emerald-950/35 p-6 shadow-[0_20px_45px_rgba(16,185,129,0.12)] backdrop-blur-xl">
                <p className="text-xs font-semibold tracking-[0.26em] text-emerald-200/70 uppercase">
                  Jeres placering
                </p>

                {isLoadingEscapeResults ? (
                  <div className="mt-5 flex items-center gap-3 text-emerald-100/80">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className={wrapTextClass}>Henter ranglisten...</span>
                  </div>
                ) : myEscapePlacement ? (
                  <>
                    <p className="mt-4 text-5xl font-black text-emerald-200">
                      {formatPlacement(myEscapePlacement.place)}
                    </p>
                    <p className={`mt-3 text-sm text-emerald-50/80 ${wrapTextClass}`}>
                      Registreret kl. {formatFinishedAt(myEscapePlacement.finishedAt)}
                    </p>
                  </>
                ) : (
                  <p className={`mt-4 text-sm text-emerald-50/80 ${wrapTextClass}`}>
                    Jeres placering bliver opdateret, så snart målgangen er synkroniseret.
                  </p>
                )}
              </div>

              <div className="rounded-[1.8rem] border border-violet-300/18 bg-violet-950/24 p-6 shadow-[0_20px_45px_rgba(91,33,182,0.14)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold tracking-[0.26em] text-violet-200/70 uppercase">
                    Rangliste
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-white/60 uppercase">
                    {escapeResults.length} deltagere
                  </span>
                </div>

                {isLoadingEscapeResults ? (
                  <div className="mt-5 flex items-center gap-3 text-violet-100/80">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className={wrapTextClass}>Henter placeringer...</span>
                  </div>
                ) : escapeResultsError ? (
                  <div className="mt-5 rounded-[1.35rem] border border-rose-300/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                    <p className={wrapTextClass}>{escapeResultsError}</p>
                  </div>
                ) : escapeResults.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {escapeResults.map((entry) => {
                      const isCurrentTeam =
                        entry.studentName.trim().toLocaleLowerCase("da-DK") ===
                        normalizedActiveDisplayName;

                      return (
                        <div
                          key={`${entry.studentName}-${entry.place}`}
                          className={`rounded-[1.35rem] border px-4 py-3 backdrop-blur-md ${
                            isCurrentTeam
                              ? "border-amber-300/30 bg-amber-500/12 shadow-[0_16px_34px_rgba(245,158,11,0.12)]"
                              : "border-white/10 bg-black/18"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold tracking-[0.22em] text-white/45 uppercase">
                                {formatPlacement(entry.place)}
                              </p>
                              <p className={`mt-1 text-lg font-black text-white ${wrapTextClass}`}>
                                {entry.studentName}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-amber-100/80">
                              {formatFinishedAt(entry.finishedAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`mt-5 text-sm text-violet-100/80 ${wrapTextClass}`}>
                    Ingen placeringer er registreret endnu.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4 text-sm text-amber-50/85 backdrop-blur-xl">
              <p className={wrapTextClass}>
                Kig op på arrangørens skærm, hvis I også vil se den store fælles finale.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.25),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(circle_at_50%_90%,rgba(139,92,246,0.16),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <LottiePlayer
            autoplay
            loop
            src={FIREWORKS_LOTTIE_URL}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, index) => (
            <span
              key={`student-confetti-${index}`}
              className="absolute h-2.5 w-2.5 animate-pulse rounded-full bg-gradient-to-br from-amber-300 via-emerald-300 to-violet-300 shadow-[0_0_10px_rgba(255,255,255,0.35)]"
              style={{
                top: `${(index * 29) % 100}%`,
                left: `${(index * 17) % 100}%`,
                animationDelay: `${(index % 8) * 0.22}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 mt-10 w-full max-w-lg rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-[0_0_45px_rgba(251,191,36,0.3)] backdrop-blur-xl">
          <div className="mx-auto mb-6 h-36 w-36 drop-shadow-2xl">
            <Lottie animationData={trophyAnimation} loop={true} />
          </div>
          <h1 className="mb-2 bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 bg-clip-text text-4xl font-black tracking-widest text-transparent uppercase">
            Mission
            <br />
            Fuldført!
          </h1>
          <p className={`mb-3 text-lg font-bold text-emerald-100 ${wrapTextClass}`}>
            Fantastisk gået, {playerName || "mester"}!
          </p>
          <p className={`mb-6 text-sm font-semibold tracking-wide text-amber-100 uppercase ${wrapTextClass}`}>
            KÆMPE TILLYKKE, {celebrationName}! Du er i mål!
          </p>
          <div className="rounded-xl border border-white/20 bg-black/35 px-4 py-3 text-sm font-medium text-slate-100">
            Løbet er slut. Kig op på arrangørens skærm og se den store podie-fejring!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_80%_8%,rgba(34,197,94,0.1),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.92)_52%,rgba(2,6,23,1)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_60%)]" />

      <div
        className={`absolute top-4 right-4 left-4 z-[1000] space-y-4 transition-all duration-300 ${
          isRoleplayImmersed ? "pointer-events-none opacity-0 blur-md" : "opacity-100"
        }`}
      >
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl md:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_30%)]" />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.28em] text-emerald-200/85 uppercase">
                    Deltager
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-white/60 uppercase">
                    Nature-Glass
                  </span>
                </div>

                {isEscapeRace ? (
                  <div className="overflow-hidden rounded-[1.6rem] border border-amber-300/20 bg-amber-500/10 p-4 shadow-[0_0_24px_rgba(245,158,11,0.14)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-amber-100">
                        <KeyRound className="h-4 w-4" />
                        <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                          Kode-oversigt
                        </p>
                      </div>
                      <span className="rounded-full border border-amber-300/20 bg-amber-950/60 px-3 py-1 text-xs font-bold text-amber-100">
                        {collectedEscapeRewardsCount}/{questions.length}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-amber-50/80">Dine brikker</p>
                    <p className={`mt-2 text-xl font-black tracking-[0.3em] text-amber-200 ${wrapTextClass}`}>
                      {escapeCodeOverviewText}
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-[1.35fr,1fr]">
                  <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <p className="text-[11px] font-semibold tracking-[0.28em] text-white/45 uppercase">
                      Deltagernavn
                    </p>
                    <p className={`mt-2 text-2xl font-black text-white ${wrapTextClass}`}>
                      {activeDisplayName}
                    </p>
                    <p className="mt-2 text-sm text-emerald-100/70">
                      Find post {currentPostIndex + 1} af {questions.length}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <p className="text-[11px] font-semibold tracking-[0.28em] text-white/45 uppercase">
                      Afstand
                    </p>
                    <p
                      className={`mt-2 text-3xl font-black ${
                        distance !== null && distance <= AUTO_UNLOCK_RADIUS
                          ? "text-emerald-400"
                          : "text-white"
                      }`}
                    >
                      {distance !== null ? `${distance}m` : "Søger GPS..."}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      GPS låser automatisk op tæt på posten.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.28em] text-white/45 uppercase">
                        Fremskridt
                      </p>
                      <p className="mt-1 text-sm text-white/75">
                        Du er {progressPercent}% gennem ruten.
                      </p>
                    </div>
                    <p className="text-sm font-bold text-emerald-200">
                      {correctAnswersCount}/{questions.length}
                    </p>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.35)] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                {!isEscapeRace ? (
                  <div className="inline-flex items-center gap-3 self-start rounded-[1.75rem] border border-emerald-300/20 bg-emerald-500/10 px-3 py-3 shadow-[0_0_24px_rgba(16,185,129,0.16)] md:self-auto">
                    <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-white/10 bg-slate-950/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <div className="text-center">
                        <p className="text-[10px] font-semibold tracking-[0.24em] text-emerald-200/65 uppercase">
                          Point
                        </p>
                        <p className="text-3xl font-black text-emerald-400">{correctAnswersCount}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.24em] text-emerald-100/55 uppercase">
                        Medalje
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white/85">
                        Din score vokser for hver fundet post.
                      </p>
                    </div>
                  </div>
                ) : null}

                {canManualUnlock ? (
                  <button
                    type="button"
                    onClick={unlockCurrentPost}
                    className="rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-xs font-bold tracking-[0.2em] text-amber-100 uppercase transition-colors hover:bg-amber-400/20"
                  >
                    {dismissedPostIndex === currentPostIndex
                      ? "Åbn gåden igen"
                      : "📍 Står du ved posten? Lås op manuelt"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {latestMessage ? (
          <div className="animate-in slide-in-from-top fade-in duration-500">
            <div className="flex items-start gap-3 rounded-[1.5rem] border border-white/10 bg-slate-900/78 p-4 shadow-[0_18px_40px_rgba(14,165,233,0.14)] backdrop-blur-xl">
              <div className="mt-0.5 rounded-full border border-sky-400/20 bg-sky-400/10 p-2 text-sky-300">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <div className="mb-1 text-xs font-bold tracking-[0.24em] text-sky-300/80 uppercase">
                  Besked fra arrangøren
                </div>
                <div className={`text-sm font-medium text-white ${wrapTextClass}`}>{latestMessage}</div>
              </div>
            </div>
          </div>
        ) : null}

        {resumeMessage ? (
          <div className="animate-in slide-in-from-top fade-in duration-500">
            <div className="flex items-start gap-3 rounded-[1.5rem] border border-white/10 bg-slate-900/78 p-4 shadow-[0_18px_40px_rgba(16,185,129,0.14)] backdrop-blur-xl">
              <div className="mt-0.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className={`text-sm font-medium text-white ${wrapTextClass}`}>{resumeMessage}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={`pointer-events-none absolute right-4 bottom-20 left-4 z-[950] flex justify-center transition-all duration-300 ${
          isRoleplayImmersed ? "opacity-0 blur-md" : "opacity-100"
        }`}
      >
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/78 px-4 py-3 text-center text-xs font-semibold text-amber-50 shadow-[0_18px_40px_rgba(245,158,11,0.12)] backdrop-blur-xl">
          <span className="text-amber-300">Tip:</span> Hold skærmen tændt mens du går, så
          arrangøren kan se dig på kortet!
        </div>
      </div>

      <div
        className={`relative z-0 flex-1 transition-all duration-300 ${
          isRoleplayImmersed ? "pointer-events-none opacity-0 blur-xl" : "opacity-100"
        }`}
      >
        {typeof window !== "undefined" ? (
          <MapContainer
            key={mapKey}
            center={mapCenter}
            zoom={17}
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

            {activeQuestion && targetIcon ? (
              <Marker position={[activeQuestion.lat, activeQuestion.lng]} icon={targetIcon}>
                <Popup>
                  <div className={`text-sm ${wrapTextClass}`}>
                    <div className="mb-1 flex items-center gap-2 font-semibold text-amber-600">
                      <MapPin className="h-4 w-4" />
                      Næste post
                    </div>
                    {activeQuestionDisplayText}
                  </div>
                </Popup>
              </Marker>
            ) : null}

            {myLoc && playerIcon ? (
              <Marker position={[myLoc.lat, myLoc.lng]} icon={playerIcon}>
                <Popup>Du er her{playerName ? `, ${playerName}` : ""}</Popup>
              </Marker>
            ) : null}
          </MapContainer>
        ) : null}

        <div className="pointer-events-none absolute right-4 bottom-6 left-4 z-[900] flex justify-center">
          <div className="rounded-full border border-white/10 bg-slate-900/78 px-3 py-2 text-xs text-emerald-100/80 shadow-[0_18px_30px_rgba(15,23,42,0.4)] backdrop-blur-md">
            Hold kursen mod den ravgule markør
          </div>
        </div>
      </div>

      {showQuestion && activeQuestion ? (
        <div className="animate-in fade-in zoom-in absolute inset-0 z-[2000] flex flex-col items-center justify-center overflow-y-auto bg-slate-950/90 p-6 backdrop-blur-xl duration-300">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-slate-950/80 p-8 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl">
            {activePostVariant === "escape" ? (
              <div className="mb-6">
                <h2 className={`text-2xl font-black text-white ${wrapTextClass}`}>
                  Løs gåden for at få en kode-brik
                </h2>
              </div>
            ) : null}

            {activeQuestion.mediaUrl && activePostVariant !== "escape" && activePostVariant !== "photo" ? (
              <div className="mb-5 overflow-hidden rounded-xl border border-white/15">
                <Image
                  src={activeQuestion.mediaUrl}
                  alt="Spørgsmålsmedie"
                  width={800}
                  height={450}
                  className="h-auto w-full object-cover"
                  unoptimized
                  loader={({ src }) => src}
                />
              </div>
            ) : null}

            {activePostVariant === "quiz" ? (
              <>
                <p className={`mb-6 text-2xl font-black text-white ${wrapTextClass}`}>{activeQuestion.text}</p>

                <div className="space-y-3">
                  {activeQuestion.answers.map((answer: string, idx: number) => (
                    (() => {
                      const isSelectedFeedback = activeQuizAnswerFeedback?.selectedIndex === idx;
                      const isSuccessAnswer = isSelectedFeedback && activeQuizAnswerFeedback?.tone === "success";
                      const isErrorAnswer = isSelectedFeedback && activeQuizAnswerFeedback?.tone === "error";

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={Boolean(hasActiveQuizSuccess) || isSubmittingAnswer}
                          onClick={async () => {
                            if (activeTypedAnswerError) setTypedAnswerError(null);
                            if (activePostActionError) setPostActionError(null);
                            setIsSubmittingAnswer(true);

                            try {
                              const payload = await validateAnswerOnServer({ selectedIndex: idx });
                              if (payload?.isCorrect === true) {
                                await handleAnswer(idx);
                              } else {
                                handleWrongQuizAnswer(idx, activeTypedAnswerKey);
                              }
                            } catch (error) {
                              console.error("Kunne ikke validere quiz-svar:", error);
                              setTypedAnswerError({
                                key: activeTypedAnswerKey,
                                message: "Netværksfejl - prøv igen",
                              });
                            } finally {
                              setIsSubmittingAnswer(false);
                            }
                          }}
                          className={`w-full overflow-hidden rounded-2xl border p-4 text-left font-semibold transition-all ${wrapTextClass} ${
                            isSuccessAnswer
                              ? "border-emerald-600 bg-emerald-500 text-white shadow-[0_18px_38px_rgba(16,185,129,0.3)]"
                              : isErrorAnswer
                                ? "border-rose-400/60 bg-rose-500/18 text-rose-50 shadow-[0_14px_30px_rgba(244,63,94,0.18)]"
                                : "border-white/10 bg-white/5 text-white hover:border-emerald-400/50 hover:bg-emerald-500/18"
                          } disabled:cursor-default disabled:hover:border-emerald-600 disabled:hover:bg-emerald-500`}
                        >
                          {answer}
                        </button>
                      );
                    })()
                  ))}
                </div>

                {hasActiveQuizSuccess ? (
                  <div className="mt-4 space-y-4">
                    <div className="overflow-hidden rounded-[1.9rem] border border-emerald-300/35 bg-[linear-gradient(145deg,rgba(6,95,70,0.78),rgba(16,185,129,0.2))] p-6 text-center text-emerald-50 shadow-[0_26px_55px_rgba(16,185,129,0.2)] backdrop-blur-md">
                      <p className="text-xs font-semibold tracking-[0.24em] text-emerald-100/75 uppercase">
                        Godkendt
                      </p>
                      <p className={`mt-3 text-xl font-bold text-white ${wrapTextClass}`}>
                        Korrekt! Godt gået 🎉
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void continueFromSolvedPost()}
                      className="w-full rounded-2xl border border-emerald-300/40 bg-emerald-400 px-5 py-3 text-sm font-black tracking-[0.2em] text-slate-950 uppercase transition hover:bg-emerald-300"
                    >
                      {currentPostIndex + 1 < questions.length ? "Gå til næste post" : "Se resultat"}
                    </button>

                    {activePostActionError ? (
                      <div
                        className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                      >
                        {activePostActionError}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeTypedAnswerError ? (
                  <div
                    className={`mt-4 rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                  >
                    {activeTypedAnswerError}
                  </div>
                ) : null}
              </>
            ) : null}

            {activePostVariant === "photo" ? (
              <div className="space-y-5 overflow-hidden">
                <p className={`text-2xl font-black text-white sm:text-3xl ${wrapTextClass}`}>
                  {activeQuestion.text}
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture={isSelfiePhotoTask ? "user" : "environment"}
                  onChange={handlePhotoCapture}
                  className="hidden"
                />

                {!hasActivePhotoSuccess ? (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isAnalyzingPhoto}
                    className="inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-sky-500 px-6 py-4 text-lg font-black text-slate-950 break-words hyphens-auto shadow-[0_24px_45px_rgba(14,165,233,0.22)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-400/60"
                  >
                    {isAnalyzingPhoto ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        AI analyserer billedet...
                      </>
                    ) : (
                      <>
                        <Camera className="h-5 w-5" />
                        {isSelfiePhotoTask ? "TAG SELFIE" : "ÅBN KAMERA"}
                      </>
                    )}
                  </button>
                ) : null}

                {activePhotoFeedback ? (
                  activePhotoFeedback.tone === "success" ? (
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-[1.9rem] border border-sky-300/35 bg-[linear-gradient(145deg,rgba(12,74,110,0.72),rgba(14,165,233,0.18))] p-6 text-center text-sky-50 shadow-[0_26px_55px_rgba(14,165,233,0.2)] backdrop-blur-md">
                        <p className="text-xs font-semibold tracking-[0.24em] text-sky-100/75 uppercase">
                          Godkendt
                        </p>
                        <p className={`mt-3 text-xl font-bold text-white ${wrapTextClass}`}>
                          {activePhotoFeedback.message}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void continueFromSolvedPost()}
                        className="w-full rounded-2xl border border-sky-300/40 bg-sky-400 px-5 py-3 text-sm font-black tracking-[0.2em] text-slate-950 uppercase transition hover:bg-sky-300"
                      >
                        Gå videre
                      </button>

                      {activePostActionError ? (
                        <div
                          className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                        >
                          {activePostActionError}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-orange-300/35 bg-orange-500/12 px-4 py-4 text-sm text-orange-50 shadow-[0_18px_40px_rgba(249,115,22,0.16)] backdrop-blur-md">
                      <p className={`font-semibold ${wrapTextClass}`}>{activePhotoFeedback.message}</p>
                    </div>
                  )
                ) : null}
              </div>
            ) : null}

            {activePostVariant === "escape" ? (
              <div className="space-y-6 overflow-hidden">
                <p className={`text-xl font-bold text-amber-50 ${wrapTextClass}`}>{activeQuestion.text}</p>

                {activeEscapeReward ? (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-[1.9rem] border border-amber-300/40 bg-[linear-gradient(145deg,rgba(120,53,15,0.58),rgba(245,158,11,0.2))] p-6 text-center text-amber-100 shadow-[0_26px_55px_rgba(245,158,11,0.2)] backdrop-blur-md">
                      <p className="text-xs font-semibold tracking-[0.24em] text-amber-100/75 uppercase">
                        Belønning
                      </p>
                      <p className={`mt-3 text-lg font-bold text-amber-50 ${wrapTextClass}`}>
                        Flot! Din kode-brik er:
                      </p>
                      <div className="mt-5 rounded-[1.6rem] border border-amber-200/30 bg-amber-200/10 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <p
                          className={`text-5xl font-black tracking-[0.36em] text-amber-200 sm:text-6xl ${wrapTextClass}`}
                        >
                          {activeEscapeReward}
                        </p>
                      </div>
                      <p className="mt-4 text-sm text-amber-50/80">Brikken er gemt i din kode-oversigt.</p>
                      {hasAllEscapeBricks ? (
                        <p className="mt-3 text-sm font-semibold text-emerald-100">
                          Du har alle kode-brikker. Master-låsen er klar.
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => void continueFromSolvedPost()}
                      className="w-full rounded-2xl border border-amber-400/40 bg-amber-400 px-5 py-3 text-sm font-black tracking-[0.2em] text-slate-950 uppercase transition hover:bg-amber-300"
                    >
                      {hasAllEscapeBricks ? "Åbn Master-lås" : "Videre til næste post"}
                    </button>

                    {activePostActionError ? (
                      <div
                        className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                      >
                        {activePostActionError}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <form onSubmit={handleTypedAnswerSubmit} className="space-y-5">
                    <div className="space-y-3">
                      <label className="text-xs font-semibold tracking-[0.24em] text-amber-200/70 uppercase">
                        Svaret
                      </label>
                      <input
                        key={`escape-input-${activeTypedAnswerKey}`}
                        ref={typedAnswerInputRef}
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={isCheckingEscapeAnswer}
                        onChange={() => {
                          if (activeTypedAnswerError) setTypedAnswerError(null);
                          if (activePostActionError) setPostActionError(null);
                        }}
                        placeholder="Skriv tallet eller ordet her"
                        className="w-full rounded-2xl border border-amber-300/20 bg-slate-900/80 px-4 py-4 text-lg text-white outline-none transition placeholder:text-amber-100/35 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </div>

                    {activeEscapeHint ? (
                      <div
                        className={`rounded-2xl border border-amber-300/30 bg-amber-500/12 px-4 py-3 text-sm font-semibold text-amber-50 shadow-[0_16px_34px_rgba(245,158,11,0.12)] ${wrapTextClass}`}
                      >
                        {`💡 Brug for hjælp? Hint: ${activeEscapeHint}`}
                      </div>
                    ) : null}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={dismissCurrentPost}
                        disabled={isCheckingEscapeAnswer}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Annuller
                      </button>
                      <button
                        type="submit"
                        disabled={isCheckingEscapeAnswer}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-400/60"
                      >
                        {isCheckingEscapeAnswer ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Tjekker...
                          </>
                        ) : (
                          "Tjek svar"
                        )}
                      </button>
                    </div>

                    {activeTypedAnswerError ? (
                      <p className={`text-sm text-amber-200/85 ${wrapTextClass}`}>
                        {activeTypedAnswerError}
                      </p>
                    ) : null}
                  </form>
                )}
              </div>
            ) : null}

            {activePostVariant === "roleplay" ? (
              <div className="space-y-5 overflow-hidden">
                <div className="overflow-hidden rounded-[1.75rem] border border-violet-300/20 bg-slate-900/80 p-4 shadow-[0_18px_40px_rgba(76,29,149,0.18)] backdrop-blur-xl">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-violet-200/20 bg-violet-500/10 text-2xl shadow-inner shadow-black/20">
                      {roleplayAvatar && looksLikeImageSource(roleplayAvatar) ? (
                        <Image
                          src={roleplayAvatar}
                          alt={roleplayCharacterName}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                          unoptimized
                          loader={({ src }) => src}
                        />
                      ) : (
                        <span>{roleplayAvatar || "🕰️"}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className={`text-xs font-semibold tracking-[0.24em] text-violet-200/75 uppercase ${wrapTextClass}`}>
                        Tidsmaskinen
                      </p>
                      <p className={`mt-1 text-lg font-black text-white ${wrapTextClass}`}>
                        {roleplayCharacterName}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative ml-2 overflow-hidden rounded-[1.75rem] border border-violet-300/20 bg-slate-800/60 p-5 shadow-[0_18px_40px_rgba(59,130,246,0.16)] backdrop-blur-xl">
                  <span className="absolute -left-2 top-6 h-4 w-4 rotate-45 rounded-[0.45rem] border-l border-t border-violet-300/20 bg-slate-800/60" />
                  <p className={`pr-1 text-sm leading-relaxed text-white ${wrapTextClass}`}>
                    {getRoleplayMessage(activeQuestion)}
                  </p>
                </div>

                {activeRoleplayReply ? (
                  <div className="animate-in fade-in zoom-in-95 duration-300 space-y-4 overflow-hidden rounded-[1.85rem] border border-emerald-300/30 bg-[linear-gradient(145deg,rgba(6,78,59,0.68),rgba(91,33,182,0.2))] p-5 shadow-[0_24px_55px_rgba(16,185,129,0.18)] backdrop-blur-xl">
                    <p className={`text-xs font-semibold tracking-[0.24em] text-emerald-100/75 uppercase ${wrapTextClass}`}>
                      Svar fra {roleplayCharacterName}
                    </p>
                    <div className="rounded-[1.35rem] border border-emerald-200/15 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <p className={`text-sm leading-relaxed text-emerald-50 ${wrapTextClass}`}>
                        {activeRoleplayReply}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void continueFromSolvedPost()}
                      className="w-full rounded-2xl border border-emerald-300/35 bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
                    >
                      Fortsæt rejsen -&gt;
                    </button>

                    {activePostActionError ? (
                      <div
                        className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                      >
                        {activePostActionError}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <form
                    onSubmit={handleTypedAnswerSubmit}
                    className={`overflow-hidden rounded-[1.75rem] border bg-slate-900/70 p-4 shadow-[0_18px_38px_rgba(67,56,202,0.16)] backdrop-blur-xl transition-all ${
                      hasRoleplayInputErrorTone
                        ? "border-rose-300/45 shadow-[0_20px_45px_rgba(244,63,94,0.18)]"
                        : "border-violet-300/15"
                    }`}
                  >
                    <div className="flex items-end gap-3">
                      <input
                        key={`roleplay-input-${activeTypedAnswerKey}`}
                        ref={typedAnswerInputRef}
                        type="text"
                        disabled={isSubmittingAnswer}
                        onChange={() => {
                          clearRoleplayInputErrorTone();
                          if (activeTypedAnswerError) setTypedAnswerError(null);
                          if (activePostActionError) setPostActionError(null);
                        }}
                        onFocus={(event) => {
                          event.currentTarget.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }}
                        placeholder={`Skriv dit svar til ${roleplayCharacterName}...`}
                        className={`min-w-0 flex-1 rounded-2xl border bg-slate-950/80 px-4 py-3 text-white outline-none transition placeholder:text-violet-100/35 focus:ring-2 ${
                          hasRoleplayInputErrorTone
                            ? "border-rose-300/45 focus:border-rose-300/55 focus:ring-rose-300/20"
                            : "border-violet-200/15 focus:border-violet-300/50 focus:ring-violet-300/20"
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingAnswer}
                        className="shrink-0 rounded-2xl bg-violet-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Send besked
                      </button>
                    </div>

                    {activeTypedAnswerError ? (
                      <p className={`mt-3 text-sm text-violet-200/85 ${wrapTextClass}`}>
                        {activeTypedAnswerError}
                      </p>
                    ) : null}
                  </form>
                )}
              </div>
            ) : null}

            {activePostVariant === "unknown" ? (
              <div className="space-y-4 overflow-hidden rounded-3xl border border-amber-300/20 bg-amber-950/20 p-5">
                <p className={`text-xs font-semibold tracking-[0.24em] text-amber-200/70 uppercase ${wrapTextClass}`}>
                  Ukendt post
                </p>
                <h3 className={`text-xl font-black text-white ${wrapTextClass}`}>
                  ⚠️ Ukendt post-type
                </h3>
                <p className={`text-sm leading-relaxed text-white/80 ${wrapTextClass}`}>
                  Noget gik galt med dataen for denne post. Kontakt din arrangør.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PlayPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-slate-950 text-emerald-200">
            <Crosshair className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <PlayScreen />
      </Suspense>
      <style jsx global>{`
        @keyframes master-lock-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-10px);
          }
          40% {
            transform: translateX(8px);
          }
          60% {
            transform: translateX(-6px);
          }
          80% {
            transform: translateX(4px);
          }
        }

        @keyframes master-lock-spark {
          0% {
            opacity: 0;
            transform: scale(0.2) translateY(20px);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.4) translateY(-80px);
          }
        }
      `}</style>
    </>
  );
}

