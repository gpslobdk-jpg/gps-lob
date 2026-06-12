"use client";

import { ArrowLeft, CheckCircle2, Loader2, Save, UserSearch } from "lucide-react";
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
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

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
                  Aktiviteten er gemt. Eleverne kan spille, når næste del er klar.
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
    <main className={`min-h-screen bg-slate-100 px-6 py-8 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-amber-400 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage
          </Link>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800">
            <UserSearch className="h-4 w-4" />
            Klasseaktivitet
          </div>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">
              Find Bedrageren
            </p>
            <h1 className={`mt-3 text-4xl font-black leading-tight text-slate-950 sm:text-5xl ${rubik.className}`}>
              Opret et spil med et hemmeligt ord
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Eleverne får et hemmeligt ord. Én eller flere elever er bedragere og skal bluffe.
            </p>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-900">Sådan bruges spillet</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Opret aktiviteten her. Når næste del er klar, kan klassen gå ind i spillet, se deres rolle og stemme til sidst.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="space-y-6">
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
                  placeholder="Fx demokrati"
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {isSaving ? "Gemmer..." : "Opret spil"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
