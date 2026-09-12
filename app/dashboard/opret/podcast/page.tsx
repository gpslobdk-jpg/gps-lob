"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";

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
  return (
    <Suspense fallback={<PodcastDetektivLoading />}>
      <PodcastDetektivContent />
    </Suspense>
  );
}

function PodcastDetektivLoading() {
  return (
    <main className={`skolegps-teacher-page min-h-screen ${poppins.className}`}>
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-slate-700">
        <p className="text-sm font-semibold">Åbner Podcast-Detektiven...</p>
      </div>
    </main>
  );
}

function PodcastDetektivContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const [url, setUrl] = useState("");
  const [loadingStep, setLoadingStep] = useState<LoadingStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  const isLoading = loadingStep !== "idle" && loadingStep !== "done";

  const loadingLabel = (() => {
    if (loadingStep === "scraping") return "🕵️‍♂️ Lytter til podcasten...";
    if (loadingStep === "building") return "🧠 Laver spørgsmål til dit udkast...";
    return "Lav et udkast";
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
        throw new Error(builderResult.error ?? "Spørgsmålene kunne ikke bygges automatisk. Prøv igen.");
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

  if (editRunId) {
    return (
      <main className={["skolegps-teacher-page min-h-screen px-6 py-10", poppins.className].join(" ")}>
        <div className="mx-auto max-w-2xl">
          <Link
            href="/dashboard/arkiv"
            className="skolegps-teacher-secondary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-sky-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til arkiv
          </Link>
          <section className="skolegps-teacher-surface mt-8 rounded-3xl p-8">
            <p className="text-xs font-bold tracking-[0.18em] text-sky-700 uppercase">Eksisterende podcastløb</p>
            <h1 className={["mt-3 text-3xl font-black tracking-tight text-slate-950", rubik.className].join(" ")}>
              Redigering er ikke understøttet endnu
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-700">
              Dette løb åbnes ikke i podcastimporten, fordi den kan starte et nyt løb i stedet for at redigere det sikkert.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Løbet og afviklingen er bevaret. Du kan stadig starte det fra arkivet.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`skolegps-teacher-page relative flex min-h-screen flex-col items-center justify-center px-6 py-10 ${poppins.className}`}
    >
      <header className="absolute top-0 left-0 right-0 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <div className="rounded-[1.25rem] bg-white px-3 py-2 shadow-[0_12px_30px_rgba(2,6,23,0.10)]">
          <Image
            src="/skolegps-logo.svg"
            width={210}
            height={60}
            alt="SkoleGPS logo"
            priority
            className="h-auto w-44 sm:w-52"
          />
        </div>
        <Link
          href="/dashboard/opret/valg"
          className="skolegps-teacher-secondary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:bg-sky-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbage
        </Link>
      </header>

      <div className="skolegps-teacher-surface w-full max-w-xl rounded-[2rem] p-8 md:p-12">
        <div className="flex flex-col items-center text-center">
          <h1
            className={`text-3xl font-black tracking-tight text-slate-950 md:text-4xl ${rubik.className}`}
          >
            Podcast-Detektiven 🎧
          </h1>

          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-700">
            Indsæt et podcastlink. Vi finder indholdet og laver et udkast med spørgsmål, som du kan tilpasse.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Indsæt link her..."
              required
              disabled={isLoading}
              className="w-full rounded-2xl border border-sky-200 bg-white px-5 py-4 text-base text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70"
            />

            {error ? (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </p>
            ) : null}

            <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50 p-4 text-left shadow-sm">
              <input
                type="checkbox"
                id="copydan-consent-podcast"
                checked={hasAcceptedTerms}
                onChange={(e) => setHasAcceptedTerms(e.target.checked)}
                className="mt-1 h-5 w-5 cursor-pointer rounded border-sky-300 text-sky-600 focus:ring-sky-500"
              />
              <label
                htmlFor="copydan-consent-podcast"
                className="cursor-pointer select-none text-sm leading-relaxed text-slate-700"
              >
                Jeg bekræfter, at jeg har rettighederne til at bearbejde dette materiale, eller at min brug er
                dækket af min skoles gældende aftale med Tekst &amp; Node.{" "}
                <Link href="/ophavsret" className="font-semibold text-sky-700 hover:underline" target="_blank">
                  (Læs mere om ophavsret)
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={!hasAcceptedTerms || isLoading || !url.trim()}
              className="skolegps-teacher-primary-action w-full rounded-2xl px-6 py-4 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
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
                "Lav et udkast"
              )}
            </button>

            <p className="mt-1 text-center text-xs leading-relaxed text-slate-500">
              Vi respekterer{" "}
              <Link
                href="/ophavsret-podcast"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition hover:text-sky-700"
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
