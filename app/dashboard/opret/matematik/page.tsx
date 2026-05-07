"use client";

import { BookOpen, Calculator, Check, ChevronDown, Loader2, Plus, Printer, Ruler, Sparkles, SquareFunction, Trash2, Wrench } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import MathAiInterviewModal, {
  type MathAiInterviewDraft,
} from "@/components/builders/matematik/MathAiInterviewModal";
import AiReviewDraftModal from "@/components/builders/AiReviewDraftModal";
import InkSaverPrintLayout from "@/components/builders/InkSaverPrintLayout";
import ManualReuseModal, {
  type ManualReuseQuestion,
} from "@/components/builders/manual/ManualReuseModal";
import GradeLevelMultiSelect from "@/components/builders/GradeLevelMultiSelect";
import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import { useBuilderSaveGuidance } from "@/components/builders/useBuilderSaveGuidance";
import type { SavedPin, SavedZone } from "@/components/MapPicker";
import {
  DEFAULT_SELECTED_GRADE_LEVELS,
  formatGradeLevelsForPrompt,
  normalizeGradeLevels,
  type GradeLevel,
} from "@/utils/gradeLevels";
import { RACE_TYPES } from "@/utils/gpsRuns";
import { findNearbyPinConflict, findOverlappingPinGroups } from "@/utils/pinProximity";
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
    <div className="h-full w-full animate-pulse rounded-3xl border border-amber-500/20 bg-slate-900/50" />
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
  grade_levels?: string[] | null;
  radius?: number | null;
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

type PendingMathAiReviewDraft = MathAiInterviewDraft & {
  replacesExistingContent: boolean;
};

const MAGIC_DRAFT_STORAGE_KEY = "magicRunDraft";
const MATEMATIK_DRAFT_STORAGE_KEY = "draft_run_matematik";
const MATH_SUBJECT = "Matematik";
const DEFAULT_MAP_CENTER: MapCenter = {
  lat: 55.6761,
  lng: 12.5683,
};

