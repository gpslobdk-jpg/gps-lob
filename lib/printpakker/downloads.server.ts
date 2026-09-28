import "server-only";

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import { getPrintpakke } from "./catalog";
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
};

export function getProtectedPrintpakkeDownload(slug: string, variant: string): ProtectedPrintpakkeDownload | undefined {
  if (!isPrintpakkeDownloadVariant(variant) || !getPrintpakke(slug)) return undefined;

  const packageFiles = PRINTPAKKE_FILES[slug];
  if (!packageFiles) return undefined;

  const variantFiles = VARIANT_FILES[variant];
  return {
    assetFile: `${packageFiles.assetStem}_${variantFiles.assetSuffix}.pdf`,
    directory: packageFiles.directory,
    filename: `${packageFiles.filenameStem}-${variantFiles.filenameSuffix}.pdf`,
    mediaType: "application/pdf",
  };
}

export async function openProtectedPrintpakkeDownload(download: ProtectedPrintpakkeDownload) {
  const filePath = join(process.cwd(), "assets", "printpakker", download.directory, download.assetFile);
  const file = await stat(filePath);
  if (!file.isFile()) throw new Error("Printpakke-assetet er ikke en fil.");

  return Readable.toWeb(createReadStream(filePath));
}
