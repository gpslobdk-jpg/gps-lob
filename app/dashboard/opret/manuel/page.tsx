"use client";

import { BookOpen, Check, ChevronDown, Loader2, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import ManualAiInterviewModal, {
  type ManualAiInterviewDraft,
} from "@/components/builders/manual/ManualAiInterviewModal";
import ManualReuseModal, {
  type ManualReuseQuestion,
} from "@/components/builders/manual/ManualReuseModal";
import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import type { SavedPin, SavedZone } from "@/components/MapPicker";
import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import {
  consumeDraftAutoload,
  clearRunDraft,
  hasUnsavedDraft,
  readRunDraft,
  restoreDraftBoolean,
  restoreDraftMapCenter,
  restoreDraftString,
  shouldRestoreRunDraftOnLoad,
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

const SUBJECT_TOPICS: Record<string, string[]> = {
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

type Question = {
  id: number;
  type: "multiple_choice" | "ai_image";
  text: string;
  aiPrompt: string;
  mediaUrl: string;
  answers: [string, string, string, string];
  correctIndex: number;
  points: number;
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
  radius?: number | null;
  race_type?: string | null;
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
  points?: unknown;
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

type ManualBuilderDraftState = {
  title?: unknown;
  description?: unknown;
  subject?: unknown;
  radius?: unknown;
  showTeacherField?: unknown;
  showAiInterviewModal?: unknown;
  questions?: unknown;
  mapCenter?: unknown;
  overrideRaceType?: unknown;
};

const DEFAULT_RUN_RADIUS = 15;
const RUN_RADIUS_OPTIONS = [15, 30, 50] as const;
const DEFAULT_QUESTION_POINTS = 10;

const createQuestion = (type: Question["type"] = "multiple_choice"): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type,
  text: "",
  aiPrompt: "",
  mediaUrl: "",
  answers: ["", "", "", ""],
  correctIndex: 0,
  points: DEFAULT_QUESTION_POINTS,
  lat: null,
  lng: null,
});

const inputClass =
  "w-full rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const textareaClass =
  "w-full rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const aiActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 px-5 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const DEFAULT_ANSWERS: [string, string, string, string] = ["", "", "", ""];
const ANSWER_LABELS = ["A", "B", "C", "D"] as const;

const createEmptyAnswers = (): [string, string, string, string] => ["", "", "", ""];

const buildPhotoAnswers = (targetObject: string): [string, string, string, string] => [
  targetObject.trim(),
  "",
  "",
  "",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRunRadius(value: unknown) {
  const parsed = asNumberOrNull(value);
  return parsed !== null && RUN_RADIUS_OPTIONS.includes(parsed as (typeof RUN_RADIUS_OPTIONS)[number])
    ? parsed
    : DEFAULT_RUN_RADIUS;
}

function normalizeQuestionPoints(value: unknown) {
  const parsed = asNumberOrNull(value);
  return parsed !== null ? Math.max(0, Math.round(parsed)) : DEFAULT_QUESTION_POINTS;
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

function getStoredPhotoTarget(
  candidate: Pick<StoredQuestionRecord, "aiPrompt" | "ai_prompt">,
  answers: [string, string, string, string]
) {
  const normalizedPrompt = asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt);
  if (normalizedPrompt) return normalizedPrompt;

  return answers[0] ?? "";
}

function normalizeQuestionForSave(question: Question): Question {
  const type = question.type === "ai_image" ? "ai_image" : "multiple_choice";
  const text = question.text.trim();
  const aiPrompt = question.aiPrompt.trim();

  return {
    ...question,
    type,
    text,
    aiPrompt,
    mediaUrl: question.mediaUrl.trim(),
    answers: type === "ai_image" ? buildPhotoAnswers(aiPrompt) : question.answers.map((answer) => answer.trim()) as Question["answers"],
    correctIndex: type === "ai_image" ? 0 : question.correctIndex,
    points: normalizeQuestionPoints(question.points),
  };
}

function toQuestionList(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const timestamp = Date.now();

  return value
    .map((item, index): Question | null => {
      if (!isRecord(item)) return null;

      const candidate = item as StoredQuestionRecord;
      const type = candidate.type === "ai_image" ? "ai_image" : "multiple_choice";
      const rawAnswers = toAnswersTuple(candidate.answers);
      const photoTarget = getStoredPhotoTarget(candidate, rawAnswers);
      const correctIndex = asNumberOrNull(candidate.correctIndex ?? candidate.correct_index);
      const safeCorrectIndex =
        correctIndex !== null && Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex <= 3
          ? correctIndex
          : 0;

      return {
        id: toQuestionId(candidate.id, timestamp + index),
        type,
        text: asTrimmedString(candidate.text),
        aiPrompt: type === "ai_image" ? photoTarget : asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt),
        mediaUrl: asTrimmedString(candidate.mediaUrl ?? candidate.media_url),
        answers: type === "ai_image" ? buildPhotoAnswers(photoTarget) : rawAnswers,
        correctIndex: type === "ai_image" ? 0 : safeCorrectIndex,
        points: normalizeQuestionPoints(candidate.points),
        lat: asNumberOrNull(candidate.lat),
        lng: asNumberOrNull(candidate.lng),
      };
    })
    .filter((question): question is Question => question !== null);
}

function toInterviewQuestionList(questions: ManualAiInterviewDraft["questions"]): Question[] {
  const timestamp = Date.now();

  return questions
    .map((question, index): Question | null => {
      const text = question.question.trim();
      const answers = toAnswersTuple(question.options);
      const normalizedCorrectAnswer = question.correctAnswer.trim();
      const safeCorrectIndex = answers.findIndex((answer) => answer.trim() === normalizedCorrectAnswer);

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
        correctIndex: safeCorrectIndex >= 0 ? safeCorrectIndex : 0,
        points: DEFAULT_QUESTION_POINTS,
        lat: null,
        lng: null,
      };
    })
    .filter((question): question is Question => question !== null);
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
        <div className={`min-h-screen bg-emerald-950 ${poppins.className}`}>
          <div className="flex min-h-screen items-center justify-center px-6 text-center">
            <div className="rounded-4xl border border-emerald-500/20 bg-slate-900/50 px-8 py-10 text-emerald-100 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
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
  const defaultQuestionType: Question["type"] = "multiple_choice";
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [radius, setRadius] = useState<number>(DEFAULT_RUN_RADIUS);
  const [showTeacherField, setShowTeacherField] = useState(false);
  const [showAiInterviewModal, setShowAiInterviewModal] = useState(false);
  const [showReuseModal, setShowReuseModal] = useState(false);
  const [showAddQuestionMenu, setShowAddQuestionMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [questions, setQuestions] = useState<Question[]>(() => [createQuestion(defaultQuestionType)]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_MAP_CENTER);
  const [showDraftRecoveryPrompt, setShowDraftRecoveryPrompt] = useState(false);
  const [overrideRaceType, setOverrideRaceType] = useState<string | null>(null);
  const isEditorBusy = isSaving || showDraftRecoveryPrompt;
  const editorLockClass = isEditorBusy ? "pointer-events-none opacity-50" : "";
  const printTitle = title.trim() || "Udkast uden titel";
  const printSubject = subject.trim() || "Ikke angivet";
  const printClassLevel = description.trim() || "Ikke angivet";

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-3xl border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-50"
            : "border-red-300/30 bg-red-500/10 text-red-100"
        } ${className}`}
      >
        {notice.message}
      </div>
    ) : null;
  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const addQuestionMenuRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedDraftRef = useRef(false);
  const shouldAutoRestoreDraftRef = useRef<boolean | null>(null);
  const pendingScrollTargetId = useRef<string | null>(null);

  const applyDraftState = (draft: ManualBuilderDraftState) => {
    const restoredSubject = restoreDraftString(draft.subject);
    const restoredQuestions = toQuestionList(draft.questions);
    const restoredRaceType = normalizeRaceType(draft.overrideRaceType);

    setTitle(restoreDraftString(draft.title));
    setDescription(restoreDraftString(draft.description));
    setSubject(restoredSubject);
    setRadius(normalizeRunRadius(draft.radius));
    setShowTeacherField(restoreDraftBoolean(draft.showTeacherField, Boolean(restoredSubject.trim())));
    setShowAiInterviewModal(restoreDraftBoolean(draft.showAiInterviewModal));
    setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion(defaultQuestionType)]);
    setMapCenter(restoreDraftMapCenter(draft.mapCenter, DEFAULT_MAP_CENTER));
    setOverrideRaceType(restoredRaceType);
  };

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
    if (!pendingScrollTargetId.current || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const targetId = pendingScrollTargetId.current;
    const frameId = window.requestAnimationFrame(() => {
      const targetEl = document.getElementById(`manuel-post-${targetId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      pendingScrollTargetId.current = null;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [questions]);

  useEffect(() => {
    if (!showAddQuestionMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!addQuestionMenuRef.current) return;
      if (addQuestionMenuRef.current.contains(event.target as Node)) return;
      setShowAddQuestionMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAddQuestionMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showAddQuestionMenu]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (editRunId) return;
    if (!consumeDraftAutoload(MAGIC_DRAFT_STORAGE_KEY)) return;

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
          const type = item.type === "ai_image" ? "ai_image" : "multiple_choice";
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
            type,
            text: questionText,
            aiPrompt: aiPromptText,
            mediaUrl: "",
            answers: type === "ai_image" ? buildPhotoAnswers(aiPromptText) : answers,
            correctIndex: type === "ai_image" ? 0 : answerIndex >= 0 ? answerIndex : 0,
            points: DEFAULT_QUESTION_POINTS,
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

  // Podcast-Detektiv handover: læs draft fra sessionStorage når source=podcast
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (editRunId) return;
    if (searchParams.get("source") !== "podcast") return;

    const raw = window.sessionStorage.getItem("podcast_draft");
    window.sessionStorage.removeItem("podcast_draft");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;

      const draft = parsed as { title?: unknown; questions?: unknown };
      const draftTitle = typeof draft.title === "string" ? draft.title.trim() : "";
      const rawQuestions = Array.isArray(draft.questions) ? draft.questions : [];

      const timestamp = Date.now();
      const mappedQuestions: Question[] = rawQuestions
        .map((rawItem: unknown, index: number): Question | null => {
          if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return null;
          const item = rawItem as { question?: unknown; options?: unknown; answer?: unknown };
          const text = typeof item.question === "string" ? item.question.trim() : "";
          const answers = toAnswersTuple(item.options);
          const correctAnswer = typeof item.answer === "string" ? item.answer.trim() : "";
          const correctIndex = answers.findIndex((a) => a.trim() === correctAnswer);
          if (!text || answers.some((a) => !a)) return null;
          return {
            id: timestamp + index,
            type: "multiple_choice",
            text,
            aiPrompt: "",
            mediaUrl: "",
            answers,
            correctIndex: correctIndex >= 0 ? correctIndex : 0,
            points: DEFAULT_QUESTION_POINTS,
            lat: null,
            lng: null,
          };
        })
        .filter((q): q is Question => q !== null);

      if (draftTitle) setTitle(draftTitle);
      if (mappedQuestions.length > 0) setQuestions(mappedQuestions);
      setOverrideRaceType(RACE_TYPES.PODCAST);
    } catch (err) {
      console.error("Podcast-kladde kunne ikke indlæses:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    hasInitializedDraftRef.current = false;
    shouldAutoRestoreDraftRef.current = null;
    setShowDraftRecoveryPrompt(false);

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

      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isActive) return;

        if (userError || !user) {
          setNotice({ tone: "error", message: "Du skal være logget ind for at redigere dette løb." });
          return;
        }

        const { data: run, error } = await supabase
          .from("gps_runs")
          .select("id,user_id,title,subject,description,topic,questions,radius,race_type")
          .eq("id", editRunId)
          .eq("user_id", user.id)
          .maybeSingle<StoredRunRecord>();

        if (!isActive) return;

        if (error) {
          console.error("Edit load error:", error);
          setNotice({
            tone: "error",
            message: "Kunne ikke indlæse løbet på grund af en serverfejl. Prøv igen.",
          });
          return;
        }

        if (!run) {
          console.warn("Edit load: No run found or RLS blocked", {
            runId: editRunId,
            userId: user.id,
          });
          setNotice({
            tone: "error",
            message:
              "Kunne ikke finde løbet. Enten findes det ikke, eller også har du ikke rettigheder til det.",
          });
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
        setRadius(normalizeRunRadius(run.radius));
        setOverrideRaceType(normalizeRaceType(run.race_type));
        setShowTeacherField(Boolean(asTrimmedString(run.subject)));
        setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion(defaultQuestionType)]);
        setShowAiInterviewModal(false);
        setMapCenter(
          firstPinnedQuestion
            ? {
                lat: firstPinnedQuestion.lat ?? DEFAULT_MAP_CENTER.lat,
                lng: firstPinnedQuestion.lng ?? DEFAULT_MAP_CENTER.lng,
              }
            : DEFAULT_MAP_CENTER
        );
        setLoadedRunId(run.id);
      } catch (error) {
        console.error("Kunne ikke indlæse løbet til redigering:", error);
        if (!isActive) return;
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette løb til redigering. Prøv igen fra arkivet om et øjeblik.",
        });
      } finally {
        if (isActive) {
          setIsLoadingExistingRun(false);
        }
      }
    };

    void loadRunForEditing();

    return () => {
      isActive = false;
    };
  }, [defaultQuestionType, editRunId, isEditMode]);

  useEffect(() => {
    if (hasInitializedDraftRef.current) return;

    if (shouldAutoRestoreDraftRef.current === null) {
      shouldAutoRestoreDraftRef.current = shouldRestoreRunDraftOnLoad(MANUEL_DRAFT_STORAGE_KEY);
    }

    const shouldAutoRestoreDraft = shouldAutoRestoreDraftRef.current;

    if (isEditMode) {
      if (isLoadingExistingRun) return;
      if (loadedRunId !== editRunId) {
        hasInitializedDraftRef.current = true;
        return;
      }
    }

    const restoredDraft = shouldAutoRestoreDraft
      ? readRunDraft<ManualBuilderDraftState>(MANUEL_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      applyDraftState(restoredDraft);
      setNotice(null);
      hasInitializedDraftRef.current = true;
      return;
    }

    if (isEditMode && !shouldAutoRestoreDraft && hasUnsavedDraft(MANUEL_DRAFT_STORAGE_KEY, editRunId)) {
      setShowDraftRecoveryPrompt(true);
      hasInitializedDraftRef.current = true;
      return;
    }

    hasInitializedDraftRef.current = true;
  }, [defaultQuestionType, editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;
    if (showDraftRecoveryPrompt) return;

    writeRunDraft(MANUEL_DRAFT_STORAGE_KEY, editRunId, {
      title,
      description,
      subject,
      radius,
      showTeacherField,
      showAiInterviewModal,
      questions,
      mapCenter,
      overrideRaceType,
    } satisfies ManualBuilderDraftState);
  }, [
    description,
    editRunId,
    mapCenter,
    overrideRaceType,
    questions,
    radius,
    showAiInterviewModal,
    showTeacherField,
    showDraftRecoveryPrompt,
    subject,
    title,
  ]);

  const handleRestoreDraft = () => {
    const restoredDraft = readRunDraft<ManualBuilderDraftState>(MANUEL_DRAFT_STORAGE_KEY, editRunId);

    if (!restoredDraft) {
      setShowDraftRecoveryPrompt(false);
      setNotice({
        tone: "error",
        message: "Vi kunne ikke finde den lokale kladde mere. Du arbejder videre på versionen fra arkivet.",
      });
      return;
    }

    applyDraftState(restoredDraft);
    setShowDraftRecoveryPrompt(false);
    setNotice({
      tone: "success",
      message: "Vi gendannede dine ugemte ændringer fra sidste besøg.",
    });
  };

  const handleDiscardDraft = () => {
    clearRunDraft(MANUEL_DRAFT_STORAGE_KEY);
    setShowDraftRecoveryPrompt(false);
    setNotice({
      tone: "success",
      message: "Den lokale kladde blev slettet. Du arbejder nu videre på versionen fra arkivet.",
    });
  };

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

  const previewZones = useMemo<SavedZone[]>(
    () =>
      pins.map((pin) => ({
        id: `${pin.id}-${radius}`,
        lat: pin.lat,
        lng: pin.lng,
        radius,
      })),
    [pins, radius]
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

  const updateQuestionType = (id: number, nextType: Question["type"]) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== id) return question;

        if (nextType === "ai_image") {
          return {
            ...question,
            type: "ai_image",
            answers: createEmptyAnswers(),
            correctIndex: 0,
          };
        }

        return {
          ...question,
          type: "multiple_choice",
          aiPrompt: "",
          answers: createEmptyAnswers(),
          correctIndex: 0,
        };
      })
    );
  };

  const assignPinFromCenter = (id: number) => {
    const currentIndex = questions.findIndex((question) => question.id === id);
    const nextQuestion = currentIndex >= 0 ? questions[currentIndex + 1] : null;

    if (nextQuestion) {
      pendingScrollTargetId.current = String(nextQuestion.id);
    }

    updateQuestion(id, { lat: mapCenter.lat, lng: mapCenter.lng });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createQuestion(defaultQuestionType)]);
  };

  const normalizeQuestionsForReuse = useCallback(
    (value: unknown): ManualReuseQuestion[] => toQuestionList(value),
    []
  );

  const handleImportReuseQuestion = useCallback(
    async (question: ManualReuseQuestion) => {
      setQuestions((previous) => {
        const nextId = previous.reduce((maxId, currentQuestion) => Math.max(maxId, currentQuestion.id), Date.now()) + 1;
        const importedQuestion: Question = {
          ...question,
          id: nextId,
          lat: null,
          lng: null,
          points: normalizeQuestionPoints(question.points),
        };

        pendingScrollTargetId.current = String(importedQuestion.id);

        return [...previous, importedQuestion];
      });
    },
    []
  );

  const closeAiInterviewModal = () => {
    setNotice(null);
    setShowAiInterviewModal(false);
  };

  const openReuseModal = () => {
    setNotice(null);
    setShowAddQuestionMenu(false);
    setShowReuseModal(true);
  };

  const closeReuseModal = () => {
    setShowReuseModal(false);
  };

  const handleAiInterviewComplete = (draft: ManualAiInterviewDraft) => {
    console.log("MANUAL PAGE RECEIVED DRAFT:", draft);

    const nextTitle = draft.title.trim();
    const nextQuestions = toInterviewQuestionList(draft.questions);
    const nextSubject = draft.subject.trim();

    if (!nextTitle || nextQuestions.length === 0) {
      setNotice({
        tone: "error",
        message: "AI'en returnerede et ugyldigt løbsudkast. Prøv igen.",
      });
      return;
    }

    const hasExistingContent =
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      questions.some((question) => !isQuestionEmpty(question));

    if (hasExistingContent) {
      const shouldReplace = window.confirm(
        "AI-udkastet erstatter de nuværende felter i builderen. Vil du fortsætte?"
      );

      if (!shouldReplace) {
        setNotice({
          tone: "success",
          message: "Dit nuværende arbejde blev beholdt uændret.",
        });
        return;
      }
    }

    setTitle(nextTitle);
    setDescription("");
    setQuestions([...nextQuestions]);
    if (nextSubject) {
      setSubject(nextSubject);
      setShowTeacherField(true);
    }
    setShowAiInterviewModal(false);
    setNotice({
      tone: "success",
      message: "AI har klargjort et komplet quiz-løb. Gennemgå felterne og placer posterne på kortet.",
    });
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
      .map((question) => normalizeQuestionForSave(question))
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
      if (q.type === "ai_image") {
        return !q.text || !q.aiPrompt;
      }

      if (!q.text) return true;
      return q.answers.some((answer) => !answer);
    });
    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message: "Udfyld enten postens tekst og alle fire svarmuligheder eller både motiv og instruktion på foto-poster.",
      });
      scrollToSaveFeedback();
      return;
    }

    const hasMissingCoordinates = normalizedQuestions.some(
      (question) => question.lat === null || question.lng === null
    );
    if (hasMissingCoordinates) {
      setNotice({
        tone: "error",
        message: "Du mangler at placere alle poster på kortet.",
      });
      scrollToSaveFeedback();
      return;
    }

    setIsSaving(true);

    try {
      const normalizedDescription = description.trim();
      const normalizedTopic = normalizedDescription || title.trim();
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
        radius,
        race_type: overrideRaceType ?? RACE_TYPES.MANUEL,
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
        setRadius(DEFAULT_RUN_RADIUS);
        setShowTeacherField(false);
        setQuestions([createQuestion(defaultQuestionType)]);
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

  if (isEditMode && isLoadingExistingRun) {
    return (
      <div className={`relative min-h-screen overflow-hidden bg-emerald-950 text-emerald-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-linear-to-br from-emerald-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
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
      <div className={`relative min-h-screen overflow-x-hidden bg-emerald-950 text-emerald-100 print:h-auto print:min-h-0 print:overflow-visible print:bg-white print:text-black ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-linear-to-br from-emerald-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px] print:hidden" />
        <div className="relative flex min-h-screen flex-col lg:flex-row lg:items-start print:block print:h-auto print:min-h-0 print:overflow-visible">
          <div className="print:hidden">
            <MobileBuilderWarning />
          </div>
          <section className="hidden w-full px-4 py-4 sm:px-6 sm:py-6 lg:block lg:h-screen lg:w-[52%] lg:overflow-y-auto lg:px-8 lg:py-8 print:hidden">
            <div className="mx-auto max-w-3xl">
              <fieldset
                disabled={isEditorBusy}
                aria-busy={isEditorBusy}
                className={`min-w-0 space-y-5 border-0 p-0 ${editorLockClass}`}
              >
                <div className="px-1 pt-1">
                  {isEditMode ? (
                    <div className="mb-4 inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-emerald-100 uppercase">
                      Edit-mode
                    </div>
                  ) : null}

                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-emerald-100">
                      Velkommen til det klassiske quiz løb.
                    </h3>
                    <p className="mt-2 text-sm text-emerald-100/80">
                      Placer posterne på kortet, og indtast et spørgsmål med fire svarmuligheder til hver post. Du kan også bruge den indbyggede AI-assistent til at generere spørgsmålene for dig.
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setShowAiInterviewModal(true);
                        }}
                        disabled={isEditorBusy}
                        className={aiActionButtonClass}
                      >
                        Auto-udfyld med AI
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.print();
                          }
                        }}
                        disabled={isEditorBusy}
                        className={`${aiActionButtonClass} print:hidden`}
                      >
                        <Printer className="h-4 w-4" />
                        Print udkast
                      </button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                      Løbets titel
                    </label>
                  </div>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={isEditorBusy}
                    placeholder="F.eks. 4.B's store natur-løb"
                    className="w-full rounded-[1.6rem] border border-emerald-500/30 bg-emerald-950/20 px-5 py-4 text-xl font-bold text-slate-100 placeholder:text-slate-500 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                  />
                </div>
              <div className="px-1">
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-4 backdrop-blur-xl">
                  <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                    Emne
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isEditorBusy}
                    className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                  >
                    <option value="" className="bg-slate-900 text-white">
                      Vælg et fag til arkivet...
                    </option>
                    {Object.keys(SUBJECT_TOPICS).map((subjectOption) => (
                      <option key={subjectOption} value={subjectOption} className="bg-slate-900 text-white">
                        {subjectOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-1">
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-4 backdrop-blur-xl">
                  <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                    GPS-radius
                  </label>
                  <select
                    value={radius}
                    onChange={(event) => setRadius(normalizeRunRadius(event.target.value))}
                    disabled={isEditorBusy}
                    className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                  >
                    {RUN_RADIUS_OPTIONS.map((radiusOption) => (
                      <option key={radiusOption} value={radiusOption} className="bg-slate-900 text-white">
                        {radiusOption} meter
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-emerald-100/70">
                    Vælg hvor tæt eleven skal være på posten, før GPS-låsen åbner.
                  </p>
                </div>
              </div>

              <div className="space-y-4 px-1">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.24em] text-emerald-100/65 uppercase">
                      Dine poster
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-sm font-semibold text-emerald-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}
              </div>

              {questions.map((question, questionIndex) => {
                const isPhotoMission = question.type === "ai_image";

                return (
                  <article
                    key={question.id}
                    id={`manuel-post-${question.id}`}
                    className="rounded-[1.8rem] border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-950/20 text-sm font-bold text-emerald-100">
                          {questionIndex + 1}
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold text-emerald-100 ${rubik.className}`}>
                            {isPhotoMission ? "Foto-post" : "Quiz-post"}
                          </h3>
                          <p className="text-xs text-emerald-100/65">
                            {question.lat !== null && question.lng !== null
                              ? "Pin er valgt på kortet"
                              : "Ingen pin valgt endnu"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <label className="flex min-w-44 flex-col gap-1 rounded-[1.1rem] border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 backdrop-blur-xl">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100/60">
                            Skift opgavetype
                          </span>
                          <select
                            value={question.type}
                            onChange={(event) =>
                              updateQuestionType(
                                question.id,
                                event.target.value === "ai_image" ? "ai_image" : "multiple_choice"
                              )
                            }
                            disabled={isEditorBusy}
                            className="bg-transparent text-sm font-semibold text-emerald-50 focus:outline-none disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                          >
                            <option value="multiple_choice" className="bg-slate-900 text-white">
                              Quiz
                            </option>
                            <option value="ai_image" className="bg-slate-900 text-white">
                              Tag et billede
                            </option>
                          </select>
                        </label>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-emerald-100/75 uppercase backdrop-blur-xl">
                          {isPhotoMission ? "AI foto" : "4 svar"}
                        </span>
                        <label className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-emerald-100/75 uppercase backdrop-blur-xl">
                          Point
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={question.points}
                            onChange={(event) =>
                              updateQuestion(question.id, {
                                points: normalizeQuestionPoints(event.target.value),
                              })
                            }
                            disabled={isEditorBusy}
                            className="w-16 bg-transparent text-right text-sm font-semibold tracking-normal text-emerald-50 focus:outline-none"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== questionIndex))}
                          disabled={isEditorBusy || questions.length <= 1}
                          aria-label={`Slet post ${questionIndex + 1}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isPhotoMission ? (
                      <>
                        <div className="mt-4">
                          <label className="mb-2 block text-xs font-semibold tracking-[0.12em] text-emerald-100/65">
                            Hvad skal de finde?
                          </label>
                          <input
                            value={question.aiPrompt}
                            onChange={(event) => updateQuestion(question.id, { aiPrompt: event.target.value })}
                            disabled={isEditorBusy}
                            placeholder="fx Bøgeblad, Rød postkasse, Sten"
                            className={inputClass}
                          />
                        </div>

                        <div className="mt-4">
                          <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                            Instruktion
                          </label>
                          <textarea
                            value={question.text}
                            onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                            disabled={isEditorBusy}
                            rows={4}
                            placeholder="f.eks. Find et rødt bøgeblad. Vores AI tjekker billedet med det samme (og husk: man kan ikke snyde ved at fotografere en skærm!)."
                            className={textareaClass}
                          />
                        </div>

                        <div className="mt-4 rounded-[1.25rem] border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-50/85">
                          Denne foto-post bruger AI-billedtjek under spillet, så den har ikke svarmuligheder.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-4">
                          <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                            Spørgsmålstekst
                          </label>
                          <input
                            value={question.text}
                            onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                            disabled={isEditorBusy}
                            placeholder="Skriv spørgsmålet her..."
                            className={inputClass}
                          />
                        </div>

                        <div className="mt-4 space-y-2">
                          {question.answers.map((answer, answerIndex) => {
                            const isCorrectAnswer = question.correctIndex === answerIndex;

                            return (
                              <div
                                key={`${question.id}-${answerIndex}`}
                                className={`flex items-center gap-2.5 rounded-[1.25rem] border px-3 py-2.5 transition ${
                                  isCorrectAnswer
                                    ? "border-emerald-300/40 bg-emerald-500/12 shadow-[0_14px_28px_rgba(16,185,129,0.12)]"
                                    : "border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-400/25"
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
                                      : "border-emerald-500/30 bg-emerald-950/20 text-emerald-100/78 hover:border-emerald-300/30"
                                  }`}
                                >
                                  {String.fromCharCode(65 + answerIndex)}
                                </button>

                                <input
                                  value={answer}
                                  onChange={(event) => updateAnswer(question.id, answerIndex, event.target.value)}
                                  disabled={isEditorBusy}
                                  placeholder={`Svar ${answerIndex + 1}`}
                                  className="min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                                />

                                <button
                                  type="button"
                                  onClick={() => updateQuestion(question.id, { correctIndex: answerIndex })}
                                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                                    isCorrectAnswer
                                      ? "border-emerald-200/60 bg-emerald-300 text-[#062515]"
                                      : "border-emerald-500/30 bg-emerald-950/20 text-emerald-100/72 hover:border-emerald-300/30 hover:text-emerald-100"
                                  }`}
                                >
                                  {isCorrectAnswer ? <Check className="h-3.5 w-3.5" /> : null}
                                  {isCorrectAnswer ? "Korrekt" : "Markér"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => assignPinFromCenter(question.id)}
                      disabled={isEditorBusy}
                      className="mt-4 w-full rounded-[1.35rem] border border-emerald-500/30 bg-emerald-500 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    >
                      Hent pin fra kortet
                    </button>

                    {question.lat !== null && question.lng !== null ? (
                      <p className="mt-2.5 text-xs text-emerald-100/70">
                        Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                      </p>
                    ) : null}
                  </article>
                );
              })}

              <div className="rounded-4xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
                <div ref={addQuestionMenuRef} className="relative inline-flex max-w-full flex-col items-start">
                  <button
                    type="button"
                    onClick={() => setShowAddQuestionMenu((current) => !current)}
                    disabled={isEditorBusy}
                    className="inline-flex items-center gap-2 rounded-[1.4rem] border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm font-semibold text-emerald-100 backdrop-blur-xl transition hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    aria-haspopup="menu"
                    aria-expanded={showAddQuestionMenu}
                  >
                    <Plus className="h-4 w-4" />
                    Tilføj post
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAddQuestionMenu ? "rotate-180" : ""}`} />
                  </button>

                  {showAddQuestionMenu ? (
                    <div className="absolute left-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-[1.6rem] border border-emerald-400/20 bg-slate-950/96 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                      <button
                        type="button"
                        onClick={() => {
                          addQuestion();
                          setShowAddQuestionMenu(false);
                        }}
                        disabled={isEditorBusy}
                        className="flex w-full items-start gap-3 rounded-[1.25rem] px-4 py-3 text-left text-emerald-50 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-black uppercase tracking-[0.16em]">Opret ny post</span>
                          <span className="mt-1 block text-sm leading-6 text-emerald-100/72">
                            Tilføj en tom quiz- eller foto-post og byg den fra bunden.
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={openReuseModal}
                        disabled={isEditorBusy}
                        className="flex w-full items-start gap-3 rounded-[1.25rem] px-4 py-3 text-left text-emerald-50 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                          <BookOpen className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-black uppercase tracking-[0.16em]">Hent fra arkiv</span>
                          <span className="mt-1 block text-sm leading-6 text-emerald-100/72">
                            Genbrug spørgsmål fra dine tidligere løb og placer dem på et nyt kort.
                          </span>
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>

                <div ref={saveFeedbackRef} className="mt-6 space-y-4">
                  {notice?.tone === "error" ? renderNotice() : null}
                  <button
                    type="button"
                    onClick={handleSaveRun}
                    disabled={isSaving}
                    className="w-full rounded-[1.6rem] border border-emerald-500/30 bg-emerald-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isSaving ? "Gemmer..." : isEditMode ? "Gem ændringer i arkivet" : "Gem løb i arkivet"}
                  </button>
                </div>
              </div>
              </fieldset>
            </div>
          </section>

        <aside className="hidden w-full p-4 pt-0 sm:px-6 lg:block lg:w-[48%] lg:self-start lg:p-8 lg:pl-0 print:hidden">
          <div className="lg:sticky lg:top-5">
            <div className="h-[42vh] min-h-80 w-full overflow-hidden rounded-4xl border border-emerald-500/20 bg-slate-900/50 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_36px_rgba(16,185,129,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
              <MapPicker center={mapCenter} pins={pins} zones={previewZones} onCenterChange={setMapCenter} autoLocateOnLoad={!isEditMode} />
            </div>
          </div>
        </aside>
        <section className="hidden print:block print:bg-white print:px-0 print:py-0 print:text-black">
          <div className="mx-auto w-full max-w-none space-y-6 print:space-y-4">
            <header className="rounded-none border-2 border-slate-900 bg-white p-8 text-black shadow-none print:break-after-page print:[page-break-after:always]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">
                Printvenligt udkast
              </p>
              <h1 className={`mt-4 text-4xl font-black tracking-tight text-black ${rubik.className}`}>
                {printTitle}
              </h1>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="border border-slate-300 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Klassetrin
                  </p>
                  <p className="mt-3 text-2xl font-black text-black">{printClassLevel}</p>
                </div>
                <div className="border border-slate-300 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Fag
                  </p>
                  <p className="mt-3 text-2xl font-black text-black">{printSubject}</p>
                </div>
                <div className="border border-slate-300 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Antal poster
                  </p>
                  <p className="mt-3 text-2xl font-black text-black">{questions.length}</p>
                </div>
              </div>
            </header>

            {questions.map((question, questionIndex) => {
              const isPhotoMission = question.type === "ai_image";
              const promptText = question.aiPrompt.trim() || "Ikke angivet endnu";
              const questionText = question.text.trim() || "Ikke udfyldt endnu";

              return (
                <article
                  key={`print-${question.id}`}
                  className="rounded-none border border-slate-900 bg-white p-6 text-black shadow-none print:break-inside-avoid print:[page-break-inside:avoid]"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Post {questionIndex + 1}
                      </p>
                      <h2 className={`mt-2 text-2xl font-black text-black ${rubik.className}`}>
                        {isPhotoMission ? "Foto-opgave" : "Quiz-opgave"}
                      </h2>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <p>{isPhotoMission ? "AI-billede" : "Multiple choice"}</p>
                    </div>
                  </div>

                  {isPhotoMission ? (
                    <div className="mt-6 rounded-none border-2 border-dashed border-slate-400 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Foto-opgave
                      </p>
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Motiv
                          </p>
                          <p className="mt-2 text-lg font-bold text-black">{promptText}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Instruktion
                          </p>
                          <p className="mt-2 text-base leading-7 text-black">{questionText}</p>
                        </div>
                        <div className="mt-6 min-h-32 rounded-none border-2 border-dashed border-slate-300 p-4">
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Foto-opgave
                          </p>
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            Her kan læreren hurtigt se, at posten kræver et foto af motivet ovenfor.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Spørgsmål
                        </p>
                        <p className="mt-3 text-lg leading-8 text-black">{questionText}</p>
                      </div>

                      <ol className="mt-6 space-y-3">
                        {question.answers.map((answer, answerIndex) => {
                          const isCorrectAnswer = question.correctIndex === answerIndex;
                          const answerText = answer.trim() || "Tom svarmulighed";

                          return (
                            <li
                              key={`print-${question.id}-${answerIndex}`}
                              className={`flex items-start gap-3 border px-4 py-3 ${
                                isCorrectAnswer ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white"
                              }`}
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-500 text-sm font-bold text-black">
                                {ANSWER_LABELS[answerIndex]}
                              </span>
                              <div className="min-w-0 flex-1 text-base leading-7 text-black">
                                <span className={isCorrectAnswer ? "font-black" : "font-medium"}>{answerText}</span>
                                {isCorrectAnswer ? (
                                  <span className="ml-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-700">
                                    (Korrekt svar)
                                  </span>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
      </div>

      {showDraftRecoveryPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 py-10 backdrop-blur-md print:hidden">
          <div className="w-full max-w-2xl rounded-4xl border border-emerald-400/25 bg-slate-950/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/70">Redningskrans</p>
            <h2 className={`mt-3 text-3xl font-black tracking-tight text-emerald-50 ${rubik.className}`}>
              Vi fandt ugemte ændringer fra dit sidste besøg
            </h2>
            <p className="mt-4 text-sm leading-6 text-emerald-100/80 sm:text-base">
              Hvis du fortsætter uden at gendanne kladden, beholder vi versionen fra arkivet og sletter den lokale kladde.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-3xl border border-emerald-300/40 bg-emerald-400 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300"
              >
                Gendan ugemte ændringer
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-3xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-emerald-50 transition hover:bg-white/10"
              >
                Slet kladde
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ManualAiInterviewModal
        open={showAiInterviewModal}
        initialSubject={subject}
        subjectSuggestions={Object.keys(SUBJECT_TOPICS)}
        onClose={closeAiInterviewModal}
        onComplete={handleAiInterviewComplete}
      />

      <ManualReuseModal
        open={showReuseModal}
        currentRunId={editRunId || undefined}
        onClose={closeReuseModal}
        normalizeQuestions={normalizeQuestionsForReuse}
        onImportQuestion={handleImportReuseQuestion}
      />
    </>
  );
}
