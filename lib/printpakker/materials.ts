import { PRINTPAKKER, type Printpakke } from "./catalog";
import type { PrintpakkeDownloadVariant } from "./links";

export type PrintmaterialFormat = "Postløb" | "Arbejdsark";

export type PrintmaterialDownload = {
  cardAction?: "student" | "answers" | "whole";
  description: string;
  label: string;
  variant: PrintpakkeDownloadVariant;
};

export type PrintmaterialCurriculum = {
  checkedAt: string;
  href: string;
  note: string;
  source: string;
  status: "Gældende ramme" | "Vejledende indhold" | "Udkast til fagplan";
};

/**
 * Public, facit-free library data. It is safe to pass this shape to client
 * components. Answers, teacher notes, checksums and asset paths stay in the
 * server-only artifact manifest and editorial export source.
 */
export type Printmaterial = {
  activityType: string;
  contentStatus: "legacy" | "draft";
  contentVersion: string;
  curriculum: readonly PrintmaterialCurriculum[];
  description: string;
  detailDescription: string;
  downloads: readonly PrintmaterialDownload[];
  duration: string;
  familyId: string;
  format: PrintmaterialFormat;
  gradeLevel: string;
  howToUse: readonly string[];
  id: string;
  learningIntentions: readonly string[];
  preview: {
    pageImageAlts: readonly string[];
    pageImageUrls: readonly string[];
    publicPdfUrl: string;
    thumbnailAlt: string;
    thumbnailUrl: string;
    version: string;
  };
  prerequisites: readonly string[];
  printInstructions: string;
  relatedSlugs: readonly string[];
  stationCount?: number;
  subject: string;
  slug: string;
  title: string;
  topic: string;
};

const legacyTopics: Record<string, string> = {
  Matematik: "Tal og regning",
  Dansk: "Læsning og fremstilling",
  Engelsk: "Sprog og kommunikation",
  "Natur/teknologi": "Undersøgelse og model",
  Historie: "Kildearbejde",
};

function legacyDownloads(): readonly PrintmaterialDownload[] {
  return [
    {
      cardAction: "student",
      label: "Elevmateriale",
      description: "Elevark uden lærerfacit.",
      variant: "student",
    },
    {
      cardAction: "whole",
      label: "Hele pakken · inkl. facit",
      description: "Samlet lærerpakke med elevark, vejledning og facit.",
      variant: "whole-colour",
    },
    {
      label: "Hele pakken · blækbesparende · inkl. facit",
      description: "Samme samlede pakke i en rolig, blækbesparende udgave.",
      variant: "whole-ink-saver",
    },
    {
      cardAction: "answers",
      label: "Facit",
      description: "Separat facit til læreren.",
      variant: "answer-key",
    },
    {
      label: "Lærervejledning",
      description: "Forberedelse og gennemførsel.",
      variant: "teacher-guide",
    },
  ];
}

function adaptLegacyPrintpakke(printpakke: Printpakke): Printmaterial {
  return {
    id: `legacy:${printpakke.slug}`,
    familyId: `legacy:${printpakke.slug}`,
    slug: printpakke.slug,
    title: printpakke.title,
    description: printpakke.description,
    detailDescription: printpakke.detailDescription,
    subject: printpakke.subject,
    topic: legacyTopics[printpakke.subject] ?? "Fagligt forløb",
    format: "Postløb",
    gradeLevel: printpakke.gradeLevel,
    duration: printpakke.duration,
    activityType: printpakke.activityType,
    stationCount: printpakke.stationCount,
    contentVersion: printpakke.version,
    contentStatus: "legacy",
    learningIntentions: [printpakke.curriculumNote],
    prerequisites: [],
    howToUse: printpakke.phases.map((phase) => `${phase.title} ${phase.body}`),
    printInstructions: printpakke.materialSummary,
    downloads: legacyDownloads(),
    preview: {
      thumbnailUrl: printpakke.previewImages[1],
      thumbnailAlt: printpakke.previewImageAlts[1],
      pageImageUrls: printpakke.previewImages,
      pageImageAlts: printpakke.previewImageAlts,
      publicPdfUrl: printpakke.publicPreview,
      version: printpakke.version,
    },
    curriculum: [{
      source: "Fælles Mål",
      href: printpakke.curriculumHref,
      checkedAt: "2026-10-07",
      status: "Vejledende indhold",
      note: printpakke.curriculumNote,
    }],
    relatedSlugs: [],
  };
}

