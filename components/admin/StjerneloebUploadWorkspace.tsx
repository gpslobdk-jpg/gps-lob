"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ClipboardPaste,
  FileText,
  Loader2,
  RefreshCcw,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";

import { createClient } from "@/utils/supabase/client";

const BUCKET_NAME = "stjerneloeb_pdfs";

const CATEGORIES = [
  { value: "indskoling", label: "Indskoling" },
  { value: "mellemtrin", label: "Mellemtrin" },
  { value: "udskoling", label: "Udskoling" },
];

type QueueStatus = "pending" | "uploading" | "ai_processing" | "success" | "error";

type QueueItem = {
  id: string;
  file: File;
  category: string;
  status: QueueStatus;
  error: string | null;
  title: string | null;
  filePath: string | null;
  publicUrl: string | null;
  libraryUrl: string | null;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  item?: {
    id?: string;
    file_path?: string;
    original_name?: string;
    ai_title?: string;
    category?: string;
    publicUrl?: string | null;
    title?: string;
  };
};

function getCategoryLabel(value: string) {
  return CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

function makeStableId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 180);
}

function makeStoragePath(userId: string, fileName: string) {
  return `${userId}/${Date.now()}-${makeStableId()}-${sanitizeFileName(fileName)}`;
}

function isPdfFile(file: File | null | undefined) {
  if (!file) return false;

  const lowerName = file.name.toLowerCase();
  return file.type === "application/pdf" || lowerName.endsWith(".pdf");
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function collectPdfFilesFromDataTransfer(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) return [] as File[];

  const files = Array.from(dataTransfer.files ?? []).filter(isPdfFile);
  if (files.length > 0) return files;

  return Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file) && isPdfFile(file));
}

