"use client";

import { motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, ImageIcon, Loader2, Plus, Sparkles, Youtube } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { type ChangeEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";

import type { SavedPin } from "@/components/MapPicker";
import { RACE_TYPES } from "@/utils/gpsRuns";
import {
  clearRunDraft,
  readRunDraft,
  restoreDraftBoolean,
  restoreDraftMapCenter,
  restoreDraftString,
  writeRunDraft,
} from "@/utils/runDrafts";
import { createClient } from "@/utils/supabase/client";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-3xl border border-emerald-500/20 bg-slate-900/50" />
  ),
});

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const SUBJECT_TOPICS: Record<string, string[]> = {
  Dansk: [
    "Læsning & Forståelse",
    "Stavning & Grammatik",
    "Nordisk Mytologi",
    "H.C. Andersen & Eventyr",
    "Analyse af kortfilm/reklamer",
  ],
  Matematik: [
    "Geometri & Figurer",
    "Brøker & Procenter",
    "Algebra & Ligninger",
    "Sandsynlighed & Statistik",
    "Praktisk regning i hverdagen",
  ],
  Engelsk: [
    "Grammatik & Bøjninger",
    "Hverdagsordforråd",
    "Britisk kultur",
    "Amerikansk kultur",
    "Reading Comprehension",
  ],
  "Natur/Teknologi": [
    "Solsystemet",
    "Menneskekroppen",
    "Vejr & Klima",
    "Vandets kredsløb",
    "Dyr & Planter i Danmark",
  ],
  Historie: [
    "Vikingetiden",
    "Middelalderen",
    "2. Verdenskrig",
    "Den Kolde Krig",
    "Danmarks kongerække",
  ],
  Idræt: [
    "Boldspil & Regler",
    "Anatomi & Puls",
    "De Olympiske Lege",
    "Sundhed & Kost",
  ],
  Kristendomskundskab: [
    "Bibelske fortællinger",
    "Verdensreligioner (Islam, Jødedom m.fl.)",
    "Etik, moral & filosofi",
  ],
  Tysk: [
    "Ordforråd (Hverdag)",
    "Grammatik (Der/die/das)",
    "Tysk geografi & kultur",
  ],
  Fransk: [
    "Ordforråd & Udtale",
    "Fransk kultur & geografi",
    "Grundlæggende grammatik",
  ],
  Geografi: [
    "Jordens opbygning & pladetektonik",
    "Klima & Plantebælter",
    "Demografi & Befolkning",
    "Bæredygtighed & Energi",
  ],
  Biologi: [
    "Økosystemer & Fødekæder",
    "Celler & Mikroorganismer",
    "Genetik & DNA",
    "Evolution",
  ],
  "Fysik/Kemi": [
    "Det periodiske system",
    "Energi & Kræfter",
    "Atomer & Molekyler",
    "Elektricitet & Magnetisme",
  ],
  Samfundsfag: [
    "Demokrati & Politik",
    "Velfærdssamfundet",
    "Økonomi",
    "EU & Internationale forhold",
  ],
  "Håndværk/Design": [
    "Materialekendskab (Træ/Metal)",
    "Værktøj & Sikkerhed",
    "Designprocessen",
  ],
  Billedkunst: [
    "Kunsthistorie & Epoker",
    "Farvelære & Komposition",
    "Kendte kunstnere (Picasso, Monet m.fl.)",
  ],
  Madkundskab: [
    "Hygiejne i køkkenet",
    "Ernæring & Madpyramiden",
    "Råvarekendskab",
    "Grundtilberedning",
  ],
  Musik: ["Nodelære & Rytmik", "Instrumentkendskab", "Musikhistorie & Genrer"],
};

const AI_AUDIENCE_OPTIONS = [
  { value: "Indskoling", label: "Let og legende" },
  { value: "Mellemtrin", label: "Bred og tilgængelig" },
  { value: "Udskoling", label: "Mere udfordrende" },
  { value: "Ungdomsuddannelse", label: "Avanceret" },
] as const;

const AI_SUBJECT_OPTIONS = [
  "Dansk",
  "Matematik",
  "Natur/Teknik",
  "Historie",
  "Engelsk",
  "Biologi",
  "Geografi",
  "Samfundsfag",
  "Fysik/Kemi",
  "Idræt",
  "Kristendomskundskab",
  "Musik",
  "Billedkunst",
  "Madkundskab",
] as const;

const TOPIC_SUGGESTIONS = Array.from(
  new Set([
    "Firmahistorie",
    "Popkultur",
    "80'ernes popmusik",
    "Sommerfest",
    "Musik",
    "Historie",
    "Matematik",
    "Natur",
    ...Object.keys(SUBJECT_TOPICS),
    ...AI_SUBJECT_OPTIONS,
  ])
).sort((a, b) => a.localeCompare(b, "da-DK"));

type Question = {
  id: number;
  type: "multiple_choice" | "ai_image";
  text: string;
  aiPrompt: string;
  mediaUrl: string;
  answers: [string, string, string, string];
  correctIndex: number;
  lat: number | null;
  lng: number | null;
};

type StoredRunRecord = {
  id: string;
  user_id: string | null;
  title: string | null;
  subject: string | null;
  description: string | null;
  topic: string | null;
  questions: unknown;
};

type StoredQuestionRecord = {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  aiPrompt?: unknown;
  ai_prompt?: unknown;
  mediaUrl?: unknown;
  media_url?: unknown;
  answers?: unknown;
  correctIndex?: unknown;
  correct_index?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type MapCenter = {
  lat: number;
  lng: number;
};

type MagicDraftQuestion = {
  id?: unknown;
  type?: unknown;
  lat?: unknown;
  lng?: unknown;
  question?: unknown;
  aiPrompt?: unknown;
  mission?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
  answer?: unknown;
  unlockRange?: unknown;
};

type AutoGeneratedRunQuestion = {
  question?: unknown;
  options?: unknown;
  correctIndex?: unknown;
};

type AutoGeneratedRunResponse = {
  title?: unknown;
  description?: unknown;
  questions?: unknown;
};

type BuilderNotice = {
  tone: "success" | "error";
  message: string;
};

const MAGIC_DRAFT_STORAGE_KEY = "magicRunDraft";
const MANUEL_DRAFT_STORAGE_KEY = "draft_run_manuel";
const DEFAULT_MAP_CENTER: MapCenter = {
  lat: 55.6761,
  lng: 12.5683,
};
const AUTO_GENERATED_RUN_CENTER: MapCenter = {
  lat: 55.0,
  lng: 11.9,
};
const AI_REQUEST_TIMEOUT_MS = 45_000;
const MAX_AUTO_GENERATE_TOPIC_LENGTH = 150;
const MAX_AUTO_GENERATE_SOURCE_TEXT_LENGTH = 18000;
const MAX_AUTO_GENERATE_IMAGE_FILE_SIZE = 12 * 1024 * 1024;
const MAX_AUTO_GENERATE_IMAGE_DATA_LENGTH = 6_000_000;

type ManualBuilderDraftState = {
  title?: unknown;
  description?: unknown;
  subject?: unknown;
  showTeacherField?: unknown;
  showAITeacherFields?: unknown;
  questions?: unknown;
  aiRunBrief?: unknown;
  aiSubject?: unknown;
  aiTopic?: unknown;
  aiGrade?: unknown;
  mapCenter?: unknown;
};

const getQuestionTypeFromQuery = (value: string | null | undefined): Question["type"] =>
  value === "ai_image" ? "ai_image" : "multiple_choice";

const createQuestion = (type: Question["type"] = "multiple_choice"): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type,
  text: "",
  aiPrompt: "",
  mediaUrl: "",
  answers: ["", "", "", ""],
  correctIndex: 0,
  lat: null,
  lng: null,
});