const klassebodenCommon = {
  familyId: "klasseboden",
  subject: "Matematik",
  topic: "Tal og regning · plus og minus",
  gradeLevel: "2. klasse · indskoling",
  contentVersion: "2026-10-07.1",
  contentStatus: "draft" as const,
  prerequisites: [
    "Tælle til 20.",
    "Kende plus og minus i konkrete situationer.",
  ],
  learningIntentions: [
    "Finde, hvor meget der er tilsammen.",
    "Finde, hvor meget der mangler, og hvor stor forskellen er.",
    "Vise en løsning med tegning, optælling eller regneudtryk.",
  ],
  curriculum: [
    {
      source: "Matematik — Fælles Mål (EMU/UVM, 2019)",
      href: "https://emu.dk/sites/default/files/2020-09/GSK_F%C3%A6llesM%C3%A5l_Matematik.pdf",
      checkedAt: "2026-10-07",
      status: "Vejledende indhold" as const,
      note: "Materialet er vores redaktionelle bidrag til tal og regning. Det dækker ikke et helt fag eller trinforløb.",
    },
    {
      source: "Om Fælles Mål (UVM)",
      href: "https://uvm.dk/grundskole/folkeskolen/fag-og-indhold/fag-emner-og-tvaergaaende-temaer/faelles-maal/",
      checkedAt: "2026-10-07",
      status: "Gældende ramme" as const,
      note: "Færdigheds- og vidensområder er vejledende; materialet gør ikke krav på at være en bindende målfortolkning.",
    },
  ],
} satisfies Pick<Printmaterial, "contentStatus" | "contentVersion" | "curriculum" | "familyId" | "gradeLevel" | "learningIntentions" | "prerequisites" | "subject" | "topic">;

const klassebodenPostloeb: Printmaterial = {
  id: "klasseboden:postloeb",
  slug: "klasseboden-postloeb",
  title: "Klasseboden — postløb",
  description: "Seks selvstændige plus- og minusposter, hvor makkerpar viser deres løsning inden for 20.",
  detailDescription: "Et roligt matematikpostløb til makkerpar. Hver post kan løses fra ethvert startsted, og eleverne viser med ord, tegning eller regneudtryk, hvordan de tænker.",
  format: "Postløb",
  duration: "ca. 45 min. · planlagt",
  activityType: "Makkerpar ved poster",
  stationCount: 6,
  howToUse: [
    "Start fælles med et eksempel med andre tal end på posterne.",
    "Lad makkerpar begynde ved forskellige poster og skrive på deres eget svarark.",
    "Saml op med to forskellige strategier for at finde det manglende beløb eller forskellen.",
  ],
  printInstructions: "Print de seks poster én gang pr. klasse. Print svararket på to sider til hvert makkerpar. Støttearket er valgfrit. Læreren beholder guide og facit.",
  downloads: [
    {
      cardAction: "student",
      label: "Elevmateriale",
      description: "Seks poster og et tosiders svarark uden facit.",
      variant: "student",
    },
    {
      cardAction: "answers",
      label: "Facit",
      description: "To siders lærerfacit med forklaringer og åbne svar.",
      variant: "answer-key",
    },
    {
      cardAction: "whole",
      label: "Hele pakken · inkl. facit",
      description: "Poster, svarark, lærervejledning og facit i én farvepakke.",
      variant: "whole-colour",
    },
    {
      label: "Poster · farve",
      description: "Seks A4-poster til ét sæt i klassen.",
      variant: "stations",
    },
    {
      label: "Poster · blækbesparende",
      description: "De samme seks poster i blækbesparende udgave.",
      variant: "stations-ink-saver",
    },
    {
      label: "Svarark · farve",
      description: "To sider til hvert makkerpar.",
      variant: "answer-sheet",
    },
    {
      label: "Svarark · blækbesparende",
      description: "De samme to svararksider i blækbesparende udgave.",
      variant: "answer-sheet-ink-saver",
    },
    {
      label: "Elevmateriale · blækbesparende",
      description: "Poster og svarark uden facit i blækbesparende udgave.",
      variant: "student-ink-saver",
    },
    {
      label: "Facit · blækbesparende",
      description: "Det samme lærerfacit i blækbesparende udgave.",
      variant: "answer-key-ink-saver",
    },
    {
      label: "Lærervejledning · farve",
      description: "Én side om forberedelse, gennemførsel og opsamling.",
      variant: "teacher-guide",
    },
    {
      label: "Lærervejledning · blækbesparende",
      description: "Den samme guide i blækbesparende udgave.",
      variant: "teacher-guide-ink-saver",
    },
    {
      label: "Støtteark · farve",
      description: "Tallinje 0–20 og to tomme ti-rammer efter behov.",
      variant: "support",
    },
    {
      label: "Støtteark · blækbesparende",
      description: "Det samme støtteark i blækbesparende udgave.",
      variant: "support-ink-saver",
    },
    {
      label: "Hele pakken · blækbesparende · inkl. facit",
      description: "Samme 11-siders pakke i blækbesparende udgave.",
      variant: "whole-ink-saver",
    },
  ],
  preview: {
    thumbnailUrl: "/printpakker/previews/klasseboden-postloeb-preview-1.png",
    thumbnailAlt: "Facitfri elevpost fra Klasseboden-postløbet.",
    pageImageUrls: [
      "/printpakker/previews/klasseboden-postloeb-preview-1.png",
      "/printpakker/previews/klasseboden-postloeb-preview-2.png",
    ],
    pageImageAlts: [
      "Facitfri elevpost fra Klasseboden-postløbet.",
      "Facitfrit svarark fra Klasseboden-postløbet.",
    ],
    publicPdfUrl: "/printpakker/klasseboden-postloeb-forhaandsvisning.pdf",
    version: "2026-10-07.1",
  },
  relatedSlugs: ["klasseboden-arbejdsark"],
  ...klassebodenCommon,
};

