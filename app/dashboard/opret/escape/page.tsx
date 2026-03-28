"use client";

import { Loader2, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import EscapeAiInterviewModal, {
  type EscapeAiInterviewDraft,
} from "@/components/builders/escape/EscapeAiInterviewModal";
import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import type { SavedPin, SavedZone } from "@/components/MapPicker";
import {
  DEFAULT_MAP_CENTER,
  RACE_TYPES,
  type StoredRunRecord,
  asNumberOrNull,
  asTrimmedString,
  isRecord,
  readMasterCodeFromDescription,
  serializeEscapeDescription,
  toQuestionId,
} from "@/utils/gpsRuns";
import {
  clearRunDraft,
  hasUnsavedDraft,
  readRunDraft,
  restoreDraftMapCenter,
  restoreDraftString,
  restoreDraftBoolean,
  shouldRestoreRunDraftOnLoad,
  writeRunDraft,
} from "@/utils/runDrafts";
import { createClient } from "@/utils/supabase/client";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-3xl border border-amber-500/20 bg-slate-900/60" />
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
const MAX_MASTER_CODE_LENGTH = 20;

type EscapeBuilderDraftState = {
  title?: unknown;
  masterCode?: unknown;
  subject?: unknown;
  radius?: unknown;
  showAiInterviewModal?: unknown;
  questions?: unknown;
  mapCenter?: unknown;
};

const DEFAULT_RUN_RADIUS = 15;
const RUN_RADIUS_OPTIONS = [15, 30, 50] as const;

const textInputClass =
  "w-full rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const textareaClass =
  "w-full rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const aiActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 px-5 py-3 text-sm font-semibold transition-all";

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

function normalizeRunRadius(value: unknown) {
  const parsed = asNumberOrNull(value);
  return parsed !== null && RUN_RADIUS_OPTIONS.includes(parsed as (typeof RUN_RADIUS_OPTIONS)[number])
    ? parsed
    : DEFAULT_RUN_RADIUS;
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

function isQuestionEmpty(question: Question) {
  return (
    !question.text.trim() &&
    !question.aiPrompt.trim() &&
    !question.hint.trim() &&
    !question.answers[0]?.trim() &&
    !question.mediaUrl.trim() &&
    question.lat === null &&
    question.lng === null
  );
}

function toInterviewEscapeQuestions(
  puzzles: EscapeAiInterviewDraft["puzzles"],
  masterCode: string
): Question[] {
  const normalizedMasterCode = normalizeMasterCode(masterCode);
  const bricks = normalizedMasterCode.split("");
  const timestamp = Date.now();

  return puzzles
    .map((puzzle, index): Question | null => {
      const riddle = puzzle.riddle.trim();
      const answer = puzzle.answer.trim();
      const codeBrick = bricks[index]?.trim() ?? "";

      if (!riddle || !answer || !codeBrick) {
        return null;
      }

      return {
        id: timestamp + index,
        type: "multiple_choice",
        text: riddle,
        aiPrompt: codeBrick,
        hint: "",
        mediaUrl: "",
        answers: toEscapeAnswers(answer),
        correctIndex: 0,
        lat: null,
        lng: null,
      };
    })
    .filter((question): question is Question => question !== null);
}

export default function EscapeBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className={`min-h-screen bg-amber-950 ${poppins.className}`}>
          <div className="flex min-h-screen items-center justify-center px-6 text-center">
            <div className="rounded-[2rem] border border-amber-500/30 bg-amber-950/20 px-8 py-10 text-amber-100 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
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

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-[1.4rem] border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-amber-300/30 bg-amber-500/10 text-amber-50"
            : "border-red-300/30 bg-red-500/10 text-red-100"
        } ${className}`}
      >
        {notice.message}
      </div>
    ) : null;
  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedDraftRef = useRef(false);
  const shouldAutoRestoreDraftRef = useRef<boolean | null>(null);

  const applyDraftState = (draft: EscapeBuilderDraftState) => {
    const restoredSubject = restoreDraftString(draft.subject);
    const restoredQuestions = toEscapeQuestions(draft.questions);

    setTitle(restoreDraftString(draft.title));
    setMasterCode(restoreDraftString(draft.masterCode));
    setSubject(restoredSubject);
    setRadius(normalizeRunRadius(draft.radius));
    setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion()]);
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
          console.error("Kunne ikke hente escape-løbet til redigering:", error);
          setNotice({
            tone: "error",
            message: "Vi kunne ikke åbne dette escape-løb til redigering. Tjek at du er ejer, og prøv igen fra arkivet.",
          });
          return;
        }

        const loadedQuestions = toEscapeQuestions(run.questions);
        const firstPinnedQuestion =
          loadedQuestions.find((question) => question.lat !== null && question.lng !== null) ?? null;

        setTitle(asTrimmedString(run.title));
        setMasterCode(readMasterCodeFromDescription(run.description));
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
        console.error("Kunne ikke indlæse escape-løbet til redigering:", error);
        if (!isActive) return;
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette escape-løb til redigering. Prøv igen fra arkivet om et øjeblik.",
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
      shouldAutoRestoreDraftRef.current = shouldRestoreRunDraftOnLoad(ESCAPE_DRAFT_STORAGE_KEY);
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
      ? readRunDraft<EscapeBuilderDraftState>(ESCAPE_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      applyDraftState(restoredDraft);
      setNotice(null);
      hasInitializedDraftRef.current = true;
      return;
    }

    if (isEditMode && !shouldAutoRestoreDraft && hasUnsavedDraft(ESCAPE_DRAFT_STORAGE_KEY, editRunId)) {
      setShowDraftRecoveryPrompt(true);
      hasInitializedDraftRef.current = true;
      return;
    }

    hasInitializedDraftRef.current = true;
  }, [editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;
    if (showDraftRecoveryPrompt) return;

    writeRunDraft(ESCAPE_DRAFT_STORAGE_KEY, editRunId, {
      title,
      masterCode,
      subject,
      radius,
      showAiInterviewModal,
      questions,
      mapCenter,
    } satisfies EscapeBuilderDraftState);
  }, [
    editRunId,
    mapCenter,
    masterCode,
    questions,
    radius,
    showAiInterviewModal,
    showDraftRecoveryPrompt,
    subject,
    title,
  ]);

  const handleRestoreDraft = () => {
    const restoredDraft = readRunDraft<EscapeBuilderDraftState>(ESCAPE_DRAFT_STORAGE_KEY, editRunId);

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
    clearRunDraft(ESCAPE_DRAFT_STORAGE_KEY);
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
        id: pin.id,
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

  const assignPinFromCenter = (id: number) => {
    updateQuestion(id, { lat: mapCenter.lat, lng: mapCenter.lng });
  };

  const addQuestion = () => {
    setQuestions((current) => [...current, createQuestion()]);
  };

  const closeAiInterviewModal = () => {
    setNotice(null);
    setShowAiInterviewModal(false);
  };

  const handleAiInterviewComplete = (draft: EscapeAiInterviewDraft) => {
    const nextTitle = draft.title.trim();
    const nextMasterCode = normalizeMasterCode(draft.masterCode).slice(0, MAX_MASTER_CODE_LENGTH);
    const nextQuestions = toInterviewEscapeQuestions(draft.puzzles, nextMasterCode);

    if (!nextTitle || !nextMasterCode || nextQuestions.length === 0) {
      setNotice({
        tone: "error",
        message: "AI'en returnerede ingen brugbare escape-gåder. Prøv igen.",
      });
      return;
    }

    if (nextMasterCode.length !== draft.puzzles.length || nextMasterCode.length !== nextQuestions.length) {
      setNotice({
        tone: "error",
        message: "AI'ens master-kode passer ikke til antallet af poster. Prøv igen.",
      });
      return;
    }

    const hasExistingContent =
      title.trim().length > 0 ||
      masterCode.trim().length > 0 ||
      questions.some((question) => !isQuestionEmpty(question));

    if (hasExistingContent) {
      const shouldReplace = window.confirm(
        "AI-udkastet erstatter de nuværende escape-poster i builderen. Vil du fortsætte?"
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
    setMasterCode(nextMasterCode);
    setQuestions([...nextQuestions]);
    setShowAiInterviewModal(false);
    setNotice({
      tone: "success",
      message: "AI har klargjort et komplet escape room. Gennemgå felterne og placer posterne på kortet.",
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

    const normalizedMasterCode = normalizeMasterCode(masterCode);
    if (!normalizedMasterCode) {
      setNotice({ tone: "error", message: "Udfyld master-koden til finalen." });
      scrollToSaveFeedback();
      return;
    }

    if (normalizedMasterCode.length !== normalizedQuestions.length) {
      setNotice({
        tone: "error",
        message: `Master-koden skal have præcis ${normalizedQuestions.length} tegn, så hver post giver ét bogstav eller tal.`,
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
        description: serializeEscapeDescription("", normalizedMasterCode),
        topic: normalizedTopic,
        questions: normalizedQuestions,
        radius,
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
        setRadius(DEFAULT_RUN_RADIUS);
        setQuestions([createQuestion()]);
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
      <div className={`relative min-h-screen overflow-hidden bg-amber-950 text-amber-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-amber-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-amber-950/20 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
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
      <div className={`relative min-h-screen overflow-x-hidden bg-amber-950 text-amber-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-amber-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
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
                  <div className="mb-4 inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-amber-100 uppercase">
                    Edit-mode
                  </div>
                ) : null}

                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-amber-100">Velkommen til Escape Room løbet.</h3>
                  <p className="mt-2 text-sm text-amber-100/80">Placer dine poster på kortet, og skriv en udfordrende gåde til hver lokation. Eleverne skal løse gåderne ude på ruten for at indsamle brikker til en endelig master-kode. Mangler du idéer, kan du bruge den indbyggede AI-assistent til at generere gåderne for dig.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setShowAiInterviewModal(true);
                    }}
                    disabled={isEditorBusy || isLoadingExistingRun}
                    className={`${aiActionButtonClass} mt-4 rounded-full px-4 py-2 text-xs`}
                  >
                    <span aria-hidden>✨</span>
                    AI-udfyld
                  </button>
                </div>

                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                  Løbets titel
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="F.eks. 6.B's store matematik-flugt"
                  className={textInputClass}
                />
              </div>
              <div className="rounded-[1.4rem] border border-amber-500/30 bg-amber-950/20 p-4 backdrop-blur-xl">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                  Emne
                </label>
                <select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full appearance-none rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3 text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="" className="bg-slate-900 text-white">
                    Vælg et fag til arkivet...
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

              <div className="rounded-[1.4rem] border border-amber-500/30 bg-amber-950/20 p-4 backdrop-blur-xl">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                  GPS-radius
                </label>
                <select
                  value={radius}
                  onChange={(event) => setRadius(normalizeRunRadius(event.target.value))}
                  disabled={isEditorBusy}
                  className="w-full appearance-none rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3 text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50"
                >
                  {RUN_RADIUS_OPTIONS.map((radiusOption) => (
                    <option key={radiusOption} value={radiusOption} className="bg-slate-900 text-white">
                      {radiusOption} meter
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-amber-100/70">
                  Vælg hvor tæt eleven skal være på posten, før GPS-låsen åbner.
                </p>
              </div>

              <div className="rounded-3xl border border-amber-500/30 bg-amber-950/20 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                  Slut-kode (Master-kode)
                </label>
                <input
                  value={masterCode}
                  onChange={(event) => setMasterCode(normalizeMasterCode(event.target.value))}
                  placeholder="f.eks. GULD77"
                  className={textInputClass}
                  maxLength={MAX_MASTER_CODE_LENGTH}
                />
              </div>

              <div className="space-y-3 px-1">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-xs font-semibold tracking-[0.24em] text-amber-100/65 uppercase">
                    Dine gåder
                  </p>
                  <span className="rounded-full border border-amber-500/30 bg-amber-950/20 px-3 py-1.5 text-sm font-semibold text-amber-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}
              </div>

              {questions.map((question, index) => (
                <article
                  key={question.id}
                  className="rounded-3xl border border-amber-500/30 bg-amber-950/20 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-950/20 text-sm font-bold text-amber-100">
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
                    className="mt-4 w-full rounded-[1.2rem] border border-amber-500/30 bg-amber-500 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400"
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

              <div className="rounded-3xl border border-amber-500/30 bg-amber-950/20 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5">
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-2 rounded-[1.2rem] border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-100 backdrop-blur-xl transition hover:bg-amber-900/30"
                >
                  <Plus className="h-4 w-4" />
                  Tilføj ny gåde
                </button>

                <div ref={saveFeedbackRef} className="mt-5 space-y-4">
                  {notice?.tone === "error" ? renderNotice() : null}
                  <button
                    type="button"
                    onClick={handleSaveRun}
                    disabled={isSaving}
                    className="w-full rounded-[1.5rem] border border-amber-500/30 bg-amber-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="h-[42vh] min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-amber-500/20 bg-slate-900/60 shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_0_36px_rgba(245,158,11,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
                <MapPicker center={mapCenter} pins={pins} zones={previewZones} onCenterChange={setMapCenter} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showDraftRecoveryPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 py-10 backdrop-blur-md">
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

      <EscapeAiInterviewModal
        open={showAiInterviewModal}
        initialSubject={subject}
        onClose={closeAiInterviewModal}
        onComplete={handleAiInterviewComplete}
      />
    </>
  );
}

