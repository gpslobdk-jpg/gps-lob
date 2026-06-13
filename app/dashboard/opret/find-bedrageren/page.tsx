"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  UserSearch,
} from "lucide-react";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const SUBJECT_OPTIONS = [
  "Generelt",
  "Dansk",
  "Tysk",
  "Engelsk",
  "Historie",
  "Samfundsfag",
  "Naturfag",
  "Matematik",
] as const;

const GRADE_LEVEL_OPTIONS = [
  "3.-4. klasse",
  "5.-6. klasse",
  "7.-9. klasse",
  "Gymnasium",
  "Voksne",
] as const;

const SECRET_WORD_IDEAS = ["Demokrati", "Vulkan", "Procent", "Viking", "Fotosyntese", "Eventyr"] as const;

const WIZARD_STEPS = [
  {
    id: 1,
    title: "Indhold",
    heading: "Hvad skal spillet handle om?",
    help: "Giv spillet et navn og en faglig ramme.",
  },
  {
    id: 2,
    title: "Hemmeligt ord",
    heading: "Vælg det hemmelige ord",
    help: "De civile får ordet. Bedrageren gør ikke.",
  },
  {
    id: 3,
    title: "Bedragere",
    heading: "Hvor mange bedragere skal der være?",
    help: "Start typisk med 1 bedrager. Brug flere, hvis klassen er stor.",
  },
  {
    id: 4,
    title: "Gennemse",
    heading: "Gennemse og opret",
    help: "Tjek de vigtigste valg, før du opretter spillet.",
  },
] as const;

const GAME_FLOW_SUMMARY = [
  "Eleverne joiner",
  "Læreren fordeler roller",
  "Eleverne ser deres rolle",
  "Klassen diskuterer",
] as const;

const AI_UNAVAILABLE_MESSAGE = "AI-forslag er ikke tilgængelige lige nu. Du kan stadig oprette spillet manuelt.";

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

type Notice = {
  tone: "success" | "error";
  message: string;
};

type CreateFindBedragerenResponse = {
  runId?: string;
  error?: string;
};

type CreateFindBedragerenSessionResponse = {
  session?: {
    id?: string;
    pin?: string | null;
    status?: string | null;
  } | null;
  error?: string;
};

