import { expect, test } from "@playwright/test";
import sharp from "sharp";

import {
  PhotoUploadValidationError,
  PHOTO_UPLOAD_MAX_BYTES,
  sanitizeUploadedPhoto,
} from "../lib/studentData/photoUpload";

async function imageFile(
  format: "jpeg" | "png" | "webp",
  options: { width?: number; height?: number; type?: string } = {},
) {
  const width = options.width ?? 32;
  const height = options.height ?? 24;
  let pipeline = sharp({
    create: { width, height, channels: 4, background: "#336699" },
  }).withMetadata({ orientation: 6 });
  pipeline =
    format === "jpeg"
      ? pipeline.jpeg()
      : format === "png"
        ? pipeline.png()
        : pipeline.webp();
  const bytes = await pipeline.toBuffer();
  const fileBytes = new Uint8Array(bytes.byteLength);
  fileBytes.set(bytes);
  return new File([fileBytes.buffer], `synthetic.${format}`, {
    type: options.type ?? `image/${format}`,
  });
}

test.describe("secure participant photo decoding", () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    test(`decodes real ${format}, rotates and strips metadata`, async () => {
      const result = await sanitizeUploadedPhoto(await imageFile(format));
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.width).toBe(24);
      expect(result.height).toBe(32);

      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.format).toBe("jpeg");
      expect(metadata.exif).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
    });
  }

  test("uses decoded bytes rather than claimed MIME or extension", async () => {
    const result = await sanitizeUploadedPhoto(
      await imageFile("jpeg", { type: "text/plain" }),
    );
    expect(result.mimeType).toBe("image/jpeg");
  });

  test("rejects renamed text, SVG and arbitrary binary data", async () => {
    const invalidFiles = [
      new File(["not a jpeg"], "renamed.jpg", { type: "image/jpeg" }),
      new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "vector.svg", {
        type: "image/svg+xml",
      }),
      new File([new Uint8Array([0, 1, 2, 3, 4])], "bytes.png", {
        type: "image/png",
      }),
    ];

    for (const file of invalidFiles) {
      await expect(sanitizeUploadedPhoto(file)).rejects.toBeInstanceOf(
        PhotoUploadValidationError,
      );
    }
  });

  test("rejects excessive byte size before decode", async () => {
    const file = new File(
      [new Uint8Array(PHOTO_UPLOAD_MAX_BYTES + 1)],
      "too-large.jpg",
      { type: "image/jpeg" },
    );
    await expect(sanitizeUploadedPhoto(file)).rejects.toMatchObject({
      code: "PHOTO_TOO_LARGE",
    });
  });

  test("rejects extreme dimensions", async () => {
    const file = await imageFile("png", { width: 8_001, height: 1 });
    await expect(sanitizeUploadedPhoto(file)).rejects.toMatchObject({
      code: "PHOTO_DIMENSIONS_TOO_LARGE",
    });
  });

  test("parallel decoding remains deterministic and independent", async () => {
    const files = await Promise.all(
      Array.from({ length: 8 }, () => imageFile("jpeg")),
    );
    const results = await Promise.all(files.map(sanitizeUploadedPhoto));
    expect(results).toHaveLength(8);
    expect(new Set(results.map((result) => result.mimeType))).toEqual(
      new Set(["image/jpeg"]),
    );
  });
});
