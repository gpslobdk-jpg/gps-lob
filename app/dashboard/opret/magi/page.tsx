"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { useState } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const PROMPT_SUGGESTIONS = [
  "Emne: Vikingerne for 5. klasse. Lav 6 poster med en blanding af quiz og foto-opgaver.",
  "Emne: Fotosyntese og Natur/Teknik. Lav 5 poster med konkrete observationer i skolegaarden.",
  "Emne: H.C. Andersen. Lav 6 poster med eventyr, citater og kreative missions-opgaver.",
  "Emne: Broeker og procenter for mellemtrinnet. Lav 7 poster med hverdagsnaere problemstillinger.",
] as const;

export default function OpretMagiPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/magi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      const data = (await res.json()) as unknown;
      if (!res.ok) {
        const message =
          typeof data === "object" && data && "error" in data && typeof data.error === "string"
            ? data.error
            : "Kunne ikke generere loebet lige nu.";
        throw new Error(message);
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("AI returnerede ingen poster.");
      }

      window.sessionStorage.setItem("magicRunDraft", JSON.stringify(data));
      router.push("/dashboard/opret/manuel");
    } catch (error) {
      console.error("Magi-side fejl:", error);
      setErrorMessage(error instanceof Error ? error.message : "Noget gik galt. Proev igen.");
    } finally {
      setIsLoading(false);
    }
  };

  const applySuggestion = (suggestion: string) => {
    if (isLoading) return;
    setPrompt(suggestion);
    setErrorMessage(null);
  };

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-slate-950 px-6 py-10 text-white md:px-10 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 z-0 h-full w-full object-cover"
        src="/magibg.mp4"
      />
      <div className="fixed inset-0 z-[1] bg-slate-950/70 backdrop-blur-md" />
      <div className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.08),rgba(2,6,23,0.68))]" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <section className="rounded-[2.5rem] border border-emerald-500/15 bg-slate-900/80 p-8 shadow-[0_32px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl md:p-10">
          <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/80">
            Magi Portal
          </div>

          <div className="mt-6 max-w-3xl">
            <h1
              className={`text-4xl font-black tracking-tight text-white sm:text-5xl ${rubik.className}`}
            >
              AI-drevet loebsbygger
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-300 sm:text-lg">
              Beskriv dit emne, klassetrin eller stemning. Saa bygger motoren et foerste udkast
              med quiz-spoergsmaal, foto-missioner og klar til placering paa kortet.
            </p>
          </div>

          <div className="mt-10">
            <label
              htmlFor="magic-theme"
              className="block text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/65"
            >
              Hvad skal loebet handle om?
            </label>

            <div className="relative mt-4">
              <div className="pointer-events-none absolute inset-x-10 -bottom-10 h-28 rounded-full bg-emerald-500/12 blur-3xl" />
              <textarea
                id="magic-theme"
                rows={11}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={isLoading}
                placeholder="F.eks. Lav et GPS-loeb om vikingerne for 5. klasse med 6 poster, 2 foto-missioner og korte forklaringer, saa laereren selv kan placere posterne bagefter."
                className="relative min-h-[320px] w-full rounded-[2rem] border border-emerald-500/20 bg-slate-950/70 px-6 py-5 text-base leading-8 text-emerald-50 shadow-[0_26px_70px_rgba(16,185,129,0.14)] outline-none transition placeholder:text-emerald-100/35 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-950/55 disabled:text-slate-400"
              />
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Promptforslag
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {PROMPT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => applySuggestion(suggestion)}
                    disabled={isLoading}
                    className="rounded-full border border-emerald-500/20 bg-slate-950/65 px-4 py-2.5 text-left text-sm font-medium text-emerald-100/85 transition hover:border-emerald-400/35 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-8 flex items-center gap-4 rounded-[1.75rem] border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex size-12 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10">
                <Loader2 className="size-5 animate-spin" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/70">
                  AI er i gang
                </p>
                <p className="mt-1 animate-pulse text-base font-semibold text-emerald-50">
                  AI&apos;en researcher emnet og bygger posterne...
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-8 text-sm leading-7 text-slate-400">
              Tip: Skriv gerne fag, klassetrin, antal poster og om du vil have foto-opgaver med.
            </p>
          )}

          {errorMessage ? (
            <p className="mt-5 rounded-[1.4rem] border border-red-400/35 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-100">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={isLoading || !prompt.trim()}
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-emerald-600 px-8 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-white shadow-[0_18px_45px_rgba(16,185,129,0.38)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900/60 disabled:text-white/60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Genererer
                </>
              ) : (
                "Byg loebet med AI"
              )}
            </button>

            <p className="text-sm text-slate-400">
              Du bliver sendt videre til manuel redigering, saa du kan finjustere posterne og
              placere dem paa kortet.
            </p>
          </div>
        </section>

        <aside className="rounded-[2.5rem] border border-white/10 bg-slate-900/72 p-8 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          <div className="rounded-[1.9rem] border border-emerald-500/15 bg-slate-950/60 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/65">
              Motorstatus
            </p>
            <h2 className={`mt-3 text-2xl font-black text-white ${rubik.className}`}>
              Hvad kommer der ud?
            </h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                AI&apos;en genererer quiz-poster og foto-missioner ud fra dit emne.
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                Alle poster leveres med dummy-koordinater, saa du selv kan placere dem bagefter.
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                Resultatet lander direkte i den manuelle builder, hvor du kan rette alt til.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[1.9rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Bedste prompts
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
              <li>Naevn altid fag eller tema.</li>
              <li>Tilfoej klassetrin eller niveau.</li>
              <li>Angiv cirka antal poster.</li>
              <li>Skriv hvis du vil have foto-missioner eller ekstra kreative opgaver.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
