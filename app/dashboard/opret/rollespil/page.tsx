"use client";

import FocusModeSetting from "@/components/focus/FocusModeSetting";
import { useBuilderFocusMode } from "@/hooks/useBuilderFocusMode";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { poppins, rubik } from "@/lib/fonts";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import RollespilAiInterviewModal, {
  type RollespilAiInterviewDraft,
  type RollespilAiInterviewQuestion,
} from "@/components/builders/rollespil/RollespilAiInterviewModal";
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
    <div className="h-full w-full animate-pulse rounded-3xl border border-violet-500/20 bg-slate-900/60" />
  ),
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
  type: "multiple_choice";
  postType?: "quiz" | "intro";
  text: string;
  aiPrompt: string;
  mediaUrl: string;
  answers: [string, string, string, string];
  options?: string[];
  correctIndex: number;
  points: number;
  lat: number | null;
  lng: number | null;
};

type MapCenter = {
  lat: number;
  lng: number;
};

type StoredRoleplayQuestionRecord = {
  id?: unknown;
  text?: unknown;
  aiPrompt?: unknown;
  ai_prompt?: unknown;
  mediaUrl?: unknown;
  media_url?: unknown;
  post_type?: unknown;
  postType?: unknown;
  answers?: unknown;
  points?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type BuilderNotice = {
  tone: "success" | "error";
  message: string;
};

type QuestionCardElement = HTMLElement | null;

const ROLLESPIL_DRAFT_STORAGE_KEY = "draft_run_rollespil";
const DEFAULT_QUESTION_POINTS = 10;

type RollespilBuilderDraftState = {
  title?: unknown;
  subject?: unknown;
  radius?: unknown;
  showTeacherField?: unknown;
  showAiInterviewModal?: unknown;
  questions?: unknown;
  mapCenter?: unknown;
};

const DEFAULT_RUN_RADIUS = 15;
const RUN_RADIUS_OPTIONS = [15, 30, 50] as const;

const textInputClass =
  "w-full rounded-2xl border border-violet-500/30 bg-violet-950/20 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500";

const textareaClass =
  "w-full rounded-2xl border border-violet-500/30 bg-violet-950/20 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500";

const aiActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 px-5 py-3 text-sm font-semibold transition-all";

const BLANK_ANSWERS: [string, string, string, string] = ["", "", "", ""];

const createQuestion = (): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type: "multiple_choice",
  postType: "quiz",
  text: "",
  aiPrompt: "",
  mediaUrl: "",
  answers: BLANK_ANSWERS,
  correctIndex: 0,
  points: DEFAULT_QUESTION_POINTS,
  lat: null,
  lng: null,
});

function normalizeQuestionPoints(value: unknown) {
  const parsed = asNumberOrNull(value);
  return parsed !== null ? Math.max(0, Math.round(parsed)) : DEFAULT_QUESTION_POINTS;
}

function toRoleplayAnswers(
  correctAnswer: string,
  characterName: string,
  avatar: string
): [string, string, string, string] {
  return [correctAnswer, characterName, avatar, ""];
}

function fallbackCharacterName(index: number) {
  return `Karakter ${index + 1}`;
}

function fallbackAvatar() {
  return "🎭";
}

function normalizeRunRadius(value: unknown) {
  const parsed = asNumberOrNull(value);
  return parsed !== null && RUN_RADIUS_OPTIONS.includes(parsed as (typeof RUN_RADIUS_OPTIONS)[number])
    ? parsed
    : DEFAULT_RUN_RADIUS;
}

function parseRoleplayText(rawText: string, index: number) {
  const trimmedText = rawText.trim();
  if (!trimmedText) {
    return {
      message: "",
      characterName: fallbackCharacterName(index),
      avatar: fallbackAvatar(),
    };
  }

  const structuredMatch = trimmedText.match(
    /^Karakter:\s*(.*?)\s*\|\|\s*Avatar:\s*(.*?)\s*\|\|\s*Besked:\s*(.+)$/i
  );
  if (structuredMatch) {
    return {
      message: structuredMatch[3]?.trim() ?? "",
      characterName: structuredMatch[1]?.trim() || fallbackCharacterName(index),
      avatar: structuredMatch[2]?.trim() || fallbackAvatar(),
    };
  }

  const [messagePart, ...restAfterCharacter] = trimmedText.split(/\|\|\s*KARAKTER:\s*/i);
  const message = messagePart.trim();

  if (restAfterCharacter.length === 0) {
    return {
      message,
      characterName: fallbackCharacterName(index),
      avatar: fallbackAvatar(),
    };
  }

  const characterAndAvatar = restAfterCharacter.join(" || ");
  const [characterPart, ...restAfterAvatar] = characterAndAvatar.split(/\|\|\s*AVATAR:\s*/i);
  const characterName = characterPart.trim() || fallbackCharacterName(index);
  const avatar = restAfterAvatar.join(" || ").trim() || fallbackAvatar();

  return { message, characterName, avatar };
}

function toRoleplayQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const timestamp = Date.now();

  return value
    .map((item, index): Question | null => {
      if (!isRecord(item)) return null;

      const candidate = item as StoredRoleplayQuestionRecord;
      const rawText = asTrimmedString(candidate.text);
      const parsedLegacyText = parseRoleplayText(rawText, index);
      const hasLegacyMarkers = /Karakter:|Avatar:|Besked:/i.test(rawText);
      const answers = Array.isArray(candidate.answers)
        ? candidate.answers.filter((answer): answer is string => typeof answer === "string")
        : [];
      const characterName =
        asTrimmedString(answers[1]) ||
        (hasLegacyMarkers ? parsedLegacyText.characterName : rawText) ||
        rawText ||
        fallbackCharacterName(index);
      const avatar = asTrimmedString(answers[2]) || parsedLegacyText.avatar || fallbackAvatar();
      const message =
        asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt) ||
        (hasLegacyMarkers ? parsedLegacyText.message : "");

      const rawPostType = asTrimmedString(candidate.post_type) || asTrimmedString(candidate.postType);
      const postType: "quiz" | "intro" = rawPostType === "intro" ? "intro" : "quiz";

      return {
        id: toQuestionId(candidate.id, timestamp + index),
        type: "multiple_choice",
        postType,
        text: characterName,
        aiPrompt: message,
        mediaUrl: asTrimmedString(candidate.mediaUrl ?? candidate.media_url),
        answers: toRoleplayAnswers(asTrimmedString(answers[0]), characterName, avatar),
        correctIndex: 0,
        points: normalizeQuestionPoints(candidate.points),
        lat: asNumberOrNull(candidate.lat),
        lng: asNumberOrNull(candidate.lng),
      };
    })
    .filter((question): question is Question => question !== null);
}

function isQuestionEmpty(question: Question) {
  return (
    !question.text.trim() &&
    !question.aiPrompt.trim() &&
    !question.answers[0]?.trim() &&
    !question.answers[2]?.trim() &&
    question.lat === null &&
    question.lng === null
  );
}

function toInterviewRoleplayQuestions(posts: RollespilAiInterviewQuestion[]): Question[] {
  const timestamp = Date.now();

  return posts.map((post, index) => {
    const characterName = asTrimmedString(post.characterName) || fallbackCharacterName(index);
    const avatar = fallbackAvatar();
    const introMessage = asTrimmedString(post.introMessage) || asTrimmedString(post.message);
    const questionMessage =
      asTrimmedString(post.questionMessage) ||
      asTrimmedString(post.question) ||
      asTrimmedString(post.message);
    const optionSource = Array.isArray(post.options)
      ? post.options
      : Array.isArray(post.answers)
      ? post.answers
      : [];
    const options = optionSource.map((option) => asTrimmedString(option)).slice(0, 4);

    while (index > 0 && options.length < 4) {
      options.push("");
    }

    const nextMessage = index === 0 ? introMessage : questionMessage;

    return {
      id: timestamp + index,
      type: "multiple_choice",
      postType: index === 0 ? "intro" : "quiz",
      text: characterName,
      aiPrompt: nextMessage,
      mediaUrl: "",
      answers: toRoleplayAnswers(index === 0 ? "" : (options[0] ?? ""), characterName, avatar),
      options: index === 0 ? [] : options,
      correctIndex: 0,
      points: DEFAULT_QUESTION_POINTS,
      lat: null,
      lng: null,
    };
  });
}

function enforceFirstRoleplayIntro(questions: Question[]) {
  if (questions.length === 0) return questions;

  return questions.map((question, index) => {
    if (index !== 0) return question;

    const characterName = question.text.trim() || question.answers[1]?.trim() || fallbackCharacterName(0);
    const avatar = question.answers[2]?.trim() || fallbackAvatar();

    return {
      ...question,
      postType: "intro" as const,
      text: characterName,
      answers: toRoleplayAnswers("", characterName, avatar),
    };
  });
}

