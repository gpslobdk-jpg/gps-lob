import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Hostnames we allow proxying — prevents open-redirect / SSRF abuse. */
const ALLOWED_HOSTNAMES = new Set([
  "oaidalleapiprodscus.blob.core.windows.net",
]);

function buildSvgPlaceholder(message: string): string {
  const safeMessage = message.replace(/[<&>"]/g, "");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <rect width="1024" height="1024" fill="#f5f0e1" />
      <text x="512" y="480" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="#292524">
        Illustration kunne ikke hentes
      </text>
      <text x="512" y="540" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#57534e">
        ${safeMessage}
      </text>
    </svg>
  `.trim();
}

export async function GET(request: Request) {
  const { pathname, search, searchParams } = new URL(request.url);
  const requestPath = `${pathname}${search}`;
  const rawUrl = searchParams.get("url")?.trim() ?? "";

  if (!rawUrl) {
    return new Response(buildSvgPlaceholder("Mangler url-parameter"), {
      status: 400,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return new Response(buildSvgPlaceholder("Ugyldig URL"), {
      status: 400,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
    return new Response(buildSvgPlaceholder("Hostname ikke tilladt"), {
      status: 403,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const upstream = await fetch(rawUrl, { cache: "no-store" });

    if (!upstream.ok) {
      return new Response(
        buildSvgPlaceholder(`Upstream fejl (${upstream.status})`),
        {
          status: 502,
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "image/png";
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Netværksfejl ved proxy-hentning";
    await logHandledServerError({
      route: "/api/proxy-image",
      method: "GET",
      status: 502,
      error,
      requestPath,
      routeType: "route",
    });

    return new Response(buildSvgPlaceholder(message), {
      status: 502,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
