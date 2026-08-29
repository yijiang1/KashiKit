import { NextRequest, NextResponse } from "next/server";
import { query, run, queryOne } from "@/lib/db";
import { requireSongWriteByLesson } from "@/lib/auth";
import { generateQuizQuestions } from "@/lib/ai/quiz";
import { DEFAULT_LANGUAGE, isLanguageId } from "@/lib/languages";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const gate = await requireSongWriteByLesson(lessonId);
  if (gate instanceof NextResponse) return gate;

  const lessonSong = await queryOne<{ language: string }>(
    "SELECT s.language FROM lessons l JOIN songs s ON l.song_id = s.id WHERE l.id = ?",
    [lessonId]
  );
  const language = isLanguageId(lessonSong?.language) ? lessonSong.language : DEFAULT_LANGUAGE;

  const lines = await query<{ japanese_text: string; english_text: string; id: string }>(
    "SELECT japanese_text, english_text, id FROM lyric_lines WHERE lesson_id = ? ORDER BY start_time ASC",
    [lessonId]
  );

  if (lines.length === 0) {
    return NextResponse.json({ error: "No lines found" }, { status: 404 });
  }

  const lineIds = lines.map((l) => l.id);
  const vocab = await query<{ word: string; furigana: string; english_meaning: string; part_of_speech: string }>(
    `SELECT word, furigana, english_meaning, part_of_speech FROM vocabulary WHERE lyric_line_id IN (${lineIds.map(() => "?").join(",")})`,
    lineIds
  );

  const lyricsContext = lines.map((l) => `${l.japanese_text} → ${l.english_text}`).join("\n");
  const vocabList = vocab.map((v) => ({
    word: v.word,
    furigana: v.furigana,
    meaning: v.english_meaning,
    pos: v.part_of_speech,
  }));

  if (vocabList.length < 3) {
    return NextResponse.json({ error: "Not enough vocabulary to generate quiz" }, { status: 400 });
  }

  try {
    const questions = await generateQuizQuestions(lyricsContext, vocabList, language);
    await run(
      "INSERT INTO quizzes (lesson_id, questions) VALUES (?, ?) ON CONFLICT(lesson_id) DO UPDATE SET questions = excluded.questions, generated_at = datetime('now')",
      [lessonId, JSON.stringify(questions)]
    );
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}
