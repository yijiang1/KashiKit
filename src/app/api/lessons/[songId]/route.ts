import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const lessons = await query(
    "SELECT * FROM lessons WHERE song_id = ? ORDER BY day_number ASC",
    [songId]
  );
  return NextResponse.json(lessons);
}
