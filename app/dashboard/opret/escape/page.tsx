"use client";

import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { SavedPin } from "@/components/MapPicker";
import { createClient } from "@/utils/supabase/client";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-3xl border border-amber-500/20 bg-amber-950/50" />
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
  type: "multiple_choice";
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

type GeneratedEscapeQuestion = {
  text?: string;
  answers?: string[];
  correctIndex?: number;
};

const textInputClass =
  "w-full rounded-2xl border border-amber-500/20 bg-amber-950/50 px-4 py-3 text-amber-100 placeholder:text-amber-100/35 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500";

const textareaClass =
  "w-full rounded-2xl border border-amber-500/20 bg-amber-950/50 px-4 py-3 text-amber-100 placeholder:text-amber-100/35 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500";

const previewInputClass =
  "w-full rounded-2xl border border-amber-500/20 bg-amber-950/50 px-4 py-3 text-amber-100 placeholder:text-amber-100/35 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500";

const BLANK_ANSWERS: [string, string, string, string] = ["", "", "", ""];

const createQuestion = (): Question => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  type: "multiple_choice",
  text: "",
  aiPrompt: "",
  mediaUrl: "",
  answers: BLANK_ANSWERS,
  correctIndex: 0,
  lat: null,
  lng: null,
});

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
    return { riddle: "", codeBrick: fallbackCodeBrick(index) };
  }

  const parts = trimmedText.split(/\|\|\s*KODE-?BRIK:\s*/i);
  if (parts.length >= 2) {
    const riddle = parts[0]?.trim() ?? "";
    const codeBrick = parts.slice(1).join(" || ").trim() || fallbackCodeBrick(index);
    return { riddle, codeBrick };
  }

  return {
    riddle: trimmedText,
    codeBrick: fallbackCodeBrick(index),
  };
}

