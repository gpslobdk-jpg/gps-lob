import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { STUDENT_AUDIO_ASSETS, verifyStudentAudioAssets } from "./verify-student-audio-assets.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatorPath = path.join(scriptDirectory, "generate-student-audio-assets.mjs");

function generateInto(outputDirectory) {
  const result = spawnSync(process.execPath, [generatorPath], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, SKOLEGPS_AUDIO_OUTPUT_DIR: outputDirectory },
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `Generator exited with ${result.status}.`);
  }
}

async function hashesFor(directory) {
  const hashes = new Map();
  for (const asset of STUDENT_AUDIO_ASSETS) {
    const contents = await readFile(path.join(directory, asset.filename));
    hashes.set(asset.filename, createHash("sha256").update(contents).digest("hex"));
  }
  return hashes;
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "skolegps-elevlyd-determinism-"));
const firstOutput = path.join(temporaryRoot, "first");
const secondOutput = path.join(temporaryRoot, "second");

try {
  generateInto(firstOutput);
  generateInto(secondOutput);
  await Promise.all([
    verifyStudentAudioAssets({ directory: firstOutput, print: false }),
    verifyStudentAudioAssets({ directory: secondOutput, print: false }),
  ]);

  const [firstHashes, secondHashes] = await Promise.all([hashesFor(firstOutput), hashesFor(secondOutput)]);
  for (const asset of STUDENT_AUDIO_ASSETS) {
    if (firstHashes.get(asset.filename) !== secondHashes.get(asset.filename)) {
      throw new Error(`${asset.filename} changed between identical deterministic generator runs.`);
    }
  }

  console.log(`Deterministic student-audio generation passed for ${STUDENT_AUDIO_ASSETS.length} assets.`);
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
