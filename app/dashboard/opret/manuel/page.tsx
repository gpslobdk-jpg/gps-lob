"use client";

import { Check, Loader2, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import ManualAiInterviewModal, {
  type ManualAiInterviewDraft,
} from "@/components/builders/manual/ManualAiInterviewModal";
import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import type { SavedPin } from "@/components/MapPicker";
import { RACE_TYPES } from "@/utils/gpsRuns";
import {
  consumeDraftAutoload,
  clearRunDraft,
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
  showTeacherField?: unknown;
  showAiInterviewModal?: unknown;
  questions?: unknown;
  mapCenter?: unknown;
};

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
  "w-full rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const aiActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 px-5 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

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
  const defaultQuestionType: Question["type"] = "multiple_choice";
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const addQuestionLabel = "Tilføj nyt spørgsmål";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [showTeacherField, setShowTeacherField] = useState(false);
  const [showAiInterviewModal, setShowAiInterviewModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [questions, setQuestions] = useState<Question[]>(() => [createQuestion(defaultQuestionType)]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_MAP_CENTER);
  const isEditorBusy = isSaving;
  const editorLockClass = isEditorBusy ? "pointer-events-none opacity-50" : "";

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

    if (isEditMode) {
      if (isLoadingExistingRun) return;
      if (loadedRunId !== editRunId) {
        hasInitializedDraftRef.current = true;
        return;
      }
    }

    const restoredDraft = shouldRestoreRunDraftOnLoad(MANUEL_DRAFT_STORAGE_KEY)
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
      setShowAiInterviewModal(restoreDraftBoolean(restoredDraft.showAiInterviewModal));
      setQuestions(
        restoredQuestions.length > 0 ? restoredQuestions : [createQuestion(defaultQuestionType)]
      );
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
      showAiInterviewModal,
      questions,
      mapCenter,
    } satisfies ManualBuilderDraftState);
  }, [
    description,
    editRunId,
    mapCenter,
    questions,
    showAiInterviewModal,
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

  const closeAiInterviewModal = () => {
    setNotice(null);
    setShowAiInterviewModal(false);
  };

  const handleAiInterviewComplete = (draft: ManualAiInterviewDraft) => {
    const nextTitle = draft.title.trim();
    const nextDescription = draft.description.trim();
    const nextQuestions = toInterviewQuestionList(draft.questions);
    const nextSubject = draft.subject.trim();

    if (!nextTitle || !nextDescription || nextQuestions.length === 0) {
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
    setDescription(nextDescription);
    setQuestions(nextQuestions);
    if (nextSubject) {
      setSubject(nextSubject);
      setShowTeacherField(true);
    }
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
      .map((q) => ({
        ...q,
        type: "multiple_choice",
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
      return q.answers.some((answer) => !answer);
    });
    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message: "Udfyld postens tekst og alle fire svarmuligheder.",
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
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-emerald-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
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
      <div className={`relative min-h-screen overflow-x-hidden bg-emerald-950 text-emerald-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-emerald-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row lg:items-start">
          <MobileBuilderWarning />
          <section className="hidden w-full px-4 py-4 sm:px-6 sm:py-6 lg:block lg:h-screen lg:w-[52%] lg:overflow-y-auto lg:px-8 lg:py-8">
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
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                  Beskrivelse
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isEditorBusy}
                  rows={3}
                  placeholder="Kort intro eller beskrivelse af løbet (valgfrit)"
                  className="w-full rounded-[1.6rem] border border-emerald-500/30 bg-emerald-950/20 px-5 py-4 text-sm leading-6 text-slate-100 placeholder:text-slate-500 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                />
              </div>

              <div className="px-1">
                <div className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-950/20 p-4 backdrop-blur-xl">
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

              <div className="space-y-4 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setShowAiInterviewModal(true);
                  }}
                  disabled={isEditorBusy}
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
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-sm font-semibold text-emerald-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}
              </div>

              {questions.map((question, questionIndex) => (
                <article
                  key={question.id}
                  className="rounded-[1.8rem] border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-950/20 text-sm font-bold text-emerald-100">
                        {questionIndex + 1}
                      </div>
                      <div>
                        <h3 className={`text-lg font-bold text-emerald-100 ${rubik.className}`}>Quiz-post</h3>
                        <p className="text-xs text-emerald-100/65">
                          {question.lat !== null && question.lng !== null
                            ? "Pin er valgt på kortet"
                            : "Ingen pin valgt endnu"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-emerald-100/75 uppercase backdrop-blur-xl">
                      4 svar
                    </span>
                  </div>

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
              ))}

              <div className="rounded-[2rem] border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
                <button
                  type="button"
                  onClick={addQuestion}
                  disabled={isEditorBusy}
                  className="inline-flex items-center gap-2 rounded-[1.4rem] border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm font-semibold text-emerald-100 backdrop-blur-xl transition hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {addQuestionLabel}
                </button>

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

        <aside className="hidden w-full p-4 pt-0 sm:px-6 lg:block lg:w-[48%] lg:self-start lg:p-8 lg:pl-0">
          <div className="lg:sticky lg:top-5">
            <div className="h-[42vh] min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-slate-900/50 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_36px_rgba(16,185,129,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
              <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
            </div>
          </div>
        </aside>
      </div>
      </div>

      <ManualAiInterviewModal
        open={showAiInterviewModal}
        initialSubject={subject}
        subjectSuggestions={Object.keys(SUBJECT_TOPICS)}
        onClose={closeAiInterviewModal}
        onComplete={handleAiInterviewComplete}
      />
    </>
  );
}
