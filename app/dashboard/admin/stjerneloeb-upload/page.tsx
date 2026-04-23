"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  Loader2,
  RefreshCcw,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

const CATEGORIES = [
  { value: "indskoling", label: "Indskoling" },
  { value: "mellemtrin", label: "Mellemtrin" },
  { value: "udskoling", label: "Udskoling" },
];

type UploadStatus = "idle" | "processing" | "success" | "error";

type UploadedItem = {
  id?: string;
  title: string;
  category: string;
  originalName: string;
  filePath?: string;
  publicUrl?: string | null;
  libraryUrl: string;
};

function getCategoryLabel(value: string) {
  return CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

function getLibraryUrl(category: string) {
  return `/dashboard/opret/stjerneloeb/bibliotek/${category}`;
}

function isPdfFile(file: File | null | undefined) {
  if (!file) return false;

  const fileName = file.name.toLowerCase();
  return file.type === "application/pdf" || fileName.endsWith(".pdf");
}

function extractPdfFromDataTransfer(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) return null;

  const fileFromFiles = Array.from(dataTransfer.files ?? []).find(isPdfFile);
  if (fileFromFiles) {
    return fileFromFiles;
  }

  const fileFromItems = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .find(isPdfFile);

  return fileFromItems ?? null;
}

function extractPdfFromClipboard(event: ClipboardEvent) {
  const fileFromFiles = Array.from(event.clipboardData?.files ?? []).find(isPdfFile);
  if (fileFromFiles) {
    return fileFromFiles;
  }

  const items = Array.from(event.clipboardData?.items ?? []);
  for (const item of items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (isPdfFile(file)) {
      return file;
    }
  }

  return null;
}

export default function AdminStjerneloebUploadPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedItem, setUploadedItem] = useState<UploadedItem | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const selectedCategory = CATEGORIES.find((item) => item.value === category) ?? CATEGORIES[0];

  const clearFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const resetUploadState = useCallback(() => {
    setSelectedFile(null);
    setErrorMessage(null);
    setUploadedItem(null);
    setUploadStatus("idle");
    clearFileInput();
  }, [clearFileInput]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (uploadStatus === "processing") {
        return;
      }

      if (!isPdfFile(file)) {
        setSelectedFile(file);
        setUploadedItem(null);
        setErrorMessage("Kun PDF-filer understøttes.");
        setUploadStatus("error");
        return;
      }

      setSelectedFile(file);
      setUploadedItem(null);
      setErrorMessage(null);
      setUploadStatus("processing");

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", category);

        const response = await fetch("/api/stjerneloeb-library/upload", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              error?: string;
              item?: {
                id?: string;
                ai_title?: string;
                title?: string;
                file_path?: string;
                publicUrl?: string | null;
                category?: string | null;
              };
            }
          | null;

        if (!response.ok) {
          setErrorMessage(payload?.error ?? "Upload fejlede. Prøv igen.");
          setUploadStatus("error");
          return;
        }

        const responseItem = payload?.item;
        const resolvedCategory = responseItem?.category ?? category;
        const resolvedTitle =
          responseItem?.ai_title?.trim() || responseItem?.title?.trim() || file.name;

        setUploadedItem({
          id: responseItem?.id,
          title: resolvedTitle,
          category: resolvedCategory,
          originalName: file.name,
          filePath: responseItem?.file_path,
          publicUrl: responseItem?.publicUrl ?? null,
          libraryUrl: getLibraryUrl(resolvedCategory),
        });
        setSelectedFile(null);
        setUploadStatus("success");
        clearFileInput();
      } catch {
        setErrorMessage("Netværksfejl under upload. Prøv igen.");
        setUploadStatus("error");
      }
    },
    [category, clearFileInput, uploadStatus]
  );

  const handleFileSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";

      if (!file) {
        return;
      }

      void uploadFile(file);
    },
    [uploadFile]
  );

  const handleZoneClick = useCallback(() => {
    if (uploadStatus === "processing") {
      return;
    }

    fileInputRef.current?.click();
  }, [uploadStatus]);

  const handleZoneKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleZoneClick();
      }
    },
    [handleZoneClick]
  );

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragActive(false);

      const file = extractPdfFromDataTransfer(event.dataTransfer);
      if (!file) {
        setErrorMessage("Slip kun en PDF-fil ind i feltet.");
        setUploadStatus("error");
        return;
      }

      void uploadFile(file);
    },
    [uploadFile]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (uploadStatus === "processing") {
        return;
      }

      const file = extractPdfFromClipboard(event);
      if (!file) {
        return;
      }

      event.preventDefault();
      void uploadFile(file);
    },
    [uploadFile, uploadStatus]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(5,150,105,0.14),transparent_22%),radial-gradient(circle_at_bottom,rgba(15,118,110,0.14),transparent_28%),linear-gradient(180deg,#020617_0%,#020617_45%,#040d1a_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-emerald-100/90 shadow-[0_18px_40px_rgba(2,6,23,0.28)] backdrop-blur-xl transition hover:border-emerald-300/40 hover:bg-slate-900/80"
            >
              <ArrowUpRight className="h-4 w-4 rotate-180" />
              Dashboard
            </Link>

            <div>
              <p className="text-[11px] font-semibold tracking-[0.36em] text-emerald-300/70 uppercase">
                Admin upload
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Stjerneløb Library Uploader
              </h1>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200 backdrop-blur-xl">
            <Sparkles className="h-4 w-4" />
            Drag & Drop · Paste · AI-titel
          </div>
        </header>

        <section className="mt-8 grid flex-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.62fr)]">
          <div className="flex flex-col gap-6">
            <div className="rounded-[2rem] border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/65 uppercase">
                    Premium flow
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                    Træk, slip, eller tryk <span className="text-emerald-300">Ctrl+V</span>
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    Upload en Canva-exporteret PDF, så læser ChatGPT løbet, finder titlen og gemmer materialet i biblioteket.
                  </p>
                </div>

                <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/40 px-4 py-3 text-right backdrop-blur-xl">
                  <p className="text-[11px] font-semibold tracking-[0.3em] text-emerald-200/55 uppercase">
                    Aktiv kategori
                  </p>
                  <p className="mt-2 text-lg font-black text-white">{selectedCategory.label}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Træk & slip",
                    body: "Slip filen direkte i zonen for at starte uploaden.",
                  },
                  {
                    title: "Paste magi",
                    body: "Tryk Ctrl+V hvor som helst på siden og indsæt en PDF fra clipboardet.",
                  },
                  {
                    title: "AI-titel",
                    body: "Vi gemmer filen og genererer en kort, fængende titel automatisk.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.5rem] border border-emerald-400/10 bg-slate-950/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl"
                  >
                    <p className="text-sm font-bold text-emerald-200">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {uploadStatus === "processing" ? (
              <div className="relative overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.12),transparent_30%)]" />
                <div className="relative flex flex-col items-center text-center">
                  <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 shadow-[0_0_40px_rgba(16,185,129,0.18)]">
                    <div className="absolute inset-0 rounded-full border border-emerald-300/20 animate-ping" />
                    <Loader2 className="h-11 w-11 animate-spin text-emerald-300" />
                  </div>

                  <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/70 uppercase">
                    Processing
                  </p>
                  <h3 className="mt-3 text-2xl font-black sm:text-3xl">
                    ChatGPT læser dit løb og finder på en genial titel...
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    {selectedFile ? `Vi uploader ${selectedFile.name} nu.` : "Vi uploader filen og genererer metadata, mens du kan læne dig tilbage et øjeblik."}
                  </p>

                  <div className="mt-6 flex items-center gap-2 text-emerald-300/80">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-bounce" />
                  </div>
                </div>
              </div>
            ) : uploadStatus === "success" && uploadedItem ? (
              <div className="relative overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.10),transparent_30%)]" />
                <div className="relative flex flex-col gap-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.16)]">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/70 uppercase">
                        Upload færdig
                      </p>
                      <h3 className="mt-2 break-words text-2xl font-black text-white sm:text-3xl">
                        {uploadedItem.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {uploadedItem.originalName} er nu gemt som <span className="font-semibold text-emerald-200">{getCategoryLabel(uploadedItem.category)}</span>.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                      href={uploadedItem.libraryUrl}
                      className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[1.2rem] border border-emerald-300/25 bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_18px_38px_rgba(16,185,129,0.22)] transition hover:brightness-110"
                    >
                      Se i biblioteket
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>

                    {uploadedItem.publicUrl ? (
                      <a
                        href={uploadedItem.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[1.2rem] border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-white/90 transition hover:border-emerald-300/20 hover:bg-slate-900"
                      >
                        Åbn PDF
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : (
                      <div className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[1.2rem] border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-semibold text-white/60">
                        PDF-link ikke tilgængelig endnu
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={resetUploadState}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-emerald-300/20 hover:bg-white/8"
                  >
                    Upload endnu en PDF
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative overflow-hidden rounded-[2rem] border border-dashed p-5 shadow-[0_28px_80px_rgba(2,6,23,0.38)] backdrop-blur-2xl transition-all duration-300 sm:p-6 ${
                  isDragActive
                    ? "border-emerald-300/60 bg-emerald-400/12 shadow-[0_0_0_1px_rgba(16,185,129,0.28),0_0_44px_rgba(16,185,129,0.18)]"
                    : "border-emerald-400/20 bg-slate-900/55"
                }`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_28%)]" />

                <button
                  type="button"
                  onClick={handleZoneClick}
                  onKeyDown={handleZoneKeyDown}
                  className={`relative flex min-h-[320px] w-full flex-col items-center justify-center rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(15,23,42,0.94))] px-6 py-8 text-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 sm:min-h-[360px] sm:px-8 ${
                    isDragActive ? "scale-[1.01] border-emerald-300/40" : ""
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 rounded-[1.7rem] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.06),transparent_30%)]" />

                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full border shadow-[0_0_40px_rgba(16,185,129,0.14)] transition-all duration-300 ${
                        isDragActive
                          ? "border-emerald-300/45 bg-emerald-400/18 text-emerald-100 shadow-[0_0_58px_rgba(16,185,129,0.28)]"
                          : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      }`}
                    >
                      <UploadCloud className="h-10 w-10" />
                    </div>

                    <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/70 uppercase">
                      {isDragActive ? "Slip filen nu" : "PDF-dropzone"}
                    </p>

                    <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight sm:text-4xl">
                      Træk og slip din Canva-PDF her, eller klik for at vælge fil
                    </h2>

                    <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                      Du kan også bare trykke <span className="font-semibold text-emerald-200">Ctrl+V</span> hvor som helst på siden, hvis PDF’en allerede ligger i clipboardet.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/8 px-3 py-2">
                        <ClipboardPaste className="h-3.5 w-3.5 text-emerald-300" />
                        Paste via clipboard
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/8 px-3 py-2">
                        <FileText className="h-3.5 w-3.5 text-emerald-300" />
                        Kun PDF
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/8 px-3 py-2">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                        AI-titel genereres automatisk
                      </span>
                    </div>

                    {selectedFile ? (
                      <div className="relative mt-7 w-full max-w-2xl rounded-[1.4rem] border border-emerald-400/15 bg-slate-950/55 p-4 text-left backdrop-blur-xl">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold tracking-[0.3em] text-emerald-200/60 uppercase">
                              Klar til upload
                            </p>
                            <p className="mt-2 break-all text-sm font-semibold text-white">{selectedFile.name}</p>
                            <p className="mt-1 text-xs text-slate-400">{selectedCategory.label}</p>
                          </div>

                          <button
                            type="button"
                            onClick={resetUploadState}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-emerald-300/20 hover:bg-white/8"
                          >
                            <X className="h-3.5 w-3.5" />
                            Ryd fil
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileSelection}
                  className="sr-only"
                  aria-label="Vælg PDF-fil"
                />
              </div>
            )}

            {errorMessage ? (
              <div className="rounded-[1.5rem] border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100 shadow-[0_18px_40px_rgba(225,29,72,0.08)] backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-rose-300/20 bg-rose-400/10 text-rose-100">
                    <X className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Upload mislykkedes</p>
                    <p className="mt-1 leading-6 text-rose-50/85">{errorMessage}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {selectedFile ? (
                    <button
                      type="button"
                      onClick={() => void uploadFile(selectedFile)}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200/20 bg-rose-400/15 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-rose-50 transition hover:bg-rose-400/25"
                    >
                      Prøv igen
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleZoneClick}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 transition hover:border-emerald-300/20 hover:bg-white/8"
                  >
                    Vælg en ny fil
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[2rem] border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
              <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/65 uppercase">
                Arbejdsgang
              </p>

              <div className="mt-4 space-y-3">
                {[
                  "Vælg kategori først, så filen lander det rigtige sted i biblioteket.",
                  "Træk, slip eller paste en PDF direkte ind på siden.",
                  "Lad ChatGPT læse løbet og generere titlen for dig.",
                  "Klik ind i biblioteket, når uploaden er færdig.",
                ].map((step, index) => (
                  <div
                    key={step}
                    className="flex gap-3 rounded-[1.25rem] border border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-300 backdrop-blur-xl"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-xs font-black text-emerald-200">
                      {index + 1}
                    </div>
                    <p>{step}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-[0.28em] text-emerald-200/65 uppercase">
                  Kategori
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {CATEGORIES.map((item) => {
                    const isSelected = category === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setCategory(item.value)}
                        disabled={uploadStatus === "processing"}
                        aria-pressed={isSelected}
                        className={`rounded-[1.35rem] border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          isSelected
                            ? "border-emerald-300/30 bg-emerald-400/14 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.14),0_18px_30px_rgba(16,185,129,0.08)]"
                            : "border-white/10 bg-slate-950/55 text-slate-300 hover:border-emerald-300/20 hover:bg-slate-950/75"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
              <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/65 uppercase">
                Hurtig hjælp
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>• Tryk Ctrl+V for at upload fra clipboard.</p>
                <p>• Dropzoneen accepterer kun PDF-filer.</p>
                <p>• Du får både titlen og et direkte bibliotek-link, når AI’en er færdig.</p>
              </div>

              <div className="mt-5 rounded-[1.3rem] border border-emerald-400/15 bg-emerald-400/8 p-4 text-sm leading-6 text-emerald-100/90">
                <p className="font-semibold text-emerald-200">Status</p>
                <p className="mt-2">
                  {uploadStatus === "processing"
                    ? "ChatGPT læser dit løb og skriver en titel lige nu."
                    : uploadStatus === "success"
                      ? "Uploaden er færdig, og materialet er gemt i biblioteket."
                      : uploadStatus === "error"
                        ? "Der opstod en fejl. Prøv igen med samme fil eller vælg en ny PDF."
                        : "Klar til at modtage en ny Canva-PDF."}
                </p>
              </div>
            </div>

            {uploadStatus === "success" && uploadedItem ? (
              <div className="rounded-[2rem] border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
                <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/65 uppercase">
                  Sidste upload
                </p>
                <p className="mt-3 text-lg font-black text-white">{uploadedItem.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{uploadedItem.originalName}</p>
                <Link
                  href={uploadedItem.libraryUrl}
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/16"
                >
                  Se materialet i biblioteket
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </aside>
        </section>

        <div className="mt-6 pb-2 text-center text-xs text-slate-500">
          Paste-hukommelse er global på siden. Hvis clipboardet indeholder en PDF, starter upload automatisk.
        </div>
      </div>
    </main>
  );
}
