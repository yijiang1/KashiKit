import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { firstSyllable } from "@/lib/pinyin";

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
  // Chinese-language mirror of /api/kana — returns verbatim sentence_bank lyric
  // lines + translations. Gated: no copyrighted lyric text to unauthenticated
  // callers.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const syllable = req.nextUrl.searchParams.get("syllable");
  if (!syllable) return NextResponse.json({ words: [], sentences: [] });

  try {
    // Pinyin readings are space-separated toned syllables (e.g. "xǐ huān"),
    // so first-syllable matching has to happen in JS rather than SQL LIKE.
    const allWords = await query<WordRow>(
      `SELECT v.word, v.furigana, v.english_meaning, v.part_of_speech, s.title as song_title
       FROM vocabulary v
       JOIN lyric_lines ll ON v.lyric_line_id = ll.id
       JOIN lessons l ON ll.lesson_id = l.id
       JOIN songs s ON l.song_id = s.id
       WHERE s.language = 'zh' AND v.furigana != ''
       GROUP BY v.word, v.furigana`
    );
    const words = allWords.filter((w) => firstSyllable(w.furigana) === syllable).slice(0, 24);

    const matchedWords = [...new Set(words.map((w) => w.word))];
    let sentences: SentenceRow[] = [];
    if (matchedWords.length > 0) {
      const placeholders = matchedWords.map(() => "?").join(",");
      sentences = await query<SentenceRow>(
        `SELECT japanese_text, english_text, song_title, youtube_id, start_time, end_time
         FROM sentence_bank
         WHERE language = 'zh' AND EXISTS (SELECT 1 FROM json_each(words) WHERE value IN (${placeholders}))
         ORDER BY RANDOM()
         LIMIT 20`,
        matchedWords
      );
    }

    return NextResponse.json({ words, sentences });
  } catch {
    return NextResponse.json({ words: [], sentences: [] });
  }
}
