import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const mascotSource = path.join(projectRoot, "public", "brand", "mascot", "skolegps-pin.png");
const outputDirectory = path.join(projectRoot, "public", "icons");

const iconDefinitions = [
  { name: "skolegps-pilen-any-192-v1.png", size: 192, inset: 0.78, color: "#0b5ed7" },
  { name: "skolegps-pilen-any-512-v1.png", size: 512, inset: 0.78, color: "#0b5ed7" },
  { name: "skolegps-pilen-maskable-192-v1.png", size: 192, inset: 0.62, color: "#073b91" },
  { name: "skolegps-pilen-maskable-512-v1.png", size: 512, inset: 0.62, color: "#073b91" },
  { name: "skolegps-pilen-apple-touch-180-v1.png", size: 180, inset: 0.76, color: "#0b5ed7" },
];

async function makeIcon({ name, size, inset, color }) {
  const image = sharp(mascotSource, { animated: false });
  const metadata = await image.metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("The Pilen source image has no readable dimensions.");
  }

  // Pilen's head and arms stay legible at launcher scale; the full, tall mascot
  // becomes too small inside a square app icon.
  const cropWidth = Math.round(sourceWidth * 0.86);
  const cropHeight = Math.min(Math.round(sourceHeight * 0.68), cropWidth);
  const cropLeft = Math.round((sourceWidth - cropWidth) / 2);
  const mascot = await image
    .extract({ left: cropLeft, top: 0, width: cropWidth, height: cropHeight })
    .resize({
      width: Math.round(size * inset),
      height: Math.round(size * inset),
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: color,
    },
  })
    .composite([
      {
        input: mascot,
        top: Math.round((size - Math.round(size * inset)) / 2) - Math.round(size * 0.035),
        left: Math.round((size - Math.round(size * inset)) / 2),
      },
    ])
    .png()
    .toFile(path.join(outputDirectory, name));
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all(iconDefinitions.map(makeIcon));
