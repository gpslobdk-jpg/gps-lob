"use client";

import { ArrowLeft, Loader2, Trash2, Camera, Images, FileText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import { RACE_TYPES } from "@/utils/gpsRuns";
import {
  clearRunDraft,
  clearSessionDraft,
  markDraftForAutoload,
  readRunDraft,
  readSessionDraft,
  restoreDraftString,
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
const DEFAULT_RUN_RADIUS = 15;
const AI_REQUEST_TIMEOUT_MS = 45_000;
const MAX_SOURCE_TEXT_LENGTH = 18_000;
const MAX_IMAGE_FILE_SIZE = 12 * 1024 * 1024;
const MAX_IMAGE_DATA_LENGTH = 6_000_000;
const MAX_UPLOAD_IMAGES = 5;

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
  radius: number;
  showTeacherField: boolean;
  showAiInterviewModal: boolean;
  questions: ManualDraftQuestion[];
  mapCenter: {
    lat: number;
    lng: number;
  };
  overrideRaceType: typeof RACE_TYPES.SCANNER;
};

type ScannerDraftState = {
  step: Step;
  sourceMode: SourceMode | null;
  subject: string;
  audience: Audience;
  questionCount: QuestionCount;
  sourceText: string;
  selectedImageLabels: string[];
};

type ScannerImageSessionState = {
  compressedImages?: unknown;
};

function restoreStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

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
  _sourceSummary: string,
  subject: string,
  _audience: Audience
): ManualBuilderDraftState {
  const questions = toQuestions(run.questions);
  const normalizedSubject = subject.trim();

  return {
    title: run.title.trim(),
    description: run.description.trim(),
    subject: normalizedSubject,
    radius: DEFAULT_RUN_RADIUS,
    showTeacherField: Boolean(normalizedSubject),
    showAiInterviewModal: false,
    questions,
    mapCenter: {
      lat: DEFAULT_LAT,
      lng: DEFAULT_LNG,
    },
    overrideRaceType: RACE_TYPES.SCANNER,
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
  const [selectedImageLabels, setSelectedImageLabels] = useState<string[]>([]);
  const [compressedImages, setCompressedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isDragOverUpload, setIsDragOverUpload] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const progress = (step / 4) * 100;
  const trimmedSourceText = sourceText.trim();
  const canContinueFromStep2 =
    sourceMode === "text" ? trimmedSourceText.length > 0 : compressedImages.length > 0;
  const canContinueFromStep3 = subject.trim().length > 0;

  const selectedImageCount = compressedImages.length;

  const helperText = isCapturingPhoto
    ? "Kameraet tager billede..."
    : isStartingCamera
      ? "Starter kamera..."
      : isPreparingImage
        ? "Klargør billede..."
        : selectedImageCount > 0
          ? `${selectedImageCount} ${selectedImageCount === 1 ? "side valgt" : "sider valgt"}`
          :
          (sourceMode === "camera"
            ? "Tag et tydeligt billede af bogsiden."
            : "Upload op til 5 tydelige billeder af bogsiderne.");

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
    setInfoMessage(null);
    stopCameraStream();
    setSelectedImageLabels([]);
    setCompressedImages([]);
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

    const restoredDraft = readRunDraft<ScannerDraftState>(SCANNER_DRAFT_STORAGE_KEY, null);

    if (restoredDraft) {
      const restoredImageDraft = readSessionDraft<ScannerImageSessionState>(SCANNER_IMAGE_SESSION_KEY);
      const restoredMode = restoreSourceMode(restoredDraft.sourceMode);
      const restoredSubject = restoreDraftString(restoredDraft.subject);
      const restoredSourceText = restoreDraftString(restoredDraft.sourceText);
      const restoredCompressedImages = restoreStringArray(restoredImageDraft?.compressedImages);
      const restoredStep = restoreStep(restoredDraft.step);
      const hasRestoredSourceInput =
        restoredMode === "text"
          ? restoredSourceText.trim().length > 0
          : restoredCompressedImages.length > 0;

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
      setSelectedImageLabels(restoreStringArray(restoredDraft.selectedImageLabels));
      setCompressedImages(restoredCompressedImages);
      setStep(Math.min(restoredStep, allowedStep) as Step);
      setError(null);
      setInfoMessage(null);
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
      selectedImageLabels,
    } satisfies ScannerDraftState);
  }, [audience, questionCount, selectedImageLabels, sourceMode, sourceText, step, subject]);

  useEffect(() => {
    if (!hasInitializedDraftRef.current) return;

    if (compressedImages.length > 0) {
      writeSessionDraft(SCANNER_IMAGE_SESSION_KEY, {
        compressedImages,
      } satisfies ScannerImageSessionState);
      return;
    }

    clearSessionDraft(SCANNER_IMAGE_SESSION_KEY);
  }, [compressedImages]);

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
    setInfoMessage(null);
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

    if (compressedImages.length >= MAX_UPLOAD_IMAGES) {
      setError("Du har allerede valgt 5 billeder. Fjern et billede for at tilføje et nyt.");
      setInfoMessage(null);
      stopCameraStream();
      return;
    }

    setError(null);
    setInfoMessage(null);
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

        setSelectedImageLabels((prev) => [
          ...prev,
          `Billede taget med kameraet ${prev.length + 1}`,
        ]);
        setCompressedImages((prev) => [...prev, dataUrl]);
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

  async function appendFilesToScanner(files: File[]) {
    setError(null);
    setInfoMessage(null);

    if (files.length === 0) {
      return;
    }

    const remainingSlots = MAX_UPLOAD_IMAGES - compressedImages.length;
    if (remainingSlots <= 0) {
      setError("Du har allerede valgt 5 billeder. Fjern et billede for at tilføje et nyt.");
      return;
    }

    const nextFiles = files.slice(0, remainingSlots);
    if (nextFiles.length < files.length) {
      setInfoMessage(
        `Du kan have maks ${MAX_UPLOAD_IMAGES} billeder ad gangen. Kun de første ${nextFiles.length} nye billeder blev tilføjet.`
      );
    }

    if (nextFiles.some((file) => !file.type.startsWith("image/"))) {
      setError("Vælg gyldige billeder af bogsider.");
      return;
    }

    if (nextFiles.some((file) => file.size > MAX_IMAGE_FILE_SIZE)) {
      setError("Et af billederne er for stort. Vælg billeder under 12 MB.");
      return;
    }

    stopCameraStream();
    setIsPreparingImage(true);

    try {
      const dataUrls = await Promise.all(nextFiles.map((file) => compressScannerImage(file)));
      if (dataUrls.some((dataUrl) => !dataUrl || dataUrl.length > MAX_IMAGE_DATA_LENGTH)) {
        throw new Error("Et eller flere billeder er stadig for store efter komprimering.");
      }

      setSelectedImageLabels((prev) => [...prev, ...nextFiles.map((file) => file.name)]);
      setCompressedImages((prev) => [...prev, ...dataUrls]);
    } catch (compressionError) {
      console.error("Fejl ved billedkomprimering:", compressionError);
      setError("Kunne ikke klargøre billederne. Prøv et andet udsnit eller mindre filer.");
    } finally {
      setIsPreparingImage(false);
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    await appendFilesToScanner(files);
    event.target.value = "";
  }

  function handleUploadDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (isPreparingImage || isGenerating) return;
    setIsDragOverUpload(true);
  }

  function handleUploadDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOverUpload(false);
  }

  async function handleUploadDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (isPreparingImage || isGenerating) return;

    setIsDragOverUpload(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    await appendFilesToScanner(files);
  }

  function handleRemoveImage(indexToRemove: number) {
    setError(null);
    setInfoMessage(null);
    setSelectedImageLabels((prev) => prev.filter((_, index) => index !== indexToRemove));
    setCompressedImages((prev) => prev.filter((_, index) => index !== indexToRemove));
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
    } else if (compressedImages.length === 0) {
      setError("Tilføj først mindst ét billede af bogsiderne, før du går videre.");
      return;
    }

    setError(null);
    setInfoMessage(null);
    setStep(3);
  }

  function handleStepThreeNext() {
    if (!canContinueFromStep3) {
      setError("Vælg et fag, så AI'en kan ramme den rigtige vinkel.");
      return;
    }

    setError(null);
    setInfoMessage(null);
    setStep(4);
  }

  function handleBack() {
    if (isGenerating || step === 1) return;

    setError(null);
    setInfoMessage(null);
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

    const hasImage = compressedImages.length > 0;
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
    setInfoMessage(null);
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
          imageBase64List: compressedImages.length > 0 ? compressedImages : undefined,
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
            : `${compressedImages.length} uploadede billeder af bogsider`;

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
          ? "AI'en er stadig i gang med at læse materialet. Prøv igen om et øjeblik."
          : requestError instanceof Error
            ? requestError.message
            : "Noget gik galt, mens løbet blev bygget. Prøv igen om et øjeblik."
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
      <div className="fixed inset-0 -z-20 bg-linear-to-br from-[#18071f] via-slate-950 to-slate-950" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(216,180,254,0.18),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(168,85,247,0.12),transparent_24%),radial-gradient(circle_at_18%_100%,rgba(255,255,255,0.08),transparent_20%)] backdrop-blur-[2px]" />

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-md transition hover:border-white/25 hover:bg-white/8 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til løbstyper
          </Link>
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-white/55 backdrop-blur-md">
            Bog-Scanner
          </span>
        </div>

        <MobileBuilderWarning className="mx-auto w-full max-w-3xl" />

        <div className="mx-auto hidden min-h-[calc(100vh-10rem)] w-full items-center justify-center lg:flex">
          <div className="w-full max-w-3xl text-center">
            <div className="flex items-center justify-between gap-4 text-[11px] font-medium uppercase tracking-[0.28em] text-white/45">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 1 || isGenerating}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/75 backdrop-blur-md transition hover:border-white/25 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tilbage
              </button>
              <span>Scannerflow</span>
              <span>Trin {step}/4</span>
            </div>

            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-linear-to-r from-fuchsia-200 via-fuchsia-300 to-violet-200 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-10 rounded-4xl border border-white/15 bg-white/4 px-6 py-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-10 sm:py-14">
              {step === 1 ? (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-fuchsia-200/75">
                    Trin 1
                  </p>
                  <h1
                    className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl ${rubik.className}`}
                  >
                    Vælg dit udgangspunkt
                  </h1>
                  <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
                    Vælg den kilde, du vil bygge fra. Resten af flowet holder sig let,
                    præcist og klar til at sende videre til builderen.
                  </p>

                  <div className="mt-12 grid gap-4 text-left">
                    <button
                      type="button"
                      onClick={() => handleSourceSelect("camera")}
                      className="group flex min-h-28 w-full flex-col justify-center rounded-4xl border border-white/15 bg-white/5 px-6 py-6 text-center backdrop-blur-md transition hover:border-fuchsia-200/30 hover:bg-white/8 hover:shadow-[0_18px_40px_rgba(168,85,247,0.12)]"
                    >
                      <Camera
                        className="w-12 h-12 mx-auto mb-4 text-slate-300 drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                        strokeWidth={1.5}
                      />
                      <span className="text-[11px] font-medium uppercase tracking-[0.26em] text-white/45">
                        Live capture
                      </span>
                      <span className="mt-3 text-2xl font-semibold tracking-tight text-white">
                        Tag et billede af bogsiden
                      </span>
                      <span className="mt-2 text-sm leading-6 text-white/60">
                        Brug kameraet og scan siden direkte, når materialet ligger foran dig.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSourceSelect("upload")}
                      className="group flex min-h-28 w-full flex-col justify-center rounded-4xl border border-white/15 bg-white/5 px-6 py-6 text-center backdrop-blur-md transition hover:border-fuchsia-200/30 hover:bg-white/8 hover:shadow-[0_18px_40px_rgba(168,85,247,0.12)]"
                    >
                      <Images
                        className="w-12 h-12 mx-auto mb-4 text-slate-300 drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                        strokeWidth={1.5}
                      />
                      <span className="text-[11px] font-medium uppercase tracking-[0.26em] text-white/45">
                        Billeder
                      </span>
                      <span className="mt-3 text-2xl font-semibold tracking-tight text-white">
                        Upload bogsider
                      </span>
                      <span className="mt-2 text-sm leading-6 text-white/60">
                        Træk billeder ind eller vælg op til 5 tydelige sider fra computeren.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSourceSelect("text")}
                      className="group flex min-h-28 w-full flex-col justify-center rounded-4xl border border-white/15 bg-white/5 px-6 py-6 text-center backdrop-blur-md transition hover:border-fuchsia-200/30 hover:bg-white/8 hover:shadow-[0_18px_40px_rgba(168,85,247,0.12)]"
                    >
                      <FileText
                        className="w-12 h-12 mx-auto mb-4 text-slate-300 drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                        strokeWidth={1.5}
                      />
                      <span className="text-[11px] font-medium uppercase tracking-[0.26em] text-white/45">
                        Tekst
                      </span>
                      <span className="mt-3 text-2xl font-semibold tracking-tight text-white">
                        Indsæt et tekstudsnit
                      </span>
                      <span className="mt-2 text-sm leading-6 text-white/60">
                        Kopiér indholdet direkte ind og lad AI&apos;en bygge spørgsmålene ud fra det.
                      </span>
                    </button>
                  </div>

                  <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-6 text-white/45">
                    Husk altid at overholde gældende regler for ophavsret, når du bruger tekster.
                    {" "}
                    <Link
                      href="/ophavsret"
                      className="font-medium text-fuchsia-100 underline decoration-fuchsia-200/35 underline-offset-4 transition hover:text-white"
                    >
                      Læs mere om Ophavsret &amp; AI
                    </Link>
                    .
                  </p>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-fuchsia-200/75">
                    Trin 2
                  </p>
                  <h2
                    className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl ${rubik.className}`}
                  >
                    {sourceMode === "camera"
                      ? "Gør materialet læsbart"
                      : sourceMode === "upload"
                        ? "Indlæs bogsiderne"
                        : "Indsæt materialet"}
                  </h2>
                  <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
                    {sourceMode === "text"
                      ? "Indsæt den tekst, som AI'en skal bygge løbet ud fra. Hold det skarpt og relevant."
                      : sourceMode === "upload"
                        ? "Upload op til 5 klare billeder, så AI'en kan læse og forstå materialet med høj præcision."
                        : "Tag et roligt og tydeligt billede, så teksten står skarpt for AI'en."}
                  </p>

                  {selectedSourceLabel ? (
                    <div className="mt-6 flex justify-center">
                      <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-white/55 backdrop-blur-md">
                        Kilde: {selectedSourceLabel}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-10 space-y-5 text-left">
                    {sourceMode === "text" ? (
                      <>
                        <textarea
                          ref={textInputRef}
                          value={sourceText}
                          onChange={(event) => setSourceText(event.target.value)}
                          placeholder="Indsæt tekst fra bogside, lektie eller andet undervisningsmateriale..."
                          className="min-h-65 w-full rounded-4xl border border-white/15 bg-white/5 px-5 py-4 text-base leading-relaxed text-white placeholder:text-white/30 backdrop-blur-md outline-none transition focus:border-fuchsia-200/30 focus:bg-white/7 focus:ring-2 focus:ring-fuchsia-200/15"
                        />
                        <p className="text-center text-sm text-white/45">
                          {sourceText.length}/{MAX_SOURCE_TEXT_LENGTH} tegn
                        </p>
                      </>
                    ) : null}

                    {sourceMode === "upload" ? (
                      <>
                        <label
                          htmlFor="scanner-image-upload"
                          onDragOver={handleUploadDragOver}
                          onDragEnter={handleUploadDragOver}
                          onDragLeave={handleUploadDragLeave}
                          onDrop={handleUploadDrop}
                          className={`flex min-h-45 cursor-pointer flex-col items-center justify-center rounded-4xl border border-dashed px-6 py-8 text-center backdrop-blur-md transition ${
                            isDragOverUpload
                              ? "border-fuchsia-200/35 bg-white/10 shadow-[0_18px_40px_rgba(168,85,247,0.12)]"
                              : "border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/8"
                          }`}
                        >
                          <span className="text-[11px] font-medium uppercase tracking-[0.26em] text-white/45">
                            Upload
                          </span>
                          <span className="mt-4 text-2xl font-semibold tracking-tight text-white">
                            {isDragOverUpload ? "Slip billederne her" : "Klik eller slip billeder her"}
                          </span>
                          <span className="mt-2 max-w-lg text-sm leading-6 text-white/60">
                            JPG, PNG eller andre tydelige fotos af bogsider. Maks 5 billeder.
                          </span>
                        </label>
                        <input
                          id="scanner-image-upload"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageChange}
                          className="sr-only"
                        />
                      </>
                    ) : null}

                    {sourceMode === "camera" ? (
                      <>
                        {!isCameraActive && compressedImages.length === 0 ? (
                          <button
                            type="button"
                            onClick={startCamera}
                            disabled={isStartingCamera || isPreparingImage || isGenerating}
                            className="inline-flex min-h-22 w-full items-center justify-center gap-3 rounded-4xl border border-white/20 bg-white/8 px-6 py-5 text-base font-semibold text-white backdrop-blur-md transition hover:border-fuchsia-200/30 hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
                          >
                            {isStartingCamera ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Åbner kamera...
                              </>
                            ) : (
                              "Åbn kamera"
                            )}
                          </button>
                        ) : null}

                        {isCameraActive ? (
                          <div className="relative overflow-hidden rounded-4xl border border-white/15 bg-slate-950/55 backdrop-blur-md">
                            <video
                              ref={videoRef}
                              autoPlay
                              muted
                              playsInline
                              className="h-85 w-full object-cover"
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
                                className="inline-flex min-h-15 items-center justify-center gap-3 rounded-full border border-white/20 bg-slate-950/72 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-md transition hover:border-fuchsia-200/35 hover:bg-slate-950/82 disabled:cursor-wait disabled:opacity-70"
                              >
                                {isCapturingPhoto ? (
                                  <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Tager billede...
                                  </>
                                ) : (
                                  "Tag billede"
                                )}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {compressedImages.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-center text-sm font-medium text-white/60">
                          {compressedImages.length} {compressedImages.length === 1 ? "side valgt" : "sider valgt"}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {compressedImages.map((imageSrc, index) => (
                            <div
                              key={`${selectedImageLabels[index] ?? "bogside"}-${index}`}
                              className="overflow-hidden rounded-4xl border border-white/15 bg-white/5 backdrop-blur-md"
                            >
                              <div className="relative">
                                <Image
                                  src={imageSrc}
                                  alt={`Valgt bogside ${index + 1}`}
                                  width={1200}
                                  height={780}
                                  unoptimized
                                  className="h-55 w-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(index)}
                                  className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-slate-950/80 text-white transition hover:border-rose-200/30 hover:bg-rose-400/15"
                                  aria-label={`Fjern billede ${index + 1}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="border-t border-white/10 px-4 py-3 text-sm text-white/65">
                                {selectedImageLabels[index] ?? `Side ${index + 1}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {sourceMode === "camera" && compressedImages.length > 0 ? (
                      <button
                        type="button"
                        onClick={startCamera}
                        disabled={
                          isStartingCamera ||
                          isPreparingImage ||
                          isGenerating ||
                          compressedImages.length >= MAX_UPLOAD_IMAGES
                        }
                        className="inline-flex min-h-15 w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-white/5 px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-white/75 backdrop-blur-md transition hover:border-white/30 hover:bg-white/8 hover:text-white disabled:cursor-wait disabled:opacity-70"
                      >
                        {isStartingCamera ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Åbner kamera...
                          </>
                        ) : compressedImages.length >= MAX_UPLOAD_IMAGES ? (
                          "Maks 5 billeder valgt"
                        ) : (
                          "Tag endnu et billede"
                        )}
                      </button>
                    ) : null}

                    <canvas ref={captureCanvasRef} className="hidden" />

                    {sourceMode !== "text" ? (
                      <p className="text-center text-sm text-white/45">{helperText}</p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handleStepTwoNext}
                    disabled={!canContinueFromStep2 || isPreparingImage || isStartingCamera || isCapturingPhoto}
                    className="mt-10 inline-flex min-h-15 w-full items-center justify-center rounded-full border border-fuchsia-200/25 bg-white/8 px-6 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-white backdrop-blur-md shadow-[0_18px_40px_rgba(168,85,247,0.12)] transition hover:border-fuchsia-200/35 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Næste
                  </button>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-fuchsia-200/75">
                    Trin 3
                  </p>
                  <h2
                    className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl ${rubik.className}`}
                  >
                    Finjustér rammen
                  </h2>
                  <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
                    Vælg fag, niveau og længde, så AI&apos;en rammer den rigtige vinkel første gang.
                  </p>

                  <div className="mt-10 space-y-8 text-left">
                    <div className="space-y-3">
                      <label
                        htmlFor="scanner-subject"
                        className="block text-[11px] font-medium uppercase tracking-[0.24em] text-white/45"
                      >
                        Fag
                      </label>
                      <select
                        id="scanner-subject"
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        className="w-full appearance-none rounded-3xl border border-white/15 bg-white/5 px-5 py-4 text-base text-white backdrop-blur-md outline-none transition focus:border-fuchsia-200/30 focus:bg-white/8 focus:ring-2 focus:ring-fuchsia-200/15"
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
                      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/45">
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
                              className={`min-h-19 rounded-3xl border px-5 py-4 text-left text-base font-semibold backdrop-blur-md transition ${
                                isSelected
                                  ? "border-fuchsia-200/35 bg-fuchsia-300/12 text-white shadow-[0_16px_34px_rgba(168,85,247,0.12)]"
                                  : "border-white/15 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/8 hover:text-white"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/45">
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
                              className={`min-h-19 rounded-3xl border px-5 py-4 text-left text-base font-semibold backdrop-blur-md transition ${
                                isSelected
                                  ? "border-fuchsia-200/35 bg-fuchsia-300/12 text-white shadow-[0_16px_34px_rgba(168,85,247,0.12)]"
                                  : "border-white/15 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/8 hover:text-white"
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
                    className="mt-10 inline-flex min-h-15 w-full items-center justify-center rounded-full border border-fuchsia-200/25 bg-white/8 px-6 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-white backdrop-blur-md shadow-[0_18px_40px_rgba(168,85,247,0.12)] transition hover:border-fuchsia-200/35 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Næste
                  </button>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-fuchsia-200/75">
                    Trin 4
                  </p>
                  <h2
                    className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl ${rubik.className}`}
                  >
                    Byg løbet
                  </h2>
                  <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
                    AI&apos;en bygger nu et komplet quiz-løb ud fra dit materiale og sender det direkte videre til builderen.
                  </p>

                  <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                    {selectedSourceLabel ? (
                      <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur-md">
                        Kilde: {selectedSourceLabel}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur-md">
                      Fag: {subject}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur-md">
                      Målgruppe: {AUDIENCE_OPTIONS.find((option) => option.value === audience)?.label}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur-md">
                      Antal poster: {questionCount}
                    </span>
                  </div>

                  <div className="mt-10">
                    {isGenerating ? (
                      <div className="rounded-4xl border border-white/15 bg-white/5 px-6 py-12 text-center backdrop-blur-md shadow-[0_18px_40px_rgba(168,85,247,0.08)]">
                        <Loader2 className="mx-auto h-10 w-10 animate-spin text-fuchsia-100" />
                        <p className="mt-6 text-2xl font-semibold tracking-tight text-white">
                          AI&apos;en læser materialet
                        </p>
                        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-white/55">
                          Vi bygger titel, beskrivelse og præcis det antal poster, du har valgt.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGenerateRun}
                        className="inline-flex min-h-16 w-full items-center justify-center rounded-full border border-fuchsia-200/25 bg-white/8 px-6 py-4 text-sm font-semibold uppercase tracking-[0.24em] text-white backdrop-blur-md shadow-[0_18px_40px_rgba(168,85,247,0.14)] transition hover:border-fuchsia-200/35 hover:bg-white/10"
                      >
                        Generér løb
                      </button>
                    )}
                  </div>
                </>
              ) : null}

              {error ? (
                <div className="mt-8 rounded-3xl border border-rose-200/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-50/90 backdrop-blur-md">
                  {error}
                </div>
              ) : null}

              {!error && infoMessage ? (
                <div className="mt-8 rounded-3xl border border-white/15 bg-white/5 px-4 py-3 text-sm leading-6 text-white/75 backdrop-blur-md">
                  {infoMessage}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
