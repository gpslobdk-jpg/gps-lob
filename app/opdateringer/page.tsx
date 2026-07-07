import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Seneste nyt - SkoleGPS",
  description: "Korte opdateringer om SkoleGPS.dk og de nye skoleværktøjer.",
};

const updates = [
  {
    title: "GPSLøb bliver til SkoleGPS.dk",
    body:
      "GPSLøb fortsætter, men bliver nu en del af SkoleGPS.dk. Løb, login og arkiv fortsætter, mens platformen samler flere værktøjer til skoler og lærere.",
  },
  {
    title: "Nye lærerværktøjer på vej",
    body:
      "SkoleGPS.dk samler flere digitale skoleværktøjer. Første værktøjer er SkemaPilot til skemaarbejde og SkolePodcast til elevpodcasts.",
    link: {
      href: "https://www.skemapilot.dk",
      label: "SkemaPilot.dk",
    },
    note: "SkolePodcast.dk er på vej.",
  },
];

export default function OpdateringerPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <main className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Tilbage til forsiden
        </Link>

        <header className="mb-10">
          <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/8 px-3 py-1 text-xs font-medium tracking-wider text-amber-300 uppercase">
            Seneste nyt
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">Seneste nyt</h1>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Her samler vi korte opdateringer om SkoleGPS.dk og de nye skoleværktøjer.
          </p>
        </header>

        <div className="space-y-5">
          {updates.map((update) => (
            <article
              key={update.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg"
            >
              <h2 className="text-xl font-bold leading-snug text-white">{update.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">{update.body}</p>

              {update.link ? (
                <a
                  href={update.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-200/40 hover:bg-cyan-300/12"
                >
                  {update.link.label}
                </a>
              ) : null}

              {update.note ? (
                <p className="mt-4 text-sm leading-6 text-slate-500">{update.note}</p>
              ) : null}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
