import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word") || "";
  const exclude = req.nextUrl.searchParams.get("exclude") || "";
  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  let rows;
  if (exclude) {
    rows = await query(
      `SELECT sb.japanese_text, sb.english_text, sb.youtube_id, sb.start_time, sb.end_time, sb.song_title,
              COALESCE(s.sync_offset, 0) AS sync_offset
       FROM sentence_bank sb
       LEFT JOIN songs s ON s.youtube_id = sb.youtube_id
       WHERE EXISTS (SELECT 1 FROM json_each(sb.words) WHERE value = ?)
         AND sb.japanese_text != ?
       LIMIT 10`,
      [word, exclude]
    );
  } else {
    rows = await query(
      `SELECT sb.japanese_text, sb.english_text, sb.youtube_id, sb.start_time, sb.end_time, sb.song_title,
              COALESCE(s.sync_offset, 0) AS sync_offset
       FROM sentence_bank sb
       LEFT JOIN songs s ON s.youtube_id = sb.youtube_id
       WHERE EXISTS (SELECT 1 FROM json_each(sb.words) WHERE value = ?)
       LIMIT 10`,
      [word]
    );
  }

  return NextResponse.json(rows);
}
