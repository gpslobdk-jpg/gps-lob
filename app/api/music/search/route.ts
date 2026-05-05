import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 15;

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";
const MAX_RESULTS = 12;
const MIN_QUERY_LENGTH = 2;

type ItunesTrack = {
  trackId?: unknown;
  trackName?: unknown;
  artistName?: unknown;
  collectionName?: unknown;
  previewUrl?: unknown;
  artworkUrl100?: unknown;
  wrapperType?: unknown;
  kind?: unknown;
};

type MusicSearchResult = {
  provider: "itunes";
  trackId: string;
  trackName: string;
  artistName: string;
  collectionName: string | null;
  previewUrl: string;
  artworkUrl100: string | null;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringOrNull(value: unknown): string | null {
  const trimmed = asTrimmedString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTrack(raw: ItunesTrack): MusicSearchResult | null {
  const previewUrl = asTrimmedString(raw.previewUrl);
  if (!previewUrl) return null;

  const trackId =
    typeof raw.trackId === "number"
      ? String(raw.trackId)
      : asTrimmedString(raw.trackId);
  if (!trackId) return null;

  const trackName = asTrimmedString(raw.trackName);
  const artistName = asTrimmedString(raw.artistName);
  if (!trackName || !artistName) return null;

  return {
    provider: "itunes",
    trackId,
    trackName,
    artistName,
    collectionName: asStringOrNull(raw.collectionName),
    previewUrl,
    artworkUrl100: asStringOrNull(raw.artworkUrl100),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = asTrimmedString(searchParams.get("q"));

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { error: "Skriv mindst 2 tegn for at søge efter musik." },
      { status: 400 }
    );
  }

  const itunesUrl = new URL(ITUNES_SEARCH_URL);
  itunesUrl.searchParams.set("term", q);
  itunesUrl.searchParams.set("media", "music");
  itunesUrl.searchParams.set("entity", "song");
  itunesUrl.searchParams.set("country", "DK");
  itunesUrl.searchParams.set("limit", String(MAX_RESULTS));

  let rawResults: ItunesTrack[] = [];

  try {
    const response = await fetch(itunesUrl.toString(), {
      headers: { Accept: "application/json" },
      // Edge runtime understøtter ikke next: { revalidate }, brug cache API
      cache: "force-cache",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Musiksøgningen svarede ikke lige nu. Prøv igen." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { results?: unknown[] };
    rawResults = Array.isArray(data.results)
      ? (data.results as ItunesTrack[])
      : [];
  } catch {
    return NextResponse.json(
      { error: "Musiksøgningen svarede ikke lige nu. Prøv igen." },
      { status: 502 }
    );
  }

  const results: MusicSearchResult[] = rawResults
    .map(normalizeTrack)
    .filter((track): track is MusicSearchResult => track !== null)
    .slice(0, MAX_RESULTS);

  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
