"use client";

import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import type { SavedPin } from "@/components/MapPicker";
import { FOTO_PROMPT, SYSTEM_ARKITEKT } from "@/constants/aiPrompts";
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
    <div className="h-full w-full animate-pulse rounded-3xl border border-sky-500/20 bg-sky-950/50" />
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

type MapCenter = {
  lat: number;
  lng: number;
};

type GeneratedPhotoQuestion = {
  text?: string;
  answers?: string[];
  correctIndex?: number;
};

type StoredPhotoQuestionRecord = {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  aiPrompt?: unknown;
  ai_prompt?: unknown;
  mediaUrl?: unknown;
  media_url?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type BuilderNotice = {
  tone: "success" | "error";
  message: string;
};

const FOTO_DRAFT_STORAGE_KEY = "draft_run_foto";

type FotoBuilderDraftState = {
  title?: unknown;
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

const createQuestion = (): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type: "ai_image",
  text: "",
  aiPrompt: "",
  mediaUrl: "",
  answers: ["", "", "", ""],
  correctIndex: 0,
  lat: null,
  lng: null,
});

const textInputClass =
  "w-full rounded-2xl border border-sky-500/20 bg-sky-950/50 px-4 py-3 text-sky-100 placeholder:text-sky-100/35 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const textareaClass =
  "w-full rounded-2xl border border-sky-500/20 bg-sky-950/50 px-4 py-3 text-sky-100 placeholder:text-sky-100/35 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const previewInputClass =
  "w-full rounded-2xl border border-sky-500/20 bg-sky-950/50 px-4 py-3 text-sky-100 placeholder:text-sky-100/35 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const aiActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-500 hover:text-slate-900 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const BLANK_ANSWERS: [string, string, string, string] = ["", "", "", ""];

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
        aiPrompt: asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt),
        mediaUrl: asTrimmedString(candidate.mediaUrl ?? candidate.media_url),
        answers: BLANK_ANSWERS,
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

