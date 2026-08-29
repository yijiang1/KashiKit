import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { run, uuid, queryOne } from "@/lib/db";
import { getSession, canManageSong, ENV_ADMIN } from "@/lib/auth";
import { parseLRC, parseLRCLine, distributeLines } from "@/lib/lrc/parser";
import { analyzeSong, assessDifficulty } from "@/lib/ai/pipeline";
import { generateQuizQuestions } from "@/lib/ai/quiz";
import { extractYouTubeId } from "@/lib/youtube/loader";
import { isLanguageId, DEFAULT_LANGUAGE } from "@/lib/languages";
import type { ImportPayload } from "@/types";

// Allow up to 5 minutes for the AI pipeline on serverless
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session && !ENV_ADMIN) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body: ImportPayload = await req.json();
  const { youtubeUrl, lrcContent, title, title_en, artist, dayCount, translations } = body;
  const language = isLanguageId(body.language) ? body.language : DEFAULT_LANGUAGE;

  const youtubeId = extractYouTubeId(youtubeUrl);
  if (!youtubeId) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  // One song per video (youtube_id is UNIQUE). A re-import may only replace a
  // song you already own (or an unowned legacy one, or if you're an admin).
  const existing = await queryOne<{ id: string; user_id: string | null }>(
    "SELECT id, user_id FROM songs WHERE youtube_id = ?",
    [youtubeId]
  );
  if (existing && !canManageSong(session, existing)) {
    return NextResponse.json(
      { error: "This video has already been imported by another user." },
      { status: 409 }
    );
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

  // YouTube EN captions arrive parallel to the raw LRC lines (see fetch-transcript).
  // Key them by timestamp so they survive parseLRC's filtering and sorting.
  const captionByTime = new Map<number, string>();
  if (translations && translations.length > 0) {
    lrcContent.split("\n").forEach((rawLine, i) => {
      const parsed = parseLRCLine(rawLine);
      const en = translations[i]?.trim();
      if (parsed && en) captionByTime.set(parsed.timestamp, en);
    });
  }

  // Analyze the whole song up front, in batched calls with full-song context.
  // All the slow AI work happens before any DB writes, so a timeout or crash
  // here leaves the previous import untouched.
  const { results: aiResults, failedIndices } = await analyzeSong(parsedLines.map((l) => l.japanese_text), language);

  // Remove any existing song with the same video (handles failed partial imports)
  await run("DELETE FROM songs WHERE youtube_id = ?", [youtubeId]);

  const songId = uuid();
  await run("INSERT INTO songs (id, title, title_en, artist, youtube_id, total_days, language, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    songId, title, title_en ?? null, artist ?? "", youtubeId, chunks.length, language, session?.uid ?? null,
  ]);

  // Accumulate all lyrics and vocab across days for difficulty assessment
  const allLyrics: string[] = [];
  const allVocab: { word: string; pos: string }[] = [];
  let lineOffset = 0;

  for (let dayIndex = 0; dayIndex < chunks.length; dayIndex++) {
    const chunk = chunks[dayIndex];

    const lessonId = uuid();
    await run("INSERT INTO lessons (id, song_id, day_number) VALUES (?, ?, ?)", [
      lessonId, songId, dayIndex + 1,
    ]);

    // Collect data for quiz generation
    const lyricsForQuiz: string[] = [];
    const vocabForQuiz: { word: string; furigana: string; meaning: string; pos: string }[] = [];

    for (let lineIndex = 0; lineIndex < chunk.length; lineIndex++) {
      const line = chunk[lineIndex];
      const ai = aiResults[lineOffset + lineIndex];

      const lineId = uuid();
      // Official YouTube EN caption wins for the natural translation;
      // fall back to the AI's natural rendering. Literal stays AI-generated.
      const naturalTranslation = captionByTime.get(line.start_time) || ai.line_analysis?.natural_translation || "";
      await run(
        "INSERT INTO lyric_lines (id, lesson_id, start_time, end_time, japanese_text, english_text, natural_translation) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [lineId, lessonId, line.start_time, line.end_time, line.japanese_text, ai.line_analysis?.literal_translation || "", naturalTranslation]
      );

      lyricsForQuiz.push(`${line.japanese_text} → ${ai.line_analysis?.literal_translation || ""}`);
      allLyrics.push(line.japanese_text);

      if (ai.vocabulary.length > 0) {
        for (const v of ai.vocabulary) {
          const levelRow = await queryOne<{ level: number }>(
            "SELECT level FROM jlpt_words WHERE language = ? AND (word = ? OR reading = ?) LIMIT 1",
            [language, v.word ?? "", v.furigana ?? ""]
          );
          await run(
            "INSERT INTO vocabulary (id, lyric_line_id, word, furigana, english_meaning, grammar_notes, part_of_speech, example_sentence, example_sentence_english, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              uuid(), lineId,
              v.word ?? "", v.furigana ?? "", v.english_meaning ?? "",
              v.grammar_notes ?? "", v.part_of_speech ?? "",
              v.example_sentence ?? "", v.example_sentence_english ?? "",
              levelRow?.level ?? null,
            ]
          );
          if (v.word) {
            vocabForQuiz.push({
              word: v.word,
              furigana: v.furigana ?? "",
              meaning: v.english_meaning ?? "",
              pos: v.part_of_speech ?? "",
            });
            allVocab.push({ word: v.word, pos: v.part_of_speech ?? "" });
          }
        }

        for (const gp of ai.grammar_points ?? []) {
          if (!gp.structure) continue;
          await run(
            "INSERT INTO grammar_points (id, lyric_line_id, structure, explanation, example_sentence_jp, example_sentence_en) VALUES (?, ?, ?, ?, ?, ?)",
            [uuid(), lineId, gp.structure, gp.explanation ?? "", gp.example_sentence_jp ?? "", gp.example_sentence_en ?? ""]
          );
        }

        const vocabWords = ai.vocabulary.map((v) => v.word).filter(Boolean);
        await run(
          `INSERT INTO sentence_bank (id, japanese_text, english_text, youtube_id, start_time, end_time, song_title, words, language)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(youtube_id, start_time) DO UPDATE SET
             japanese_text = excluded.japanese_text,
             english_text = excluded.english_text,
             song_title = excluded.song_title,
             words = excluded.words`,
          [uuid(), line.japanese_text, ai.line_analysis?.literal_translation || "", youtubeId, line.start_time, line.end_time, title, JSON.stringify(vocabWords), language]
        );
      } else {
        await run(
          `INSERT INTO sentence_bank (id, japanese_text, english_text, youtube_id, start_time, end_time, song_title, words, language)
           VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?)
           ON CONFLICT(youtube_id, start_time) DO UPDATE SET
             japanese_text = excluded.japanese_text,
             english_text = excluded.english_text,
             song_title = excluded.song_title,
             words = excluded.words`,
          [uuid(), line.japanese_text, ai.line_analysis?.literal_translation || "", youtubeId, line.start_time, line.end_time, title, language]
        );
      }
    }

    // Generate and store quiz for this lesson
    try {
      if (vocabForQuiz.length >= 3) {
        const questions = await generateQuizQuestions(lyricsForQuiz.join("\n"), vocabForQuiz, language);
        await run(
          "INSERT INTO quizzes (lesson_id, questions) VALUES (?, ?) ON CONFLICT(lesson_id) DO UPDATE SET questions = excluded.questions, generated_at = datetime('now')",
          [lessonId, JSON.stringify(questions)]
        );
      }
    } catch {
      // Don't fail the whole import if quiz generation fails
    }

    lineOffset += chunk.length;
  }

  // Assess difficulty using AI
  try {
    const { difficulty, reason } = await assessDifficulty(allLyrics, allVocab, language);
    await run("UPDATE songs SET difficulty = ?, difficulty_reason = ? WHERE id = ?", [difficulty, reason, songId]);
  } catch {
    // Don't fail import if difficulty assessment fails
  }

  try {
    revalidatePath("/grammar");
  } catch (err) {
    console.error("revalidatePath failed (non-fatal):", err);
  }

  return NextResponse.json({
    songId,
    // Lines whose AI analysis failed even after retries — stored without
    // translation/vocab so the user can fix them in the lyrics editor.
    failedLines: failedIndices.map((i) => parsedLines[i].japanese_text),
  });
}
