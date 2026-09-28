import { execFile as execFileCallback } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { POSTLOEB_PACKAGES } from "./printpakker/package-data.mjs";

const execFile = promisify(execFileCallback);
const workspace = process.cwd();
const protectedAssetsDirectory = join(workspace, "assets", "printpakker");
const publicDirectory = join(workspace, "public", "printpakker");
const pythonExecutable = process.env.PRINTPAKKER_PYTHON ?? "python";

const protectedVariants = [
  { suffix: "hele_pakken_farve", pages: 13 },
  { suffix: "hele_pakken_blaekbesparende", pages: 13 },
  { suffix: "elevark", pages: 8, studentSafe: true },
  { suffix: "facit", pages: 4, answerKey: true },
  { suffix: "laerervejledning", pages: 3 },
];

async function pdfInfo(pdfPath) {
  try {
    const { stdout } = await execFile("pdfinfo", [pdfPath], { encoding: "utf8" });
    const match = stdout.match(/^Pages:\s+(\d+)$/m);
    if (!match) throw new Error("pdfinfo returnerede intet sidetal.");
    return Number(match[1]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Kunne ikke læse PDF-info for ${pdfPath}. Kontrollér at Poppler er på PATH. (${detail})`);
  }
}

async function pdfText(pdfPath) {
  try {
    const { stdout } = await execFile(pythonExecutable, [
      "-c",
      "from pypdf import PdfReader; import sys; print('\\n'.join((page.extract_text() or '') for page in PdfReader(sys.argv[1]).pages))",
      pdfPath,
    ], {
      encoding: "utf8",
      maxBuffer: 12 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Kunne ikke udtrække tekst fra ${pdfPath} med pypdf. Sæt PRINTPAKKER_PYTHON til den Python, der har pypdf installeret. (${detail})`);
  }
}

async function inspectPdf(pdfPath, expectedPages) {
  const [file, pages] = await Promise.all([stat(pdfPath), pdfInfo(pdfPath)]);
  if (pages !== expectedPages) {
    throw new Error(`${pdfPath} har ${pages} sider, men der forventes ${expectedPages}.`);
  }
  return { bytes: file.size, pages };
}

function assertDoesNotContain(text, needle, pdfPath) {
  if (text.includes(needle)) {
    throw new Error(`Privat lærerindhold lækker i ${pdfPath}: fandt '${needle}'.`);
  }
}

function normaliseExtractedText(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function validatePackage(packageData) {
  const protectedDirectory = join(protectedAssetsDirectory, packageData.slug);
  const reports = [];
  let studentText = "";
  let answerKeyText = "";

  for (const variant of protectedVariants) {
    const filename = `${packageData.assetStem}_${variant.suffix}.pdf`;
    const pdfPath = join(protectedDirectory, filename);
    const report = await inspectPdf(pdfPath, variant.pages);
    reports.push({ filename, ...report });
    if (variant.studentSafe) studentText = normaliseExtractedText(await pdfText(pdfPath));
    if (variant.answerKey) answerKeyText = normaliseExtractedText(await pdfText(pdfPath));
  }

  const previewPath = join(publicDirectory, `${packageData.slug}-forhaandsvisning.pdf`);
  const preview = await inspectPdf(previewPath, 2);
  reports.push({ filename: `${packageData.slug}-forhaandsvisning.pdf`, ...preview });
  const previewText = normaliseExtractedText(await pdfText(previewPath));

  for (const text of [studentText, previewText]) {
    assertDoesNotContain(text, "Korrekt svar:", packageData.slug);
    assertDoesNotContain(text, "Brik til holdet:", packageData.slug);
    assertDoesNotContain(text, "besked er:", packageData.slug);
  }

  const finalMessageWords = packageData.finalMessage.match(/[A-Z]{4,}/g) ?? [];
  const hasVisibleFinalMessage = finalMessageWords.every((word) => answerKeyText.includes(word));
  if (!answerKeyText.includes("Korrekt svar:") || !answerKeyText.includes("besked er:") || !hasVisibleFinalMessage) {
    throw new Error(`Facit mangler forventet lærerindhold for ${packageData.slug}.`);
  }

  return reports;
}

function selectPackages() {
  const onlyArgument = process.argv.find((argument) => argument.startsWith("--only="));
  if (!onlyArgument) return POSTLOEB_PACKAGES;

  const slug = onlyArgument.slice("--only=".length);
  const selected = POSTLOEB_PACKAGES.filter((packageData) => packageData.slug === slug);
  if (selected.length === 0) {
    throw new Error(`Ukendt --only=${slug}. Gyldige slugs: ${POSTLOEB_PACKAGES.map((item) => item.slug).join(", ")}`);
  }
  return selected;
}

async function main() {
  const reports = [];
  const packageSelection = selectPackages();
  for (const packageData of packageSelection) {
    reports.push(...await validatePackage(packageData));
  }

  const totalBytes = reports.reduce((sum, report) => sum + report.bytes, 0);
  for (const report of reports) {
    const megabytes = (report.bytes / 1024 / 1024).toFixed(2);
    const compactness = report.bytes > 4.5 * 1024 * 1024 ? "check size" : "compact";
    process.stdout.write(`${compactness.padEnd(10)} ${String(report.pages).padStart(2)} pages  ${megabytes.padStart(6)} MiB  ${report.filename}\n`);
  }
  process.stdout.write(`Verified ${reports.length} PDFs. Total ${(totalBytes / 1024 / 1024).toFixed(1)} MiB. Student/public PDFs contain no teacher-only facit or final-message markers.\n`);
}

await main();
