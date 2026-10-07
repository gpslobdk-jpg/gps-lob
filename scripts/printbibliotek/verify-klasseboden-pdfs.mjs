/**
 * Read-only verification for the fixed Klasseboden export.
 * It checks the static manifest, hashes, page counts, A4 output, text parity
 * between colour/ink-saving pairs, and absence of teacher markers in public
 * previews and student files. It is not a classroom or print-printer test.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const workspace = process.cwd();
const manifestPath = join(workspace, "assets", "printpakker", "klasseboden-artifacts.json");
const python = process.env.PYTHON ?? "python";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => reject(new Error(`Kunne ikke starte ${command}: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} afsluttede med kode ${code}: ${stderr.trim()}`));
    });
  });
}

const textExtractionScript = [
  "from pypdf import PdfReader",
  "import json, sys",
  "for path in sys.argv[1:] :",
  "    reader = PdfReader(path)",
  "    print(json.dumps({'path': path, 'pages': len(reader.pages), 'text': '\\n'.join(page.extract_text() or '' for page in reader.pages)}, ensure_ascii=False))",
].join("\n");

async function inspectPdf(path) {
  const [info, extraction] = await Promise.all([
    run("pdfinfo", [path]),
    run(python, ["-c", textExtractionScript, path]),
  ]);
  const detail = JSON.parse(extraction.trim());
  const pageMatch = info.match(/^Pages:\s+(\d+)$/m);
  assert(pageMatch, `Kan ikke læse sidetal med pdfinfo: ${path}`);
  assert.match(info, /Page size:\s+595(?:\.\d+)? x 841(?:\.\d+)? pts \(A4\)/, `PDF er ikke A4: ${path}`);
  return { pages: Number(pageMatch[1]), text: detail.text };
}

function normalizedText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function correspondingColourVariant(variant) {
  if (variant === "whole-ink-saver") return "whole-colour";
  return variant.endsWith("-ink-saver") ? variant.slice(0, -"-ink-saver".length) : undefined;
}

const teacherMarkers = ["Facit:", "kun til læreren", "Lærervejledning", "Korrekt svar"];

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.version, "2026-10-07.1", "Forkert Klasseboden-version i manifestet.");
  assert.equal(manifest.artifacts.length, 22, "Manifestet skal have 22 beskyttede PDF'er.");
  assert.equal(manifest.previews.length, 2, "Manifestet skal have to public preview-PDF'er.");

  const textByArtifact = new Map();
  for (const artifact of manifest.artifacts) {
    const path = join(workspace, artifact.privatePath);
    const bytes = await readFile(path);
    assert.equal(sha256(bytes), artifact.sha256, `Checksum stemmer ikke: ${artifact.privatePath}`);
    const inspected = await inspectPdf(path);
    assert.equal(inspected.pages, artifact.pageCount, `Forkert sidetal: ${artifact.privatePath}`);
    assert.ok(inspected.text.length > 40, `Manglende søgbar tekst: ${artifact.privatePath}`);
    assert.ok(!artifact.privatePath.startsWith("public/"), `Lærerfil må ikke ligge i public: ${artifact.privatePath}`);
    textByArtifact.set(`${artifact.materialId}/${artifact.variant}`, inspected.text);
  }

  for (const artifact of manifest.artifacts.filter((item) => item.mode === "ink-saving")) {
    const colourVariant = correspondingColourVariant(artifact.variant);
    const colourText = textByArtifact.get(`${artifact.materialId}/${colourVariant}`);
    const inkText = textByArtifact.get(`${artifact.materialId}/${artifact.variant}`);
    assert.equal(normalizedText(inkText), normalizedText(colourText), `Farve/blæk-par matcher ikke: ${artifact.materialId}/${artifact.variant}`);
  }

  for (const artifact of manifest.artifacts.filter((item) => item.kind === "student" || item.kind === "stations" || item.kind === "answer-sheet" || item.kind === "support")) {
    const text = textByArtifact.get(`${artifact.materialId}/${artifact.variant}`);
    for (const marker of teacherMarkers) {
      assert.ok(!text.includes(marker), `Lærermarkør lækker i elevfil ${artifact.materialId}/${artifact.variant}: ${marker}`);
    }
  }

  // Content-specific checks keep the fixed mathematical manuscript intact;
  // page count and checksum alone would not catch a dropped operator or task.
  assert.ok(
    textByArtifact.get("klasseboden-postloeb/student")?.includes("Maja skriver: 14 - 8 = 8."),
    "Postløbets elevark mangler det faste undersøgelsesspørgsmål på post 3.",
  );
  assert.ok(
    textByArtifact.get("klasseboden-postloeb/stations")?.includes("Forskellen"),
    "Postløbets stationer mangler den faste post 6.",
  );
  assert.ok(
    textByArtifact.get("klasseboden-arbejdsark/student")?.includes("Emil siger: 12 - 5 er 7"),
    "Arbejdsarket mangler den faste forklaringsopgave.",
  );
  assert.ok(
    textByArtifact.get("klasseboden-arbejdsark/answer-key")?.includes("18 - 12 = 6."),
    "Arbejdsarkets facit mangler den faste kontrolregning.",
  );

  for (const preview of manifest.previews) {
    const path = join(workspace, preview.publicPath);
    const bytes = await readFile(path);
    assert.equal(sha256(bytes), preview.sha256, `Checksum stemmer ikke: ${preview.publicPath}`);
    const inspected = await inspectPdf(path);
    assert.equal(inspected.pages, preview.pageCount, `Forkert sidetal: ${preview.publicPath}`);
    for (const marker of teacherMarkers) {
      assert.ok(!inspected.text.includes(marker), `Lærermarkør lækker i preview ${preview.publicPath}: ${marker}`);
    }
  }

  process.stdout.write("Klasseboden PDF verification passed: 22 protected artifacts, 2 facit-free previews, A4/text/checksum/parity checks.\n");
}

await main();
