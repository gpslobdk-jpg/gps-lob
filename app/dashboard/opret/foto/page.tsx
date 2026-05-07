"use client";

import { Camera, ChevronDown, Loader2, Plus, Ruler, Sparkles, Trash2, Wrench } from "lucide-react";
import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import AiReviewDraftModal from "@/components/builders/AiReviewDraftModal";
import FotoAiInterviewModal, {
  type FotoAiInterviewDraft,
} from "@/components/builders/foto/FotoAiInterviewModal";
import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import { useBuilderSaveGuidance } from "@/components/builders/useBuilderSaveGuidance";
import type { SavedPin, SavedZone } from "@/components/MapPicker";
import {
  DEFAULT_MAP_CENTER,
  RACE_TYPES,
  type StoredRunRecord,
  asNumberOrNull,
  asTrimmedString,
  isRecord,
  toQuestionId,
} from "@/utils/gpsRuns";
import { findNearbyPinConflict, findOverlappingPinGroups } from "@/utils/pinProximity";
import {
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
    <div className="h-full w-full animate-pulse rounded-3xl border border-sky-500/20 bg-slate-900/60" />
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
  Dansk: ["Læsning & Forståelse", "Stavning & Grammatik", "Nordisk Mytologi", "H.C. Andersen & Eventyr", "Analyse af kortfilm/reklamer"],
  Matematik: ["Geometri & Figurer", "Brøker & Procenter", "Algebra & Ligninger", "Sandsynlighed & Statistik", "Praktisk regning i hverdagen"],
  Engelsk: ["Grammatik & Bøjninger", "Hverdagsordforråd", "Britisk kultur", "Amerikansk kultur", "Reading Comprehension"],
  "Natur/Teknologi": ["Solsystemet", "Menneskekroppen", "Vejr & Klima", "Vandets kredsløb", "Dyr & Planter i Danmark"],
  Historie: ["Vikingetiden", "Middelalderen", "2. Verdenskrig", "Den Kolde Krig", "Danmarks kongerække"],
  Idræt: ["Boldspil & Regler", "Anatomi & Puls", "De Olympiske Lege", "Sundhed & Kost"],
  Kristendomskundskab: ["Bibelske fortællinger", "Verdensreligioner (Islam, Jødedom m.fl.)", "Etik, moral & filosofi"],
  Tysk: ["Ordforråd (Hverdag)", "Grammatik (Der/die/das)", "Tysk geografi & kultur"],
  Fransk: ["Ordforråd & Udtale", "Fransk kultur & geografi", "Grundlæggende grammatik"],
  Geografi: ["Jordens opbygning & pladetektonik", "Klima & Plantebælter", "Demografi & Befolkning", "Bæredygtighed & Energi"],
  Biologi: ["Økosystemer & Fødekæder", "Celler & Mikroorganismer", "Genetik & DNA", "Evolution"],
  "Fysik/Kemi": ["Det periodiske system", "Energi & Kræfter", "Atomer & Molekyler", "Elektricitet & Magnetisme"],
  Samfundsfag: ["Demokrati & Politik", "Velfærdssamfundet", "Økonomi", "EU & Internationale forhold"],
  "Håndværk/Design": ["Materialekendskab (Træ/Metal)", "Værktøj & Sikkerhed", "Designprocessen"],
  Billedkunst: ["Kunsthistorie & Epoker", "Farvelære & Komposition", "Kendte kunstnere (Picasso, Monet m.fl.)"],
  Madkundskab: ["Hygiejne i køkkenet", "Ernæring & Madpyramiden", "Råvarekendskab", "Grundtilberedning"],
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

type MapCenter = {
  lat: number;
  lng: number;
};

type StoredPhotoQuestionRecord = {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  aiPrompt?: unknown;
  ai_prompt?: unknown;
  answers?: unknown;
  mediaUrl?: unknown;
  media_url?: unknown;
  points?: unknown;
  lat?: unknown;
  lng?: unknown;
};

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
function normalizePendingFotoAiReviewDraft(value: unknown): PendingFotoAiReviewDraft | null {
  if (!isRecord(value)) return null;

  const title = asTrimmedString(value.title);
  const subject = asTrimmedString(value.subject) || PHOTO_SUBJECT_FALLBACK;
  const missions = (Array.isArray(value.missions) ? value.missions : [])
    .map((mission) => asTrimmedString(mission))
    .filter((mission): mission is string => mission.length > 0);

  if (!title || missions.length === 0) {
    return null;
  }

  return {
    title,
    subject,
    missions,
    replacesExistingContent: Boolean(value.replacesExistingContent),
  };
}
const buildPhotoAnswers = (targetObject: string): [string, string, string, string] => [
  targetObject.trim(),
  "",
  "",
  "",
];

function getStoredPhotoTarget(candidate: StoredPhotoQuestionRecord) {
  const normalizedPrompt = asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt);
  if (normalizedPrompt) return normalizedPrompt;

  if (Array.isArray(candidate.answers)) {
    const firstAnswer = candidate.answers.find((answer): answer is string => typeof answer === "string");
    return asTrimmedString(firstAnswer);
  }

  return "";
}

