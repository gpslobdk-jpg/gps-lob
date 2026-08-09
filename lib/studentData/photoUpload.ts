import sharp from "sharp";

export const PHOTO_UPLOAD_MAX_BYTES = 12 * 1024 * 1024;
export const PHOTO_OUTPUT_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_MAX_WIDTH = 8_000;
export const PHOTO_MAX_HEIGHT = 8_000;
// A 12 MP ceiling still preserves more detail than the displayed school-task
// photos need, while bounding libvips memory during concurrent submissions.
export const PHOTO_MAX_PIXELS = 12_000_000;

const ALLOWED_SOURCE_FORMATS = new Set(["jpeg", "png", "webp"]);

export type SanitizedPhoto = {
  buffer: Buffer;
  mimeType: "image/jpeg";
  width: number;
  height: number;
};

export class PhotoUploadValidationError extends Error {
  constructor(
    public readonly code:
      | "PHOTO_EMPTY"
      | "PHOTO_TOO_LARGE"
      | "PHOTO_FORMAT_UNSUPPORTED"
      | "PHOTO_DIMENSIONS_TOO_LARGE"
      | "PHOTO_DECODE_FAILED",
  ) {
    super(code);
    this.name = "PhotoUploadValidationError";
  }
}

export async function sanitizeUploadedPhoto(file: File): Promise<SanitizedPhoto> {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new PhotoUploadValidationError("PHOTO_EMPTY");
  }
  if (file.size > PHOTO_UPLOAD_MAX_BYTES) {
    throw new PhotoUploadValidationError("PHOTO_TOO_LARGE");
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (input.byteLength === 0) {
    throw new PhotoUploadValidationError("PHOTO_EMPTY");
  }

  try {
    const decoder = sharp(input, {
      failOn: "error",
      limitInputPixels: PHOTO_MAX_PIXELS,
      sequentialRead: true,
    });
    const metadata = await decoder.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!metadata.format || !ALLOWED_SOURCE_FORMATS.has(metadata.format)) {
      throw new PhotoUploadValidationError("PHOTO_FORMAT_UNSUPPORTED");
    }
    if (
      width <= 0 ||
      height <= 0 ||
      width > PHOTO_MAX_WIDTH ||
      height > PHOTO_MAX_HEIGHT ||
      width * height > PHOTO_MAX_PIXELS
    ) {
      throw new PhotoUploadValidationError("PHOTO_DIMENSIONS_TOO_LARGE");
    }

    // rotate() applies EXIF orientation. Re-encoding without withMetadata()
    // deliberately removes EXIF, GPS, comments, ICC and other source metadata.
    const { data, info } = await decoder
      .rotate()
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer({ resolveWithObject: true });

    if (
      data.byteLength === 0 ||
      data.byteLength > PHOTO_OUTPUT_MAX_BYTES ||
      info.width > PHOTO_MAX_WIDTH ||
      info.height > PHOTO_MAX_HEIGHT
    ) {
      throw new PhotoUploadValidationError("PHOTO_DIMENSIONS_TOO_LARGE");
    }

    return {
      buffer: data,
      mimeType: "image/jpeg",
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    if (error instanceof PhotoUploadValidationError) throw error;
    throw new PhotoUploadValidationError("PHOTO_DECODE_FAILED");
  }
}