const inputClass =
  "w-full rounded-2xl border border-emerald-500/20 bg-slate-900/50 px-4 py-2.5 text-emerald-100 placeholder:text-emerald-100/35 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const reviewInputClass =
  "w-full rounded-2xl border border-emerald-500/20 bg-slate-900/50 px-4 py-3 text-emerald-100 placeholder:text-emerald-100/35 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const aiActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-500 hover:text-slate-900 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const DEFAULT_ANSWERS: [string, string, string, string] = ["", "", "", ""];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toAnswersTuple(value: unknown): [string, string, string, string] {
  if (!Array.isArray(value)) return DEFAULT_ANSWERS;

  const stringAnswers = value.filter((item): item is string => typeof item === "string");
  const padded = [...stringAnswers.slice(0, 4)];
  while (padded.length < 4) {
    padded.push("");
  }

  return [padded[0] ?? "", padded[1] ?? "", padded[2] ?? "", padded[3] ?? ""];
}

function toQuestionId(value: unknown, fallback: number) {
  const parsed = asNumberOrNull(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : fallback;
}

function toQuestionList(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const timestamp = Date.now();

  return value
    .map((item, index): Question | null => {
      if (!isRecord(item)) return null;

      const candidate = item as StoredQuestionRecord;
      const rawAnswers = toAnswersTuple(candidate.answers);
      const correctIndex = asNumberOrNull(candidate.correctIndex ?? candidate.correct_index);
      const safeCorrectIndex =
        correctIndex !== null && Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex <= 3
          ? correctIndex
          : 0;

      return {
        id: toQuestionId(candidate.id, timestamp + index),
        type: candidate.type === "ai_image" ? "ai_image" : "multiple_choice",
        text: asTrimmedString(candidate.text),
        aiPrompt: asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt),
        mediaUrl: asTrimmedString(candidate.mediaUrl ?? candidate.media_url),
        answers: rawAnswers,
        correctIndex: safeCorrectIndex,
        lat: asNumberOrNull(candidate.lat),
        lng: asNumberOrNull(candidate.lng),
      };
    })
    .filter((question): question is Question => question !== null);
}

function toAutoGeneratedQuestionList(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const timestamp = Date.now();

  return value
    .map((item, index): Question | null => {
      if (!isRecord(item)) return null;

      const candidate = item as AutoGeneratedRunQuestion;
      const text = asTrimmedString(candidate.question);
      const answers = toAnswersTuple(candidate.options);
      const correctIndex = asNumberOrNull(candidate.correctIndex);
      const safeCorrectIndex =
        correctIndex !== null && Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex <= 3
          ? correctIndex
          : 0;

      if (!text || answers.some((answer) => !answer)) {
        return null;
      }

      return {
        id: timestamp + index,
        type: "multiple_choice",
        text,
        aiPrompt: "",
        mediaUrl: "",
        answers,
        correctIndex: safeCorrectIndex,
        lat: null,
        lng: null,
      };
    })
    .filter((question): question is Question => question !== null);
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

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Kunne ikke indlæse billedet."));
    image.src = src;
  });
}

async function compressImageForAutoGenerate(file: File) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return readFileAsDataUri(file);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const longestSide = Math.max(sourceWidth, sourceHeight, 1);
    const scale = longestSide > 1080 ? 1080 / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return readFileAsDataUri(file);
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function extractRequestedCount(text: string) {
  const match = text.match(/\b([1-9]|1\d|20)\b/);
  return match ? Number(match[1]) : 5;
}

const isQuestionEmpty = (question: Question) =>
  !question.text &&
  !question.aiPrompt &&
  !question.mediaUrl &&
  question.answers.every((answer) => !answer) &&
  question.lat === null &&
  question.lng === null;

export default function OpretLoebPage() {
  return (
    <Suspense
      fallback={
        <div className={`min-h-screen bg-slate-950 ${poppins.className}`}>
          <div className="flex min-h-screen items-center justify-center px-6 text-center">
            <div className="rounded-[2rem] border border-emerald-500/20 bg-slate-900/50 px-8 py-10 text-emerald-100 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <p className="text-xs font-semibold tracking-[0.28em] text-emerald-100/55 uppercase">
                Indlæser
              </p>
              <h1 className={`mt-3 text-3xl font-black tracking-tight text-emerald-100 ${rubik.className}`}>
                Quiz-bygger
              </h1>
            </div>
          </div>
        </div>
      }
    >
      <OpretLoebPageContent />
    </Suspense>
  );
}

function OpretLoebPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultQuestionType = getQuestionTypeFromQuery(searchParams.get("type"));
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const addQuestionLabel =
    defaultQuestionType === "ai_image" ? "Tilføj ny mission" : "Tilføj nyt spørgsmål";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [showTeacherField, setShowTeacherField] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
  const [showAITeacherFields, setShowAITeacherFields] = useState(false);
  const [aiRunBrief, setAiRunBrief] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiGrade, setAiGrade] = useState("Mellemtrin");
  const [autoGenerateTopic, setAutoGenerateTopic] = useState("");
  const [autoGenerateSourceText, setAutoGenerateSourceText] = useState("");
  const [autoGenerateImageBase64, setAutoGenerateImageBase64] = useState("");
  const [autoGenerateImageName, setAutoGenerateImageName] = useState("");
  const [autoGenerateNotice, setAutoGenerateNotice] = useState<BuilderNotice | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoGeneratingRun, setIsAutoGeneratingRun] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [questions, setQuestions] = useState<Question[]>(() => [createQuestion(defaultQuestionType)]);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_MAP_CENTER);
  const isGeneratingAnyImage = useMemo(
    () => Object.values(generatingImages).some(Boolean),
    [generatingImages]
  );
  const isAiBusy = isGenerating || isAutoGeneratingRun || isGeneratingAnyImage;
  const editorLockClass = isAiBusy ? "pointer-events-none opacity-50" : "";

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-[1.5rem] border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-50"
            : "border-red-300/30 bg-red-500/10 text-red-100"
        } ${className}`}
      >
        {notice.message}
      </div>
    ) : null;
  const renderAutoGenerateNotice = (className = "") =>
    autoGenerateNotice ? (
      <div
        className={`rounded-[1.5rem] border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          autoGenerateNotice.tone === "success"
            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-50"
            : "border-red-300/30 bg-red-500/10 text-red-100"
        } ${className}`}
      >
        {autoGenerateNotice.message}
      </div>
    ) : null;
  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedDraftRef = useRef(false);

  const scrollToSaveFeedback = () => {
    if (saveFeedbackRef.current) {
      saveFeedbackRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (typeof window !== "undefined") {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (editRunId) return;

    const rawDraft = window.sessionStorage.getItem(MAGIC_DRAFT_STORAGE_KEY);
    if (!rawDraft) return;

    try {
      const parsed = JSON.parse(rawDraft) as unknown;
      if (!Array.isArray(parsed)) return;

      const mappedQuestions = parsed
        .map((rawItem, index): Question | null => {
          if (!rawItem || typeof rawItem !== "object") return null;
          const item = rawItem as MagicDraftQuestion;
          const answers = toAnswersTuple(item.options);
          const questionText = typeof item.question === "string" ? item.question : "";
          const aiPromptText =
            typeof item.aiPrompt === "string"
              ? item.aiPrompt
              : typeof item.mission === "string"
                ? item.mission
                : "";
          const rawLat = asNumberOrNull(item.lat);
          const rawLng = asNumberOrNull(item.lng);
          const hasDummyCoordinates = rawLat === 0 && rawLng === 0;
          const answerIndex =
            typeof item.correctAnswer === "string"
              ? answers.indexOf(item.correctAnswer)
              : typeof item.answer === "string"
                ? answers.indexOf(item.answer)
                : -1;
          const mappedId = asNumberOrNull(item.id);

          return {
            id: mappedId !== null ? mappedId : Date.now() + index,
            type: item.type === "ai_image" ? "ai_image" : "multiple_choice",
            text: questionText,
            aiPrompt: aiPromptText,
            mediaUrl: "",
            answers,
            correctIndex: answerIndex >= 0 ? answerIndex : 0,
            lat: hasDummyCoordinates ? null : rawLat,
            lng: hasDummyCoordinates ? null : rawLng,
          };
        })
        .filter((q): q is Question => q !== null);

      if (mappedQuestions.length > 0) {
        setQuestions(mappedQuestions);
      }
    } catch (error) {
      console.error("Kunne ikke indlæse magisk kladde:", error);
    } finally {
      window.sessionStorage.removeItem(MAGIC_DRAFT_STORAGE_KEY);
    }
  }, [editRunId]);

  useEffect(() => {
    if (!isEditMode) {
      setIsLoadingExistingRun(false);
      setLoadedRunId(null);
      return;
    }

    let isActive = true;

    const loadRunForEditing = async () => {
      setIsLoadingExistingRun(true);
      setLoadedRunId(null);
      setNotice(null);

      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isActive) return;

      if (userError || !user) {
        setNotice({ tone: "error", message: "Du skal være logget ind for at redigere dette løb." });
        setIsLoadingExistingRun(false);
        return;
      }

      const { data: run, error } = await supabase
        .from("gps_runs")
        .select("id,user_id,title,subject,description,topic,questions")
        .eq("id", editRunId)
        .eq("user_id", user.id)
        .single<StoredRunRecord>();

      if (!isActive) return;

      if (error || !run) {
        console.error("Kunne ikke hente løbet til redigering:", error);
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette løb til redigering. Tjek at du er ejer, og prøv igen fra arkivet.",
        });
        setIsLoadingExistingRun(false);
        return;
      }

      const loadedQuestions = toQuestionList(run.questions);
      const loadedDescription = asTrimmedString(run.description);
      const loadedTopic = asTrimmedString(run.topic);
      const nextDescription = loadedDescription || loadedTopic;
      const firstPinnedQuestion =
        loadedQuestions.find((question) => question.lat !== null && question.lng !== null) ?? null;

      setTitle(asTrimmedString(run.title));
      setDescription(nextDescription);
      setSubject(asTrimmedString(run.subject));
      setShowTeacherField(Boolean(asTrimmedString(run.subject)));
      setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion(defaultQuestionType)]);
      setPreviewQuestions([]);
      setGeneratingImages({});
      setShowAIModal(false);
      setShowAITeacherFields(false);
      setAiSubject("");
      setAiRunBrief(loadedTopic || nextDescription);
      setAiTopic(loadedTopic || nextDescription);
      setMapCenter(
        firstPinnedQuestion
          ? {
              lat: firstPinnedQuestion.lat ?? DEFAULT_MAP_CENTER.lat,
              lng: firstPinnedQuestion.lng ?? DEFAULT_MAP_CENTER.lng,
            }
          : DEFAULT_MAP_CENTER
      );
      setLoadedRunId(run.id);
      setIsLoadingExistingRun(false);
    };

    void loadRunForEditing();

    return () => {
      isActive = false;
    };
  }, [defaultQuestionType, editRunId, isEditMode]);

  useEffect(() => {
    if (hasInitializedDraftRef.current) return;

    if (isEditMode) {
      if (isLoadingExistingRun) return;
      if (loadedRunId !== editRunId) {
        hasInitializedDraftRef.current = true;
        return;
      }
    }

    const shouldAutoLoad = window.sessionStorage.getItem("autoLoadDraft") === "true";
    if (shouldAutoLoad) {
      window.sessionStorage.removeItem("autoLoadDraft");
    }

    const restoredDraft = shouldAutoLoad
      ? readRunDraft<ManualBuilderDraftState>(MANUEL_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      const restoredSubject = restoreDraftString(restoredDraft.subject);
      const restoredQuestions = toQuestionList(restoredDraft.questions);

      setTitle(restoreDraftString(restoredDraft.title));
      setDescription(restoreDraftString(restoredDraft.description));
      setSubject(restoredSubject);
      setShowTeacherField(
        restoreDraftBoolean(restoredDraft.showTeacherField, Boolean(restoredSubject.trim()))
      );
      setShowAITeacherFields(restoreDraftBoolean(restoredDraft.showAITeacherFields));
      setQuestions(
        restoredQuestions.length > 0 ? restoredQuestions : [createQuestion(defaultQuestionType)]
      );
      setPreviewQuestions([]);
      setGeneratingImages({});
      setShowAIModal(false);
      setAiRunBrief(restoreDraftString(restoredDraft.aiRunBrief));
      setAiSubject(restoreDraftString(restoredDraft.aiSubject));
      setAiTopic(restoreDraftString(restoredDraft.aiTopic));
      setAiGrade(restoreDraftString(restoredDraft.aiGrade) || "Mellemtrin");
      setMapCenter(restoreDraftMapCenter(restoredDraft.mapCenter, DEFAULT_MAP_CENTER));
      setNotice(null);
    }

    hasInitializedDraftRef.current = true;
  }, [defaultQuestionType, editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;

    writeRunDraft(MANUEL_DRAFT_STORAGE_KEY, editRunId, {
      title,
      description,
      subject,
      showTeacherField,
      showAITeacherFields,
      questions,
      aiRunBrief,
      aiSubject,
      aiTopic,
      aiGrade,
      mapCenter,
    } satisfies ManualBuilderDraftState);
  }, [
    aiGrade,
    aiRunBrief,
    aiSubject,
    aiTopic,
    description,
    editRunId,
    mapCenter,
    questions,
    showAITeacherFields,
    showTeacherField,
    subject,
    title,
  ]);

  useEffect(() => {
    setQuestions((current) => {
      if (current.length !== 1) return current;

      const [firstQuestion] = current;
      if (!firstQuestion || !isQuestionEmpty(firstQuestion) || firstQuestion.type === defaultQuestionType) {
        return current;
      }

      return [{ ...firstQuestion, type: defaultQuestionType }];
    });
  }, [defaultQuestionType]);

  const pins = useMemo<SavedPin[]>(
    () =>
      questions
        .map((q, index) =>
          q.lat !== null && q.lng !== null
            ? { id: String(q.id), lat: q.lat, lng: q.lng, number: index + 1 }
            : null
        )
        .filter((q): q is SavedPin => q !== null),
    [questions]
  );

  function updateQuestion<K extends keyof Question>(
    id: number,
    key: K,
    value: Question[K]
  ): void;
  function updateQuestion(id: number, updates: Partial<Question>): void;
  function updateQuestion<K extends keyof Question>(
    id: number,
    updatesOrKey: Partial<Question> | K,
    value?: Question[K]
  ): void {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        if (typeof updatesOrKey === "string") {
          return { ...q, [updatesOrKey]: value } as Question;
        }
        return { ...q, ...updatesOrKey };
      })
    );
  }

  const updateAnswer = (id: number, answerIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const answers = [...q.answers] as Question["answers"];
        answers[answerIndex] = value;
        return { ...q, answers };
      })
    );
  };

  const assignPinFromCenter = (id: number) => {
    updateQuestion(id, { lat: mapCenter.lat, lng: mapCenter.lng });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createQuestion(defaultQuestionType)]);
  };

  const closeAIModal = () => {
    if (isGenerating) return;
    setNotice(null);
    setShowAIModal(false);
    setPreviewQuestions([]);
    setShowAITeacherFields(false);
  };

  const updatePreviewQuestionText = (id: number, value: string) => {
    setPreviewQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, text: value } : q))
    );
  };

  const updatePreviewAnswer = (id: number, answerIndex: number, value: string) => {
    setPreviewQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const answers = [...q.answers] as Question["answers"];
        answers[answerIndex] = value;
        return { ...q, answers };
      })
    );
  };

  const handleApproveAIPreview = () => {
    if (previewQuestions.length === 0) return;

    const hasExistingQuestions =
      questions.length > 1 || questions.some((question) => !isQuestionEmpty(question));

    if (hasExistingQuestions) {
      const shouldReplace = window.confirm(
        "Advarsel: Dette vil erstatte alle dine nuværende poster. Er du sikker på, at du vil fortsætte?"
      );

      if (!shouldReplace) {
        return;
      }
    }

    setNotice(null);
    const timestamp = Date.now();
    const approvedQuestions: Question[] = previewQuestions.map((q, index) => ({
      ...q,
      id: timestamp + index,
      type: q.type === "ai_image" ? "ai_image" : "multiple_choice",
      text: q.text.trim(),
      aiPrompt: q.aiPrompt.trim(),
      answers: toAnswersTuple(q.answers),
      correctIndex:
        typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex <= 3
          ? q.correctIndex
          : 0,
      lat: null,
      lng: null,
    }));

    setQuestions(approvedQuestions);
    setPreviewQuestions([]);
    setShowAIModal(false);
    setShowAITeacherFields(false);
  };

  const handleDiscardAIPreview = () => {
    setNotice(null);
    setPreviewQuestions([]);
  };

  const openAutoGenerateModal = () => {
    setNotice(null);
    setAutoGenerateNotice(null);
    setAutoGenerateTopic((current) => current || title.trim() || description.trim() || aiRunBrief.trim());
    setShowAutoGenerateModal(true);
  };

  const closeAutoGenerateModal = () => {
    if (isAutoGeneratingRun) return;
    setAutoGenerateNotice(null);
    setShowAutoGenerateModal(false);
  };

  const handleAutoGenerateImageChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    setAutoGenerateNotice(null);

    if (file.size > MAX_AUTO_GENERATE_IMAGE_FILE_SIZE) {
      setAutoGenerateImageBase64("");
      setAutoGenerateImageName("");
      setAutoGenerateNotice({
        tone: "error",
        message: "Billedet er for stort. Vælg et billede under 12 MB.",
      });
      return;
    }

    try {
      const compressedImage = await compressImageForAutoGenerate(file);

      if (!compressedImage.startsWith("data:image/")) {
        throw new Error("Billedet kunne ikke læses som et gyldigt billede.");
      }

      if (compressedImage.length > MAX_AUTO_GENERATE_IMAGE_DATA_LENGTH) {
        throw new Error("Billedet er stadig for tungt efter komprimering.");
      }

      setAutoGenerateImageBase64(compressedImage);
      setAutoGenerateImageName(file.name);
      setAutoGenerateNotice({
        tone: "success",
        message: "Bogside-billedet er klar. Du kan nu trylle løbet frem.",
      });
    } catch (error) {
      console.error("Kunne ikke forberede materiale-billedet:", error);
      setAutoGenerateImageBase64("");
      setAutoGenerateImageName("");
      setAutoGenerateNotice({
        tone: "error",
        message: "Vi kunne ikke klargøre billedet. Prøv et skarpere eller mindre billede.",
      });
    }
  };

  const handleSubmitAutoGenerateRun = async () => {
    if (isAutoGeneratingRun || isSaving) return;

    const normalizedTopic = autoGenerateTopic.trim();
    const normalizedSourceText = autoGenerateSourceText.trim();
    const hasMaterialInput =
      normalizedSourceText.length > 0 || autoGenerateImageBase64.length > 0;

    if (!normalizedTopic && !hasMaterialInput) {
      setAutoGenerateNotice({
        tone: "error",
        message: "Skriv et emne eller indsæt materiale, før du tryller løbet frem.",
      });
      return;
    }

    if (normalizedSourceText.length > MAX_AUTO_GENERATE_SOURCE_TEXT_LENGTH) {
      setAutoGenerateNotice({
        tone: "error",
        message: "Materialeteksten er for lang. Kort den ned til cirka 18.000 tegn.",
      });
      return;
    }

    if (
      autoGenerateImageBase64 &&
      autoGenerateImageBase64.length > MAX_AUTO_GENERATE_IMAGE_DATA_LENGTH
    ) {
      setAutoGenerateNotice({
        tone: "error",
        message: "Billedet er for stort til AI-behandling. Prøv et mindre eller skarpere udsnit.",
      });
      return;
    }

    if (normalizedTopic.length > MAX_AUTO_GENERATE_TOPIC_LENGTH) {
      setAutoGenerateNotice({
        tone: "error",
        message: "Emnet er for langt. Hold det under 150 tegn.",
      });
      return;
    }

    const hasExistingContent =
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      questions.some((question) => !isQuestionEmpty(question));

    if (hasExistingContent) {
      const shouldOverwrite = window.confirm(
        "AI-udkastet erstatter de nuværende felter i builderen. Vil du fortsætte?"
      );

      if (!shouldOverwrite) {
        return;
      }
    }

    setNotice(null);
    setAutoGenerateNotice(null);
    setIsAutoGeneratingRun(true);
    setPreviewQuestions([]);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, AI_REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/generate-run", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: normalizedTopic || undefined,
          sourceText: normalizedSourceText || undefined,
          imageBase64: autoGenerateImageBase64 || undefined,
          count: hasMaterialInput ? 5 : extractRequestedCount(normalizedTopic),
        }),
      });

      const data = (await res.json()) as AutoGeneratedRunResponse & {
        error?: unknown;
      };

      if (!res.ok) {
        throw new Error(
          asTrimmedString(data.error) || "AI-genereringen fejlede."
        );
      }

      const nextTitle = asTrimmedString(data.title);
      const nextDescription = asTrimmedString(data.description);
      const nextQuestions = toAutoGeneratedQuestionList(data.questions);
      const nextTopicSeed = normalizedTopic || nextTitle;

      if (!nextTitle || !nextDescription || nextQuestions.length === 0) {
        throw new Error("AI returnerede et ugyldigt løbsudkast.");
      }

      setTitle(nextTitle);
      setDescription(nextDescription);
      setQuestions(nextQuestions);
      setGeneratingImages({});
      setShowAIModal(false);
      setShowAITeacherFields(false);
      setAiRunBrief(nextTopicSeed);
      setAiTopic(nextTopicSeed);
      setMapCenter(AUTO_GENERATED_RUN_CENTER);
      setAutoGenerateTopic("");
      setAutoGenerateSourceText("");
      setAutoGenerateImageBase64("");
      setAutoGenerateImageName("");
      setShowAutoGenerateModal(false);
      setNotice({
        tone: "success",
        message: "AI har tryllet et udkast frem. Gennemgå felterne og flyt pins på kortet.",
      });
    } catch (error) {
      console.error("Fejl ved auto-generering af løb:", error);
      setAutoGenerateNotice({
        tone: "error",
        message:
          error instanceof Error && error.name === "AbortError"
            ? "AI'en var for længe om at svare, prøv igen."
            : "Vi kunne ikke auto-generere løbet lige nu. Prøv igen om et øjeblik.",
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsAutoGeneratingRun(false);
    }
  };

  const handleAIGenerate = async () => {
    const normalizedBrief = aiRunBrief.trim();
    const normalizedSubject = aiSubject.trim() || subject.trim() || "Generelt";
    const normalizedGrade = aiGrade.trim() || "Ikke angivet";
    const requestedCount = extractRequestedCount(normalizedBrief);

    setNotice(null);

    if (!normalizedBrief) {
      setNotice({ tone: "error", message: "Skriv først, hvad løbet skal handle om." });
      return;
    }

    const teacherGrade = showAITeacherFields ? normalizedGrade : "blandet niveau";
    const teacherSubject = showAITeacherFields ? normalizedSubject : "et valgfrit emne";

    const pedagogicalContext =
      `Du designer klassiske quiz-løb. Generer præcis ${requestedCount} quiz-poster om ${normalizedBrief} med fokus på ${teacherSubject} og en sværhedsgrad, der passer til ${teacherGrade}. ` +
      `Hver post SKAL have ét tydeligt spørgsmål, præcis 4 svarmuligheder i "answers" og et gyldigt "correctIndex" mellem 0 og 3, der peger på det rigtige svar. ` +
      `Alle spørgsmål og svar skal være på dansk, lette at forstå og passe til et GPS-løb udendørs.`;

    setIsGenerating(true);
    setPreviewQuestions([]);
    setAiTopic(normalizedBrief);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: normalizedSubject,
          topic: normalizedBrief,
          grade: normalizedGrade,
          count: requestedCount,
          prompt:
            `Lav præcis ${requestedCount} multiple-choice spørgsmål om ${normalizedBrief}. ` +
            `Hvert spørgsmål skal returneres med præcis 4 svarmuligheder i answers og et correctIndex, der peger på det rigtige svar.`,
          pedagogicalContext,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "AI-generering fejlede");
      }

      if (data.questions && data.questions.length > 0) {
        const formattedQuestions: Question[] = data.questions.map(
          (
            q: {
              text: string;
              answers: string[];
              correctIndex: number;
              type?: string;
              aiPrompt?: string;
              ai_prompt?: string;
            },
            index: number
          ) => ({
            id: Date.now() + index,
            type: q.type === "ai_image" ? "ai_image" : "multiple_choice",
            text: q.text,
            aiPrompt:
              typeof q.aiPrompt === "string"
                ? q.aiPrompt
                : typeof q.ai_prompt === "string"
                  ? q.ai_prompt
                  : "",
            answers: [
              q.answers?.[0] ?? "",
              q.answers?.[1] ?? "",
              q.answers?.[2] ?? "",
              q.answers?.[3] ?? "",
            ],
            correctIndex:
              typeof q.correctIndex === "number" &&
              q.correctIndex >= 0 &&
              q.correctIndex <= 3
                ? q.correctIndex
                : 0,
            lat: null,
            lng: null,
            mediaUrl: "",
          })
        );

        setPreviewQuestions(formattedQuestions);
      } else {
        setNotice({ tone: "error", message: "AI returnerede ingen spørgsmål. Prøv igen." });
      }
    } catch (error) {
      console.error(error);
      setNotice({ tone: "error", message: "Der skete en fejl. Prøv igen." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAIImage = async (questionId: number, questionText: string) => {
    const normalizedSubject = aiSubject.trim() || subject.trim() || "Generelt";
    const normalizedTopic = aiTopic.trim() || aiRunBrief.trim() || description.trim();

    if (!normalizedTopic) {
      setNotice({
        tone: "error",
        message: "Generér først spørgsmål i AI-assistenten, så emnet er sat.",
      });
      return;
    }

    setGeneratingImages((prev) => ({ ...prev, [questionId]: true }));

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText, subject: normalizedSubject, topic: normalizedTopic }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Billedgenerering fejlede");
      }

      if (data.imageUrl) {
        updateQuestion(questionId, "mediaUrl", data.imageUrl);
      }
    } catch (error) {
      console.error(error);
      setNotice({ tone: "error", message: "Der skete en fejl. Prøv igen." });
    } finally {
      setGeneratingImages((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const handleSaveRun = async () => {
    setNotice(null);

    if (isEditMode && loadedRunId !== editRunId) {
      setNotice({
        tone: "error",
        message: "Løbet er ikke indlæst endnu. Vent et øjeblik og prøv igen.",
      });
      scrollToSaveFeedback();
      return;
    }

    if (!title.trim()) {
      setNotice({ tone: "error", message: "Udfyld venligst titel." });
      scrollToSaveFeedback();
      return;
    }

    const normalizedQuestions = questions
      .map((q) => ({
        ...q,
        type: q.type === "ai_image" ? "ai_image" : "multiple_choice",
        text: q.text.trim(),
        aiPrompt: q.aiPrompt.trim(),
        answers: q.answers.map((answer) => answer.trim()) as Question["answers"],
      }))
      .filter(
        (q) =>
          q.text.length > 0 ||
          q.aiPrompt.length > 0 ||
          q.answers.some((answer) => answer.length > 0) ||
          q.lat !== null ||
          q.lng !== null
      );

    if (normalizedQuestions.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst ét udfyldt spørgsmål." });
      scrollToSaveFeedback();
      return;
    }

    const hasIncompleteQuestions = normalizedQuestions.some((q) => {
      if (!q.text) return true;
      if (q.type === "ai_image") return !q.aiPrompt;
      return q.answers.some((answer) => !answer);
    });
    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message:
          "Udfyld postens tekst. Multiple choice kræver fire svarmuligheder, og AI-billede kræver AI-instruks.",
      });
      scrollToSaveFeedback();
      return;
    }

    const hasAtLeastOnePin = normalizedQuestions.some(
      (q) => q.lat !== null && q.lng !== null
    );
    if (!hasAtLeastOnePin) {
      setNotice({
        tone: "error",
        message: "Du mangler at sætte pins på kortet. Mindst ét spørgsmål skal have koordinater.",
      });
      scrollToSaveFeedback();
      return;
    }

    setIsSaving(true);

    try {
      const normalizedDescription = description.trim();
      const normalizedTopic = aiRunBrief.trim() || aiTopic.trim() || normalizedDescription;
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setNotice({
          tone: "error",
          message: "Du skal være logget ind for at gemme løbet.",
        });
        scrollToSaveFeedback();
        return;
      }

      const payload = {
        title: title.trim(),
        subject: subject.trim() || "Generelt",
        description: normalizedDescription,
        topic: normalizedTopic,
        questions: normalizedQuestions,
        race_type: RACE_TYPES.MANUEL,
      };

      if (isEditMode) {
        const { data: updatedRuns, error } = await supabase
          .from("gps_runs")
          .update(payload)
          .eq("id", editRunId)
          .eq("user_id", user.id)
          .select("id");

        if (error) {
          throw error;
        }

        if (!updatedRuns || updatedRuns.length === 0) {
          setNotice({
            tone: "error",
            message: "Vi kunne ikke gemme ændringerne. Tjek at du stadig ejer løbet.",
          });
          scrollToSaveFeedback();
          return;
        }
      } else {
        const { error } = await supabase.from("gps_runs").insert({
          user_id: user.id,
          ...payload,
        });

        if (error) {
          throw error;
        }
      }

      setNotice({
        tone: "success",
        message: isEditMode ? "Ændringerne er gemt i arkivet!" : "Løbet er gemt i arkivet!",
      });
      clearRunDraft(MANUEL_DRAFT_STORAGE_KEY);

      if (!isEditMode) {
        setTitle("");
        setDescription("");
        setSubject("");
        setShowTeacherField(false);
        setQuestions([createQuestion(defaultQuestionType)]);
        setAiRunBrief("");
        setAiTopic("");
        setGeneratingImages({});
      }

      await new Promise((resolve) => window.setTimeout(resolve, 450));
      router.push("/dashboard/arkiv");
    } catch (error) {
      console.error("Fejl ved gemning af løb:", error);
      setNotice({ tone: "error", message: "Kunne ikke gemme løbet. Prøv igen." });
    } finally {
      setIsSaving(false);
    }
  };

  const truncateText = (text: string, length: number) =>
    text.length > length ? text.substring(0, length) + "..." : text;

  if (isEditMode && isLoadingExistingRun) {
    return (
      <div className={`relative min-h-screen overflow-hidden bg-slate-950 text-emerald-100 ${poppins.className}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.28),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(110,231,183,0.12),_transparent_28%)]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-[2rem] border border-emerald-500/20 bg-emerald-950/55 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-200" />
            <p className="mt-5 text-xs font-semibold tracking-[0.28em] text-emerald-100/55 uppercase">
              Rediger løb
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight text-emerald-100 ${rubik.className}`}>
              Indlæser dine spørgsmål
            </h1>
            <p className="mt-3 text-sm leading-6 text-emerald-100/70">
              Vi henter løbets data og klargør builderen til redigering.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative min-h-screen overflow-x-hidden bg-slate-950 text-emerald-100 ${poppins.className}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.28),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(110,231,183,0.12),_transparent_28%)]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row lg:items-start">
          <section className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:h-screen lg:w-[52%] lg:overflow-y-auto lg:px-8 lg:py-8">
            <div className="mx-auto max-w-3xl">
              <fieldset
                disabled={isAiBusy}
                aria-busy={isAiBusy}
                className={`min-w-0 space-y-5 border-0 p-0 ${editorLockClass}`}
              >
              <div className="px-1 pt-1">
                {isEditMode ? (
                  <div className="mb-4 inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-emerald-100 uppercase">
                    Edit-mode
                  </div>
                ) : null}
                <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                    Løbets titel
                  </label>
                  <button
                    type="button"
                    onClick={openAutoGenerateModal}
                    disabled={isAiBusy || isSaving || isLoadingExistingRun}
                    className={`${aiActionButtonClass} rounded-[1.2rem] px-4 py-2.5`}
                  >
                    {isAutoGeneratingRun ? (
                      <span className="inline-flex animate-pulse items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        🪄 Arbejder...
                      </span>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Auto-generer løb med AI
                      </>
                    )}
                  </button>
                </div>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={isAiBusy}
                  placeholder="F.eks. Firmaets sommerfest"
                  className="w-full rounded-[1.6rem] border border-emerald-500/20 bg-slate-900/50 px-5 py-4 text-xl font-bold text-emerald-100 placeholder:text-emerald-100/35 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                />
              </div>

              <div className="px-1">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                  Beskrivelse
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isAiBusy}
                  rows={3}
                  placeholder="Kort intro eller beskrivelse af løbet (valgfrit)"
                  className="w-full rounded-[1.6rem] border border-emerald-500/20 bg-slate-900/50 px-5 py-4 text-sm leading-6 text-emerald-100 placeholder:text-emerald-100/35 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                />
              </div>

              <div className="space-y-4 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setShowAIModal(true);
                    setPreviewQuestions([]);
                  }}
                  disabled={isAiBusy}
                  className={`${aiActionButtonClass} w-full sm:w-auto`}
                >
                  Auto-udfyld med AI
                </button>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.24em] text-emerald-100/65 uppercase">
                      Dine poster
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-950/45 px-4 py-2 text-sm font-semibold text-emerald-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}
              </div>

              {questions.map((question, questionIndex) => (
                <article
                  key={question.id}
                  className="rounded-[1.8rem] border border-emerald-500/20 bg-slate-900/50 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/20 bg-slate-900/50 text-sm font-bold text-emerald-100">
                        {questionIndex + 1}
                      </div>
                      <div>
                        <h3 className={`text-lg font-bold text-emerald-100 ${rubik.className}`}>
                          {question.type === "ai_image" ? "Foto-post" : "Quiz-post"}
                        </h3>
                        <p className="text-xs text-emerald-100/65">
                          {question.lat !== null && question.lng !== null
                            ? "Pin er valgt på kortet"
                            : "Ingen pin valgt endnu"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-950/45 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-emerald-100/75 uppercase backdrop-blur-xl">
                      {question.type === "ai_image" ? "AI foto" : "4 svar"}
                      </span>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                      Spørgsmålstekst
                    </label>
                    <input
                      value={question.text}
                      onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                      disabled={isAiBusy}
                      placeholder="Skriv spørgsmålet her..."
                      className={inputClass}
                    />
                  </div>

                  {question.type === "ai_image" ? (
                    <div className="mt-4 rounded-[1.4rem] border border-emerald-500/20 bg-slate-900/50 p-3 backdrop-blur-xl">
                      <label className="mb-2 block text-sm font-semibold text-emerald-100">
                        Instruks til AI-dommeren
                      </label>
                      <textarea
                        value={question.aiPrompt}
                        onChange={(event) => updateQuestion(question.id, { aiPrompt: event.target.value })}
                        disabled={isAiBusy}
                        rows={4}
                        placeholder="Hvad skal deltagerne tage billede af? F.eks. 'Find et egetræ' eller 'Tag et billede af noget rundt og blåt'."
                        className="w-full rounded-2xl border border-emerald-500/20 bg-slate-900/50 px-4 py-3 text-sm text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                      />
                      <p className="mt-2 text-xs text-emerald-100/70">
                        Skriv en tydelig dommer-instruks, så AI&apos;en kan vurdere billedet præcist.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {question.answers.map((answer, answerIndex) => {
                        const isCorrectAnswer = question.correctIndex === answerIndex;

                        return (
                          <div
                            key={`${question.id}-${answerIndex}`}
                            className={`flex items-center gap-2.5 rounded-[1.25rem] border px-3 py-2.5 transition ${
                              isCorrectAnswer
                                ? "border-emerald-300/40 bg-emerald-500/12 shadow-[0_14px_28px_rgba(16,185,129,0.12)]"
                                : "border-emerald-500/20 bg-emerald-950/45 hover:border-emerald-400/25"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuestion(question.id, { correctIndex: answerIndex })}
                              aria-label={`Markér svar ${answerIndex + 1} som korrekt`}
                              aria-pressed={isCorrectAnswer}
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black transition ${
                                isCorrectAnswer
                                  ? "border-emerald-200 bg-emerald-300 text-[#062515] shadow-[0_0_18px_rgba(110,231,183,0.24)]"
                                  : "border-emerald-500/20 bg-emerald-950/60 text-emerald-100/78 hover:border-emerald-300/30"
                              }`}
                            >
                              {String.fromCharCode(65 + answerIndex)}
                            </button>

                            <input
                              value={answer}
                              onChange={(event) => updateAnswer(question.id, answerIndex, event.target.value)}
                              disabled={isAiBusy}
                              placeholder={`Svar ${answerIndex + 1}`}
                              className="min-w-0 flex-1 bg-transparent py-1 text-sm text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                            />

                            <button
                              type="button"
                              onClick={() => updateQuestion(question.id, { correctIndex: answerIndex })}
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                                isCorrectAnswer
                                  ? "border-emerald-200/60 bg-emerald-300 text-[#062515]"
                                  : "border-emerald-500/20 bg-emerald-950/55 text-emerald-100/72 hover:border-emerald-300/30 hover:text-emerald-100"
                              }`}
                            >
                              {isCorrectAnswer ? <Check className="h-3.5 w-3.5" /> : null}
                              {isCorrectAnswer ? "Korrekt" : "Markér"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 rounded-[1.4rem] border border-emerald-500/20 bg-slate-900/50 p-3 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-100/75">
                      <ImageIcon className="h-4 w-4 text-emerald-200" />
                      <Youtube className="h-4 w-4 text-emerald-200" />
                      <span>Medie (valgfrit)</span>
                    </div>

                    {question.mediaUrl && question.mediaUrl.startsWith("http") && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative mx-auto mt-4 aspect-video w-full max-w-[300px] overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-900/50 shadow-2xl backdrop-blur-xl"
                      >
                        <Image
                          src={question.mediaUrl}
                          alt="Preview"
                          fill
                          sizes="(max-width: 640px) 100vw, 300px"
                          className="object-cover"
                          unoptimized
                          loader={({ src }) => src}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <button
                          type="button"
                          onClick={() => updateQuestion(question.id, "mediaUrl", "")}
                          className="absolute top-2 right-2 rounded-full bg-emerald-950/80 p-1.5 text-emerald-100 transition hover:bg-emerald-900/80"
                        >
                          ✕
                        </button>
                      </motion.div>
                    )}

                    <div className="mt-3 flex flex-col gap-2.5 xl:flex-row xl:items-center">
                      <input
                        type="text"
                        placeholder="Indsæt link til billede eller YouTube-video..."
                        value={question.mediaUrl || ""}
                        onChange={(e) => updateQuestion(question.id, "mediaUrl", e.target.value)}
                        disabled={isAiBusy}
                        className="min-w-0 flex-1 rounded-2xl border border-emerald-500/20 bg-slate-900/50 px-4 py-3 text-sm text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => handleGenerateAIImage(question.id, question.text)}
                        disabled={isAiBusy || !question.text}
                        className={`${aiActionButtonClass} rounded-2xl px-4 py-3 text-xs uppercase tracking-[0.18em]`}
                      >
                        {generatingImages[question.id] ? (
                          <span className="inline-flex animate-pulse items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            🪄 Arbejder...
                          </span>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Generér billede til &quot;{truncateText(question.text || "posten", 24)}&quot;
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => assignPinFromCenter(question.id)}
                    disabled={isAiBusy}
                    className="mt-4 w-full rounded-[1.35rem] border border-emerald-400/30 bg-emerald-500/22 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-emerald-100 shadow-[0_12px_32px_rgba(16,185,129,0.18)] transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                  >
                    Hent pin fra kortet
                  </button>

                  {question.lat !== null && question.lng !== null ? (
                    <p className="mt-2.5 text-xs text-emerald-100/70">
                      Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                    </p>
                  ) : null}
                </article>
              ))}

              <div className="rounded-[2rem] border border-emerald-500/20 bg-slate-900/50 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
                <button
                  type="button"
                  onClick={addQuestion}
                  disabled={isAiBusy}
                  className="inline-flex items-center gap-2 rounded-[1.4rem] border border-emerald-500/20 bg-slate-900/50 px-4 py-3 text-sm font-semibold text-emerald-100 backdrop-blur-xl transition hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {addQuestionLabel}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTeacherField((prev) => !prev)}
                  className="mt-5 inline-flex items-center gap-2 text-sm text-emerald-100/70 transition hover:text-emerald-100"
                >
                  {showTeacherField ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showTeacherField ? "Skjul emne (valgfrit)" : "Tilføj emne (valgfrit)"}
                </button>

                {showTeacherField ? (
                  <div className="mt-4 rounded-[1.5rem] border border-emerald-500/20 bg-slate-900/50 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                      Emne
                    </label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={isAiBusy}
                      list="quiz-topic-suggestions"
                      placeholder="f.eks. popkultur, firmahistorie eller matematik"
                      className="w-full rounded-2xl border border-emerald-500/20 bg-slate-900/50 px-4 py-3 text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    />
                  </div>
                ) : null}

                <div ref={saveFeedbackRef} className="mt-6 space-y-4">
                  {notice?.tone === "error" ? renderNotice() : null}
                  <button
                    type="button"
                    onClick={handleSaveRun}
                    disabled={isSaving || isAiBusy}
                    className="w-full rounded-[1.6rem] border border-emerald-400/30 bg-emerald-500/22 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-emerald-100 shadow-[0_14px_34px_rgba(16,185,129,0.18)] transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isSaving ? "Gemmer..." : isEditMode ? "Gem ændringer i arkivet" : "Gem løb i arkivet"}
                  </button>
                </div>
                </div>
              </fieldset>
            </div>
        </section>

        <aside className="w-full p-4 pt-0 sm:px-6 lg:w-[48%] lg:self-start lg:p-8 lg:pl-0">
          <div className="lg:sticky lg:top-5">
            <div className="h-[42vh] min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-slate-900/50 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_36px_rgba(16,185,129,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
              <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
            </div>
          </div>
        </aside>
      </div>
      </div>

      <datalist id="quiz-topic-suggestions">
        {TOPIC_SUGGESTIONS.map((topicOption) => (
          <option key={topicOption} value={topicOption} />
        ))}
      </datalist>

      {showAutoGenerateModal && (
        <div className="fixed inset-0 z-[1150] flex items-center justify-center bg-emerald-950/72 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl rounded-[2rem] border border-emerald-500/20 bg-emerald-950/92 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.28em] text-emerald-100/55 uppercase">
                  Vikar-drømmen
                </p>
                <h3
                  className={`mt-3 flex items-center gap-2 text-3xl font-extrabold text-emerald-100 ${rubik.className}`}
                >
                  <span aria-hidden>✨</span>
                  Tryl et løb med AI
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-100/75">
                  Vælg enten et emne eller giv AI&apos;en dagens materiale. Hvis du bruger tekst eller
                  et billede af en bogside, laver AI&apos;en 5 spørgsmål, hvor de rigtige svar skal kunne
                  findes direkte i materialet.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAutoGenerateModal}
                disabled={isAutoGeneratingRun}
                className="rounded-[1.2rem] border border-emerald-500/20 bg-emerald-950/45 px-4 py-2 text-sm font-semibold text-emerald-100/80 transition hover:bg-emerald-900/55 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Luk
              </button>
            </div>

            {renderAutoGenerateNotice("mt-6")}

            <div className="mt-6 grid gap-4">
              <section className="rounded-[1.6rem] border border-emerald-500/20 bg-emerald-950/55 p-5 backdrop-blur-xl">
                <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/60 uppercase">
                  Mulighed A · Emne
                </p>
                <label className="mt-3 block text-sm font-semibold text-emerald-100">
                  Hvad skal løbet handle om?
                </label>
                <input
                  value={autoGenerateTopic}
                  onChange={(event) => setAutoGenerateTopic(event.target.value)}
                  disabled={isAutoGeneratingRun}
                  maxLength={150}
                  placeholder="f.eks. Brøker for 4. klasse"
                  className="mt-3 w-full rounded-[1.4rem] border border-emerald-500/20 bg-slate-900/50 px-4 py-3 text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </section>

              <section className="rounded-[1.6rem] border border-emerald-500/20 bg-emerald-950/55 p-5 backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/60 uppercase">
                      Mulighed B · Materiale
                    </p>
                    <p className="mt-2 text-sm text-emerald-100/72">
                      Indsæt lektieteksten direkte, eller upload et billede af en bogside.
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-950/45 px-3 py-1.5 text-xs font-semibold text-emerald-100/70">
                    {autoGenerateSourceText.length}/{MAX_AUTO_GENERATE_SOURCE_TEXT_LENGTH} tegn
                  </span>
                </div>

                <textarea
                  value={autoGenerateSourceText}
                  onChange={(event) => setAutoGenerateSourceText(event.target.value)}
                  disabled={isAutoGeneratingRun}
                  rows={8}
                  placeholder="Indsæt teksten fra dagens læsning, bogside eller opgaveark her..."
                  className="mt-4 w-full rounded-[1.4rem] border border-emerald-500/20 bg-slate-900/50 px-4 py-4 text-sm leading-6 text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <div className="mt-4 flex flex-col gap-3 rounded-[1.4rem] border border-dashed border-emerald-400/25 bg-emerald-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 text-sm text-emerald-100/75">
                    <ImageIcon className="h-5 w-5 text-emerald-200" />
                    <div>
                      <p className="font-semibold text-emerald-100">
                        Upload billede af bogside
                      </p>
                      <p className="text-xs text-emerald-100/60">
                        Vi komprimerer billedet lokalt, før det sendes til AI&apos;en.
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[1.2rem] border border-emerald-400/30 bg-emerald-500/18 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/28">
                    <ImageIcon className="h-4 w-4" />
                    Vælg billede
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAutoGenerateImageChange}
                      disabled={isAutoGeneratingRun}
                      className="hidden"
                    />
                  </label>
                </div>

                {autoGenerateImageName ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
                    <span className="truncate">
                      Klar til analyse: {autoGenerateImageName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoGenerateImageBase64("");
                        setAutoGenerateImageName("");
                        setAutoGenerateNotice(null);
                      }}
                      disabled={isAutoGeneratingRun}
                      className="font-semibold text-emerald-100/80 transition hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Fjern billede
                    </button>
                  </div>
                ) : null}
              </section>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={closeAutoGenerateModal}
                disabled={isAutoGeneratingRun}
                className="rounded-[1.4rem] border border-emerald-500/20 bg-emerald-950/45 px-5 py-3 text-sm font-semibold text-emerald-100/80 transition hover:bg-emerald-900/55 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Luk
              </button>
              <button
                type="button"
                onClick={handleSubmitAutoGenerateRun}
                disabled={isAutoGeneratingRun}
                className={`${aiActionButtonClass} w-full sm:w-auto`}
              >
                {isAutoGeneratingRun ? (
                  <span className="inline-flex animate-pulse items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    🪄 Arbejder...
                  </span>
                ) : (
                  "Tryl løbet frem"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAIModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-emerald-950/70 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl rounded-[2rem] border border-emerald-500/20 bg-emerald-950/90 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.28em] text-emerald-100/55 uppercase">
                  AI-modal
                </p>
                <h3
                  className={`mt-3 flex items-center gap-2 text-3xl font-extrabold text-emerald-100 ${rubik.className}`}
                >
                  <span aria-hidden>✨</span>
                  Intelligent AI-assistent
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-100/75">
                  Skriv kort, hvad du vil have hjælp til. Du kan altid finjustere spørgsmålene, før de lægges på kortet.
                </p>
              </div>
            </div>

            {renderNotice("mt-6")}

            {previewQuestions.length > 0 ? (
              <div className="mt-8">
                <p className="mb-4 text-sm text-emerald-100/75">
                  Gennemgå spørgsmålene og ret dem til, før de overføres til kortet.
                </p>

                <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                  {previewQuestions.map((previewQuestion, previewIndex) => (
                    <div
                      key={previewQuestion.id}
                      className="rounded-[1.6rem] border border-emerald-500/20 bg-slate-900/50 p-4 backdrop-blur-xl"
                    >
                      <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                        Spørgsmål {previewIndex + 1}
                      </p>

                      <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-emerald-100/65 uppercase">
                        Spørgsmålstekst
                      </label>
                      <input
                        type="text"
                        value={previewQuestion.text}
                        onChange={(event) =>
                          updatePreviewQuestionText(previewQuestion.id, event.target.value)
                        }
                        className={reviewInputClass}
                      />

                      <div className="mt-4 space-y-3">
                        {previewQuestion.answers.map((answer, answerIndex) => (
                          <div key={`${previewQuestion.id}-answer-${answerIndex}`}>
                            <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-emerald-100/65 uppercase">
                              Svar {answerIndex + 1}
                            </label>
                            <input
                              type="text"
                              value={answer}
                              onChange={(event) =>
                                updatePreviewAnswer(
                                  previewQuestion.id,
                                  answerIndex,
                                  event.target.value
                                )
                              }
                              className={reviewInputClass}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleApproveAIPreview}
                    className="w-full rounded-[1.4rem] border border-emerald-400/30 bg-emerald-500/22 py-3 font-bold text-emerald-100 transition hover:bg-emerald-500/30"
                  >
                    Godkend og placer på kortet
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardAIPreview}
                    className="w-full rounded-[1.4rem] border border-emerald-500/20 bg-emerald-950/45 py-3 font-semibold text-emerald-100/80 transition hover:bg-emerald-900/55"
                  >
                    Kassér og prøv igen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <label className="mb-3 block text-sm font-semibold text-white">
                    Hvad skal løbet handle om, og hvor mange poster vil du have? (F.eks: Lav 6 spørgsmål om solsystemet...)
                  </label>
                  <textarea
                    value={aiRunBrief}
                    onChange={(e) => setAiRunBrief(e.target.value)}
                    disabled={isGenerating}
                    rows={8}
                    placeholder="Hvad skal løbet handle om, og hvor mange poster vil du have? (F.eks: Lav 6 spørgsmål om solsystemet...)"
                    className="w-full rounded-[1.6rem] border border-emerald-500/20 bg-slate-900/50 p-5 text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAITeacherFields((prev) => !prev)}
                  disabled={isGenerating}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-100/70 transition hover:text-emerald-100 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                >
                  {showAITeacherFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Tilpas emne og sværhedsgrad (valgfrit)
                </button>

                {showAITeacherFields ? (
                  <section className="mt-4 rounded-[1.6rem] border border-emerald-500/20 bg-slate-900/50 p-4 backdrop-blur-xl">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-emerald-100/65 uppercase">
                          Emne
                        </label>
                        <input
                          value={aiSubject}
                          onChange={(e) => setAiSubject(e.target.value)}
                          disabled={isGenerating}
                          list="quiz-topic-suggestions"
                          placeholder="f.eks. popkultur, natur eller firmahistorie"
                          className="w-full rounded-2xl border border-emerald-500/20 bg-slate-900/50 px-4 py-3 text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-emerald-100/65 uppercase">
                          Målgruppe/Sværhedsgrad
                        </label>
                        <select
                          value={aiGrade}
                          onChange={(e) => setAiGrade(e.target.value)}
                          disabled={isGenerating}
                          className="w-full rounded-2xl border border-emerald-500/20 bg-slate-900/50 p-3 text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                        >
                          {AI_AUDIENCE_OPTIONS.map((gradeOption) => (
                            <option
                              key={gradeOption.value}
                              value={gradeOption.value}
                              className="bg-slate-900 text-white"
                            >
                              {gradeOption.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>
                ) : null}

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={closeAIModal}
                    disabled={isGenerating}
                    className="rounded-[1.4rem] border border-emerald-500/20 bg-emerald-950/45 px-5 py-3 text-sm font-semibold text-emerald-100/80 transition hover:bg-emerald-900/55 disabled:opacity-60"
                  >
                    Luk
                  </button>
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className={`${aiActionButtonClass} w-full px-6`}
                  >
                    {isGenerating ? (
                      <span className="inline-flex animate-pulse items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        🪄 Arbejder...
                      </span>
                    ) : (
                      "Generer spørgsmål"
                    )}
                  </button>
                </div>
                {isGenerating ? (
                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-100/75">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300" />
                    AI&apos;en skriver forslag...
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