type ManualBuilderDraftState = {
  title?: unknown;
  description?: unknown;
  gradeLevels?: unknown;
  subject?: unknown;
  radius?: unknown;
  showTeacherField?: unknown;
  showAiInterviewModal?: unknown;
  pendingAiReviewDraft?: unknown;
  questions?: unknown;
  mapCenter?: unknown;
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
  "w-full rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const textareaClass =
  "w-full rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const toolsTriggerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-amber-500/25 bg-amber-950/30 px-4 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-amber-900/35 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const toolsMenuItemClass =
  "flex w-full items-start gap-3 rounded-[1.25rem] px-4 py-3 text-left text-amber-50 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50";

const PORTAL_MENU_GAP = 12;
const PORTAL_MENU_MARGIN = 16;

const DEFAULT_ANSWERS: [string, string, string, string] = ["", "", "", ""];
const ANSWER_LABELS = ["A", "B", "C", "D"] as const;

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

function normalizePendingMathAiReviewDraft(value: unknown): PendingMathAiReviewDraft | null {
  if (!isRecord(value)) return null;

  const title = asTrimmedString(value.title);
  const gradeLevels = normalizeGradeLevels(value.gradeLevels);
  const mathTopic = asTrimmedString(value.mathTopic);
  const questionCandidates = Array.isArray(value.questions) ? value.questions : [];
  const questions = questionCandidates
    .map((candidate) => {
      if (!isRecord(candidate)) return null;

      const question = asTrimmedString(candidate.question);
      const options = toAnswersTuple(candidate.options);
      const correctAnswer = asTrimmedString(candidate.correctAnswer);

      if (!question || !correctAnswer || options.some((option) => !option)) {
        return null;
      }

      return {
        question,
        options,
        correctAnswer,
      };
    })
    .filter((candidate): candidate is PendingMathAiReviewDraft["questions"][number] => candidate !== null);

  if (!title || questions.length === 0) {
    return null;
  }

  return {
    subject: asTrimmedString(value.subject) || MATH_SUBJECT,
    title,
    questions,
    gradeLevels,
    mathTopic,
    replacesExistingContent: Boolean(value.replacesExistingContent),
  };
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

type PortalMenuProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  align?: "start" | "end";
  className: string;
  children: ReactNode;
};

function PortalMenu({ open, anchorRef, menuRef, align = "start", className, children }: PortalMenuProps) {
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
    zIndex: 200,
  });

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const updatePosition = () => {
      const anchorElement = anchorRef.current;
      const menuElement = menuRef.current;
      if (!anchorElement || !menuElement) {
        return;
      }

      const anchorRect = anchorElement.getBoundingClientRect();
      const menuRect = menuElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const availableBelow = viewportHeight - anchorRect.bottom - PORTAL_MENU_GAP - PORTAL_MENU_MARGIN;
      const availableAbove = anchorRect.top - PORTAL_MENU_GAP - PORTAL_MENU_MARGIN;
      const shouldOpenUpward = availableBelow < menuRect.height && availableAbove > availableBelow;

      const unclampedTop = shouldOpenUpward
        ? anchorRect.top - PORTAL_MENU_GAP - menuRect.height
        : anchorRect.bottom + PORTAL_MENU_GAP;
      const maxTop = Math.max(PORTAL_MENU_MARGIN, viewportHeight - PORTAL_MENU_MARGIN - menuRect.height);
      const top = Math.min(Math.max(PORTAL_MENU_MARGIN, unclampedTop), maxTop);

      const unclampedLeft = align === "end" ? anchorRect.right - menuRect.width : anchorRect.left;
      const maxLeft = Math.max(PORTAL_MENU_MARGIN, viewportWidth - PORTAL_MENU_MARGIN - menuRect.width);
      const left = Math.min(Math.max(PORTAL_MENU_MARGIN, unclampedLeft), maxLeft);

      setMenuStyle({
        position: "fixed",
        top,
        left,
        visibility: "visible",
        zIndex: 200,
      });
    };

    updatePosition();

    const visualViewport = window.visualViewport;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updatePosition();
          });

    if (anchorRef.current) {
      resizeObserver?.observe(anchorRef.current);
    }

    if (menuRef.current) {
      resizeObserver?.observe(menuRef.current);
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    visualViewport?.addEventListener("resize", updatePosition);
    visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      visualViewport?.removeEventListener("resize", updatePosition);
      visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [align, anchorRef, menuRef, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div ref={menuRef} style={menuStyle} className={className}>
      {children}
    </div>,
    document.body
  );
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

function toInterviewQuestionList(questions: MathAiInterviewDraft["questions"]): Question[] {
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
  return <OpretLoebPageContent />;
}

function OpretLoebPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultQuestionType: Question["type"] = "multiple_choice";
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>(DEFAULT_SELECTED_GRADE_LEVELS);
  const [radius, setRadius] = useState<number>(DEFAULT_RUN_RADIUS);
  const [showTeacherField, setShowTeacherField] = useState(true);
  const [showAiInterviewModal, setShowAiInterviewModal] = useState(false);
  const [showReuseModal, setShowReuseModal] = useState(false);
  const [showAddQuestionMenu, setShowAddQuestionMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [questions, setQuestions] = useState<Question[]>(() => [createQuestion(defaultQuestionType)]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_MAP_CENTER);
  const [showDraftRecoveryPrompt, setShowDraftRecoveryPrompt] = useState(false);
  const [pendingAiReviewDraft, setPendingAiReviewDraft] = useState<PendingMathAiReviewDraft | null>(null);
  const isEditorBusy = isSaving || showDraftRecoveryPrompt;
  const editorLockClass = isEditorBusy ? "pointer-events-none opacity-50" : "";
  const printTitle = title.trim() || "Udkast uden titel";
  const printSubject = MATH_SUBJECT;
  const printClassLevel =
    gradeLevels.length > 0 ? formatGradeLevelsForPrompt(gradeLevels) : "Ikke angivet";
  const pendingAiReviewGradeLabel = pendingAiReviewDraft
    ? pendingAiReviewDraft.gradeLevels.length > 0
      ? formatGradeLevelsForPrompt(pendingAiReviewDraft.gradeLevels)
      : "Ikke angivet"
    : "";

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-3xl border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-amber-300/30 bg-amber-500/10 text-amber-50"
            : "border-amber-300/30 bg-amber-500/10 text-amber-100"
        } ${className}`}
      >
        {notice.message}
      </div>
    ) : null;
  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const addQuestionMenuAnchorRef = useRef<HTMLDivElement | null>(null);
  const addQuestionMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const toolsMenuAnchorRef = useRef<HTMLDivElement | null>(null);
  const toolsMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedDraftRef = useRef(false);
  const shouldAutoRestoreDraftRef = useRef<boolean | null>(null);
  const pendingScrollTargetId = useRef<string | null>(null);

  const normalizedQuestionsForSave = useMemo(
    () =>
      questions
        .map((question) => normalizeQuestionForSave(question))
        .filter(
          (question) =>
            question.text.length > 0 ||
            question.aiPrompt.length > 0 ||
            question.answers.some((answer) => answer.length > 0) ||
            question.lat !== null ||
            question.lng !== null
        ),
    [questions]
  );
  const hasIncompleteQuestions = useMemo(
    () =>
      normalizedQuestionsForSave.some((question) => {
        if (question.type === "ai_image") {
          return !question.text || !question.aiPrompt;
        }

        if (!question.text) return true;
        return question.answers.some((answer) => !answer);
      }),
    [normalizedQuestionsForSave]
  );
  const hasMissingCoordinates = useMemo(
    () => normalizedQuestionsForSave.some((question) => question.lat === null || question.lng === null),
    [normalizedQuestionsForSave]
  );
  const overlapWarning = useMemo(() => {
    const pinsToCheck = questions.map((q, i) => ({
      id: q.id,
      number: i + 1,
      lat: q.lat,
      lng: q.lng,
    }));
    const groups = findOverlappingPinGroups(pinsToCheck);
    if (groups.length === 0) return null;
    return groups.map((g) => `Post ${g.postNumbers.join(" og ")}`).join(", ");
  }, [questions]);
  const isReadyToSave =
    title.trim().length > 0 &&
    normalizedQuestionsForSave.length > 0 &&
    !hasIncompleteQuestions &&
    !hasMissingCoordinates;
  const { shouldHighlight: shouldHighlightSave } = useBuilderSaveGuidance(
    isReadyToSave,
    saveFeedbackRef
  );

  const applyDraftState = (draft: ManualBuilderDraftState) => {
    const restoredQuestions = toQuestionList(draft.questions);
    const restoredGradeLevels = normalizeGradeLevels(draft.gradeLevels);
    const restoredPendingAiReviewDraft = normalizePendingMathAiReviewDraft(draft.pendingAiReviewDraft);

    setTitle(restoreDraftString(draft.title));
    setDescription(restoreDraftString(draft.description));
    setGradeLevels(
      restoredGradeLevels.length > 0 ? restoredGradeLevels : DEFAULT_SELECTED_GRADE_LEVELS
    );
    setRadius(normalizeRunRadius(draft.radius));
    setShowTeacherField(restoreDraftBoolean(draft.showTeacherField, true));
    setShowAiInterviewModal(
      restoredPendingAiReviewDraft ? false : restoreDraftBoolean(draft.showAiInterviewModal)
    );
    setPendingAiReviewDraft(restoredPendingAiReviewDraft);
    setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion(defaultQuestionType)]);
    setMapCenter(restoreDraftMapCenter(draft.mapCenter, DEFAULT_MAP_CENTER));
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

  const scrollToQuestionCard = (id: number) => {
    if (typeof document === "undefined") {
      return;
    }

    document.getElementById(`matematik-post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!pendingScrollTargetId.current || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const targetId = pendingScrollTargetId.current;
    const frameId = window.requestAnimationFrame(() => {
      const targetEl = document.getElementById(`matematik-post-${targetId}`);
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
    if (!showAddQuestionMenu && !showToolsMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (addQuestionMenuAnchorRef.current?.contains(event.target as Node)) return;
      if (addQuestionMenuPortalRef.current?.contains(event.target as Node)) return;
      if (toolsMenuAnchorRef.current?.contains(event.target as Node)) return;
      if (toolsMenuPortalRef.current?.contains(event.target as Node)) return;
      setShowAddQuestionMenu(false);
      setShowToolsMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAddQuestionMenu(false);
        setShowToolsMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showAddQuestionMenu, showToolsMenu]);

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

  useEffect(() => {
    hasInitializedDraftRef.current = false;
    shouldAutoRestoreDraftRef.current = null;
    setShowDraftRecoveryPrompt(false);

    if (!isEditMode) {
      setIsLoadingExistingRun(false);
      setLoadedRunId(null);
      setPendingAiReviewDraft(null);
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
          .select("id,user_id,title,subject,description,topic,questions,grade_levels,radius")
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
        const loadedGradeLevels = normalizeGradeLevels(run.grade_levels);

        setGradeLevels(
          loadedGradeLevels.length > 0 ? loadedGradeLevels : DEFAULT_SELECTED_GRADE_LEVELS
        );
        setRadius(normalizeRunRadius(run.radius));
        setShowTeacherField(true);
        setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion(defaultQuestionType)]);
        setShowAiInterviewModal(false);
        setPendingAiReviewDraft(null);
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
      shouldAutoRestoreDraftRef.current = shouldRestoreRunDraftOnLoad(MATEMATIK_DRAFT_STORAGE_KEY);
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
      ? readRunDraft<ManualBuilderDraftState>(MATEMATIK_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      applyDraftState(restoredDraft);
      setNotice(null);
      hasInitializedDraftRef.current = true;
      return;
    }

    if (isEditMode && !shouldAutoRestoreDraft && hasUnsavedDraft(MATEMATIK_DRAFT_STORAGE_KEY, editRunId)) {
      setShowDraftRecoveryPrompt(true);
      hasInitializedDraftRef.current = true;
      return;
    }

    hasInitializedDraftRef.current = true;
  }, [defaultQuestionType, editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;
    if (showDraftRecoveryPrompt) return;

    writeRunDraft(MATEMATIK_DRAFT_STORAGE_KEY, editRunId, {
      title,
      description,
      gradeLevels,
      subject: MATH_SUBJECT,
      radius,
      showTeacherField,
      showAiInterviewModal,
      questions,
      mapCenter,
    } satisfies ManualBuilderDraftState);
  }, [
      pendingAiReviewDraft,
    description,
    editRunId,
    gradeLevels,
    mapCenter,
    questions,
    radius,
    showAiInterviewModal,
    showTeacherField,
    pendingAiReviewDraft,
    showDraftRecoveryPrompt,
    title,
  ]);

  const handleRestoreDraft = () => {
    const restoredDraft = readRunDraft<ManualBuilderDraftState>(MATEMATIK_DRAFT_STORAGE_KEY, editRunId);

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
    clearRunDraft(MATEMATIK_DRAFT_STORAGE_KEY);
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

  const assignPinFromCenter = (id: number) => {
    const pinsToCheck = questions.map((q, i) => ({
      id: q.id,
      number: i + 1,
      lat: q.lat,
      lng: q.lng,
    }));
    const conflict = findNearbyPinConflict(pinsToCheck, mapCenter.lat, mapCenter.lng, id);
    if (conflict) {
      setNotice({
        tone: "error",
        message: `Denne post ligger næsten samme sted som Post ${conflict.conflictingNumber} (${Math.round(conflict.distanceMeters)} m). Flyt kortet lidt, inden du henter pinnen.`,
      });
      return;
    }

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

  const handleImportReuseQuestion = useCallback((question: ManualReuseQuestion) => {
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
  }, []);

  const openReuseModal = () => {
    setNotice(null);
    setShowAddQuestionMenu(false);
    setShowReuseModal(true);
  };

  const closeReuseModal = () => {
    setShowReuseModal(false);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      if (index < 0 || index >= prev.length) {
        return prev;
      }

      return prev.filter((_, questionIndex) => questionIndex !== index);
    });
  };

  const closeAiInterviewModal = () => {
    setNotice(null);
    setShowAiInterviewModal(false);
  };

  const openAiInterviewModal = () => {
    setNotice(null);
    setShowAiInterviewModal(true);
  };

  const handlePrintDraft = () => {
    setShowToolsMenu(false);
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleAiInterviewComplete = (draft: MathAiInterviewDraft) => {
    const nextTitle = draft.title.trim();
    const nextQuestions = toInterviewQuestionList(draft.questions);

    if (!nextTitle || nextQuestions.length === 0) {
      setNotice({
        tone: "error",
        message: "Det auto-genererede udkast kunne ikke bruges. Prøv igen.",
      });
      return;
    }

    const hasExistingContent =
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      questions.some((question) => !isQuestionEmpty(question));
    const nextGradeLevels = normalizeGradeLevels(draft.gradeLevels);
    setShowAiInterviewModal(false);
    setNotice(null);
    setPendingAiReviewDraft({
      ...draft,
      title: nextTitle,
      questions: draft.questions,
      gradeLevels: nextGradeLevels,
      mathTopic: draft.mathTopic.trim(),
      replacesExistingContent: hasExistingContent,
    });
  };

  const closeAiReviewDraft = () => {
    if (!pendingAiReviewDraft) return;

    setPendingAiReviewDraft(null);
    setNotice({
      tone: "success",
      message: pendingAiReviewDraft.replacesExistingContent
        ? "Dit nuværende arbejde blev beholdt uændret."
        : "AI-udkastet blev lukket uden at blive anvendt.",
    });
  };

  const applyAiReviewDraft = () => {
    if (!pendingAiReviewDraft) return;

    const nextTitle = pendingAiReviewDraft.title.trim();
    const nextQuestions = toInterviewQuestionList(pendingAiReviewDraft.questions);
    const nextGradeLevels = normalizeGradeLevels(pendingAiReviewDraft.gradeLevels);

    if (!nextTitle || nextQuestions.length === 0) {
      setPendingAiReviewDraft(null);
      setNotice({
        tone: "error",
        message: "Det auto-genererede udkast kunne ikke bruges. Prøv igen.",
      });
      return;
    }

    setTitle(nextTitle);
    setDescription("");
    setGradeLevels(
      nextGradeLevels.length > 0 ? nextGradeLevels : DEFAULT_SELECTED_GRADE_LEVELS
    );
    setQuestions([...nextQuestions]);
    setShowTeacherField(true);
    setPendingAiReviewDraft(null);
    setNotice({
      tone: "success",
      message: "Et komplet udkast er klar til dit matematik-loeb. Gennemgaa felterne og placer posterne paa kortet.",
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

    if (normalizedQuestionsForSave.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst ét udfyldt spørgsmål." });
      scrollToSaveFeedback();
      return;
    }

    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message: "Udfyld enten postens tekst og alle fire svarmuligheder eller både motiv og instruktion på foto-poster.",
      });
      scrollToSaveFeedback();
      return;
    }

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
        subject: MATH_SUBJECT,
        description: normalizedDescription,
        topic: normalizedTopic,
        questions: normalizedQuestionsForSave,
        grade_levels: gradeLevels.length > 0 ? gradeLevels : null,
        radius,
        race_type: RACE_TYPES.MATEMATIK,
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
      clearRunDraft(MATEMATIK_DRAFT_STORAGE_KEY);

      if (!isEditMode) {
        setTitle("");
        setDescription("");
        setGradeLevels(DEFAULT_SELECTED_GRADE_LEVELS);
        setRadius(DEFAULT_RUN_RADIUS);
        setShowTeacherField(true);
        setPendingAiReviewDraft(null);
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
      <div className={`relative min-h-screen overflow-hidden bg-slate-950 text-amber-50 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-linear-to-br from-amber-950/60 via-slate-900/80 to-amber-900 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/20 bg-slate-900/60 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-200" />
            <p className="mt-5 text-xs font-semibold tracking-[0.28em] text-amber-100/55 uppercase">
              Rediger matematik-løb
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight text-amber-50 ${rubik.className}`}>
              Indlæser dine regneopgaver
            </h1>
            <p className="mt-3 text-sm leading-6 text-amber-100/70">
              Vi henter løbets data og klargør builderen til redigering.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative min-h-screen bg-slate-950 text-amber-50 print:h-auto print:min-h-0 print:overflow-visible print:bg-white print:text-black ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-linear-to-br from-amber-950/60 via-slate-900/80 to-amber-900 backdrop-blur-[2px] print:hidden" />
        <div className="relative flex min-h-screen flex-col lg:flex-row print:block print:h-auto print:min-h-0 print:overflow-visible">
          <div className="print:hidden">
            <MobileBuilderWarning />
          </div>
          <section className="relative hidden w-full overflow-visible px-4 py-4 sm:px-6 sm:py-6 lg:block lg:w-[52%] lg:overflow-visible lg:px-8 lg:py-8 print:hidden">
            <img
              src="/matematikikon2.svg"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute top-8 -right-8 z-0 h-60 w-60 select-none opacity-[0.16] drop-shadow-[0_24px_56px_rgba(255,255,255,0.14)] print:hidden"
            />
            <img
              src="/matematikikon3.svg"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-16 -left-8 z-0 h-60 w-60 select-none opacity-[0.16] drop-shadow-[0_24px_56px_rgba(255,255,255,0.14)] print:hidden"
            />
            <div className="relative z-10 mx-auto max-w-3xl">
              <fieldset
                disabled={isEditorBusy}
                aria-busy={isEditorBusy}
                className={`min-w-0 space-y-5 border-0 p-0 ${editorLockClass}`}
              >
                <div className="px-1 pt-1">
                  {isEditMode ? (
                    <div className="mb-4 inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-amber-50 uppercase">
                      Edit-mode
                    </div>
                  ) : null}

                  <div className="relative z-40 mb-8 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.15rem] border border-white/80 bg-white px-2 py-2 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-6px_12px_rgba(217,119,6,0.08),0_18px_38px_rgba(255,255,255,0.16),0_14px_28px_rgba(251,191,36,0.18)] ring-1 ring-amber-200/55">
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-2 top-1 h-px rounded-full bg-white/95"
                        />
                        <img
                          src="/matematikikon1.svg"
                          alt="Matematik"
                          className="h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(217,119,6,0.18)]"
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-amber-50">Matematik</h3>
                      </div>
                    </div>

                    <div className="relative z-40 rounded-4xl border border-amber-500/30 bg-amber-950/20 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <label className="block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">Løbets titel</label>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 print:hidden">
                            <button
                              type="button"
                              onClick={openAiInterviewModal}
                              disabled={isEditorBusy}
                              className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm font-bold text-amber-50 shadow-[0_0_24px_rgba(245,158,11,0.15)] backdrop-blur-xl transition-all hover:bg-amber-500/25 hover:shadow-[0_0_32px_rgba(245,158,11,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Sparkles className="h-4 w-4" />
                              Quiz Assistenten
                            </button>

                            <div ref={toolsMenuAnchorRef} className="inline-flex max-w-full flex-col items-end">
                              <button
                                type="button"
                                onClick={() => setShowToolsMenu((current) => !current)}
                                disabled={isEditorBusy}
                                className={toolsTriggerButtonClass}
                                aria-haspopup="menu"
                                aria-expanded={showToolsMenu}
                              >
                                <Wrench className="h-4 w-4" />
                                Værktøjer
                                <ChevronDown className={`h-4 w-4 transition-transform ${showToolsMenu ? "rotate-180" : ""}`} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <input
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          disabled={isEditorBusy}
                          placeholder="F.eks. 5.A's store broek-loeb"
                          className="w-full rounded-[1.6rem] border border-amber-500/30 bg-amber-950/20 px-5 py-4 text-xl font-bold text-slate-100 placeholder:text-slate-500 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                        />


                      </div>
                    </div>
                  </div>

                  <div className="relative z-0 mb-6 rounded-3xl border border-amber-500/30 bg-amber-950/20 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Klassetrin
                    </label>
                    <GradeLevelMultiSelect
                      selectedGradeLevels={gradeLevels}
                      onChange={setGradeLevels}
                      tone="amber"
                      disabled={isEditorBusy}
                      compact
                    />
                    <p className="mt-3 text-sm text-amber-100/70">
                      {gradeLevels.length > 0
                        ? `Valgt: ${formatGradeLevelsForPrompt(gradeLevels)}`
                        : "Ingen klassetrin valgt endnu."}
                    </p>
                  </div>

                </div>

              <div className="relative z-0 space-y-4 px-1 lg:pr-2">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.24em] text-amber-100/65 uppercase">
                      Dine poster
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-sm font-semibold text-amber-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}

                {overlapWarning ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-200 backdrop-blur-xl">
                    ⚠️ Poster på samme sted: {overlapWarning}. Brug &quot;Fjern placering&quot; og flyt kortet for at adskille dem.
                  </div>
                ) : null}
              </div>

              {questions.map((question, questionIndex) => {
                const isPhotoMission = question.type === "ai_image";

                return (
                  <article
                    key={question.id}
                    id={`matematik-post-${question.id}`}
                    className="relative z-0 rounded-[1.8rem] border border-amber-500/30 bg-amber-950/20 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className={`text-lg font-bold text-amber-50 ${rubik.className}`}>
                        Post {questionIndex + 1}
                      </h3>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-950/20 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-amber-100/75 uppercase backdrop-blur-xl">
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
                            className="w-16 bg-transparent text-right text-sm font-semibold tracking-normal text-amber-50 focus:outline-none"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeQuestion(questionIndex)}
                          disabled={isEditorBusy}
                          aria-label={`Slet post ${questionIndex + 1}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/30 bg-amber-950/20 text-amber-100/75 transition hover:border-amber-300/40 hover:bg-amber-50/10 hover:text-amber-300 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {isPhotoMission ? (
                      <>
                        <div className="mt-4">
                          <label className="mb-2 block text-xs font-semibold tracking-[0.12em] text-amber-100/65">
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
                          <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                            Instruktion
                          </label>
                          <textarea
                            value={question.text}
                            onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                            disabled={isEditorBusy}
                            rows={4}
                            placeholder="f.eks. Find et rødt bøgeblad. Systemet tjekker billedet med det samme (og husk: man kan ikke snyde ved at fotografere en skærm!)."
                            className={textareaClass}
                          />
                        </div>

                        <div className="mt-4 rounded-[1.25rem] border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-50/85">
                          Denne foto-post bruger automatisk billedtjek under spillet, så den har ikke svarmuligheder.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-4">
                          <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
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
                                    ? "border-amber-300/40 bg-amber-500/12 shadow-[0_14px_28px_rgba(251,191,36,0.12)]"
                                    : "border-amber-500/30 bg-amber-950/20 hover:border-amber-400/25"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => updateQuestion(question.id, { correctIndex: answerIndex })}
                                  aria-label={`Markér svar ${answerIndex + 1} som korrekt`}
                                  aria-pressed={isCorrectAnswer}
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black transition ${
                                    isCorrectAnswer
                                      ? "border-amber-200 bg-amber-300 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.24)]"
                                      : "border-amber-500/30 bg-amber-950/20 text-amber-100/78 hover:border-amber-300/30"
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
                                      ? "border-amber-200/60 bg-amber-300 text-slate-950"
                                      : "border-amber-500/30 bg-amber-950/20 text-amber-100/72 hover:border-amber-300/30 hover:text-amber-100"
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
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[1.35rem] border border-amber-500/30 bg-amber-500 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Ruler className="h-4 w-4" />
                      Hent pin til kortet
                    </button>

                    {question.lat !== null && question.lng !== null ? (
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <p className="text-xs text-amber-100/70">
                          Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                        </p>
                        <button
                          type="button"
                          onClick={() => updateQuestion(question.id, { lat: null, lng: null })}
                          disabled={isEditorBusy}
                          className="shrink-0 text-xs text-amber-300/60 underline underline-offset-2 hover:text-amber-200 disabled:pointer-events-none disabled:opacity-50"
                        >
                          Fjern placering
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}

              <div className="relative z-0 rounded-4xl border border-amber-500/30 bg-amber-950/20 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
                <div ref={addQuestionMenuAnchorRef} className="inline-flex max-w-full flex-col items-start">
                  <button
                    type="button"
                    onClick={() => setShowAddQuestionMenu((current) => !current)}
                    disabled={isEditorBusy}
                    className="inline-flex items-center gap-2 rounded-[1.4rem] border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-100 backdrop-blur-xl transition hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    aria-haspopup="menu"
                    aria-expanded={showAddQuestionMenu}
                  >
                    <Plus className="h-4 w-4" />
                    Tilføj post
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAddQuestionMenu ? "rotate-180" : ""}`} />
                  </button>
                </div>

                <div ref={saveFeedbackRef} className="mt-6 space-y-4">
                  {notice?.tone === "error" ? renderNotice() : null}
                  <button
                    type="button"
                    onClick={handleSaveRun}
                    disabled={isSaving}
                    className={`w-full rounded-[1.6rem] border border-amber-500/30 bg-amber-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-amber-500/20 transition-all duration-300 hover:bg-amber-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 ${
                      shouldHighlightSave
                        ? "scale-105 ring-4 ring-amber-500 ring-offset-2 ring-offset-slate-950 shadow-amber-500/50"
                        : ""
                    }`}
                  >
                    {isSaving ? "Gemmer..." : isEditMode ? "Gem ændringer i arkivet" : "Gem matematik-løb i arkivet"}
                  </button>
                </div>
              </div>
              </fieldset>
            </div>
          </section>

        <aside className="hidden w-full p-4 pt-0 sm:px-6 lg:block lg:w-[48%] lg:p-8 lg:pl-0 print:hidden">
          <div className="lg:sticky lg:top-20">
            <div className="h-[42vh] min-h-80 w-full overflow-hidden rounded-4xl border border-amber-500/20 bg-slate-900/50 shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_0_36px_rgba(251,191,36,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-(--spacing(28)))]">
              <MapPicker
                center={mapCenter}
                pins={pins}
                zones={previewZones}
                onCenterChange={setMapCenter}
                onPinClick={(pinId) => scrollToQuestionCard(Number(pinId))}
                onPinDragEnd={(pinId, coords) => updateQuestion(Number(pinId), { lat: coords.lat, lng: coords.lng })}
                autoLocateOnLoad={!isEditMode}
              />
            </div>
          </div>
        </aside>

        <PortalMenu
          open={showToolsMenu}
          anchorRef={toolsMenuAnchorRef}
          menuRef={toolsMenuPortalRef}
          align="end"
          className="w-[min(26rem,calc(100vw-2rem))] max-h-[min(32rem,calc(100vh-2rem))] overflow-x-hidden overflow-y-auto rounded-[1.6rem] border border-amber-400/20 bg-slate-950/96 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl overscroll-contain"
        >
          <div className="px-4 pb-2 pt-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100/45">Output</p>
          </div>

          <button type="button" onClick={handlePrintDraft} disabled={isEditorBusy} className={toolsMenuItemClass}>
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-amber-200">
              <Printer className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.16em]">Print udkast</span>
              <span className="mt-1 block text-sm leading-6 text-amber-100/72">Aabn den printvenlige version med titel, poster og svar.</span>
            </span>
          </button>

          <div className="mx-2 my-2 h-px bg-amber-400/10" />

          <div className="px-4 pb-2 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100/45">Avanceret</p>
          </div>

          <div className="space-y-4 px-4 py-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100/58">
                GPS-radius
              </label>
              <select
                value={radius}
                onChange={(event) => setRadius(normalizeRunRadius(event.target.value))}
                disabled={isEditorBusy}
                className="mt-2 w-full rounded-[1.15rem] border border-amber-400/20 bg-amber-950/35 px-4 py-3 text-sm font-semibold text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
              >
                {RUN_RADIUS_OPTIONS.map((radiusOption) => (
                  <option key={radiusOption} value={radiusOption} className="bg-slate-900 text-white">
                    {radiusOption} meter
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm leading-6 text-amber-100/68">
                Radius styrer, hvor tæt eleven skal være på posten. Klassetrin bliver i arbejdsfladen, fordi det styrer det faglige niveau.
              </p>
            </div>

            <div className="h-px bg-amber-400/10" />

            <div className="flex items-start gap-3 rounded-[1.25rem] text-left text-amber-50/90">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-amber-200">
                <SquareFunction className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-black uppercase tracking-[0.16em]">Builder-status</span>
                <span className="mt-1 block text-sm leading-6 text-amber-100/68">Klassetrin ligger fortsat synligt i arbejdsfladen, så du hurtigt kan justere både opgaver og assistenten undervejs.</span>
              </span>
            </div>
          </div>
        </PortalMenu>

        <PortalMenu
          open={showAddQuestionMenu}
          anchorRef={addQuestionMenuAnchorRef}
          menuRef={addQuestionMenuPortalRef}
          className="w-[min(22rem,calc(100vw-3rem))] max-h-[min(24rem,calc(100vh-2rem))] overflow-x-hidden overflow-y-auto rounded-[1.6rem] border border-amber-400/20 bg-slate-950/96 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl overscroll-contain"
        >
          <button
            type="button"
            onClick={() => {
              addQuestion();
              setShowAddQuestionMenu(false);
            }}
            disabled={isEditorBusy}
            className="flex w-full items-start gap-3 rounded-[1.25rem] px-4 py-3 text-left text-amber-50 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-amber-200">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.16em]">Opret ny post</span>
              <span className="mt-1 block text-sm leading-6 text-amber-100/72">
                Tilføj en tom matematik-post og byg den videre fra bunden.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={openReuseModal}
            disabled={isEditorBusy}
            className="flex w-full items-start gap-3 rounded-[1.25rem] px-4 py-3 text-left text-amber-50 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-amber-200">
              <BookOpen className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.16em]">Hent fra arkiv</span>
              <span className="mt-1 block text-sm leading-6 text-amber-100/72">
                Genbrug spørgsmål fra tidligere løb og placer dem på et nyt kort.
              </span>
            </span>
          </button>
        </PortalMenu>

        <InkSaverPrintLayout
          title={printTitle}
          subject={printSubject}
          classLevel={printClassLevel}
          questions={questions}
          fontClassName={rubik.className}
        />
      </div>
      </div>

      {showDraftRecoveryPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 py-10 backdrop-blur-md print:hidden">
          <div className="w-full max-w-2xl rounded-4xl border border-amber-400/25 bg-slate-950/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/70">Redningskrans</p>
            <h2 className={`mt-3 text-3xl font-black tracking-tight text-amber-50 ${rubik.className}`}>
              Vi fandt ugemte ændringer fra dit sidste besøg
            </h2>
            <p className="mt-4 text-sm leading-6 text-amber-100/80 sm:text-base">
              Hvis du fortsætter uden at gendanne kladden, beholder vi versionen fra arkivet og sletter den lokale kladde.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-3xl border border-amber-300/40 bg-amber-400 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300"
              >
                Gendan ugemte ændringer
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-3xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-amber-50 transition hover:bg-white/10"
              >
                Slet kladde
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingAiReviewDraft ? (
        <AiReviewDraftModal
          tone="amber"
          eyebrow="AI-kladde"
          title="Gennemse før du anvender"
          description="Assistenten har bygget et komplet matematik-udkast. Tjek resuméet herunder, før du anvender det i builderen."
          warning={
            pendingAiReviewDraft.replacesExistingContent
              ? "Dit nuværende indhold bliver erstattet, hvis du vælger at anvende kladden."
              : null
          }
          summaryItems={[
            { label: "Titel", value: pendingAiReviewDraft.title },
            { label: "Fag", value: pendingAiReviewDraft.subject || MATH_SUBJECT },
            { label: "Klassetrin", value: pendingAiReviewGradeLabel },
            { label: "Antal poster", value: pendingAiReviewDraft.questions.length },
          ]}
          detailItems={[
            { label: "Matematisk emne", value: pendingAiReviewDraft.mathTopic || "Ikke angivet" },
          ]}
          cancelLabel="Annuller"
          applyLabel="Anvend kladde"
          headingClassName={rubik.className}
          onCancel={closeAiReviewDraft}
          onApply={applyAiReviewDraft}
        />
      ) : null}

      <ManualReuseModal
        open={showReuseModal}
        currentRunId={editRunId || undefined}
        onClose={closeReuseModal}
        normalizeQuestions={normalizeQuestionsForReuse}
        onImportQuestion={handleImportReuseQuestion}
      />

      <MathAiInterviewModal
        open={showAiInterviewModal}
        topicSuggestions={SUBJECT_TOPICS.Matematik}
        onClose={closeAiInterviewModal}
        onComplete={handleAiInterviewComplete}
      />
    </>
  );
}
