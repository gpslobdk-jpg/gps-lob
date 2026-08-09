import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output and local Supabase runtime state are never source files.
    "playwright-report/**",
    "test-results/**",
    "supabase/.temp/**",
    "public/fallback-*.js",
    "public/sw.js",
    "public/swe-worker-*.js",
    "public/workbox-*.js",
  ]),
]);

export default eslintConfig;