type FindBedragerenSuggestion = {
  title: string;
  category: (typeof SUBJECT_OPTIONS)[number];
  secretWord: string;
  teacherNote: string;
  alternatives: string[];
  error?: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-600 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const labelClass = "text-sm font-black text-slate-900";
const helpTextClass = "mt-2 text-sm font-semibold leading-6 text-slate-500";
const primaryButtonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-violet-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none";
const secondaryButtonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 shadow-sm transition hover:border-violet-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-55";

export default function FindBedragerenBuilderPage() {
  return (
    <Suspense fallback={<FindBedragerenLoading />}>
      <FindBedragerenBuilderContent />
    </Suspense>
  );
}

function FindBedragerenLoading() {
  return (
    <main className={`min-h-screen bg-[#f4f6f8] px-6 py-10 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-xl">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-violet-700" />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            Åbner Find Bedrageren...
          </p>
        </div>
      </div>
    </main>
  );
}

function FindBedragerenBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";

  const [currentStep, setCurrentStep] = useState<WizardStepId>(1);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<(typeof SUBJECT_OPTIONS)[number]>("Generelt");
  const [secretWord, setSecretWord] = useState("");
  const [impostorCount, setImpostorCount] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isStartingLobby, setIsStartingLobby] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [createdRunId, setCreatedRunId] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState("");
  const [suggestTopic, setSuggestTopic] = useState("");
  const [suggestGradeLevel, setSuggestGradeLevel] = useState<(typeof GRADE_LEVEL_OPTIONS)[number]>("5.-6. klasse");
  const [suggestExtraWish, setSuggestExtraWish] = useState("");
  const [suggestion, setSuggestion] = useState<FindBedragerenSuggestion | null>(null);
  const [suggestionError, setSuggestionError] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);

  const isEditMode = editRunId.length > 0;
  const activeStep = WIZARD_STEPS[currentStep - 1];
  const hasTitle = title.trim().length > 0;
  const hasSecretWord = secretWord.trim().length > 0;
  const hasValidImpostorCount = Number.isInteger(impostorCount) && impostorCount >= 1 && impostorCount <= 50;

  const canSubmit = useMemo(
    () => title.trim().length > 0 && secretWord.trim().length > 0 && hasValidImpostorCount,
    [hasValidImpostorCount, secretWord, title]
  );
  const canRequestSuggestion = suggestTopic.trim().length > 0;

  const validateStep = (step: WizardStepId) => {
    if (step === 1 && !hasTitle) {
      return "Skriv en titel for at gå videre.";
    }

    if (step === 2 && !hasSecretWord) {
      return "Skriv eller vælg et hemmeligt ord.";
    }

    if (step === 3 && !hasValidImpostorCount) {
      return "Vælg mindst 1 og højst 50 bedragere.";
    }

    if (step === 4 && !canSubmit) {
      return "Udfyld titel, hemmeligt ord og antal bedragere.";
    }

    return "";
  };

  const currentStepRequirement = validateStep(currentStep);
  const canContinue = currentStepRequirement.length === 0;

  const isStepComplete = (step: WizardStepId) => {
    if (step === 1) {
      return hasTitle;
    }

    if (step === 2) {
      return hasSecretWord;
    }

    if (step === 3) {
      return hasValidImpostorCount;
    }

    return canSubmit;
  };

  const goToNextStep = () => {
    const stepError = validateStep(currentStep);

    if (stepError) {
      setNotice({ tone: "error", message: stepError });
      return;
    }

    setNotice(null);
    setCurrentStep((step) => Math.min(WIZARD_STEPS.length, step + 1) as WizardStepId);
  };

  const goToPreviousStep = () => {
    setNotice(null);
    setCurrentStep((step) => Math.max(1, step - 1) as WizardStepId);
  };

  const handleSuggestContent = async () => {
    const topic = suggestTopic.trim();

    if (!topic) {
      setSuggestionError("Skriv et fag eller emne først.");
      return;
    }

    setIsSuggesting(true);
    setSuggestionError("");
    setSuggestion(null);

    try {
      const response = await fetch("/api/find-bedrageren/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          gradeLevel: suggestGradeLevel,
          extraWish: suggestExtraWish.trim(),
        }),
      });

      const body = (await response.json()) as FindBedragerenSuggestion;

      if (!response.ok || !body.title || !body.secretWord) {
        throw new Error(body.error || AI_UNAVAILABLE_MESSAGE);
      }

      setSuggestion(body);
    } catch (error) {
      setSuggestionError(error instanceof Error ? error.message : AI_UNAVAILABLE_MESSAGE);
    } finally {
      setIsSuggesting(false);
    }
  };

  const applySuggestion = (nextSuggestion: FindBedragerenSuggestion) => {
    setTitle(nextSuggestion.title);
    setSubject(nextSuggestion.category);
    setSecretWord(nextSuggestion.secretWord);
    setNotice(null);
    setSuggestionError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (currentStep !== 4) {
      goToNextStep();
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedSecretWord = secretWord.trim();

    if (!trimmedTitle) {
      setNotice({ tone: "error", message: "Giv aktiviteten en titel." });
      return;
    }

    if (!trimmedSecretWord) {
      setNotice({ tone: "error", message: "Skriv det hemmelige ord." });
      return;
    }

    if (!Number.isInteger(impostorCount) || impostorCount < 1 || impostorCount > 50) {
      setNotice({ tone: "error", message: "Vælg mindst 1 og højst 50 bedragere." });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/find-bedrageren/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: trimmedTitle,
          subject,
          secretWord: trimmedSecretWord,
          impostorCount,
        }),
      });

      const body = (await response.json()) as CreateFindBedragerenResponse;

      if (!response.ok || !body.runId) {
        throw new Error(body.error || "Kunne ikke gemme aktiviteten.");
      }

      setCreatedRunId(body.runId);
      setCreatedTitle(trimmedTitle);
      setTitle("");
      setSecretWord("");
      setImpostorCount(1);
      setSubject("Generelt");
      setSuggestion(null);
      setSuggestionError("");
      setCurrentStep(1);
      setNotice({ tone: "success", message: "Spillet er oprettet." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Kunne ikke gemme aktiviteten.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartLobby = async () => {
    if (!createdRunId) {
      setNotice({ tone: "error", message: "Aktiviteten mangler." });
      return;
    }

    setIsStartingLobby(true);
    setNotice(null);

    try {
      const response = await fetch("/api/find-bedrageren/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ runId: createdRunId }),
      });

      const body = (await response.json()) as CreateFindBedragerenSessionResponse;
      const sessionId = body.session?.id?.trim() ?? "";

      if (!response.ok || !sessionId) {
        throw new Error(body.error || "Kunne ikke åbne lobbyen.");
      }

      router.push(`/dashboard/live/${sessionId}/find-bedrageren`);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Kunne ikke åbne lobbyen.",
      });
      setIsStartingLobby(false);
    }
  };

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="max-w-4xl">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
            <div>
              <label htmlFor="find-bedrageren-title" className={labelClass}>
                Titel
              </label>
              <input
                id="find-bedrageren-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSaving}
                maxLength={120}
                className={`${inputClass} mt-2`}
                placeholder="Fx Hvem kender ordet?"
              />
              <p className={helpTextClass}>Giv spillet et navn, som eleverne kan genkende.</p>
            </div>

            <div>
              <label htmlFor="find-bedrageren-subject" className={labelClass}>
                Kategori eller fag
              </label>
              <select
                id="find-bedrageren-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value as (typeof SUBJECT_OPTIONS)[number])}
                disabled={isSaving}
                className={`${inputClass} mt-2`}
              >
                {SUBJECT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <p className={helpTextClass}>Vælg en enkel faglig ramme.</p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section>
            <label htmlFor="find-bedrageren-secret-word" className={labelClass}>
              Hemmeligt ord
            </label>
            <input
              id="find-bedrageren-secret-word"
              value={secretWord}
              onChange={(event) => setSecretWord(event.target.value)}
              disabled={isSaving}
              maxLength={120}
              className={`${inputClass} mt-2`}
              placeholder="Fx demokrati, vulkan eller procent"
            />
            <p className={helpTextClass}>Vælg et ord, der kan give gode hints uden at afsløre alt for hurtigt.</p>

            <div className="mt-7">
              <p className="text-sm font-black text-slate-900">Statiske forslag</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SECRET_WORD_IDEAS.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => setSecretWord(word)}
                    disabled={isSaving}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:border-amber-400 hover:bg-amber-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className={`text-xl font-black text-slate-950 ${rubik.className}`}>Få forslag med AI</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Få en titel, kategori og et ord.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="find-bedrageren-ai-topic" className={labelClass}>
                  Fag eller emne
                </label>
                <input
                  id="find-bedrageren-ai-topic"
                  value={suggestTopic}
                  onChange={(event) => setSuggestTopic(event.target.value)}
                  disabled={isSuggesting}
                  maxLength={120}
                  className={`${inputClass} mt-2`}
                  placeholder="Fx vulkaner eller brøker"
                />
              </div>

              <div>
                <label htmlFor="find-bedrageren-ai-grade" className={labelClass}>
                  Klassetrin
                </label>
                <select
                  id="find-bedrageren-ai-grade"
                  value={suggestGradeLevel}
                  onChange={(event) => setSuggestGradeLevel(event.target.value as (typeof GRADE_LEVEL_OPTIONS)[number])}
                  disabled={isSuggesting}
                  className={`${inputClass} mt-2`}
                >
                  {GRADE_LEVEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="find-bedrageren-ai-extra" className={labelClass}>
                  Ekstra ønske
                </label>
                <textarea
                  id="find-bedrageren-ai-extra"
                  value={suggestExtraWish}
                  onChange={(event) => setSuggestExtraWish(event.target.value)}
                  disabled={isSuggesting}
                  maxLength={220}
                  rows={3}
                  className={`${inputClass} mt-2 resize-none`}
                  placeholder="Fx let at forklare på 5 minutter"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleSuggestContent()}
                disabled={isSuggesting || !canRequestSuggestion}
                className={`${primaryButtonClass} w-full`}
              >
                {isSuggesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {isSuggesting ? "Finder forslag..." : "Foreslå indhold"}
              </button>

              {!canRequestSuggestion ? (
                <p className="text-sm font-semibold leading-6 text-slate-500">Skriv et fag eller emne for at bruge AI.</p>
              ) : null}

              {suggestionError ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
                  {suggestionError}
                </p>
              ) : null}

              {suggestion ? (
                <div className="rounded-lg border border-violet-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Forslag</p>
                  <h4 className={`mt-2 text-xl font-black text-slate-950 ${rubik.className}`}>{suggestion.title}</h4>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Hemmeligt ord</p>
                      <p className="mt-1 text-base font-black text-slate-950">{suggestion.secretWord}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Kategori</p>
                      <p className="mt-1 text-base font-black text-slate-950">{suggestion.category}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{suggestion.teacherNote}</p>

                  {suggestion.alternatives.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Flere ord</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestion.alternatives.map((word) => (
                          <button
                            key={word}
                            type="button"
                            onClick={() => setSecretWord(word)}
                            className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-black text-violet-800 transition hover:border-violet-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100"
                          >
                            {word}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => applySuggestion(suggestion)}
                    className={`${primaryButtonClass} mt-4 w-full bg-violet-700 hover:bg-violet-800`}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Brug dette forslag
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="max-w-2xl">
          <label htmlFor="find-bedrageren-impostor-count" className={labelClass}>
            Antal bedragere
          </label>
          <input
            id="find-bedrageren-impostor-count"
            type="number"
            min={1}
            max={50}
            step={1}
            value={impostorCount}
            onChange={(event) => setImpostorCount(Number(event.target.value))}
            disabled={isSaving}
            className={`${inputClass} mt-2 max-w-xs`}
          />
          <p className={helpTextClass}>Start typisk med 1 bedrager. Brug flere, hvis klassen er stor.</p>

          <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setImpostorCount(count)}
                disabled={isSaving}
                aria-pressed={impostorCount === count}
                className={`rounded-lg border px-4 py-4 text-left text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60 ${
                  impostorCount === count
                    ? "border-violet-500 bg-violet-50 text-violet-900"
                    : "border-slate-300 bg-white text-slate-800 hover:border-violet-300"
                }`}
              >
                {count} {count === 1 ? "bedrager" : "bedragere"}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <h3 className={`text-2xl font-black text-slate-950 ${rubik.className}`}>Opsummering</h3>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Titel</dt>
              <dd className="mt-2 text-base font-black text-slate-950">{title.trim() || "Mangler titel"}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Kategori</dt>
              <dd className="mt-2 text-base font-black text-slate-950">{subject}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Hemmeligt ord</dt>
              <dd className="mt-2 text-base font-black text-slate-950">{secretWord.trim() || "Mangler ord"}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Antal bedragere</dt>
              <dd className="mt-2 text-base font-black text-slate-950">{impostorCount}</dd>
            </div>
          </dl>
        </section>

        <section className="border-t border-slate-200 pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <h3 className={`text-2xl font-black text-slate-950 ${rubik.className}`}>Sådan foregår det</h3>
          <ol className="mt-5 space-y-3">
            {GAME_FLOW_SUMMARY.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
                  {index + 1}
                </span>
                <span className="text-sm font-bold text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
            Afstemning og resultatvisning bygges som næste spilfase.
          </p>
        </section>
      </div>
    );
  };

  if (isEditMode) {
    return (
      <main className={`min-h-screen bg-[#f4f6f8] px-6 py-8 text-slate-950 ${poppins.className}`}>
        <div className="mx-auto max-w-3xl">
          <Link href="/dashboard/arkiv" className={secondaryButtonClass}>
            <ArrowLeft className="h-4 w-4" />
            Tilbage til arkiv
          </Link>

          <section className="mt-10 rounded-lg border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <UserSearch className="h-6 w-6" />
              </div>
              <div>
                <h1 className={`text-3xl font-black text-slate-950 ${rubik.className}`}>
                  Redigering kommer senere
                </h1>
                <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-slate-600">
                  Find Bedrageren kan oprettes og startes nu. Redigering af eksisterende spil bygges i en senere fase.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (createdRunId) {
    return (
      <main className={`min-h-screen bg-[#f4f6f8] px-6 py-8 text-slate-950 ${poppins.className}`}>
        <div className="mx-auto max-w-3xl">
          <section className="overflow-hidden rounded-lg border border-emerald-200 bg-white shadow-xl">
            <div className="bg-slate-950 px-6 py-8 text-white sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-200">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-100">
                    Spillet er oprettet
                  </p>
                  <h1 className={`mt-2 text-3xl font-black text-white ${rubik.className}`}>{createdTitle}</h1>
                  <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-slate-200">
                    Start lobbyen, når klassen er klar. Så får eleverne en kode og kan joine fra deres egen side.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-7 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleStartLobby()}
                  disabled={isStartingLobby}
                  className={primaryButtonClass}
                >
                  {isStartingLobby ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserSearch className="h-5 w-5" />}
                  {isStartingLobby ? "Åbner lobby..." : "Start lobby"}
                </button>
                <Link href="/dashboard/arkiv" className={secondaryButtonClass}>
                  Gå til arkiv
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedRunId(null);
                    setCreatedTitle("");
                    setCurrentStep(1);
                    setNotice(null);
                  }}
                  disabled={isStartingLobby}
                  className={secondaryButtonClass}
                >
                  Opret endnu et spil
                </button>
              </div>

              {notice?.tone === "error" ? (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-800">
                  {notice.message}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen bg-[#f4f6f8] px-6 py-8 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard/opret/valg" className={secondaryButtonClass}>
            <ArrowLeft className="h-4 w-4" />
            Tilbage
          </Link>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Find Bedrageren</p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-700">Simpel opsætning</p>
            <h1 className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>Find Bedrageren</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Klar til hurtig opsætning i klassen.</p>

            <ol className="mt-6 space-y-3">
              {WIZARD_STEPS.map((step) => {
                const isActive = step.id === currentStep;
                const isComplete = step.id < currentStep && isStepComplete(step.id);

                return (
                  <li
                    key={step.id}
                    className={`rounded-lg border p-3 transition ${
                      isActive
                        ? "border-violet-300 bg-violet-50"
                        : isComplete
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                          isActive
                            ? "bg-violet-700 text-white"
                            : isComplete
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                      </span>
                      <div>
                        <p className="text-sm font-black text-slate-950">{step.title}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">Trin {step.id}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>

          <form onSubmit={handleSubmit} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-700">
                Trin {currentStep} af {WIZARD_STEPS.length}
              </p>
              <h2 className={`mt-2 text-3xl font-black text-slate-950 sm:text-4xl ${rubik.className}`}>
                {activeStep.heading}
              </h2>
              <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-slate-600">{activeStep.help}</p>
            </div>

            <div className="min-h-[440px] px-6 py-7 sm:px-8">{renderStepContent()}</div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 sm:px-8">
              {notice ? (
                <div
                  className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold leading-6 ${
                    notice.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {notice.message}
                </div>
              ) : null}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className={`text-sm font-bold leading-6 ${currentStepRequirement ? "text-amber-800" : "text-slate-500"}`}>
                  {currentStepRequirement || (currentStep === 4 ? "Klar til at oprette." : "Klar til næste trin.")}
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={goToPreviousStep}
                    disabled={currentStep === 1 || isSaving}
                    className={secondaryButtonClass}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Tilbage
                  </button>

                  {currentStep < 4 ? (
                    <button
                      type="button"
                      onClick={goToNextStep}
                      disabled={!canContinue || isSaving}
                      className={primaryButtonClass}
                    >
                      Næste
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button type="submit" disabled={isSaving || !canSubmit} className={primaryButtonClass}>
                      {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                      {isSaving ? "Opretter spil..." : "Opret spil"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