function normalizeRunRadius(value: unknown) {
  const parsed = asNumberOrNull(value);
  return parsed !== null && RUN_RADIUS_OPTIONS.includes(parsed as (typeof RUN_RADIUS_OPTIONS)[number])
    ? parsed
    : DEFAULT_RUN_RADIUS;
}

const textInputClass =
  "w-full rounded-2xl border border-sky-500/30 bg-sky-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const textareaClass =
  "w-full rounded-2xl border border-sky-500/30 bg-sky-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const toolsTriggerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-sky-500/25 bg-sky-950/30 px-4 py-2.5 text-sm font-semibold text-sky-50 transition hover:bg-sky-900/35 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const toolsMenuItemClass =
  "flex w-full items-start gap-3 rounded-[1.25rem] px-4 py-3 text-left text-sky-50 transition hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-50";

const PORTAL_MENU_GAP = 12;
const PORTAL_MENU_MARGIN = 16;
function normalizeQuestionPoints(value: unknown) {
  const parsed = asNumberOrNull(value);
  return parsed !== null ? Math.max(0, Math.round(parsed)) : DEFAULT_QUESTION_POINTS;
}
// Place constants and helper functions after type definitions
const DEFAULT_RUN_RADIUS = 15;
const RUN_RADIUS_OPTIONS = [15, 30, 50] as const;
const PHOTO_SUBJECT_FALLBACK = "Generelt";

const createQuestion = (): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type: "ai_image",
  text: "",
  aiPrompt: "",
  mediaUrl: "",
  answers: ["", "", "", ""],
  correctIndex: 0,
  points: DEFAULT_QUESTION_POINTS,
  lat: null,
  lng: null,
});
// Place type and constant definitions after SUBJECT_TOPICS
type BuilderNotice = {
  tone: "success" | "error";
  message: string;
};

type PendingFotoAiReviewDraft = FotoAiInterviewDraft & {
  subject: string;
  replacesExistingContent: boolean;
};

const FOTO_DRAFT_STORAGE_KEY = "draft_run_foto";
const DEFAULT_QUESTION_POINTS = 10;

type FotoBuilderDraftState = {
  title?: unknown;
  subject?: unknown;
  radius?: unknown;
  showTeacherField?: unknown;
  showAiInterviewModal?: unknown;
  pendingAiReviewDraft?: unknown;
  questions?: unknown;
  mapCenter?: unknown;
};

function toPhotoQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const timestamp = Date.now();

  return value
    .map((item, index): Question | null => {
      if (!isRecord(item)) return null;

      const candidate = item as StoredPhotoQuestionRecord;

      return {
        id: toQuestionId(candidate.id, timestamp + index),
        type: "ai_image",
        text: asTrimmedString(candidate.text),
        aiPrompt: getStoredPhotoTarget(candidate),
        mediaUrl: asTrimmedString(candidate.mediaUrl ?? candidate.media_url),
        answers: buildPhotoAnswers(getStoredPhotoTarget(candidate)),
        correctIndex: 0,
        points: normalizeQuestionPoints(candidate.points),
        lat: asNumberOrNull(candidate.lat),
        lng: asNumberOrNull(candidate.lng),
      };
    })
    .filter((question): question is Question => question !== null);
}

function normalizePhotoInstruction(text: string, targetObject: string) {
  const trimmedText = text.trim();
  const trimmedTarget = targetObject.trim();

  if (!trimmedText && !trimmedTarget) return "";
  if (!trimmedText && trimmedTarget) {
    return `Find ${trimmedTarget.toLowerCase()} og tag et tydeligt billede af det.`;
  }

  const lower = trimmedText.toLocaleLowerCase("da-DK");
  if (
    lower.startsWith("find ") ||
    lower.startsWith("tag ") ||
    lower.startsWith("fotograf") ||
    lower.startsWith("gå på jagt")
  ) {
    return trimmedText;
  }

  if (trimmedTarget) {
    return `Find ${trimmedTarget.toLowerCase()} og tag et tydeligt billede af det.`;
  }

  return trimmedText;
}

