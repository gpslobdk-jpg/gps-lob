import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const studentExperienceBuildTime =
  process.env.NEXT_PUBLIC_STUDENT_EXPERIENCE_BUILD_TIME ?? new Date().toISOString();
const studentExperienceReleaseId = (
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local"
).slice(0, 12);

const withPWA = withPWAInit({
  dest: "public",
  // The generated worker is a production artifact. Rewriting it from a dev
  // server races with Playwright and can leave /join unavailable on Windows.
  disable: process.env.NODE_ENV === "development",
  publicExcludes: ["!**/*"],
  // Disable automatic SW registration; we'll register manually client-side
  register: false,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    // A running pupil must finish on the worker they already have. New
    // deployments wait until the browser is closed or naturally reloaded.
    skipWaiting: false,
    clientsClaim: false,
    runtimeCaching: [
      {
        urlPattern: /\/api\/.*/i,
        handler: "NetworkOnly",
      },
      {
        urlPattern: ({ request, url, sameOrigin }) =>
          sameOrigin &&
          url.pathname === "/del/afvikling" &&
          request.headers.get("RSC") === "1",
        handler: "NetworkOnly",
        method: "GET",
      },
      {
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname === "/del/afvikling",
        handler: "NetworkOnly",
        method: "GET",
      },
      {
        urlPattern: ({ request, url, sameOrigin }) =>
          sameOrigin &&
          url.pathname === "/oevekort/del" &&
          request.headers.get("RSC") === "1",
        handler: "NetworkOnly",
        method: "GET",
      },
      {
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname === "/oevekort/del",
        handler: "NetworkOnly",
        method: "GET",
      },
      {
        urlPattern: ({ request, url, sameOrigin }) =>
          sameOrigin &&
          (url.pathname === "/join" || url.pathname.startsWith("/play/")) &&
          request.headers.get("RSC") === "1",
        handler: "NetworkOnly",
        method: "GET",
      },
      {
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin &&
          (url.pathname === "/join" || url.pathname.startsWith("/play/")),
        handler: "NetworkOnly",
        method: "GET",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  turbopack: {},
  transpilePackages: ["@react-pdf/renderer"],
  env: {
    NEXT_PUBLIC_STUDENT_EXPERIENCE_UI_VERSION: "elevapp-2026-09",
    NEXT_PUBLIC_STUDENT_EXPERIENCE_BUILD_TIME: studentExperienceBuildTime,
    NEXT_PUBLIC_STUDENT_EXPERIENCE_RELEASE_ID: studentExperienceReleaseId,
  },
  async headers() {
    return [
      {
        source: "/del/afvikling",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/oevekort/del",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/api/family-sso/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'none'; object-src 'none'" },
        ],
      },
    ];
  },
};

export default withSentryConfig(withPWA(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "gpslobdk",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
