"use client";

import { Loader2, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { poppins, rubik } from "@/lib/fonts";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import SelfieAiInterviewModal, {
  type SelfieAiInterviewDraft,
} from "@/components/builders/selfie/SelfieAiInterviewModal";
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
  readDescriptionText,
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
    <div className="h-full w-full animate-pulse rounded-3xl border border-rose-500/20 bg-slate-900/60" />
  ),
});

const SUBJECT_OPTIONS = [
  "Dansk",
  "Matematik",
  "Natur/Teknologi",
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

type Question = {
  id: number;
  type: "ai_image";
  isSelfie: true;
  text: string;
  aiPrompt: string;
  answers: [string, string, string, string];
  correctIndex: number;
  lat: number | null;
  lng: number | null;
};

type StoredSelfieQuestionRecord = {
  id?: unknown;
  type?: unknown;
  isSelfie?: unknown;
  is_selfie?: unknown;
  text?: unknown;
  aiPrompt?: unknown;
  ai_prompt?: unknown;
  answers?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type MapCenter = {
  lat: number;
  lng: number;
};

type BuilderNotice = {
  tone: "success" | "error";
  message: string;
};

const SELFIE_DRAFT_STORAGE_KEY = "draft_run_selfie";
const SELFIE_REMINDER = "Husk at få dit ansigt med på selfien!";
const BLANK_ANSWERS: [string, string, string, string] = ["", "", "", ""];

type SelfieBuilderDraftState = {
  title?: unknown;
  description?: unknown;
  subject?: unknown;
  radius?: unknown;
  showAiInterviewModal?: unknown;
  questions?: unknown;
  mapCenter?: unknown;
};

const DEFAULT_RUN_RADIUS = 15;
const RUN_RADIUS_OPTIONS = [15, 30, 50] as const;

const textInputClass =
  "w-full rounded-2xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const textareaClass =
  "w-full rounded-2xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const aiActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-300 transition-all hover:bg-rose-500/20";

const buildAnswers = (targetObject: string): [string, string, string, string] => [
  targetObject.trim(),
  "",
  "",
  "",
];

const createQuestion = (): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type: "ai_image",
  isSelfie: true,
  text: "",
  aiPrompt: "",
  answers: BLANK_ANSWERS,
  correctIndex: 0,
  lat: null,
  lng: null,
});

function normalizeRunRadius(value: unknown) {
  const parsed = asNumberOrNull(value);
  return parsed !== null && RUN_RADIUS_OPTIONS.includes(parsed as (typeof RUN_RADIUS_OPTIONS)[number])
    ? parsed
    : DEFAULT_RUN_RADIUS;
}

function getStoredTargetObject(candidate: StoredSelfieQuestionRecord) {
  const normalizedPrompt = asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt);
  if (normalizedPrompt) return normalizedPrompt;

  if (Array.isArray(candidate.answers)) {
    const firstAnswer = candidate.answers.find((answer): answer is string => typeof answer === "string");
    return asTrimmedString(firstAnswer);
  }

  return "";
}

function toSelfieQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const timestamp = Date.now();

  return value
    .map((item, index): Question | null => {
      if (!isRecord(item)) return null;

      const candidate = item as StoredSelfieQuestionRecord;
      const normalizedTarget = getStoredTargetObject(candidate);

      return {
        id: toQuestionId(candidate.id, timestamp + index),
        type: "ai_image",
        isSelfie: true,
        text: asTrimmedString(candidate.text),
        aiPrompt: normalizedTarget,
        answers: buildAnswers(normalizedTarget),
        correctIndex: 0,
        lat: asNumberOrNull(candidate.lat),
        lng: asNumberOrNull(candidate.lng),
      };
    })
    .filter((question): question is Question => question !== null);
}