function extractPhotoTargetFromMission(mission: string) {
  const trimmedMission = mission.trim();
  if (!trimmedMission) return "";

  const patterns = [
    /^find\s+(.+?)\s+og\s+tag\b/i,
    /^find\s+(.+?)\s+og\s+fotograf/i,
    /^tag et (?:tydeligt\s+)?billede af\s+(.+?)(?:[.!?]|$)/i,
    /^fotograf(?:er|ér)\s+(.+?)(?:[.!?]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmedMission.match(pattern);
    if (!match?.[1]) continue;

    const candidate = match[1]
      .replace(
        /\s+(?:i|på|ved|hos|fra|omkring)\s+(?:jeres|dit|din|skolen|skolegården|området|nærheden|lokalområdet|omgivelser(?:ne)?|hverdagen|byen|parken|naturen)\b.*$/i,
        ""
      )
      .replace(/[.,!?]+$/g, "")
      .trim();

    if (candidate) {
      return candidate;
    }
  }

  return trimmedMission.replace(/[.!?]+$/g, "").trim();
}

function toInterviewMissionQuestions(missions: FotoAiInterviewDraft["missions"]): Question[] {
  const timestamp = Date.now();

  return missions
    .map((mission, index): Question | null => {
      const text = mission.trim();
      const targetObject = extractPhotoTargetFromMission(text);
      const instruction = normalizePhotoInstruction(text, targetObject);

      if (!instruction || !targetObject) {
        return null;
      }

      return {
        id: timestamp + index,
        type: "ai_image",
        text: instruction,
        aiPrompt: targetObject,
        mediaUrl: "",
        answers: buildPhotoAnswers(targetObject),
        correctIndex: 0,
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
  question.lat === null &&
  question.lng === null;


export default function FotoMissionBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className={`min-h-screen bg-sky-950 ${poppins.className}`}>
          <div className="flex min-h-screen items-center justify-center px-6 text-center">
            <div className="rounded-[2rem] border border-sky-500/30 bg-sky-950/20 px-8 py-10 text-sky-100 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <p className="text-xs font-semibold tracking-[0.28em] text-sky-100/55 uppercase">
                Indlæser
              </p>
              <h1 className={`mt-3 text-3xl font-black tracking-tight text-sky-100 ${rubik.className}`}> 
                Foto-bygger
              </h1>
            </div>
          </div>
        </div>
      }
    >
      <FotoMissionBuilderPageContent />
    </Suspense>
  );
}


function FotoMissionBuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [radius, setRadius] = useState<number>(DEFAULT_RUN_RADIUS);
  const [showTeacherField, setShowTeacherField] = useState(false);
  const [showAiInterviewModal, setShowAiInterviewModal] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([createQuestion()]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [showDraftRecoveryPrompt, setShowDraftRecoveryPrompt] = useState(false);
  const [pendingAiReviewDraft, setPendingAiReviewDraft] = useState<PendingFotoAiReviewDraft | null>(null);
  const isEditorBusy = isSaving || showDraftRecoveryPrompt;
  const editorLockClass = isEditorBusy ? "pointer-events-none opacity-50" : "";
  const [mapCenter, setMapCenter] = useState<MapCenter>({
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
  });
  const builderStatusLabel = isSaving ? "Gemmer..." : "Gemmes lokalt";
  const builderStatusDescription = isSaving
    ? "Vi sender dine seneste ændringer til arkivet nu."
    : "Titel, emne og missioner bliver gemt lokalt undervejs, indtil du trykker på Gem.";
  const pendingAiReviewPreviewMission =
    pendingAiReviewDraft?.missions.find((mission) => mission.trim().length > 0) ?? "";

  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const toolsMenuAnchorRef = useRef<HTMLDivElement | null>(null);
  const toolsMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedDraftRef = useRef(false);
  const shouldAutoRestoreDraftRef = useRef<boolean | null>(null);
  const pendingScrollTargetId = useRef<string | null>(null);

  const normalizedQuestionsForSave = useMemo(
    () =>
      questions
        .map((question) => {
          const normalizedTarget = question.aiPrompt.trim();

          return {
            ...question,
            type: "ai_image" as const,
            text: question.text.trim(),
            aiPrompt: normalizedTarget,
            answers: buildPhotoAnswers(normalizedTarget),
            correctIndex: 0,
            points: normalizeQuestionPoints(question.points),
            mediaUrl: question.mediaUrl.trim(),
          };
        })
        .filter(
          (question) =>
            question.text.length > 0 ||
            question.aiPrompt.length > 0 ||
            question.lat !== null ||
            question.lng !== null
        ),
    [questions]
  );
  const hasIncompleteQuestions = useMemo(
    () => normalizedQuestionsForSave.some((question) => !question.text || !question.aiPrompt),
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

  const applyDraftState = (draft: FotoBuilderDraftState) => {
    const restoredSubject = restoreDraftString(draft.subject);
    const restoredQuestions = toPhotoQuestions(draft.questions);
    const restoredPendingAiReviewDraft = normalizePendingFotoAiReviewDraft(draft.pendingAiReviewDraft);

    setTitle(restoreDraftString(draft.title));
    setSubject(restoredSubject);
    setRadius(normalizeRunRadius(draft.radius));
    setShowTeacherField(restoreDraftBoolean(draft.showTeacherField, Boolean(restoredSubject.trim())));
    setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion()]);
    setShowAiInterviewModal(
      restoredPendingAiReviewDraft ? false : restoreDraftBoolean(draft.showAiInterviewModal)
    );
    setPendingAiReviewDraft(restoredPendingAiReviewDraft);
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

  // Smooth scroll to question card (pendingScrollTargetId logic)
  const scrollToQuestionCard = (id: number) => {
    if (typeof document === "undefined") return;
    document.getElementById(`foto-post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!pendingScrollTargetId.current || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const targetId = pendingScrollTargetId.current;
    const frameId = window.requestAnimationFrame(() => {
      const targetEl = document.getElementById(`foto-post-${targetId}`);
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
    if (!showToolsMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (toolsMenuAnchorRef.current?.contains(event.target as Node)) return;
      if (toolsMenuPortalRef.current?.contains(event.target as Node)) return;
      setShowToolsMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowToolsMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showToolsMenu]);

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
          .select("id,user_id,title,subject,description,topic,questions,race_type,radius")
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

        const loadedQuestions = toPhotoQuestions(run.questions);
        const firstPinnedQuestion =
          loadedQuestions.find((question) => question.lat !== null && question.lng !== null) ?? null;

        setTitle(asTrimmedString(run.title));
        setSubject(asTrimmedString(run.subject));
        setRadius(normalizeRunRadius(run.radius));
        setShowTeacherField(Boolean(asTrimmedString(run.subject)));
        setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion()]);
        setShowAiInterviewModal(false);
        setPendingAiReviewDraft(null);
        setMapCenter(
          firstPinnedQuestion
            ? {
                lat: firstPinnedQuestion.lat ?? DEFAULT_MAP_CENTER.lat,
                lng: firstPinnedQuestion.lng ?? DEFAULT_MAP_CENTER.lng,
              }
            : {
                lat: DEFAULT_MAP_CENTER.lat,
                lng: DEFAULT_MAP_CENTER.lng,
              }
        );
        setLoadedRunId(run.id);
      } catch (error) {
        console.error("Kunne ikke indlæse foto-løbet til redigering:", error);
        if (!isActive) return;
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette foto-løb til redigering. Prøv igen fra arkivet om et øjeblik.",
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
  }, [editRunId, isEditMode]);

  useEffect(() => {
    if (hasInitializedDraftRef.current) return;

    if (shouldAutoRestoreDraftRef.current === null) {
      shouldAutoRestoreDraftRef.current = shouldRestoreRunDraftOnLoad(FOTO_DRAFT_STORAGE_KEY);
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
      ? readRunDraft<FotoBuilderDraftState>(FOTO_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      applyDraftState(restoredDraft);
      setNotice(null);
      hasInitializedDraftRef.current = true;
      return;
    }

    if (isEditMode && !shouldAutoRestoreDraft && hasUnsavedDraft(FOTO_DRAFT_STORAGE_KEY, editRunId)) {
      setShowDraftRecoveryPrompt(true);
      hasInitializedDraftRef.current = true;
      return;
    }

    hasInitializedDraftRef.current = true;
  }, [editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;
    if (showDraftRecoveryPrompt) return;

    writeRunDraft(FOTO_DRAFT_STORAGE_KEY, editRunId, {
      title,
      subject,
      radius,
      showTeacherField,
      showAiInterviewModal,
      pendingAiReviewDraft,
      questions,
      mapCenter,
    } satisfies FotoBuilderDraftState);
  }, [
    editRunId,
    mapCenter,
    pendingAiReviewDraft,
    questions,
    radius,
    showAiInterviewModal,
    showTeacherField,
    showDraftRecoveryPrompt,
    subject,
    title,
  ]);

  const handleRestoreDraft = () => {
    const restoredDraft = readRunDraft<FotoBuilderDraftState>(FOTO_DRAFT_STORAGE_KEY, editRunId);

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
    clearRunDraft(FOTO_DRAFT_STORAGE_KEY);
    setShowDraftRecoveryPrompt(false);
    setNotice({
      tone: "success",
      message: "Den lokale kladde blev slettet. Du arbejder nu videre på versionen fra arkivet.",
    });
  };

  const pins = useMemo<SavedPin[]>(
    () =>
      questions
        .map((question, index) =>
          question.lat !== null && question.lng !== null
            ? { id: String(question.id), lat: question.lat, lng: question.lng, number: index + 1 }
            : null
        )
        .filter((pin): pin is SavedPin => pin !== null),
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

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-[1.4rem] border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-sky-300/30 bg-sky-500/10 text-sky-50"
            : "border-red-300/30 bg-red-500/10 text-red-100"
        } ${className}`}
      >
        {notice.message}
      </div>
    ) : null;

  const addQuestion = () => {
    setQuestions((current) => [...current, createQuestion()]);
  };

  const updateQuestion = (id: number, updates: Partial<Question>) => {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...updates } : question))
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
    updateQuestion(id, { lat: mapCenter.lat, lng: mapCenter.lng });
  };

  const openAiInterviewModal = () => {
    setNotice(null);
    setShowAiInterviewModal(true);
  };

  const closeAiInterviewModal = () => {
    setNotice(null);
    setShowAiInterviewModal(false);
  };

  const handleAiInterviewComplete = (draft: FotoAiInterviewDraft) => {
    const nextTitle = draft.title.trim();
    const hasExistingContent =
      title.trim().length > 0 ||
      subject.trim().length > 0 ||
      questions.some((question) => !isQuestionEmpty(question));

    setPendingAiReviewDraft({
      title: nextTitle,
      subject: subject.trim() || PHOTO_SUBJECT_FALLBACK,
      missions: draft.missions.map((mission) => mission.trim()).filter((mission) => mission.length > 0),
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
        : "Smart-udkastet blev lukket uden at blive anvendt.",
    });
  };

  const applyAiReviewDraft = () => {
    if (!pendingAiReviewDraft) return;

    const nextTitle = pendingAiReviewDraft.title.trim();
    const nextQuestions = toInterviewMissionQuestions(pendingAiReviewDraft.missions);

    if (!nextTitle || nextQuestions.length === 0) {
      setPendingAiReviewDraft(null);
      setNotice({
        tone: "error",
        message: "Det auto-genererede udkast kunne ikke bruges. Prøv igen.",
      });
      return;
    }

    setTitle(nextTitle);
    setQuestions([...nextQuestions]);
    setShowTeacherField(Boolean(pendingAiReviewDraft.subject.trim()));
    setPendingAiReviewDraft(null);
    setNotice({
      tone: "success",
      message: "Et komplet udkast er klar til dit foto-løb. Gennemgå felterne og placer missionerne på kortet.",
    });
  };

  const handleSaveRun = async () => {
    setNotice(null);
    let shouldReturn = false;

    if (isEditMode && loadedRunId !== editRunId) {
      setNotice({
        tone: "error",
        message: "Løbet er ikke indlæst endnu. Vent et øjeblik og prøv igen.",
      });
      scrollToSaveFeedback();
      shouldReturn = true;
    } else if (!title.trim()) {
      setNotice({ tone: "error", message: "Udfyld venligst løbets titel." });
      scrollToSaveFeedback();
      shouldReturn = true;
    } else if (normalizedQuestionsForSave.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst én udfyldt mission." });
      scrollToSaveFeedback();
      shouldReturn = true;
    } else if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message: "Udfyld både hvad de skal finde og instruktionen på hver mission.",
      });
      scrollToSaveFeedback();
      shouldReturn = true;
    } else if (hasMissingCoordinates) {
      setNotice({
        tone: "error",
        message: "Du mangler at placere alle poster på kortet.",
      });
      scrollToSaveFeedback();
      shouldReturn = true;
    }

    if (shouldReturn) return;

    setIsSaving(true);

    try {
      const normalizedTopic = title.trim();
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
        description: "",
        topic: normalizedTopic,
        questions: normalizedQuestionsForSave,
        radius,
        race_type: RACE_TYPES.FOTO,
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
        message: isEditMode ? "Ændringerne er gemt i arkivet!" : "Foto-missionen er gemt i arkivet!",
      });
      clearRunDraft(FOTO_DRAFT_STORAGE_KEY);

      if (!isEditMode) {
        setTitle("");
        setSubject("");
        setRadius(DEFAULT_RUN_RADIUS);
        setShowTeacherField(false);
        setPendingAiReviewDraft(null);
        setQuestions([createQuestion()]);
      }

      await new Promise((resolve) => window.setTimeout(resolve, 450));
      router.push("/dashboard/arkiv");
    } catch (error) {
      console.error("Fejl ved gemning af foto-mission:", error);
      setNotice({ tone: "error", message: "Kunne ikke gemme løbet. Prøv igen." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditMode && isLoadingExistingRun) {
    return (
      <div className={`relative min-h-screen overflow-hidden bg-sky-950 text-sky-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-sky-500/30 bg-sky-950/20 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-sky-300" />
            <p className="mt-5 text-xs font-semibold tracking-[0.28em] text-sky-100/55 uppercase">
              Rediger løb
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight text-sky-100 ${rubik.className}`}>
              Indlæser dine foto-missioner
            </h1>
            <p className="mt-3 text-sm leading-6 text-sky-100/70">
              Vi henter løbets data og klargør builderen til redigering.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative min-h-screen bg-sky-950 text-sky-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-linear-to-br from-sky-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row">
          <MobileBuilderWarning />
          <section className="relative hidden w-full overflow-visible px-4 py-4 sm:px-6 sm:py-6 lg:block lg:w-[52%] lg:overflow-visible lg:px-8 lg:py-8 print:hidden">
            <div className="relative z-10 mx-auto max-w-3xl">
              <fieldset
                disabled={isEditorBusy}
                aria-busy={isEditorBusy}
                className={`min-w-0 space-y-5 border-0 p-0 ${editorLockClass}`}
              >
                <div className="px-1 pt-1">
                  {isEditMode ? (
                    <div className="mb-4 inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-sky-100 uppercase">
                      Edit-mode
                    </div>
                  ) : null}

                  <div className="relative z-40 mb-8 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.55rem] border border-white/80 bg-white px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-6px_12px_rgba(12,74,110,0.08),0_18px_38px_rgba(255,255,255,0.16),0_14px_28px_rgba(14,165,233,0.18)] ring-1 ring-sky-200/55">
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-2 top-1 h-px rounded-full bg-white/95"
                        />
                        <span className="relative flex h-full w-full items-center justify-center rounded-[1.05rem] bg-linear-to-br from-sky-100 via-white to-sky-200 text-sky-950 shadow-[inset_0_-8px_16px_rgba(14,165,233,0.12)]">
                          <Sparkles className="h-6 w-6" />
                        </span>
                        <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-sky-900/10 bg-sky-500 text-white shadow-[0_8px_18px_rgba(14,165,233,0.35)]">
                          <Camera className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-sky-100">Velkommen til Fotoløb</h3>
                        <p className="mt-1 text-sm text-sky-100/80">
                          Byg kreative foto-missioner, placer dem på kortet, og lad smart-assistenten klargøre et første udkast, som du kan gennemse, før det lander i builderen.
                        </p>
                      </div>
                    </div>

                    <div className="relative z-40 rounded-4xl border border-sky-500/30 bg-sky-950/20 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <label className="block text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                              Løbets titel
                            </label>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 print:hidden">
                            <button
                              type="button"
                              onClick={openAiInterviewModal}
                              disabled={isEditorBusy}
                              className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/15 px-4 py-2 text-sm font-bold text-sky-50 shadow-[0_0_24px_rgba(14,165,233,0.15)] backdrop-blur-xl transition-all hover:bg-sky-500/25 hover:shadow-[0_0_32px_rgba(14,165,233,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Sparkles className="h-4 w-4" />
                              Foto Assistenten
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
                          placeholder="F.eks. Foto-eventyr i Vordingborg"
                          className="w-full rounded-[1.6rem] border border-sky-500/30 bg-sky-950/20 px-5 py-4 text-xl font-bold text-slate-100 placeholder:text-slate-500 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="relative z-0 rounded-3xl border border-sky-500/30 bg-sky-950/20 p-4 backdrop-blur-xl">
                        <div>
                          <div className="mb-3 flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10 text-sky-200">
                              <Sparkles className="h-4 w-4" />
                            </span>
                            <label className="text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                              Emne
                            </label>
                          </div>

                          <select
                            value={subject}
                            onChange={(event) => {
                              const nextSubject = event.target.value;
                              setSubject(nextSubject);
                              setShowTeacherField(Boolean(nextSubject.trim()));
                            }}
                            disabled={isEditorBusy}
                            className="w-full rounded-[1.35rem] border border-sky-500/30 bg-sky-950/20 px-4 py-3 text-sm font-semibold text-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
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

                          <p className="mt-3 text-sm text-sky-100/70">
                            {subject.trim()
                              ? `Valgt: ${subject.trim()}`
                              : "Intet emne valgt endnu. Du kan stadig bygge løbet videre og vælge senere."}
                          </p>
                        </div>
                    </div>
                  </div>
                </div>

              <div className="relative z-0 space-y-5 lg:pr-2">
              <div className="space-y-4 px-1">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-xs font-semibold tracking-[0.24em] text-sky-100/65 uppercase">
                    Dine missioner
                  </p>
                  <span className="rounded-full border border-sky-500/30 bg-sky-950/20 px-4 py-2 text-sm font-semibold text-sky-100/80 backdrop-blur-xl">
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

              {questions.map((question, index) => (
                <article
                  key={question.id}
                  id={`foto-post-${question.id}`}
                  className="relative z-0 rounded-[1.8rem] border border-sky-500/30 bg-sky-950/20 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className={`text-lg font-bold text-sky-100 ${rubik.className}`}>
                      Mission {index + 1}
                    </h3>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <label className="flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-950/20 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-sky-100/75 uppercase backdrop-blur-xl">
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
                          className="w-16 bg-transparent text-right text-sm font-semibold tracking-normal text-sky-50 focus:outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== index))}
                        disabled={isEditorBusy || questions.length <= 1}
                        aria-label={`Slet mission ${index + 1}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sky-500/30 bg-sky-950/20 text-sky-100/75 transition hover:border-rose-300/40 hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                      Hvad skal AI&apos;en lede efter?
                    </label>
                    <input
                      value={question.aiPrompt}
                      onChange={(event) =>
                        updateQuestion(question.id, { aiPrompt: event.target.value })
                      }
                      placeholder="fx Bøgeblad, Rød postkasse, Sten"
                      className={textInputClass}
                    />
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                      Instruktion
                    </label>
                    <textarea
                      value={question.text}
                      onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                      rows={4}
                      placeholder="f.eks. Find et stort egetræ og tag et sjovt holdbillede med det. Billederne uploades direkte fra ruten, så læreren kan se og godkende dem bagefter."
                      className={textareaClass}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => assignPinFromCenter(question.id)}
                    disabled={isEditorBusy}
                    className="mt-4 w-full rounded-[1.35rem] border border-sky-500/30 bg-sky-500 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-sky-500/20 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                  >
                    Hent pin til kortet
                  </button>

                  {question.lat !== null && question.lng !== null ? (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs text-sky-100/70">
                        Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                      </p>
                      <button
                        type="button"
                        onClick={() => updateQuestion(question.id, { lat: null, lng: null })}
                        disabled={isEditorBusy}
                        className="shrink-0 text-xs text-sky-300/60 underline underline-offset-2 hover:text-sky-200 disabled:pointer-events-none disabled:opacity-50"
                      >
                        Fjern placering
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}

                <div className="relative z-0 rounded-[1.8rem] border border-sky-500/30 bg-sky-950/20 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="inline-flex items-center gap-2 rounded-[1.4rem] border border-sky-500/30 bg-sky-950/20 px-4 py-3 text-sm font-semibold text-sky-100 backdrop-blur-xl transition hover:bg-sky-900/30"
                  >
                    <Plus className="h-4 w-4" />
                    Tilføj ny mission
                  </button>

                  <div ref={saveFeedbackRef} className="mt-6 space-y-4">
                    {notice?.tone === "error" ? renderNotice() : null}
                    <button
                      type="button"
                      onClick={handleSaveRun}
                      disabled={isSaving}
                      className={`w-full rounded-[1.6rem] border border-sky-500/30 bg-sky-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-sky-500/20 transition-all duration-300 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                        shouldHighlightSave
                          ? "scale-105 ring-4 ring-sky-400 ring-offset-2 ring-offset-slate-950 shadow-sky-400/50"
                          : ""
                      }`}
                    >
                      {isSaving ? "Gemmer..." : isEditMode ? "Gem ændringer i arkivet" : "Gem løb i arkivet"}
                    </button>
                  </div>
                </div>
              </div>
              </fieldset>
            </div>
          </section>

          <aside className="hidden w-full p-4 pt-0 sm:px-6 lg:block lg:w-[48%] lg:p-8 lg:pl-0 print:hidden">
            <div className="lg:sticky lg:top-20">
              <div className="h-[42vh] min-h-80 w-full overflow-hidden rounded-4xl border border-sky-500/20 bg-slate-900/60 shadow-[0_0_0_1px_rgba(14,165,233,0.08),0_0_36px_rgba(14,165,233,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-(--spacing(28)))]">
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
            className="w-[min(26rem,calc(100vw-2rem))] max-h-[min(32rem,calc(100vh-2rem))] overflow-x-hidden overflow-y-auto rounded-[1.6rem] border border-sky-400/20 bg-slate-950/96 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl overscroll-contain"
          >
            <div className="px-4 pb-2 pt-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-100/45">Opret hurtigt</p>
            </div>

            <button
              type="button"
              onClick={openAiInterviewModal}
              disabled={isEditorBusy}
              className={toolsMenuItemClass}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10 text-sky-200">
                <Sparkles className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-black uppercase tracking-[0.16em]">Smart-assistent til foto-missioner</span>
                <span className="mt-1 block text-sm leading-6 text-sky-100/72">
                  Byg et komplet foto-løb med titel og missioner, og gennemse det før det lander i builderen.
                </span>
              </span>
            </button>

            <div className="mx-2 my-2 h-px bg-sky-400/10" />

            <div className="px-4 pb-2 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-100/45">Avanceret</p>
            </div>

            <div className="space-y-4 px-4 py-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-sky-100/58">
                  GPS-radius
                </label>
                <select
                  value={radius}
                  onChange={(event) => setRadius(normalizeRunRadius(event.target.value))}
                  disabled={isEditorBusy}
                  className="mt-2 w-full rounded-[1.15rem] border border-sky-400/20 bg-sky-950/35 px-4 py-3 text-sm font-semibold text-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                >
                  {RUN_RADIUS_OPTIONS.map((radiusOption) => (
                    <option key={radiusOption} value={radiusOption} className="bg-slate-900 text-white">
                      {radiusOption} meter
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm leading-6 text-sky-100/68">
                  Vælg hvor tæt eleven skal være på posten, før GPS-låsen åbner under spillet.
                </p>
              </div>

              <div className="h-px bg-sky-400/10" />

              <div className="flex items-start gap-3 rounded-[1.25rem] text-left text-sky-50/90">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10 text-sky-200">
                  <Ruler className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-black uppercase tracking-[0.16em]">Builder-status</span>
                  <span className="mt-1 block text-sm leading-6 text-sky-100/68">
                    {builderStatusDescription}
                  </span>
                </span>
              </div>
            </div>
          </PortalMenu>
        </div>
      </div>

      {showDraftRecoveryPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 py-10 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-[2rem] border border-sky-400/30 bg-slate-950/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-100/70">Redningskrans</p>
            <h2 className={`mt-3 text-3xl font-black tracking-tight text-sky-50 ${rubik.className}`}>
              Vi fandt ugemte ændringer fra dit sidste besøg
            </h2>
            <p className="mt-4 text-sm leading-6 text-sky-100/80 sm:text-base">
              Hvis du fortsætter uden at gendanne kladden, beholder vi versionen fra arkivet og sletter den lokale kladde.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-[1.5rem] border border-sky-300/40 bg-sky-400 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-300"
              >
                Gendan ugemte ændringer
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-[1.5rem] border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-sky-50 transition hover:bg-white/10"
              >
                Slet kladde
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingAiReviewDraft ? (
        <AiReviewDraftModal
          tone="sky"
          eyebrow="Smart-udkast"
          title="Review & Confirm"
          description="Assistenten har bygget et komplet foto-udkast. Tjek resuméet herunder, og bekræft før det lander i builderen."
          warning={
            pendingAiReviewDraft.replacesExistingContent
              ? "Dit nuværende indhold bliver erstattet, hvis du vælger at anvende kladden."
              : null
          }
          summaryItems={[
            { label: "Titel", value: pendingAiReviewDraft.title },
            { label: "Emne", value: pendingAiReviewDraft.subject || PHOTO_SUBJECT_FALLBACK },
            { label: "Antal missioner", value: pendingAiReviewDraft.missions.length },
            { label: "Format", value: "Foto-missioner" },
          ]}
          detailItems={
            pendingAiReviewPreviewMission
              ? [{ label: "Første mission", value: pendingAiReviewPreviewMission }]
              : []
          }
          cancelLabel="Annuller"
          applyLabel="Anvend kladde"
          headingClassName={rubik.className}
          onCancel={closeAiReviewDraft}
          onApply={applyAiReviewDraft}
        />
      ) : null}

      <FotoAiInterviewModal
        open={showAiInterviewModal}
        initialSubject={subject}
        onClose={closeAiInterviewModal}
        onComplete={handleAiInterviewComplete}
      />
    </>
  );
}
