import { NextRequest, NextResponse } from "next/server";
import { getDb, uuid } from "@/lib/db";
import { parseLRC, distributeLines } from "@/lib/lrc/parser";
import { analyzeAllLines } from "@/lib/ai/pipeline";
import { extractYouTubeId } from "@/lib/youtube/loader";
import type { ImportPayload } from "@/types";

// Allow up to 5 minutes for the AI pipeline on serverless
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body: ImportPayload = await req.json();
  const { youtubeUrl, lrcContent, title, dayCount, translations } = body;

  // Validate YouTube URL
  const youtubeId = extractYouTubeId(youtubeUrl);
  if (!youtubeId) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  // Parse LRC
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

  // Distribute lines across days
  const chunks = distributeLines(parsedLines, dayCount);

  const db = getDb();

  // Remove any existing song with the same video (handles failed partial imports)
  db.prepare("DELETE FROM songs WHERE youtube_id = ?").run(youtubeId);

  // Insert song row
  const songId = uuid();
  db.prepare("INSERT INTO songs (id, title, youtube_id, total_days) VALUES (?, ?, ?, ?)")
    .run(songId, title, youtubeId, chunks.length);

  // Process each day chunk
  for (let dayIndex = 0; dayIndex < chunks.length; dayIndex++) {
    const chunk = chunks[dayIndex];

    // Create lesson
    const lessonId = uuid();
    db.prepare("INSERT INTO lessons (id, song_id, day_number) VALUES (?, ?, ?)")
      .run(lessonId, songId, dayIndex + 1);

    // Analyze all lines in this chunk with Gemini
    const aiResults = await analyzeAllLines(chunk);

    // Insert lyric lines + vocabulary
    for (let lineIndex = 0; lineIndex < chunk.length; lineIndex++) {
      const line = chunk[lineIndex];
      const ai = aiResults[lineIndex];

      const lineId = uuid();
      db.prepare("INSERT INTO lyric_lines (id, lesson_id, start_time, end_time, japanese_text, english_text) VALUES (?, ?, ?, ?, ?, ?)")
        .run(lineId, lessonId, line.start_time, line.end_time, line.japanese_text, ai.english || "");

      // Bulk insert vocabulary for this line
      if (ai.vocabulary.length > 0) {
        const insertVocab = db.prepare(
          "INSERT INTO vocabulary (id, lyric_line_id, word, furigana, english_meaning, grammar_notes, part_of_speech, example_sentence, example_sentence_english) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );

        const vocabWords: string[] = [];
        for (const v of ai.vocabulary) {
          insertVocab.run(
            uuid(), lineId,
            v.word ?? "", v.furigana ?? "", v.english_meaning ?? "",
            v.grammar_notes ?? "", v.part_of_speech ?? "",
            v.example_sentence ?? "", v.example_sentence_english ?? ""
          );
          if (v.word) vocabWords.push(v.word);
        }

        // Save to sentence bank
        db.prepare(`
          INSERT INTO sentence_bank (id, japanese_text, english_text, youtube_id, start_time, end_time, song_title, words)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(youtube_id, start_time) DO UPDATE SET
            japanese_text = excluded.japanese_text,
            english_text = excluded.english_text,
            song_title = excluded.song_title,
            words = excluded.words
        `).run(uuid(), line.japanese_text, ai.english || "", youtubeId, line.start_time, line.end_time, title, JSON.stringify(vocabWords));
      } else {
        // Even lines without vocab go into the sentence bank
        db.prepare(`
          INSERT INTO sentence_bank (id, japanese_text, english_text, youtube_id, start_time, end_time, song_title, words)
          VALUES (?, ?, ?, ?, ?, ?, ?, '[]')
          ON CONFLICT(youtube_id, start_time) DO UPDATE SET
            japanese_text = excluded.japanese_text,
            english_text = excluded.english_text,
            song_title = excluded.song_title,
            words = excluded.words
        `).run(uuid(), line.japanese_text, ai.english || "", youtubeId, line.start_time, line.end_time, title);
      }
    }
  }

  return NextResponse.json({ songId });
}