const klassebodenArbejdsark: Printmaterial = {
  id: "klasseboden:arbejdsark",
  slug: "klasseboden-arbejdsark",
  title: "Klasseboden — arbejdsark",
  description: "Et selvstændigt todelt arbejdsark med plus, minus, forskel og begrundelser inden for 20.",
  detailDescription: "Et selvstændigt arbejdsark — ikke en forkortet kopi af postløbet. Eleverne møder et eksempel, regner selv og undersøger en forklaring med deres egen repræsentation.",
  format: "Arbejdsark",
  duration: "20-30 min. · planlagt",
  activityType: "Selvstændigt arbejdsark",
  howToUse: [
    "Brug arket som et selvstændigt forløb eller som opfølgning på fælles arbejde med plus og minus.",
    "Lad eleverne vise deres regning eller tegning i de åbne skrivefelter.",
    "Tag den undersøgende opgave op fælles, så forskellige forklaringer kan sammenlignes.",
  ],
  printInstructions: "Print begge elevsider som ét sæt pr. elev. Læreren beholder guide og facit. Farve og blækbesparende udgave har samme opgaver og rækkefølge.",
  downloads: [
    {
      cardAction: "student",
      label: "Elevmateriale",
      description: "To elevsider uden facit eller lærernoter.",
      variant: "student",
    },
    {
      cardAction: "answers",
      label: "Facit",
      description: "Separat lærerfacit med åbne svar og forklaringer.",
      variant: "answer-key",
    },
    {
      cardAction: "whole",
      label: "Hele pakken · inkl. facit",
      description: "Elevmateriale, guide og facit i én farvepakke.",
      variant: "whole-colour",
    },
    {
      label: "Elevmateriale · blækbesparende",
      description: "De samme to elevsider i blækbesparende udgave.",
      variant: "student-ink-saver",
    },
    {
      label: "Facit · blækbesparende",
      description: "Det samme lærerfacit i blækbesparende udgave.",
      variant: "answer-key-ink-saver",
    },
    {
      label: "Lærervejledning · farve",
      description: "Én side om brug, støtte og opsamling.",
      variant: "teacher-guide",
    },
    {
      label: "Lærervejledning · blækbesparende",
      description: "Den samme guide i blækbesparende udgave.",
      variant: "teacher-guide-ink-saver",
    },
    {
      label: "Hele pakken · blækbesparende · inkl. facit",
      description: "Den samme fire-siders pakke i blækbesparende udgave.",
      variant: "whole-ink-saver",
    },
  ],
  preview: {
    thumbnailUrl: "/printpakker/previews/klasseboden-arbejdsark-preview-1.png",
    thumbnailAlt: "Facitfri opgaveside fra Klasseboden-arbejdsarket.",
    pageImageUrls: [
      "/printpakker/previews/klasseboden-arbejdsark-preview-1.png",
      "/printpakker/previews/klasseboden-arbejdsark-preview-2.png",
    ],
    pageImageAlts: [
      "Første facitfrie elevside fra Klasseboden-arbejdsarket.",
      "Anden facitfrie elevside fra Klasseboden-arbejdsarket.",
    ],
    publicPdfUrl: "/printpakker/klasseboden-arbejdsark-forhaandsvisning.pdf",
    version: "2026-10-07.1",
  },
  relatedSlugs: ["klasseboden-postloeb"],
  ...klassebodenCommon,
};

const legacyMaterials = PRINTPAKKER.map(adaptLegacyPrintpakke);

export const PRINTMATERIALS: readonly Printmaterial[] = [
  ...legacyMaterials,
  klassebodenPostloeb,
  klassebodenArbejdsark,
];

export function getPrintmaterial(slug: string): Printmaterial | undefined {
  return PRINTMATERIALS.find((material) => material.slug === slug);
}

export function getPrintmaterialFilterOptions(materials: readonly Printmaterial[] = PRINTMATERIALS) {
  return {
    subjects: [...new Set(materials.map((material) => material.subject))],
    gradeLevels: [...new Set(materials.map((material) => material.gradeLevel))],
    topics: [...new Set(materials.map((material) => material.topic))],
    formats: [...new Set(materials.map((material) => material.format))],
  };
}

export function getCardDownloadActions(material: Printmaterial) {
  const order = { student: 0, answers: 1, whole: 2 } as const;
  return material.downloads
    .filter((download): download is PrintmaterialDownload & { cardAction: keyof typeof order } => Boolean(download.cardAction))
    .sort((left, right) => order[left.cardAction] - order[right.cardAction]);
}