function collectPdfFilesFromClipboard(event: ClipboardEvent) {
  const fromFiles = Array.from(event.clipboardData?.files ?? []).filter(isPdfFile);
  if (fromFiles.length > 0) return fromFiles;

  return Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file) && isPdfFile(file));
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const meta =
    status === "pending"
      ? { label: "Pending", className: "border-white/10 bg-white/5 text-white/70", icon: Clock3 }
      : status === "uploading"
        ? { label: "Uploading", className: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200", icon: Loader2 }
        : status === "ai_processing"
          ? { label: "AI Processing", className: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200", icon: Sparkles }
          : status === "success"
            ? { label: "Success", className: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100", icon: CheckCircle2 }
            : { label: "Error", className: "border-rose-300/20 bg-rose-500/10 text-rose-100", icon: AlertCircle };

  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] ${meta.className}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "uploading" || status === "ai_processing" ? "animate-spin" : ""}`} />
      {meta.label}
    </span>
  );
}

function QueueItemCard({ item, onRetry }: { item: QueueItem; onRetry: (itemId: string) => void }) {
  const cardTone =
    item.status === "success"
      ? "border-emerald-400/18 bg-emerald-400/8"
      : item.status === "error"
        ? "border-rose-400/18 bg-rose-500/8"
        : item.status === "ai_processing" || item.status === "uploading"
          ? "border-emerald-400/22 bg-slate-900/70"
          : "border-white/10 bg-slate-900/55";

  return (
    <article className={`overflow-hidden rounded-[1.6rem] border p-4 shadow-[0_18px_42px_rgba(2,6,23,0.28)] backdrop-blur-2xl ${cardTone}`}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
          {item.status === "success" ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : item.status === "error" ? (
            <X className="h-6 w-6" />
          ) : item.status === "ai_processing" || item.status === "uploading" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <FileText className="h-6 w-6" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{item.file.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{formatBytes(item.file.size)}</span>
                <span>•</span>
                <span>{getCategoryLabel(item.category)}</span>
              </div>
            </div>

            <StatusBadge status={item.status} />
          </div>

          {item.status === "pending" ? (
            <p className="mt-3 text-sm leading-6 text-slate-300">Klar til at blive uploadet.</p>
          ) : item.status === "uploading" ? (
            <p className="mt-3 text-sm leading-6 text-emerald-100/80">Direkte upload til Supabase Storage...</p>
          ) : item.status === "ai_processing" ? (
            <p className="mt-3 text-sm leading-6 text-emerald-100/80">
              ChatGPT læser dit løb og finder på en genial titel...
            </p>
          ) : item.status === "success" ? (
            <div className="mt-3 space-y-3">
              <p className="wrap-break-word text-base font-black text-emerald-100">{item.title ?? item.file.name}</p>
              <p className="text-sm leading-6 text-slate-300">
                Materialet er gemt i biblioteket og er klar til at blive åbnet.
              </p>
              <div className="flex flex-wrap gap-3">
                {item.libraryUrl ? (
                  <Link
                    href={item.libraryUrl}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/16"
                  >
                    Se i biblioteket
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                ) : null}
                {item.publicUrl ? (
                  <a
                    href={item.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-emerald-300/20 hover:bg-white/8"
                  >
                    Åbn PDF
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm leading-6 text-rose-100/85">
                {item.error ?? "Uploaden fejlede."}
              </p>
              <button
                type="button"
                onClick={() => onRetry(item.id)}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200/20 bg-rose-400/15 px-4 py-2.5 text-sm font-semibold text-rose-50 transition hover:bg-rose-400/22"
              >
                <RefreshCcw className="h-4 w-4" />
                Prøv igen
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function StjerneloebUploadWorkspace() {
  const [supabase] = useState(() => createClient());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const dragDepthRef = useRef(0);

  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const activeItem = queue.find((item) => item.status === "uploading" || item.status === "ai_processing") ?? null;
  const queueStats = useMemo(() => {
    return queue.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        return acc;
      },
      { total: 0, pending: 0, uploading: 0, ai_processing: 0, success: 0, error: 0 }
    );
  }, [queue]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const clearFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const enqueueFiles = useCallback(
    (files: File[]) => {
      const pdfFiles = files.filter(isPdfFile);
      if (pdfFiles.length === 0) {
        setGlobalError("Slip kun PDF-filer ind i feltet.");
        return;
      }

      const ignoredCount = files.length - pdfFiles.length;
      setGlobalError(ignoredCount > 0 ? "Kun PDF-filer blev tilføjet." : null);
      setQueue((current) => [
        ...current,
        ...pdfFiles.map((file) => ({
          id: makeStableId(),
          file,
          category,
          status: "pending" as QueueStatus,
          error: null,
          title: null,
          filePath: null,
          publicUrl: null,
          libraryUrl: null,
        })),
      ]);
      clearFileInput();
    },
    [category, clearFileInput]
  );

  const updateQueueItem = useCallback((itemId: string, patch: Partial<QueueItem>) => {
    setQueue((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    );
  }, []);

  const markPendingItemsError = useCallback((message: string) => {
    setQueue((current) =>
      current.map((item) =>
        item.status === "pending"
          ? { ...item, status: "error", error: message }
          : item
      )
    );
  }, []);

  const retryQueueItem = useCallback((itemId: string) => {
    setGlobalError(null);
    setQueue((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: "pending",
              error: null,
              title: null,
              filePath: null,
              publicUrl: null,
              libraryUrl: null,
            }
          : item
      )
    );
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;

    processingRef.current = true;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;

      if (authError || !userId) {
        const message = "Du skal være logget ind for at uploade.";
        setGlobalError(message);
        markPendingItemsError(message);
        return;
      }

      setGlobalError(null);

      while (true) {
        const nextItem = queueRef.current.find((item) => item.status === "pending");
        if (!nextItem) {
          break;
        }

        const storagePath = makeStoragePath(userId, nextItem.file.name);
        updateQueueItem(nextItem.id, {
          status: "uploading",
          error: null,
          filePath: null,
          publicUrl: null,
          title: null,
          libraryUrl: null,
        });

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, nextItem.file, {
            contentType: nextItem.file.type || "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          updateQueueItem(nextItem.id, {
            status: "error",
            error: uploadError.message || "Kunne ikke uploade filen til Supabase.",
          });
          continue;
        }

        const publicUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath).data.publicUrl;
        updateQueueItem(nextItem.id, {
          status: "ai_processing",
          filePath: storagePath,
          publicUrl,
          error: null,
        });

        try {
          const response = await fetch("/api/stjerneloeb-library/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filePath: storagePath,
              category: nextItem.category,
            }),
          });

          const payload = (await response.json().catch(() => null)) as ApiResponse | null;
          if (!response.ok) {
            await supabase.storage.from(BUCKET_NAME).remove([storagePath]).catch(() => undefined);
            updateQueueItem(nextItem.id, {
              status: "error",
              error: payload?.error ?? "AI-processen fejlede. Prøv igen.",
            });
            continue;
          }

          const responseItem = payload?.item;
          const resolvedCategory = responseItem?.category ?? nextItem.category;
          const resolvedTitle =
            responseItem?.ai_title?.trim() || responseItem?.title?.trim() || nextItem.file.name;
          const resolvedLibraryUrl = `/dashboard/opret/stjerneloeb/bibliotek/${resolvedCategory}`;

          updateQueueItem(nextItem.id, {
            status: "success",
            error: null,
            title: resolvedTitle,
            filePath: responseItem?.file_path ?? storagePath,
            publicUrl: responseItem?.publicUrl ?? publicUrl,
            libraryUrl: resolvedLibraryUrl,
          });
        } catch {
          await supabase.storage.from(BUCKET_NAME).remove([storagePath]).catch(() => undefined);
          updateQueueItem(nextItem.id, {
            status: "error",
            error: "Netværksfejl under AI-processen. Prøv igen.",
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload fejlede.";
      setGlobalError(message);
      markPendingItemsError(message);
    } finally {
      processingRef.current = false;
    }
  }, [markPendingItemsError, supabase, updateQueueItem]);

  useEffect(() => {
    if (processingRef.current) return;
    if (!queue.some((item) => item.status === "pending")) return;

    void processQueue();
  }, [processQueue, queue]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pastedFiles = collectPdfFilesFromClipboard(event);
      if (pastedFiles.length === 0) {
        return;
      }

      event.preventDefault();
      enqueueFiles(pastedFiles);
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [enqueueFiles]);

  const handleZoneClick = useCallback(() => {
    if (processingRef.current) return;
    fileInputRef.current?.click();
  }, []);

  const handleFileSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;
      enqueueFiles(files);
    },
    [enqueueFiles]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragActive(false);

      const files = collectPdfFilesFromDataTransfer(event.dataTransfer);
      if (files.length === 0) {
        setGlobalError("Slip kun PDF-filer ind i feltet.");
        return;
      }

      enqueueFiles(files);
    },
    [enqueueFiles]
  );

  const handleDragEnter = useCallback((event: DragEvent<HTMLButtonElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLButtonElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLButtonElement>) => {
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

  const handleZoneKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleZoneClick();
    }
  }, [handleZoneClick]);

  const successCount = queueStats.success;
  const activeLabel = activeItem
    ? activeItem.status === "uploading"
      ? `Uploader ${activeItem.file.name}`
      : `AI bearbejder ${activeItem.file.name}`
    : queueStats.total > 0
      ? `${queueStats.total} filer i kø`
      : "Klar til næste PDF";

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(5,150,105,0.14),transparent_22%),radial-gradient(circle_at_bottom,rgba(15,118,110,0.14),transparent_28%),linear-gradient(180deg,#020617_0%,#020617_45%,#040d1a_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-30 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[56px_56px]"
      />
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

        <section className="mt-8 grid flex-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.6fr)]">
          <div className="flex flex-col gap-6">
            <div className="rounded-4xl border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
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
                  <p className="mt-2 text-lg font-black text-white">{getCategoryLabel(category)}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Træk & slip",
                    body: "Slip en eller flere PDF'er direkte i zonen for at starte batchen.",
                  },
                  {
                    title: "Paste magi",
                    body: "Tryk Ctrl+V hvor som helst på siden og indsæt PDF'er fra clipboardet.",
                  },
                  {
                    title: "AI-titel",
                    body: "Vi uploader til Supabase først og lader derefter ChatGPT navngive løbet.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-emerald-400/10 bg-slate-950/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl"
                  >
                    <p className="text-sm font-bold text-emerald-200">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-4xl border border-emerald-400/15 bg-slate-900/55 p-4 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-5">
              <button
                type="button"
                onClick={handleZoneClick}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onKeyDown={handleZoneKeyDown}
                className={`relative flex min-h-85 w-full flex-col items-center justify-center rounded-[1.7rem] border border-dashed px-6 py-8 text-center outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-400/40 sm:min-h-95 sm:px-8 ${
                  isDragActive
                    ? "border-emerald-300/60 bg-emerald-400/12 shadow-[0_0_0_1px_rgba(16,185,129,0.28),0_0_44px_rgba(16,185,129,0.18)]"
                    : "border-emerald-400/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(15,23,42,0.94))]"
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
                    {isDragActive ? "Slip filerne nu" : "PDF-dropzone"}
                  </p>

                  <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight sm:text-4xl">
                    Træk og slip din Canva-PDF her, eller klik for at vælge fil
                  </h2>

                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    Du kan også bare trykke <span className="font-semibold text-emerald-200">Ctrl+V</span> hvor som helst på siden, hvis PDF'erne allerede ligger i clipboardet.
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

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    onChange={handleFileSelection}
                    className="sr-only"
                    aria-label="Vælg PDF-filer"
                  />
                </div>
              </button>
            </div>

            {globalError ? (
              <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100 shadow-[0_18px_40px_rgba(225,29,72,0.08)] backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-rose-300/20 bg-rose-400/10 text-rose-100">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Uploadmeddelelse</p>
                    <p className="mt-1 leading-6 text-rose-50/85">{globalError}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeItem ? (
              <div className="relative overflow-hidden rounded-4xl border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-8">
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
                    Vi uploader først til Supabase Storage og sender derefter kun filstien til API'et.
                  </p>
                  <p className="mt-3 wrap-break-word text-sm font-semibold text-emerald-100/90">
                    {activeItem.file.name}
                  </p>

                  <div className="mt-6 flex items-center gap-2 text-emerald-300/80">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-bounce" />
                  </div>
                </div>
              </div>
            ) : null}

            <section className="space-y-4 rounded-4xl border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/65 uppercase">
                    Upload kø
                  </p>
                  <h3 className="mt-2 text-lg font-black text-white">
                    {queue.length > 0 ? `${queueStats.total} filer i kø` : "Ingen filer endnu"}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Success: {queueStats.success}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Pending: {queueStats.pending}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Error: {queueStats.error}</span>
                </div>
              </div>

              {queue.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-5 text-sm leading-6 text-slate-300">
                  Ingen PDF'er i kø endnu. Drop, paste eller vælg nogle filer ovenfor.
                </div>
              ) : (
                <div className="space-y-3">
                  {queue.map((item) => (
                    <QueueItemCard key={item.id} item={item} onRetry={retryQueueItem} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-4xl border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
              <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/65 uppercase">
                Arbejdsgang
              </p>

              <div className="mt-4 space-y-3">
                {[
                  "Vælg kategori først, så filerne lander det rigtige sted i biblioteket.",
                  "Træk, slip eller paste en eller flere PDF'er direkte ind på siden.",
                  "Vi uploader til Supabase Storage først og sender derefter filstien til API'et.",
                  "Klik i biblioteket, når uploaden er færdig.",
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
            </div>

            <div className="rounded-4xl border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
              <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/65 uppercase">
                Kategori
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {CATEGORIES.map((item) => {
                  const isSelected = category === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setCategory(item.value)}
                      aria-pressed={isSelected}
                      className={`rounded-[1.35rem] border px-4 py-3 text-sm font-semibold transition ${
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
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Den valgte kategori bruges for nye filer i køen. Filer der allerede er tilføjet, beholder deres kategori.
              </p>
            </div>

            <div className="rounded-4xl border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
              <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/65 uppercase">
                Hurtig hjælp
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>• Tryk Ctrl+V for at uploade PDF'er fra clipboardet.</p>
                <p>• Dropzoneen accepterer flere filer på én gang.</p>
                <p>• Hver fil får sin egen status: Pending, Uploading, AI Processing, Success eller Error.</p>
              </div>

              <div className="mt-5 rounded-[1.3rem] border border-emerald-400/15 bg-emerald-400/8 p-4 text-sm leading-6 text-emerald-100/90">
                <p className="font-semibold text-emerald-200">Status</p>
                <p className="mt-2">{activeLabel}</p>
              </div>
            </div>

            {successCount > 0 ? (
              <div className="rounded-4xl border border-emerald-400/15 bg-slate-900/55 p-5 shadow-[0_34px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:p-6">
                <p className="text-[11px] font-semibold tracking-[0.34em] text-emerald-200/65 uppercase">
                  Klar
                </p>
                <p className="mt-3 text-lg font-black text-white">{successCount} filer er gemt i biblioteket</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Klik på de enkelte filer i køen for at åbne biblioteket eller PDF'en.
                </p>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
