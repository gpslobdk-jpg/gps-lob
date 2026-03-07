"use client";

import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, ImageIcon, Loader2, Plus, Sparkles, Youtube } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { Suspense, useEffect, useMemo, useState } from "react";

import type { SavedPin } from "@/components/MapPicker";
import { createClient } from "@/utils/supabase/client";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-3xl border border-emerald-500/20 bg-emerald-950/50" />
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

const AI_GRADE_OPTIONS = [
  "Indskoling",
  "Mellemtrin",
  "Udskoling",
  "Ungdomsuddannelse",
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

type MagicDraftQuestion = {
  type?: unknown;
  question?: unknown;
  aiPrompt?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
};

const MAGIC_DRAFT_STORAGE_KEY = "magicRunDraft";

const getQuestionTypeFromQuery = (value: string | null | undefined): Question["type"] =>
  value === "ai_image" ? "ai_image" : "multiple_choice";

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
  "w-full rounded-2xl border border-emerald-500/20 bg-emerald-950/50 px-4 py-3 text-emerald-100 placeholder:text-emerald-100/35 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500";

const reviewInputClass =
  "w-full rounded-2xl border border-emerald-500/20 bg-emerald-950/50 px-4 py-3 text-emerald-100 placeholder:text-emerald-100/35 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500";

const DEFAULT_ANSWERS: [string, string, string, string] = ["", "", "", ""];

function toAnswersTuple(value: unknown): [string, string, string, string] {
  if (!Array.isArray(value)) return DEFAULT_ANSWERS;

  const stringAnswers = value.filter((item): item is string => typeof item === "string");
  const padded = [...stringAnswers.slice(0, 4)];
  while (padded.length < 4) {
    padded.push("");
  }

  return [padded[0] ?? "", padded[1] ?? "", padded[2] ?? "", padded[3] ?? ""];
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
            <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-950/50 px-8 py-10 text-emerald-100 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
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
  const defaultQuestionType = getQuestionTypeFromQuery(searchParams.get("type"));
  const addQuestionLabel =
    defaultQuestionType === "ai_image" ? "Tilføj ny mission" : "Tilføj nyt spørgsmål";
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [showTeacherField, setShowTeacherField] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAITeacherFields, setShowAITeacherFields] = useState(false);
  const [aiRunBrief, setAiRunBrief] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiGrade, setAiGrade] = useState("Mellemtrin");
  const [aiCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [questions, setQuestions] = useState<Question[]>(() => [createQuestion(defaultQuestionType)]);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [mapCenter, setMapCenter] = useState<MapCenter>({
    lat: 55.6761,
    lng: 12.5683,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

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
          const aiPromptText = typeof item.aiPrompt === "string" ? item.aiPrompt : "";
          const answerIndex =
            typeof item.correctAnswer === "string" ? answers.indexOf(item.correctAnswer) : -1;

          return {
            id: Date.now() + index,
            type: item.type === "ai_image" ? "ai_image" : "multiple_choice",
            text: questionText,
            aiPrompt: aiPromptText,
            mediaUrl: "",
            answers,
            correctIndex: answerIndex >= 0 ? answerIndex : 0,
            lat: null,
            lng: null,
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
  }, []);

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

  const closeAIModal = () => {
    if (isGenerating) return;
    setShowAIModal(false);
    setPreviewQuestions([]);
    setShowAITeacherFields(false);
  };

  const updatePreviewQuestionText = (id: number, value: string) => {
    setPreviewQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, text: value } : q))
    );
  };

  const updatePreviewAnswer = (id: number, answerIndex: number, value: string) => {
    setPreviewQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const answers = [...q.answers] as Question["answers"];
        answers[answerIndex] = value;
        return { ...q, answers };
      })
    );
  };

  const handleApproveAIPreview = () => {
    if (previewQuestions.length === 0) return;

    const timestamp = Date.now();
    const approvedQuestions: Question[] = previewQuestions.map((q, index) => ({
      ...q,
      id: timestamp + index,
      type: q.type === "ai_image" ? "ai_image" : "multiple_choice",
      text: q.text.trim(),
      aiPrompt: q.aiPrompt.trim(),
      answers: toAnswersTuple(q.answers),
      correctIndex:
        typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex <= 3
          ? q.correctIndex
          : 0,
      lat: null,
      lng: null,
    }));

    setQuestions(approvedQuestions);
    setPreviewQuestions([]);
    setShowAIModal(false);
    setShowAITeacherFields(false);
  };

  const handleDiscardAIPreview = () => {
    setPreviewQuestions([]);
  };

  const handleAIGenerate = async () => {
    const normalizedBrief = aiRunBrief.trim();
    const normalizedSubject = aiSubject.trim() || subject.trim() || "Generelt";
    const normalizedGrade = aiGrade.trim() || "Ikke angivet";

    if (!normalizedBrief) {
      alert("Skriv først, hvad løbet skal handle om.");
      return;
    }

    const teacherGrade = showAITeacherFields ? normalizedGrade : "blandet niveau";
    const teacherSubject = showAITeacherFields ? normalizedSubject : "et valgfrit fag";

    const pedagogicalContext = `Du er en pædagogisk konsulent. Generer ${aiCount} GPS-løb poster til ${teacherGrade} i faget ${teacherSubject} om emnet ${normalizedBrief}.`;

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
          count: aiCount,
          prompt: normalizedBrief,
          pedagogicalContext,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "AI-generering fejlede");
      }

      if (data.questions && data.questions.length > 0) {
        const formattedQuestions: Question[] = data.questions.map(
          (
            q: {
              text: string;
              answers: string[];
              correctIndex: number;
              type?: string;
              aiPrompt?: string;
              ai_prompt?: string;
            },
            index: number
          ) => ({
            id: Date.now() + index,
            type: q.type === "ai_image" ? "ai_image" : "multiple_choice",
            text: q.text,
            aiPrompt:
              typeof q.aiPrompt === "string"
                ? q.aiPrompt
                : typeof q.ai_prompt === "string"
                  ? q.ai_prompt
                  : "",
            answers: [
              q.answers?.[0] ?? "",
              q.answers?.[1] ?? "",
              q.answers?.[2] ?? "",
              q.answers?.[3] ?? "",
            ],
            correctIndex:
              typeof q.correctIndex === "number" &&
              q.correctIndex >= 0 &&
              q.correctIndex <= 3
                ? q.correctIndex
                : 0,
            lat: null,
            lng: null,
            mediaUrl: "",
          })
        );

        setPreviewQuestions(formattedQuestions);
      } else {
        alert("AI returnerede ingen spørgsmål. Prøv igen.");
      }
    } catch (error) {
      console.error(error);
      alert("Der skete en fejl. Prøv igen.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAIImage = async (questionId: number, questionText: string) => {
    const normalizedSubject = aiSubject.trim() || subject.trim() || "Generelt";
    const normalizedTopic = aiTopic.trim() || aiRunBrief.trim();

    if (!normalizedTopic) {
      alert("Generér først spørgsmål i AI-assistenten, så emnet er sat.");
      return;
    }

    setGeneratingImages((prev) => ({ ...prev, [questionId]: true }));

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText, subject: normalizedSubject, topic: normalizedTopic }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Billedgenerering fejlede");
      }

      if (data.imageUrl) {
        updateQuestion(questionId, "mediaUrl", data.imageUrl);
      }
    } catch (error) {
      console.error(error);
      alert("Der skete en fejl. Prøv igen.");
    } finally {
      setGeneratingImages((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const handleSaveRun = async () => {
    if (!title.trim()) {
      alert("Udfyld venligst titel.");
      return;
    }

    const normalizedQuestions = questions
      .map((q) => ({
        ...q,
        type: q.type === "ai_image" ? "ai_image" : "multiple_choice",
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
      alert("Tilføj mindst ét udfyldt spørgsmål.");
      return;
    }

    const hasIncompleteQuestions = normalizedQuestions.some((q) => {
      if (!q.text) return true;
      if (q.type === "ai_image") return !q.aiPrompt;
      return q.answers.some((answer) => !answer);
    });
    if (hasIncompleteQuestions) {
      alert(
        "Udfyld postens tekst. Multiple choice kræver fire svarmuligheder, og AI-billede kræver AI-instruks."
      );
      return;
    }

    const hasAtLeastOnePin = normalizedQuestions.some(
      (q) => q.lat !== null && q.lng !== null
    );
    if (!hasAtLeastOnePin) {
      alert("Du mangler at sætte pins på kortet. Mindst ét spørgsmål skal have koordinater.");
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
        alert("Du skal være logget ind for at gemme løbet.");
        return;
      }

      const { error } = await supabase.from("gps_runs").insert({
        user_id: user.id,
        title: title.trim(),
        subject: subject.trim() || "Generelt",
        topic: aiRunBrief.trim() || aiTopic || "",
        questions: normalizedQuestions,
      });

      if (error) {
        throw error;
      }

      alert("Løbet er gemt i arkivet!");

      setTitle("");
      setSubject("");
      setShowTeacherField(false);
      setQuestions([createQuestion(defaultQuestionType)]);
      setAiRunBrief("");
      setGeneratingImages({});

      router.push("/dashboard/arkiv");
    } catch (error) {
      console.error("Fejl ved gemning af løb:", error);
      alert("Kunne ikke gemme løbet. Prøv igen.");
    } finally {
      setIsSaving(false);
    }
  };

  const truncateText = (text: string, length: number) =>
    text.length > length ? text.substring(0, length) + "..." : text;

  return (
    <>
      <div className={`relative min-h-screen overflow-hidden bg-emerald-950 text-emerald-100 ${poppins.className}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.28),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(110,231,183,0.12),_transparent_28%)]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row">
          <section className="w-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:w-[52%] lg:px-8 lg:py-8">
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="px-1 pt-1">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                  Løbets titel
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="F.eks. Eventyr i skolegården"
                  className="w-full rounded-[1.6rem] border border-emerald-500/20 bg-emerald-950/50 px-5 py-4 text-xl font-bold text-emerald-100 placeholder:text-emerald-100/35 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-4 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAIModal(true);
                    setPreviewQuestions([]);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-emerald-500/20 bg-emerald-950/50 px-5 py-3 text-sm font-semibold text-emerald-100 shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition hover:border-emerald-300/35 hover:bg-emerald-900/60 sm:w-auto"
                >
                  <span aria-hidden>✨</span>
                  Auto-udfyld med AI
                </button>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.24em] text-emerald-100/65 uppercase">
                      Dine poster
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-950/45 px-4 py-2 text-sm font-semibold text-emerald-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>
              </div>

              {questions.map((question, questionIndex) => (
                <article
                  key={question.id}
                  className="rounded-[2rem] border border-emerald-500/20 bg-emerald-950/50 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-950/50 text-sm font-bold text-emerald-100">
                        {questionIndex + 1}
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold text-emerald-100 ${rubik.className}`}>
                          {question.type === "ai_image" ? "Foto-post" : "Quiz-post"}
                        </h3>
                        <p className="text-xs text-emerald-100/65">
                          {question.lat !== null && question.lng !== null
                            ? "Pin er valgt på kortet"
                            : "Ingen pin valgt endnu"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-950/45 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-emerald-100/75 uppercase backdrop-blur-xl">
                      {question.type === "ai_image" ? "AI foto" : "4 svar"}
                    </span>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                      Spørgsmålstekst
                    </label>
                    <input
                      value={question.text}
                      onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                      placeholder="Skriv spørgsmålet her..."
                      className={inputClass}
                    />
                  </div>

                  {question.type === "ai_image" ? (
                    <div className="mt-5 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-950/50 p-4 backdrop-blur-xl">
                      <label className="mb-2 block text-sm font-semibold text-emerald-100">
                        Instruks til AI-dommeren
                      </label>
                      <textarea
                        value={question.aiPrompt}
                        onChange={(event) => updateQuestion(question.id, { aiPrompt: event.target.value })}
                        rows={4}
                        placeholder="Hvad skal deltagerne tage billede af? F.eks. 'Find et egetræ' eller 'Tag et billede af noget rundt og blåt'."
                        className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="mt-2 text-xs text-emerald-100/70">
                        Skriv en tydelig dommer-instruks, så AI&apos;en kan vurdere billedet præcist.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {question.answers.map((answer, answerIndex) => (
                        <label
                          key={`${question.id}-${answerIndex}`}
                          className="flex items-center gap-3 rounded-[1.4rem] border border-emerald-500/20 bg-emerald-950/45 px-4 py-3 transition hover:border-emerald-400/25"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-950/55 text-sm font-bold text-emerald-100/80">
                            {String.fromCharCode(65 + answerIndex)}
                          </span>
                          <input
                            type="radio"
                            checked={question.correctIndex === answerIndex}
                            onChange={() => updateQuestion(question.id, { correctIndex: answerIndex })}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          <input
                            value={answer}
                            onChange={(event) => updateAnswer(question.id, answerIndex, event.target.value)}
                            placeholder={`Svar ${answerIndex + 1}`}
                            className="min-w-0 flex-1 bg-transparent text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                    <div className="mt-5 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-950/50 p-4 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-100/75">
                      <ImageIcon className="h-4 w-4 text-emerald-200" />
                      <Youtube className="h-4 w-4 text-emerald-200" />
                      <span>Medie (valgfrit)</span>
                    </div>

                    {question.mediaUrl && question.mediaUrl.startsWith("http") && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative mx-auto mt-4 aspect-video w-full max-w-[300px] overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-950/50 shadow-2xl backdrop-blur-xl"
                      >
                        <Image
                          src={question.mediaUrl}
                          alt="Preview"
                          fill
                          sizes="(max-width: 640px) 100vw, 300px"
                          className="object-cover"
                          unoptimized
                          loader={({ src }) => src}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <button
                          type="button"
                          onClick={() => updateQuestion(question.id, "mediaUrl", "")}
                          className="absolute top-2 right-2 rounded-full bg-emerald-950/80 p-1.5 text-emerald-100 transition hover:bg-emerald-900/80"
                        >
                          ✕
                        </button>
                      </motion.div>
                    )}

                    <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
                      <input
                        type="text"
                        placeholder="Indsæt link til billede eller YouTube-video..."
                        value={question.mediaUrl || ""}
                        onChange={(e) => updateQuestion(question.id, "mediaUrl", e.target.value)}
                        className="min-w-0 flex-1 rounded-2xl border border-emerald-500/20 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleGenerateAIImage(question.id, question.text)}
                        disabled={generatingImages[question.id] || !question.text}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-950/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/85 backdrop-blur-xl transition hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {generatingImages[question.id] ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Tænker...
                          </span>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Generér billede til &quot;{truncateText(question.text || "posten", 24)}&quot;
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => assignPinFromCenter(question.id)}
                    className="mt-5 w-full rounded-[1.4rem] border border-emerald-400/30 bg-emerald-500/22 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-emerald-100 shadow-[0_12px_32px_rgba(16,185,129,0.18)] transition hover:bg-emerald-500/30"
                  >
                    Hent pin fra kortet
                  </button>

                  {question.lat !== null && question.lng !== null ? (
                    <p className="mt-3 text-xs text-emerald-100/70">
                      Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                    </p>
                  ) : null}
                </article>
              ))}

              <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-950/50 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-2 rounded-[1.4rem] border border-emerald-500/20 bg-emerald-950/50 px-4 py-3 text-sm font-semibold text-emerald-100 backdrop-blur-xl transition hover:bg-emerald-900/60"
                >
                  <Plus className="h-4 w-4" />
                  {addQuestionLabel}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTeacherField((prev) => !prev)}
                  className="mt-5 inline-flex items-center gap-2 text-sm text-emerald-100/70 transition hover:text-emerald-100"
                >
                  {showTeacherField ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showTeacherField ? "Skjul fag (valgfrit)" : "Tilføj fag (valgfrit)"}
                </button>

                {showTeacherField ? (
                  <div className="mt-4 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-950/50 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                      Fag
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-emerald-500/20 bg-emerald-950/50 p-3 text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="" className="bg-slate-900 text-white">
                        Vælg et fag...
                      </option>
                      {Object.keys(SUBJECT_TOPICS).map((subj) => (
                        <option key={subj} value={subj} className="bg-slate-900 text-white">
                          {subj}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleSaveRun}
                  disabled={isSaving}
                  className="mt-6 w-full rounded-[1.6rem] border border-emerald-400/30 bg-emerald-500/22 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-emerald-100 shadow-[0_14px_34px_rgba(16,185,129,0.18)] transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Gemmer..." : "Gem løb i arkivet"}
                </button>
              </div>
          </div>
        </section>

        <aside className="h-[42vh] w-full p-4 pt-0 sm:px-6 lg:h-auto lg:w-[48%] lg:p-8 lg:pl-0">
          <div className="h-full min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-emerald-950/50 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_36px_rgba(16,185,129,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
          </div>
        </aside>
      </div>
      </div>

      {showAIModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-emerald-950/70 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl rounded-[2rem] border border-emerald-500/20 bg-emerald-950/90 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.28em] text-emerald-100/55 uppercase">
                  AI-modal
                </p>
                <h3
                  className={`mt-3 flex items-center gap-2 text-3xl font-extrabold text-emerald-100 ${rubik.className}`}
                >
                  <span aria-hidden>✨</span>
                  Intelligent AI-assistent
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-100/75">
                  Skriv kort, hvad du vil have hjælp til. Du kan altid finjustere spørgsmålene, før de lægges på kortet.
                </p>
              </div>
            </div>

            {previewQuestions.length > 0 ? (
              <div className="mt-8">
                <p className="mb-4 text-sm text-emerald-100/75">
                  Gennemgå spørgsmålene og ret dem til, før de overføres til kortet.
                </p>

                <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                  {previewQuestions.map((previewQuestion, previewIndex) => (
                    <div
                      key={previewQuestion.id}
                      className="rounded-[1.6rem] border border-emerald-500/20 bg-emerald-950/50 p-4 backdrop-blur-xl"
                    >
                      <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                        Spørgsmål {previewIndex + 1}
                      </p>

                      <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-emerald-100/65 uppercase">
                        Spørgsmålstekst
                      </label>
                      <input
                        type="text"
                        value={previewQuestion.text}
                        onChange={(event) =>
                          updatePreviewQuestionText(previewQuestion.id, event.target.value)
                        }
                        className={reviewInputClass}
                      />

                      <div className="mt-4 space-y-3">
                        {previewQuestion.answers.map((answer, answerIndex) => (
                          <div key={`${previewQuestion.id}-answer-${answerIndex}`}>
                            <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-emerald-100/65 uppercase">
                              Svar {answerIndex + 1}
                            </label>
                            <input
                              type="text"
                              value={answer}
                              onChange={(event) =>
                                updatePreviewAnswer(
                                  previewQuestion.id,
                                  answerIndex,
                                  event.target.value
                                )
                              }
                              className={reviewInputClass}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleApproveAIPreview}
                    className="w-full rounded-[1.4rem] border border-emerald-400/30 bg-emerald-500/22 py-3 font-bold text-emerald-100 transition hover:bg-emerald-500/30"
                  >
                    Godkend og placer på kortet
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardAIPreview}
                    className="w-full rounded-[1.4rem] border border-emerald-500/20 bg-emerald-950/45 py-3 font-semibold text-emerald-100/80 transition hover:bg-emerald-900/55"
                  >
                    Kassér og prøv igen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <label className="mb-3 block text-sm font-semibold text-white">
                    Hvad skal løbet handle om, og hvor mange poster vil du have? (F.eks: Lav 6 spørgsmål om solsystemet...)
                  </label>
                  <textarea
                    value={aiRunBrief}
                    onChange={(e) => setAiRunBrief(e.target.value)}
                    rows={8}
                    placeholder="Hvad skal løbet handle om, og hvor mange poster vil du have? (F.eks: Lav 6 spørgsmål om solsystemet...)"
                    className="w-full rounded-[1.6rem] border border-emerald-500/20 bg-emerald-950/50 p-5 text-emerald-100 placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAITeacherFields((prev) => !prev)}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-100/70 transition hover:text-emerald-100"
                >
                  {showAITeacherFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Er du lærer? Tilpas fag og niveau
                </button>

                {showAITeacherFields ? (
                  <section className="mt-4 rounded-[1.6rem] border border-emerald-500/20 bg-emerald-950/50 p-4 backdrop-blur-xl">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-emerald-100/65 uppercase">
                          Fag
                        </label>
                        <select
                          value={aiSubject}
                          onChange={(e) => setAiSubject(e.target.value)}
                          className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-950/50 p-3 text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="" className="bg-slate-900 text-white">
                            Vælg fag...
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
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-emerald-100/65 uppercase">
                          Klassetrin
                        </label>
                        <select
                          value={aiGrade}
                          onChange={(e) => setAiGrade(e.target.value)}
                          className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-950/50 p-3 text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {AI_GRADE_OPTIONS.map((gradeOption) => (
                            <option
                              key={gradeOption}
                              value={gradeOption}
                              className="bg-slate-900 text-white"
                            >
                              {gradeOption}
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
                    className="rounded-[1.4rem] border border-emerald-500/20 bg-emerald-950/45 px-5 py-3 text-sm font-semibold text-emerald-100/80 transition hover:bg-emerald-900/55 disabled:opacity-60"
                  >
                    Luk
                  </button>
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="w-full rounded-[1.4rem] border border-emerald-400/30 bg-emerald-500/22 px-6 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Tænker...
                      </span>
                    ) : (
                      "Generer spørgsmål"
                    )}
                  </button>
                </div>
                {isGenerating ? (
                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-100/75">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300" />
                    AI&apos;en skriver forslag...
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
