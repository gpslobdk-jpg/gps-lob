import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const productionRoots = ["app", "components", "lib"];
const productionExtensions = new Set([".css", ".scss", ".ts", ".tsx"]);

function productionFiles(directory: string): string[] {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return productionFiles(relativePath);
      }

      return productionExtensions.has(path.extname(entry.name))
        ? [relativePath]
        : [];
    }
  );
}

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test.describe("font build reliability", () => {
  test("keeps Google Fonts out of the production build and runtime", () => {
    const files = productionRoots.flatMap(productionFiles);

    for (const file of files) {
      const content = source(file);

      expect(content, file).not.toContain("next/font/google");
      expect(content, file).not.toContain("fonts.googleapis.com");
      expect(content, file).not.toContain("fonts.gstatic.com");
    }
  });

  test("self-hosts exactly the production weights with their licenses", () => {
    const fontModule = source("lib/fonts.ts");

    expect(fontModule).toContain('from "next/font/local"');

    for (const weight of ["400", "500", "600", "700", "800"]) {
      expect(fontModule).toContain(`poppins-${weight}-latin.woff2`);
    }

    for (const weight of ["700", "800", "900"]) {
      expect(fontModule).toContain(`rubik-${weight}-latin.woff2`);
    }

    for (const relativePath of [
      "assets/fonts/poppins/OFL.txt",
      "assets/fonts/rubik/OFL.txt",
    ]) {
      expect(source(relativePath)).toContain("SIL OPEN FONT LICENSE Version 1.1");
    }
  });

  test("stores valid WOFF2 assets locally", () => {
    for (const relativePath of [
      "assets/fonts/poppins/poppins-400-latin.woff2",
      "assets/fonts/poppins/poppins-500-latin.woff2",
      "assets/fonts/poppins/poppins-600-latin.woff2",
      "assets/fonts/poppins/poppins-700-latin.woff2",
      "assets/fonts/poppins/poppins-800-latin.woff2",
      "assets/fonts/rubik/rubik-700-latin.woff2",
      "assets/fonts/rubik/rubik-800-latin.woff2",
      "assets/fonts/rubik/rubik-900-latin.woff2",
    ]) {
      const font = readFileSync(path.join(root, relativePath));
      expect(font.subarray(0, 4).toString("ascii"), relativePath).toBe("wOF2");
    }
  });
});
