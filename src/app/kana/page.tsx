import ReferencePage from "@/components/reference/ReferencePage";
import { query } from "@/lib/db";
import { firstSyllable } from "@/lib/pinyin";

export const dynamic = "force-dynamic";

export default async function KanaPage() {
  let kanaCoverage: Record<string, number> = {};
  let pinyinCoverage: Record<string, number> = {};

  try {
    // Fetch single-char prefixes (for basic + voiced cells)
    const single = await query<{ k: string; cnt: number }>(
      `SELECT SUBSTR(v.furigana, 1, 1) as k, COUNT(DISTINCT v.word) as cnt
       FROM vocabulary v
       JOIN lyric_lines ll ON v.lyric_line_id = ll.id
       JOIN lessons l ON ll.lesson_id = l.id
       JOIN songs s ON l.song_id = s.id
       WHERE s.language = 'ja' AND LENGTH(v.furigana) > 0
       GROUP BY k`
    );
    // Fetch two-char prefixes (for yōon cells)
    const multi = await query<{ k: string; cnt: number }>(
      `SELECT SUBSTR(v.furigana, 1, 2) as k, COUNT(DISTINCT v.word) as cnt
       FROM vocabulary v
       JOIN lyric_lines ll ON v.lyric_line_id = ll.id
       JOIN lessons l ON ll.lesson_id = l.id
       JOIN songs s ON l.song_id = s.id
       WHERE s.language = 'ja' AND LENGTH(v.furigana) >= 2
       GROUP BY k`
    );
    for (const r of single) kanaCoverage[r.k] = r.cnt;
    for (const r of multi) {
      if (r.k.length === 2) kanaCoverage[r.k] = r.cnt;
    }
  } catch {
    // DB unavailable — chart still renders, just without coverage indicators
  }

  try {
    const zhWords = await query<{ furigana: string }>(
      `SELECT v.furigana
       FROM vocabulary v
       JOIN lyric_lines ll ON v.lyric_line_id = ll.id
       JOIN lessons l ON ll.lesson_id = l.id
       JOIN songs s ON l.song_id = s.id
       WHERE s.language = 'zh' AND LENGTH(v.furigana) > 0`
    );
    for (const row of zhWords) {
      const syl = firstSyllable(row.furigana);
      if (syl) pinyinCoverage[syl] = (pinyinCoverage[syl] ?? 0) + 1;
    }
  } catch {
    // DB unavailable — chart still renders, just without coverage indicators
  }

  return <ReferencePage kanaCoverage={kanaCoverage} pinyinCoverage={pinyinCoverage} />;
}
