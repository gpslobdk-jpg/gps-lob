import { copyFile, mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  STUDENT_AUDIO_ASSETS,
  resolveStudentAudioDirectory,
  verifyStudentAudioAssets,
} from "./verify-student-audio-assets.mjs";

const sampleRate = 44100;
const bitDepth = 16;
const channels = 1;
const tau = Math.PI * 2;
const outputBitrate = "128k";

function clamp(value, minimum = -1, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sine(frequency, seconds) {
  return Math.sin(tau * frequency * seconds);
}

function smoothEnvelope(progress, exponent = 1.35) {
  if (progress <= 0 || progress >= 1) {
    return 0;
  }

  return Math.sin(Math.PI * progress) ** exponent;
}

function deterministicNoise(sampleIndex) {
  const mixed = Math.imul(sampleIndex + 1, 1103515245) + 12345;
  return ((mixed >>> 0) / 0x80000000) - 1;
}

function renderMissionLoop() {
  const motifSeconds = 4;
  const motifSamples = motifSeconds * sampleRate;
  const totalSamples = motifSamples * 5;
  const notes = [330, 440, 392, 494];
  const output = new Float32Array(totalSamples);

  for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
    const motifIndex = sampleIndex % motifSamples;
    const seconds = motifIndex / sampleRate;
    let sample = 0.052 * sine(110, seconds) + 0.022 * sine(220, seconds) + 0.011 * sine(330, seconds);

    const pulseStart = Math.floor(seconds);
    const pulseProgress = (seconds - pulseStart) / 0.13;
    if (pulseProgress > 0 && pulseProgress < 1) {
      const envelope = smoothEnvelope(pulseProgress, 1.6) * Math.exp(-3.3 * pulseProgress);
      sample += envelope * (0.035 * sine(55, seconds - pulseStart) + 0.008 * deterministicNoise(motifIndex));
    }

    const noteIndex = Math.floor(seconds);
    const noteStart = noteIndex + 0.26;
    const noteLength = 0.38;
    const noteProgress = (seconds - noteStart) / noteLength;
    if (noteProgress > 0 && noteProgress < 1) {
      const envelope = smoothEnvelope(noteProgress, 1.1) * Math.exp(-1.8 * noteProgress);
      const frequency = notes[noteIndex];
      sample += envelope * (0.042 * sine(frequency, seconds - noteStart) + 0.009 * sine(frequency * 2, seconds - noteStart));
    }

    output[sampleIndex] = clamp(sample * 0.72);
  }

  return output;
}

function sweepTone(seconds, start, duration, startFrequency, endFrequency, amplitude) {
  const localSeconds = seconds - start;
  const progress = localSeconds / duration;
  if (progress <= 0 || progress >= 1) {
    return 0;
  }

  const envelope = smoothEnvelope(progress, 1.2) * Math.exp(-1.25 * progress);
  const rate = (endFrequency - startFrequency) / duration;
  const phase = tau * (startFrequency * localSeconds + (rate * localSeconds * localSeconds) / 2);
  return amplitude * envelope * (Math.sin(phase) + 0.16 * Math.sin(phase * 2));
}

function renderGoalSting() {
  const duration = 1.8;
  const output = new Float32Array(Math.round(duration * sampleRate));

  for (let sampleIndex = 0; sampleIndex < output.length; sampleIndex += 1) {
    const seconds = sampleIndex / sampleRate;
    const sample =
      sweepTone(seconds, 0, 0.72, 392, 494, 0.16) +
      sweepTone(seconds, 0.28, 0.9, 523.25, 659.25, 0.2) +
      sweepTone(seconds, 0.66, 0.92, 659.25, 783.99, 0.17);
    output[sampleIndex] = clamp(sample * 0.7);
  }

  return output;
}

function renderTap() {
  const duration = 0.12;
  const output = new Float32Array(Math.round(duration * sampleRate));

  for (let sampleIndex = 0; sampleIndex < output.length; sampleIndex += 1) {
    const seconds = sampleIndex / sampleRate;
    const progress = seconds / duration;
    const envelope = smoothEnvelope(progress, 1.35) * Math.exp(-5.6 * progress);
    const sample = envelope * (0.58 * sine(690, seconds) + 0.098 * deterministicNoise(sampleIndex));
    output[sampleIndex] = clamp(sample);
  }

  return output;
}

function renderPost() {
  const duration = 0.48;
  const output = new Float32Array(Math.round(duration * sampleRate));

  for (let sampleIndex = 0; sampleIndex < output.length; sampleIndex += 1) {
    const seconds = sampleIndex / sampleRate;
    const sample =
      sweepTone(seconds, 0, 0.42, 294, 370, 0.2) + sweepTone(seconds, 0.08, 0.34, 440, 494, 0.065);
    output[sampleIndex] = clamp(sample * 0.76);
  }

  return output;
}

