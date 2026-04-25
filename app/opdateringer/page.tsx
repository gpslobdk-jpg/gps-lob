import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seneste nyt – GPSLØB",
  description:
    "Følg med i de seneste forbedringer og opdateringer til GPSLØB-platformen.",
};

type ChangelogEntry = {
  version: string;
  date: string;
  type: "major" | "minor" | "fix";
  title: string;
  summary: string;
  items: {
    title: string;
    description: string;
  }[];
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

const entries: ChangelogEntry[] = [
  {
    version: "3.0",
    date: "2026-04-27",
    type: "major",
    title: "GPSLØB Version 3.0",
    summary: "Større forbedring af GPS-oplevelsen og nyt kort-interface.",
    items: [
      {
        title: "Mere præcis GPS",
        description: "Glidende bevægelse og adaptiv smoothing giver mere stabile positioner.",
      },
      {
        title: "Mindre lag",
        description: "Kortet føles hurtigere og mere responsivt i brug.",
      },
      {
        title: "Stabilitet uden signal",
        description: "Dead reckoning hjælper, når GPS-signalet kortvarigt forsvinder.",
      },
      {
        title: "Nyt kortvalg",
        description: "Skift let mellem standardkort og satellitvisning.",
      },
      {
        title: "Forbedret brugeroplevelse",
        description: "Mere overskuelig UI og bedre interaktioner hele vejen rundt.",
      },
    ],
  },
  {
    version: "2.5",
    date: "2026-04-16",
    type: "major",
    title: "Platformgenstart og ny motor",
    summary: "Platformen blev genopbygget med nyt design, bedre offline-adfærd og et stærkere AI-flow.",
    items: [
      {
        title: "Nyt Nature-Glass design",
        description: "En smukkere og mere flydende brugeroplevelse.",
      },
      {
        title: "Pædagogisk AI 2.0",
        description: "Præcis differentiering til alle klassetrin (1.-9. klasse).",
      },
      {
        title: "Offline-overlevelse",
        description: "Appen gemmer data lokalt, hvis forbindelsen ryger i skoven.",
      },
      {
        title: "Apple og Safari-optimering",
        description: "Testet og sikret til iPhone-brugere.",
      },
      {
        title: "Fysisk stjerneløb",
        description: "Nu som selvstændigt værktøj til analoge løb.",
      },
    ],
  },
  {
    version: "2.4",
    date: "2026-04-13",
    type: "minor",
    title: "Selv-heling og stabilitet",
    summary: "GPS-løbet genopretter nu forbindelsen automatisk efter inaktivitet.",
    items: [
      {
        title: "GPS-løb",
        description: "Skærmen hænger ikke længere fast på indlæsningsstatus efter inaktivitet.",
      },
      {
        title: "Stabilitet",
        description: "Overvågning fanger netværksudfald og hjælper driften videre.",
      },
    ],
  },
  {
    version: "2.3",
    date: "2026-04-12",
    type: "minor",
    title: "GPS-præcision og builder-løft",
    summary: "Positionerne blev skarpere, fotoløbet hurtigere og byggerne fik et moderniseret udtryk.",
    items: [
      {
        title: "Skarpere GPS-præcision",
        description: "Elevens position opdaterer hurtigere og mere præcist ude i terrænet.",
      },
      {
        title: "Fotoløb er nu lynhurtigt",
        description: "Billeder lander direkte i lærerens live-stream, så eleverne kan løbe videre.",
      },
      {
        title: "Kæmpe designløft til alle byggere",
        description: "Moderne settings-kort og et mere strømlinet AI-reviewflow.",
      },
    ],
  },
  {
    version: "2.2",
    date: "2026-04-10",
    type: "fix",
    title: "Driftsstatus: akut hotfix",
    summary: "Et forbindelses-loop blev rettet, og den stabile drift blev genoprettet.",
    items: [
      {
        title: "Driftsmeddelelse",
        description: "Berørte funktioner blev rullet tilbage, og stabiliteten blev genskabt.",
      },
    ],
  },
  {
    version: "2.1",
    date: "2026-04-09",
    type: "minor",
    title: "Adgang, GPS og navigation",
    summary: "Bedre pinkode-flow, hurtigere GPS-genfinding og tydeligere adgang til live-data.",
    items: [
      {
        title: "Slut med pinkode-bøvl",
        description: "Det 6. ciffer virker nu på alle enheder.",
      },
      {
        title: "Manuel GPS-opdatering",
        description: "Prøv igen-knappen tvinger browseren til at søge efter lokation på ny.",
      },
      {
        title: "Forsinkede elever kan følge med",
        description: "QR-kode og pinkode er altid synlige i live-dashboardet.",
      },
      {
        title: "Smartere navigation",
        description: "Klik på en markør for at hoppe direkte til den tilhørende post.",
      },
      {
        title: "AI-assistenten spiller bedre",
        description: "Klassetrinsmenuen ligger ikke længere bag andre overlays.",
      },
    ],
  },
  {
    version: "2.0",
    date: "2026-04-07",
    type: "minor",
    title: "Stabilt forårsflow",
    summary: "Løbet blev mere robust, overskueligt og bedre at bruge i stærkt lys.",
    items: [
      {
        title: "Elever mister ikke længere forbindelsen",
        description: "Baggrundsgenopretning hjælper, når netværket bliver ustabilt.",
      },
      {
        title: "Nyt, lyst dashboard til lærere",
        description: "Tydeligere kort, poster og elever giver hurtigere overblik.",
      },
      {
        title: "Outdoor mode",
        description: "Højere kontrast og mindre gennemsigtighed gør skærmen lettere at aflæse i solen.",
      },
    ],
  },
];

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