"use client";

import { ArrowLeft, Camera, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { type ChangeEvent, useState } from "react";

import { writeRunDraft } from "@/utils/runDrafts";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const MANUEL_DRAFT_STORAGE_KEY = "draft_run_manuel";
const DEFAULT_LAT = 55.0;
const DEFAULT_LNG = 11.9;
const MAX_SOURCE_TEXT_LENGTH = 18_000;
const MAX_IMAGE_FILE_SIZE = 12 * 1024 * 1024;
const MAX_IMAGE_DATA_LENGTH = 6_000_000;

type GeneratedQuestion = {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  lat: number;
  lng: number;
};

type GeneratedRunPayload = {
  title: string;
  description: string;
  questions: GeneratedQuestion[];
};

type ManualDraftQuestion = {
  id: number;
  type: "multiple_choice";
  text: string;
  aiPrompt: string;
  mediaUrl: string;
  answers: [string, string, string, string];
  correctIndex: number;
  lat: number;
  lng: number;
};

type ManualBuilderDraftState = {
  title: string;
  description: string;
  subject: string;
  showTeacherField: boolean;
  showAITeacherFields: boolean;
  questions: ManualDraftQuestion[];
  aiRunBrief: string;
  aiSubject: string;
  aiTopic: string;
  aiGrade: string;
  mapCenter: {
    lat: number;
    lng: number;
  };
};

function readFileAsDataUri(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Kunne ikke læse billedet."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Kunne ikke indlæse billedet."));
    image.src = src;
  });
}

async function compressScannerImage(file: File) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return readFileAsDataUri(file);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const longestSide = Math.max(sourceWidth, sourceHeight, 1);
    const scale = longestSide > 1080 ? 1080 / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return readFileAsDataUri(file);
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function toQuestions(questions: GeneratedQuestion[]): ManualDraftQuestion[] {
  const timestamp = Date.now();

  return questions.map((question, index) => ({
    id: timestamp + index,
    type: "multiple_choice",
    text: question.question,
    aiPrompt: "",
    mediaUrl: "",
    answers: question.options,
    correctIndex: question.correctIndex,
    lat: question.lat,
    lng: question.lng,
  }));
}

function toManualDraft(run: GeneratedRunPayload, sourceText: string): ManualBuilderDraftState {
  const questions = toQuestions(run.questions);
  const firstQuestion = questions[0];
  const safeSummary = sourceText.trim().slice(0, 180);

  return {
    title: run.title,
    description: run.description,
    subject: "",
    showTeacherField: false,
    showAITeacherFields: false,
    questions,
    aiRunBrief: safeSummary,
    aiSubject: "",
    aiTopic: safeSummary,
    aiGrade: "Mellemtrin",
    mapCenter: {
      lat: firstQuestion?.lat ?? DEFAULT_LAT,
      lng: firstQuestion?.lng ?? DEFAULT_LNG,
    },
  };
}

function isGeneratedRunPayload(value: unknown): value is GeneratedRunPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<GeneratedRunPayload>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    Array.isArray(candidate.questions)
  );
}

