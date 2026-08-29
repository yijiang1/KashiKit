import { NextRequest, NextResponse } from "next/server";
import { query, run, uuid } from "@/lib/db";
import { requireSongWrite } from "@/lib/auth";
import type { Lesson } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const gate = await requireSongWrite(songId);
  if (gate instanceof NextResponse) return gate;

  const lessons = await query<Lesson>(
    "SELECT * FROM lessons WHERE song_id = ? ORDER BY day_number DESC LIMIT 1",
    [songId]
  );

  const nextDay = lessons.length > 0 ? lessons[0].day_number + 1 : 1;
  const newId = uuid();

  await run("INSERT INTO lessons (id, song_id, day_number) VALUES (?, ?, ?)", [newId, songId, nextDay]);
  await run("UPDATE songs SET total_days = ? WHERE id = ?", [nextDay, songId]);

  return NextResponse.json({ id: newId, song_id: songId, day_number: nextDay });
}