export default function EscapeBuilderPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [masterCode, setMasterCode] = useState("");
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
  const [questions, setQuestions] = useState<Question[]>([createQuestion()]);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [mapCenter, setMapCenter] = useState<MapCenter>({
    lat: 55.6761,
    lng: 12.5683,
  });

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
    setShowAIModal(false);
    setPreviewQuestions([]);
    setShowAITeacherFields(false);
  };

  const handleApproveAIPreview = () => {
    if (previewQuestions.length === 0) return;

    const timestamp = Date.now();
    const approvedQuestions = previewQuestions.map((question, index) => ({
      ...question,
      id: timestamp + index,
      type: "multiple_choice" as const,
      text: question.text.trim(),
      aiPrompt: question.aiPrompt.trim(),
      answers: toEscapeAnswers(question.answers[0]?.trim() ?? ""),
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
    setPreviewQuestions([]);
  };

  const handleAIGenerate = async () => {
    const normalizedBrief = aiRunBrief.trim();
    const normalizedSubject = aiSubject.trim() || subject.trim() || "Generelt";
    const normalizedGrade = aiGrade.trim() || "Ikke angivet";
    const requestedCount = extractRequestedCount(normalizedBrief);

    if (!normalizedBrief) {
      alert("Skriv først, hvor I er, og hvad AI'en skal lave gåder om.");
      return;
    }

    const pedagogicalContext =
      `Du er en escape room-designer for udendørs GPS-løb. Generer ${requestedCount} logiske gåder om ${normalizedBrief} til niveauet ${normalizedGrade} i faget ${normalizedSubject}. ` +
      `Hver post skal have ét entydigt rigtigt svar. Returnér stadig præcis 4 svarmuligheder i "answers", hvor det rigtige svar er markeret med "correctIndex". ` +
      `I feltet "text" skal du skrive selve gåden efterfulgt af " || KODEBRIK: " og derefter en kort belønningsbesked, som giver deltagerne en kode-brik. ` +
      `Eksempel på text-format: "Hvor mange skydeskår er der i tårnet? Gang tallet med 2. || KODEBRIK: Du har fundet første tal i koden: 7!" ` +
      `De forkerte svar skal være plausible, men vi bruger kun det rigtige svar og kode-brikken i builderen. Hele indholdet skal være på dansk.`;

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
          pedagogicalContext,
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
              const { riddle, codeBrick } = parseEscapeText(question.text ?? "", index);

              if (!riddle || !solution) return null;

              return {
                id: Date.now() + index,
                type: "multiple_choice",
                text: riddle,
                aiPrompt: codeBrick,
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
        alert("AI returnerede ingen brugbare gåder. Prøv igen.");
        return;
      }

      setPreviewQuestions(formattedQuestions);
    } catch (error) {
      console.error("AI-generering af escape-gåder fejlede:", error);
      alert("Der skete en fejl. Prøv igen.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRun = async () => {
    if (!title.trim()) {
      alert("Udfyld venligst løbets titel.");
      return;
    }

    const normalizedQuestions = questions
      .map((question) => ({
        ...question,
        type: "multiple_choice" as const,
        text: question.text.trim(),
        aiPrompt: question.aiPrompt.trim(),
        answers: toEscapeAnswers(question.answers[0]?.trim() ?? ""),
        correctIndex: 0,
        mediaUrl: "",
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
      alert("Tilføj mindst én udfyldt post.");
      return;
    }

    const hasIncompleteQuestions = normalizedQuestions.some(
      (question) => !question.text || !question.answers[0] || !question.aiPrompt
    );
    if (hasIncompleteQuestions) {
      alert("Udfyld både gåde, løsen og kode-brik på hver post.");
      return;
    }

    const hasAtLeastOnePin = normalizedQuestions.some(
      (question) => question.lat !== null && question.lng !== null
    );
    if (!hasAtLeastOnePin) {
      alert("Du mangler at sætte pins på kortet. Mindst én post skal have koordinater.");
      return;
    }

    const normalizedMasterCode = normalizeMasterCode(masterCode);
    if (!normalizedMasterCode) {
      alert("Udfyld master-koden til finalen.");
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
        description: JSON.stringify({ masterCode: normalizedMasterCode }),
        topic: aiRunBrief.trim() || aiTopic || "",
        questions: normalizedQuestions,
      });

      if (error) {
        throw error;
      }

      alert("Escape room-løbet er gemt i arkivet!");

      setTitle("");
      setMasterCode("");
      setSubject("");
      setShowTeacherField(false);
      setQuestions([createQuestion()]);
      setAiRunBrief("");
      setAiTopic("");

      router.push("/dashboard/arkiv");
    } catch (error) {
      console.error("Fejl ved gemning af escape room-løb:", error);
      alert("Kunne ikke gemme løbet. Prøv igen.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className={`relative min-h-screen overflow-hidden bg-amber-950 text-amber-100 ${poppins.className}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.28),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(253,230,138,0.12),_transparent_28%)]" />
        <div className="relative flex min-h-screen flex-col lg:flex-row">
          <section className="w-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:w-[52%] lg:px-8 lg:py-8">
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="px-1 pt-1">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                  Løbets titel
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="F.eks. Koden ved Gåsetårnet"
                  className={textInputClass}
                />
                <p className="mt-3 text-sm leading-relaxed text-amber-100/75">
                  Kort fortalt: Skriv en gåde. Når deltagerne indtaster det rigtige svar, får de
                  udleveret en hemmelig kode-brik.
                </p>
              </div>

              <div className="rounded-[2rem] border border-amber-500/20 bg-amber-950/50 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                  Master-kode til finalen
                </label>
                <input
                  value={masterCode}
                  onChange={(event) => setMasterCode(normalizeMasterCode(event.target.value))}
                  placeholder="fx SKOV42"
                  className={textInputClass}
                  maxLength={12}
                />
                <p className="mt-3 text-sm leading-relaxed text-amber-100/75">
                  Denne kode gemmes i løbets metadata og er den samlede kode, holdene skal taste
                  ind i master-låsen til sidst.
                </p>
              </div>

              <div className="space-y-4 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAIModal(true);
                    setPreviewQuestions([]);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-amber-500/20 bg-amber-950/50 px-5 py-3 text-sm font-semibold text-amber-100 shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition hover:border-amber-300/35 hover:bg-amber-900/60 sm:w-auto"
                >
                  <span aria-hidden>✨</span>
                  Auto-udfyld gåder med AI
                </button>

                <div className="flex items-end justify-between gap-4">
                  <p className="text-xs font-semibold tracking-[0.24em] text-amber-100/65 uppercase">
                    Dine poster
                  </p>
                  <span className="rounded-full border border-amber-500/20 bg-amber-950/45 px-4 py-2 text-sm font-semibold text-amber-100/80 backdrop-blur-xl">
                    {questions.length}
                  </span>
                </div>
              </div>

              {questions.map((question, index) => (
                <article
                  key={question.id}
                  className="rounded-[2rem] border border-amber-500/20 bg-amber-950/50 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/20 bg-amber-950/50 text-sm font-bold text-amber-100">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold text-amber-100 ${rubik.className}`}>
                          Post {index + 1}
                        </h3>
                        <p className="text-xs text-amber-100/65">
                          {question.lat !== null && question.lng !== null
                            ? "Pin er valgt på kortet"
                            : "Ingen pin valgt endnu"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-amber-500/20 bg-amber-950/45 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-amber-100/75 uppercase backdrop-blur-xl">
                      Escape room
                    </span>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Gåden / Opgaven
                    </label>
                    <textarea
                      value={question.text}
                      onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                      rows={4}
                      placeholder="fx Hvor mange skydeskår er der i tårnet? Gang tallet med 2..."
                      className={textareaClass}
                    />
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Det rigtige svar (Løsen)
                    </label>
                    <input
                      value={question.answers[0]}
                      onChange={(event) => updateSolution(question.id, event.target.value)}
                      placeholder="fx 14"
                      className={textInputClass}
                    />
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Kode-brik (Belønning)
                    </label>
                    <input
                      value={question.aiPrompt}
                      onChange={(event) =>
                        updateQuestion(question.id, { aiPrompt: event.target.value })
                      }
                      placeholder="fx Du har fundet første tal i koden: 7!"
                      className={textInputClass}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => assignPinFromCenter(question.id)}
                    className="mt-5 w-full rounded-[1.4rem] border border-amber-400/30 bg-amber-500/22 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-amber-100 shadow-[0_12px_32px_rgba(245,158,11,0.18)] transition hover:bg-amber-500/30"
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

              <div className="rounded-[2rem] border border-amber-500/20 bg-amber-950/50 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-2 rounded-[1.4rem] border border-amber-500/20 bg-amber-950/50 px-4 py-3 text-sm font-semibold text-amber-100 backdrop-blur-xl transition hover:bg-amber-900/60"
                >
                  <Plus className="h-4 w-4" />
                  Tilføj ny post
                </button>

                <button
                  type="button"
                  onClick={() => setShowTeacherField((current) => !current)}
                  className="mt-5 inline-flex items-center gap-2 text-sm text-amber-100/70 transition hover:text-amber-100"
                >
                  {showTeacherField ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {showTeacherField ? "Skjul fag (valgfrit)" : "Tilføj fag (valgfrit)"}
                </button>

                {showTeacherField ? (
                  <div className="mt-4 rounded-[1.5rem] border border-amber-500/20 bg-amber-950/50 p-4 backdrop-blur-xl">
                    <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                      Fag
                    </label>
                    <select
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-amber-500/20 bg-amber-950/50 p-3 text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="" className="bg-slate-900 text-white">
                        Vælg et fag...
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

                <button
                  type="button"
                  onClick={handleSaveRun}
                  disabled={isSaving}
                  className="mt-6 w-full rounded-[1.6rem] border border-amber-400/30 bg-amber-500/22 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-amber-100 shadow-[0_14px_34px_rgba(245,158,11,0.18)] transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Gemmer..." : "Gem løb i arkivet"}
                </button>
              </div>
            </div>
          </section>

          <aside className="h-[42vh] w-full p-4 pt-0 sm:px-6 lg:h-auto lg:w-[48%] lg:p-8 lg:pl-0">
            <div className="h-full min-h-[320px] w-full overflow-hidden rounded-[2rem] border border-amber-500/20 bg-amber-950/50 shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_0_36px_rgba(245,158,11,0.08),0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
              <MapPicker center={mapCenter} pins={pins} onCenterChange={setMapCenter} />
            </div>
          </aside>
        </div>
      </div>

      {showAIModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-amber-950/70 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl rounded-[2rem] border border-amber-500/20 bg-amber-950/90 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.28em] text-amber-100/55 uppercase">
                  AI-modal
                </p>
                <h2
                  className={`mt-3 flex items-center gap-2 text-3xl font-extrabold text-amber-100 ${rubik.className}`}
                >
                  <span aria-hidden>✨</span>
                  Intelligent escape-assistent
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-amber-100/75">
                  Beskriv stedet kort, så kan AI&apos;en foreslå gåder med ét løsen og en kode-brik
                  til hver post.
                </p>
              </div>
            </div>

            {previewQuestions.length > 0 ? (
              <div className="mt-8">
                <p className="mb-4 text-sm text-amber-100/75">
                  Gennemgå posterne og ret dem til, før de overføres til kortet.
                </p>

                <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                  {previewQuestions.map((question, index) => (
                    <div
                      key={question.id}
                      className="rounded-[1.6rem] border border-amber-500/20 bg-amber-950/50 p-4 backdrop-blur-xl"
                    >
                      <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-amber-100/65 uppercase">
                        Post {index + 1}
                      </p>

                      <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                        Gåden / Opgaven
                      </label>
                      <textarea
                        value={question.text}
                        onChange={(event) =>
                          updatePreviewQuestion(question.id, { text: event.target.value })
                        }
                        rows={3}
                        className={previewInputClass}
                      />

                      <label className="mt-4 mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                        Det rigtige svar (Løsen)
                      </label>
                      <input
                        type="text"
                        value={question.answers[0]}
                        onChange={(event) => updatePreviewSolution(question.id, event.target.value)}
                        className={previewInputClass}
                      />

                      <label className="mt-4 mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                        Kode-brik (Belønning)
                      </label>
                      <input
                        type="text"
                        value={question.aiPrompt}
                        onChange={(event) =>
                          updatePreviewQuestion(question.id, { aiPrompt: event.target.value })
                        }
                        className={previewInputClass}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleApproveAIPreview}
                    className="w-full rounded-[1.4rem] border border-amber-400/30 bg-amber-500/22 py-3 font-bold text-amber-100 transition hover:bg-amber-500/30"
                  >
                    Godkend og placer på kortet
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardAIPreview}
                    className="w-full rounded-[1.4rem] border border-amber-500/20 bg-amber-950/45 py-3 font-semibold text-amber-100/80 transition hover:bg-amber-900/55"
                  >
                    Kassér og prøv igen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <label className="mb-3 block text-sm font-semibold text-white">
                    Hvor er I, og hvor mange gåder skal AI&apos;en lave? (F.eks: Lav 5 logiske
                    gåder omkring Gåsetårnet, hvor svarene giver tal til en hængelås...)
                  </label>
                  <textarea
                    value={aiRunBrief}
                    onChange={(event) => setAiRunBrief(event.target.value)}
                    rows={8}
                    placeholder="Hvor er I, og hvor mange gåder skal AI'en lave? (F.eks: Lav 5 logiske gåder omkring Gåsetårnet, hvor svarene giver tal til en hængelås...)"
                    className="w-full rounded-[1.6rem] border border-amber-500/20 bg-amber-950/50 p-5 text-amber-100 placeholder:text-amber-100/35 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAITeacherFields((current) => !current)}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-amber-100/70 transition hover:text-amber-100"
                >
                  {showAITeacherFields ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Er du lærer? Tilpas fag og niveau
                </button>

                {showAITeacherFields ? (
                  <section className="mt-4 rounded-[1.6rem] border border-amber-500/20 bg-amber-950/50 p-4 backdrop-blur-xl">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                          Fag
                        </label>
                        <select
                          value={aiSubject}
                          onChange={(event) => setAiSubject(event.target.value)}
                          className="w-full rounded-2xl border border-amber-500/20 bg-amber-950/50 p-3 text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                        <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-amber-100/65 uppercase">
                          Klassetrin
                        </label>
                        <select
                          value={aiGrade}
                          onChange={(event) => setAiGrade(event.target.value)}
                          className="w-full rounded-2xl border border-amber-500/20 bg-amber-950/50 p-3 text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                    className="rounded-[1.4rem] border border-amber-500/20 bg-amber-950/45 px-5 py-3 text-sm font-semibold text-amber-100/80 transition hover:bg-amber-900/55 disabled:opacity-60"
                  >
                    Luk
                  </button>
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="w-full rounded-[1.4rem] border border-amber-400/30 bg-amber-500/22 px-6 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Tænker...
                      </span>
                    ) : (
                      "Generer gåder"
                    )}
                  </button>
                </div>

                {isGenerating ? (
                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-amber-100/75">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300" />
                    AI&apos;en skriver logiske gåder...
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
