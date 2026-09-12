"use client";

export const dynamic = "force-dynamic";

import { ArrowLeft, BookOpen, Loader2, Printer, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { poppins, rubik } from "@/lib/fonts";
import GradeLevelMultiSelect from "@/components/builders/GradeLevelMultiSelect";
import { DEFAULT_SELECTED_GRADE_LEVELS, type GradeLevel } from "@/utils/gradeLevels";
import { BUILDER_SUBJECTS } from "@/utils/subjects";

const POST_COUNTS = [4, 6, 8, 10] as const;

export default function StjerneloebPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>(DEFAULT_SELECTED_GRADE_LEVELS);
  const [count, setCount] = useState<number>(6);
  const [raceType, setRaceType] = useState<"classic" | "crossword">("classic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) {
      setError("Angiv et emne for stjerneløbet.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stjerneloeb-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          subject,
          gradeLevels: gradeLevels.length > 0 ? gradeLevels : undefined,
          count,
          raceType,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Noget gik galt. Prøv igen.");
        return;
      }
      router.push(`/dashboard/print/${data.id}`);
    } catch {
      setError("Netværksfejl. Tjek din forbindelse og prøv igen.");
    } finally {
      setLoading(false);
    }
  }

  const optionClass = (selected: boolean) =>
    "flex-1 rounded-2xl border px-5 py-4 text-left text-base font-semibold transition " +
    (selected
      ? "border-sky-600 bg-sky-600 text-white shadow-sm"
      : "border-sky-200 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50");

  const countClass = (selected: boolean) =>
    "rounded-xl border px-5 py-2.5 text-sm font-semibold transition " +
    (selected
      ? "border-sky-600 bg-sky-600 text-white shadow-sm"
      : "border-sky-200 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50");

  return (
    <main className={"min-h-screen bg-[linear-gradient(135deg,#f4f9ff_0%,#e2efff_100%)] px-4 py-8 text-slate-950 sm:px-6 sm:py-10 " + poppins.className}>
      <div className="mx-auto max-w-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage
          </Link>
          <Link
            href="/dashboard/opret/stjerneloeb/bibliotek"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 transition hover:border-sky-400 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70"
          >
            <BookOpen className="h-4 w-4" />
            Bibliotek
          </Link>
        </header>

        <div className="mt-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-800 shadow-sm">
            <Printer className="h-4 w-4" />
            Klar til print
          </span>
          <h1 className={"mt-4 text-4xl font-black tracking-tight text-slate-950 " + rubik.className}>
            Stjerneløb
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base font-medium leading-7 text-slate-600">
            Lav printklare poster til et fysisk løb.
          </p>
        </div>

        <section className="mt-8 rounded-3xl border border-sky-200 bg-white p-6 shadow-[0_18px_44px_rgba(7,68,128,0.10)] sm:p-8" aria-label="Opsæt stjerneløb">
          <div className="mb-6">
            <label className="mb-2 block text-sm font-bold text-slate-800">
              Emne <span className="text-sky-700">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="F.eks. Vikingetiden, Celler og DNA, Vandets kredsløb…"
              maxLength={150}
              className="w-full rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-sky-600 focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">Fag</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-600 focus:ring-4 focus:ring-sky-100"
              >
                <option value="">Vælg fag (valgfrit)</option>
                {BUILDER_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">Klassetrin</label>
              <GradeLevelMultiSelect selectedGradeLevels={gradeLevels} onChange={setGradeLevels} tone="indigo" />
            </div>
          </div>

          <fieldset className="mb-8">
            <legend className="mb-3 block text-sm font-bold text-slate-800">Løbstype</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setRaceType("classic")} className={optionClass(raceType === "classic")} aria-pressed={raceType === "classic"}>
                <span className="block font-bold">Klassisk</span>
                <span className="mt-1 block text-xs opacity-80">Svar med A, B, C eller D</span>
              </button>
              <button type="button" onClick={() => setRaceType("crossword")} className={optionClass(raceType === "crossword")} aria-pressed={raceType === "crossword"}>
                <span className="block font-bold">Krydsord</span>
                <span className="mt-1 block text-xs opacity-80">Gæt ét ord ved hver post</span>
              </button>
            </div>
          </fieldset>

          <fieldset className="mb-8">
            <legend className="mb-3 block text-sm font-bold text-slate-800">Antal poster</legend>
            <div className="flex flex-wrap gap-3">
              {POST_COUNTS.map((n) => (
                <button key={n} type="button" onClick={() => setCount(n)} className={countClass(count === n)} aria-pressed={count === n}>
                  {n} poster
                </button>
              ))}
            </div>
          </fieldset>

          {error ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#0377d8] px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-[#075fb2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                AI genererer dine poster…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generer stjerneløb
              </>
            )}
          </button>

          {loading ? <p className="mt-3 text-center text-xs text-slate-500">Dette tager typisk 15–40 sekunder. Luk ikke siden.</p> : null}
        </section>

        <details className="mt-5 rounded-2xl border border-sky-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <summary className="cursor-pointer font-bold text-slate-800">Sådan bruges materialet</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 leading-6">
            <li>Du får {count} poster med tekst, billede og spørgsmål.</li>
            <li>Åbn printvisningen og udskriv A4-kortene.</li>
            <li>Placér posterne, før eleverne starter løbet.</li>
          </ul>
        </details>
      </div>
    </main>
  );
}
