"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import LibraryClient from "./LibraryClient";
import { createClient } from "@/utils/supabase/server";

type LibraryRow = {
  id: string;
  file_path: string;
  original_name: string;
  ai_title: string;
  category: string;
  created_at: string;
};

export default async function BibliotekPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("stjerneloeb_library")
    .select("id,file_path,original_name,ai_title,category,created_at")
    .order("created_at", { ascending: false });

  const items: LibraryRow[] = (data ?? []) as LibraryRow[];

  return (
    <main className="relative flex min-h-screen flex-col px-6 py-6 text-white md:px-10">
      <LibraryClient items={items} />
    </main>
  );
}
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
