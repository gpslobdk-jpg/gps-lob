import "server-only";

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import { getPrintmaterial } from "./materials";
import {
  isPrintpakkeDownloadVariant,
  type PrintpakkeDownloadVariant,
} from "./links";

export type ProtectedPrintpakkeDownload = {
  assetFile: string;
  directory: string;
  filename: string;
  mediaType: "application/pdf";
};

type PrintpakkeFiles = {
  assetStem: string;
  directory: string;
  filenameStem: string;
};

// This manifest is deliberately the only place that maps a public slug to a
// filesystem path. The request can choose a known variant, never a path.
const PRINTPAKKE_FILES: Record<string, PrintpakkeFiles> = {
  efteraarsmysteriet: {
    assetStem: "SkoleGPS_Efteraarsmysteriet",
    directory: "efteraarsmysteriet",
    filenameStem: "SkoleGPS-Efteraarsmysteriet",
  },
  "kystbyens-forsyningsplan": {
    assetStem: "SkoleGPS_Kystbyens_forsyningsplan",
    directory: "kystbyens-forsyningsplan",
    filenameStem: "SkoleGPS-Kystbyens-forsyningsplan",
  },
  "det-sidste-program": {
    assetStem: "SkoleGPS_Det_sidste_program",
    directory: "det-sidste-program",
    filenameStem: "SkoleGPS-Det-sidste-program",
  },
  "the-pop-up-bookshop": {
    assetStem: "SkoleGPS_The_pop_up_bookshop",
    directory: "the-pop-up-bookshop",
    filenameStem: "SkoleGPS-The-pop-up-bookshop",
  },
  "regnhavens-laboratorium": {
    assetStem: "SkoleGPS_Regnhavens_laboratorium",
    directory: "regnhavens-laboratorium",
    filenameStem: "SkoleGPS-Regnhavens-laboratorium",
  },
  "kufferten-fra-kobstaden": {
    assetStem: "SkoleGPS_Kufferten_fra_kobstaden",
    directory: "kufferten-fra-kobstaden",
    filenameStem: "SkoleGPS-Kufferten-fra-kobstaden",
  },
};

const VARIANT_FILES: Record<PrintpakkeDownloadVariant, { assetSuffix: string; filenameSuffix: string }> = {
  "whole-colour": { assetSuffix: "hele_pakken_farve", filenameSuffix: "hele-pakken-farve" },
  "whole-ink-saver": { assetSuffix: "hele_pakken_blaekbesparende", filenameSuffix: "hele-pakken-blaekbesparende" },
  student: { assetSuffix: "elevark", filenameSuffix: "elevark" },
  "answer-key": { assetSuffix: "facit", filenameSuffix: "facit" },
  "teacher-guide": { assetSuffix: "laerervejledning", filenameSuffix: "laerervejledning" },
  "student-ink-saver": { assetSuffix: "unused", filenameSuffix: "unused" },
  stations: { assetSuffix: "unused", filenameSuffix: "unused" },
  "stations-ink-saver": { assetSuffix: "unused", filenameSuffix: "unused" },
  "answer-sheet": { assetSuffix: "unused", filenameSuffix: "unused" },
  "answer-sheet-ink-saver": { assetSuffix: "unused", filenameSuffix: "unused" },
  "answer-key-ink-saver": { assetSuffix: "unused", filenameSuffix: "unused" },
  "teacher-guide-ink-saver": { assetSuffix: "unused", filenameSuffix: "unused" },
  support: { assetSuffix: "unused", filenameSuffix: "unused" },
  "support-ink-saver": { assetSuffix: "unused", filenameSuffix: "unused" },
};

function protectedFile(directory: string, assetFile: string, filename: string): ProtectedPrintpakkeDownload {
  return { assetFile, directory, filename, mediaType: "application/pdf" };
}

function legacyArtifacts(packageFiles: PrintpakkeFiles) {
  return Object.fromEntries(
    (["whole-colour", "whole-ink-saver", "student", "answer-key", "teacher-guide"] as const).map((variant) => {
      const variantFiles = VARIANT_FILES[variant];
      return [variant, protectedFile(
        packageFiles.directory,
        `${packageFiles.assetStem}_${variantFiles.assetSuffix}.pdf`,
        `${packageFiles.filenameStem}-${variantFiles.filenameSuffix}.pdf`,
      )];
    }),
  ) as Partial<Record<PrintpakkeDownloadVariant, ProtectedPrintpakkeDownload>>;
}

