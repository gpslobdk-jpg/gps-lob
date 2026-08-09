import { expect, test } from "@playwright/test";
import { performance } from "node:perf_hooks";
import sharp from "sharp";

import {
  PHOTO_MAX_HEIGHT,
  PHOTO_MAX_PIXELS,
  PHOTO_MAX_WIDTH,
  PHOTO_OUTPUT_MAX_BYTES,
  sanitizeUploadedPhoto,
} from "../lib/studentData/photoUpload";

type ResourceMeasurement = {
  elapsedMs: number;
  outputBytes: number;
  peakRssDeltaMiB: number;
};

function maximumDimensions() {
  const width = Math.min(PHOTO_MAX_WIDTH, PHOTO_MAX_PIXELS);
  const height = Math.floor(PHOTO_MAX_PIXELS / width);
  if (height < 1 || height > PHOTO_MAX_HEIGHT) {
    throw new Error("Fotoets testgrænser kan ikke danne et gyldigt maksimumsbillede.");
  }
  return { width, height };
}

async function maximumPhoto(format: "jpeg" | "png") {
  const { width, height } = maximumDimensions();
  const pipeline = sharp({
    create: { width, height, channels: 3, background: "#315c78" },
  });
  const bytes = await (format === "jpeg"
    ? pipeline.jpeg({ quality: 92 })
    : pipeline.png({ compressionLevel: 9 }))
    .toBuffer();
  return new File([new Uint8Array(bytes)], `synthetic-maximum.${format}`, {
    type: `image/${format}`,
  });
}

async function measure(files: File[]): Promise<ResourceMeasurement> {
  const baselineRss = process.memoryUsage().rss;
  let peakRss = baselineRss;
  const sample = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 5);
  const startedAt = performance.now();

  try {
    const results = await Promise.all(files.map((file) => sanitizeUploadedPhoto(file)));
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    return {
      elapsedMs: Math.round(performance.now() - startedAt),
      outputBytes: results.reduce((sum, result) => sum + result.buffer.byteLength, 0),
      peakRssDeltaMiB: Math.round(((peakRss - baselineRss) / 1024 / 1024) * 10) / 10,
    };
  } finally {
    clearInterval(sample);
  }
}

function report(label: string, measurement: ResourceMeasurement) {
  process.stdout.write(
    `PHOTO_RESOURCE ${label} elapsed_ms=${measurement.elapsedMs} ` +
      `peak_rss_delta_mib=${measurement.peakRssDeltaMiB} ` +
      `output_bytes=${measurement.outputBytes}\n`,
  );
}

test.describe("bounded photo processing resources", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test("measures one maximum JPEG and one maximum PNG", async () => {
    for (const format of ["jpeg", "png"] as const) {
      const measurement = await measure([await maximumPhoto(format)]);
      report(`single_${format}`, measurement);
      expect(measurement.elapsedMs).toBeLessThan(60_000);
      expect(measurement.outputBytes).toBeGreaterThan(0);
      expect(measurement.outputBytes).toBeLessThanOrEqual(PHOTO_OUTPUT_MAX_BYTES);
    }
  });

  test("bounds five and ten simultaneous maximum JPEG decodes", async () => {
    const source = await maximumPhoto("jpeg");
    for (const concurrency of [5, 10]) {
      const files = Array.from(
        { length: concurrency },
        () => new File([source], `synthetic-${concurrency}.jpeg`, { type: "image/jpeg" }),
      );
      const measurement = await measure(files);
      report(`concurrency_${concurrency}`, measurement);
      expect(measurement.elapsedMs).toBeLessThan(120_000);
      expect(measurement.outputBytes).toBeGreaterThan(0);
      expect(measurement.outputBytes).toBeLessThanOrEqual(
        PHOTO_OUTPUT_MAX_BYTES * concurrency,
      );
      expect(measurement.peakRssDeltaMiB).toBeLessThan(700);
    }
  });

  test("rejects a compressed image just above the pixel limit", async () => {
    const { width, height } = maximumDimensions();
    const overLimitHeight = height + 1;
    expect(width * overLimitHeight).toBeGreaterThan(PHOTO_MAX_PIXELS);
    expect(overLimitHeight).toBeLessThanOrEqual(PHOTO_MAX_HEIGHT);

    const compressed = await sharp({
      create: {
        width,
        height: overLimitHeight,
        channels: 3,
        background: "#111111",
      },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const file = new File([new Uint8Array(compressed)], "synthetic-over-limit.png", {
      type: "image/png",
    });

    const measurementStartedAt = performance.now();
    await expect(sanitizeUploadedPhoto(file)).rejects.toMatchObject({
      code: "PHOTO_DECODE_FAILED",
    });
    const elapsedMs = Math.round(performance.now() - measurementStartedAt);
    process.stdout.write(
      `PHOTO_RESOURCE decompression_guard elapsed_ms=${elapsedMs} input_bytes=${file.size}\n`,
    );
    expect(elapsedMs).toBeLessThan(5_000);
  });
});
