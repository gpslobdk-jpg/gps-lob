"use client";

import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import type { SavedPin } from "@/components/MapPicker";
import { ESCAPE_PROMPT, SYSTEM_ARKITEKT } from "@/constants/aiPrompts";
import {
  DEFAULT_MAP_CENTER,
  RACE_TYPES,
  type StoredRunRecord,
  asNumberOrNull,
  asTrimmedString,
  isRecord,
  readMasterCodeFromDescription,
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
    <div className="h-full w-full animate-pulse rounded-3xl border border-emerald-500/20 bg-slate-900/60" />
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
  type: "multiple_choice";
  text: string;
  aiPrompt: string;
  hint: string;
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

type GeneratedEscapeQuestion = {
  text?: string;
  answers?: string[];
  correctIndex?: number;
};

type StoredEscapeQuestionRecord = {
  id?: unknown;
  text?: unknown;
  aiPrompt?: unknown;
  ai_prompt?: unknown;
  hint?: unknown;
  mediaUrl?: unknown;
  media_url?: unknown;
  answers?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type BuilderNotice = {
  tone: "success" | "error";
  message: string;
};

const ESCAPE_DRAFT_STORAGE_KEY = "draft_run_escape";

type EscapeBuilderDraftState = {
  title?: unknown;
  masterCode?: unknown;
  subject?: unknown;
  showSubjectField?: unknown;
  showAIMetadataFields?: unknown;
  questions?: unknown;
  aiRunBrief?: unknown;
  aiSubject?: unknown;
  aiTopic?: unknown;
  aiGrade?: unknown;
  mapCenter?: unknown;
};

const textInputClass =
  "w-full rounded-2xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const textareaClass =
  "w-full rounded-2xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const previewInputClass =
  "w-full rounded-2xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const aiActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-emerald-500/30 bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const BLANK_ANSWERS: [string, string, string, string] = ["", "", "", ""];

const createQuestion = (): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type: "multiple_choice",
  text: "",
  aiPrompt: "",
  hint: "",
  mediaUrl: "",
  answers: BLANK_ANSWERS,
  correctIndex: 0,
  lat: null,
  lng: null,
});

function toEscapeQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const timestamp = Date.now();

  return value
    .map((item, index): Question | null => {
      if (!isRecord(item)) return null;

      const candidate = item as StoredEscapeQuestionRecord;
      const rawText = asTrimmedString(candidate.text);
      const parsedLegacyText = parseEscapeText(rawText, index);
      const answers = Array.isArray(candidate.answers)
        ? candidate.answers.filter((answer): answer is string => typeof answer === "string")
        : [];

      return {
        id: toQuestionId(candidate.id, timestamp + index),
        type: "multiple_choice",
        text: parsedLegacyText.riddle || rawText,
        aiPrompt: asTrimmedString(candidate.aiPrompt ?? candidate.ai_prompt) || parsedLegacyText.codeBrick,
        hint: asTrimmedString(candidate.hint) || parsedLegacyText.hint,
        mediaUrl: asTrimmedString(candidate.mediaUrl ?? candidate.media_url),
        answers: toEscapeAnswers(asTrimmedString(answers[0])),
        correctIndex: 0,
        lat: asNumberOrNull(candidate.lat),
        lng: asNumberOrNull(candidate.lng),
      };
    })
    .filter((question): question is Question => question !== null);
}

function toEscapeAnswers(solution: string): [string, string, string, string] {
  return [solution, "", "", ""];
}

function extractRequestedCount(text: string) {
  const match = text.match(/\b([1-9]|1\d|20)\b/);
  return match ? Number(match[1]) : 5;
}

function fallbackCodeBrick(index: number) {
  return `Du har fundet kode-brik ${index + 1}!`;
}

function normalizeMasterCode(value: string) {
  return value.toLocaleUpperCase("da-DK").replace(/[^0-9A-ZÆØÅ]/g, "");
}

