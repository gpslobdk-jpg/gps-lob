export type PrintpakkePhase = {
  body: string;
  title: string;
};

export type Printpakke = {
  activityType: string;
  curriculumHref: string;
  curriculumNote: string;
  description: string;
  detailDescription: string;
  duration: string;
  gradeLevel: string;
  illustration: string;
  illustrationAlt: string;
  materialSummary: string;
  phases: readonly PrintpakkePhase[];
  publicPreview: string;
  previewImages: readonly [string, string];
  previewImageAlts: readonly [string, string];
  slug: string;
  stationCount: number;
  subject: string;
  title: string;
  version: string;
};

/**
 * This is deliberately public, facit-free catalogue data. Private answers,
 * clue text, and trusted PDF filenames live in server-only/generator modules.
 */
export const PRINTPAKKER = [
  {
    slug: "efteraarsmysteriet",
    version: "1.0",
    title: "Efterårsmysteriet",
    description: "Et matematikmysterium med seks poster, sporbrikker og en fælles afsløring.",
    detailDescription: "Den forsvundne lanterne er en komplet, analog mysteriejagt med seks korte matematikposter og et fælles spor at samle.",
    subject: "Matematik",
    gradeLevel: "5.-6. klasse",
    activityType: "Makkerløb ved bordene",
    duration: "55-60 min.",
    stationCount: 6,
    illustration: "/printpakker/afteraarsmysteriet-hero.png",
    illustrationAlt: "Elever samarbejder om et efterårsmysterium med papirer og lygter i skolegården.",
    publicPreview: "/printpakker/afteraarsmysteriet-forhaandsvisning.pdf",
    previewImages: [
      "/printpakker/previews/afteraarsmysteriet-preview-1.png",
      "/printpakker/previews/afteraarsmysteriet-preview-2.png",
    ],
    previewImageAlts: [
      "Forside af den facitfrie forhåndsvisning til Efterårsmysteriet.",
      "Eksempelpost med skriveplads fra den facitfrie forhåndsvisning til Efterårsmysteriet.",
    ],
    curriculumHref: "https://uvm.dk/media/ko0dtyah/240513-faellesmaal-matematik.pdf",
    curriculumNote: "Målrettet matematiske kompetencer, tal og algebra samt geometri og måling efter 6. klassetrin.",
    materialSummary: "Seks A4-poster, holdark, blyanter eller kladdepapir og lærerens sporbrikker.",
    phases: [
      { title: "Klargør.", body: "Print seks poster, holdark og lærerens sporbrikker." },
      { title: "Arbejd i makkere.", body: "Hvert hold viser sin strategi - ikke bare svaret." },
      { title: "Saml mysteriet.", body: "Klassen bruger de seks udleverede brikker til den afsluttende besked." },
    ],
  },
  {
    slug: "kystbyens-forsyningsplan",
    version: "1.0",
    title: "Kystbyens forsyningsplan",
    description: "Et fysisk matematikpostløb, hvor holdene får havnebyens marked, ruter og budget til at hænge sammen.",
    detailDescription: "Markedet åbner om en time. Holdene bruger beregninger, mål og data til at aflevere én begrundet plan for den lille kystbys forsyning.",
    subject: "Matematik",
    gradeLevel: "5.-6. klasse",
    activityType: "Fysisk postløb",
    duration: "60-70 min.",
    stationCount: 6,
    illustration: "/printpakker/kystbyens-forsyningsplan-hero.png",
    illustrationAlt: "En varm, nordisk havneby med markedskasser, færge og en analog plan på et bord.",
    publicPreview: "/printpakker/kystbyens-forsyningsplan-forhaandsvisning.pdf",
    previewImages: [
      "/printpakker/previews/kystbyens-forsyningsplan-preview-1.png",
      "/printpakker/previews/kystbyens-forsyningsplan-preview-2.png",
    ],
    previewImageAlts: [
      "Forside af den facitfrie forhåndsvisning til Kystbyens forsyningsplan.",
      "Eksempelpost med skriveplads fra den facitfrie forhåndsvisning til Kystbyens forsyningsplan.",
    ],
    curriculumHref: "https://uvm.dk/media/ko0dtyah/240513-faellesmaal-matematik.pdf",
    curriculumNote: "Målrettet kompetencemål efter 6. klassetrin om sammensatte situationer, rationale tal og enkle geometriske mål.",
    materialSummary: "Seks A4-poster, holdark, blyanter, linealer og lærerens planbrikker.",
    phases: [
      { title: "Åbn markedet.", body: "Fordel posterne ved borde, i klasseværelset eller langs en lille rute." },
      { title: "Byg planen.", body: "Holdene regner, måler og begrunder deres valg på holdarket." },
      { title: "Aflever.", body: "De seks planbrikker samles til byens færdige forsyningsplan." },
    ],
  },
  {
    slug: "det-sidste-program",
    version: "1.0",
    title: "Det sidste program",
    description: "Et danskpostløb, hvor en klasse genopbygger et forsvundet biografprogram med tekster, billeder og præcist sprog.",
    detailDescription: "Den lokale biograf åbner igen, men programmet er gået i stykker. Holdene læser, fortolker, skriver og giver respons, før premieren kan begynde.",
    subject: "Dansk",
    gradeLevel: "5.-6. klasse",
    activityType: "Fysisk postløb",
    duration: "60-70 min.",
    stationCount: 6,
    illustration: "/printpakker/det-sidste-program-hero.png",
    illustrationAlt: "Et varmt gammelt biografrum med projektorlys, blanke programkort og papirrester.",
    publicPreview: "/printpakker/det-sidste-program-forhaandsvisning.pdf",
    previewImages: [
      "/printpakker/previews/det-sidste-program-preview-1.png",
      "/printpakker/previews/det-sidste-program-preview-2.png",
    ],
    previewImageAlts: [
      "Forside af den facitfrie forhåndsvisning til Det sidste program.",
      "Eksempelpost med skriveplads fra den facitfrie forhåndsvisning til Det sidste program.",
    ],
    curriculumHref: "https://uvm.dk/media/ja3khnn2/240513-faellesmaal-dansk.pdf",
    curriculumNote: "Målrettet kompetencemål efter 6. klassetrin om læsning, fremstilling, fortolkning og kommunikation.",
    materialSummary: "Seks A4-poster, holdark, blyanter og lærerens programbrikker.",
    phases: [
      { title: "Læs sporene.", body: "Holdene undersøger korte, originale programtekster, kort og billedspor." },
      { title: "Skriv og begrund.", body: "Hvert hold formulerer sin egen korte programtekst og viser sine valg." },
      { title: "Premiere.", body: "Programbrikkerne samles til den fælles afslutning." },
    ],
  },
  {
    slug: "the-pop-up-bookshop",
    version: "1.0",
    title: "The Pop-up Bookshop",
    description: "Et engelsksproget postløb med bogspor, kundesamtaler og korte tekster til en pop-up-boghandel.",
    detailDescription: "A pop-up bookshop opens today. Teams solve six English tasks and build a small welcome desk with a recommendation, a message and a spoken book pitch.",
    subject: "Engelsk",
    gradeLevel: "5.-7. klasse",
    activityType: "Fysisk postløb",
    duration: "60-70 min.",
    stationCount: 6,
    illustration: "/printpakker/the-pop-up-bookshop-hero.png",
    illustrationAlt: "En indbydende pop-up-boghandel med blanke bøger, en kuffert og et lille velkomstbord.",
    publicPreview: "/printpakker/the-pop-up-bookshop-forhaandsvisning.pdf",
    previewImages: [
      "/printpakker/previews/the-pop-up-bookshop-preview-1.png",
      "/printpakker/previews/the-pop-up-bookshop-preview-2.png",
    ],
    previewImageAlts: [
      "Forside af den facitfrie forhåndsvisning til The Pop-up Bookshop.",
      "Eksempelpost med skriveplads fra den facitfrie forhåndsvisning til The Pop-up Bookshop.",
    ],
    curriculumHref: "https://uvm.dk/media/ggje3sq0/251030-engelsk-faelles-maal-2019.pdf",
    curriculumNote: "Målrettet kompetencemål efter 7. klassetrin om mundtlig og skriftlig kommunikation samt kultur og samfund.",
    materialSummary: "Seks A4-poster, holdark, blyanter og lærerens welcome-desk-brikker.",
    phases: [
      { title: "Open the shop.", body: "Teams receive a simple English mission and begin at different stations." },
      { title: "Talk, read and write.", body: "Each station asks for an English response, not a Danish translation." },
      { title: "Welcome visitors.", body: "The six desk pieces make one shared English welcome message." },
    ],
  },
  {
    slug: "regnhavens-laboratorium",
    version: "1.0",
    title: "Regnhavens laboratorium",
    description: "Et natur/teknologi-postløb med hypotese, undersøgelse, model og en begrundet anbefaling til skolens gård.",
    detailDescription: "Skolen vil anlægge en lille regnhave. Holdene følger vandets vej gennem seks konkrete poster og afleverer til sidst en enkel, dataunderbygget anbefaling.",
    subject: "Natur/teknologi",
    gradeLevel: "5.-6. klasse",
    activityType: "Fysisk postløb",
    duration: "65-75 min.",
    stationCount: 6,
    illustration: "/printpakker/regnhavens-laboratorium-hero.png",
    illustrationAlt: "Et poetisk regnhavelaboratorium med vandrender, planter og små forsøgsbakker.",
    publicPreview: "/printpakker/regnhavens-laboratorium-forhaandsvisning.pdf",
    previewImages: [
      "/printpakker/previews/regnhavens-laboratorium-preview-1.png",
      "/printpakker/previews/regnhavens-laboratorium-preview-2.png",
    ],
    previewImageAlts: [
      "Forside af den facitfrie forhåndsvisning til Regnhavens laboratorium.",
      "Eksempelpost med skriveplads fra den facitfrie forhåndsvisning til Regnhavens laboratorium.",
    ],
    curriculumHref: "https://uvm.dk/media/mq1n45hn/240513-faellesmaal-naturteknologi.pdf",
    curriculumNote: "Målrettet kompetencemål efter 6. klassetrin om undersøgelse, modellering, perspektivering og kommunikation.",
    materialSummary: "Seks A4-poster, holdark, blyanter samt valgfrie bakker, målebægre og papirstrimler til den lille undersøgelse.",
    phases: [
      { title: "Stil et spørgsmål.", body: "Holdene starter med en hypotese om vand, overflader og nedsivning." },
      { title: "Undersøg og model.", body: "Poster kan løses med kortmaterialer eller suppleres med et enkelt klasseforsøg." },
      { title: "Giv en anbefaling.", body: "De seks laboratoriebrikker samles til en tydelig begrundet løsning." },
    ],
  },
  {
    slug: "kufferten-fra-kobstaden",
    version: "1.0",
    title: "Kufferten fra Købstaden",
    description: "Et historiepostløb med opfundne kildespor, tidslinje, kildekritik og en lille museumsudstilling.",
    detailDescription: "Et museum har fundet en kuffert med originale, konstruerede spor. Holdene skelner mellem belæg, tolkning og gæt, før de kuraterer en museumslabel.",
    subject: "Historie",
    gradeLevel: "5.-6. klasse",
    activityType: "Fysisk postløb",
    duration: "60-70 min.",
    stationCount: 6,
    illustration: "/printpakker/kufferten-fra-kobstaden-hero.png",
    illustrationAlt: "Et varmt arkæologibord ved et gammelt bytorv med en kuffert, genstande og historiske spor uden læsbar tekst.",
    publicPreview: "/printpakker/kufferten-fra-kobstaden-forhaandsvisning.pdf",
    previewImages: [
      "/printpakker/previews/kufferten-fra-kobstaden-preview-1.png",
      "/printpakker/previews/kufferten-fra-kobstaden-preview-2.png",
    ],
    previewImageAlts: [
      "Forside af den facitfrie forhåndsvisning til Kufferten fra Købstaden.",
      "Eksempelpost med skriveplads fra den facitfrie forhåndsvisning til Kufferten fra Købstaden.",
    ],
    curriculumHref: "https://uvm.dk/media/gxkhp2yp/240513-faellesmaal-historie.pdf",
    curriculumNote: "Målrettet kompetencemål efter 6. klassetrin om kronologi og sammenhæng, kildearbejde og historiebrug.",
    materialSummary: "Seks A4-poster, holdark, blyanter og lærerens museumsbrikker. Alle kildespor i pakken er tydeligt konstruerede.",
    phases: [
      { title: "Åbn kufferten.", body: "Holdene undersøger seks tydeligt konstruerede kildespor." },
      { title: "Skeln og begrund.", body: "Ved hver post noterer holdet, hvad kilden kan pege på - og hvad den ikke kan bevise." },
      { title: "Kurater udstillingen.", body: "Museumsbrikkerne samles til en fælles afsluttende label." },
    ],
  },
] as const satisfies readonly Printpakke[];

export type PrintpakkeSlug = (typeof PRINTPAKKER)[number]["slug"];

export function getPrintpakke(slug: string): Printpakke | undefined {
  return PRINTPAKKER.find((printpakke) => printpakke.slug === slug);
}

export function getPrintpakkeFilterOptions(printpakker: readonly Printpakke[] = PRINTPAKKER) {
  return {
    subjects: [...new Set(printpakker.map((printpakke) => printpakke.subject))],
    gradeLevels: [...new Set(printpakker.map((printpakke) => printpakke.gradeLevel))],
    activityTypes: [...new Set(printpakker.map((printpakke) => printpakke.activityType))],
  };
}