function renderCorrect() {
  const duration = 0.72;
  const output = new Float32Array(Math.round(duration * sampleRate));

  for (let sampleIndex = 0; sampleIndex < output.length; sampleIndex += 1) {
    const seconds = sampleIndex / sampleRate;
    const sample =
      sweepTone(seconds, 0, 0.42, 523.25, 587.33, 0.16) + sweepTone(seconds, 0.17, 0.5, 659.25, 783.99, 0.19);
    output[sampleIndex] = clamp(sample * 0.74);
  }

  return output;
}

function writeWav(samples, destination) {
  const bytesPerSample = bitDepth / 8;
  const dataLength = samples.length * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataLength, 40);

  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    buffer.writeInt16LE(Math.round(clamp(samples[sampleIndex]) * 32767), 44 + sampleIndex * bytesPerSample);
  }

  return writeFile(destination, buffer);
}

async function capCutEncoderCandidates() {
  if (!process.env.LOCALAPPDATA) {
    return [];
  }

  const applicationsDirectory = path.join(process.env.LOCALAPPDATA, "CapCut", "Apps");
  try {
    const entries = await readdir(applicationsDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(applicationsDirectory, entry.name, "ffmpeg.exe"))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

async function encoderCandidates() {
  const candidates = [];

  if (process.env.SKOLEGPS_FFMPEG) {
    candidates.push(process.env.SKOLEGPS_FFMPEG);
  }

  candidates.push(process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  candidates.push(...(await capCutEncoderCandidates()));
  return [...new Set(candidates)];
}

function encodeFile({ encoder, codec, source, destination }) {
  const result = spawnSync(
    encoder,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-i",
      source,
      "-map_metadata",
      "-1",
      "-ac",
      String(channels),
      "-ar",
      String(sampleRate),
      "-c:a",
      codec,
      "-b:a",
      outputBitrate,
      "-write_xing",
      "0",
      "-y",
      destination,
    ],
    { encoding: "utf8", windowsHide: true },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${encoder} exited with ${result.status}.`);
  }
}

async function encodeWithFirstWorkingLocalEncoder({ rawDirectory, temporaryDirectory }) {
  const candidates = await encoderCandidates();
  const codecCandidates = ["mp3_mf", "libmp3lame", "libshine"];
  const failures = [];

  for (const encoder of candidates) {
    for (const codec of codecCandidates) {
      const attemptDirectory = path.join(temporaryDirectory, "encoded", `${path.basename(encoder)}-${codec}`);
      await mkdir(attemptDirectory, { recursive: true });

      try {
        for (const asset of STUDENT_AUDIO_ASSETS) {
          const source = path.join(rawDirectory, asset.filename.replace(/\.mp3$/u, ".wav"));
          const destination = path.join(attemptDirectory, asset.filename);
          encodeFile({ encoder, codec, source, destination });
        }

        await verifyStudentAudioAssets({ directory: attemptDirectory, print: false });
        return { codec, directory: attemptDirectory, encoder };
      } catch (error) {
        const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
        failures.push(`${encoder} (${codec}): ${reason}`);
      }
    }
  }

  throw new Error(
    `No local MP3 encoder produced a valid pack. Tried:\n- ${failures.join("\n- ")}\nSet SKOLEGPS_FFMPEG to a local FFmpeg executable if needed.`,
  );
}

async function generateAssets() {
  const renderers = new Map([
    ["mission-loop.mp3", renderMissionLoop],
    ["i-maal-sting.mp3", renderGoalSting],
    ["tap.mp3", renderTap],
    ["post.mp3", renderPost],
    ["correct.mp3", renderCorrect],
  ]);
  const outputDirectory = resolveStudentAudioDirectory();
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "skolegps-elevlyd-"));
  const rawDirectory = path.join(temporaryDirectory, "raw");

  try {
    await mkdir(rawDirectory, { recursive: true });
    for (const asset of STUDENT_AUDIO_ASSETS) {
      const renderer = renderers.get(asset.filename);
      if (!renderer) {
        throw new Error(`No deterministic renderer is defined for ${asset.filename}.`);
      }

      await writeWav(renderer(), path.join(rawDirectory, asset.filename.replace(/\.mp3$/u, ".wav")));
    }

    const encoded = await encodeWithFirstWorkingLocalEncoder({ rawDirectory, temporaryDirectory });
    await mkdir(outputDirectory, { recursive: true });

    for (const asset of STUDENT_AUDIO_ASSETS) {
      await copyFile(path.join(encoded.directory, asset.filename), path.join(outputDirectory, asset.filename));
    }

    const report = await verifyStudentAudioAssets({ directory: outputDirectory, print: false });
    console.log(`Generated ${report.entries.length} deterministic student audio assets in ${outputDirectory}.`);
    console.log(`Encoder: ${encoded.encoder} (${encoded.codec}); pack: ${report.totalBytes} bytes.`);
    for (const entry of report.entries) {
      console.log(`${entry.filename}: ${entry.durationSeconds.toFixed(3)}s, ${entry.bytes} bytes.`);
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

try {
  await generateAssets();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
