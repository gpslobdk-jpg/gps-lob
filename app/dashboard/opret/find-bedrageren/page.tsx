"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  KeyRound,
  Loader2,
  MessageCircle,
  Save,
  Sparkles,
  UserSearch,
  Users,
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

const SUBJECT_OPTIONS = ["Generelt", "Tysk", "Engelsk", "Historie", "Samfundsfag"] as const;
const GAME_CHIPS = ["Hemmeligt ord", "Roller", "Diskussion", "Afstemning"] as const;
const HOW_IT_WORKS_STEPS = [
  {
    title: "Opret spillet",
    text: "Vælg titel, emne, hemmeligt ord og hvor mange bedragere der skal være.",
  },
  {
    title: "Eleverne joiner med kode",
    text: "Start lobbyen og vis koden på tavlen, så klassen kan gå ind fra deres egen side.",
  },
  {
    title: "Læreren fordeler roller",
    text: "Når alle er klar, fordeler systemet rollerne privat på elevernes skærme.",
  },
  {
    title: "Klassen diskuterer og stemmer",
    text: "Eleverne giver hints, lytter efter og prøver at afsløre hvem der bluffer.",
  },
] as const;

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

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-base font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const labelClass = "text-sm font-black text-slate-800";

export default function FindBedragerenBuilderPage() {
  return (
    <Suspense fallback={<FindBedragerenLoading />}>
      <FindBedragerenBuilderContent />
    </Suspense>
  );
}

function FindBedragerenLoading() {
  return (
    <main className={`min-h-screen bg-slate-100 px-6 py-10 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-amber-600" />
          <p className="mt-4 text-sm font-semibold text-slate-600">Åbner Find Bedrageren...</p>
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

  const isEditMode = editRunId.length > 0;

  const canSubmit = useMemo(
    () => title.trim().length > 0 && secretWord.trim().length > 0 && impostorCount >= 1,
    [impostorCount, secretWord, title]
  );

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
      <main className={`min-h-screen bg-slate-100 px-6 py-8 text-slate-950 ${poppins.className}`}>
        <div className="mx-auto max-w-3xl">
          <Link
            href="/dashboard/arkiv"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-amber-400 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til arkiv
          </Link>

          <section className="mt-10 rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <UserSearch className="h-6 w-6" />
              </div>
              <div>
                <h1 className={`text-3xl font-black text-slate-950 ${rubik.className}`}>
                  Redigering kommer senere
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  Find Bedrageren kan oprettes nu. Det bliver muligt at redigere og lade eleverne spille i en senere fase.
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
      <main className={`min-h-screen bg-slate-100 px-6 py-8 text-slate-950 ${poppins.className}`}>
        <div className="mx-auto max-w-3xl">
          <section className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                  Spillet er oprettet
                </p>
                <h1 className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>
                  {createdTitle}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  Aktiviteten er gemt. Start lobbyen, når klassen er klar til at joine.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleStartLobby()}
                disabled={isStartingLobby}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-500"
              >
                {isStartingLobby ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserSearch className="h-4 w-4" />}
                {isStartingLobby ? "Åbner lobby..." : "Start lobby"}
              </button>
              <Link
                href="/dashboard/arkiv"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-amber-400 hover:text-slate-950"
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
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-amber-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Opret endnu et spil
              </button>
            </div>

            {notice?.tone === "error" ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                {notice.message}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`relative min-h-screen overflow-hidden bg-slate-950 px-6 py-8 text-white ${poppins.className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_34%),radial-gradient(circle_at_75%_12%,rgba(124,58,237,0.32),transparent_36%),linear-gradient(180deg,#020617,#111827_48%,#f8fafc_48%,#f8fafc)]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur-xl transition hover:border-amber-200/50 hover:bg-white/16"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage
          </Link>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/35 bg-amber-200/14 px-4 py-2 text-sm font-black text-amber-100 shadow-sm backdrop-blur-xl">
            <UserSearch className="h-4 w-4" />
            Klasseaktivitet
          </div>
        </header>

        <section className="mt-10 overflow-hidden rounded-[2rem] border border-white/12 bg-white/10 shadow-[0_28px_80px_rgba(15,23,42,0.34)] backdrop-blur-2xl">
          <div className="relative grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(251,191,36,0.22),transparent_26%),radial-gradient(circle_at_80%_28%,rgba(168,85,247,0.24),transparent_30%)]" />

            <div className="relative p-6 sm:p-8 lg:p-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-200/12 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-amber-100">
                <Eye className="h-4 w-4" />
                Find Bedrageren
              </p>
              <h1 className={`mt-6 max-w-xl text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl ${rubik.className}`}>
                Hvem kender ordet?
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-200">
                Eleverne får roller. De civile kender det hemmelige ord. Bedrageren skal bluffe sig igennem.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {GAME_CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white/88"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/12 bg-slate-950/28 p-4">
                  <KeyRound className="h-5 w-5 text-amber-200" />
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-200">
                    Hemmeligt ord bliver kun vist til de elever, der skal kende det.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-slate-950/28 p-4">
                  <Users className="h-5 w-5 text-violet-200" />
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-200">
                    Spillet fungerer uden GPS og kan køres direkte i klassen.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative border-t border-white/12 bg-slate-950/24 p-6 sm:p-8 lg:border-t-0 lg:border-l lg:p-10">
              <div className="rounded-[1.5rem] border border-white/12 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-200/18 text-amber-100">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/58">
                      Klar på få minutter
                    </p>
                    <h2 className={`mt-1 text-2xl font-black text-white ${rubik.className}`}>
                      Socialt klassespil
                    </h2>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold leading-7 text-slate-200">
                  Opret spillet, start lobbyen og lad eleverne finde ud af, hvem der spiller for ærligt.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
          <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-amber-200">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-700">
                  Sådan fungerer spillet
                </p>
                <h2 className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>
                  Fra hemmeligt ord til mistanke
                </h2>
              </div>
            </div>

            <ol className="mt-7 space-y-4">
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-700 text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-950">{step.title}</h3>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_22px_54px_rgba(15,23,42,0.1)] sm:p-8"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">
                  Opret aktivitet
                </p>
                <h2 className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>
                  Spilindstillinger
                </h2>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-violet-800">
                <UserSearch className="h-4 w-4" />
                Ikke-GPS
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
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  Start typisk med 1 bedrager i en almindelig klasse.
                </p>
              </div>

              {notice ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] transition hover:bg-violet-950 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {isSaving ? "Opretter spil..." : "Opret spil"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