const PRINTPAKKE_ARTIFACTS: Record<string, Partial<Record<PrintpakkeDownloadVariant, ProtectedPrintpakkeDownload>>> = {
  efteraarsmysteriet: legacyArtifacts(PRINTPAKKE_FILES.efteraarsmysteriet),
  "kystbyens-forsyningsplan": legacyArtifacts(PRINTPAKKE_FILES["kystbyens-forsyningsplan"]),
  "det-sidste-program": legacyArtifacts(PRINTPAKKE_FILES["det-sidste-program"]),
  "the-pop-up-bookshop": legacyArtifacts(PRINTPAKKE_FILES["the-pop-up-bookshop"]),
  "regnhavens-laboratorium": legacyArtifacts(PRINTPAKKE_FILES["regnhavens-laboratorium"]),
  "kufferten-fra-kobstaden": legacyArtifacts(PRINTPAKKE_FILES["kufferten-fra-kobstaden"]),
  "klasseboden-postloeb": {
    student: protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_elevmateriale_farve.pdf", "SkoleGPS-Klasseboden-postloeb-elevmateriale-farve.pdf"),
    "student-ink-saver": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_elevmateriale_blaekbesparende.pdf", "SkoleGPS-Klasseboden-postloeb-elevmateriale-blaekbesparende.pdf"),
    stations: protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_poster_farve.pdf", "SkoleGPS-Klasseboden-postloeb-poster-farve.pdf"),
    "stations-ink-saver": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_poster_blaekbesparende.pdf", "SkoleGPS-Klasseboden-postloeb-poster-blaekbesparende.pdf"),
    "answer-sheet": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_svarark_farve.pdf", "SkoleGPS-Klasseboden-postloeb-svarark-farve.pdf"),
    "answer-sheet-ink-saver": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_svarark_blaekbesparende.pdf", "SkoleGPS-Klasseboden-postloeb-svarark-blaekbesparende.pdf"),
    "answer-key": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_facit_farve.pdf", "SkoleGPS-Klasseboden-postloeb-facit-farve.pdf"),
    "answer-key-ink-saver": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_facit_blaekbesparende.pdf", "SkoleGPS-Klasseboden-postloeb-facit-blaekbesparende.pdf"),
    "teacher-guide": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_laerervejledning_farve.pdf", "SkoleGPS-Klasseboden-postloeb-laerervejledning-farve.pdf"),
    "teacher-guide-ink-saver": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_laerervejledning_blaekbesparende.pdf", "SkoleGPS-Klasseboden-postloeb-laerervejledning-blaekbesparende.pdf"),
    support: protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_stoetteark_farve.pdf", "SkoleGPS-Klasseboden-postloeb-stoetteark-farve.pdf"),
    "support-ink-saver": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_stoetteark_blaekbesparende.pdf", "SkoleGPS-Klasseboden-postloeb-stoetteark-blaekbesparende.pdf"),
    "whole-colour": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_hele_pakken_farve.pdf", "SkoleGPS-Klasseboden-postloeb-hele-pakken-farve.pdf"),
    "whole-ink-saver": protectedFile("klasseboden-postloeb", "SkoleGPS_Klasseboden_Postloeb_hele_pakken_blaekbesparende.pdf", "SkoleGPS-Klasseboden-postloeb-hele-pakken-blaekbesparende.pdf"),
  },
  "klasseboden-arbejdsark": {
    student: protectedFile("klasseboden-arbejdsark", "SkoleGPS_Klasseboden_Arbejdsark_elevmateriale_farve.pdf", "SkoleGPS-Klasseboden-arbejdsark-elevmateriale-farve.pdf"),
    "student-ink-saver": protectedFile("klasseboden-arbejdsark", "SkoleGPS_Klasseboden_Arbejdsark_elevmateriale_blaekbesparende.pdf", "SkoleGPS-Klasseboden-arbejdsark-elevmateriale-blaekbesparende.pdf"),
    "answer-key": protectedFile("klasseboden-arbejdsark", "SkoleGPS_Klasseboden_Arbejdsark_facit_farve.pdf", "SkoleGPS-Klasseboden-arbejdsark-facit-farve.pdf"),
    "answer-key-ink-saver": protectedFile("klasseboden-arbejdsark", "SkoleGPS_Klasseboden_Arbejdsark_facit_blaekbesparende.pdf", "SkoleGPS-Klasseboden-arbejdsark-facit-blaekbesparende.pdf"),
    "teacher-guide": protectedFile("klasseboden-arbejdsark", "SkoleGPS_Klasseboden_Arbejdsark_laerervejledning_farve.pdf", "SkoleGPS-Klasseboden-arbejdsark-laerervejledning-farve.pdf"),
    "teacher-guide-ink-saver": protectedFile("klasseboden-arbejdsark", "SkoleGPS_Klasseboden_Arbejdsark_laerervejledning_blaekbesparende.pdf", "SkoleGPS-Klasseboden-arbejdsark-laerervejledning-blaekbesparende.pdf"),
    "whole-colour": protectedFile("klasseboden-arbejdsark", "SkoleGPS_Klasseboden_Arbejdsark_hele_pakken_farve.pdf", "SkoleGPS-Klasseboden-arbejdsark-hele-pakken-farve.pdf"),
    "whole-ink-saver": protectedFile("klasseboden-arbejdsark", "SkoleGPS_Klasseboden_Arbejdsark_hele_pakken_blaekbesparende.pdf", "SkoleGPS-Klasseboden-arbejdsark-hele-pakken-blaekbesparende.pdf"),
  },
};

export function getProtectedPrintpakkeDownload(slug: string, variant: string): ProtectedPrintpakkeDownload | undefined {
  if (!isPrintpakkeDownloadVariant(variant) || !getPrintmaterial(slug)) return undefined;
  return PRINTPAKKE_ARTIFACTS[slug]?.[variant];
}

export async function openProtectedPrintpakkeDownload(download: ProtectedPrintpakkeDownload) {
  const filePath = join(process.cwd(), "assets", "printpakker", download.directory, download.assetFile);
  const file = await stat(filePath);
  if (!file.isFile()) throw new Error("Printpakke-assetet er ikke en fil.");

  return Readable.toWeb(createReadStream(filePath));
}
