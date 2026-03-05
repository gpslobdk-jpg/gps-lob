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
            : "Kunne ikke generere lÃ¸bet lige nu.";
        throw new Error(message);
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("AI returnerede ingen poster.");
      }

      window.sessionStorage.setItem("magicRunDraft", JSON.stringify(data));
      router.push("/dashboard/opret/manuel");
    } catch (error) {
      console.error("Magi-side fejl:", error);
      setErrorMessage(error instanceof Error ? error.message : "Noget gik galt. PrÃ¸v igen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className={`min-h-screen bg-gradient-to-t from-emerald-100 via-sky-50 to-sky-300 px-6 py-12 text-white md:px-10 ${poppins.className}`}
    >
      <section className="mx-auto w-full max-w-4xl rounded-[2.5rem] border border-white/50 bg-white/80 p-10 shadow-2xl backdrop-blur-md">
        <h1 className={`text-3xl font-black tracking-tight text-white drop-shadow-lg md:text-4xl ${rubik.className}`}>
          AI-drevet LÃ¸bsbygger
        </h1>

        <div className="mt-8">
          <label htmlFor="magic-theme" className="mb-2 block text-sm font-semibold text-emerald-950">
            Hvad skal lÃ¸bet handle om?
          </label>
          <textarea
            id="magic-theme"
            rows={7}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="F.eks. Skattejagt med Harry Potter tema. Lav 6 poster, hvor 2 af dem er sjove foto-opgaver..."
            className="w-full rounded-xl border border-emerald-100 bg-white/50 px-4 py-4 text-sm text-emerald-950 placeholder:text-emerald-600/60 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isLoading || !prompt.trim()}
          className="mt-6 w-full rounded-full bg-emerald-600 px-6 py-3 text-lg font-extrabold tracking-wide text-white uppercase shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isLoading ? "âœ¨ Genererer..." : "âœ¨ Generer LÃ¸b"}
        </button>

        {isLoading ? (
          <p className="mt-4 text-sm font-semibold text-emerald-800">
            AI&apos;en designer poster, udtÃ¦nker foto-missioner og pakker rygsÃ¦kken... ðŸ¤–ðŸŽ’
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
