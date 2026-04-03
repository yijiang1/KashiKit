import { NextRequest, NextResponse } from "next/server";

const JP_RE = /[\u3040-\u30FF\u4E00-\u9FFF]/;

function hasJapanese(lrc: string): boolean {
  return JP_RE.test(lrc);
}

function stripTitleLine(lrc: string): string {
  // Remove lines at [00:00.xx] that look like "Title - Artist" (no Japanese)
  return lrc
    .split("\n")
    .filter((line) => {
      const isEarlyTimestamp = /^\[00:0[01]\.\d+\]/.test(line);
      const text = line.replace(/^\[[\d:.]+\]/, "").trim();
      if (isEarlyTimestamp && text && !JP_RE.test(text)) return false;
      return true;
    })
    .join("\n");
}

type LrcResult = { syncedLyrics?: string; trackName: string; artistName: string };

function pickBest(results: LrcResult[], preferTitle?: string): LrcResult | undefined {
  const withSynced = results.filter((r) => r.syncedLyrics);
  // If we have a title to match, restrict to results with matching trackName first
  const titleMatches = preferTitle
    ? withSynced.filter((r) => r.trackName.toLowerCase() === preferTitle.toLowerCase())
    : withSynced;
  const pool = titleMatches.length > 0 ? titleMatches : withSynced;
  // Prefer results whose lyrics contain Japanese characters
  return pool.find((r) => hasJapanese(r.syncedLyrics!)) ?? pool[0];
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "";
  const artist = searchParams.get("artist") || "";

  try {
    // Try exact match first
    if (title) {
      const exactParams = new URLSearchParams({ track_name: title });
      if (artist) exactParams.set("artist_name", artist);
      const exactRes = await fetch(
        `https://lrclib.net/api/get?${exactParams}`,
        { headers: { "User-Agent": "KashiKit/1.0" } }
      );
      if (exactRes.ok) {
        const exactMatch = await exactRes.json();
        if (exactMatch?.syncedLyrics) {
          // If exact match is romanized, fall through to search for a Japanese version
          if (hasJapanese(exactMatch.syncedLyrics)) {
            return NextResponse.json({
              lrc: stripTitleLine(exactMatch.syncedLyrics),
              trackName: exactMatch.trackName,
              artistName: exactMatch.artistName,
            });
          }
        }
      }
    }

    // Fall back to broad search — pick best (prefer Japanese over romanized)
    const query = [title, artist].filter(Boolean).join(" ");
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "KashiKit/1.0" } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "lrclib.net request failed" }, { status: 502 });
    }

    const results: LrcResult[] = await res.json();
    const match = pickBest(results, title);

    if (!match) {
      return NextResponse.json({ error: "No synced lyrics found" }, { status: 404 });
    }

    return NextResponse.json({
      lrc: stripTitleLine(match.syncedLyrics!),
      trackName: match.trackName,
      artistName: match.artistName,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch lyrics" }, { status: 500 });
  }
}
