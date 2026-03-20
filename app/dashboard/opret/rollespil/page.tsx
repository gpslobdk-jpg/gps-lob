"use client";

import { Loader2, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import RollespilAiInterviewModal, {
  type RollespilAiInterviewDraft,
} from "@/components/builders/rollespil/RollespilAiInterviewModal";
import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import type { SavedPin } from "@/components/MapPicker";
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
    <div className="h-full w-full animate-pulse rounded-3xl border border-violet-500/20 bg-slate-900/60" />
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
  postType?: "quiz" | "intro";
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

type StoredRoleplayQuestionRecord = {
  id?: unknown;
  text?: unknown;
  aiPrompt?: unknown;
  ai_prompt?: unknown;
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

const ROLLESPIL_DRAFT_STORAGE_KEY = "draft_run_rollespil";

type RollespilBuilderDraftState = {
  title?: unknown;
  description?: unknown;
  subject?: unknown;
  showTeacherField?: unknown;
  questions?: unknown;
  mapCenter?: unknown;
};

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
  lat: null,
  lng: null,
});

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

      const rawPostType = isRecord(candidate)
        ? (asTrimmedString((candidate as any).post_type) || asTrimmedString((candidate as any).postType))
        : "";
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

function toInterviewRoleplayQuestions(posts: RollespilAiInterviewDraft["posts"]): Question[] {
  const timestamp = Date.now();

  return posts.map((post, index) => {
    const characterName = post.characterName.trim() || fallbackCharacterName(index);
    const avatar = post.avatar.trim() || fallbackAvatar();
    const message = post.message.trim();
    const answer = index === 0 ? "" : post.answer?.trim() ?? "";

    return {
      id: timestamp + index,
      type: "multiple_choice",
      postType: index === 0 ? "intro" : "quiz",
      text: characterName,
      aiPrompt: message,
      mediaUrl: "",
      answers: toRoleplayAnswers(answer, characterName, avatar),
      correctIndex: 0,
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
  const [mapCenter, setMapCenter] = useState<MapCenter>({
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
  });

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
        console.error("Kunne ikke hente rollespilsløbet til redigering:", error);
        setNotice({
          tone: "error",
          message: "Vi kunne ikke åbne dette rollespilsløb til redigering. Tjek at du er ejer, og prøv igen fra arkivet.",
        });
        return;
      }

      const loadedQuestions = enforceFirstRoleplayIntro(toRoleplayQuestions(run.questions));
      const loadedDescription = readDescriptionText(run.description);
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
      ? readRunDraft<RollespilBuilderDraftState>(ROLLESPIL_DRAFT_STORAGE_KEY, editRunId)
      : null;

    if (restoredDraft) {
      const restoredSubject = restoreDraftString(restoredDraft.subject);
      const restoredQuestions = enforceFirstRoleplayIntro(toRoleplayQuestions(restoredDraft.questions));

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

    writeRunDraft(ROLLESPIL_DRAFT_STORAGE_KEY, editRunId, {
      title,
      description,
      subject,
      showTeacherField,
      questions,
      mapCenter,
    } satisfies RollespilBuilderDraftState);
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

  const handleAiInterviewComplete = (draft: RollespilAiInterviewDraft) => {
    const nextTitle = draft.title.trim();
    const nextDescription = draft.description.trim();
    const nextQuestions = enforceFirstRoleplayIntro(toInterviewRoleplayQuestions(draft.posts));

    if (!nextTitle || !nextDescription || nextQuestions.length === 0) {
      setNotice({
        tone: "error",
        message: "AI'en returnerede ingen brugbare rolleposter. Prøv igen.",
      });
      return;
    }

    if ((nextQuestions[0]?.postType ?? "quiz") !== "intro") {
      setNotice({
        tone: "error",
        message: "AI'en returnerede ikke en gyldig intro-post. Prøv igen.",
      });
      return;
    }

    const hasExistingContent =
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      questions.some((question) => !isQuestionEmpty(question));

    if (hasExistingContent) {
      const shouldReplace = window.confirm(
        "AI-udkastet erstatter de nuværende rolleposter i builderen. Vil du fortsætte?"
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
      message: "AI har klargjort et komplet rollespil. Gennemgå felterne og placer posterne på kortet.",
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
          correctIndex: 0,
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
      );

    if (normalizedQuestions.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst én udfyldt post." });
      scrollToSaveFeedback();
      return;
    }

    const hasIncompleteQuestions = normalizedQuestions.some(
      (question) =>
        !question.text ||
        !question.aiPrompt ||
        !question.answers[2] ||
        ((question.post_type ?? question.postType ?? "quiz") !== "intro" && !question.answers[0])
    );
    if (hasIncompleteQuestions) {
      setNotice({
        tone: "error",
        message:
          "Udfyld karakterens navn, avatar og besked på hver post. Quiz-poster skal også have et facitsvar.",
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
        race_type: RACE_TYPES.ROLLESPIL,
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
        message: isEditMode ? "Ændringerne er gemt i arkivet!" : "Rollespilsløbet er gemt i arkivet!",
      });
      clearRunDraft(ROLLESPIL_DRAFT_STORAGE_KEY);

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
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="px-1 pt-1">
                {isEditMode ? (
                  <div className="mb-4 inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-violet-100 uppercase">
                    Edit-mode
                  </div>
                ) : null}
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                  Løbets titel
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="F.eks. 5.A's rejse til Vikingetiden"
                  className={textInputClass}
                />
              </div>

              <div className="px-1">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                  Beskrivelse
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Kort intro eller beskrivelse af rollespillet"
                  className={textareaClass}
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

              <div className="space-y-4 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setShowAiInterviewModal(true);
                  }}
                  className={`${aiActionButtonClass} w-full sm:w-auto`}
                >
                  <span aria-hidden>✨</span>
                  Auto-udfyld historie med AI
                </button>

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
                  className="rounded-[1.8rem] border border-violet-500/30 bg-violet-950/20 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-500/30 bg-violet-950/20 text-sm font-bold text-violet-100">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className={`text-lg font-bold text-violet-100 ${rubik.className}`}>
                          Post {index + 1}
                        </h3>
                        <p className="text-xs text-violet-100/65">
                          {question.lat !== null && question.lng !== null
                            ? "Pin er valgt på kortet"
                            : "Ingen pin valgt endnu"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div>
                        <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                          Post Type
                        </label>
                        <select
                          value={question.postType ?? "quiz"}
                          onChange={(e) =>
                            updateQuestion(question.id, { postType: e.target.value as "quiz" | "intro" })
                          }
                          className={textInputClass}
                        >
                          <option value="quiz">Quiz</option>
                          <option value="intro">Intro (ventepost)</option>
                        </select>
                      </div>

                      <span className="rounded-full border border-violet-500/30 bg-violet-950/20 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-violet-100/75 uppercase backdrop-blur-xl">
                        Rollespil
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                        Karakterens Navn
                      </label>
                      <input
                        value={question.text}
                        onChange={(event) =>
                          updateRoleplayQuestion(question.id, { characterName: event.target.value })
                        }
                        placeholder="F.eks. Valdemar Atterdag"
                        className={textInputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                        Avatar (Emoji eller Billed-URL)
                      </label>
                      <input
                        value={question.answers[2]}
                        onChange={(event) =>
                          updateRoleplayQuestion(question.id, { avatar: event.target.value })
                        }
                        placeholder="F.eks. 👑"
                        className={textInputClass}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                        Karakterens besked / Gåde
                      </label>
                      <textarea
                        value={question.aiPrompt}
                        onChange={(event) =>
                          updateRoleplayQuestion(question.id, { message: event.target.value })
                        }
                        rows={3}
                        placeholder="F.eks. Hvem vover at træde ind på min borg uden tilladelse?"
                        className={textareaClass}
                      />
                    </div>

                    {question.postType !== "intro" && (
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-violet-100/65 uppercase">
                          Det rigtige svar fra deltageren
                        </label>
                        <input
                          value={question.answers[0]}
                          onChange={(event) =>
                            updateRoleplayQuestion(question.id, { correctAnswer: event.target.value })
                          }
                          placeholder="F.eks. Fred"
                          className={textInputClass}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => assignPinFromCenter(question.id)}
                    className="mt-4 w-full rounded-[1.35rem] border border-violet-500/30 bg-violet-500 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-400"
                  >
                    Hent pin fra kortet
                  </button>

                  {question.lat !== null && question.lng !== null ? (
                    <p className="mt-2.5 text-xs text-violet-100/70">
                      Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                    </p>
                  ) : null}
                </article>
              ))}

              <div className="rounded-[1.8rem] border border-violet-500/30 bg-violet-950/20 p-4 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-2 rounded-[1.4rem] border border-violet-500/30 bg-violet-950/20 px-4 py-3 text-sm font-semibold text-violet-100 backdrop-blur-xl transition hover:bg-violet-500/15"
                >
                  <Plus className="h-4 w-4" />
                  Tilføj ny post
                </button>

                <div ref={saveFeedbackRef} className="mt-6 space-y-4">
                  {notice?.tone === "error" ? renderNotice() : null}
                  <button
                    type="button"
                    onClick={handleSaveRun}
                    disabled={isSaving}
                    className="w-full rounded-[1.6rem] border border-violet-500/30 bg-violet-500 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-slate-950 shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <RollespilAiInterviewModal
        open={showAiInterviewModal}
        initialSubject={subject}
        onClose={closeAiInterviewModal}
        onComplete={handleAiInterviewComplete}
      />
    </>
  );
}
