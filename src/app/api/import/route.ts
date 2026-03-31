import { NextRequest, NextResponse } from "next/server";
import { run, uuid } from "@/lib/db";
import { parseLRC, distributeLines } from "@/lib/lrc/parser";
import { analyzeAllLines } from "@/lib/ai/pipeline";
import { generateQuizQuestions } from "@/lib/ai/quiz";
import { extractYouTubeId } from "@/lib/youtube/loader";
import type { ImportPayload } from "@/types";

// Allow up to 5 minutes for the AI pipeline on serverless
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body: ImportPayload = await req.json();
  const { youtubeUrl, lrcContent, title, dayCount, translations } = body;

  const youtubeId = extractYouTubeId(youtubeUrl);
  if (!youtubeId) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  const parsedLines = parseLRC(lrcContent);
  if (parsedLines.length === 0) {
    return NextResponse.json({ error: "No lyric lines found in LRC content" }, { status: 400 });
  }
  if (dayCount > parsedLines.length) {
    return NextResponse.json(
      { error: `Day count (${dayCount}) exceeds number of lyric lines (${parsedLines.length})` },
      { status: 400 }
    );
  }

  const chunks = distributeLines(parsedLines, dayCount);

  // Remove any existing song with the same video (handles failed partial imports)
  await run("DELETE FROM songs WHERE youtube_id = ?", [youtubeId]);

  const songId = uuid();
  await run("INSERT INTO songs (id, title, youtube_id, total_days) VALUES (?, ?, ?, ?)", [
    songId, title, youtubeId, chunks.length,
  ]);

  for (let dayIndex = 0; dayIndex < chunks.length; dayIndex++) {
    const chunk = chunks[dayIndex];

    const lessonId = uuid();
    await run("INSERT INTO lessons (id, song_id, day_number) VALUES (?, ?, ?)", [
      lessonId, songId, dayIndex + 1,
    ]);

    const aiResults = await analyzeAllLines(chunk);

    // Collect data for quiz generation
    const lyricsForQuiz: string[] = [];
    const vocabForQuiz: { word: string; furigana: string; meaning: string; pos: string }[] = [];

    for (let lineIndex = 0; lineIndex < chunk.length; lineIndex++) {
      const line = chunk[lineIndex];
      const ai = aiResults[lineIndex];

      const lineId = uuid();
      await run(
        "INSERT INTO lyric_lines (id, lesson_id, start_time, end_time, japanese_text, english_text) VALUES (?, ?, ?, ?, ?, ?)",
        [lineId, lessonId, line.start_time, line.end_time, line.japanese_text, ai.english || ""]
      );

      lyricsForQuiz.push(`${line.japanese_text} → ${ai.english || ""}`);

      if (ai.vocabulary.length > 0) {
        for (const v of ai.vocabulary) {
          await run(
            "INSERT INTO vocabulary (id, lyric_line_id, word, furigana, english_meaning, grammar_notes, part_of_speech, example_sentence, example_sentence_english) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              uuid(), lineId,
              v.word ?? "", v.furigana ?? "", v.english_meaning ?? "",
              v.grammar_notes ?? "", v.part_of_speech ?? "",
              v.example_sentence ?? "", v.example_sentence_english ?? "",
            ]
          );
          if (v.word) {
            vocabForQuiz.push({
              word: v.word,
              furigana: v.furigana ?? "",
              meaning: v.english_meaning ?? "",
              pos: v.part_of_speech ?? "",
            });
          }
        }

        const vocabWords = ai.vocabulary.map((v) => v.word).filter(Boolean);
        await run(
          `INSERT INTO sentence_bank (id, japanese_text, english_text, youtube_id, start_time, end_time, song_title, words)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(youtube_id, start_time) DO UPDATE SET
             japanese_text = excluded.japanese_text,
             english_text = excluded.english_text,
             song_title = excluded.song_title,
             words = excluded.words`,
          [uuid(), line.japanese_text, ai.english || "", youtubeId, line.start_time, line.end_time, title, JSON.stringify(vocabWords)]
        );
      } else {
        await run(
          `INSERT INTO sentence_bank (id, japanese_text, english_text, youtube_id, start_time, end_time, song_title, words)
           VALUES (?, ?, ?, ?, ?, ?, ?, '[]')
           ON CONFLICT(youtube_id, start_time) DO UPDATE SET
             japanese_text = excluded.japanese_text,
             english_text = excluded.english_text,
             song_title = excluded.song_title,
             words = excluded.words`,
          [uuid(), line.japanese_text, ai.english || "", youtubeId, line.start_time, line.end_time, title]
        );
      }
    }

    // Generate and store quiz for this lesson
    try {
      if (vocabForQuiz.length >= 3) {
        const questions = await generateQuizQuestions(lyricsForQuiz.join("\n"), vocabForQuiz);
        await run(
          "INSERT INTO quizzes (lesson_id, questions) VALUES (?, ?) ON CONFLICT(lesson_id) DO UPDATE SET questions = excluded.questions, generated_at = datetime('now')",
          [lessonId, JSON.stringify(questions)]
        );
      }
    } catch {
      // Don't fail the whole import if quiz generation fails
    }
  }

  return NextResponse.json({ songId });
}
