"use client";

import { motion } from "framer-motion";
import { ImageIcon, Sparkles, Youtube } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useMemo, useState } from "react";

import type { SavedPin } from "@/components/MapPicker";
import { createClient } from "@/utils/supabase/client";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-3xl border border-white/70 bg-white/60" />
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

const createQuestion = (): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type: "multiple_choice",
  text: "",
  aiPrompt: "",
  mediaUrl: "",
  answers: ["", "", "", ""],
  correctIndex: 0,
  lat: null,
  lng: null,
});

const inputClass =
  "w-full rounded-xl border border-emerald-100 bg-white/50 px-4 py-3 text-emerald-950 placeholder:text-emerald-800/50 focus:outline-none focus:ring-2 focus:ring-emerald-300";

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

export default function OpretLoebPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiSubject, setAiSubject] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiGrade, setAiGrade] = useState("Mellemtrin (4.-6. trin)");
  const [aiCount, setAiCount] = useState(5);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [questions, setQuestions] = useState<Question[]>([createQuestion()]);
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
    setQuestions((prev) => [...prev, createQuestion()]);
  };

  const handleAIGenerate = async () => {
    if (!aiSubject || !aiTopic) {
      alert("Vælg venligst både fag og emne først!");
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: aiSubject,
          topic: aiTopic,
          grade: aiGrade,
          count: aiCount,
          prompt: aiPrompt,
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

        setQuestions(formattedQuestions);
        setShowAIModal(false);
      }
    } catch (error) {
      console.error(error);
      alert("Der skete en fejl. Prøv igen.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAIImage = async (questionId: number, questionText: string) => {
    if (!aiSubject || !aiTopic) {
      alert("Vælg venligst fag og emne først!");
      return;
    }

    setGeneratingImages((prev) => ({ ...prev, [questionId]: true }));

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText, subject: aiSubject, topic: aiTopic }),
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
    if (!title.trim() || !subject) {
      alert("Udfyld venligst både titel og fag.");
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
        subject,
        topic: aiTopic || "",
        questions: normalizedQuestions,
      });

      if (error) {
        throw error;
      }

      alert("Løbet er gemt i arkivet!");

      setTitle("");
      setSubject("");
      setQuestions([createQuestion()]);
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
      <div
        className={`flex min-h-screen flex-col overflow-hidden bg-gradient-to-t from-emerald-100 via-sky-50 to-sky-300 text-emerald-950 lg:h-screen lg:flex-row ${poppins.className}`}
      >
        <section className="w-full overflow-y-auto p-6 lg:w-1/2 lg:p-10">
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/50 bg-white/80 p-6 shadow-2xl backdrop-blur-md lg:p-8">
            <h1
              className={`text-3xl font-black tracking-wide text-emerald-950 sm:text-4xl ${rubik.className}`}
            >
              Opret Nyt Løb
            </h1>
            <p className="mt-2 text-sm text-emerald-800">
              Byg dit forløb, marker poster og gør holdet klar på få minutter.
            </p>

            <div className="mt-6 mb-6 rounded-3xl border border-white/50 bg-white/60 p-6 shadow-xl backdrop-blur-md">
              <label className="mb-2 block text-xs uppercase tracking-widest text-emerald-800">
                Titel
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="fx Eventyr i Skolegården"
                className="w-full rounded-xl border border-emerald-100 bg-white/50 px-4 py-3 text-2xl font-bold text-emerald-950 placeholder:text-emerald-800/50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />

              <div className="mt-5 mb-4 flex flex-col gap-4 md:flex-row">
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Fag
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-emerald-100 bg-white/50 p-3 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  >
                    <option value="" disabled>
                      Vælg et fag...
                    </option>
                    {Object.keys(SUBJECT_TOPICS).map((subj) => (
                      <option key={subj} value={subj} className="bg-white text-emerald-950">
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAIModal(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition hover:bg-emerald-700"
              >
                <Sparkles className="h-4 w-4" />
                Auto-udfyld med AI
              </button>
            </div>

            {questions.map((question, questionIndex) => (
              <div
                key={question.id}
                className="mb-6 rounded-3xl border border-white/50 bg-white/70 p-6 shadow-xl backdrop-blur-md"
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 font-bold text-emerald-700">
                    {questionIndex + 1}
                  </div>
                  <h2 className={`text-xl font-bold text-emerald-950 ${rubik.className}`}>
                    Spørgsmål
                  </h2>
                </div>

                <input
                  value={question.text}
                  onChange={(event) =>
                    updateQuestion(question.id, { text: event.target.value })
                  }
                  placeholder="Skriv spørgsmålet her..."
                  className={inputClass}
                />

                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold tracking-widest text-emerald-800 uppercase">
                    Post-type
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateQuestion(question.id, "type", "multiple_choice")}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        question.type === "multiple_choice"
                          ? "border-emerald-300 bg-emerald-600 text-white shadow-md"
                          : "border-emerald-100 bg-white/60 text-emerald-900 hover:border-emerald-300 hover:bg-white"
                      }`}
                    >
                      Multiple Choice
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQuestion(question.id, "type", "ai_image")}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        question.type === "ai_image"
                          ? "border-emerald-300 bg-emerald-600 text-white shadow-md"
                          : "border-emerald-100 bg-white/60 text-emerald-900 hover:border-emerald-300 hover:bg-white"
                      }`}
                    >
                      ✨ AI Fotomission
                    </button>
                  </div>
                </div>

                <div className="mt-3 mb-4 flex flex-col gap-3 rounded-xl border border-emerald-100 bg-white/65 p-3 transition-all focus-within:border-emerald-300 focus-within:ring-1 focus-within:ring-emerald-300">
                  {question.mediaUrl && question.mediaUrl.startsWith("http") && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative mx-auto aspect-video w-full max-w-[300px] overflow-hidden rounded-xl border border-emerald-100 bg-white/80 shadow-2xl"
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
                        className="absolute top-2 right-2 rounded-full bg-emerald-900/70 p-1.5 text-white transition-all hover:bg-emerald-900"
                      >
                        ✕
                      </button>
                    </motion.div>
                  )}

                  <div className="flex items-center gap-3 p-1 transition-all">
                    <div className="flex gap-2 pl-2 text-emerald-500">
                      <ImageIcon size={16} />
                      <Youtube size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="Indsæt link til billede eller YouTube-video (valgfrit)..."
                      value={question.mediaUrl || ""}
                      onChange={(e) => updateQuestion(question.id, "mediaUrl", e.target.value)}
                      className="flex-1 bg-transparent text-sm text-emerald-900 placeholder:text-emerald-700/50 focus:ring-0 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleGenerateAIImage(question.id, question.text)}
                      disabled={generatingImages[question.id] || !question.text}
                      className="ml-auto flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs font-bold uppercase tracking-wider text-emerald-700 transition-all hover:bg-emerald-100 disabled:opacity-50 disabled:hover:bg-emerald-50"
                    >
                      {generatingImages[question.id] ? (
                        <span className="animate-pulse">Tænker... ✨</span>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          Generér billede til: &quot;
                          {truncateText(question.text || "dette spørgsmål", 35)}
                          &quot;
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {question.type === "ai_image" ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-white/70 p-4">
                    <label className="mb-2 block text-sm font-bold text-emerald-950">
                      Instruks til AI-dommeren 🤖📸
                    </label>
                    <textarea
                      value={question.aiPrompt}
                      onChange={(event) =>
                        updateQuestion(question.id, { aiPrompt: event.target.value })
                      }
                      rows={4}
                      placeholder="Hvad skal deltagerne tage billede af? F.eks. 'Find et egetræ' eller 'Tag et billede af noget rundt og blåt'. AI'en vil godkende billedet automatisk ud fra dette."
                      className="w-full rounded-xl border border-emerald-100 bg-white/50 px-4 py-3 text-sm text-emerald-950 placeholder:text-emerald-800/50 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                    <p className="mt-2 text-xs text-emerald-700">
                      Skriv en tydelig dommer-instruks, så AI&apos;en kan vurdere deltagerens foto præcist.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {question.answers.map((answer, answerIndex) => (
                      <label
                        key={`${question.id}-${answerIndex}`}
                        className="flex items-center gap-3"
                      >
                        <input
                          type="radio"
                          checked={question.correctIndex === answerIndex}
                          onChange={() =>
                            updateQuestion(question.id, { correctIndex: answerIndex })
                          }
                          className="h-4 w-4 accent-emerald-600"
                        />
                        <input
                          value={answer}
                          onChange={(event) =>
                            updateAnswer(question.id, answerIndex, event.target.value)
                          }
                          placeholder={`Svar ${answerIndex + 1}`}
                          className={inputClass}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => assignPinFromCenter(question.id)}
                  className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition hover:bg-emerald-700"
                >
                  HENT PIN FRA KORT (Sigt og klik)
                </button>

                {question.lat !== null && question.lng !== null ? (
                  <p className="mt-3 text-xs text-emerald-700">
                    Pin gemt: {question.lat.toFixed(5)}, {question.lng.toFixed(5)}
                  </p>
                ) : null}
              </div>
            ))}

            <button
              type="button"
              onClick={addQuestion}
              className="mb-6 rounded-xl border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              Tilføj Nyt Spørgsmål
            </button>

            <button
              type="button"
              onClick={handleSaveRun}
              disabled={isSaving}
              className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-extrabold uppercase tracking-wider text-white shadow-md transition hover:bg-emerald-700"
            >
              {isSaving ? "GEMMER..." : "GEM LØB I ARKIVET"}
            </button>
          </div>
        </section>

        <aside className="h-[40vh] w-full p-4 lg:h-full lg:w-1/2 lg:p-6">
          <div className="h-full w-full overflow-hidden rounded-3xl border-4 border-white/80 shadow-2xl">
            <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
          </div>
        </aside>
      </div>

      {showAIModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f1a3d]/95 p-6 backdrop-blur-xl">
            <h3 className={`text-2xl font-extrabold text-cyan-100 ${rubik.className}`}>
              AI Settings
            </h3>
            <p className="mt-1 text-sm text-white/65">
              Vælg fag, emne og niveau for AI-generering.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/50">
                  AI Fag
                </label>
                <select
                  value={aiSubject}
                  onChange={(e) => {
                    setAiSubject(e.target.value);
                    setAiTopic("");
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="">Vælg fag...</option>
                  {Object.keys(SUBJECT_TOPICS).map((subj) => (
                    <option key={subj} value={subj} className="bg-[#0a1128]">
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/50">
                  AI Emne
                </label>
                <select
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  disabled={!aiSubject}
                >
                  <option value="">Vælg emne...</option>
                  {(aiSubject ? SUBJECT_TOPICS[aiSubject] : []).map((topicValue) => (
                    <option key={topicValue} value={topicValue} className="bg-[#0a1128]">
                      {topicValue}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/50">
                  Niveau
                </label>
                <select
                  value={aiGrade}
                  onChange={(e) => setAiGrade(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option>Mellemtrin (4.-6. trin)</option>
                  <option>Indskoling (0.-3. trin)</option>
                  <option>Udskoling (7.-9. trin)</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/50">
                  Antal spørgsmål
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/50">
                  Ekstra prompt
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="Fx fokus på samarbejde og bevægelse"
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAIModal(false)}
                className="rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-black/35"
              >
                Luk
              </button>
              <button
                type="button"
                onClick={handleAIGenerate}
                disabled={isGenerating}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-bold text-white shadow-[0_0_16px_rgba(34,211,238,0.45)] transition hover:brightness-110"
              >
                {isGenerating ? "Genererer..." : "Generer spørgsmål"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
