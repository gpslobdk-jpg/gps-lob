import { NextResponse } from "next/server";

import {
  getProtectedPrintpakkeDownload,
  readProtectedPrintpakkeDownload,
} from "@/lib/printpakker/downloads.server";
import { hasPrintpakkeDownloadSession } from "@/lib/printpakker/access";
import { buildPrintpakkeLoginReturnPath, isPrintpakkeDownloadVariant } from "@/lib/printpakker/links";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string; variant: string }>;
};

function privateHeaders() {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  const { slug, variant } = await params;
  if (!isPrintpakkeDownloadVariant(variant)) {
    return NextResponse.json({ error: "Materialet findes ikke." }, { status: 404, headers: privateHeaders() });
  }
  const download = getProtectedPrintpakkeDownload(slug, variant);

  if (!download) {
    return NextResponse.json({ error: "Materialet findes ikke." }, { status: 404, headers: privateHeaders() });
  }

  let hasUser = false;
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    hasUser = !error && hasPrintpakkeDownloadSession(user);
  } catch {
    hasUser = false;
  }

  if (!hasUser) {
    // Do not expand the global safe-next allowlist. The existing /dashboard
    // prefix carries the exact, validated package and requested file back
    // through a small authenticated landing route.
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", buildPrintpakkeLoginReturnPath(slug, variant));
    const response = NextResponse.redirect(loginUrl, 307);
    for (const [name, value] of Object.entries(privateHeaders())) response.headers.set(name, value);
    return response;
  }

  try {
    const file = await readProtectedPrintpakkeDownload(download);
    return new NextResponse(file, {
      headers: {
        ...privateHeaders(),
        "Content-Disposition": `attachment; filename="${download.filename}"`,
        "Content-Length": String(file.byteLength),
        "Content-Type": download.mediaType,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Materialefilen kunne ikke læses lokalt." },
      { status: 503, headers: privateHeaders() },
    );
  }
}
