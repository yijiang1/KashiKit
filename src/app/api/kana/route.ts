import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type WordRow = {
  word: string;
  furigana: string;
  english_meaning: string;
  part_of_speech: string;
  song_title: string;
};

type SentenceRow = {
  japanese_text: string;
  english_text: string;
  song_title: string;
  youtube_id: string;
  start_time: number;
  end_time: number;
};

export async function GET(req: NextRequest) {
  // Returns verbatim lyric lines + translations from lyric_lines / sentence_bank.
  // Gated: no copyrighted lyric text to unauthenticated callers.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const kana = req.nextUrl.searchParams.get("kana");
  if (!kana) return NextResponse.json({ words: [], sentences: [] });

  try {
    // The Kana Chart is Japanese-only — scope explicitly rather than relying
    // on kana characters simply not appearing in Chinese pinyin readings.
    const [words, sentences] = await Promise.all([
      query<WordRow>(
        `SELECT v.word, v.furigana, v.english_meaning, v.part_of_speech, s.title as song_title
         FROM vocabulary v
         JOIN lyric_lines ll ON v.lyric_line_id = ll.id
         JOIN lessons l ON ll.lesson_id = l.id
         JOIN songs s ON l.song_id = s.id
         WHERE v.furigana LIKE ? AND s.language = 'ja'
         GROUP BY v.word, v.furigana
         ORDER BY LENGTH(v.furigana), v.furigana
         LIMIT 24`,
        [`${kana}%`]
      ),
      query<SentenceRow>(
        `SELECT ll.japanese_text, ll.english_text, s.title as song_title,
                s.youtube_id, ll.start_time, ll.end_time
         FROM lyric_lines ll
         JOIN lessons l ON ll.lesson_id = l.id
         JOIN songs s ON l.song_id = s.id
         WHERE ll.japanese_text LIKE ? AND s.language = 'ja'
         ORDER BY RANDOM()`,
        [`%${kana}%`]
      ),
    ]);

    return NextResponse.json({ words, sentences });
  } catch {
    return NextResponse.json({ words: [], sentences: [] });
  }
}
