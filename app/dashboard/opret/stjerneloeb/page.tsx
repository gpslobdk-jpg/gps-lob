"use client";

export const dynamic = "force-dynamic";

import { Loader2, Printer, Sparkles } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BUILDER_SUBJECTS } from "@/utils/subjects";
import { DEFAULT_SELECTED_GRADE_LEVELS, type GradeLevel } from "@/utils/gradeLevels";
import GradeLevelMultiSelect from "@/components/builders/GradeLevelMultiSelect";

const rubik = Rubik({ subsets: ["latin"], weight: ["700", "800", "900"] });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });


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
        body: JSON.stringify({ topic: topic.trim(), subject, gradeLevels: gradeLevels.length > 0 ? gradeLevels : undefined, count, raceType }),
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

  return (
    <div
      className={`relative min-h-screen bg-slate-950 text-slate-100 ${poppins.className}`}
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-violet-700/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
            <Printer className="h-4 w-4" />
            Analogt – til print
          </div>
          <h1
            className={`text-4xl font-black tracking-tight text-white ${rubik.className}`}
          >
            Stjerneløb
          </h1>
          <p className="mt-2 text-slate-400">
            AI genererer laminerings-klare A4-poster med tekst, billede og spørgsmål.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
          {/* Emne */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              Emne <span className="text-violet-400">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="F.eks. Vikingetiden, Celler og DNA, Vandets kredsløb…"
              maxLength={150}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          {/* Fag + Klassetrin row */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Fag
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
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
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Klassetrin
              </label>
              <GradeLevelMultiSelect
                selectedGradeLevels={gradeLevels}
                onChange={setGradeLevels}
                tone="indigo"
              />
            </div>
          </div>


          {/* Løbstype vælger */}
          <div className="mb-8">
            <label className="mb-3 block text-sm font-semibold text-slate-300">Løbstype</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setRaceType("classic")}
                className={`flex-1 rounded-xl border px-5 py-4 text-base font-semibold transition-all text-left ${
                  raceType === "classic"
                    ? "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-violet-500/50 hover:bg-white/10"
                }`}
              >
                <div className="font-bold mb-1">Klassisk</div>
                <div className="text-xs opacity-80">4 svarmuligheder (A, B, C, D)</div>
              </button>
              <button
                type="button"
                onClick={() => setRaceType("crossword")}
                className={`flex-1 rounded-xl border px-5 py-4 text-base font-semibold transition-all text-left ${
                  raceType === "crossword"
                    ? "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-violet-500/50 hover:bg-white/10"
                }`}
              >
                <div className="font-bold mb-1">Krydsord</div>
                <div className="text-xs opacity-80">Eleverne skal gætte ét ord</div>
              </button>
            </div>
          </div>

          {/* Antal poster */}
          <div className="mb-8">
            <label className="mb-3 block text-sm font-semibold text-slate-300">
              Antal poster
            </label>
            <div className="flex flex-wrap gap-3">
              {POST_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all ${
                    count === n
                      ? "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-violet-500/50 hover:bg-white/10"
                  }`}
                >
                  {n} poster
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-violet-500/30 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
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

          {loading && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Dette tager typisk 15-40 sekunder. Luk ikke siden.
            </p>
          )}
        </div>

        {/* Info box */}
        <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 p-5 text-sm text-slate-400">
          <p className="font-semibold text-slate-300">Sådan fungerer det</p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>AI laver {count} poster med tekst, illustrativt billede og spørgsmål.</li>
            <li>Du får en print-side med A4-kort klar til udskrivning og lamination.</li>
            <li>Hæng posterne rundt i skolegården – eleverne vandrer fra post til post.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
