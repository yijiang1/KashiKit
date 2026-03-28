import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const db = getDb();
  const lessons = db
    .prepare("SELECT * FROM lessons WHERE song_id = ? ORDER BY day_number ASC")
    .all(songId);
  return NextResponse.json(lessons);
}
