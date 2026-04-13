import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildPollinationsUrl(prompt: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true`;
}

function buildSvgPlaceholder(message: string): string {
  const safeMessage = message.replace(/[<&>"]/g, "");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="#f5f0e1" />
      <rect x="40" y="40" width="1120" height="720" fill="none" stroke="#292524" stroke-width="8" />
      <text x="600" y="360" text-anchor="middle" font-family="Georgia, serif" font-size="42" fill="#292524">
        Illustration kunne ikke hentes
      </text>
      <text x="600" y="430" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#57534e">
        ${safeMessage}
      </text>
    </svg>
  `.trim();
}

export async function GET(request: Request) {
  const { pathname, search, searchParams } = new URL(request.url);
  const requestPath = `${pathname}${search}`;
  const prompt = searchParams.get("prompt")?.trim() ?? "";

  if (!prompt) {
    return new Response(buildSvgPlaceholder("Mangler prompt"), {
      status: 400,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const upstream = await fetch(buildPollinationsUrl(prompt), {
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new Response(buildSvgPlaceholder(`Fejl fra Pollinations (${upstream.status})`), {
        status: 502,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Netværksfejl ved hentning af illustration";
    await logHandledServerError({
      route: "/api/pollinations-image",
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