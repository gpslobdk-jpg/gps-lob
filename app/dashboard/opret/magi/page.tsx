"use client";

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
            : "Kunne ikke generere løbet lige nu.";
        throw new Error(message);
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("AI returnerede ingen poster.");
      }

      window.sessionStorage.setItem("magicRunDraft", JSON.stringify(data));
      router.push("/dashboard/opret/manuel");
    } catch (error) {
      console.error("Magi-side fejl:", error);
      setErrorMessage(error instanceof Error ? error.message : "Noget gik galt. Prøv igen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-slate-950 px-6 py-12 text-white md:px-10 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 z-0 h-full w-full object-cover"
        src="/arkiv-bg.mp4"
      />
      <div className="fixed inset-0 z-[1] bg-slate-950/60 backdrop-blur-md" />
      <div className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.07),_transparent_28%)]" />

      <section className="relative z-10 mx-auto w-full max-w-4xl rounded-[2.5rem] border border-white/10 bg-slate-900/80 p-10 shadow-[0_32px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <h1 className={`text-3xl font-black tracking-tight text-white md:text-4xl ${rubik.className}`}>
          AI-drevet Løbsbygger
        </h1>

        <div className="mt-8">
          <label htmlFor="magic-theme" className="mb-2 block text-sm font-semibold text-white">
            Hvad skal løbet handle om?
          </label>
          <textarea
            id="magic-theme"
            rows={7}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="F.eks. Skattejagt med Harry Potter tema. Lav 6 poster med sjove quiz-spørgsmål og 4 svarmuligheder..."
            className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isLoading || !prompt.trim()}
          className="mt-6 w-full rounded-full bg-emerald-600 px-6 py-3 text-lg font-extrabold tracking-wide text-white uppercase shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isLoading ? "✨ Genererer..." : "✨ Generer Løb"}
        </button>

        {isLoading ? (
          <p className="mt-4 text-sm font-semibold text-emerald-100/85">
            AI&apos;en designer poster, udtænker foto-missioner og pakker rygsækken... 🤖🎒
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-red-400/45 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100">
            {errorMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}
