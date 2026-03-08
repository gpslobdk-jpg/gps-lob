"use client";

import { useState } from "react";

type StoredAnswerImageProps = {
  imageUrl?: string | null;
};

export default function StoredAnswerImage({ imageUrl }: StoredAnswerImageProps) {
  const [isUnavailable, setIsUnavailable] = useState(false);

  if (!imageUrl) {
    return null;
  }

  if (isUnavailable) {
    return (
      <p className="mt-2 text-xs italic text-slate-500">
        🔒 Billede slettet af hensyn til privatliv og GDPR
      </p>
    );
  }

  return (
    <div className="mt-2">
      <a
        href={imageUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-start gap-3 rounded-2xl border border-sky-200 bg-white/80 px-3 py-3 transition hover:bg-sky-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Uploadet deltagerbillede"
          loading="lazy"
          onError={() => setIsUnavailable(true)}
          className="h-16 w-16 rounded-xl border border-sky-100 object-cover"
        />
        <span className="pt-1 text-xs font-semibold text-sky-800">Aabn billede</span>
      </a>
    </div>
  );
}