export default function ScannerPortalPage() {
  const router = useRouter();
  const [sourceText, setSourceText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressedImage, setCompressedImage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const helperText = isPreparingImage
    ? "Klargør billede..."
    : selectedFile
      ? `Valgt billede: ${selectedFile.name}`
      : "Du kan indsætte tekst, uploade et billede eller bruge begge dele.";

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);

    if (!file) {
      setSelectedFile(null);
      setCompressedImage("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSelectedFile(null);
      setCompressedImage("");
      setError("Vælg et gyldigt billede af en bogside.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setSelectedFile(null);
      setCompressedImage("");
      setError("Billedet er for stort. Vælg et billede under 12 MB.");
      event.target.value = "";
      return;
    }

    setIsPreparingImage(true);

    try {
      const dataUrl = await compressScannerImage(file);
      if (!dataUrl || dataUrl.length > MAX_IMAGE_DATA_LENGTH) {
        throw new Error("Billedet er stadig for stort efter komprimering.");
      }

      setSelectedFile(file);
      setCompressedImage(dataUrl);
    } catch (compressionError) {
      console.error("Fejl ved billedkomprimering:", compressionError);
      setSelectedFile(null);
      setCompressedImage("");
      setError("Kunne ikke klargøre billedet. Prøv et andet udsnit eller et mindre billede.");
      event.target.value = "";
    } finally {
      setIsPreparingImage(false);
    }
  }

  async function handleGenerateRun() {
    if (isGenerating || isPreparingImage) return;

    const trimmedSourceText = sourceText.trim();
    const hasImage = compressedImage.length > 0;

    if (!trimmedSourceText && !hasImage) {
      setError("Indsæt tekst eller upload et billede, før du genererer løbet.");
      return;
    }

    if (trimmedSourceText.length > MAX_SOURCE_TEXT_LENGTH) {
      setError("Teksten er for lang. Kort materialet lidt ned og prøv igen.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceText: trimmedSourceText,
          imageBase64: compressedImage || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | GeneratedRunPayload
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "AI'en kunne ikke bygge løbet lige nu."
        );
      }

      if (!isGeneratedRunPayload(payload)) {
        throw new Error("AI'en returnerede et ugyldigt løbsformat.");
      }

      const draft = toManualDraft(payload, trimmedSourceText);
      writeRunDraft(MANUEL_DRAFT_STORAGE_KEY, null, draft);
      router.push("/dashboard/opret/manuel");
    } catch (requestError) {
      console.error("Fejl ved scanner-generering:", requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Noget gik galt. Prøv igen om et øjeblik."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main
      className={`min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.2),transparent_42%),linear-gradient(180deg,#06281f_0%,#03130f_100%)] px-6 py-10 text-emerald-50 ${poppins.className}`}
    >
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-950/60 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-900/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til løbstyper
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-semibold tracking-[0.22em] text-amber-100 uppercase">
            <Sparkles className="h-4 w-4" />
            AI-portal
          </span>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full items-center justify-center">
          <div className="w-full max-w-3xl rounded-[2rem] border border-emerald-400/15 bg-emerald-950/70 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-100">
                <Camera className="h-8 w-8" />
              </div>
              <p className="mt-6 text-xs font-semibold tracking-[0.32em] text-emerald-100/55 uppercase">
                Bog-Scanneren
              </p>
              <h1 className={`mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl ${rubik.className}`}>
                Hvad skal eleverne lære i dag?
              </h1>
              <p className="mt-4 text-base leading-relaxed text-emerald-100/75 sm:text-lg">
                Indsæt dagens tekst eller upload et billede af en bogside. AI&apos;en bygger et
                komplet quiz-løb, som lægges klar i Manuel-byggeren.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-2xl space-y-6">
              <div className="space-y-3">
                <label
                  htmlFor="scanner-source-text"
                  className="block text-sm font-semibold tracking-[0.16em] text-emerald-100/70 uppercase"
                >
                  Materiale som tekst
                </label>
                <textarea
                  id="scanner-source-text"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder="Indsæt tekst fra dagens lektie, bogside eller andet undervisningsmateriale..."
                  className="min-h-[220px] w-full rounded-[1.75rem] border border-emerald-400/20 bg-emerald-950/70 px-5 py-4 text-base leading-relaxed text-emerald-50 placeholder:text-emerald-100/35 focus:border-emerald-300/45 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
                <p className="text-sm text-emerald-100/55">
                  {sourceText.length}/{MAX_SOURCE_TEXT_LENGTH} tegn
                </p>
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="scanner-image-upload"
                  className="block text-sm font-semibold tracking-[0.16em] text-emerald-100/70 uppercase"
                >
                  Bogside som billede
                </label>
                <label
                  htmlFor="scanner-image-upload"
                  className="flex cursor-pointer items-center justify-center gap-3 rounded-[1.75rem] border border-dashed border-emerald-300/30 bg-emerald-900/30 px-5 py-6 text-center text-base text-emerald-100/85 transition hover:border-emerald-200/45 hover:bg-emerald-900/40"
                >
                  <Camera className="h-5 w-5" />
                  Upload et billede af en bogside
                </label>
                <input
                  id="scanner-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                />
                <p className="text-sm text-emerald-100/55">{helperText}</p>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleGenerateRun}
                disabled={isGenerating || isPreparingImage}
                className="inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-full bg-amber-400 px-6 py-4 text-base font-black tracking-wide text-emerald-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:bg-amber-300/70"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    ⏳ Læser materialet og bygger spørgsmål...
                  </>
                ) : isPreparingImage ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Klargør billede...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generér Løb
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
