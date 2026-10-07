import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const defaultAudioDirectory = path.join(projectRoot, "public", "audio", "elev");
const maxPackBytes = 600 * 1024;

export const STUDENT_AUDIO_ASSETS = Object.freeze([
  {
    filename: "mission-loop.mp3",
    description: "20-second low-key mission bed",
    durationMin: 16,
    durationMax: 24,
  },
  {
    filename: "i-maal-sting.mp3",
    description: "arrival/finish sting",
    durationMin: 1,
    durationMax: 3,
  },
  {
    filename: "tap.mp3",
    description: "short interaction tap",
    durationMin: 0.04,
    durationMax: 0.35,
  },
  {
    filename: "post.mp3",
    description: "post/waypoint acknowledgement",
    durationMin: 0.15,
    durationMax: 1,
  },
  {
    filename: "correct.mp3",
    description: "correct-answer affirmation",
    durationMin: 0.2,
    durationMax: 1.5,
  },
]);

export function resolveStudentAudioDirectory() {
  return path.resolve(process.env.SKOLEGPS_AUDIO_OUTPUT_DIR || defaultAudioDirectory);
}

function readSynchsafeInteger(buffer, offset) {
  return (
    ((buffer[offset] & 0x7f) << 21) |
    ((buffer[offset + 1] & 0x7f) << 14) |
    ((buffer[offset + 2] & 0x7f) << 7) |
    (buffer[offset + 3] & 0x7f)
  );
}

function id3v2Length(buffer) {
  if (buffer.length < 10 || buffer.toString("ascii", 0, 3) !== "ID3") {
    return 0;
  }

  const tagSize = readSynchsafeInteger(buffer, 6);
  const footerLength = buffer[5] & 0x10 ? 10 : 0;
  return 10 + tagSize + footerLength;
}

function parseMp3FrameHeader(buffer, offset) {
  if (offset + 4 > buffer.length) {
    return null;
  }

  const header = buffer.readUInt32BE(offset);
  if ((header >>> 21) !== 0x7ff) {
    return null;
  }

  const versionBits = (header >>> 19) & 0b11;
  const layerBits = (header >>> 17) & 0b11;
  const bitrateIndex = (header >>> 12) & 0b1111;
  const sampleRateIndex = (header >>> 10) & 0b11;
  const padding = (header >>> 9) & 0b1;

  // Layer bits 01 is Layer III. Version bits 01 is reserved.
  if (versionBits === 0b01 || layerBits !== 0b01 || bitrateIndex === 0 || bitrateIndex === 0b1111 || sampleRateIndex === 0b11) {
    return null;
  }

  const version = versionBits === 0b11 ? "MPEG-1" : versionBits === 0b10 ? "MPEG-2" : "MPEG-2.5";
  const sampleRates =
    version === "MPEG-1"
      ? [44100, 48000, 32000]
      : version === "MPEG-2"
        ? [22050, 24000, 16000]
        : [11025, 12000, 8000];
  const bitrateTable =
    version === "MPEG-1"
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const sampleRate = sampleRates[sampleRateIndex];
  const bitrateKbps = bitrateTable[bitrateIndex];
  const mpeg1 = version === "MPEG-1";
  const frameLength = Math.floor(((mpeg1 ? 144000 : 72000) * bitrateKbps) / sampleRate) + padding;

  return {
    bitrateKbps,
    frameLength,
    sampleRate,
    samplesPerFrame: mpeg1 ? 1152 : 576,
    version,
  };
}

function firstMp3FrameOffset(buffer) {
  const start = id3v2Length(buffer);
  const lastCandidate = Math.min(buffer.length - 4, start + 8192);

  for (let offset = start; offset <= lastCandidate; offset += 1) {
    if (parseMp3FrameHeader(buffer, offset)) {
      return offset;
    }
  }

  return -1;
}

export function inspectMp3(buffer) {
  const firstFrame = firstMp3FrameOffset(buffer);
  if (firstFrame < 0) {
    throw new Error("No valid MP3 frame was found after the optional ID3 tag.");
  }

  let offset = firstFrame;
  let frameCount = 0;
  let sampleCount = 0;
  let sampleRate;
  const bitrates = new Set();
  let version;

  while (offset + 4 <= buffer.length) {
    const frame = parseMp3FrameHeader(buffer, offset);
    if (!frame || offset + frame.frameLength > buffer.length) {
      break;
    }

    if (sampleRate && frame.sampleRate !== sampleRate) {
      throw new Error("MP3 stream changes sample rate between frames.");
    }

    sampleRate = frame.sampleRate;
    version = frame.version;
    bitrates.add(frame.bitrateKbps);
    frameCount += 1;
    sampleCount += frame.samplesPerFrame;
    offset += frame.frameLength;
  }

  if (frameCount < 2 || !sampleRate) {
    throw new Error("MP3 stream has too few complete frames.");
  }

  return {
    bitrates: [...bitrates].sort((left, right) => left - right),
    durationSeconds: sampleCount / sampleRate,
    firstFrame,
    frameCount,
    sampleRate,
    trailingBytes: buffer.length - offset,
    version,
  };
}

function formatDuration(seconds) {
  return `${seconds.toFixed(3)}s`;
}

export async function verifyStudentAudioAssets({ directory = resolveStudentAudioDirectory(), print = true } = {}) {
  const entries = [];
  const problems = [];

  for (const asset of STUDENT_AUDIO_ASSETS) {
    const assetPath = path.join(directory, asset.filename);

    try {
      const [buffer, fileStats] = await Promise.all([readFile(assetPath), stat(assetPath)]);
      const mp3 = inspectMp3(buffer);

      if (fileStats.size < 1024) {
        problems.push(`${asset.filename} is too small to contain useful compressed audio (${fileStats.size} bytes).`);
      }
      if (mp3.sampleRate !== 44100) {
        problems.push(`${asset.filename} uses ${mp3.sampleRate} Hz; the pack requires 44100 Hz.`);
      }
      if (mp3.bitrates.length !== 1 || mp3.bitrates[0] !== 128) {
        problems.push(`${asset.filename} is not constant 128 kbps MP3 (${mp3.bitrates.join(", ") || "no bitrate"}).`);
      }
      if (mp3.durationSeconds < asset.durationMin || mp3.durationSeconds > asset.durationMax) {
        problems.push(
          `${asset.filename} duration ${formatDuration(mp3.durationSeconds)} is outside ${asset.durationMin}-${asset.durationMax}s.`,
        );
      }

      entries.push({
        ...asset,
        bytes: fileStats.size,
        path: assetPath,
        ...mp3,
      });
    } catch (error) {
      problems.push(`${asset.filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (entries.length === STUDENT_AUDIO_ASSETS.length && totalBytes > maxPackBytes) {
    problems.push(`Audio pack is ${totalBytes} bytes; it exceeds the ${maxPackBytes}-byte budget.`);
  }

  if (problems.length > 0) {
    throw new Error(`Student audio asset verification failed:\n- ${problems.join("\n- ")}`);
  }

  if (print) {
    for (const entry of entries) {
      console.log(
        `${entry.filename}: ${formatDuration(entry.durationSeconds)}, ${entry.sampleRate} Hz, ${entry.bitrates[0]} kbps, ${entry.bytes} bytes, ${entry.frameCount} frames`,
      );
    }
    console.log(`Pack total: ${totalBytes} bytes / ${maxPackBytes} byte budget.`);
  }

  return { directory, entries, maxPackBytes, totalBytes };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await verifyStudentAudioAssets();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
