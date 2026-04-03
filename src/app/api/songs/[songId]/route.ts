import { NextRequest, NextResponse } from "next/server";
import { queryOne, run } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const { artist } = await req.json();
  await run("UPDATE songs SET artist = ? WHERE id = ?", [artist, songId]);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const song = await queryOne<{ youtube_id: string }>("SELECT youtube_id FROM songs WHERE id = ?", [songId]);
  await run("DELETE FROM songs WHERE id = ?", [songId]);
  if (song) {
    await run("DELETE FROM sentence_bank WHERE youtube_id = ?", [song.youtube_id]);
  }
  return NextResponse.json({ success: true });
}
