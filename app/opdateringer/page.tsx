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

const entries = [
  {
    version: "13/6",
    date: "2026-06-13",
    type: "major" as const,
    title: "Ny Mobilspil-side og første spil: Find Bedrageren",
    summary:
      "GPSLØB har fået en ny Mobilspil-side på lærerens dashboard. Her samles sociale og interaktive spil, som eleverne kan spille fra deres mobil.\n\nFørste spil er Find Bedrageren: et socialt bluff-spil, hvor eleverne får roller, et hemmeligt ord og skal diskutere, stemme og forsøge at afsløre bedrageren.\n\nFind Bedrageren har nu et komplet spilflow med oprettelse, elev-join, rollefordeling, diskussion, afstemning, resultat, spil igen og afslutning. Spillet har også fået en tydelig introduktionsside før opsætningen, så læreren hurtigt kan forstå spillet, før det oprettes.\n\nMobilspil-siden bliver fremover stedet, hvor nye spilmoduler kan samles.",
    items: [
      {
        title: "Ny Mobilspil-side",
        description:
          "Dashboardet har fået en samlet indgang til sociale og interaktive spil, som eleverne kan spille fra mobilen.",
      },
      {
        title: "Find Bedrageren er første spil",
        description:
          "Et socialt bluff-spil med roller, hemmeligt ord, diskussion og afstemning.",
      },
      {
        title: "Komplet spilflow",
        description:
          "Spillet understøtter oprettelse, elev-join, rollefordeling, diskussion, afstemning, resultat, spil igen og afslutning.",
      },
      {
        title: "Tydelig intro før opsætning",
        description:
          "Læreren får en rolig introduktionsside, så spillet er lettere at forstå, før det oprettes.",
      },
    ],
  },
  {
    version: "11/6",
    date: "2026-06-11",
    type: "major" as const,
    title: "VM26 – Jagten på pokalen er landet",
    summary:
      "Vi har åbnet for VM26 – Jagten på pokalen: et færdigt fodboldinspireret GPS-løb, som du finder under Spil, når du opretter et nyt løb.\n\nVM26 er bygget som et almindeligt GPS-løb med VM-stemning. Du får 8 færdige fodboldposter, et særligt VM-look i builderen, VM-badge hos elever og lærer, \"MÅÅÅL!\" ved korrekt svar og en enkel VM-stilling i lærervisningen. Du kan stadig redigere poster, svar, point og placeringer på den velkendte måde.\n\nZone-Krig har også fået en tydeligere afslutning: vinderen findes nu ud fra de zoner, holdene ejer, når kampen slutter. Skjolde og kamptid vises mere klart, så både lærer og elever lettere kan forstå, hvad der sker undervejs.\n\nFotoløb er blevet mere glidende. Når et billede er uploadet, sendes eleverne videre til næste post uden at skulle genindlæse browseren mellem fotoposter.\n\nDerudover er elevstart, PWA/browser-start og GPS-oplevelsen på mobil gjort lettere og mere stabil.",
    items: [
      {
        title: "Nyt VM26-spil under Spil",
        description:
          "Start et færdigt VM-løb med 8 fodboldposter og rediger det bagefter som et almindeligt GPS-løb.",
      },
      {
        title: "VM-stemning i elev- og lærervisningen",
        description:
          "Elever og lærer får VM-badge, “MÅÅÅL!”-feedback ved korrekt svar og en enkel read-only VM-stilling.",
      },
      {
        title: "Zone-Krig er tydeligere",
        description:
          "Vinderen findes nu ud fra ejede zoner ved slut, og både skjoldtimer og kamptimer er lettere at følge.",
      },
      {
        title: "Fotoløb glider bedre",
        description:
          "Efter upload går eleverne videre til næste post uden normalt at skulle genindlæse browseren.",
      },
      {
        title: "Mere stabil elevoplevelse",
        description:
          "Elevstart, PWA/browser-start og GPS-oplevelsen på mobil er gjort lettere og mere robust.",
      },
    ],
  },
  {
    version: "Appstatus 12/05",
    date: "2026-05-12",
    type: "minor" as const,
    title: "Appstatus 12/05",
    summary:
      "Android-testforløbet er godt i gang, og iOS testes nu via TestFlight. Målet er en mere stabil og app-lignende oplevelse for elever, især omkring GPS, tilladelser, skærm og elevflow.",
    items: [
      {
        title: "Android",
        description:
          "Testforløbet via Google Play er langt fremme, og appen skal give bedre GPS-adfærd end almindelig mobilbrowser.",
      },
      {
        title: "iOS",
        description:
          "TestFlight er åbnet for testere, så vi kan afprøve elevflowet på rigtige iPhones før App Store-udgivelse.",
      },
      {
        title: "Elevflow",
        description:
          "Der er lavet målrettede WebKit/iPhone-tests af join, waiting screen, GPS-blokering og gennemførsel af flere poster.",
      },
      {
        title: "Stabilitet",
        description:
          "App-versionerne skal på sigt gøre det nemmere at undgå elever, der sidder fast på grund af GPS, netværk eller mobilbrowserens begrænsninger.",
      },
      {
        title: "Hjælp os gerne",
        description:
          "Hvis I tester og oplever problemer, så send gerne besked med mobiltype, browser/app og hvad der skete.",
      },
    ],
  },
  {
    version: "Appstatus 27/04",
    date: "2026-04-27",
    type: "minor" as const,
    title: "Appen er på vej",
    summary:
      "Vi har nu samlet nok testere til vores Google Play-testforløb, og vi arbejder på højtryk for at gøre GPS Løb klar som app. Målet er at udgive GPS Løb både til Android via Google Play og senere til iPhone via App Store.\n\nApp-versionen skal give en mere stabil oplevelse, især når elever bruger GPS under et løb. Den nuværende webversion virker allerede for mange, men mobilbrowsere kan desværre nogle gange begrænse GPS, strømforbrug eller baggrundsaktivitet. Det kan påvirke oplevelsen under et aktivt GPS-løb.\n\nHvis I oplever problemer med den nuværende side, må I meget gerne skrive til gpslobdk@gmail.com. Så undersøger vi det så godt vi kan. Nogle begrænsninger ligger dog i selve mobilbrowserne, og derfor glæder vi os ekstra meget til at få app-versionerne ud.\n\nVi fortæller selvfølgelig alle, så snart appen er klar. Glæd jer!",
    items: [],
  },
  ...changelogEntries,
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
            Seneste nyt
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
                      Version {entry.version}
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
