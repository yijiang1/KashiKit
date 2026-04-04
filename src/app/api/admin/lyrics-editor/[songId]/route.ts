import { NextRequest, NextResponse } from "next/server";
import type { InValue } from "@libsql/client";
import { revalidatePath } from "next/cache";
import { query, queryOne, getDb, run, uuid } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import type { Song, Lesson, EditorSavePayload } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { songId } = await params;

  const song = await queryOne<Song>("SELECT * FROM songs WHERE id = ?", [songId]);
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  const lessons = await query<Lesson>(
    "SELECT * FROM lessons WHERE song_id = ? ORDER BY day_number ASC",
    [songId]
  );

  const lines = await query<Record<string, unknown>>(
    `SELECT ll.* FROM lyric_lines ll
     JOIN lessons l ON ll.lesson_id = l.id
     WHERE l.song_id = ?
     ORDER BY ll.start_time ASC`,
    [songId]
  );

  const vocab = await query<Record<string, unknown>>(
    `SELECT v.* FROM vocabulary v
     JOIN lyric_lines ll ON v.lyric_line_id = ll.id
     JOIN lessons l ON ll.lesson_id = l.id
     WHERE l.song_id = ?`,
    [songId]
  );

  // Group vocab by line
  const vocabByLine = new Map<string, Record<string, unknown>[]>();
  for (const v of vocab) {
    const lineId = v.lyric_line_id as string;
    if (!vocabByLine.has(lineId)) vocabByLine.set(lineId, []);
    vocabByLine.get(lineId)!.push(v);
  }

  // Group lines by lesson
  const linesByLesson = new Map<string, Record<string, unknown>[]>();
  for (const line of lines) {
    const lessonId = line.lesson_id as string;
    if (!linesByLesson.has(lessonId)) linesByLesson.set(lessonId, []);
    linesByLesson.get(lessonId)!.push({
      ...line,
      vocabulary: vocabByLine.get(line.id as string) ?? [],
    });
  }

  const result = {
    song,
    lessons: lessons.map((lesson) => ({
      ...lesson,
      lines: linesByLesson.get(lesson.id) ?? [],
    })),
  };

  return NextResponse.json(result);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { songId } = await params;
  const body: EditorSavePayload = await req.json();
  const { updates, deletes, additions } = body;

  const song = await queryOne<Song>("SELECT * FROM songs WHERE id = ?", [songId]);
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });

  const db = await getDb();

  // Use a batch transaction for atomicity
  const stmts: Array<{ sql: string; args: InValue[] }> = [];

  // 1. Process deletes
  for (const lineId of deletes) {
    stmts.push({
      sql: "DELETE FROM lyric_lines WHERE id = ?",
      args: [lineId],
    });
  }

  // 2. Process updates
  for (const u of updates) {
    const sets: string[] = [];
    const args: InValue[] = [];
    if (u.japanese_text !== undefined) { sets.push("japanese_text = ?"); args.push(u.japanese_text); }
    if (u.english_text !== undefined) { sets.push("english_text = ?"); args.push(u.english_text); }
    if (u.start_time !== undefined) { sets.push("start_time = ?"); args.push(u.start_time); }
    if (u.end_time !== undefined) { sets.push("end_time = ?"); args.push(u.end_time); }
    if (u.lesson_id !== undefined) { sets.push("lesson_id = ?"); args.push(u.lesson_id); }
    if (sets.length > 0) {
      stmts.push({
        sql: `UPDATE lyric_lines SET ${sets.join(", ")} WHERE id = ?`,
        args: [...args, u.id],
      });
    }
  }

  // 3. Process additions
  for (const a of additions) {
    stmts.push({
      sql: "INSERT INTO lyric_lines (id, lesson_id, start_time, end_time, japanese_text, english_text) VALUES (?, ?, ?, ?, ?, ?)",
      args: [a.id, a.lesson_id, a.start_time, a.end_time, a.japanese_text, a.english_text],
    });
  }

  // Execute all mutations in a batch
  if (stmts.length > 0) {
    await db.batch(stmts, "write");
  }

  // 4. Rebuild sentence_bank (non-fatal — lyric_lines are already committed)
  try {
    await rebuildSentenceBank(song.youtube_id, song.title, songId);
  } catch (err) {
    console.error("rebuildSentenceBank failed (non-fatal):", err);
  }

  // 5. Invalidate cached study pages for this song
  try {
    for (let day = 1; day <= song.total_days; day++) {
      revalidatePath(`/study/${songId}/${day}`);
    }
  } catch (err) {
    console.error("revalidatePath failed (non-fatal):", err);
  }

  return NextResponse.json({ ok: true });
}

async function rebuildSentenceBank(youtubeId: string, songTitle: string, songId: string) {
  // Delete all existing sentence_bank entries for this song
  await run("DELETE FROM sentence_bank WHERE youtube_id = ?", [youtubeId]);

  // Re-insert from current lyric_lines + vocabulary
  const lines = await query<Record<string, unknown>>(
    `SELECT ll.id, ll.japanese_text, ll.english_text, ll.start_time, ll.end_time
     FROM lyric_lines ll
     JOIN lessons l ON ll.lesson_id = l.id
     WHERE l.song_id = ?
     ORDER BY ll.start_time ASC`,
    [songId]
  );

  for (const line of lines) {
    const vocabWords = await query<{ word: string }>(
      "SELECT word FROM vocabulary WHERE lyric_line_id = ?",
      [line.id as string]
    );
    const words = vocabWords.map((v) => v.word).filter(Boolean);

    await run(
      `INSERT INTO sentence_bank (id, japanese_text, english_text, youtube_id, start_time, end_time, song_title, words)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(youtube_id, start_time) DO UPDATE SET
         japanese_text = excluded.japanese_text,
         english_text = excluded.english_text,
         song_title = excluded.song_title,
         words = excluded.words`,
      [
        uuid(),
        line.japanese_text as string,
        line.english_text as string,
        youtubeId,
        line.start_time as number,
        line.end_time as number,
        songTitle,
        JSON.stringify(words),
      ]
    );
  }
}
