"use client";

import { ArrowLeft, Camera, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import {
  clearRunDraft,
  clearSessionDraft,
  markDraftForAutoload,
  readRunDraft,
  readSessionDraft,
  restoreDraftString,
  shouldRestoreRunDraftOnLoad,
  writeSessionDraft,
  writeRunDraft,
} from "@/utils/runDrafts";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const MANUEL_DRAFT_STORAGE_KEY = "draft_run_manuel";
const SCANNER_DRAFT_STORAGE_KEY = "draft_run_scanner";
const SCANNER_IMAGE_SESSION_KEY = "scanner_image_draft";
const DEFAULT_LAT = 55.0;
const DEFAULT_LNG = 11.9;
const AI_REQUEST_TIMEOUT_MS = 20_000;
const MAX_SOURCE_TEXT_LENGTH = 18_000;
const MAX_IMAGE_FILE_SIZE = 12 * 1024 * 1024;
const MAX_IMAGE_DATA_LENGTH = 6_000_000;

const SUBJECT_TOPICS: Record<string, string[]> = {
  Dansk: [],
  Matematik: [],
  Engelsk: [],
  "Natur/Teknologi": [],
  Historie: [],
  Idræt: [],
  Kristendomskundskab: [],
  Tysk: [],
  Fransk: [],
  Geografi: [],
  Biologi: [],
  "Fysik/Kemi": [],
  Samfundsfag: [],
  "Håndværk/Design": [],
  Billedkunst: [],
  Madkundskab: [],
  Musik: [],
};

const AUDIENCE_OPTIONS = [
  { value: "Indskoling", label: "Indskoling" },
  { value: "Mellemtrin", label: "Mellemtrin" },
  { value: "Udskoling", label: "Udskoling" },
  { value: "Voksne", label: "Voksen" },
] as const;

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;

type Step = 1 | 2 | 3 | 4;
type SourceMode = "camera" | "upload" | "text";
type Audience = (typeof AUDIENCE_OPTIONS)[number]["value"];
type QuestionCount = (typeof QUESTION_COUNT_OPTIONS)[number];

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

type ScannerDraftState = {
  step: Step;
  sourceMode: SourceMode | null;
  subject: string;
  audience: Audience;
  questionCount: QuestionCount;
  sourceText: string;
  selectedImageLabel: string;
};

type ScannerImageSessionState = {
  compressedImage?: unknown;
};

function restoreSourceMode(value: unknown): SourceMode | null {
  return value === "camera" || value === "upload" || value === "text" ? value : null;
}

function restoreAudience(value: unknown): Audience {
  return AUDIENCE_OPTIONS.some((option) => option.value === value) ? (value as Audience) : "Mellemtrin";
}

function restoreQuestionCount(value: unknown): QuestionCount {
  return QUESTION_COUNT_OPTIONS.includes(value as QuestionCount) ? (value as QuestionCount) : 10;
}

function restoreStep(value: unknown): Step {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : 1;
}

function readFileAsDataUri(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
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

function toManualDraft(
  run: GeneratedRunPayload,
  sourceSummary: string,
  subject: string,
  audience: Audience
): ManualBuilderDraftState {
  const questions = toQuestions(run.questions);
  const normalizedSubject = subject.trim();
  const safeSummary =
    sourceSummary.trim().slice(0, 180) || "Scannet undervisningsmateriale";

  return {
    title: run.title.trim(),
    description: run.description.trim(),
    subject: normalizedSubject,
    showTeacherField: Boolean(normalizedSubject),
    showAITeacherFields: false,
    questions,
    aiRunBrief: safeSummary,
    aiSubject: normalizedSubject,
    aiTopic: safeSummary,
    aiGrade: audience,
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
  const hasInitializedDraftRef = useRef(false);
  const isMountedRef = useRef(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimersRef = useRef<number[]>([]);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [sourceMode, setSourceMode] = useState<SourceMode | null>(null);
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState<Audience>("Mellemtrin");
  const [questionCount, setQuestionCount] = useState<QuestionCount>(10);
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

  const progress = (step / 4) * 100;
  const trimmedSourceText = sourceText.trim();
  const canContinueFromStep2 =
    sourceMode === "text" ? trimmedSourceText.length > 0 : compressedImage.length > 0;
  const canContinueFromStep3 = subject.trim().length > 0;

  const helperText = isCapturingPhoto
    ? "Kameraet tager billede..."
    : isStartingCamera
      ? "Starter kamera..."
      : isPreparingImage
        ? "Klargør billede..."
        : selectedImageLabel ||
          (sourceMode === "camera"
            ? "Tag et tydeligt billede af bogsiden."
            : "Upload et tydeligt billede af bogsiden.");

  const selectedSourceLabel =
    sourceMode === "camera"
      ? "Kamera"
      : sourceMode === "upload"
        ? "Upload"
        : sourceMode === "text"
          ? "Tekst"
          : "";

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

  function resetSourceState(nextMode: SourceMode) {
    setSourceMode(nextMode);
    setError(null);
    stopCameraStream();
    setSelectedImageLabel("");
    setCompressedImage("");
    setSourceText("");
  }

  function handleSourceSelect(nextMode: SourceMode) {
    if (isGenerating) return;

    resetSourceState(nextMode);
    setStep(2);
  }

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopCameraStream({ skipStateReset: true });
    };
  }, []);

  useEffect(() => {
    if (hasInitializedDraftRef.current) return;

    const restoredDraft = shouldRestoreRunDraftOnLoad(SCANNER_DRAFT_STORAGE_KEY)
      ? readRunDraft<ScannerDraftState>(SCANNER_DRAFT_STORAGE_KEY, null)
      : null;

    if (restoredDraft) {
      const restoredImageDraft = readSessionDraft<ScannerImageSessionState>(SCANNER_IMAGE_SESSION_KEY);
      const restoredMode = restoreSourceMode(restoredDraft.sourceMode);
      const restoredSubject = restoreDraftString(restoredDraft.subject);
      const restoredSourceText = restoreDraftString(restoredDraft.sourceText);
      const restoredCompressedImage = restoreDraftString(restoredImageDraft?.compressedImage);
      const restoredStep = restoreStep(restoredDraft.step);
      const hasRestoredSourceInput =
        restoredMode === "text"
          ? restoredSourceText.trim().length > 0
          : restoredCompressedImage.trim().length > 0;

      let allowedStep: Step = 1;
      if (restoredMode) {
        allowedStep = 2;
      }
      if (restoredMode && hasRestoredSourceInput) {
        allowedStep = 3;
      }
      if (restoredMode && hasRestoredSourceInput && restoredSubject.trim().length > 0) {
        allowedStep = 4;
      }

      setSourceMode(restoredMode);
      setSubject(restoredSubject);
      setAudience(restoreAudience(restoredDraft.audience));
      setQuestionCount(restoreQuestionCount(restoredDraft.questionCount));
      setSourceText(restoredSourceText);
      setSelectedImageLabel(restoreDraftString(restoredDraft.selectedImageLabel));
      setCompressedImage(restoredCompressedImage);
      setStep(Math.min(restoredStep, allowedStep) as Step);
      setError(null);
    }

    hasInitializedDraftRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;

    writeRunDraft(SCANNER_DRAFT_STORAGE_KEY, null, {
      step,
      sourceMode,
      subject,
      audience,
      questionCount,
      sourceText,
      selectedImageLabel,
    } satisfies ScannerDraftState);
  }, [audience, compressedImage, questionCount, selectedImageLabel, sourceMode, sourceText, step, subject]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;

    if (compressedImage.trim().length > 0) {
      writeSessionDraft(SCANNER_IMAGE_SESSION_KEY, {
        compressedImage,
      } satisfies ScannerImageSessionState);
      return;
    }

    clearSessionDraft(SCANNER_IMAGE_SESSION_KEY);
  }, [compressedImage]);

  useEffect(() => {
    if (step !== 2 || sourceMode !== "text") return;

    const timeoutId = window.setTimeout(() => {
      textInputRef.current?.focus();
    }, 30);

    return () => window.clearTimeout(timeoutId);
  }, [sourceMode, step]);

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

  function handleStepTwoNext() {
    if (sourceMode === "text") {
      if (!trimmedSourceText) {
        setError("Indsæt først teksten, du vil bygge løbet ud fra.");
        return;
      }

      if (trimmedSourceText.length > MAX_SOURCE_TEXT_LENGTH) {
        setError("Teksten er for lang. Kort materialet lidt ned og prøv igen.");
        return;
      }
    } else if (!compressedImage) {
      setError("Tilføj først et billede af bogsiden, før du går videre.");
      return;
    }

    setError(null);
    setStep(3);
  }

  function handleStepThreeNext() {
    if (!canContinueFromStep3) {
      setError("Vælg et fag, så AI'en kan ramme den rigtige vinkel.");
      return;
    }

    setError(null);
    setStep(4);
  }

  function handleBack() {
    if (isGenerating || step === 1) return;

    setError(null);
    if (step === 2) {
      stopCameraStream();
      setStep(1);
      return;
    }

    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  }

  async function handleGenerateRun() {
    if (
      isGenerating ||
      isPreparingImage ||
      isStartingCamera ||
      isCapturingPhoto ||
      !sourceMode
    ) {
      return;
    }

    const hasImage = compressedImage.length > 0;
    const trimmedSubject = subject.trim();

    if (!trimmedSourceText && !hasImage) {
      setError("Tilføj først tekst eller billede, før du genererer løbet.");
      return;
    }

    if (!trimmedSubject) {
      setError("Vælg et fag, før du genererer løbet.");
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
          sourceText: trimmedSourceText || undefined,
          imageBase64: compressedImage || undefined,
          subject: trimmedSubject,
          audience,
          count: questionCount,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | GeneratedRunPayload
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof payload.error === "string"
            ? payload.error
            : "AI'en kunne ikke bygge løbet lige nu."
        );
      }

      if (!isGeneratedRunPayload(payload)) {
        throw new Error("AI'en returnerede et ugyldigt løbsformat.");
      }

      const sourceSummary =
        sourceMode === "text"
          ? trimmedSourceText
          : sourceMode === "camera"
            ? "Billede af bogside taget med kameraet"
            : "Uploadet billede af bogside";

      const draft = toManualDraft(payload, sourceSummary, trimmedSubject, audience);
      stopCameraStream();
      clearRunDraft(SCANNER_DRAFT_STORAGE_KEY);
      clearSessionDraft(SCANNER_IMAGE_SESSION_KEY);
      writeRunDraft(MANUEL_DRAFT_STORAGE_KEY, null, draft);
      markDraftForAutoload(MANUEL_DRAFT_STORAGE_KEY);
      router.push("/dashboard/opret/manuel");
    } catch (requestError) {
      console.error("Fejl ved scanner-generering:", requestError);
      setError(
        requestError instanceof Error && requestError.name === "AbortError"
          ? "AI'en var for længe om at svare. Prøv igen."
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
      className={`relative min-h-screen overflow-hidden bg-cyan-950 px-6 py-10 text-slate-100 ${poppins.className}`}
    >
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-cyan-900/50 via-slate-900/80 to-slate-950 backdrop-blur-[2px]" />
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/20 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til løbstyper
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold tracking-[0.22em] text-cyan-100 uppercase">
            <Sparkles className="h-4 w-4" />
            AI-portal
          </span>
        </div>

        <MobileBuilderWarning className="mx-auto w-full max-w-3xl" />

        <div className="mx-auto hidden min-h-[calc(100vh-10rem)] w-full items-center justify-center lg:flex">
          <div className="w-full max-w-2xl text-center">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold tracking-[0.24em] text-cyan-100/55 uppercase">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 1 || isGenerating}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tilbage
              </button>
              <span>Bog-Scanneren</span>
              <span>Trin {step}/4</span>
            </div>

            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-10 rounded-[2rem] border border-cyan-500/20 bg-white/[0.03] px-6 py-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-10 sm:py-14">
              {step === 1 ? (
                <>
                  <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300 uppercase">
                    Trin 1
                  </p>
                  <h1
                    className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                  >
                    Hvad vil du bygge løbet ud fra?
                  </h1>
                  <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-cyan-100/75 sm:text-lg">
                    Vælg én enkel kilde. Så guider vi dig resten af vejen og lader AI&apos;en
                    finde titel, beskrivelse og spørgsmål for dig.
                  </p>

                  <div className="mt-12 grid gap-4">
                    <button
                      type="button"
                      onClick={() => handleSourceSelect("camera")}
                      className="flex min-h-[110px] w-full flex-col items-center justify-center rounded-[1.75rem] border border-cyan-400/25 bg-cyan-500/10 px-6 py-7 text-center transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
                    >
                      <span className="text-3xl" aria-hidden="true">
                        📸
                      </span>
                      <span className="mt-3 text-xl font-bold text-white">
                        Tag et billede af bogen
                      </span>
                      <span className="mt-2 text-sm text-cyan-100/65">
                        Brug kameraet og scan bogsiden direkte.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSourceSelect("upload")}
                      className="flex min-h-[110px] w-full flex-col items-center justify-center rounded-[1.75rem] border border-cyan-400/25 bg-cyan-500/10 px-6 py-7 text-center transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
                    >
                      <span className="text-3xl" aria-hidden="true">
                        🖼️
                      </span>
                      <span className="mt-3 text-xl font-bold text-white">
                        Upload et billede
                      </span>
                      <span className="mt-2 text-sm text-cyan-100/65">
                        Vælg et billede af bogsiden fra computeren.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSourceSelect("text")}
                      className="flex min-h-[110px] w-full flex-col items-center justify-center rounded-[1.75rem] border border-cyan-400/25 bg-cyan-500/10 px-6 py-7 text-center transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
                    >
                      <span className="text-3xl" aria-hidden="true">
                        ✍️
                      </span>
                      <span className="mt-3 text-xl font-bold text-white">
                        Indsæt tekst
                      </span>
                      <span className="mt-2 text-sm text-cyan-100/65">
                        Kopiér teksten direkte ind og byg løbet ud fra den.
                      </span>
                    </button>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300 uppercase">
                    Trin 2
                  </p>
                  <h2
                    className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                  >
                    {sourceMode === "camera"
                      ? "Tag et tydeligt billede"
                      : sourceMode === "upload"
                        ? "Upload bogsiden"
                        : "Indsæt teksten"}
                  </h2>
                  <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-cyan-100/75 sm:text-lg">
                    {sourceMode === "text"
                      ? "Indsæt den tekst, som AI'en skal bygge quiz-løbet ud fra."
                      : "Brug et klart billede, så AI'en kan læse og forstå materialet præcist."}
                  </p>

                  <div className="mt-10 space-y-5 text-left">
                    {sourceMode === "text" ? (
                      <>
                        <textarea
                          ref={textInputRef}
                          value={sourceText}
                          onChange={(event) => setSourceText(event.target.value)}
                          placeholder="Indsæt tekst fra dagens lektie, bogside eller andet undervisningsmateriale..."
                          className="min-h-[260px] w-full rounded-[1.75rem] border border-cyan-500/30 bg-cyan-950/20 px-5 py-4 text-base leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <p className="text-center text-sm text-cyan-100/55">
                          {sourceText.length}/{MAX_SOURCE_TEXT_LENGTH} tegn
                        </p>
                      </>
                    ) : null}

                    {sourceMode === "upload" ? (
                      <>
                        <label
                          htmlFor="scanner-image-upload"
                          className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-cyan-400/35 bg-cyan-500/10 px-6 py-8 text-center transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
                        >
                          <span className="text-4xl" aria-hidden="true">
                            🖼️
                          </span>
                          <span className="mt-4 text-xl font-bold text-white">
                            Klik for at vælge et billede
                          </span>
                          <span className="mt-2 text-sm text-cyan-100/65">
                            JPG, PNG eller andet tydeligt foto af en bogside.
                          </span>
                        </label>
                        <input
                          id="scanner-image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="sr-only"
                        />
                      </>
                    ) : null}

                    {sourceMode === "camera" ? (
                      <>
                        {!isCameraActive && !compressedImage ? (
                          <button
                            type="button"
                            onClick={startCamera}
                            disabled={isStartingCamera || isPreparingImage || isGenerating}
                            className="inline-flex min-h-[88px] w-full items-center justify-center gap-3 rounded-[1.75rem] border border-cyan-400/25 bg-cyan-500 px-6 py-5 text-lg font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-70"
                          >
                            {isStartingCamera ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Starter kamera...
                              </>
                            ) : (
                              <>
                                <Camera className="h-5 w-5" />
                                Start kamera
                              </>
                            )}
                          </button>
                        ) : null}

                        {isCameraActive ? (
                          <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-500/30 bg-cyan-950/20">
                            <video
                              ref={videoRef}
                              autoPlay
                              muted
                              playsInline
                              className="h-[340px] w-full object-cover"
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
                                className="inline-flex min-h-[60px] items-center justify-center gap-3 rounded-full bg-cyan-500 px-8 py-4 text-base font-black tracking-wide text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:cursor-wait disabled:bg-cyan-400/70"
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
                      </>
                    ) : null}

                    {compressedImage ? (
                      <div className="overflow-hidden rounded-[1.75rem] border border-cyan-500/20 bg-cyan-950/20">
                        <Image
                          src={compressedImage}
                          alt="Valgt bogside"
                          width={1200}
                          height={780}
                          unoptimized
                          className="h-[260px] w-full object-cover"
                        />
                      </div>
                    ) : null}

                    {sourceMode === "camera" && compressedImage ? (
                      <button
                        type="button"
                        onClick={startCamera}
                        disabled={isStartingCamera || isPreparingImage || isGenerating}
                        className="inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-full border border-cyan-500/30 bg-white/5 px-6 py-4 text-base font-semibold text-cyan-100 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
                      >
                        {isStartingCamera ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Starter kamera...
                          </>
                        ) : (
                          "Tag et nyt billede"
                        )}
                      </button>
                    ) : null}

                    <canvas ref={captureCanvasRef} className="hidden" />

                    {sourceMode !== "text" ? (
                      <p className="text-center text-sm text-cyan-100/55">{helperText}</p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handleStepTwoNext}
                    disabled={!canContinueFromStep2 || isPreparingImage || isStartingCamera || isCapturingPhoto}
                    className="mt-10 inline-flex min-h-[60px] w-full items-center justify-center rounded-full bg-cyan-500 px-6 py-4 text-base font-black uppercase tracking-widest text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-400/50"
                  >
                    Næste
                  </button>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300 uppercase">
                    Trin 3
                  </p>
                  <h2
                    className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                  >
                    Lidt detaljer om løbet
                  </h2>
                  <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-cyan-100/75 sm:text-lg">
                    Nu finjusterer du fag, niveau og længde, så AI&apos;en rammer rigtigt første
                    gang.
                  </p>

                  <div className="mt-10 space-y-8 text-left">
                    <div className="space-y-3">
                      <label
                        htmlFor="scanner-subject"
                        className="block text-sm font-semibold tracking-[0.16em] text-cyan-100/70 uppercase"
                      >
                        Fag
                      </label>
                      <select
                        id="scanner-subject"
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        className="w-full appearance-none rounded-[1.5rem] border border-cyan-500/30 bg-cyan-950/20 px-5 py-4 text-base text-cyan-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="" className="bg-slate-900 text-white">
                          Vælg et fag...
                        </option>
                        {Object.keys(SUBJECT_TOPICS).map((subjectOption) => (
                          <option
                            key={subjectOption}
                            value={subjectOption}
                            className="bg-slate-900 text-white"
                          >
                            {subjectOption}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-semibold tracking-[0.16em] text-cyan-100/70 uppercase">
                        Målgruppe
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {AUDIENCE_OPTIONS.map((option) => {
                          const isSelected = audience === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setAudience(option.value)}
                              className={`min-h-[76px] rounded-[1.5rem] border px-5 py-4 text-base font-semibold transition ${
                                isSelected
                                  ? "border-cyan-300 bg-cyan-400/20 text-white"
                                  : "border-cyan-500/20 bg-white/5 text-cyan-100 hover:bg-white/10"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-semibold tracking-[0.16em] text-cyan-100/70 uppercase">
                        Antal poster
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {QUESTION_COUNT_OPTIONS.map((countOption) => {
                          const isSelected = questionCount === countOption;
                          return (
                            <button
                              key={countOption}
                              type="button"
                              onClick={() => setQuestionCount(countOption)}
                              className={`min-h-[76px] rounded-[1.5rem] border px-5 py-4 text-base font-semibold transition ${
                                isSelected
                                  ? "border-cyan-300 bg-cyan-400/20 text-white"
                                  : "border-cyan-500/20 bg-white/5 text-cyan-100 hover:bg-white/10"
                              }`}
                            >
                              {countOption} poster
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStepThreeNext}
                    disabled={!canContinueFromStep3}
                    className="mt-10 inline-flex min-h-[60px] w-full items-center justify-center rounded-full bg-cyan-500 px-6 py-4 text-base font-black uppercase tracking-widest text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-400/50"
                  >
                    Næste
                  </button>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300 uppercase">
                    Trin 4
                  </p>
                  <h2
                    className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                  >
                    Generér løbet
                  </h2>
                  <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-cyan-100/75 sm:text-lg">
                    AI&apos;en bygger nu et komplet quiz-løb ud fra dit materiale og sender det
                    direkte videre til Manuel-byggeren.
                  </p>

                  <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                    {selectedSourceLabel ? (
                      <span className="rounded-full border border-cyan-500/20 bg-white/5 px-4 py-2 text-sm text-cyan-100">
                        Kilde: {selectedSourceLabel}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-cyan-500/20 bg-white/5 px-4 py-2 text-sm text-cyan-100">
                      Fag: {subject}
                    </span>
                    <span className="rounded-full border border-cyan-500/20 bg-white/5 px-4 py-2 text-sm text-cyan-100">
                      Målgruppe: {AUDIENCE_OPTIONS.find((option) => option.value === audience)?.label}
                    </span>
                    <span className="rounded-full border border-cyan-500/20 bg-white/5 px-4 py-2 text-sm text-cyan-100">
                      Antal poster: {questionCount}
                    </span>
                  </div>

                  <div className="mt-10">
                    {isGenerating ? (
                      <div className="rounded-[1.75rem] border border-cyan-500/20 bg-cyan-500/10 px-6 py-12 text-center">
                        <Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-200" />
                        <p className="mt-6 text-2xl font-bold text-white">
                          AI&apos;en læser materialet...
                        </p>
                        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-cyan-100/70">
                          Vi bygger titel, beskrivelse og præcis det antal poster, du har valgt.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGenerateRun}
                        className="inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-full bg-cyan-500 px-6 py-4 text-base font-black uppercase tracking-widest text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
                      >
                        <Sparkles className="h-5 w-5" />
                        Generér løb
                      </button>
                    )}
                  </div>
                </>
              ) : null}

              {error ? (
                <div className="mt-8 rounded-[1.5rem] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
