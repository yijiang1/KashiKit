import GrammarExplorer, { type GrammarStructure, type GrammarExample } from "@/components/grammar/GrammarExplorer";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type GrammarRow = {
  structure: string;
  explanation: string;
  example_sentence_jp: string;
  example_sentence_en: string;
  lyric_line_id: string;
  japanese_text: string;
  english_text: string;
  song_title: string;
  youtube_id: string;
  start_time: number;
  end_time: number;
};

export default async function GrammarPage() {
  let structures: GrammarStructure[] = [];

  try {
    const rows = await query<GrammarRow>(`
      SELECT
        gp.structure,
        gp.explanation,
        gp.example_sentence_jp,
        gp.example_sentence_en,
        gp.lyric_line_id,
        ll.japanese_text,
        ll.english_text,
        s.title  AS song_title,
        s.youtube_id,
        ll.start_time,
        ll.end_time
      FROM grammar_points gp
      JOIN lyric_lines ll ON gp.lyric_line_id = ll.id
      JOIN lessons     l  ON ll.lesson_id = l.id
      JOIN songs       s  ON l.song_id = s.id
      WHERE gp.structure != '_none'
      ORDER BY gp.structure, gp.id
    `);

    // Group by structure, keep first 5 examples, track true total count
    const map = new Map<string, { count: number; examples: GrammarExample[] }>();
    for (const row of rows) {
      if (!map.has(row.structure)) {
        map.set(row.structure, { count: 0, examples: [] });
      }
      const entry = map.get(row.structure)!;
      entry.count++;
      if (entry.examples.length < 5) {
        entry.examples.push({
          explanation: row.explanation,
          example_sentence_jp: row.example_sentence_jp,
          example_sentence_en: row.example_sentence_en,
          lyric_line_id: row.lyric_line_id,
          japanese_text: row.japanese_text,
          english_text: row.english_text,
          song_title: row.song_title,
          youtube_id: row.youtube_id,
          start_time: Number(row.start_time),
          end_time: Number(row.end_time),
        });
      }
    }

    structures = Array.from(map.entries())
      .map(([structure, data]) => ({ structure, ...data }))
      .sort((a, b) => b.count - a.count);
  } catch {
    // DB unavailable — renders empty state
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Grammar Guide</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Grammar patterns found in your songs — click any to see real lyric examples
        </p>
      </div>
      <GrammarExplorer structures={structures} />
    </div>
  );
}
