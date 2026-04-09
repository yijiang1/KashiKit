import KanaChart from "@/components/kana/KanaChart";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function KanaPage() {
  let coverage: Record<string, number> = {};

  try {
    // Fetch single-char prefixes (for basic + voiced cells)
    const single = await query<{ k: string; cnt: number }>(
      `SELECT SUBSTR(furigana, 1, 1) as k, COUNT(DISTINCT word) as cnt
       FROM vocabulary
       WHERE LENGTH(furigana) > 0
       GROUP BY k`
    );
    // Fetch two-char prefixes (for yōon cells)
    const multi = await query<{ k: string; cnt: number }>(
      `SELECT SUBSTR(furigana, 1, 2) as k, COUNT(DISTINCT word) as cnt
       FROM vocabulary
       WHERE LENGTH(furigana) >= 2
       GROUP BY k`
    );
    for (const r of single) coverage[r.k] = r.cnt;
    for (const r of multi) {
      if (r.k.length === 2) coverage[r.k] = r.cnt;
    }
  } catch {
    // DB unavailable — chart still renders, just without coverage indicators
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kana Chart</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Learn hiragana and katakana — click any character to see examples from your songs
        </p>
      </div>
      <KanaChart coverage={coverage} />
    </div>
  );
}
