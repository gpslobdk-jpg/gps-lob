"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
  KeyRound,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserSearch,
  Users,
  Vote,
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

const SUBJECT_OPTIONS = ["Generelt", "Dansk", "Tysk", "Engelsk", "Historie", "Samfundsfag", "Naturfag", "Matematik"] as const;
const GRADE_LEVEL_OPTIONS = [
  "3.-4. klasse",
  "5.-6. klasse",
  "7.-9. klasse",
  "Gymnasium",
  "Voksne",
] as const;
const GAME_CHIPS = ["Hemmeligt ord", "Private roller", "Klassehints", "Mundtlig debat"] as const;
const SECRET_WORD_IDEAS = ["Demokrati", "Vulkan", "Procent", "Viking", "Fotosyntese", "Eventyr"] as const;
const BUILDER_PROGRESS_STEPS = [
  {
    title: "Opret spillet",
    text: "Vælg titel, emne, hemmeligt ord og antal bedragere.",
    status: "Klar nu",
    icon: Sparkles,
  },
  {
    title: "Start lobbyen",
    text: "Når spillet er oprettet, åbner du lærerens live-side med klassens kode.",
    status: "Klar nu",
    icon: KeyRound,
  },
  {
    title: "Eleverne joiner med kode",
    text: "Eleverne går til Find Bedrageren-join og skriver navn og kode.",
    status: "Klar nu",
    icon: Users,
  },
  {
    title: "Fordel roller",
    text: "Systemet fordeler civile og bedragere, når alle er klar.",
    status: "Klar nu",
    icon: UserSearch,
  },
  {
    title: "Eleverne ser deres rolle",
    text: "Hver elev ser kun sin egen rolle. Civile ser ordet. Bedragere gør ikke.",
    status: "Klar nu",
    icon: ShieldCheck,
  },
  {
    title: "Klassen diskuterer",
    text: "I denne første version styrer læreren diskussionen mundtligt i klassen.",
    status: "Mundtligt nu",
    icon: MessageCircle,
  },
  {
    title: "Klassen stemmer",
    text: "Afstemning kan bygges som næste trin, så eleverne stemmer i appen.",
    status: "Kommer senere",
    icon: Vote,
  },
  {
    title: "Resultatet vises",
    text: "Resultatvisning kan bygges bagefter, når stemmeflowet er klar.",
    status: "Kommer senere",
    icon: Trophy,
  },
] as const;

const AI_UNAVAILABLE_MESSAGE = "AI-forslag er ikke tilgængelige lige nu. Du kan stadig oprette spillet manuelt.";

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
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const labelClass = "text-sm font-black text-slate-900";
const helpTextClass = "mt-2 text-sm font-semibold leading-6 text-slate-500";

export default function FindBedragerenBuilderPage() {
  return (
    <Suspense fallback={<FindBedragerenLoading />}>
      <FindBedragerenBuilderContent />
    </Suspense>
  );
}

