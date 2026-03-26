import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";

export const runtime = "nodejs";

type ScraperPayload = {
  url?: unknown;
};

type ScraperResult = {
  title: string;
  description: string;
  transcript: string | null;
};

function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function scrapeGeneralPage(url: string): Promise<{ title: string; description: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; GPSLobBot/1.0; +https://gpslob.dk)",
    },
  });

  if (!response.ok) {
    throw new Error(`Kunne ikke hente siden (${response.status}).`);
  }

  const html = await response.text();
  const $ = load(html);

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().trim() ||
    "Ukendt titel";

  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    "";

  return { title, description };
}

async function scrapeYouTube(
  url: string
): Promise<ScraperResult> {
  // Hent title via HTML scrape
  const { title, description: fallbackDesc } = await scrapeGeneralPage(url).catch(() => ({
    title: "YouTube video",
    description: "",
  }));

  // Forsøg at hente undertekster
  try {
    const segments = await YoutubeTranscript.fetchTranscript(url, { lang: "da" }).catch(() =>
      YoutubeTranscript.fetchTranscript(url)
    );

    const transcript = segments.map((s) => s.text).join(" ");

    return { title, description: fallbackDesc, transcript: transcript || null };
  } catch {
    // Ingen undertekster — returner blot metadata
    return { title, description: fallbackDesc, transcript: null };
  }
}

export async function POST(request: NextRequest) {
  let payload: ScraperPayload;

  try {
    payload = (await request.json()) as ScraperPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const url = asTrimmedString(payload.url);
  if (!url) {
    return NextResponse.json({ success: false, error: "URL mangler." }, { status: 400 });
  }

  // Grundlæggende URL-validering
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Ugyldigt protokol.");
    }
  } catch {
    return NextResponse.json({ success: false, error: "Ugyldig URL." }, { status: 400 });
  }

  try {
    let data: ScraperResult;

    if (isYouTubeUrl(url)) {
      data = await scrapeYouTube(url);
    } else {
      const { title, description } = await scrapeGeneralPage(url);
      data = { title, description, transcript: null };
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Podcast-scraper fejl:", error);
    const message = error instanceof Error ? error.message : "Ukendt fejl.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
