import { NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { generateQuizQuestions } from "@/lib/ai/quiz";
import { isAdmin } from "@/lib/admin";

export const maxDuration = 300;

export async function POST() {
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lessons = await query<{ id: string }>(
    "SELECT id FROM lessons WHERE id NOT IN (SELECT lesson_id FROM quizzes)"
  );

  let generated = 0;
  let skipped = 0;

  for (const lesson of lessons) {
    const lines = await query<{ japanese_text: string; english_text: string; id: string }>(
      "SELECT japanese_text, english_text, id FROM lyric_lines WHERE lesson_id = ? ORDER BY start_time ASC",
      [lesson.id]
    );

    const lineIds = lines.map((l) => l.id);
    if (lineIds.length === 0) { skipped++; continue; }

    const vocab = await query<{ word: string; furigana: string; english_meaning: string; part_of_speech: string }>(
      `SELECT word, furigana, english_meaning, part_of_speech FROM vocabulary WHERE lyric_line_id IN (${lineIds.map(() => "?").join(",")})`,
      lineIds
    );

    if (vocab.length < 3) { skipped++; continue; }

    const lyricsContext = lines.map((l) => `${l.japanese_text} → ${l.english_text}`).join("\n");
    const vocabList = vocab.map((v) => ({
      word: v.word,
      furigana: v.furigana,
      meaning: v.english_meaning,
      pos: v.part_of_speech,
    }));

    try {
      const questions = await generateQuizQuestions(lyricsContext, vocabList);
      await run(
        "INSERT INTO quizzes (lesson_id, questions) VALUES (?, ?) ON CONFLICT(lesson_id) DO UPDATE SET questions = excluded.questions, generated_at = datetime('now')",
        [lesson.id, JSON.stringify(questions)]
      );
      generated++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ generated, skipped });
}