function FindBedragerenLoading() {
  return (
    <main className={`min-h-screen bg-[#f5f3ef] px-6 py-10 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center shadow-xl">
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

  const canSubmit = useMemo(
    () => title.trim().length > 0 && secretWord.trim().length > 0 && impostorCount >= 1,
    [impostorCount, secretWord, title]
  );
  const canRequestSuggestion = suggestTopic.trim().length > 0;

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
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

  if (isEditMode) {
    return (
      <main className={`min-h-screen bg-[#f5f3ef] px-6 py-8 text-slate-950 ${poppins.className}`}>
        <div className="mx-auto max-w-3xl">
          <Link
            href="/dashboard/arkiv"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-violet-400 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til arkiv
          </Link>

          <section className="mt-10 rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
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
      <main className={`min-h-screen bg-[#f5f3ef] px-6 py-8 text-slate-950 ${poppins.className}`}>
        <div className="mx-auto max-w-3xl">
          <section className="overflow-hidden rounded-[2rem] border border-emerald-200 bg-white shadow-xl">
            <div className="bg-slate-950 px-6 py-8 text-white sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-100">
                    Spillet er oprettet
                  </p>
                  <h1 className={`mt-2 text-3xl font-black text-white ${rubik.className}`}>
                    {createdTitle}
                  </h1>
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
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-700 via-slate-950 to-amber-700 px-6 py-4 text-base font-black text-white shadow-[0_18px_42px_rgba(88,28,135,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(88,28,135,0.34)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:translate-y-0 disabled:cursor-wait disabled:bg-none disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                >
                  {isStartingLobby ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserSearch className="h-5 w-5" />}
                  {isStartingLobby ? "Åbner lobby..." : "Start lobby"}
                </button>
                <Link
                  href="/dashboard/arkiv"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-violet-400 hover:text-slate-950"
                >
                  Gå til arkiv
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedRunId(null);
                    setCreatedTitle("");
                    setNotice(null);
                  }}
                  disabled={isStartingLobby}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-violet-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Opret endnu et spil
                </button>
              </div>

              {notice?.tone === "error" ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-800">
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
    <main className={`relative min-h-screen overflow-hidden bg-slate-950 px-5 py-7 text-white sm:px-6 sm:py-8 ${poppins.className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(251,191,36,0.26),transparent_32%),radial-gradient(circle_at_78%_0%,rgba(124,58,237,0.38),transparent_34%),radial-gradient(circle_at_52%_36%,rgba(14,165,233,0.14),transparent_30%),linear-gradient(180deg,#020617,#0f172a_46%,#f5f3ef_46%,#f5f3ef)]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur-xl transition hover:border-amber-200/50 hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage
          </Link>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/35 bg-amber-200/15 px-4 py-2 text-sm font-black text-amber-100 shadow-sm backdrop-blur-xl">
            <UserSearch className="h-4 w-4" />
            Klasseaktivitet
          </div>
        </header>

        <section className="mt-9 overflow-hidden rounded-[2.25rem] border border-white/12 bg-white/10 shadow-[0_32px_90px_rgba(15,23,42,0.4)] backdrop-blur-2xl">
          <div className="relative grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(251,191,36,0.25),transparent_28%),radial-gradient(circle_at_82%_30%,rgba(168,85,247,0.27),transparent_30%)]" />

            <div className="relative p-6 sm:p-8 lg:p-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-200/12 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-amber-100">
                <Eye className="h-4 w-4" />
                Find Bedrageren
              </p>
              <h1 className={`mt-6 max-w-2xl text-5xl font-black leading-[0.95] text-white sm:text-6xl lg:text-7xl ${rubik.className}`}>
                Hvem kender ordet?
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-200">
                Et socialt bluff-spil til klassen. De civile kender det hemmelige ord. Bedrageren skal lytte,
                improvisere og virke som en del af holdet.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {GAME_CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white/90"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/12 bg-slate-950/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <KeyRound className="h-5 w-5 text-amber-200" />
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-200">
                    Det hemmelige ord gemmes separat og vises kun der, hvor det skal bruges.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-slate-950/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <Users className="h-5 w-5 text-violet-200" />
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-200">
                    Spillet er ikke-GPS og kan køres direkte i klassen fra lærerens skærm.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative border-t border-white/12 bg-slate-950/28 p-6 sm:p-8 lg:border-t-0 lg:border-l lg:p-10">
              <div className="rounded-[1.75rem] border border-white/12 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-200/18 text-amber-100">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
                      Klar på få minutter
                    </p>
                    <h2 className={`mt-1 text-2xl font-black text-white ${rubik.className}`}>
                      Fra kode til rollevisning
                    </h2>
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  {["Opret spil", "Start lobby", "Fordel roller"].map((step, index) => (
                    <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/12 bg-slate-950/24 px-4 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-slate-950">
                        {index + 1}
                      </span>
                      <span className="text-sm font-black text-white">{step}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm font-semibold leading-7 text-slate-200">
                  I denne version bruger læreren diskussionen mundtligt i klassen. Afstemning og resultatvisning kan bygges som næste trin.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <aside className="space-y-6">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-xl sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-amber-200">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-700">
                    Sådan fungerer spillet
                  </p>
                  <h2 className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>
                    20 sekunders overblik
                  </h2>
                </div>
              </div>

              <ol className="mt-7 space-y-3">
                {BUILDER_PROGRESS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isFuture = step.status === "Kommer senere";

                  return (
                    <li
                      key={step.title}
                      className={`flex gap-4 rounded-2xl border p-4 ${
                        isFuture ? "border-slate-200 bg-slate-50" : "border-violet-100 bg-violet-50/55"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          isFuture ? "bg-slate-200 text-slate-700" : "bg-violet-700 text-white"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-sm font-black text-slate-950">{step.title}</h3>
                          <span
                            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${
                              isFuture
                                ? "border-slate-200 bg-white text-slate-600"
                                : "border-violet-200 bg-white text-violet-700"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {step.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{step.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                  <Lightbulb className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">
                    Inspiration
                  </p>
                  <h2 className={`mt-2 text-2xl font-black text-slate-950 ${rubik.className}`}>
                    Gode hemmelige ord
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    Vælg et ord, som alle kender lidt til, men hvor hints stadig kræver omtanke.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {SECRET_WORD_IDEAS.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => setSecretWord(word)}
                    disabled={isSaving}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-violet-200 bg-white p-6 text-slate-950 shadow-xl sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-700">
                    AI-hjælp
                  </p>
                  <h2 className={`mt-2 text-2xl font-black text-slate-950 ${rubik.className}`}>
                    Få hjælp til spillet
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    Skriv et fag eller emne, så foreslår AI en titel, et hemmeligt ord og en kort ramme for spillet.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
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
                    placeholder="Fx vulkaner, demokrati eller brøker"
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
                    placeholder="Fx gør det let at forklare på 5 minutter"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleSuggestContent()}
                  disabled={isSuggesting || !canRequestSuggestion}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-violet-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {isSuggesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                  {isSuggesting ? "Finder forslag..." : "Foreslå spilindhold"}
                </button>

                {suggestionError ? (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
                    {suggestionError}
                  </p>
                ) : null}

                {suggestion ? (
                  <div className="rounded-[1.5rem] border border-violet-200 bg-violet-50 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
                      Forslag
                    </p>
                    <h3 className={`mt-2 text-2xl font-black text-slate-950 ${rubik.className}`}>
                      {suggestion.title}
                    </h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white bg-white px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Hemmeligt ord
                        </p>
                        <p className="mt-2 text-lg font-black text-slate-950">{suggestion.secretWord}</p>
                      </div>
                      <div className="rounded-2xl border border-white bg-white px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          Kategori
                        </p>
                        <p className="mt-2 text-lg font-black text-slate-950">{suggestion.category}</p>
                      </div>
                    </div>
                    <p className="mt-4 rounded-2xl border border-white bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
                      {suggestion.teacherNote}
                    </p>
                    {suggestion.alternatives.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                          Flere ord
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {suggestion.alternatives.map((word) => (
                            <button
                              key={word}
                              type="button"
                              onClick={() => setSecretWord(word)}
                              className="rounded-full border border-violet-200 bg-white px-3 py-2 text-sm font-black text-violet-800 transition hover:border-violet-400 hover:text-slate-950"
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
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      Brug dette forslag
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_24px_64px_rgba(15,23,42,0.12)] sm:p-8"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">
                  Opret aktivitet
                </p>
                <h2 className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>
                  Spilindstillinger
                </h2>
                <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600">
                  Udfyld fire felter. Når spillet er oprettet, kan du starte lobbyen med det samme.
                </p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-violet-800">
                <Clock3 className="h-4 w-4" />
                Hurtig opsætning
              </div>
            </div>

            <div className="mt-7 space-y-6">
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
                  Kategori eller emne
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
                <p className={helpTextClass}>Vælg et område, så spillet får en faglig ramme.</p>
              </div>

              <div>
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
                  placeholder="Fx demokrati, vulkan, Harry Potter eller procent"
                />
                <p className={helpTextClass}>De civile får ordet. Bedrageren gør ikke.</p>
              </div>

              <div>
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
                  className={`${inputClass} mt-2`}
                />
                <p className={helpTextClass}>
                  Start typisk med 1 bedrager. Brug flere bedragere, hvis klassen er stor.
                </p>
              </div>

              {notice ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold leading-6 ${
                    notice.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {notice.message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSaving || !canSubmit}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-700 via-slate-950 to-amber-700 px-6 py-5 text-lg font-black text-white shadow-[0_18px_42px_rgba(88,28,135,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(88,28,135,0.36)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {isSaving ? "Opretter spil..." : "Opret spil"}
                {!isSaving ? <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" /> : null}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
