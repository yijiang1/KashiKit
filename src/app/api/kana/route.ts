import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

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
  const kana = req.nextUrl.searchParams.get("kana");
  if (!kana) return NextResponse.json({ words: [], sentences: [] });

  try {
    const [words, sentences] = await Promise.all([
      query<WordRow>(
        `SELECT v.word, v.furigana, v.english_meaning, v.part_of_speech, s.title as song_title
         FROM vocabulary v
         JOIN lyric_lines ll ON v.lyric_line_id = ll.id
         JOIN lessons l ON ll.lesson_id = l.id
         JOIN songs s ON l.song_id = s.id
         WHERE v.furigana LIKE ?
         GROUP BY v.word, v.furigana
         ORDER BY LENGTH(v.furigana), v.furigana
         LIMIT 24`,
        [`${kana}%`]
      ),
      query<SentenceRow>(
        `SELECT japanese_text, english_text, song_title, youtube_id, start_time, end_time
         FROM sentence_bank
         WHERE japanese_text LIKE ?
         ORDER BY RANDOM()
         LIMIT 8`,
        [`%${kana}%`]
      ),
    ]);

    return NextResponse.json({ words, sentences });
  } catch {
    return NextResponse.json({ words: [], sentences: [] });
  }
}
