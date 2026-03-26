"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type ScraperData = {
  title: string;
  description: string;
  transcript: string | null;
};

type PodcastQuestion = {
  question: string;
  options: string[];
  answer: string;
};

type LoadingStep = "idle" | "scraping" | "building" | "done";

const PODCAST_DRAFT_KEY = "podcast_draft";

export default function PodcastDetektivPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loadingStep, setLoadingStep] = useState<LoadingStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLoading = loadingStep !== "idle" && loadingStep !== "done";

  const loadingLabel = (() => {
    if (loadingStep === "scraping") return "🕵️‍♂️ Lytter til podcasten...";
    if (loadingStep === "building") return "🧠 AI'en bygger 8 skarpe spørgsmål...";
    return "Analysér & Byg Løb";
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    setLoadingStep("scraping");

    try {
      // Step 1: Scrape podcast metadata
      const scraperResponse = await fetch("/api/podcast-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const scraperResult = (await scraperResponse.json()) as {
        success: boolean;
        data?: ScraperData;
        error?: string;
      };

      if (!scraperResult.success || !scraperResult.data) {
        throw new Error(scraperResult.error ?? "Kunne ikke hente podcast-data. Tjek linket og prøv igen.");
      }

      const { title, description, transcript } = scraperResult.data;

      // Step 2: Build questions with AI
      setLoadingStep("building");
      const builderResponse = await fetch("/api/podcast-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, transcript }),
      });
      const builderResult = (await builderResponse.json()) as {
        success: boolean;
        questions?: PodcastQuestion[];
        error?: string;
      };

      if (!builderResult.success || !builderResult.questions?.length) {
        throw new Error(builderResult.error ?? "AI'en kunne ikke bygge spørgsmål. Prøv igen.");
      }

      console.log("Scraper + builder resultat:", { title, questions: builderResult.questions });

      // Step 3: Hand off to manuel builder via sessionStorage
      setLoadingStep("done");
      window.sessionStorage.setItem(
        PODCAST_DRAFT_KEY,
        JSON.stringify({ title, questions: builderResult.questions })
      );
      router.push("/dashboard/opret/manuel?source=podcast");
    } catch (err) {
      console.error("Podcast-flow fejl:", err);
      setError(err instanceof Error ? err.message : "Noget gik galt. Prøv igen.");
      setLoadingStep("idle");
    }
  };

  return (
    <main
      className={`relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-purple-950/40 to-slate-900 px-6 py-10 text-white ${poppins.className}`}
    >
      {/* Back header */}
      <header className="absolute top-0 left-0 right-0 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <Image src="/gpslogo.png" width={130} height={44} alt="Logo" priority />
        <Link
          href="/dashboard/opret/valg"
          className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all hover:border-white/28 hover:bg-white/16"
        >
          <ArrowLeft className="h-4 w-4 text-white/82" />
          Tilbage
        </Link>
      </header>

      {/* Glass card */}
      <div className="relative w-full max-w-xl rounded-[2rem] border border-purple-400/30 bg-white/8 p-8 shadow-[0_32px_80px_rgba(147,51,234,0.22),0_8px_24px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl md:p-12">
        {/* Glow layer */}
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_40%),radial-gradient(circle_at_bottom,rgba(147,51,234,0.22),transparent_65%)]" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <h1
            className={`text-3xl font-black tracking-tight text-white drop-shadow-[0_8px_24px_rgba(147,51,234,0.4)] md:text-4xl ${rubik.className}`}
          >
            Podcast-Detektiven 🎧
          </h1>

          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/72">
            Indsæt et link til en podcast (YouTube, DR Lyd, Apple Podcasts osv.), så lytter vi til
            afsnittet og bygger et GPS-løb på sekunder.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Indsæt link her..."
              required
              disabled={isLoading}
              className="w-full rounded-2xl border border-purple-400/40 bg-white/8 px-5 py-4 text-base text-white placeholder-white/38 shadow-[inset_0_2px_8px_rgba(15,23,42,0.18)] outline-none backdrop-blur-sm ring-0 transition-all focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            />

            {error ? (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="w-full rounded-2xl border border-purple-400/40 bg-purple-600 px-6 py-4 text-base font-bold text-white shadow-[0_12px_32px_rgba(147,51,234,0.32)] transition-all hover:bg-purple-500 hover:shadow-[0_16px_40px_rgba(147,51,234,0.44)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-purple-600 disabled:hover:shadow-[0_12px_32px_rgba(147,51,234,0.32)]"
            >
              {isLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {loadingLabel}
                </span>
              ) : (
                "Analysér & Byg Løb"
              )}
            </button>

            <p className="mt-1 text-center text-xs leading-relaxed text-white/40">
              Vi respekterer{" "}
              <Link
                href="/ophavsret-podcast"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition hover:text-purple-300"
              >
                ophavsretten
              </Link>
              . Dit link bruges udelukkende til at læse offentlige resuméer, og lyden afspilles altid via originalkilden.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
