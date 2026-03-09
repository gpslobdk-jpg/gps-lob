"use client";

import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SavedPin } from "@/components/MapPicker";
import { SELFIE_PROMPT, SYSTEM_ARKITEKT } from "@/constants/aiPrompts";
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
  restoreDraftBoolean,
  restoreDraftMapCenter,
  restoreDraftString,
  restoreRunDraft,
  writeRunDraft,
} from "@/utils/runDrafts";
import { createClient } from "@/utils/supabase/client";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-3xl border border-orange-400/20 bg-rose-950/55" />
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

const GRADE_OPTIONS = [
  "Indskoling",
  "Mellemtrin",
  "Udskoling",
  "Ungdomsuddannelse",
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

type GeneratedQuestion = {
  text?: string;
  answers?: string[];
  correctIndex?: number;
};

type StoredSelfieQuestionRecord = {
  id?: unknown;
  type?: unknown;
  isSelfie?: unknown;
  is_selfie?: unknown;
  text?: unknown;
  aiPrompt?: unknown;
  ai_prompt?: unknown;
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
  subject?: unknown;
  showSubjectField?: unknown;
  showAIMetadataFields?: unknown;
  questions?: unknown;
  aiRunBrief?: unknown;
  aiSubject?: unknown;
  aiGrade?: unknown;
  mapCenter?: unknown;
};

const textInputClass =
  "w-full rounded-2xl border border-orange-400/20 bg-rose-950/55 px-4 py-3 text-orange-100 placeholder:text-orange-100/35 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-orange-400";

const textareaClass =
  "w-full rounded-2xl border border-orange-400/20 bg-rose-950/55 px-4 py-3 text-orange-100 placeholder:text-orange-100/35 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-orange-400";

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

function toSelfieQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const timestamp = Date.now();

  return value
    .map((item, index): Question | null => {
      if (!isRecord(item)) return null;

      const candidate = item as StoredSelfieQuestionRecord;
      const normalizedTarget = asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt);

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

function extractRequestedCount(text: string) {
  const match = text.match(/\b([1-9]|1\d|20)\b/);
  return match ? Number(match[1]) : 5;
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
      ? `Find ${trimmedTarget.toLowerCase()} og tag en selfie med det i baggrunden`
      : "Tag en selfie på det rigtige sted");

  const normalizedBase = ensureSentenceEnding(baseInstruction);
  const hasReminder = normalizedBase
    .toLocaleLowerCase("da-DK")
    .includes(SELFIE_REMINDER.toLocaleLowerCase("da-DK"));

  return hasReminder ? normalizedBase : `${normalizedBase} ${SELFIE_REMINDER}`;
}

export default function SelfieBuilderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [showSubjectField, setShowSubjectField] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAIMetadataFields, setShowAIMetadataFields] = useState(false);
  const [aiRunBrief, setAiRunBrief] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiGrade, setAiGrade] = useState("Mellemtrin");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([createQuestion()]);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [mapCenter, setMapCenter] = useState<MapCenter>({
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
  });
  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedDraftRef = useRef(false);

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-[1.4rem] border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-50"
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
        .select("id,user_id,title,subject,description,topic,questions,race_type")
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
        setIsLoadingExistingRun(false);
        return;
      }

      const loadedQuestions = toSelfieQuestions(run.questions);
      const loadedTopic = asTrimmedString(run.topic);
      const firstPinnedQuestion =
        loadedQuestions.find((question) => question.lat !== null && question.lng !== null) ?? null;

      setTitle(asTrimmedString(run.title));
      setSubject(asTrimmedString(run.subject));
      setShowSubjectField(Boolean(asTrimmedString(run.subject)));
      setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion()]);
      setPreviewQuestions([]);
      setShowAIModal(false);
      setShowAIMetadataFields(false);
      setAiSubject("");
      setAiRunBrief(loadedTopic);
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
      setIsLoadingExistingRun(false);
    };

    void loadRunForEditing();

    return () => {
      isActive = false;
    };
  }, [editRunId, isEditMode]);

  useEffect(() => {
    if (hasInitializedDraftRef.current) return;

    if (isEditMode) {
      if (isLoadingExistingRun) return;
      if (loadedRunId !== editRunId) {
        hasInitializedDraftRef.current = true;
        return;
      }
    }

    const restoredDraft = restoreRunDraft<SelfieBuilderDraftState>(
      SELFIE_DRAFT_STORAGE_KEY,
      editRunId,
      isEditMode
        ? "Der ligger en ikke-gemt kladde til dette selfie-løb. Vil du gendanne den?"
        : "Der ligger en ikke-gemt kladde til selfie-byggeren. Vil du gendanne den?"
    );

    if (restoredDraft) {
      const restoredSubject = restoreDraftString(restoredDraft.subject);
      const restoredQuestions = toSelfieQuestions(restoredDraft.questions);

      setTitle(restoreDraftString(restoredDraft.title));
      setSubject(restoredSubject);
      setShowSubjectField(
        restoreDraftBoolean(restoredDraft.showSubjectField, Boolean(restoredSubject.trim()))
      );
      setShowAIMetadataFields(restoreDraftBoolean(restoredDraft.showAIMetadataFields));
      setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion()]);
      setPreviewQuestions([]);
      setShowAIModal(false);
      setAiRunBrief(restoreDraftString(restoredDraft.aiRunBrief));
      setAiSubject(restoreDraftString(restoredDraft.aiSubject));
      setAiGrade(restoreDraftString(restoredDraft.aiGrade) || "Mellemtrin");
      setMapCenter(restoreDraftMapCenter(restoredDraft.mapCenter, DEFAULT_MAP_CENTER));
      setNotice(null);
    }

    hasInitializedDraftRef.current = true;
  }, [editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;

    writeRunDraft(SELFIE_DRAFT_STORAGE_KEY, editRunId, {
      title,
      subject,
      showSubjectField,
      showAIMetadataFields,
      questions,
      aiRunBrief,
      aiSubject,
      aiGrade,
      mapCenter,
    } satisfies SelfieBuilderDraftState);
  }, [
    aiGrade,
    aiRunBrief,
    aiSubject,
    editRunId,
    mapCenter,
    questions,
    showAIMetadataFields,
    showSubjectField,
    subject,
    title,
  ]);

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

  const updateQuestion = (id: number, updates: Partial<Question>) => {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...updates } : question))
    );
  };

  const updatePreviewQuestion = (id: number, updates: Partial<Question>) => {
    setPreviewQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...updates } : question))
    );
  };

  const addQuestion = () => {
    setQuestions((current) => [...current, createQuestion()]);
  };

  const assignPinFromCenter = (id: number) => {
    updateQuestion(id, { lat: mapCenter.lat, lng: mapCenter.lng });
  };

  const closeAIModal = () => {
    if (isGenerating) return;
    setShowAIModal(false);
    setPreviewQuestions([]);
    setShowAIMetadataFields(false);
  };

  const handleApproveAIPreview = () => {
    if (previewQuestions.length === 0) return;

    const timestamp = Date.now();
    setQuestions(
      previewQuestions.map((question, index) => {
        const normalizedTarget = question.aiPrompt.trim();
        return {
          ...question,
          id: timestamp + index,
          text: normalizeSelfieInstruction(question.text, normalizedTarget),
          aiPrompt: normalizedTarget,
          answers: buildAnswers(normalizedTarget),
          correctIndex: 0,
          lat: null,
          lng: null,
        };
      })
    );
    setPreviewQuestions([]);
    setShowAIModal(false);
    setShowAIMetadataFields(false);
  };

  const handleAIGenerate = async () => {
    const normalizedBrief = aiRunBrief.trim();
    const normalizedSubject = aiSubject.trim() || subject.trim() || "Generelt";
    const normalizedGrade = aiGrade.trim() || "Ikke angivet";
    const requestedCount = extractRequestedCount(normalizedBrief);

    if (!normalizedBrief) {
      alert("Skriv først, hvilket sted eller tema AI'en skal bruge til selfie-jagten.");
      return;
    }

    setIsGenerating(true);
    setPreviewQuestions([]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: normalizedSubject,
          topic: normalizedBrief,
          grade: normalizedGrade,
          count: requestedCount,
          prompt:
            `Lav præcis ${requestedCount} selfie-poster om ${normalizedBrief}. ` +
            `Baggrundsmotivet skal være tydeligt, og instruktionen skal være kort og klar.`,
          systemContext: SYSTEM_ARKITEKT,
          builderContext: SELFIE_PROMPT.replace("[EMNE]", normalizedBrief).replace(
            "[MÅLGRUPPE]",
            normalizedGrade
          ),
        }),
      });

      const data = (await response.json()) as { questions?: GeneratedQuestion[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "AI-generering fejlede");
      }

      const generated = Array.isArray(data.questions)
        ? data.questions
            .map((question, index): Question | null => {
              const answers = Array.isArray(question.answers)
                ? question.answers.filter((item): item is string => typeof item === "string")
                : [];
              const safeCorrectIndex =
                typeof question.correctIndex === "number" &&
                Number.isInteger(question.correctIndex) &&
                question.correctIndex >= 0 &&
                question.correctIndex < answers.length
                  ? question.correctIndex
                  : 0;
              const targetObject = answers[safeCorrectIndex]?.trim() || answers[0]?.trim() || "";
              const instruction = normalizeSelfieInstruction(question.text ?? "", targetObject);

              if (!targetObject || !instruction) return null;

              return {
                id: Date.now() + index,
                type: "ai_image",
                isSelfie: true,
                text: instruction,
                aiPrompt: targetObject,
                answers: buildAnswers(targetObject),
                correctIndex: 0,
                lat: null,
                lng: null,
              };
            })
            .filter((question): question is Question => question !== null)
        : [];

      if (generated.length === 0) {
        alert("AI returnerede ingen brugbare selfie-poster. Prøv igen.");
        return;
      }

      setPreviewQuestions(generated);
    } catch (error) {
      console.error("AI-selfiefejl:", error);
      alert("Der skete en fejl. Prøv igen.");
    } finally {
      setIsGenerating(false);
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
      setNotice({ tone: "error", message: "Udfyld venligst løbets titel." });
      scrollToSaveFeedback();
      return;
    }

    const normalizedQuestions = questions
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
      );

    if (normalizedQuestions.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst én udfyldt selfie-post." });
      scrollToSaveFeedback();
      return;
    }

    const hasIncompleteQuestions = normalizedQuestions.some(
      (question) => !question.text || !question.aiPrompt
    );
    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message: "Udfyld både baggrundsmotiv og instruktion til deltagerne på hver post.",
      });
      scrollToSaveFeedback();
      return;
    }

    if (!normalizedQuestions.some((question) => question.lat !== null && question.lng !== null)) {
      setNotice({
        tone: "error",
        message: "Du mangler at sætte pins på kortet. Mindst én selfie-post skal have koordinater.",
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
        description: "",
        topic: aiRunBrief.trim(),
        questions: normalizedQuestions,
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
        setSubject("");
        setShowSubjectField(false);
        setQuestions([createQuestion()]);
        setAiRunBrief("");
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
      <div className={`relative min-h-screen overflow-hidden bg-rose-950 text-orange-100 ${poppins.className}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.28),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(244,114,182,0.16),_transparent_28%)]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-[2rem] border border-orange-400/20 bg-rose-950/55 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-orange-200" />
            <p className="mt-5 text-xs font-semibold tracking-[0.28em] text-orange-100/55 uppercase">
              Rediger løb
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight text-orange-50 ${rubik.className}`}>
              Indlæser dine selfie-poster
            </h1>
            <p className="mt-3 text-sm leading-6 text-orange-100/70">
              Vi henter løbets data og klargør builderen til redigering.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative min-h-screen overflow-x-hidden bg-rose-950 text-orange-100 ${poppins.className}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.28),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(244,114,182,0.16),_transparent_28%)]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row lg:items-start">
          <section className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:h-screen lg:w-[52%] lg:overflow-y-auto lg:px-8 lg:py-8">
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="px-1 pt-1">
                {isEditMode ? (
                  <div className="mb-4 inline-flex items-center rounded-full border border-orange-400/25 bg-orange-400/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-orange-50 uppercase">
                    Edit-mode
                  </div>
                ) : null}
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-orange-100/65 uppercase">
                  Løbets titel
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="F.eks. Selfie-jagt i slotsparken"
                  className={textInputClass}
                />
              </div>

              <div className="space-y-3 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAIModal(true);
                    setPreviewQuestions([]);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-orange-400/20 bg-rose-950/50 px-4 py-2 text-xs font-semibold text-orange-100/90 backdrop-blur-xl transition hover:border-rose-300/35 hover:bg-rose-900/55"
                >
                  <span aria-hidden>✨</span>
                  AI-udfyld
                </button>

                <div className="flex items-end justify-between gap-4">
                  <p className="text-xs font-semibold tracking-[0.24em] text-orange-100/65 uppercase">
                    Dine poster
                  </p>
                  <span className="rounded-full border border-orange-400/20 bg-rose-950/45 px-3 py-1.5 text-sm font-semibold text-orange-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}
              </div>

              {questions.map((question, index) => {
                return (
                  <article
                    key={question.id}
                    className="rounded-[1.7rem] border border-orange-400/20 bg-rose-950/55 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-orange-400/20 bg-rose-950/55 text-sm font-bold text-orange-100">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold text-orange-100 ${rubik.className}`}>
                            Selfie-post {index + 1}
                          </h3>
                          <p className="text-xs text-orange-100/65">
                            {question.lat !== null && question.lng !== null ? "Pin valgt på kortet" : "Pin mangler"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-orange-100/65 uppercase">
                        Hvad skal være i baggrunden?
                      </label>
                      <input
                        value={question.aiPrompt}
                        onChange={(event) => updateQuestion(question.id, { aiPrompt: event.target.value })}
                        placeholder="fx Springvandet, skolens ur eller den store eg"
                        className={textInputClass}
                      />
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-orange-100/65 uppercase">
                        Instruktion til deltagerne
                      </label>
                      <textarea
                        value={question.text}
                        onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                        rows={3}
                        placeholder="f.eks. Stil jer ved springvandet. Vores AI tjekker ansigterne live og blokerer snyd med skærmbilleder!"
                        className={textareaClass}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => assignPinFromCenter(question.id)}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-[1.2rem] border border-orange-400/30 bg-[linear-gradient(145deg,rgba(251,146,60,0.22),rgba(244,114,182,0.18))] px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-orange-50 shadow-[0_10px_24px_rgba(251,146,60,0.16)] transition hover:brightness-110"
                    >
                      Hent pin fra kortet
                    </button>

                    {question.lat !== null && question.lng !== null ? (
                      <p className="mt-3 text-xs text-orange-100/70">
                        Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                      </p>
                    ) : null}
                  </article>
                );
              })}

              <div className="rounded-[1.7rem] border border-orange-400/20 bg-rose-950/55 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-5">
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-2 rounded-[1.2rem] border border-orange-400/20 bg-rose-950/50 px-4 py-3 text-sm font-semibold text-orange-100 backdrop-blur-xl transition hover:bg-rose-900/60"
                >
                  <Plus className="h-4 w-4" />
                  Tilføj ny selfie-post
                </button>

                <button
                  type="button"
                  onClick={() => setShowSubjectField((current) => !current)}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-orange-100/70 transition hover:text-orange-100"
                >
                  {showSubjectField ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showSubjectField ? "Skjul fag (valgfrit)" : "Tilføj fag (valgfrit)"}
                </button>

                {showSubjectField ? (
                  <div className="mt-4 rounded-[1.4rem] border border-orange-400/20 bg-rose-950/50 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-orange-100/65 uppercase">
                      Fag
                    </label>
                    <select
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-orange-400/20 bg-rose-950/50 p-3 text-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="" className="bg-slate-900 text-white">
                        Vælg et fag...
                      </option>
                      {SUBJECT_OPTIONS.map((subjectOption) => (
                        <option key={subjectOption} value={subjectOption} className="bg-slate-900 text-white">
                          {subjectOption}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div ref={saveFeedbackRef} className="mt-5 space-y-4">
                  {notice?.tone === "error" ? renderNotice() : null}
                  <button
                    type="button"
                    onClick={handleSaveRun}
                    disabled={isSaving}
                    className="w-full rounded-[1.5rem] border border-orange-400/30 bg-[linear-gradient(145deg,rgba(251,146,60,0.22),rgba(244,114,182,0.18))] px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-orange-50 shadow-[0_14px_34px_rgba(251,146,60,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Gemmer..." : isEditMode ? "Gem ændringer i arkivet" : "Gem løb i arkivet"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="w-full p-4 pt-0 sm:px-6 lg:w-[48%] lg:self-start lg:p-8 lg:pl-0">
            <div className="lg:sticky lg:top-5">
              <div className="h-[42vh] min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-orange-400/20 bg-rose-950/55 shadow-[0_0_0_1px_rgba(251,146,60,0.08),0_0_36px_rgba(251,146,60,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
                <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showAIModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-rose-950/74 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl rounded-[2rem] border border-orange-400/20 bg-rose-950/92 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.28em] text-orange-100/55 uppercase">
                  AI-modal
                </p>
                <h2 className={`mt-3 text-3xl font-extrabold text-orange-50 ${rubik.className}`}>
                  Intelligent selfie-assistent
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-orange-100/75">
                  Beskriv stedet, så foreslår AI&apos;en korte selfie-poster med tydelige baggrunde.
                </p>
              </div>
            </div>

            {previewQuestions.length > 0 ? (
              <div className="mt-8">
                <p className="mb-4 text-sm text-orange-100/75">
                  Gennemgå posterne og ret dem til, før de overføres til kortet.
                </p>

                <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                  {previewQuestions.map((question, index) => (
                    <div
                      key={question.id}
                      className="rounded-[1.6rem] border border-orange-400/20 bg-rose-950/55 p-4 backdrop-blur-xl"
                    >
                      <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-orange-100/65 uppercase">
                        Selfie-post {index + 1}
                      </p>
                      <input
                        value={question.aiPrompt}
                        onChange={(event) =>
                          updatePreviewQuestion(question.id, { aiPrompt: event.target.value })
                        }
                        className={textInputClass}
                      />
                      <textarea
                        value={question.text}
                        onChange={(event) =>
                          updatePreviewQuestion(question.id, { text: event.target.value })
                        }
                        rows={3}
                        className="mt-3 w-full rounded-2xl border border-orange-400/20 bg-rose-950/55 px-4 py-3 text-orange-100 placeholder:text-orange-100/35 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                      <p className="mt-3 text-sm leading-relaxed text-orange-50">
                        {normalizeSelfieInstruction(question.text, question.aiPrompt)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleApproveAIPreview}
                    className="w-full rounded-[1.4rem] border border-orange-400/30 bg-[linear-gradient(145deg,rgba(251,146,60,0.22),rgba(244,114,182,0.18))] py-3 font-bold text-orange-50 transition hover:brightness-110"
                  >
                    Godkend og placer på kortet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewQuestions([])}
                    className="w-full rounded-[1.4rem] border border-orange-400/20 bg-rose-950/45 py-3 font-semibold text-orange-100/80 transition hover:bg-rose-900/55"
                  >
                    Kassér og prøv igen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <label className="mb-3 block text-sm font-semibold text-orange-50">
                    Hvad skal AI&apos;en bygge ud fra?
                  </label>
                  <textarea
                    value={aiRunBrief}
                    onChange={(event) => setAiRunBrief(event.target.value)}
                    rows={6}
                    placeholder="F.eks. Lav 6 selfie-poster i en park med tydelige steder og naturdetaljer."
                    className="w-full rounded-[1.6rem] border border-orange-400/20 bg-rose-950/55 p-5 text-orange-100 placeholder:text-orange-100/35 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAIMetadataFields((current) => !current)}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-orange-100/70 transition hover:text-orange-100"
                >
                  {showAIMetadataFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Tilpas fag og niveau (valgfrit)
                </button>

                {showAIMetadataFields ? (
                  <section className="mt-4 rounded-[1.6rem] border border-orange-400/20 bg-rose-950/55 p-4 backdrop-blur-xl">
                    <div className="grid gap-4 md:grid-cols-2">
                      <select
                        value={aiSubject}
                        onChange={(event) => setAiSubject(event.target.value)}
                        className="w-full rounded-2xl border border-orange-400/20 bg-rose-950/50 p-3 text-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                        <option value="" className="bg-slate-900 text-white">
                          Vælg fag...
                        </option>
                        {SUBJECT_OPTIONS.map((subjectOption) => (
                          <option key={subjectOption} value={subjectOption} className="bg-slate-900 text-white">
                            {subjectOption}
                          </option>
                        ))}
                      </select>
                      <select
                        value={aiGrade}
                        onChange={(event) => setAiGrade(event.target.value)}
                        className="w-full rounded-2xl border border-orange-400/20 bg-rose-950/50 p-3 text-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                        {GRADE_OPTIONS.map((gradeOption) => (
                          <option key={gradeOption} value={gradeOption} className="bg-slate-900 text-white">
                            {gradeOption}
                          </option>
                        ))}
                      </select>
                    </div>
                  </section>
                ) : null}

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={closeAIModal}
                    disabled={isGenerating}
                    className="rounded-[1.4rem] border border-orange-400/20 bg-rose-950/45 px-5 py-3 text-sm font-semibold text-orange-100/80 transition hover:bg-rose-900/55 disabled:opacity-60"
                  >
                    Luk
                  </button>
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="w-full rounded-[1.4rem] border border-orange-400/30 bg-[linear-gradient(145deg,rgba(251,146,60,0.22),rgba(244,114,182,0.18))] px-6 py-3 text-sm font-bold text-orange-50 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Tænker...
                      </span>
                    ) : (
                      "Generer poster"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
