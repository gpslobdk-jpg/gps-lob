import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getPrintpakke } from "./catalog";
import {
  isPrintpakkeDownloadVariant,
  type PrintpakkeDownloadVariant,
} from "./links";

type ProtectedPrintpakkeDownload = {
  assetFile: string;
  filename: string;
  mediaType: "application/pdf";
};

const AFTERAARSMYSTERIET_DOWNLOADS: Record<PrintpakkeDownloadVariant, ProtectedPrintpakkeDownload> = {
  "whole-colour": {
    assetFile: "SkoleGPS_Efteraarsmysteriet_hele_pakken_farve.pdf",
    filename: "SkoleGPS-Efteraarsmysteriet-hele-pakken-farve.pdf",
    mediaType: "application/pdf",
  },
  "whole-ink-saver": {
    assetFile: "SkoleGPS_Efteraarsmysteriet_hele_pakken_blaekbesparende.pdf",
    filename: "SkoleGPS-Efteraarsmysteriet-hele-pakken-blaekbesparende.pdf",
    mediaType: "application/pdf",
  },
  student: {
    assetFile: "SkoleGPS_Efteraarsmysteriet_elevark.pdf",
    filename: "SkoleGPS-Efteraarsmysteriet-elevark.pdf",
    mediaType: "application/pdf",
  },
  "answer-key": {
    assetFile: "SkoleGPS_Efteraarsmysteriet_facit.pdf",
    filename: "SkoleGPS-Efteraarsmysteriet-facit.pdf",
    mediaType: "application/pdf",
  },
  "teacher-guide": {
    assetFile: "SkoleGPS_Efteraarsmysteriet_laerervejledning.pdf",
    filename: "SkoleGPS-Efteraarsmysteriet-laerervejledning.pdf",
    mediaType: "application/pdf",
  },
};

export function getProtectedPrintpakkeDownload(slug: string, variant: string) {
  if (!isPrintpakkeDownloadVariant(variant) || !getPrintpakke(slug)) return undefined;
  if (slug !== "efteraarsmysteriet") return undefined;
  return AFTERAARSMYSTERIET_DOWNLOADS[variant];
}

export async function readProtectedPrintpakkeDownload(download: ProtectedPrintpakkeDownload) {
  const filePath = join(process.cwd(), "assets", "printpakker", "efteraarsmysteriet", download.assetFile);
  return readFile(filePath);
}
