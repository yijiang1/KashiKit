import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSongView } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  // Signed-in, and (for non-admins) the song's owner.
  const gate = await requireSongView(songId);
  if (gate instanceof NextResponse) return gate;

  const lessons = await query(
    "SELECT * FROM lessons WHERE song_id = ? ORDER BY day_number ASC",
    [songId]
  );
  return NextResponse.json(lessons);
}
