import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { run } from "@/lib/db";
import { requireSongWrite } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const gate = await requireSongWrite(songId);
  if (gate instanceof NextResponse) return gate;

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
  const gate = await requireSongWrite(songId);
  if (gate instanceof NextResponse) return gate;
  const { song } = gate;

  await run("DELETE FROM songs WHERE id = ?", [songId]);
  await run("DELETE FROM sentence_bank WHERE youtube_id = ?", [song.youtube_id]);
  try {
    revalidatePath("/grammar");
  } catch (err) {
    console.error("revalidatePath failed (non-fatal):", err);
  }
  return NextResponse.json({ success: true });
}
