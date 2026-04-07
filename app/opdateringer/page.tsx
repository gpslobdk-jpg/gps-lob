import Link from "next/link";
import { ArrowLeft, Wifi, LayoutDashboard, Sun } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seneste nyt – GPSLØB",
  description:
    "Følg med i de seneste forbedringer og opdateringer til GPSLØB-platformen.",
};

interface Entry {
  date: string;
  title: string;
  tag: string;
  items: { icon: React.ReactNode; heading: string; body: string }[];
}

const entries: Entry[] = [
  {
    date: "7. april 2026",
    title: "Stabilt, overskueligt og klar til forårssolen",
    tag: "Ny opdatering",
    items: [
      {
        icon: <Wifi className="h-4 w-4 text-emerald-400" />,
        heading: "Elever mister ikke længere forbindelsen",
        body: "Vi har bygget et helt nyt sikkerhedsnet under løbet. Hvis en elevs telefon mister nettet bag en bygning, går systemet ikke længere i panik. Forbindelsen genoprettes nu usynligt i baggrunden, og eleverne kan roligt spille videre uden at miste deres fremskridt.",
      },
      {
        icon: <LayoutDashboard className="h-4 w-4 text-emerald-400" />,
        heading: "Nyt, lyst dashboard til lærere",
        body: "Lærernes kontroltårn er blevet redesignet. Kortene er nu lyse, posterne er firkantede og tydelige, og elevernes markører popper i orange. Det giver et lynhurtigt og professionelt overblik, mens løbet er i gang.",
      },
      {
        icon: <Sun className="h-4 w-4 text-amber-400" />,
        heading: "Outdoor Mode — klar til undervisning i solen",
        body: "Når eleverne løber udendørs i direkte sollys, kan en mørk mobilskærm være næsten umulig at aflæse. Vi har derfor fjernet gennemsigtige paneler, gjort svarknapperne skarpe og skruet op for kontrasten over hele linjen. Skærmen er nu nem at aflæse, selv når forårssolen bager.",
      },
    ],
  },
];

export default function OpdateringerPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-2xl">
        {/* Back link */}
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbage til forsiden
        </Link>

        {/* Header */}
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

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute top-0 left-2.75 h-full w-px bg-slate-800" />

          <div className="space-y-12">
            {entries.map((entry, i) => (
              <div key={i} className="relative pl-9">
                {/* Dot */}
                <div className="absolute top-1 left-0 flex h-5.75 w-5.75 items-center justify-center rounded-full border-2 border-emerald-500 bg-slate-950">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
                  {/* Meta */}
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                      {entry.tag}
                    </span>
                    <time className="text-xs text-slate-500">{entry.date}</time>
                  </div>

                  <h2 className="mb-5 text-lg font-bold leading-snug text-white">
                    ✨ {entry.title}
                  </h2>

                  {/* Items */}
                  <ul className="space-y-5">
                    {entry.items.map((item, j) => (
                      <li key={j} className="flex gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
                          {item.icon}
                        </div>
                        <div>
                          <p className="mb-1 text-sm font-semibold text-slate-100">
                            {item.heading}
                          </p>
                          <p className="text-sm leading-6 text-slate-400">
                            {item.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-6 text-right text-xs text-slate-600 italic">
                    — Holdet bag GPSLØB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
