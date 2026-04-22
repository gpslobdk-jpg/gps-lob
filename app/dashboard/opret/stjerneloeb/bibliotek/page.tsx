"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const cardBaseClass =
  "group relative z-0 mx-auto flex h-[12rem] w-full max-w-[20.5rem] flex-col overflow-visible rounded-[2rem] border bg-white/10 p-0 text-left shadow-[0_22px_52px_rgba(15,23,42,0.16),0_8px_18px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-lg transition-all duration-300 hover:z-20 focus-within:z-20";

const cardBackgroundShellClass =
  "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[2rem]";

const cardPanelClass =
  "relative flex h-full flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-16px_24px_rgba(15,23,42,0.07)]";

const categories = [
  {
    key: "indskoling",
    title: "Indskoling",
    description: "Materialer og skabeloner til 0.–3. klasse.",
    accentClass:
      "border-lime-500/75 bg-lime-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(132,204,22,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(132,204,22,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(132,204,22,0.24)]",
    badgeClass: "border-lime-300/40 bg-lime-400/20 text-white",
  },
  {
    key: "mellemtrin",
    title: "Mellemtrin",
    description: "Materialer og skabeloner til 4.–6. klasse.",
    accentClass:
      "border-indigo-500/75 bg-indigo-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(99,102,241,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(99,102,241,0.24)]",
    badgeClass: "border-indigo-300/40 bg-indigo-400/20 text-white",
  },
  {
    key: "udskoling",
    title: "Udskoling",
    description: "Materialer og skabeloner til 7.–10. klasse.",
    accentClass:
      "border-purple-500/75 bg-purple-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(147,51,234,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(147,51,234,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(147,51,234,0.24)]",
    badgeClass: "border-purple-300/40 bg-purple-400/20 text-white",
  },
];

function CategoryCard({ cat }: { cat: (typeof categories)[0] }) {
  return (
    <div className="block w-full">
      <motion.article
        whileHover={{ y: -4, scale: 1.012 }}
        className={`${cardBaseClass} ${cat.accentClass}`}
      >
        <div className={cardBackgroundShellClass}>
          <div className={`absolute inset-0 rounded-[2rem] ${cat.accentGlowClass}`} />
          <div className="absolute inset-[1px] rounded-[1.95rem]" />
        </div>

        <div className="absolute top-4 right-4 z-20">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.58rem] font-bold tracking-[0.18em] uppercase backdrop-blur-md ${cat.badgeClass}`}>
            {cat.title.toUpperCase()}
          </span>
        </div>

        <div className={`${cardPanelClass} text-slate-950`}>
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
            <div className="space-y-1">
              <h2 className={`text-[1.4rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)]`}>
                {cat.title}
              </h2>
              <p className="mx-auto max-w-[15rem] text-xs leading-tight text-white/84">{cat.description}</p>
            </div>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

export default function BibliotekPage() {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0].key);
  const [isLoading, setIsLoading] = useState(false);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleUpload() {
    setErrorMsg(null);
    setResultTitle(null);
    if (!selectedFile) {
      setErrorMsg("Vælg en PDF-fil først.");
      return;
    }

    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("category", selectedCategory);

      const res = await fetch("/api/stjerneloeb-library/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || "Upload fejlede.");
        setIsLoading(false);
        return;
      }

      const title = data?.item?.ai_title ?? data?.item?.aiTitle ?? null;
      setResultTitle(title);
      setIsLoading(false);
    } catch (err) {
      setErrorMsg("Netværksfejl. Prøv igen.");
      setIsLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col px-6 py-6 text-white md:px-10">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-2">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/opret/stjerneloeb" className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/6 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10">
            Tilbage
          </Link>
          <h1 className="text-2xl font-black tracking-tight">Stjerneløb — Bibliotek</h1>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl transition hover:bg-white/16"
          >
            Upload PDF
          </button>
        </div>
      </header>

      <section className="mx-auto mt-8 w-full max-w-6xl">
        <p className="mb-6 text-sm text-white/80">Her kan du uploade dine Canva-PDF'er og organisere dem i tre klassetrins-kategorier.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 justify-items-center gap-8">
          {categories.map((cat) => (
            <CategoryCard key={cat.key} cat={cat as any} />
          ))}
        </div>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-[1rem] border p-6 bg-white/6">
            <button
              type="button"
              aria-label="Luk"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/90"
            >
              ×
            </button>

            <h2 className="text-lg font-bold">Upload PDF</h2>
            <p className="mt-2 text-sm text-white/80">Vælg en Canva-exporteret PDF. AI genererer automatisk en kort titel.</p>

            <div className="mt-4 space-y-3">
              <label className="text-sm text-white/80">Kategori</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-md border bg-white/6 px-3 py-2 text-sm text-white"
                disabled={isLoading}
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.title}</option>
                ))}
              </select>

              <label className="text-sm text-white/80">PDF-fil</label>
              <input
                type="file"
                accept="application/pdf"
                className="text-sm text-white/80"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                disabled={isLoading}
              />
            </div>

            {errorMsg ? <p className="mt-3 text-sm text-rose-400">{errorMsg}</p> : null}
            {resultTitle ? <p className="mt-3 text-sm text-emerald-300">Genereret titel: {resultTitle}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white/90"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                disabled={isLoading}
              >
                {isLoading ? "Genererer titel…" : "Upload & Generer titel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
