import { NextRequest, NextResponse } from "next/server";

// Hiragana/katakana + Han ideographs \u2014 covers both Japanese (kana+kanji) and
// Chinese (hanzi) lyrics, since lrclib.net search isn't language-scoped.
const CJK_RE = /[\u3040-\u30FF\u4E00-\u9FFF]/;

function hasCJKText(lrc: string): boolean {
  return CJK_RE.test(lrc);
}

// Songwriting-credit line prefixes ("词："/"作詞：" lyricist, "曲：" composer, etc.) —
// the same convention in both Chinese and Japanese LRC headers, using either
// simplified or traditional forms of the character.
const CREDIT_LINE_RE = /^(作?[词詞]|作?曲|编曲|編曲|监制|監製|制作人?|製作人?|混音|录音|錄音|演唱|原唱)\s*[:：]/;

function stripTitleLine(lrc: string): string {
  return lrc
    .split("\n")
    .filter((line) => {
      const isEarlyTimestamp = /^\[00:0[01]\.\d+\]/.test(line);
      const text = line.replace(/^\[[\d:.]+\]/, "").trim();
      if (!text) return true;
      // Songwriting credits can appear at any point in the first verse's lead-in,
      // not just the very first timestamp — drop them wherever they show up.
      if (CREDIT_LINE_RE.test(text)) return false;
      // Remove an early "Title - Artist" header line, whether romanized (no CJK
      // text at all) or in the song's own script (dash-separated, e.g. "大鱼 - 周深").
      if (isEarlyTimestamp) {
        if (!CJK_RE.test(text)) return false;
        if (/^.+[-－].+$/.test(text)) return false;
      }
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
  // Prefer results with CJK lyrics over romanized-only transliterations
  return pool.find((r) => hasCJKText(r.syncedLyrics!)) ?? pool[0];
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
          if (hasCJKText(exactMatch.syncedLyrics)) {
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
