/**
 * global-setup.ts – Playwright global setup (runs ONCE before any worker starts).
 *
 * Purpose: warm up the Next.js dev server's on-demand compilation for the
 * /play/* route. When two workers each run a beforeAll warmup simultaneously
 * on Windows, Node.js file-system locking corrupts .next/dev/static/chunks/webpack.js.
 * Moving the warmup here ensures a single serial compilation pass.
 *
 * We use plain fetch (no browser) so we don't spin up an extra Chromium
 * process that would conflict with Playwright's own webServer lifecycle.
 * At globalSetup time the webServer (npm run dev / reuseExistingServer) is
 * already running because Playwright starts it before globalSetup executes.
 */

const BASE = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WARMUP_URL = `${BASE}/play/44444444-4444-4444-8444-444444444444`;
const CHUNK_TIMEOUT_MS = 120_000;
const SETTLE_MS = 3_000; // let webpack finish writing chunks to disk

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default async function globalSetup() {
  // Step 1: Fetch the page HTML.  This triggers Next.js server-side
  // compilation (SSR) and returns HTML that contains <script src="/_next/...">
  // tags listing every client-side JS chunk the page needs.
  let html = "";
  try {
    const res = await fetch(WARMUP_URL, {
      signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
    });
    html = await res.text();
  } catch {
    // Server returned an error page — that is expected for a fake session ID.
    // We still get the HTML with the script tags we need.
  }

  // Step 2: Extract every /_next/static/…js URL from the HTML and fetch them.
  // Next.js dev mode compiles client-side chunks LAZILY — only when a browser
  // (or a fetch) requests the JS file.  A plain page fetch only compiles the
  // SSR path; the client JS bundles stay uncompiled until explicitly requested.
  // Fetching them here compiles all React/component code before any test worker
  // starts, so the 65-110s waitForSelector budget is spent on app logic, not
  // webpack compilation.
  const scriptPaths = [
    ...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g),
  ].map((m) => `${BASE}${m[1]}`);

  // Keep this serial on Windows. Concurrent on-demand chunk compilation can
  // contend for the same webpack files and leave the reused dev server stuck.
  for (const url of [...new Set(scriptPaths)]) {
    await fetch(url, { signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS) }).catch(
      () => {}
    );
  }

  // Step 3: Give webpack a moment to finish writing all chunk files to disk
  // before the first worker navigates to the page.
  await sleep(SETTLE_MS);
}
