"use client";

import FocusModeSetting from "@/components/focus/FocusModeSetting";
import { useBuilderFocusMode } from "@/hooks/useBuilderFocusMode";

import { BookOpen, Check, Crosshair, Flag, Loader2, Map, Plus, Shield, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { poppins, rubik } from "@/lib/fonts";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import ManualReuseModal, { type ManualReuseQuestion } from "@/components/builders/manual/ManualReuseModal";
import { useBuilderSaveGuidance } from "@/components/builders/useBuilderSaveGuidance";
import type { SavedZone } from "@/components/MapPicker";
import { getNormalizedRunRaceType, RACE_TYPES, type StoredRunRecord } from "@/utils/gpsRuns";
import {
  clearRunDraft,
  hasUnsavedDraft,
  readRunDraft,
  restoreDraftMapCenter,
  restoreDraftString,
  shouldRestoreRunDraftOnLoad,
  writeRunDraft,
} from "@/utils/runDrafts";
import { createClient } from "@/utils/supabase/client";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-3xl border border-cyan-500/20 bg-slate-900/50" />
  ),
});

const SUBJECT_TOPICS: Record<string, string[]> = {
  Dansk: ["Læsning & Forståelse", "Stavning & Grammatik", "Nordisk Mytologi"],
  Matematik: ["Geometri & Figurer", "Brøker & Procenter", "Algebra & Ligninger"],
  Engelsk: ["Grammatik & Bøjninger", "Hverdagsordforråd", "Britisk kultur"],
  "Natur/Teknologi": ["Solsystemet", "Menneskekroppen", "Vejr & Klima"],
  Historie: ["Vikingetiden", "Middelalderen", "2. Verdenskrig"],
  Idræt: ["Boldspil & Regler", "Anatomi & Puls", "De Olympiske Lege"],
  Geografi: ["Jordens opbygning & pladetektonik", "Klima & Plantebælter", "Bæredygtighed & Energi"],
  Biologi: ["Økosystemer & Fødekæder", "Celler & Mikroorganismer", "Genetik & DNA"],
  "Fysik/Kemi": ["Det periodiske system", "Energi & Kræfter", "Elektricitet & Magnetisme"],
  Samfundsfag: ["Demokrati & Politik", "Velfærdssamfundet", "EU & Internationale forhold"],
};

type Question = {
  id: number;
  type: "multiple_choice";
  text: string;
  aiPrompt: string;
  mediaUrl: string;
  answers: [string, string, string, string];
  correctIndex: number;
  points: number;
  lat: number | null;
  lng: number | null;
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

type BuilderNotice = {
  tone: "success" | "error";
  message: string;
};

const ZONE_KRIG_DRAFT_KEY = "draft_run_zone_krig";
const DEFAULT_MAP_CENTER: MapCenter = { lat: 55.6761, lng: 12.5683 };
const DEFAULT_QUESTION_POINTS = 10;

type ZoneKrigDraftState = {
  title?: unknown;
  description?: unknown;
  subject?: unknown;
  questions?: unknown;
  mapCenter?: unknown;
};

const DEFAULT_ANSWERS: [string, string, string, string] = ["", "", "", ""];

const createQuestion = (): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type: "multiple_choice",
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
  "w-full rounded-2xl border border-cyan-500/30 bg-slate-900/40 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeQuestionPoints(value: unknown) {
  const parsed = asNumberOrNull(value);
  return parsed !== null ? Math.max(0, Math.round(parsed)) : DEFAULT_QUESTION_POINTS;
}

function toAnswersTuple(value: unknown): [string, string, string, string] {
  if (!Array.isArray(value)) return DEFAULT_ANSWERS;
  const stringAnswers = value.filter((item): item is string => typeof item === "string");
  const padded = [...stringAnswers.slice(0, 4)];
  while (padded.length < 4) padded.push("");
  return [padded[0] ?? "", padded[1] ?? "", padded[2] ?? "", padded[3] ?? ""];
}

