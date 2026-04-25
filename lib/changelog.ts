export type ChangelogEntry = {
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

export const changelogEntries: ChangelogEntry[] = [
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