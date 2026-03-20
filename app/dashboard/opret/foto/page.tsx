"use client";

import { Loader2, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import FotoAiInterviewModal, {
  type FotoAiInterviewDraft,
} from "@/components/builders/foto/FotoAiInterviewModal";
import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import type { SavedPin } from "@/components/MapPicker";
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
  description?: unknown;
  subject?: unknown;
  showTeacherField?: unknown;
  questions?: unknown;
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

const textInputClass =
  "w-full rounded-2xl border border-sky-500/30 bg-sky-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const textareaClass =
  "w-full rounded-2xl border border-sky-500/30 bg-sky-950/20 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const aiActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1.4rem] border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 px-5 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

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
        aiPrompt: getStoredPhotoTarget(candidate),
        mediaUrl: asTrimmedString(candidate.mediaUrl ?? candidate.media_url),
        answers: buildPhotoAnswers(getStoredPhotoTarget(candidate)),
        correctIndex: 0,
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
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [showTeacherField, setShowTeacherField] = useState(false);
  const [showAiInterviewModal, setShowAiInterviewModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExistingRun, setIsLoadingExistingRun] = useState(isEditMode);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([createQuestion()]);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const isEditorBusy = isSaving;
  const editorLockClass = isEditorBusy ? "pointer-events-none opacity-50" : "";
  const [mapCenter, setMapCenter] = useState<MapCenter>({
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
  });

  const renderNotice = (className = "") =>
    notice ? (
      <div
        className={`rounded-[1.5rem] border px-4 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl ${
          notice.tone === "success"
            ? "border-sky-300/30 bg-sky-500/10 text-sky-50"
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
          return;
        }

        const loadedQuestions = toPhotoQuestions(run.questions);
        const loadedDescription = asTrimmedString(run.description);
        const loadedTopic = asTrimmedString(run.topic);
        const nextDescription = loadedDescription || loadedTopic;
        const firstPinnedQuestion =
          loadedQuestions.find((question) => question.lat !== null && question.lng !== null) ?? null;

        setTitle(asTrimmedString(run.title));
        setDescription(nextDescription);
        setSubject(asTrimmedString(run.subject));
        setShowTeacherField(Boolean(asTrimmedString(run.subject)));
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
      setDescription(restoreDraftString(restoredDraft.description));
      setSubject(restoredSubject);
      setShowTeacherField(
        restoreDraftBoolean(restoredDraft.showTeacherField, Boolean(restoredSubject.trim()))
      );
      setQuestions(restoredQuestions.length > 0 ? restoredQuestions : [createQuestion()]);
      setShowAiInterviewModal(false);
      setMapCenter(restoreDraftMapCenter(restoredDraft.mapCenter, DEFAULT_MAP_CENTER));
      setNotice(null);
    }

    hasInitializedDraftRef.current = true;
  }, [editRunId, isEditMode, isLoadingExistingRun, loadedRunId]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;

    writeRunDraft(FOTO_DRAFT_STORAGE_KEY, editRunId, {
      title,
      description,
      subject,
      showTeacherField,
      questions,
      mapCenter,
    } satisfies FotoBuilderDraftState);
  }, [
    description,
    editRunId,
    mapCenter,
    questions,
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

  const handleAiInterviewComplete = (draft: FotoAiInterviewDraft) => {
    const nextTitle = draft.title.trim();
    const nextDescription = draft.description.trim();
    const nextQuestions = toInterviewMissionQuestions(draft.missions);

    if (!nextTitle || !nextDescription || nextQuestions.length === 0) {
      setNotice({
        tone: "error",
        message: "AI'en returnerede ingen brugbare foto-missioner. Prøv igen.",
      });
      return;
    }

    const hasExistingContent =
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      questions.some((question) => !isQuestionEmpty(question));

    if (hasExistingContent) {
      const shouldReplace = window.confirm(
        "AI-udkastet erstatter de nuværende missioner i builderen. Vil du fortsætte?"
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
      message: "AI har klargjort et komplet foto-løb. Gennemgå felterne og placer missionerne på kortet.",
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

    const normalizedQuestions = questions
      .map((question) => ({
        ...question,
        type: "ai_image" as const,
        text: question.text.trim(),
        aiPrompt: question.aiPrompt.trim(),
        answers: buildPhotoAnswers(question.aiPrompt.trim()),
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
        setDescription("");
        setSubject("");
        setShowTeacherField(false);
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
      <div className={`relative min-h-screen overflow-x-hidden bg-sky-950 text-sky-100 ${poppins.className}`}>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
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
                    <div className="mb-4 inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-sky-100 uppercase">
                      Edit-mode
                    </div>
                  ) : null}
                  <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                    Løbets titel
                  </label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={isEditorBusy}
                    placeholder="F.eks. 6.A's forårstur"
                    className={textInputClass}
                  />
                </div>

              <div className="px-1">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                  Beskrivelse
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isEditorBusy}
                  rows={3}
                  placeholder="Kort pitch eller introduktion til foto-løbet"
                  className={textareaClass}
                />
              </div>

              <div className="px-1">
                <div className="rounded-[1.5rem] border border-sky-500/30 bg-sky-950/20 p-4 backdrop-blur-xl">
                  <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-sky-100/65 uppercase">
                    Emne
                  </label>
                  <select
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    disabled={isEditorBusy}
                    className="w-full appearance-none rounded-2xl border border-sky-500/30 bg-sky-950/20 p-3 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  disabled={isEditorBusy || isLoadingExistingRun}
                  className={`${aiActionButtonClass} w-full sm:w-auto`}
                >
                  <span aria-hidden>✨</span>
                  Auto-udfyld med AI
                </button>

                <div className="flex items-end justify-between gap-4">
                  <p className="text-xs font-semibold tracking-[0.24em] text-sky-100/65 uppercase">
                    Dine missioner
                  </p>
                  <span className="rounded-full border border-sky-500/30 bg-sky-950/20 px-4 py-2 text-sm font-semibold text-sky-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>

                {renderNotice()}
              </div>

              {questions.map((question, index) => (
                <article
                  key={question.id}
                  className="rounded-[2rem] border border-sky-500/30 bg-sky-950/20 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-500/30 bg-sky-950/20 text-sm font-bold text-sky-100">
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
                    <span className="rounded-full border border-sky-500/30 bg-sky-950/20 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-sky-100/75 uppercase backdrop-blur-xl">
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
                    className="mt-5 w-full rounded-[1.4rem] border border-sky-500/30 bg-sky-500 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-sky-500/20 transition-all hover:bg-sky-400"
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

                <div className="rounded-[2rem] border border-sky-500/30 bg-sky-950/20 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
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
                      className="w-full rounded-[1.6rem] border border-sky-500/30 bg-sky-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-sky-500/20 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="h-[42vh] min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-sky-500/20 bg-slate-900/60 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_36px_rgba(16,185,129,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:h-[calc(100vh-40px)]">
                <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <FotoAiInterviewModal
        open={showAiInterviewModal}
        initialSubject={subject}
        onClose={closeAiInterviewModal}
        onComplete={handleAiInterviewComplete}
      />
    </>
  );
}

