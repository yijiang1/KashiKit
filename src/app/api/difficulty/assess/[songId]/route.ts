import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { assessDifficulty } from "@/lib/ai/pipeline";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;

  // Gather all lyrics and vocabulary for this song
  const lines = await query<{ japanese_text: string }>(
    `SELECT ll.japanese_text
     FROM lyric_lines ll
     JOIN lessons l ON ll.lesson_id = l.id
     WHERE l.song_id = ?
     ORDER BY l.day_number, ll.start_time`,
    [songId]
  );

  const vocab = await query<{ word: string; part_of_speech: string }>(
    `SELECT DISTINCT v.word, v.part_of_speech
     FROM vocabulary v
     JOIN lyric_lines ll ON v.lyric_line_id = ll.id
     JOIN lessons l ON ll.lesson_id = l.id
     WHERE l.song_id = ?`,
    [songId]
  );

  if (lines.length === 0) {
    return NextResponse.json({ error: "No lyrics found for this song" }, { status: 404 });
  }

  const { difficulty, reason } = await assessDifficulty(
    lines.map((l) => l.japanese_text),
    vocab.map((v) => ({ word: v.word, pos: v.part_of_speech }))
  );

  await run("UPDATE songs SET difficulty = ?, difficulty_reason = ? WHERE id = ?", [difficulty, reason, songId]);

  return NextResponse.json({ difficulty, reason });
}
