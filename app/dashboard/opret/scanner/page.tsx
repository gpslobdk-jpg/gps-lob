"use client";

import { ArrowLeft, Camera, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

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
const AI_REQUEST_TIMEOUT_MS = 20_000;
const MAX_SOURCE_TEXT_LENGTH = 18_000;
const MAX_IMAGE_FILE_SIZE = 12 * 1024 * 1024;
const MAX_IMAGE_DATA_LENGTH = 6_000_000;

type GeneratedQuestion = {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
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
  lat: null;
  lng: null;
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
    lat: null,
    lng: null,
  }));
}

function toManualDraft(run: GeneratedRunPayload, sourceText: string): ManualBuilderDraftState {
  const questions = toQuestions(run.questions);
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
      lat: DEFAULT_LAT,
      lng: DEFAULT_LNG,
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
  const isMountedRef = useRef(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimersRef = useRef<number[]>([]);

  const [sourceText, setSourceText] = useState("");
  const [selectedImageLabel, setSelectedImageLabel] = useState("");
  const [compressedImage, setCompressedImage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const helperText = isCapturingPhoto
    ? "Kameraet tager billede..."
    : isStartingCamera
      ? "Starter kamera..."
      : isPreparingImage
        ? "Klargør billede..."
        : selectedImageLabel || "Du kan indsætte tekst, uploade et billede eller bruge begge dele.";

  function stopCameraStream(options?: { skipStateReset?: boolean }) {
    const skipStateReset = options?.skipStateReset ?? false;

    if (typeof window !== "undefined") {
      for (const timer of countdownTimersRef.current) {
        window.clearTimeout(timer);
      }
    }

    countdownTimersRef.current = [];
    if (!skipStateReset) {
      setCountdownValue(null);
      setIsCapturingPhoto(false);
    }

    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (!skipStateReset) {
      setIsCameraActive(false);
    }
  }

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopCameraStream({ skipStateReset: true });
    };
  }, []);

  async function startCamera() {
    if (isStartingCamera || isPreparingImage || isGenerating || isCapturingPhoto) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setError("Din browser understøtter ikke kameraadgang på denne side.");
      return;
    }

    setError(null);
    setIsStartingCamera(true);

    try {
      stopCameraStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }

      setSelectedImageLabel("");
      setCompressedImage("");
      setIsCameraActive(true);
    } catch (cameraError) {
      console.error("Fejl ved kameraadgang:", cameraError);
      if (!isMountedRef.current) return;
      setError("Kameraadgang blev afvist eller kunne ikke startes. Prøv igen.");
      stopCameraStream();
    } finally {
      if (isMountedRef.current) {
        setIsStartingCamera(false);
      }
    }
  }

  function captureFrameFromVideo() {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) {
      throw new Error("Kameraet er ikke klar endnu.");
    }

    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const longestSide = Math.max(sourceWidth, sourceHeight, 1);
    const scale = longestSide > 1080 ? 1080 / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Kunne ikke gøre kamera-billedet klar.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(video, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/jpeg", 0.7);
  }

  function handleTakePhoto() {
    if (!isCameraActive || isCapturingPhoto || isGenerating || isPreparingImage) return;

    setError(null);
    setIsCapturingPhoto(true);
    setCountdownValue(3);

    const timers = [2, 1].map((value, index) =>
      window.setTimeout(() => {
        setCountdownValue(value);
      }, (index + 1) * 1000)
    );

    const captureTimer = window.setTimeout(() => {
      try {
        const dataUrl = captureFrameFromVideo();
        if (!dataUrl || dataUrl.length > MAX_IMAGE_DATA_LENGTH) {
          throw new Error("Billedet blev for stort. Prøv igen med et roligere udsnit.");
        }

        setSelectedImageLabel("Billede taget med kameraet");
        setCompressedImage(dataUrl);
        stopCameraStream();
      } catch (captureError) {
        console.error("Fejl ved kameracapture:", captureError);
        setError(
          captureError instanceof Error
            ? captureError.message
            : "Kunne ikke tage billedet. Prøv igen."
        );
        stopCameraStream();
      }
    }, 3000);

    countdownTimersRef.current = [...timers, captureTimer];
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);

    if (!file) {
      setSelectedImageLabel("");
      setCompressedImage("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSelectedImageLabel("");
      setCompressedImage("");
      setError("Vælg et gyldigt billede af en bogside.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setSelectedImageLabel("");
      setCompressedImage("");
      setError("Billedet er for stort. Vælg et billede under 12 MB.");
      event.target.value = "";
      return;
    }

    stopCameraStream();
    setIsPreparingImage(true);

    try {
      const dataUrl = await compressScannerImage(file);
      if (!dataUrl || dataUrl.length > MAX_IMAGE_DATA_LENGTH) {
        throw new Error("Billedet er stadig for stort efter komprimering.");
      }

      setSelectedImageLabel(`Valgt billede: ${file.name}`);
      setCompressedImage(dataUrl);
    } catch (compressionError) {
      console.error("Fejl ved billedkomprimering:", compressionError);
      setSelectedImageLabel("");
      setCompressedImage("");
      setError("Kunne ikke klargøre billedet. Prøv et andet udsnit eller et mindre billede.");
      event.target.value = "";
    } finally {
      setIsPreparingImage(false);
    }
  }

  async function handleGenerateRun() {
    if (isGenerating || isPreparingImage || isStartingCamera || isCapturingPhoto) return;

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
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, AI_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/generate-run", {
        method: "POST",
        signal: controller.signal,
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
      stopCameraStream();
      writeRunDraft(MANUEL_DRAFT_STORAGE_KEY, null, draft);
      window.sessionStorage.setItem("autoLoadDraft", "true");
      router.push("/dashboard/opret/manuel");
    } catch (requestError) {
      console.error("Fejl ved scanner-generering:", requestError);
      setError(
        requestError instanceof Error && requestError.name === "AbortError"
          ? "AI'en var for længe om at svare, prøv igen."
          : requestError instanceof Error
          ? requestError.message
          : "Noget gik galt. Prøv igen om et øjeblik."
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  }

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-slate-950 px-6 py-10 text-slate-100 ${poppins.className}`}
    >
      <div className="fixed inset-0 -z-10 bg-slate-950/70 backdrop-blur-[2px]" />
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-900/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til løbstyper
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold tracking-[0.22em] text-slate-100 uppercase">
            <Sparkles className="h-4 w-4" />
            AI-portal
          </span>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full items-center justify-center">
          <div className="w-full max-w-3xl rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-slate-100">
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
                  className="min-h-[220px] w-full rounded-3xl border border-slate-700 bg-slate-900/50 px-5 py-4 text-base leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    htmlFor="scanner-image-upload"
                    className="flex cursor-pointer items-center justify-center gap-3 rounded-3xl border border-emerald-500/20 bg-slate-900/60 px-5 py-6 text-center text-base text-slate-200 transition hover:border-emerald-500/50 hover:bg-slate-800/80 backdrop-blur-xl"
                  >
                    <Camera className="h-5 w-5" />
                    Upload et billede
                  </label>
                  {isCameraActive ? (
                    <div className="flex min-h-[72px] items-center justify-center rounded-3xl border border-emerald-500/20 bg-slate-900/60 px-5 py-6 text-center text-base font-semibold text-slate-100 backdrop-blur-xl">
                      Kamera aktivt
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={isStartingCamera || isPreparingImage || isGenerating || isCapturingPhoto}
                      className="inline-flex min-h-[72px] items-center justify-center gap-3 rounded-[1.75rem] border border-emerald-500/30 bg-emerald-500 px-5 py-6 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-70"
                    >
                      {isStartingCamera ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Starter kamera...
                        </>
                      ) : (
                        <>
                          <Camera className="h-5 w-5" />
                          📸 Start Kamera
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  id="scanner-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                />

                {isCameraActive ? (
                  <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-900/60 backdrop-blur-xl">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-[320px] w-full object-cover sm:h-[380px]"
                    />
                    {countdownValue !== null ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <span
                          className={`text-7xl font-black text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.55)] ${rubik.className}`}
                        >
                          {countdownValue}
                        </span>
                      </div>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 flex justify-center p-5">
                      <button
                        type="button"
                        onClick={handleTakePhoto}
                        disabled={isCapturingPhoto || isGenerating || isPreparingImage}
                        className="inline-flex min-h-[60px] items-center justify-center gap-3 rounded-full bg-emerald-500 px-8 py-4 text-base font-black tracking-wide text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-wait disabled:bg-emerald-400/70"
                      >
                        {isCapturingPhoto ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Tager billede...
                          </>
                        ) : (
                          <>
                            <Camera className="h-5 w-5" />
                            Tag billede
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}

                <canvas ref={captureCanvasRef} className="hidden" />
                <p className="text-sm text-emerald-100/55">{helperText}</p>
              </div>

              {error ? (
                <div className="rounded-3xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 backdrop-blur-xl">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleGenerateRun}
                disabled={isGenerating || isPreparingImage || isStartingCamera || isCapturingPhoto}
                className="inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-full bg-emerald-500 px-6 py-4 text-base font-black tracking-wide text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-wait disabled:bg-emerald-400/70"
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
