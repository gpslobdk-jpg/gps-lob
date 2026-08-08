import { createHmac } from "node:crypto";

function getRequestAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-vercel-forwarded-for")?.trim() ||
    ""
  );
}

export function createPhotoRateLimitFingerprint(request: Request) {
  const secret = process.env.PHOTO_RATE_LIMIT_SECRET?.trim() ?? "";
  const address = getRequestAddress(request);

  if (!secret || !address) return null;

  return createHmac("sha256", secret)
    .update(`photo-upload:${address}`, "utf8")
    .digest("hex");
}
