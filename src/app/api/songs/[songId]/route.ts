import { NextRequest, NextResponse } from "next/server";
import { queryOne, run } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const body = await req.json();
  const fields: string[] = [];
  const values: (string | null)[] = [];
  if ("title" in body)    { fields.push("title = ?");    values.push(body.title ?? ""); }
  if ("title_en" in body) { fields.push("title_en = ?"); values.push(body.title_en || null); }
  if ("artist" in body)   { fields.push("artist = ?");   values.push(body.artist ?? ""); }
  if (fields.length === 0) return NextResponse.json({ success: true });
  await run(`UPDATE songs SET ${fields.join(", ")} WHERE id = ?`, [...values, songId]);
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
