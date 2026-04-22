"use client";

import React from "react";
import Link from "next/link";

type Item = {
  id: string;
  ai_title: string | null;
  original_name: string | null;
  publicUrl?: string | null;
  created_at?: string | null;
  file_path?: string | null;
};

const cardBaseClass =
  "group relative z-0 mx-auto flex h-[12rem] w-full flex-col overflow-hidden rounded-[1rem] border bg-white/6 p-0 text-left shadow-[0_18px_40px_rgba(15,23,42,0.12),0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur-lg transition-all duration-300";

const cardPanelClass =
  "relative flex h-full flex-col items-start justify-between rounded-[1rem] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-4 text-left";

export default function CategoryGalleryClient({ items }: { items: Item[] }) {
  return (
    <div className="mt-6">
      {items.length === 0 ? (
        <p className="text-sm text-white/80">Ingen materialer i denne kategori endnu.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => (
            <article key={it.id} className={cardBaseClass}>
              <div className={cardPanelClass}>
                <div>
                  <h3 className="text-lg font-bold text-white">{it.ai_title || it.original_name}</h3>
                  <p className="mt-1 text-xs text-white/80">{it.original_name}</p>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  {it.publicUrl ? (
                    <a
                      href={it.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm font-medium text-white/90"
                    >
                      Se PDF
                    </a>
                  ) : (
                    <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm text-white/60">Ingen visning</span>
                  )}

                  <button
                    type="button"
                    onClick={() => alert(`Valgt: ${it.ai_title || it.original_name}`)}
                    className="rounded-full bg-emerald-500 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Vælg dette løb
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