function parseEscapeText(rawText: string, index: number) {
  const trimmedText = rawText.trim();
  if (!trimmedText) {
    return { riddle: "", hint: "", codeBrick: fallbackCodeBrick(index) };
  }

  const hint =
    trimmedText.match(/\|\|\s*HINT\s*:\s*([\s\S]*?)(?=\|\|\s*KODE-?BRIK\s*:|$)/i)?.[1]?.trim() ?? "";
  const codeBrick =
    trimmedText.match(/\|\|\s*KODE-?BRIK\s*:\s*([\s\S]*?)(?=\|\|\s*HINT\s*:|$)/i)?.[1]?.trim() ??
    "";
  const riddle = trimmedText
    .replace(/\|\|\s*HINT\s*:\s*[\s\S]*?(?=\|\|\s*KODE-?BRIK\s*:|$)/i, "")
    .replace(/\|\|\s*KODE-?BRIK\s*:\s*[\s\S]*?(?=\|\|\s*HINT\s*:|$)/i, "")
    .replace(/\|\|\s*$/g, "")
    .trim();

  return {
    riddle,
    hint,
    codeBrick: codeBrick || fallbackCodeBrick(index),
  };
}

export default function EscapeBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className={`min-h-screen bg-slate-950 ${poppins.className}`}>
          <div className="flex min-h-screen items-center justify-center px-6 text-center">
            <div className="rounded-[2rem] border border-emerald-500/20 bg-slate-900/60 px-8 py-10 text-amber-100 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <p className="text-xs font-semibold tracking-[0.28em] text-amber-100/55 uppercase">
                Indlæser
              </p>
              <h1 className={`mt-3 text-3xl font-black tracking-tight text-amber-100 ${rubik.className}`}>
                Escape-bygger
              </h1>
            </div>
          </div>
        </div>
      }
    >
      <EscapeBuilderPageContent />
    </Suspense>
  );
}

function EscapeBuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;
  const [title, setTitle] = useState("");
  const [masterCode, setMasterCode] = useState("");
  const [subject, setSubject] = useState("");
  const [showSubjectField, setShowSubjectField] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAIMetadataFields, setShowAIMetadataFields] = useState(false);
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
        className={`rounded-[1.4rem] border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
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
        console.error("Kunne ikke hente escape-løbet til redigering:", error);
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette escape-løb til redigering. Tjek at du er ejer, og prøv igen fra arkivet.",
        });
        setIsLoadingExistingRun(false);
        return;
      }

      const loadedQuestions = toEscapeQuestions(run.questions);
      const loadedTopic = asTrimmedString(run.topic);
      const firstPinnedQuestion =
        loadedQuestions.find((question) => question.lat !== null && question.lng !== null) ?? null;

      setTitle(asTrimmedString(run.title));
      setMasterCode(readMasterCodeFromDescription(run.description));
      setSubject(asTrimmedString(run.subject));
      setShowSubjectField(Boolean(asTrimmedString(run.subject)));
      setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [createQuestion()]);
      setPreviewQuestions([]);
      setShowAIModal(false);
      setShowAIMetadataFields(false);
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
      ? readRunDraft<EscapeBuilderDraftState>(ESCAPE_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      const restoredSubject = restoreDraftString(restoredDraft.subject);
      const restoredQuestions = toEscapeQuestions(restoredDraft.questions);

      setTitle(restoreDraftString(restoredDraft.title));
      setMasterCode(restoreDraftString(restoredDraft.masterCode));
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
      setAiTopic(restoreDraftString(restoredDraft.aiTopic));
      setAiGrade(restoreDraftString(restoredDraft.aiGrade) || "Mellemtrin");
      setMapCenter(restoreDraftMapCenter(restoredDraft.mapCenter, DEFAULT_MAP_CENTER));
      setNotice(null);
    }

    hasInitializedDraftRef.current = true;
  }, [editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;

    writeRunDraft(ESCAPE_DRAFT_STORAGE_KEY, editRunId, {
      title,
      masterCode,
      subject,
      showSubjectField,
      showAIMetadataFields,
      questions,
      aiRunBrief,
      aiSubject,
      aiTopic,
      aiGrade,
      mapCenter,
    } satisfies EscapeBuilderDraftState);
  }, [
    aiGrade,
    aiRunBrief,
    aiSubject,
    aiTopic,
    editRunId,
    mapCenter,
    masterCode,
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

  const updateSolution = (id: number, value: string) => {
    updateQuestion(id, { answers: toEscapeAnswers(value), correctIndex: 0 });
  };

  const updatePreviewQuestion = (id: number, updates: Partial<Question>) => {
    setPreviewQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...updates } : question))
    );
  };

  const updatePreviewSolution = (id: number, value: string) => {
    setPreviewQuestions((current) =>
      current.map((question) =>
        question.id === id
          ? { ...question, answers: toEscapeAnswers(value), correctIndex: 0 }
          : question
      )
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
    setShowAIMetadataFields(false);
  };

  const handleApproveAIPreview = () => {
    if (previewQuestions.length === 0) return;

    const hasExistingQuestions =
      questions.length > 1 ||
      questions.some(
        (question) =>
          question.text.trim().length > 0 ||
          question.aiPrompt.trim().length > 0 ||
          question.hint.trim().length > 0 ||
          question.answers[0].trim().length > 0 ||
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
      type: "multiple_choice" as const,
      text: question.text.trim(),
      aiPrompt: question.aiPrompt.trim(),
      hint: question.hint.trim(),
      answers: toEscapeAnswers(question.answers[0]?.trim() ?? ""),
      correctIndex: 0,
      lat: null,
      lng: null,
      mediaUrl: "",
    }));

    setQuestions(approvedQuestions);
    setPreviewQuestions([]);
    setShowAIModal(false);
    setShowAIMetadataFields(false);
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
        message: "Skriv først, hvilket emne eller niveau AI'en skal lave gåder om.",
      });
      return;
    }

    const preparedBuilderPrompt = ESCAPE_PROMPT.replace("[EMNE]", normalizedBrief).replace(
      "[MÅLGRUPPE]",
      normalizedGrade
    );
    const userRequest =
      `Lav præcis ${requestedCount} escape-poster om ${normalizedBrief}. ` +
      `Kontekst: ${normalizedSubject}. Niveau: ${normalizedGrade}. ` +
      `Bland sproglige gåder og ordspil, logiske mønstre og sjove matematiske gåder. ` +
      `Hver post skal returnere en gåde i text, ét præcist svar som kode eller ord i answers[0], correctIndex: 0, ` +
      `et kort hjælpsomt hint i text efter markøren " || HINT: ", ` +
      `og en belønning eller ledetråd i text efter markøren " || KODEBRIK: ".`;

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

      const data = (await res.json()) as { questions?: GeneratedEscapeQuestion[]; error?: string };

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
              const solution = answers[safeCorrectIndex]?.trim() || "";
              const { riddle, hint, codeBrick } = parseEscapeText(question.text ?? "", index);

              if (!riddle || !solution) return null;

              return {
                id: Date.now() + index,
                type: "multiple_choice",
                text: riddle,
                aiPrompt: codeBrick,
                hint,
                answers: toEscapeAnswers(solution),
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
          message: "AI returnerede ingen brugbare gåder. Prøv igen.",
        });
        return;
      }

      setPreviewQuestions(formattedQuestions);
    } catch (error) {
      console.error("AI-generering af escape-gåder fejlede:", error);
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
        type: "multiple_choice" as const,
        text: question.text.trim(),
        aiPrompt: question.aiPrompt.trim(),
        hint: question.hint.trim(),
        answers: toEscapeAnswers(question.answers[0]?.trim() ?? ""),
        correctIndex: 0,
        mediaUrl: question.mediaUrl.trim(),
      }))
      .filter(
        (question) =>
          question.text.length > 0 ||
          question.aiPrompt.length > 0 ||
          question.answers[0].length > 0 ||
          question.lat !== null ||
          question.lng !== null
      );

    if (normalizedQuestions.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst én udfyldt gåde." });
      scrollToSaveFeedback();
      return;
    }

    const hasIncompleteQuestions = normalizedQuestions.some(
      (question) => !question.text || !question.answers[0] || !question.aiPrompt
    );
    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message: "Udfyld både gåde, svar og belønning på hver post.",
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
        message: "Du mangler at sætte pins på kortet. Mindst én gåde skal have koordinater.",
      });
      scrollToSaveFeedback();
      return;
    }

    const normalizedMasterCode = normalizeMasterCode(masterCode);
    if (!normalizedMasterCode) {
      setNotice({ tone: "error", message: "Udfyld master-koden til finalen." });
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
        description: JSON.stringify({ masterCode: normalizedMasterCode }),
        topic: aiRunBrief.trim() || aiTopic || "",
        questions: normalizedQuestions,
        race_type: RACE_TYPES.ESCAPE,
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
        message: isEditMode ? "Ændringerne er gemt i arkivet!" : "Escape room-løbet er gemt i arkivet!",
      });
      clearRunDraft(ESCAPE_DRAFT_STORAGE_KEY);

      if (!isEditMode) {
        setTitle("");
        setMasterCode("");
        setSubject("");
        setShowSubjectField(false);
        setQuestions([createQuestion()]);
        setAiRunBrief("");
        setAiTopic("");
      }

      await new Promise((resolve) => window.setTimeout(resolve, 450));
      router.push("/dashboard/arkiv");
    } catch (error) {
      console.error("Fejl ved gemning af escape room-løb:", error);
      setNotice({ tone: "error", message: "Kunne ikke gemme løbet. Prøv igen." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditMode && isLoadingExistingRun) {
    return (
      <div className={`relative min-h-screen overflow-hidden bg-slate-950 text-amber-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-slate-950/70 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-200" />
            <p className="mt-5 text-xs font-semibold tracking-[0.28em] text-amber-100/55 uppercase">
              Rediger løb
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight text-amber-100 ${rubik.className}`}>
              Indlæser dine escape-poster
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
      <div className={`relative min-h-screen overflow-x-hidden bg-slate-950 text-amber-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-slate-950/70 backdrop-blur-[2px]" />
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
                  <div className="mb-4 inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-amber-100 uppercase">
                    Edit-mode
                  </div>
                ) : null}
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                  Løbets titel
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="f.eks. Agent-missionen"
                  className={textInputClass}
                />
              </div>

              <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                  Slut-kode (Master-kode)
                </label>
                <input
                  value={masterCode}
                  onChange={(event) => setMasterCode(normalizeMasterCode(event.target.value))}
                  placeholder="f.eks. GULD77"
                  className={textInputClass}
                  maxLength={12}
                />
              </div>

              <div className="space-y-3 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setShowAIModal(true);
                    setPreviewQuestions([]);
                  }}
                  disabled={isAiBusy || isSaving || isLoadingExistingRun}
                  className={`${aiActionButtonClass} rounded-full px-4 py-2 text-xs`}
                >
                  <span aria-hidden>✨</span>
                  AI-udfyld
                </button>

                <div className="flex items-end justify-between gap-4">
                  <p className="text-xs font-semibold tracking-[0.24em] text-amber-100/65 uppercase">
                    Dine gåder
                  </p>
                  <span className="rounded-full border border-emerald-500/20 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-amber-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}
              </div>

              {questions.map((question, index) => (
                <article
                  key={question.id}
                  className="rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/20 bg-slate-900/60 text-sm font-bold text-amber-100">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className={`text-lg font-bold text-amber-100 ${rubik.className}`}>
                          Gåde {index + 1}
                        </h3>
                        <p className="text-xs text-amber-100/65">
                          {question.lat !== null && question.lng !== null ? "Pin valgt på kortet" : "Pin mangler"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Gåden
                    </label>
                    <textarea
                      value={question.text}
                      onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                      rows={3}
                      placeholder="f.eks. Hvad er 12 + 8 * 2? eller Find det manglende tal: 2, 4, 8, __?"
                      className={textareaClass}
                    />
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Svaret
                    </label>
                    <input
                      value={question.answers[0]}
                      onChange={(event) => updateSolution(question.id, event.target.value)}
                      placeholder="f.eks. 28"
                      className={textInputClass}
                    />
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Hint til deltageren (valgfrit)
                    </label>
                    <input
                      value={question.hint}
                      onChange={(event) => updateQuestion(question.id, { hint: event.target.value })}
                      placeholder="f.eks. Tænk i bogstaver, mønstre eller en skjult regel"
                      className={textInputClass}
                    />
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Belønning
                    </label>
                    <input
                      value={question.aiPrompt}
                      onChange={(event) =>
                        updateQuestion(question.id, { aiPrompt: event.target.value })
                      }
                      placeholder="f.eks. Dit første tegn er: G"
                      className={textInputClass}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => assignPinFromCenter(question.id)}
                    className="mt-4 w-full rounded-[1.2rem] border border-emerald-500/30 bg-emerald-500 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
                  >
                    Hent pin fra kortet
                  </button>

                  {question.lat !== null && question.lng !== null ? (
                    <p className="mt-3 text-xs text-amber-100/70">
                      Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                    </p>
                  ) : null}
                </article>
              ))}

              <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5">
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-2 rounded-[1.2rem] border border-emerald-500/20 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-amber-100 backdrop-blur-xl transition hover:bg-slate-800/80"
                >
                  <Plus className="h-4 w-4" />
                  Tilføj ny gåde
                </button>

                <button
                  type="button"
                  onClick={() => setShowSubjectField((current) => !current)}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-amber-100/70 transition hover:text-amber-100"
                >
                  {showSubjectField ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {showSubjectField ? "Skjul emne (valgfrit)" : "Tilføj emne (valgfrit)"}
                </button>

                {showSubjectField ? (
                  <div className="mt-4 rounded-[1.4rem] border border-emerald-500/20 bg-slate-900/60 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Emne
                    </label>
                    <select
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-slate-700 bg-slate-900/50 p-3 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

                <div ref={saveFeedbackRef} className="mt-5 space-y-4">
                  {notice?.tone === "error" ? renderNotice() : null}
                  <button
                    type="button"
                    onClick={handleSaveRun}
                    disabled={isSaving || isAiBusy}
                    className="w-full rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="h-[42vh] min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-slate-900/60 shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_0_36px_rgba(245,158,11,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
                <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showAIModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.72)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.28em] text-amber-100/55 uppercase">
                  AI-modal
                </p>
                <h2
                  className={`mt-3 flex items-center gap-2 text-3xl font-extrabold text-amber-100 ${rubik.className}`}
                >
                  <span aria-hidden>✨</span>
                  Intelligent gåde-assistent
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-amber-100/75">
                  Fortæl kort hvilket emne eller niveau gåderne skal have (f.eks. matematik), så laver AI&apos;en resten.
                </p>
              </div>
            </div>

            {renderNotice("mt-6")}

            {previewQuestions.length > 0 ? (
              <div className="mt-8">
                <p className="mb-4 text-sm text-amber-100/75">
                  Gennemgå gåderne og ret dem til, før de overføres til kortet.
                </p>

                <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                  {previewQuestions.map((question, index) => (
                    <div
                      key={question.id}
                      className="rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-4 backdrop-blur-xl"
                    >
                      <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                        Gåde {index + 1}
                      </p>

                      <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                        Gåden
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

                      <label className="mt-4 mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                        Svaret
                      </label>
                      <input
                        type="text"
                        value={question.answers[0]}
                        onChange={(event) => updatePreviewSolution(question.id, event.target.value)}
                        disabled={isGenerating}
                        className={previewInputClass}
                      />

                      <label className="mt-4 mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                        Hint til deltageren (valgfrit)
                      </label>
                      <input
                        type="text"
                        value={question.hint}
                        onChange={(event) =>
                          updatePreviewQuestion(question.id, { hint: event.target.value })
                        }
                        disabled={isGenerating}
                        className={previewInputClass}
                      />

                      <label className="mt-4 mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                        Belønning
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
                    className="w-full rounded-[1.4rem] border border-emerald-500/20 bg-slate-900/60 py-3 font-semibold text-amber-100/80 transition hover:bg-slate-800/80"
                  >
                    Kassér og prøv igen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <label className="mb-3 block text-sm font-semibold text-white">
                    Hvad skal AI&apos;en bygge ud fra?
                  </label>
                  <textarea
                    value={aiRunBrief}
                    onChange={(event) => setAiRunBrief(event.target.value)}
                    rows={6}
                    disabled={isGenerating}
                    placeholder="f.eks. Lav 5 varierede spion-gåder (både ordspil og tal), hvor svarene er koderne til at bryde ind i banken."
                    className="w-full rounded-3xl border border-slate-700 bg-slate-900/50 p-5 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                  <button
                    type="button"
                    onClick={() => setShowAIMetadataFields((current) => !current)}
                    disabled={isGenerating}
                    className="mt-4 inline-flex items-center gap-2 text-sm text-amber-100/70 transition hover:text-amber-100"
                  >
                  {showAIMetadataFields ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Tilpas emne og sværhedsgrad (valgfrit)
                </button>

                {showAIMetadataFields ? (
                  <section className="mt-4 rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-4 backdrop-blur-xl">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                          Emne
                        </label>
                        <select
                          value={aiSubject}
                          onChange={(event) => setAiSubject(event.target.value)}
                          disabled={isGenerating}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-900/50 p-3 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                          Målgruppe/Sværhedsgrad
                        </label>
                        <select
                          value={aiGrade}
                          onChange={(event) => setAiGrade(event.target.value)}
                          disabled={isGenerating}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-900/50 p-3 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="rounded-[1.4rem] border border-emerald-500/20 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-amber-100/80 transition hover:bg-slate-800/80 disabled:opacity-60"
                  >
                    Luk
                  </button>
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className={`${aiActionButtonClass} w-full`}
                  >
                    {isGenerating ? (
                      <span className="inline-flex animate-pulse items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        🪄 Arbejder...
                      </span>
                    ) : (
                      "Generer poster"
                    )}
                  </button>
                </div>

                {isGenerating ? (
                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-amber-100/75">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300" />
                    AI&apos;en skriver gåder...
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
