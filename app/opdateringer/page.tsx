import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { changelogEntries, type ChangelogEntry } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Seneste nyt – GPSLØB",
  description:
    "Følg med i de seneste forbedringer og opdateringer til GPSLØB-platformen.",
};

const TYPE_LABELS: Record<ChangelogEntry["type"], string> = {
  major: "Stor udgivelse",
  minor: "Opdatering",
  fix: "Fejlrettelse",
};

const TYPE_LABEL_CLASSES: Record<ChangelogEntry["type"], string> = {
  major: "text-amber-300",
  minor: "text-cyan-300",
  fix: "text-rose-300",
};

const TYPE_DOT_CLASSES: Record<ChangelogEntry["type"], string> = {
  major: "bg-amber-300",
  minor: "bg-cyan-300",
  fix: "bg-rose-300",
};

function formatDisplayDate(isoDate: string) {
  const [yearString, monthString, dayString] = isoDate.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

const entries = changelogEntries;

export default function OpdateringerPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbage til forsiden
        </Link>

        <div className="mb-12">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/8 px-3 py-1 text-xs font-medium tracking-wider text-amber-300 uppercase">
            ✨ Seneste nyt
          </span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            Hvad er nyt i GPSLØB?
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-400">
            Vi forbedrer platformen løbende. Her kan du følge med i, hvad der er
            nyt — i et sprog uden teknisk sludder.
          </p>
        </div>

        <div className="relative">
          <div className="absolute top-0 left-2.75 h-full w-px bg-slate-800" />

          <div className="space-y-12">
            {entries.map((entry) => (
              <article key={entry.version} className="relative pl-9">
                <div className="absolute top-1 left-0 flex h-5.75 w-5.75 items-center justify-center rounded-full border-2 border-slate-800 bg-slate-950">
                  <div className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT_CLASSES[entry.type]}`} />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
                  <header className="mb-5">
                    <p className="text-sm font-semibold tracking-wide text-cyan-300/90">
                      🚀 Version {entry.version}
                    </p>
                    <p className={`mt-1 text-xs font-medium uppercase tracking-[0.18em] ${TYPE_LABEL_CLASSES[entry.type]}`}>
                      {TYPE_LABELS[entry.type]} · {formatDisplayDate(entry.date)}
                    </p>
                    <h2 className="mt-4 text-lg font-bold leading-snug text-white">
                      {entry.title}
                    </h2>
                  </header>

                  <p className="mb-6 text-sm leading-7 text-slate-400">
                    {entry.summary}
                  </p>

                  <ul className="space-y-3">
                    {entry.items.map((item) => (
                      <li
                        key={item.title}
                        className="flex gap-3 rounded-xl border border-slate-800/70 bg-slate-950/20 p-4"
                      >
                        <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT_CLASSES[entry.type]}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100">
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-400">
                            {item.description}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-6 text-right text-xs italic text-slate-600">
                    — Holdet bag GPSLØB
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}