function findFirstUnpinnedQuestionId(questions: Question[]) {
  return questions.find((question) => question.lat === null || question.lng === null)?.id ?? null;
}

export default function RollespilBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className={`min-h-screen bg-violet-950 ${poppins.className}`}>
          <div className="flex min-h-screen items-center justify-center px-6 text-center">
            <div className="rounded-[2rem] border border-violet-500/30 bg-violet-950/20 px-8 py-10 text-violet-100 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <p className="text-xs font-semibold tracking-[0.28em] text-violet-100/55 uppercase">
                Indlæser
              </p>
              <h1 className={`mt-3 text-3xl font-black tracking-tight text-violet-100 ${rubik.className}`}>
                Rollespil-bygger
              </h1>
            </div>
          </div>
        </div>
      }
    >
      <RollespilBuilderPageContent />
    </Suspense>
  );
}

function RollespilBuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const { focusEnabled, focusStatus, setFocusEnabled, persistFocusMode } = useBuilderFocusMode(editRunId);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [radius, setRadius] = useState<number>(DEFAULT_RUN_RADIUS);
  const [showTeacherField, setShowTeacherField] = useState(false);
  const [showAiInterviewModal, setShowAiInterviewModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([createQuestion()]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [showDraftRecoveryPrompt, setShowDraftRecoveryPrompt] = useState(false);
  const [activePinQuestionId, setActivePinQuestionId] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<MapCenter>({
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
  });
  const isEditorBusy = isSaving || showDraftRecoveryPrompt;
  const editorLockClass = isEditorBusy ? "pointer-events-none opacity-50" : "";

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-[1.5rem] border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-violet-300/30 bg-violet-500/10 text-violet-50"
            : "border-red-300/30 bg-red-500/10 text-red-100"
        } ${className}`}
      >
        {notice.message}
      </div>
    ) : null;
  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedDraftRef = useRef(false);
  const shouldAutoRestoreDraftRef = useRef<boolean | null>(null);
  const questionCardRefs = useRef<Record<number, QuestionCardElement>>({});
  const activePinQuestionIdRef = useRef<number | null>(null);

  const normalizedQuestionsForSave = useMemo(
    () =>
      questions
        .map((question, index) => {
          const normalizedPostType = index === 0 ? "intro" : (question.postType ?? "quiz");
          const normalizedCharacterName =
            question.text.trim() || question.answers[1]?.trim() || fallbackCharacterName(index);
          const normalizedAvatar = question.answers[2]?.trim() || fallbackAvatar();

          return {
            ...question,
            type: "multiple_choice" as const,
            post_type: normalizedPostType,
            text: normalizedCharacterName,
            aiPrompt: question.aiPrompt.trim(),
            answers: toRoleplayAnswers(
              normalizedPostType === "intro" ? "" : question.answers[0]?.trim() ?? "",
              normalizedCharacterName,
              normalizedAvatar
            ),
            options: (question.options ?? []).map((option) => option.trim()).filter(Boolean),
            correctIndex: 0,
            points: normalizeQuestionPoints(question.points),
            mediaUrl: question.mediaUrl.trim(),
          };
        })
        .filter(
          (question) =>
            question.text.length > 0 ||
            question.answers[0].length > 0 ||
            question.answers[1].length > 0 ||
            question.answers[2].length > 0 ||
            question.lat !== null ||
            question.lng !== null
        ),
    [questions]
  );
  const hasIncompleteQuestions = useMemo(
    () =>
      normalizedQuestionsForSave.some(
        (question) =>
          !question.text ||
          !question.aiPrompt ||
          !question.answers[2] ||
          ((question.post_type ?? question.postType ?? "quiz") !== "intro" &&
            (!question.answers[0] || !(Array.isArray(question.options) && question.options.length === 4)))
      ),
    [normalizedQuestionsForSave]
  );
  const hasMissingCoordinates = useMemo(
    () => normalizedQuestionsForSave.some((question) => question.lat === null || question.lng === null),
    [normalizedQuestionsForSave]
  );
  const isReadyToSave =
    title.trim().length > 0 &&
    normalizedQuestionsForSave.length > 0 &&
    !hasIncompleteQuestions &&
    !hasMissingCoordinates;
  const { shouldHighlight: shouldHighlightSave } = useBuilderSaveGuidance(
    isReadyToSave,
    saveFeedbackRef
  );

  const applyDraftState = (draft: RollespilBuilderDraftState) => {
    const restoredSubject = restoreDraftString(draft.subject);
    const restoredQuestions = enforceFirstRoleplayIntro(toRoleplayQuestions(draft.questions));

    setTitle(restoreDraftString(draft.title));
    setSubject(restoredSubject);
    setRadius(normalizeRunRadius(draft.radius));
    setShowTeacherField(
      restoreDraftBoolean(draft.showTeacherField, Boolean(restoredSubject.trim()))
    );
    setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion()]);
    setActivePinTarget(findFirstUnpinnedQuestionId(restoredQuestions));
    setShowAiInterviewModal(restoreDraftBoolean(draft.showAiInterviewModal));
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
        .select("id,user_id,title,subject,description,topic,questions,race_type,radius")
        .eq("id", editRunId)
        .eq("user_id", user.id)
        .single<StoredRunRecord>();

      if (!isActive) return;

      if (error || !run) {
        console.error("Kunne ikke hente rollespilsløbet til redigering:", error);
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette rollespilsløb til redigering. Tjek at du er ejer, og prøv igen fra arkivet.",
        });
        return;
      }

      const loadedQuestions = enforceFirstRoleplayIntro(toRoleplayQuestions(run.questions));
      const firstPinnedQuestion =
        loadedQuestions.find((question) => question.lat !== null && question.lng !== null) ?? null;

      setTitle(asTrimmedString(run.title));
      setSubject(asTrimmedString(run.subject));
      setRadius(normalizeRunRadius(run.radius));
      setShowTeacherField(Boolean(asTrimmedString(run.subject)));
      setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion()]);
      setActivePinTarget(findFirstUnpinnedQuestionId(loadedQuestions));
      setShowAiInterviewModal(false);
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
        console.error("Kunne ikke indlæse rollespilsløbet til redigering:", error);
        if (!isActive) return;
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette rollespilsløb til redigering. Prøv igen fra arkivet om et øjeblik.",
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
      shouldAutoRestoreDraftRef.current = shouldRestoreRunDraftOnLoad(ROLLESPIL_DRAFT_STORAGE_KEY);
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
      ? readRunDraft<RollespilBuilderDraftState>(ROLLESPIL_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      applyDraftState(restoredDraft);
      setNotice(null);
      hasInitializedDraftRef.current = true;
      return;
    }

    if (isEditMode && !shouldAutoRestoreDraft && hasUnsavedDraft(ROLLESPIL_DRAFT_STORAGE_KEY, editRunId)) {
      setShowDraftRecoveryPrompt(true);
      hasInitializedDraftRef.current = true;
      return;
    }

    hasInitializedDraftRef.current = true;
  }, [editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;
    if (showDraftRecoveryPrompt) return;

    writeRunDraft(ROLLESPIL_DRAFT_STORAGE_KEY, editRunId, {
      title,
      subject,
      radius,
      showTeacherField,
      showAiInterviewModal,
      questions,
      mapCenter,
    } satisfies RollespilBuilderDraftState);
  }, [
    editRunId,
    mapCenter,
    questions,
    radius,
    showAiInterviewModal,
    showTeacherField,
    showDraftRecoveryPrompt,
    subject,
    title,
  ]);

  const handleRestoreDraft = () => {
    const restoredDraft = readRunDraft<RollespilBuilderDraftState>(ROLLESPIL_DRAFT_STORAGE_KEY, editRunId);

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
    clearRunDraft(ROLLESPIL_DRAFT_STORAGE_KEY);
    setShowDraftRecoveryPrompt(false);
    setNotice({
      tone: "success",
      message: "Den lokale kladde blev slettet. Du arbejder nu videre på versionen fra arkivet.",
    });
  };

  const setActivePinTarget = (id: number | null) => {
    activePinQuestionIdRef.current = id;
    setActivePinQuestionId(id);
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

  const activePinQuestionIndex =
    activePinQuestionId === null ? -1 : questions.findIndex((question) => question.id === activePinQuestionId);
  const activePinLabel =
    activePinQuestionIndex >= 0
      ? `Venter pa kort-klik for Post ${activePinQuestionIndex + 1}. Klik et sted pa kortet for at gemme pinnen med det samme.`
      : null;
  const suggestedPinQuestionId =
    activePinQuestionId ??
    questions.find((question) => question.lat === null || question.lng === null)?.id ??
    null;

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
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== id) return question;
        if (typeof updatesOrKey === "string") {
          return { ...question, [updatesOrKey]: value } as Question;
        }
        return { ...question, ...updatesOrKey };
      })
    );
  }

  const scrollToQuestionCard = (id: number) => {
    const card = questionCardRefs.current[id];
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const updateRoleplayQuestion = (
    id: number,
    updates: {
      correctAnswer?: string;
      characterName?: string;
      avatar?: string;
      message?: string;
    }
  ) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== id) return question;
        const nextCorrectAnswer = updates.correctAnswer ?? question.answers[0];
        const nextCharacterName =
          updates.characterName ?? (question.text || question.answers[1] || "");
        const nextAvatar = updates.avatar ?? question.answers[2];
        const nextMessage = updates.message ?? question.aiPrompt;

        return {
          ...question,
          text: nextCharacterName,
          aiPrompt: nextMessage,
          answers: toRoleplayAnswers(nextCorrectAnswer, nextCharacterName, nextAvatar),
          correctIndex: 0,
        };
      })
    );
  };

  const startPinSelection = (id: number) => {
    setActivePinTarget(id);
    scrollToQuestionCard(id);
    setNotice({
      tone: "success",
      message: "Klik nu pa kortet for at placere den valgte post.",
    });
  };

  const handleMapClick = useCallback((coords: MapCenter) => {
    const { lat, lng } = coords;
    const activeQuestionId = activePinQuestionIdRef.current;

    if (activeQuestionId === null) return;

    const questionIndex = questions.findIndex((question) => question.id === activeQuestionId);
    if (questionIndex === -1) return;

    updateQuestion(activeQuestionId, { lat, lng });

    const nextQuestionId =
      questions.find((question, index) => index > questionIndex && (question.lat === null || question.lng === null))?.id ?? null;

    setMapCenter({ lat, lng });
    setActivePinTarget(nextQuestionId);

    if (nextQuestionId !== null) {
      window.setTimeout(() => {
        scrollToQuestionCard(nextQuestionId!);
      }, 120);
    }
  }, [questions]);

  const addQuestion = () => {
    setQuestions((current) => [...current, createQuestion()]);
  };

  const closeAiInterviewModal = () => {
    setNotice(null);
    setShowAiInterviewModal(false);
  };

  const handleAiInterviewComplete = (draft: RollespilAiInterviewDraft) => {
    console.log("PAGE RECEIVED DRAFT:", draft);
    const nextTitle = asTrimmedString(draft.title);
    const sourceQuestions = Array.isArray(draft.questions) ? draft.questions : [];
    const nextQuestions = enforceFirstRoleplayIntro(
      toInterviewRoleplayQuestions(
        sourceQuestions.map((item, index) => {
          const introMessage = asTrimmedString(item.introMessage) || asTrimmedString(item.message);
          const questionMessage =
            asTrimmedString(item.questionMessage) ||
            asTrimmedString(item.question) ||
            asTrimmedString(item.message);
          const rawOptions = Array.isArray(item.answers)
            ? item.answers
            : Array.isArray(item.options)
            ? item.options
            : [];
          const normalizedOptions = rawOptions
            .map((option) => asTrimmedString(option))
            .slice(0, 4);

          while (index > 0 && normalizedOptions.length < 4) {
            normalizedOptions.push("");
          }

          return {
            ...item,
            postType: index === 0 ? "intro" : "quiz",
            characterName: asTrimmedString(item.characterName) || fallbackCharacterName(index),
            introMessage,
            questionMessage,
            answers: index === 0 ? [] : normalizedOptions,
            options: index === 0 ? [] : normalizedOptions,
          } satisfies RollespilAiInterviewQuestion;
        })
      )
    );

    if (!nextTitle || nextQuestions.length === 0) {
      setNotice({
        tone: "error",
        message: "Der kom ingen brugbare forslag til rolleposter. Prøv igen.",
      });
      return;
    }

    if ((nextQuestions[0]?.postType ?? "quiz") !== "intro") {
      setNotice({
        tone: "error",
        message: "Der kom ikke en gyldig intro-post tilbage. Prøv igen.",
      });
      return;
    }

    const hasExistingContent =
      title.trim().length > 0 ||
      questions.some((question) => !isQuestionEmpty(question));

    if (hasExistingContent) {
      const shouldReplace = window.confirm(
        "Det auto-genererede udkast erstatter de nuværende rolleposter i builderen. Vil du fortsætte?"
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
    setQuestions([...nextQuestions]);
    setActivePinTarget(findFirstUnpinnedQuestionId(nextQuestions));
    setShowAiInterviewModal(false);
    setNotice({
      tone: "success",
      message: "Et komplet udkast er klar til dit rollespil. Gennemgå felterne og placer posterne på kortet.",
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
      setNotice({ tone: "error", message: "Udfyld venligst løbets titel." });
      scrollToSaveFeedback();
      return;
    }

    if (normalizedQuestionsForSave.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst én udfyldt post." });
      scrollToSaveFeedback();
      return;
    }

    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message:
          "Udfyld karakterens navn, avatar og besked på hver post. Quiz-poster skal også have et facitsvar.",
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
        race_type: RACE_TYPES.ROLLESPIL,
      };

      let savedRunId = editRunId;
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
        const { data: savedRuns, error } = await supabase.from("gps_runs").insert({
          user_id: user.id,
          ...payload,
        }).select("id");
        savedRunId = savedRuns?.[0]?.id ?? "";

        if (error) {
          throw error;
        }
      }

      await persistFocusMode(savedRunId);

      setNotice({
        tone: "success",
        message: isEditMode ? "Ændringerne er gemt i arkivet!" : "Rollespilsløbet er gemt i arkivet!",
      });
      clearRunDraft(ROLLESPIL_DRAFT_STORAGE_KEY);

      if (!isEditMode) {
        setTitle("");
        setSubject("");
        setRadius(DEFAULT_RUN_RADIUS);
        setShowTeacherField(false);
        setQuestions([createQuestion()]);
        setActivePinTarget(null);
      }

      await new Promise((resolve) => window.setTimeout(resolve, 450));
      router.push("/dashboard/arkiv");
    } catch (error) {
      console.error("Fejl ved gemning af rollespilsløb:", error);
      setNotice({ tone: "error", message: "Kunne ikke gemme løbet. Prøv igen." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditMode && isLoadingExistingRun) {
    return (
      <div className={`relative min-h-screen overflow-hidden bg-violet-950 text-violet-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-violet-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-violet-500/30 bg-violet-950/20 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-200" />
            <p className="mt-5 text-xs font-semibold tracking-[0.28em] text-violet-100/55 uppercase">
              Rediger løb
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight text-violet-100 ${rubik.className}`}>
              Indlæser dine rolleposter
            </h1>
            <p className="mt-3 text-sm leading-6 text-violet-100/70">
              Vi henter løbets data og klargør builderen til redigering.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative min-h-screen overflow-x-hidden bg-violet-950 text-violet-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-violet-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row lg:items-start">
          <MobileBuilderWarning />
          <section className="hidden w-full px-4 py-4 sm:px-6 sm:py-6 lg:block lg:h-screen lg:w-[52%] lg:overflow-y-auto lg:px-8 lg:py-8">
            <div className={`mx-auto max-w-3xl space-y-5 ${editorLockClass}`}>
              <div className="px-1 pt-1">
                {isEditMode ? (
                  <div className="mb-4 inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-violet-100 uppercase">
                    Edit-mode
                  </div>
                ) : null}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-2">
                    {activePinQuestionId !== null ? "LYTTER EFTER KLIK" : "Velkommen til det klassiske rollespil."}
                  </h2>
                  <p className="text-sm text-muted-foreground">Her bygger du en fortaelling i jeg-form, hvor eleverne møder en karakter, f.eks. en historisk person som Christian d. 4. Den første post er altid en personlig introduktion, hvor karakteren fortaeller om sig selv, sin tid og sin mission. Det er denne tekst, der satter scenen og giver eleverne den viden, de skal bruge i de efterfolgende quiz-sporgsmal. Eleverne kan fa historien last hojt direkte pa deres telefon, mens de bevager sig ude pa ruten, sa de lettere kan leve sig ind i fortaellingen. Brug den smarte assistent til at generere bade introduktionen og de efterfolgende sporgsmal, sa sproget passer til din valgte figur.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setShowAiInterviewModal(true);
                    }}
                    className={`${aiActionButtonClass} mt-4 w-full sm:w-auto`}
                  >
                    Smart historieudfyldning
                  </button>
                </div>
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                  Løbets titel
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="F.eks. En dag med Christian d. 4."
                  className={textInputClass}
                />
              </div>
              <div className="px-1">
                <div className="rounded-[1.5rem] border border-violet-500/30 bg-violet-950/20 p-4 backdrop-blur-xl">
                  <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                    Fag
                  </label>
                  <select
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="w-full appearance-none rounded-2xl border border-violet-500/30 bg-violet-950/20 p-3 text-slate-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                <div className="rounded-[1.5rem] border border-violet-500/30 bg-violet-950/20 p-4 backdrop-blur-xl">
                  <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                    GPS-radius
                  </label>
                  <select
                    value={radius}
                    onChange={(event) => setRadius(normalizeRunRadius(event.target.value))}
                    disabled={isEditorBusy}
                    className="w-full appearance-none rounded-2xl border border-violet-500/30 bg-violet-950/20 p-3 text-slate-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                  >
                    {RUN_RADIUS_OPTIONS.map((radiusOption) => (
                      <option key={radiusOption} value={radiusOption} className="bg-slate-900 text-white">
                        {radiusOption} meter
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-violet-100/70">
                    Vælg hvor tæt eleven skal være på posten, før GPS-låsen åbner.
                  </p>
                </div>
              </div>

              <div className="space-y-4 px-1">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-xs font-semibold tracking-[0.24em] text-violet-100/65 uppercase">
                    Dine poster
                  </p>
                  <span className="rounded-full border border-violet-500/30 bg-violet-950/20 px-4 py-2 text-sm font-semibold text-violet-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}
              </div>

              {questions.map((question, index) => (
                <article
                  key={question.id}
                  ref={(element) => {
                    questionCardRefs.current[question.id] = element;
                  }}
                  className={`rounded-[1.8rem] border bg-violet-950/20 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition-all ${
                    activePinQuestionId === question.id
                      ? "border-violet-400 ring-2 ring-violet-500/70 shadow-[0_0_0_1px_rgba(167,139,250,0.35),0_0_28px_rgba(139,92,246,0.18)]"
                      : "border-violet-500/30"
                  }`}
                >
                  <div className="mb-3 rounded-[1.2rem] border border-white/10 bg-slate-950/35 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.22em] text-violet-100/60 uppercase">Rollepost</p>
                      <h3 className="mt-1 text-sm font-black tracking-[0.08em] text-white uppercase">
                        {index === 0 ? `Post 1: Intro (Start)` : `Post ${index + 1}: Quiz-sporgsmal`}
                      </h3>
                    </div>
                  </div>

                  {index === 0 ? (
                    // Post 1: only show character name and intro textarea
                    <div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">Karakterens navn</label>
                        <input
                          value={question.text}
                          onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                          placeholder="F.eks. Kong Christian d. 4"
                          className={textInputClass}
                        />
                      </div>

                      <div className="mt-3">
                        <label className="mb-2 block text-sm font-semibold text-white">Karakterens introduktion</label>
                        <textarea
                          value={question.aiPrompt}
                          onChange={(event) => updateQuestion(question.id, { aiPrompt: event.target.value })}
                          rows={6}
                          placeholder={"God dag unge mennesker! Jeg hedder Kong Christian d. 4. Jeg grundlagde jeres by, byggede Børsen og Rundetårn, og nu har jeg brug for jeres hjælp til at..."}
                          className={textareaClass}
                        />
                      </div>
                    </div>
                  ) : (
                    // Quiz posts: only show question and four answer options
                    <div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">Spørgsmål</label>
                        <textarea
                          value={question.aiPrompt}
                          onChange={(event) => updateQuestion(question.id, { aiPrompt: event.target.value })}
                          rows={3}
                          placeholder="Skriv det korte quiz-spørgsmål her"
                          className={textareaClass}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, optIndex) => (
                          <div key={optIndex}>
                            <label className="mb-2 block text-sm font-semibold text-white">Svar {String.fromCharCode(65 + optIndex)}</label>
                            <input
                              value={(question.options ?? ["", "", "", ""])[optIndex] ?? ""}
                              onChange={(e) => {
                                const nextOptions = Array.from(question.options ?? ["", "", "", ""]);
                                nextOptions[optIndex] = e.target.value;
                                updateQuestion(question.id, { options: nextOptions });
                              }}
                              placeholder={`Svar ${String.fromCharCode(65 + optIndex)}`}
                              className={textInputClass}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-slate-950/35 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-violet-100/60 uppercase">Kortplacering</p>
                        <p className="mt-1 text-sm text-violet-50/85">
                          {question.lat !== null && question.lng !== null
                            ? `Lat ${question.lat.toFixed(5)} | Lng ${question.lng.toFixed(5)}`
                            : "Denne post mangler stadig koordinater."}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => startPinSelection(question.id)}
                        className={`rounded-[1.2rem] px-4 py-3 text-sm font-extrabold uppercase tracking-[0.18em] transition-all ${
                          suggestedPinQuestionId === question.id
                            ? "border border-violet-400/60 bg-violet-500/20 text-violet-50 shadow-[0_0_24px_rgba(139,92,246,0.2)] hover:bg-violet-500/25"
                            : "border border-violet-500/30 bg-violet-950/20 text-violet-100 hover:bg-violet-500/15"
                        } ${activePinQuestionId === question.id ? "ring-2 ring-violet-500/70" : ""}`}
                      >
                        {activePinQuestionId === question.id ? "Klar til kort-klik" : "Hent pin til kortet"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              <div className="rounded-[1.8rem] border border-violet-500/30 bg-violet-950/20 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
                <button
                  type="button"
                  onClick={addQuestion}
                  className="rounded-[1.4rem] border border-violet-500/30 bg-violet-950/20 px-4 py-3 text-sm font-semibold text-violet-100 backdrop-blur-xl transition hover:bg-violet-500/15"
                >
                  Tilføj ny post
                </button>

                <div ref={saveFeedbackRef} className="mt-6 space-y-4">
                  {notice?.tone === "error" ? renderNotice() : null}
                  <FocusModeSetting enabled={focusEnabled} status={focusStatus} onChange={setFocusEnabled} disabled={isSaving} />
                  <button
                    type="button"
                    onClick={handleSaveRun}
                    disabled={isSaving}
                    className={`w-full rounded-[1.6rem] border border-violet-500/30 bg-violet-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-violet-500/20 transition-all duration-300 hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                      shouldHighlightSave
                        ? "scale-105 ring-4 ring-violet-400 ring-offset-2 ring-offset-violet-950 shadow-violet-400/50"
                        : ""
                    }`}
                  >
                    {isSaving ? "Gemmer..." : isEditMode ? "Gem ændringer i arkivet" : "Gem løb i arkivet"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="hidden w-full p-4 pt-0 sm:px-6 lg:block lg:w-[48%] lg:self-start lg:p-8 lg:pl-0">
            <div className="lg:sticky lg:top-5">
              <div className="h-[42vh] min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-violet-500/20 bg-slate-900/60 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_0_36px_rgba(139,92,246,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
                <MapPicker
                  center={mapCenter}
                  pins={pins}
                  zones={previewZones}
                  autoLocateOnLoad={!isEditMode}
                  onCenterChange={setMapCenter}
                  onMapClick={handleMapClick}
                  onPinClick={(pinId) => scrollToQuestionCard(Number(pinId))}
                  onPinDragEnd={(pinId, coords) => updateQuestion(Number(pinId), { lat: coords.lat, lng: coords.lng })}
                  activePinLabel={activePinLabel}
                  isAwaitingMapClick={activePinQuestionId !== null}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showDraftRecoveryPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 py-10 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-4xl border border-violet-400/25 bg-slate-950/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-100/70">Redningskrans</p>
            <h2 className={`mt-3 text-3xl font-black tracking-tight text-violet-50 ${rubik.className}`}>
              Vi fandt ugemte ændringer fra dit sidste besøg
            </h2>
            <p className="mt-4 text-sm leading-6 text-violet-100/80 sm:text-base">
              Hvis du fortsætter uden at gendanne kladden, beholder vi versionen fra arkivet og sletter den lokale kladde.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-3xl border border-violet-300/40 bg-violet-400 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-violet-500/20 transition hover:bg-violet-300"
              >
                Gendan ugemte ændringer
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-3xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-violet-50 transition hover:bg-white/10"
              >
                Slet kladde
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <RollespilAiInterviewModal
        open={showAiInterviewModal}
        initialSubject={subject}
        onClose={closeAiInterviewModal}
        onComplete={handleAiInterviewComplete}
      />
    </>
  );
}
