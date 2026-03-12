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
      <p className="mt-2 text-xs italic text-slate-400">
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
        className="inline-flex items-start gap-3 rounded-2xl border border-white/20 bg-white/10 px-3 py-3 text-white transition hover:bg-white/20"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Uploadet deltagerbillede"
          loading="lazy"
          onError={() => setIsUnavailable(true)}
          className="h-16 w-16 rounded-xl border border-white/20 object-cover"
        />
        <span className="pt-1 text-xs font-semibold text-white">Aabn billede</span>
      </a>
    </div>
  );
}