function ensureSentenceEnding(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function normalizeSelfieInstruction(text: string, targetObject: string) {
  const trimmedText = text.trim();
  const trimmedTarget = targetObject.trim();

  if (!trimmedText && !trimmedTarget) return "";

  const baseInstruction =
    trimmedText ||
    (trimmedTarget
      ? `Tag en selfie, hvor ${trimmedTarget.toLowerCase()} kan ses på billedet`
      : "Tag en selfie på det rigtige sted");

  const normalizedBase = ensureSentenceEnding(baseInstruction);
  const hasReminder = normalizedBase
    .toLocaleLowerCase("da-DK")
    .includes(SELFIE_REMINDER.toLocaleLowerCase("da-DK"));

  return hasReminder ? normalizedBase : `${normalizedBase} ${SELFIE_REMINDER}`;
}

function isQuestionEmpty(question: Question) {
  return (
    !question.text.trim() &&
    !question.aiPrompt.trim() &&
    question.lat === null &&
    question.lng === null
  );
}

function toInterviewSelfieQuestions(
  missions: SelfieAiInterviewDraft["missions"]
): Question[] {
  const timestamp = Date.now();

  return missions
    .map((mission, index): Question | null => {
      const backgroundTarget = mission.backgroundTarget.trim();
      const instruction = normalizeSelfieInstruction(mission.instruction, backgroundTarget);

      if (!backgroundTarget || !instruction) {
        return null;
      }

      return {
        id: timestamp + index,
        type: "ai_image",
        isSelfie: true,
        text: instruction,
        aiPrompt: backgroundTarget,
        answers: buildAnswers(backgroundTarget),
        correctIndex: 0,
        lat: null,
        lng: null,
      };
    })
    .filter((question): question is Question => question !== null);
}

export default function SelfieBuilderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [radius, setRadius] = useState<number>(DEFAULT_RUN_RADIUS);
  const [showAiInterviewModal, setShowAiInterviewModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([createQuestion()]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [showDraftRecoveryPrompt, setShowDraftRecoveryPrompt] = useState(false);
  const isEditorBusy = isSaving || showDraftRecoveryPrompt;
  const editorLockClass = isEditorBusy ? "pointer-events-none opacity-50" : "";
  const [mapCenter, setMapCenter] = useState<MapCenter>({
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
  });
  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedDraftRef = useRef(false);
  const shouldAutoRestoreDraftRef = useRef<boolean | null>(null);

  const normalizedQuestionsForSave = useMemo(
    () =>
      questions
        .map((question) => {
          const normalizedTarget = question.aiPrompt.trim();

          return {
            ...question,
            text: normalizeSelfieInstruction(question.text, normalizedTarget),
            aiPrompt: normalizedTarget,
            answers: buildAnswers(normalizedTarget),
            correctIndex: 0,
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

  const applyDraftState = (draft: SelfieBuilderDraftState) => {
    const restoredQuestions = toSelfieQuestions(draft.questions);

    setTitle(restoreDraftString(draft.title));
    setDescription(restoreDraftString(draft.description));
    setSubject(restoreDraftString(draft.subject));
    setRadius(normalizeRunRadius(draft.radius));
    setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion()]);
    setShowAiInterviewModal(restoreDraftBoolean(draft.showAiInterviewModal));
    setMapCenter(restoreDraftMapCenter(draft.mapCenter, DEFAULT_MAP_CENTER));
  };

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-[1.4rem] border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-rose-300/30 bg-rose-500/10 text-rose-50"
            : "border-red-300/30 bg-red-500/10 text-red-100"
        } ${className}`}
      >
        {notice.message}
      </div>
    ) : null;

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

    document.getElementById(`selfie-post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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
          console.error("Kunne ikke hente selfie-løbet til redigering:", error);
          setNotice({
            tone: "error",
            message: "Vi kunne ikke åbne dette selfie-løb til redigering. Tjek at du er ejer, og prøv igen fra arkivet.",
          });
          return;
        }

        const loadedQuestions = toSelfieQuestions(run.questions);
        const loadedDescription = readDescriptionText(run.description);
        const loadedTopic = asTrimmedString(run.topic);
        const nextDescription = loadedDescription || loadedTopic;
        const firstPinnedQuestion =
          loadedQuestions.find((question) => question.lat !== null && question.lng !== null) ?? null;

        setTitle(asTrimmedString(run.title));
        setDescription(nextDescription);
        setSubject(asTrimmedString(run.subject));
        setRadius(normalizeRunRadius(run.radius));
        setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion()]);
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
        console.error("Kunne ikke indlæse selfie-løbet til redigering:", error);
        if (!isActive) return;
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette selfie-løb til redigering. Prøv igen fra arkivet om et øjeblik.",
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
      shouldAutoRestoreDraftRef.current = shouldRestoreRunDraftOnLoad(SELFIE_DRAFT_STORAGE_KEY);
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
      ? readRunDraft<SelfieBuilderDraftState>(SELFIE_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      applyDraftState(restoredDraft);
      setNotice(null);
      hasInitializedDraftRef.current = true;
      return;
    }

    if (isEditMode && !shouldAutoRestoreDraft && hasUnsavedDraft(SELFIE_DRAFT_STORAGE_KEY, editRunId)) {
      setShowDraftRecoveryPrompt(true);
      hasInitializedDraftRef.current = true;
      return;
    }

    hasInitializedDraftRef.current = true;
  }, [editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;
    if (showDraftRecoveryPrompt) return;

    writeRunDraft(SELFIE_DRAFT_STORAGE_KEY, editRunId, {
      title,
      description,
      subject,
      radius,
      showAiInterviewModal,
      questions,
      mapCenter,
    } satisfies SelfieBuilderDraftState);
  }, [
    description,
    editRunId,
    mapCenter,
    questions,
    radius,
    showAiInterviewModal,
    showDraftRecoveryPrompt,
    subject,
    title,
  ]);

  const handleRestoreDraft = () => {
    const restoredDraft = readRunDraft<SelfieBuilderDraftState>(SELFIE_DRAFT_STORAGE_KEY, editRunId);

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
    clearRunDraft(SELFIE_DRAFT_STORAGE_KEY);
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

  const updateQuestion = (id: number, updates: Partial<Question>) => {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...updates } : question))
    );
  };

  const addQuestion = () => {
    setQuestions((current) => [...current, createQuestion()]);
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

  const closeAiInterviewModal = () => {
    setNotice(null);
    setShowAiInterviewModal(false);
  };

  const handleAiInterviewComplete = (draft: SelfieAiInterviewDraft) => {
    const nextTitle = draft.title.trim();
    const nextDescription = draft.description.trim();
    const nextQuestions = toInterviewSelfieQuestions(draft.missions);

    if (!nextTitle || !nextDescription || nextQuestions.length === 0) {
      setNotice({
        tone: "error",
        message: "Der kom ingen brugbare forslag til selfie-poster. Prøv igen.",
      });
      return;
    }

    const hasExistingContent =
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      questions.some((question) => !isQuestionEmpty(question));

    if (hasExistingContent) {
      const shouldReplace = window.confirm(
        "Det auto-genererede udkast erstatter de nuværende selfie-poster i builderen. Vil du fortsætte?"
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
    setDescription(nextDescription);
    setQuestions(nextQuestions);
    setNotice({
      tone: "success",
      message: "Et komplet udkast er klar til din selfie-jagt. Gennemgå felterne og placer posterne på kortet.",
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

    const normalizedDescription = description.trim();

    if (normalizedQuestionsForSave.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst én udfyldt selfie-post." });
      scrollToSaveFeedback();
      return;
    }

    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message: "Udfyld både hvad systemet skal genkende og instruktionen til deltagerne på hver post.",
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
        topic: normalizedDescription || title.trim(),
        questions: normalizedQuestionsForSave,
        radius,
        race_type: RACE_TYPES.SELFIE,
      };

      if (isEditMode) {
        const { data: updatedRuns, error } = await supabase
          .from("gps_runs")
          .update(payload)
          .eq("id", editRunId)
          .eq("user_id", user.id)
          .select("id");

        if (error) throw error;

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

        if (error) throw error;
      }

      setNotice({
        tone: "success",
        message: isEditMode ? "Ændringerne er gemt i arkivet!" : "Selfie-jagten er gemt i arkivet!",
      });
      clearRunDraft(SELFIE_DRAFT_STORAGE_KEY);

      if (!isEditMode) {
        setTitle("");
        setDescription("");
        setSubject("");
        setRadius(DEFAULT_RUN_RADIUS);
        setQuestions([createQuestion()]);
      }

      router.push("/dashboard/arkiv");
    } catch (error) {
      console.error("Fejl ved gemning af selfie-jagt:", error);
      setNotice({ tone: "error", message: "Kunne ikke gemme løbet. Prøv igen." });
      scrollToSaveFeedback();
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditMode && isLoadingExistingRun) {
    return (
      <div className={`relative min-h-screen overflow-hidden bg-rose-950 text-rose-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-rose-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-rose-950/20 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-rose-200" />
            <p className="mt-5 text-xs font-semibold tracking-[0.28em] text-rose-100/55 uppercase">
              Rediger løb
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight text-rose-50 ${rubik.className}`}>
              Indlæser dine selfie-poster
            </h1>
            <p className="mt-3 text-sm leading-6 text-rose-100/70">
              Vi henter løbets data og klargør builderen til redigering.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative min-h-screen overflow-x-hidden bg-rose-950 text-rose-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-rose-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row lg:items-start">
          <MobileBuilderWarning />
          <section className="hidden w-full px-4 py-4 sm:px-6 sm:py-6 lg:block lg:h-screen lg:w-[52%] lg:overflow-y-auto lg:px-8 lg:py-8">
            <div className="mx-auto max-w-3xl">
              <fieldset
                disabled={isEditorBusy}
                aria-busy={isEditorBusy}
                className={`min-w-0 space-y-6 border-0 p-0 ${editorLockClass}`}
              >
                <div className="px-1 pt-1">
                  {isEditMode ? (
                    <div className="mb-4 inline-flex items-center rounded-full border border-rose-500/25 bg-rose-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-rose-50 uppercase">
                      Edit-mode
                    </div>
                  ) : null}
                  <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-rose-100/65 uppercase">
                    Løbets titel
                  </label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="F.eks. 4.A's kreative selfie-jagt"
                    className={textInputClass}
                  />
                </div>

                <div className="px-1">
                  <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-rose-100/65 uppercase">
                    Beskrivelse
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    placeholder="Skriv en kort og indbydende beskrivelse af selfie-jagten, så den også giver mening i arkivet."
                    className={textareaClass}
                  />
                </div>

                <div className="px-1">
                  <div className="rounded-[1.4rem] border border-rose-500/30 bg-rose-950/20 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-rose-100/65 uppercase">
                      Fag
                    </label>
                    <select
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3 text-slate-100 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="" className="bg-slate-900 text-white">
                        Vælg et fag til arkivet...
                      </option>
                      {SUBJECT_OPTIONS.map((subjectOption) => (
                        <option key={subjectOption} value={subjectOption} className="bg-slate-900 text-white">
                          {subjectOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="px-1">
                  <div className="rounded-[1.4rem] border border-rose-500/30 bg-rose-950/20 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-rose-100/65 uppercase">
                      GPS-radius
                    </label>
                    <select
                      value={radius}
                      onChange={(event) => setRadius(normalizeRunRadius(event.target.value))}
                      disabled={isEditorBusy}
                      className="w-full appearance-none rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3 text-slate-100 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    >
                      {RUN_RADIUS_OPTIONS.map((radiusOption) => (
                        <option key={radiusOption} value={radiusOption} className="bg-slate-900 text-white">
                          {radiusOption} meter
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm text-rose-100/70">
                      Vælg hvor tæt eleven skal være på posten, før GPS-låsen åbner.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setShowAiInterviewModal(true);
                    }}
                    disabled={isEditorBusy || isLoadingExistingRun}
                    className={`${aiActionButtonClass} rounded-full px-4 py-2 text-xs`}
                  >
                    <span aria-hidden>✨</span>
                    Smart udfyldning
                  </button>

                  <div className="flex items-end justify-between gap-4">
                    <p className="text-xs font-semibold tracking-[0.24em] text-rose-100/65 uppercase">
                      Dine poster
                    </p>
                    <span className="rounded-full border border-rose-500/30 bg-rose-950/20 px-3 py-1.5 text-sm font-semibold text-rose-100/80 backdrop-blur-xl">
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
                    id={`selfie-post-${question.id}`}
                    className="rounded-[1.7rem] border border-rose-500/30 bg-rose-950/20 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-950/20 text-sm font-bold text-rose-100">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold text-rose-100 ${rubik.className}`}>
                            Selfie-post {index + 1}
                          </h3>
                          <p className="text-xs text-rose-100/65">
                            {question.lat !== null && question.lng !== null ? "Pin valgt på kortet" : "Pin mangler"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-rose-100/65 uppercase">
                        Hvad skal billedtjekket genkende? (Hold det bredt og tilgivende, f.eks. &quot;ansigter&quot;)
                      </label>
                      <input
                        value={question.aiPrompt}
                        onChange={(event) => updateQuestion(question.id, { aiPrompt: event.target.value })}
                        placeholder='f.eks. "ansigter", "personer", "træ" eller "natur"'
                        className={textInputClass}
                      />
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-rose-100/65 uppercase">
                        Instruktion til deltagerne
                      </label>
                      <textarea
                        value={question.text}
                        onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                        rows={3}
                        placeholder="F.eks. Tag en selfie foran det ældste træ I kan finde, og se så forskrækkede ud som muligt."
                        className={textareaClass}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => assignPinFromCenter(question.id)}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-[1.2rem] border border-rose-500/30 bg-rose-500 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-400"
                    >
                      Hent pin til kortet
                    </button>

                    {question.lat !== null && question.lng !== null ? (
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <p className="text-xs text-rose-100/70">
                          Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                        </p>
                        <button
                          type="button"
                          onClick={() => updateQuestion(question.id, { lat: null, lng: null })}
                          disabled={isEditorBusy}
                          className="shrink-0 text-xs text-rose-300/60 underline underline-offset-2 hover:text-rose-200 disabled:pointer-events-none disabled:opacity-50"
                        >
                          Fjern placering
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}

                <div className="rounded-[1.7rem] border border-rose-500/30 bg-rose-950/20 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-5">
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="inline-flex items-center gap-2 rounded-[1.2rem] border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-sm font-semibold text-rose-100 backdrop-blur-xl transition hover:bg-rose-500/10"
                  >
                    <Plus className="h-4 w-4" />
                    Tilføj ny selfie-post
                  </button>

                  <div ref={saveFeedbackRef} className="mt-5 space-y-4">
                    {notice?.tone === "error" ? renderNotice() : null}
                    <button
                      type="button"
                      onClick={handleSaveRun}
                      disabled={isSaving}
                      className={`w-full rounded-[1.5rem] border border-rose-500/30 bg-rose-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-rose-500/20 transition-all duration-300 hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                        shouldHighlightSave
                          ? "scale-105 ring-4 ring-rose-400 ring-offset-2 ring-offset-rose-950 shadow-rose-400/50"
                          : ""
                      }`}
                    >
                      {isSaving ? "Gemmer..." : isEditMode ? "Gem ændringer i arkivet" : "Gem løb i arkivet"}
                    </button>
                  </div>
                </div>
              </fieldset>
            </div>
          </section>

          <aside className="hidden w-full p-4 pt-0 sm:px-6 lg:block lg:w-[48%] lg:self-start lg:p-8 lg:pl-0">
            <div className="lg:sticky lg:top-5">
              <div className="h-[42vh] min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-rose-500/20 bg-slate-900/60 shadow-[0_0_0_1px_rgba(244,63,94,0.08),0_0_36px_rgba(244,63,94,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
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
        </div>
      </div>

      {showDraftRecoveryPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 py-10 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-4xl border border-rose-400/25 bg-slate-950/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-100/70">Redningskrans</p>
            <h2 className={`mt-3 text-3xl font-black tracking-tight text-rose-50 ${rubik.className}`}>
              Vi fandt ugemte ændringer fra dit sidste besøg
            </h2>
            <p className="mt-4 text-sm leading-6 text-rose-100/80 sm:text-base">
              Hvis du fortsætter uden at gendanne kladden, beholder vi versionen fra arkivet og sletter den lokale kladde.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-3xl border border-rose-300/40 bg-rose-400 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-rose-500/20 transition hover:bg-rose-300"
              >
                Gendan ugemte ændringer
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-3xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-rose-50 transition hover:bg-white/10"
              >
                Slet kladde
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SelfieAiInterviewModal
        open={showAiInterviewModal}
        initialSubject={subject}
        onClose={closeAiInterviewModal}
        onComplete={handleAiInterviewComplete}
      />
    </>
  );
}
