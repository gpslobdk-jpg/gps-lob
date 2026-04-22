"use client";

import React, { useState } from "react";
import Link from "next/link";

const cardBaseClass =
  "group relative z-0 mx-auto flex w-full flex-col overflow-visible rounded-[1rem] border bg-white/6 p-0 text-left shadow-[0_18px_40px_rgba(15,23,42,0.12),0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur-lg transition-all duration-300";

const cardBackgroundShellClass = "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[1rem]";

const cardPanelClass =
  "relative flex w-full flex-col items-start justify-center rounded-[1rem] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-6 text-left";

const CATEGORIES = [
  { value: "indskoling", label: "Indskoling" },
  { value: "mellemtrin", label: "Mellemtrin" },
  { value: "udskoling", label: "Udskoling" },
];

export default function AdminStjerneloebUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSuccessMessage(null);
    setErrorMessage(null);
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedFile) {
      setErrorMessage("Vælg en PDF-fil før upload.");
      return;
    }

    const name = selectedFile.name.toLowerCase();
    if (selectedFile.type !== "application/pdf" && !name.endsWith(".pdf")) {
      setErrorMessage("Kun PDF-filer understøttes.");
      return;
    }

    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("category", category);

      const res = await fetch("/api/stjerneloeb-library/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data?.error ?? "Upload fejlede.");
        return;
      }

      const title = data?.item?.ai_title ?? data?.item?.title ?? selectedFile.name;
      setSuccessMessage(`Upload succesfuld — titel: ${title}`);
      setSelectedFile(null);
    } catch (err) {
      setErrorMessage("Netværksfejl under upload. Prøv igen.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Admin — Stjerneløb Upload</h1>
        <Link href="/dashboard" className="text-sm text-white/80 underline">
          Tilbage til dashboard
        </Link>
      </header>

      <article className={`${cardBaseClass} relative` }>
        <div className={cardBackgroundShellClass} />
        <div className={`${cardPanelClass}`}>
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">PDF-fil</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={onFileChange}
                disabled={isUploading}
                className="text-sm text-white/80"
              />
              {selectedFile ? <p className="mt-2 text-xs text-white/80">Valgt: {selectedFile.name}</p> : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isUploading}
                className="w-full rounded-md border bg-white/6 px-3 py-2 text-sm text-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {errorMessage ? (
              <div className="rounded-md border border-rose-400/20 bg-rose-500/8 px-4 py-2 text-sm text-rose-100">{errorMessage}</div>
            ) : null}

            {successMessage ? (
              <div className="rounded-md border border-emerald-400/20 bg-emerald-500/8 px-4 py-2 text-sm text-emerald-100">{successMessage}</div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isUploading}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isUploading ? "Uploader & lader AI skrive titel..." : "Upload PDF"}
              </button>
            </div>
          </form>
        </div>
      </article>
    </main>
  );
}