export default function FotoMissionBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className={`min-h-screen bg-sky-950 ${poppins.className}`}>
          <div className="flex min-h-screen items-center justify-center px-6 text-center">
            <div className="rounded-[2rem] border border-sky-500/20 bg-sky-950/50 px-8 py-10 text-sky-100 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
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
  const [showTeacherField, setShowTeacherField] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAITeacherFields, setShowAITeacherFields] = useState(false);
  const [aiRunBrief, setAiRunBrief] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiGrade, setAiGrade] = useState("Mellemtrin");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([createQuestion()]);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const isAiBusy = isGenerating;
  const editorLockClass = isAiBusy ? "pointer-events-none opacity-50" : "";
  const [mapCenter, setMapCenter] = useState<MapCenter>({
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
  });

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
        console.error("Kunne ikke hente foto-løbet til redigering:", error);
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette foto-løb til redigering. Tjek at du er ejer, og prøv igen fra arkivet.",
        });
        setIsLoadingExistingRun(false);
        return;
      }

      const loadedQuestions = toPhotoQuestions(run.questions);
      const loadedTopic = asTrimmedString(run.topic);
      const firstPinnedQuestion =
        loadedQuestions.find((question) => question.lat !== null && question.lng !== null) ?? null;

      setTitle(asTrimmedString(run.title));
      setSubject(asTrimmedString(run.subject));
      setShowTeacherField(Boolean(asTrimmedString(run.subject)));
      setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion()]);
      setPreviewQuestions([]);
      setShowAIModal(false);
      setShowAITeacherFields(false);
      setAiSubject("");
      setAiRunBrief(loadedTopic);
      setAiTopic(loadedTopic);
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

    const shouldAutoLoad = window.sessionStorage.getItem("autoLoadDraft") === "true";
    if (shouldAutoLoad) {
      window.sessionStorage.removeItem("autoLoadDraft");
    }

    const restoredDraft = shouldAutoLoad
      ? readRunDraft<FotoBuilderDraftState>(FOTO_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      const restoredSubject = restoreDraftString(restoredDraft.subject);
      const restoredQuestions = toPhotoQuestions(restoredDraft.questions);

      setTitle(restoreDraftString(restoredDraft.title));
      setSubject(restoredSubject);
      setShowTeacherField(
        restoreDraftBoolean(restoredDraft.showTeacherField, Boolean(restoredSubject.trim()))
      );
      setShowAITeacherFields(restoreDraftBoolean(restoredDraft.showAITeacherFields));
      setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion()]);
      setPreviewQuestions([]);
      setShowAIModal(false);
      setAiRunBrief(restoreDraftString(restoredDraft.aiRunBrief));
      setAiSubject(restoreDraftString(restoredDraft.aiSubject));
      setAiTopic(restoreDraftString(restoredDraft.aiTopic));
      setAiGrade(restoreDraftString(restoredDraft.aiGrade) || "Mellemtrin");
      setMapCenter(restoreDraftMapCenter(restoredDraft.mapCenter, DEFAULT_MAP_CENTER));
      setNotice(null);
    }

    hasInitializedDraftRef.current = true;
  }, [editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;

    writeRunDraft(FOTO_DRAFT_STORAGE_KEY, editRunId, {
      title,
      subject,
      showTeacherField,
      showAITeacherFields,
      questions,
      aiRunBrief,
      aiSubject,
      aiTopic,
      aiGrade,
      mapCenter,
    } satisfies FotoBuilderDraftState);
  }, [
    aiGrade,
    aiRunBrief,
    aiSubject,
    aiTopic,
    editRunId,
    mapCenter,
    questions,
    showAITeacherFields,
    showTeacherField,
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

  const updatePreviewQuestion = (id: number, updates: Partial<Question>) => {
    setPreviewQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...updates } : question))
    );
  };

  const assignPinFromCenter = (id: number) => {
    updateQuestion(id, { lat: mapCenter.lat, lng: mapCenter.lng });
  };

  const addQuestion = () => {
    setQuestions((current) => [...current, createQuestion()]);
  };

  const closeAIModal = () => {
    if (isGenerating) return;
    setNotice(null);
    setShowAIModal(false);
    setPreviewQuestions([]);
    setShowAITeacherFields(false);
  };

  const handleApproveAIPreview = () => {
    if (previewQuestions.length === 0) return;

    const hasExistingQuestions =
      questions.length > 1 ||
      questions.some(
        (question) =>
          question.text.trim().length > 0 ||
          question.aiPrompt.trim().length > 0 ||
          question.mediaUrl.trim().length > 0 ||
          question.lat !== null ||
          question.lng !== null
      );

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
    const approvedQuestions = previewQuestions.map((question, index) => ({
      ...question,
      id: timestamp + index,
      type: "ai_image" as const,
      text: question.text.trim(),
      aiPrompt: question.aiPrompt.trim(),
      answers: BLANK_ANSWERS,
      correctIndex: 0,
      lat: null,
      lng: null,
      mediaUrl: "",
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

  const handleAIGenerate = async () => {
    const normalizedBrief = aiRunBrief.trim();
    const normalizedSubject = aiSubject.trim() || subject.trim() || "Generelt";
    const normalizedGrade = aiGrade.trim() || "Ikke angivet";
    const requestedCount = extractRequestedCount(normalizedBrief);

    setNotice(null);

    if (!normalizedBrief) {
      setNotice({
        tone: "error",
        message: "Skriv først, hvilket emne eller motiv AI'en skal tage udgangspunkt i.",
      });
      return;
    }

    const preparedBuilderPrompt = FOTO_PROMPT.replace("[EMNE]", normalizedBrief).replace(
      "[MÅLGRUPPE]",
      normalizedGrade
    );
    const userRequest =
      `Lav præcis ${requestedCount} foto-missioner om ${normalizedBrief}. ` +
      `Kontekst: ${normalizedSubject}. Niveau: ${normalizedGrade}. ` +
      `Hver mission skal bruge en kort instruktion til deltageren i text og et konkret målobjekt som korrekt svar.`;

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
          prompt: userRequest,
          systemContext: SYSTEM_ARKITEKT,
          builderContext: preparedBuilderPrompt,
        }),
      });

      const data = (await res.json()) as { questions?: GeneratedPhotoQuestion[]; error?: string };

      if (!res.ok) {
        throw new Error(data.error || "AI-generering fejlede");
      }

      const formattedQuestions = Array.isArray(data.questions)
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
              const instruction = normalizePhotoInstruction(question.text ?? "", targetObject);

              if (!targetObject || !instruction) return null;

              return {
                id: Date.now() + index,
                type: "ai_image",
                text: instruction,
                aiPrompt: targetObject,
                answers: BLANK_ANSWERS,
                correctIndex: 0,
                lat: null,
                lng: null,
                mediaUrl: "",
              };
            })
            .filter((question): question is Question => question !== null)
        : [];

      if (formattedQuestions.length === 0) {
        setNotice({
          tone: "error",
          message: "AI returnerede ingen brugbare foto-missioner. Prøv igen.",
        });
        return;
      }

      setPreviewQuestions(formattedQuestions);
    } catch (error) {
      console.error("AI-fotogenerering fejlede:", error);
      setNotice({ tone: "error", message: "Der skete en fejl. Prøv igen." });
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
      .map((question) => ({
        ...question,
        type: "ai_image" as const,
        text: question.text.trim(),
        aiPrompt: question.aiPrompt.trim(),
        answers: BLANK_ANSWERS,
        correctIndex: 0,
        mediaUrl: question.mediaUrl.trim(),
      }))
      .filter(
        (question) =>
          question.text.length > 0 ||
          question.aiPrompt.length > 0 ||
          question.lat !== null ||
          question.lng !== null
      );

    if (normalizedQuestions.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst én udfyldt mission." });
      scrollToSaveFeedback();
      return;
    }

    const hasIncompleteQuestions = normalizedQuestions.some(
      (question) => !question.text || !question.aiPrompt
    );
    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message: "Udfyld både hvad de skal finde og instruktionen på hver mission.",
      });
      scrollToSaveFeedback();
      return;
    }

    const hasAtLeastOnePin = normalizedQuestions.some(
      (question) => question.lat !== null && question.lng !== null
    );
    if (!hasAtLeastOnePin) {
      setNotice({
        tone: "error",
        message: "Du mangler at sætte pins på kortet. Mindst én mission skal have koordinater.",
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
        topic: aiRunBrief.trim() || aiTopic || "",
        questions: normalizedQuestions,
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
        setShowTeacherField(false);
        setQuestions([createQuestion()]);
        setAiRunBrief("");
        setAiTopic("");
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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.28),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(125,211,252,0.12),_transparent_28%)]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-[2rem] border border-sky-500/20 bg-sky-950/55 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-sky-200" />
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
      <div className={`relative min-h-screen overflow-x-hidden bg-sky-950 text-sky-100 ${poppins.className}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.28),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(125,211,252,0.12),_transparent_28%)]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row lg:items-start">
          <section className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:h-screen lg:w-[52%] lg:overflow-y-auto lg:px-8 lg:py-8">
            <div className="mx-auto max-w-3xl">
              <fieldset
                disabled={isAiBusy}
                aria-busy={isAiBusy}
                className={`min-w-0 space-y-6 border-0 p-0 ${editorLockClass}`}
              >
              <div className="px-1 pt-1">
                {isEditMode ? (
                  <div className="mb-4 inline-flex items-center rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-sky-100 uppercase">
                    Edit-mode
                  </div>
                ) : null}
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                  Løbets titel
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="F.eks. Skovens skjulte spor"
                  className={textInputClass}
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
                  disabled={isAiBusy || isSaving || isLoadingExistingRun}
                  className={`${aiActionButtonClass} w-full sm:w-auto`}
                >
                  <span aria-hidden>✨</span>
                  Auto-udfyld med AI
                </button>

                <div className="flex items-end justify-between gap-4">
                  <p className="text-xs font-semibold tracking-[0.24em] text-sky-100/65 uppercase">
                    Dine missioner
                  </p>
                  <span className="rounded-full border border-sky-500/20 bg-sky-950/45 px-4 py-2 text-sm font-semibold text-sky-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}
              </div>

              {questions.map((question, index) => (
                <article
                  key={question.id}
                  className="rounded-[2rem] border border-sky-500/20 bg-sky-950/50 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-500/20 bg-sky-950/50 text-sm font-bold text-sky-100">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold text-sky-100 ${rubik.className}`}>
                          Mission {index + 1}
                        </h3>
                        <p className="text-xs text-sky-100/65">
                          {question.lat !== null && question.lng !== null
                            ? "Pin er valgt på kortet"
                            : "Ingen pin valgt endnu"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-sky-500/20 bg-sky-950/45 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-sky-100/75 uppercase backdrop-blur-xl">
                      AI foto
                    </span>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.12em] text-sky-100/65">
                      Hvad skal de finde?
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

                  <div className="mt-5">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                      Instruktion
                    </label>
                    <textarea
                      value={question.text}
                      onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                      rows={4}
                      placeholder="f.eks. Find et rødt bøgeblad. Vores AI tjekker billedet med det samme (og husk: man kan ikke snyde ved at fotografere en skærm!)."
                      className={textareaClass}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => assignPinFromCenter(question.id)}
                    className="mt-5 w-full rounded-[1.4rem] border border-sky-400/30 bg-sky-500/22 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-sky-100 shadow-[0_12px_32px_rgba(14,165,233,0.18)] transition hover:bg-sky-500/30"
                  >
                    Hent pin fra kortet
                  </button>

                  {question.lat !== null && question.lng !== null ? (
                    <p className="mt-3 text-xs text-sky-100/70">
                      Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                    </p>
                  ) : null}
                </article>
              ))}

              <div className="rounded-[2rem] border border-sky-500/20 bg-sky-950/50 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-2 rounded-[1.4rem] border border-sky-500/20 bg-sky-950/50 px-4 py-3 text-sm font-semibold text-sky-100 backdrop-blur-xl transition hover:bg-sky-900/60"
                >
                  <Plus className="h-4 w-4" />
                  Tilføj ny mission
                </button>

                <button
                  type="button"
                  onClick={() => setShowTeacherField((current) => !current)}
                  className="mt-5 inline-flex items-center gap-2 text-sm text-sky-100/70 transition hover:text-sky-100"
                >
                  {showTeacherField ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {showTeacherField ? "Skjul emne (valgfrit)" : "Tilføj emne (valgfrit)"}
                </button>

                {showTeacherField ? (
                  <div className="mt-4 rounded-[1.5rem] border border-sky-500/20 bg-sky-950/50 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                      Emne
                    </label>
                    <select
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-sky-500/20 bg-sky-950/50 p-3 text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="" className="bg-slate-900 text-white">
                        Vælg et emne...
                      </option>
                      {Object.keys(SUBJECT_TOPICS).map((subjectOption) => (
                        <option
                          key={subjectOption}
                          value={subjectOption}
                          className="bg-slate-900 text-white"
                        >
                          {subjectOption}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div ref={saveFeedbackRef} className="mt-6 space-y-4">
                  {notice?.tone === "error" ? renderNotice() : null}
                  <button
                    type="button"
                    onClick={handleSaveRun}
                    disabled={isSaving || isAiBusy}
                    className="w-full rounded-[1.6rem] border border-sky-400/30 bg-sky-500/22 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-sky-100 shadow-[0_14px_34px_rgba(14,165,233,0.18)] transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="h-[42vh] min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-sky-500/20 bg-sky-950/50 shadow-[0_0_0_1px_rgba(14,165,233,0.08),0_0_36px_rgba(14,165,233,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
                <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showAIModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-sky-950/70 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl rounded-[2rem] border border-sky-500/20 bg-sky-950/90 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.28em] text-sky-100/55 uppercase">
                  AI-modal
                </p>
                <h2
                  className={`mt-3 flex items-center gap-2 text-3xl font-extrabold text-sky-100 ${rubik.className}`}
                >
                  <span aria-hidden>✨</span>
                  Intelligent foto-assistent
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-sky-100/75">
                  Beskriv emne eller motivtype, så foreslår AI&apos;en motiver, som er lette at finde
                  og lette at genkende.
                </p>
              </div>
            </div>

            {renderNotice("mt-6")}

            {previewQuestions.length > 0 ? (
              <div className="mt-8">
                <p className="mb-4 text-sm text-sky-100/75">
                  Gennemgå missionerne og ret dem til, før de overføres til kortet.
                </p>

                <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                  {previewQuestions.map((question, index) => (
                    <div
                      key={question.id}
                      className="rounded-[1.6rem] border border-sky-500/20 bg-sky-950/50 p-4 backdrop-blur-xl"
                    >
                      <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                        Mission {index + 1}
                      </p>

                      <label className="mb-2 block text-xs font-semibold tracking-[0.12em] text-sky-100/65">
                        Hvad skal de finde?
                      </label>
                      <input
                        type="text"
                        value={question.aiPrompt}
                        onChange={(event) =>
                          updatePreviewQuestion(question.id, { aiPrompt: event.target.value })
                        }
                        disabled={isGenerating}
                        className={previewInputClass}
                      />

                      <label className="mt-4 mb-2 block text-xs font-semibold tracking-[0.2em] text-sky-100/65 uppercase">
                        Instruktion
                      </label>
                      <textarea
                        value={question.text}
                        onChange={(event) =>
                          updatePreviewQuestion(question.id, { text: event.target.value })
                        }
                        rows={3}
                        disabled={isGenerating}
                        className={previewInputClass}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleApproveAIPreview}
                    disabled={isGenerating}
                    className={`${aiActionButtonClass} w-full`}
                  >
                    Godkend og placer på kortet
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardAIPreview}
                    className="w-full rounded-[1.4rem] border border-sky-500/20 bg-sky-950/45 py-3 font-semibold text-sky-100/80 transition hover:bg-sky-900/55"
                  >
                    Kassér og prøv igen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <label className="mb-3 block text-sm font-semibold text-white">
                    Hvad skal AI&apos;en skrive om?
                  </label>
                  <textarea
                    value={aiRunBrief}
                    onChange={(event) => setAiRunBrief(event.target.value)}
                    rows={8}
                    disabled={isGenerating}
                    placeholder="f.eks. Lav 6 opgaver om ting man finder i en skov"
                    className="w-full rounded-[1.6rem] border border-sky-500/20 bg-sky-950/50 p-5 text-sky-100 placeholder:text-sky-100/35 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                  <button
                    type="button"
                    onClick={() => setShowAITeacherFields((current) => !current)}
                    disabled={isGenerating}
                    className="mt-4 inline-flex items-center gap-2 text-sm text-sky-100/70 transition hover:text-sky-100"
                  >
                  {showAITeacherFields ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Tilpas emne og sværhedsgrad (valgfrit)
                </button>

                {showAITeacherFields ? (
                  <section className="mt-4 rounded-[1.6rem] border border-sky-500/20 bg-sky-950/50 p-4 backdrop-blur-xl">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-sky-100/65 uppercase">
                          Emne
                        </label>
                        <select
                          value={aiSubject}
                          onChange={(event) => setAiSubject(event.target.value)}
                          disabled={isGenerating}
                          className="w-full rounded-2xl border border-sky-500/20 bg-sky-950/50 p-3 text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="" className="bg-slate-900 text-white">
                            Vælg et emne...
                          </option>
                          {AI_SUBJECT_OPTIONS.map((subjectOption) => (
                            <option
                              key={subjectOption}
                              value={subjectOption}
                              className="bg-slate-900 text-white"
                            >
                              {subjectOption}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-sky-100/65 uppercase">
                          Målgruppe/Sværhedsgrad
                        </label>
                        <select
                          value={aiGrade}
                          onChange={(event) => setAiGrade(event.target.value)}
                          disabled={isGenerating}
                          className="w-full rounded-2xl border border-sky-500/20 bg-sky-950/50 p-3 text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                    className="rounded-[1.4rem] border border-sky-500/20 bg-sky-950/45 px-5 py-3 text-sm font-semibold text-sky-100/80 transition hover:bg-sky-900/55 disabled:opacity-60"
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
                      "Generer foto-missioner"
                    )}
                  </button>
                </div>

                {isGenerating ? (
                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-sky-100/75">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300" />
                    AI&apos;en leder efter gode motiver...
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
