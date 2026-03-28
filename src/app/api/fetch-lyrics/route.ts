import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "";
  const artist = searchParams.get("artist") || "";

  try {
    // Try broad search first using q parameter
    const query = [title, artist].filter(Boolean).join(" ");
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "LyricLearn/1.0" } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "lrclib.net request failed" }, { status: 502 });
    }

    const results = await res.json();

    // Find first result with synced lyrics
    const match = results.find((r: { syncedLyrics?: string }) => r.syncedLyrics);

    if (!match) {
      return NextResponse.json({ error: "No synced lyrics found" }, { status: 404 });
    }

    return NextResponse.json({
      lrc: match.syncedLyrics,
      trackName: match.trackName,
      artistName: match.artistName,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch lyrics" }, { status: 500 });
  }
}
