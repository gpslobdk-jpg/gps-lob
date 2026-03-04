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
    <main className={`min-h-screen bg-[#050816] px-6 py-12 text-white md:px-10 ${poppins.className}`}>
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_30px_rgba(34,211,238,0.12)] backdrop-blur-md">
        <h1 className={`text-3xl font-black tracking-tight text-cyan-100 md:text-4xl ${rubik.className}`}>
          Den Magiske Generator 🪄
        </h1>

        <div className="mt-8">
          <label htmlFor="magic-theme" className="mb-2 block text-sm font-semibold text-cyan-100">
            Hvad skal løbet handle om?
          </label>
          <textarea
            id="magic-theme"
            rows={7}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="F.eks. Skattejagt med Harry Potter tema. Lav 6 poster, hvor 2 af dem er sjove foto-opgaver..."
            className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-sm text-white placeholder:text-white/45 focus:border-cyan-400/60 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isLoading || !prompt.trim()}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 px-6 py-4 text-lg font-extrabold tracking-wide text-[#220b02] uppercase shadow-[0_0_28px_rgba(251,191,36,0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isLoading ? "✨ Genererer..." : "✨ Generer Løb"}
        </button>

        {isLoading ? (
          <p className="mt-4 text-sm font-semibold text-amber-100">
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
