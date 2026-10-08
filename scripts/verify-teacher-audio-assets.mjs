import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectMp3 } from "./verify-student-audio-assets.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const audioDirectory = path.join(projectRoot, "public", "audio", "teacher");

const ASSETS = [
  {
    filename: "afteraarsskov.mp3",
    minDuration: 40,
    maxDuration: 50,
    sha256: "fa642b9375deeb716a599da6a7d34e69475c50a16da82f2b981050a1e77cf0e3",
  },
  {
    filename: "regn-ved-vinduet.mp3",
    minDuration: 75,
    maxDuration: 90,
    sha256: "f3c0b8b31ecd04439e5b60589b3b427373ab548905a49f1ec8a506b160ce27d1",
  },
  {
    filename: "stille-klaver.mp3",
    minDuration: 200,
    maxDuration: 220,
    sha256: "81aabb1122cbea8b552c8550af451dafb55232d0a1fbb3ff68b09dff6c145136",
  },
  {
    filename: "papir-1.mp3",
    minDuration: 0.5,
    maxDuration: 2,
    sha256: "1c3f23bbf5acb6fd870092b11991990b9cec0188f3a3cc1c9417da1a40d1774b",
  },
  {
    filename: "papir-2.mp3",
    minDuration: 0.5,
    maxDuration: 2,
    sha256: "d7804ffbf865e9a1379670cceacacab20a1e43b477b1d6893b2770b658e9a1e8",
  },
  {
    filename: "papir-3.mp3",
    minDuration: 0.5,
    maxDuration: 2,
    sha256: "cdc2cad835ffa48b7531a9fa1b7ebfbcb2d8adcef79f18ab9c684da3a2eb1eba",
  },
];

const documentationPath = path.join(projectRoot, "docs", "skolegps", "teacher-sound-assets.md");
const catalogPath = path.join(projectRoot, "lib", "teacherSound", "catalog.ts");

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function verifyTeacherAudioAssets({ print = true } = {}) {
  const problems = [];
  const entries = [];

  for (const asset of ASSETS) {
    const assetPath = path.join(audioDirectory, asset.filename);

    try {
      const [buffer, fileStats] = await Promise.all([readFile(assetPath), stat(assetPath)]);
      const mp3 = inspectMp3(buffer);
      const actualSha = digest(buffer);

      if (fileStats.size < 1_000) {
        problems.push(`${asset.filename} is too small to contain a usable audio source.`);
      }
      if (mp3.sampleRate !== 44_100) {
        problems.push(`${asset.filename} must be 44.1 kHz, got ${mp3.sampleRate} Hz.`);
      }
      if (mp3.bitrates.length !== 1 || mp3.bitrates[0] !== 128) {
        problems.push(`${asset.filename} must be CBR 128 kbps, got ${mp3.bitrates.join(", ")}.`);
      }
      if (mp3.durationSeconds < asset.minDuration || mp3.durationSeconds > asset.maxDuration) {
        problems.push(`${asset.filename} duration ${mp3.durationSeconds.toFixed(3)}s is outside ${asset.minDuration}-${asset.maxDuration}s.`);
      }
      if (actualSha !== asset.sha256) {
        problems.push(`${asset.filename} does not match its documented SHA-256.`);
      }

      entries.push({ ...asset, ...mp3, bytes: fileStats.size, path: assetPath });
    } catch (error) {
      problems.push(`${asset.filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const documentation = await readFile(documentationPath, "utf8");
    for (const requiredText of [
      "Forest Ambience",
      "TinyWorlds",
      "CC0",
      "Rain against the window",
      "Public domain",
      "Meditation Impromptu 01",
      "Kevin MacLeod",
      "CC BY 4.0",
      "Book Flip Sounds",
      "Voltiment555",
      "Bibliotekets ro er ikke afspilningsklar",
    ]) {
      if (!documentation.includes(requiredText)) {
        problems.push(`Asset documentation is missing: ${requiredText}`);
      }
    }
  } catch (error) {
    problems.push(`Could not read teacher audio documentation: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const catalog = await readFile(catalogPath, "utf8");
    if (!catalog.includes('id: "bibliotekets-ro"') || !catalog.includes("available: false")) {
      problems.push("The unverified library preset must remain unavailable in the catalog.");
    }
    if (catalog.includes("/skovlyd.mp3") || catalog.includes("/forest.mp3")) {
      problems.push("The undocumented legacy teacher audio files must not be reused by the new catalog.");
    }
  } catch (error) {
    problems.push(`Could not read teacher sound catalog: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (problems.length > 0) {
    throw new Error(`Teacher audio asset verification failed:\n- ${problems.join("\n- ")}`);
  }

  if (print) {
    for (const entry of entries) {
      console.log(
        `${entry.filename}: ${entry.durationSeconds.toFixed(3)}s, ${entry.sampleRate} Hz, ${entry.bitrates[0]} kbps, ${entry.bytes} bytes`,
      );
    }
  }

  return { entries, totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0) };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await verifyTeacherAudioAssets();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
