import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { requireSongWrite } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string; lessonId: string }> }
) {
  const { songId, lessonId } = await params;
  const gate = await requireSongWrite(songId);
  if (gate instanceof NextResponse) return gate;

  // Safety: refuse if lesson still has lines
  const lines = await query("SELECT id FROM lyric_lines WHERE lesson_id = ? LIMIT 1", [lessonId]);
  if (lines.length > 0) {
    return NextResponse.json({ error: "Lesson still has lines" }, { status: 400 });
  }

  await run("DELETE FROM lessons WHERE id = ? AND song_id = ?", [lessonId, songId]);

  // Update total_days to reflect new max
  const remaining = await query<{ day_number: number }>(
    "SELECT day_number FROM lessons WHERE song_id = ? ORDER BY day_number DESC LIMIT 1",
    [songId]
  );
  const newTotal = remaining.length > 0 ? remaining[0].day_number : 0;
  await run("UPDATE songs SET total_days = ? WHERE id = ?", [newTotal, songId]);

  return NextResponse.json({ ok: true, total_days: newTotal });
}