function toQuestionId(value: unknown, fallback: number) {
  const parsed = asNumberOrNull(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeQuestionForSave(question: Question): Question {
  return {
    ...question,
    text: question.text.trim(),
    aiPrompt: question.aiPrompt.trim(),
    mediaUrl: question.mediaUrl.trim(),
    answers: question.answers.map((a) => a.trim()) as Question["answers"],
    points: normalizeQuestionPoints(question.points),
  };
}

function isQuestionEmpty(question: Question) {
  return (
    !question.text &&
    !question.aiPrompt &&
    !question.mediaUrl &&
    question.answers.every((answer) => !answer) &&
    question.lat === null &&
    question.lng === null
  );
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
        type: "multiple_choice",
        text: asTrimmedString(candidate.text),
        aiPrompt: asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt),
        mediaUrl: asTrimmedString(candidate.mediaUrl ?? candidate.media_url),
        answers: rawAnswers,
        correctIndex: safeCorrectIndex,
        points: normalizeQuestionPoints(candidate.points),
        lat: asNumberOrNull(candidate.lat),
        lng: asNumberOrNull(candidate.lng),
      };
    })
    .filter((q): q is Question => q !== null);
}

export default function ZoneKrigBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className={`min-h-screen bg-slate-950 ${poppins.className}`}>
          <div className="flex min-h-screen items-center justify-center px-6 text-center">
            <div className="rounded-4xl border border-cyan-500/20 bg-slate-900/50 px-8 py-10 text-cyan-100 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <p className="text-xs font-semibold tracking-[0.28em] text-cyan-100/55 uppercase">Indlæser</p>
              <h1 className={`mt-3 text-3xl font-black tracking-tight text-cyan-100 ${rubik.className}`}>
                Zone-Krigen
              </h1>
            </div>
          </div>
        </div>
      }
    >
      <ZoneKrigBuilderContent />
    </Suspense>
  );
}

function ZoneKrigBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const { focusEnabled, focusStatus, setFocusEnabled, persistFocusMode } = useBuilderFocusMode(editRunId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [questions, setQuestions] = useState<Question[]>(() => [createQuestion()]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_MAP_CENTER);
  const [showDraftRecoveryPrompt, setShowDraftRecoveryPrompt] = useState(false);
  const [showReuseModal, setShowReuseModal] = useState(false);

  const isEditorBusy = isSaving || showDraftRecoveryPrompt;
  const editorLockClass = isEditorBusy ? "pointer-events-none opacity-50" : "";
  const builderStatusLabel = isSaving ? "Gemmer..." : "Gemmes lokalt";
  const builderStatusDescription = isSaving
    ? "Vi sender dine seneste ændringer til arkivet nu."
    : "Titel og zoner bliver gemt lokalt undervejs, indtil du trykker på Gem.";

  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedDraftRef = useRef(false);
  const shouldAutoRestoreDraftRef = useRef<boolean | null>(null);
  const pendingScrollTargetId = useRef<string | null>(null);

  const normalizedQuestionsForSave = useMemo(
    () =>
      questions
        .map(normalizeQuestionForSave)
        .filter(
          (question) =>
            question.text.length > 0 ||
            question.answers.some((answer) => answer.length > 0) ||
            question.lat !== null ||
            question.lng !== null
        ),
    [questions]
  );
  const hasIncompleteQuestions = useMemo(
    () => normalizedQuestionsForSave.some((question) => !question.text || question.answers.some((answer) => !answer)),
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

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-3xl border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-50"
            : "border-red-300/30 bg-red-500/10 text-red-100"
        } ${className}`}
      >
        {notice.message}
      </div>
    ) : null;

  const applyDraftState = (draft: ZoneKrigDraftState) => {
    const restoredQuestions = toQuestionList(draft.questions);
    setTitle(restoreDraftString(draft.title));
    setDescription(restoreDraftString(draft.description));
    setSubject(restoreDraftString(draft.subject));
    setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion()]);
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
    if (!pendingScrollTargetId.current || typeof document === "undefined" || typeof window === "undefined") return;
    const targetId = pendingScrollTargetId.current;
    const frameId = window.requestAnimationFrame(() => {
      const el = document.getElementById(`zone-post-${targetId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingScrollTargetId.current = null;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [questions]);

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
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!isActive) return;
        if (userError || !user) {
          setNotice({ tone: "error", message: "Du skal være logget ind for at redigere dette løb." });
          return;
        }
        const { data: run, error } = await supabase
          .from("gps_runs")
          .select("id,user_id,title,subject,description,topic,questions,race_type,raceType:race_type")
          .eq("id", editRunId)
          .eq("user_id", user.id)
          .maybeSingle<StoredRunRecord>();
        if (!isActive) return;
        if (error || !run) {
          setNotice({ tone: "error", message: "Kunne ikke indlæse løbet." });
          return;
        }
        if (getNormalizedRunRaceType(run) !== RACE_TYPES.ZONE_KRIG) {
          setNotice({ tone: "error", message: "Dette loeb er ikke et Zone-Krig loeb." });
          return;
        }
        const loadedQuestions = toQuestionList(run.questions);
        const loadedDescription = asTrimmedString(run.description);
        const loadedTopic = asTrimmedString(run.topic);
        const firstPinnedQuestion = loadedQuestions.find((q) => q.lat !== null && q.lng !== null) ?? null;
        setTitle(asTrimmedString(run.title));
        setDescription(loadedDescription || loadedTopic);
        setSubject(asTrimmedString(run.subject));
        setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion()]);
        setMapCenter(
          firstPinnedQuestion
            ? { lat: firstPinnedQuestion.lat ?? DEFAULT_MAP_CENTER.lat, lng: firstPinnedQuestion.lng ?? DEFAULT_MAP_CENTER.lng }
            : DEFAULT_MAP_CENTER
        );
        setLoadedRunId(run.id);
      } catch (err) {
        console.error("Kunne ikke indlæse løbet:", err);
        if (!isActive) return;
        setNotice({ tone: "error", message: "Vi kunne ikke åbne dette løb til redigering." });
      } finally {
        if (isActive) setIsLoadingExistingRun(false);
      }
    };

    void loadRunForEditing();
    return () => { isActive = false; };
  }, [editRunId, isEditMode]);

  useEffect(() => {
    if (hasInitializedDraftRef.current) return;
    if (shouldAutoRestoreDraftRef.current === null) {
      shouldAutoRestoreDraftRef.current = shouldRestoreRunDraftOnLoad(ZONE_KRIG_DRAFT_KEY);
    }
    const shouldAutoRestoreDraft = shouldAutoRestoreDraftRef.current;
    if (isEditMode) {
      if (isLoadingExistingRun) return;
      if (loadedRunId !== editRunId) { hasInitializedDraftRef.current = true; return; }
    }
    const restoredDraft = shouldAutoRestoreDraft
      ? readRunDraft<ZoneKrigDraftState>(ZONE_KRIG_DRAFT_KEY, editRunId)
      : null;
    if (restoredDraft) {
      applyDraftState(restoredDraft);
      setNotice(null);
      hasInitializedDraftRef.current = true;
      return;
    }
    if (isEditMode && !shouldAutoRestoreDraft && hasUnsavedDraft(ZONE_KRIG_DRAFT_KEY, editRunId)) {
      setShowDraftRecoveryPrompt(true);
      hasInitializedDraftRef.current = true;
      return;
    }
    hasInitializedDraftRef.current = true;
  }, [editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;
    if (showDraftRecoveryPrompt) return;
    writeRunDraft(ZONE_KRIG_DRAFT_KEY, editRunId, {
      title,
      description,
      subject,
      questions,
      mapCenter,
    } satisfies ZoneKrigDraftState);
  }, [description, editRunId, mapCenter, questions, showDraftRecoveryPrompt, subject, title]);

  const handleRestoreDraft = () => {
    const restoredDraft = readRunDraft<ZoneKrigDraftState>(ZONE_KRIG_DRAFT_KEY, editRunId);
    if (!restoredDraft) {
      setShowDraftRecoveryPrompt(false);
      setNotice({ tone: "error", message: "Vi kunne ikke finde den lokale kladde mere." });
      return;
    }
    applyDraftState(restoredDraft);
    setShowDraftRecoveryPrompt(false);
    setNotice({ tone: "success", message: "Vi gendannede dine ugemte ændringer fra sidste besøg." });
  };

  const handleDiscardDraft = () => {
    clearRunDraft(ZONE_KRIG_DRAFT_KEY);
    setShowDraftRecoveryPrompt(false);
    setNotice({ tone: "success", message: "Den lokale kladde blev slettet." });
  };

  const zones = useMemo<SavedZone[]>(() => {
    const mapped = questions.map((q, index): SavedZone | null => {
      if (q.lat === null || q.lng === null) {
        return null;
      }

      return {
        id: String(q.id),
        lat: q.lat,
        lng: q.lng,
        radius: 30,
        label: `Zone ${index + 1}`,
      };
    });

    return mapped.filter((z): z is SavedZone => z !== null);
  }, [questions]);

  function updateQuestion<K extends keyof Question>(id: number, key: K, value: Question[K]): void;
  function updateQuestion(id: number, updates: Partial<Question>): void;
  function updateQuestion<K extends keyof Question>(
    id: number,
    updatesOrKey: Partial<Question> | K,
    value?: Question[K]
  ): void {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        if (typeof updatesOrKey === "string") return { ...q, [updatesOrKey]: value } as Question;
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

  const deleteQuestion = (indexToDelete: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== indexToDelete));
  };

  const assignZoneFromCenter = (id: number) => {
    const currentIndex = questions.findIndex((q) => q.id === id);
    const nextQuestion = currentIndex >= 0 ? questions[currentIndex + 1] : null;
    if (nextQuestion) pendingScrollTargetId.current = String(nextQuestion.id);
    updateQuestion(id, { lat: mapCenter.lat, lng: mapCenter.lng });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createQuestion()]);
  };

  const normalizeQuestionsForReuse = useCallback(
    (value: unknown): ManualReuseQuestion[] => toQuestionList(value),
    []
  );

  const mergeImportedQuestions = useCallback((previous: Question[], imported: Question[]) => {
    const preservedQuestions = previous.filter((question) => !isQuestionEmpty(question));
    return preservedQuestions.length > 0 ? [...preservedQuestions, ...imported] : imported;
  }, []);

  const handleImportReuseQuestion = useCallback(
    async (question: ManualReuseQuestion) => {
      setQuestions((previous) => {
        const nextId = previous.reduce((maxId, currentQuestion) => Math.max(maxId, currentQuestion.id), Date.now()) + 1;
        const importedQuestion: Question = {
          ...question,
          id: nextId,
          type: "multiple_choice",
          lat: null,
          lng: null,
          points: normalizeQuestionPoints(question.points),
        };

        pendingScrollTargetId.current = String(importedQuestion.id);
        return mergeImportedQuestions(previous, [importedQuestion]);
      });

      setNotice({
        tone: "success",
        message: "Zonen blev hentet fra arkivet. Husk at placere den pa kortet.",
      });
    },
    [mergeImportedQuestions]
  );

  const handleImportReuseRun = useCallback(
    async (importedQuestions: ManualReuseQuestion[]) => {
      setQuestions((previous) => {
        const currentMaxId = previous.reduce((maxId, question) => Math.max(maxId, question.id), Date.now());
        const nextQuestions = importedQuestions.map((question, index): Question => ({
          ...question,
          id: currentMaxId + index + 1,
          type: "multiple_choice",
          lat: null,
          lng: null,
          points: normalizeQuestionPoints(question.points),
        }));

        if (nextQuestions.length > 0) {
          pendingScrollTargetId.current = String(nextQuestions[0].id);
        }

        return mergeImportedQuestions(previous, nextQuestions);
      });

      setShowReuseModal(false);
      setNotice({
        tone: "success",
        message: "Spoergsmaalssaettet er hentet fra arkivet. Placer nu zonerne pa kortet.",
      });
    },
    [mergeImportedQuestions]
  );

  const openReuseModal = () => {
    setNotice(null);
    setShowReuseModal(true);
  };

  const closeReuseModal = () => {
    setShowReuseModal(false);
  };

  const handleSaveRun = async () => {
    setNotice(null);
    if (isEditMode && loadedRunId !== editRunId) {
      setNotice({ tone: "error", message: "Løbet er ikke indlæst endnu. Vent og prøv igen." });
      scrollToSaveFeedback();
      return;
    }
    if (!title.trim()) {
      setNotice({ tone: "error", message: "Udfyld venligst titel." });
      scrollToSaveFeedback();
      return;
    }
    if (normalizedQuestionsForSave.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst én udfyldt zone." });
      scrollToSaveFeedback();
      return;
    }
    if (hasIncompleteQuestions) {
      setNotice({ tone: "error", message: "Udfyld tekst og alle fire svarmuligheder på hver zone." });
      scrollToSaveFeedback();
      return;
    }
    if (hasMissingCoordinates) {
      setNotice({ tone: "error", message: "Du mangler at placere alle zoner på kortet." });
      scrollToSaveFeedback();
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setNotice({ tone: "error", message: "Du skal være logget ind for at gemme løbet." });
        scrollToSaveFeedback();
        return;
      }
      const normalizedDescription = description.trim();
      const payload = {
        title: title.trim(),
        subject: subject.trim() || "Generelt",
        description: normalizedDescription,
        topic: normalizedDescription || title.trim(),
        questions: normalizedQuestionsForSave,
        race_type: RACE_TYPES.ZONE_KRIG,
      };
      let savedRunId = editRunId;
      if (isEditMode) {
        const { data: updatedRuns, error } = await supabase
          .from("gps_runs")
          .update(payload)
          .eq("id", editRunId)
          .eq("user_id", user.id)
          .select("id");
        if (error) throw error;
        if (!updatedRuns || updatedRuns.length === 0) {
          setNotice({ tone: "error", message: "Vi kunne ikke gemme ændringerne." });
          scrollToSaveFeedback();
          return;
        }
      } else {
        const { data: savedRuns, error } = await supabase.from("gps_runs").insert({ user_id: user.id, ...payload }).select("id");
        savedRunId = savedRuns?.[0]?.id ?? "";
        if (error) throw error;
      }
      await persistFocusMode(savedRunId);

      setNotice({ tone: "success", message: isEditMode ? "Ændringerne er gemt!" : "Zone-Krig løbet er gemt i arkivet!" });
      clearRunDraft(ZONE_KRIG_DRAFT_KEY);
      if (!isEditMode) {
        setTitle("");
        setDescription("");
        setSubject("");
        setQuestions([createQuestion()]);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      router.push("/dashboard/arkiv");
    } catch (err) {
      console.error("Fejl ved gemning:", err);
      setNotice({ tone: "error", message: "Kunne ikke gemme løbet. Prøv igen." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditMode && isLoadingExistingRun) {
    return (
      <div className={`relative min-h-screen overflow-hidden bg-slate-950 text-cyan-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-linear-to-br from-slate-900 via-slate-950 to-black" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-cyan-500/20 bg-slate-900/60 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-300" />
            <p className="mt-5 text-xs font-semibold tracking-[0.28em] text-cyan-100/55 uppercase">Rediger Zone-Krig</p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight text-cyan-100 ${rubik.className}`}>
              Indlæser zoner
            </h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative min-h-screen bg-slate-950 text-cyan-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-linear-to-br from-slate-900 via-slate-950 to-black" />
        <div className="relative flex min-h-screen flex-col lg:flex-row">
          <MobileBuilderWarning />

          {/* Left panel */}
          <section className="hidden w-full px-4 py-4 sm:px-6 sm:py-6 lg:block lg:w-[52%] lg:px-8 lg:py-8">
            <div className="mx-auto max-w-3xl">
              <fieldset
                disabled={isEditorBusy}
                aria-busy={isEditorBusy}
                className={`min-w-0 space-y-5 border-0 p-0 ${editorLockClass}`}
              >
                <div className="px-1 pt-1">
                  {isEditMode ? (
                    <div className="mb-4 inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-cyan-100 uppercase">
                      Edit-mode
                    </div>
                  ) : null}

                  {/* Intro block */}
                  <div className="mb-8 rounded-[1.8rem] border border-cyan-500/20 bg-slate-900/50 p-5 shadow-[0_0_40px_rgba(34,211,238,0.06)] backdrop-blur-xl">
                    <div className="mb-1 flex items-center gap-2">
                      <Flag className="h-4 w-4 text-cyan-400" />
                      <p className="text-[10px] font-bold tracking-[0.36em] text-cyan-400/70 uppercase">
                        Taktisk Multiplayer
                      </p>
                    </div>
                    <h2 className={`text-xl font-black text-cyan-100 ${rubik.className}`}>
                      Zone-Krigen: Kommandocentral
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-cyan-100/70">
                      Omdan skolegården til en live multiplayer-arena, hvor holdene bevæger sig frit mellem alle zoner og kæmper om kontrollen over kortet. Hver zone er et taktisk mål, og eleverne vælger selv, om de vil angribe, forsvare eller skifte retning undervejs.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-cyan-100/70">
                      Din opgave som lærer er at placere zonerne klogt og skrive opgaver, der gør kampen spændende. Tænk i afstande, overblik og variation, så holdene hele tiden skal vælge mellem sikre point og risikable erobringer.
                    </p>
                    <ul className="mt-4 space-y-2">
                      <li className="flex items-start gap-3 text-sm text-slate-300">
                        <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        <span>
                          <strong className="text-cyan-100">Erobring:</strong> Et hold overtager en zone ved at stå fysisk i zonen og besvare zone-opgaven korrekt. Det er altså ikke nok bare at finde stedet - svaret skal også være rigtigt.
                        </span>
                      </li>
                      <li className="flex items-start gap-3 text-sm text-slate-300">
                        <Flag className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        <span>
                          <strong className="text-cyan-100">Point og kontrol:</strong> Point bliver optjent gennem kontrollen over zonerne. Når et hold overtager en fjendtlig eller neutral zone, ændrer magtbalancen sig med det samme, så hvert korrekt svar får direkte betydning i spillet.
                        </span>
                      </li>
                      <li className="flex items-start gap-3 text-sm text-slate-300">
                        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        <span>
                          <strong className="text-cyan-100">Fredningstid / skjold:</strong> Efter en erobring får zonen en kort fredet periode. Det forhindrer, at samme zone bare skifter hænder hvert sekund, og giver holdet en reel chance for at rykke videre eller organisere et forsvar.
                        </span>
                      </li>
                      <li className="flex items-start gap-3 text-sm text-slate-300">
                        <Map className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        <span>
                          <strong className="text-cyan-100">Fri bevægelighed:</strong> Holdene følger ikke en fast rute. De kan bevæge sig frit mellem alle zoner og vælge deres egen strategi, så kortets placeringer får stor betydning for tempo, pres og overraskelsesangreb.
                        </span>
                      </li>
                    </ul>
                    <p className="mt-4 text-xs leading-5 text-cyan-100/60">
                      Brug kortet til højre til at placere zonerne. Jo bedre du spreder zonerne og varierer sværhedsgraden, jo mere taktisk og levende bliver kampen.
                    </p>
                  </div>

                  <div className="rounded-4xl border border-cyan-500/30 bg-slate-900/40 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <label className="block text-xs font-semibold tracking-[0.22em] text-cyan-100/65 uppercase">
                            Løbets titel
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-xl ${
                              isSaving
                                ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-50"
                                : "border-cyan-500/20 bg-slate-900/45 text-cyan-100/72"
                            }`}
                          >
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-2 w-2 rounded-full bg-cyan-300/70" />}
                            {builderStatusLabel}
                          </span>
                        </div>
                      </div>

                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isEditorBusy}
                        placeholder="F.eks. 4.B's Zone-Krig rundt om skolen"
                        className="w-full rounded-[1.6rem] border border-cyan-500/30 bg-slate-900/40 px-5 py-4 text-xl font-bold text-slate-100 placeholder:text-slate-500 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                      />

                      <p className="text-sm leading-6 text-cyan-100/68">{builderStatusDescription}</p>
                    </div>
                  </div>
                </div>

                {/* Subject */}
                <div className="px-1">
                  <div className="rounded-3xl border border-cyan-500/20 bg-slate-900/40 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-cyan-100/65 uppercase">
                      Emne
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={isEditorBusy}
                      className="w-full rounded-2xl border border-cyan-500/30 bg-slate-900/40 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    >
                      <option value="" className="bg-slate-900 text-white">Vælg et fag til arkivet...</option>
                      {Object.keys(SUBJECT_TOPICS).map((s) => (
                        <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Zone count header */}
                <div className="space-y-4 px-1">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-xs font-semibold tracking-[0.24em] text-cyan-100/65 uppercase">
                      Dine zoner
                    </p>
                    <span className="rounded-full border border-cyan-500/30 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-cyan-100/80 backdrop-blur-xl">
                      {questions.length}
                    </span>
                  </div>
                  {renderNotice()}
                </div>

                {/* Zone cards */}
                {questions.map((question, questionIndex) => (
                  <article
                    key={question.id}
                    id={`zone-post-${question.id}`}
                    className="rounded-[1.8rem] border border-cyan-500/20 bg-slate-900/50 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/30 bg-slate-900/40 text-sm font-bold text-cyan-300">
                          {questionIndex + 1}
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold text-cyan-100 ${rubik.className}`}>
                            Zone {questionIndex + 1}
                          </h3>
                          <p className="text-xs text-cyan-100/55">
                            {question.lat !== null && question.lng !== null
                              ? "Zone placeret på kortet"
                              : "Zone ikke placeret endnu"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-cyan-500/20 bg-slate-900/40 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-cyan-100/60 uppercase backdrop-blur-xl">
                          4 svar
                        </span>
                        <label className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-slate-900/40 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-cyan-100/60 uppercase backdrop-blur-xl">
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
                            className="w-16 bg-transparent text-right text-sm font-semibold tracking-normal text-cyan-50 focus:outline-none"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(questionIndex)}
                          disabled={isEditorBusy || questions.length <= 1}
                          aria-label={`Slet Zone ${questionIndex + 1}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-cyan-100/65 uppercase">
                        Zone-opgave
                      </label>
                      <input
                        value={question.text}
                        onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                        disabled={isEditorBusy}
                        placeholder="Skriv zone-opgaven her..."
                        className={inputClass}
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                      {question.answers.map((answer, answerIndex) => {
                        const isCorrect = question.correctIndex === answerIndex;
                        return (
                          <div
                            key={`${question.id}-${answerIndex}`}
                            className={`flex items-center gap-2.5 rounded-[1.25rem] border px-3 py-2.5 transition ${
                              isCorrect
                                ? "border-cyan-300/40 bg-cyan-500/10 shadow-[0_14px_28px_rgba(34,211,238,0.10)]"
                                : "border-cyan-500/20 bg-slate-900/40 hover:border-cyan-400/25"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuestion(question.id, { correctIndex: answerIndex })}
                              aria-label={`Markér svar ${answerIndex + 1} som korrekt`}
                              aria-pressed={isCorrect}
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black transition ${
                                isCorrect
                                  ? "border-cyan-200 bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.24)]"
                                  : "border-cyan-500/30 bg-slate-900/40 text-cyan-100/78 hover:border-cyan-300/30"
                              }`}
                            >
                              {String.fromCharCode(65 + answerIndex)}
                            </button>
                            <input
                              value={answer}
                              onChange={(e) => updateAnswer(question.id, answerIndex, e.target.value)}
                              disabled={isEditorBusy}
                              placeholder={`Svar ${answerIndex + 1}`}
                              className="min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuestion(question.id, { correctIndex: answerIndex })}
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                                isCorrect
                                  ? "border-cyan-200/60 bg-cyan-300 text-slate-950"
                                  : "border-cyan-500/20 bg-slate-900/40 text-cyan-100/60 hover:border-cyan-300/30 hover:text-cyan-100"
                              }`}
                            >
                              {isCorrect ? <Check className="h-3.5 w-3.5" /> : null}
                              {isCorrect ? "Korrekt" : "Markér"}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => assignZoneFromCenter(question.id)}
                      disabled={isEditorBusy}
                      className="mt-4 w-full rounded-[1.35rem] border border-cyan-500/30 bg-cyan-500 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    >
                      Placer zone fra kortet
                    </button>

                    {question.lat !== null && question.lng !== null ? (
                      <p className="mt-2.5 text-xs text-cyan-100/60 font-mono">
                        {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                      </p>
                    ) : null}
                  </article>
                ))}

                {/* Add zone + save */}
                <div className="rounded-4xl border border-cyan-500/20 bg-slate-900/50 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={addQuestion}
                      disabled={isEditorBusy}
                      className="inline-flex items-center gap-2 rounded-[1.4rem] border border-cyan-500/30 bg-slate-900/40 px-4 py-3 text-sm font-semibold text-cyan-100 backdrop-blur-xl transition hover:bg-slate-800/50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Tilføj zone
                    </button>

                    <button
                      type="button"
                      onClick={openReuseModal}
                      disabled={isEditorBusy}
                      className="inline-flex items-center gap-2 rounded-[1.4rem] border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-50 backdrop-blur-xl transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                    >
                      <BookOpen className="h-4 w-4" />
                      Hent fra arkiv
                    </button>
                  </div>

                  <div ref={saveFeedbackRef} className="mt-6 space-y-4">
                    {notice?.tone === "error" ? renderNotice() : null}
                    <FocusModeSetting enabled={focusEnabled} status={focusStatus} onChange={setFocusEnabled} disabled={isSaving} />
                    <button
                      type="button"
                      onClick={handleSaveRun}
                      disabled={isSaving}
                      className={`w-full rounded-[1.6rem] border border-cyan-500/30 bg-cyan-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 ${
                        shouldHighlightSave
                          ? "scale-105 ring-4 ring-cyan-400 ring-offset-2 ring-offset-slate-950 shadow-cyan-400/50"
                          : ""
                      }`}
                    >
                      {isSaving ? "Gemmer..." : isEditMode ? "Gem ændringer i arkivet" : "Gem Zone-Krig løb"}
                    </button>
                  </div>
                </div>
              </fieldset>
            </div>
          </section>

          {/* Right panel: map */}
          <aside className="hidden w-full p-4 pt-0 sm:px-6 lg:block lg:w-[48%] lg:p-8 lg:pl-0">
            <div className="lg:sticky lg:top-20">
              <div className="h-[42vh] min-h-80 w-full overflow-hidden rounded-4xl border border-cyan-500/15 bg-slate-900/50 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_0_36px_rgba(34,211,238,0.06),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-(--spacing(28)))]">
                <MapPicker center={mapCenter} pins={[]} zones={zones} mapMode="zone-krig" onCenterChange={setMapCenter} autoLocateOnLoad={!isEditMode} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Draft recovery prompt */}
      {showDraftRecoveryPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 py-10 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-4xl border border-cyan-400/25 bg-slate-950/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">Redningskrans</p>
            <h2 className={`mt-3 text-3xl font-black tracking-tight text-cyan-50 ${rubik.className}`}>
              Vi fandt ugemte ændringer
            </h2>
            <p className="mt-4 text-sm leading-6 text-cyan-100/80 sm:text-base">
              Vil du gendanne dine ugemte ændringer fra sidste besøg?
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-3xl border border-cyan-300/40 bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
              >
                Gendan ugemte ændringer
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-3xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-cyan-50 transition hover:bg-white/10"
              >
                Slet kladde
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ManualReuseModal
        open={showReuseModal}
        currentRunId={editRunId || undefined}
        onClose={closeReuseModal}
        normalizeQuestions={normalizeQuestionsForReuse}
        onImportQuestion={handleImportReuseQuestion}
        onImportRun={handleImportReuseRun}
        importRunLabel="Importer alle zoner"
      />
    </>
  );
}
