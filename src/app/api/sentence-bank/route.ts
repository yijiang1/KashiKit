import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q") || "";
  const song = req.nextUrl.searchParams.get("song") || "";

  let sql = `
    SELECT sb.id, sb.japanese_text, sb.english_text, sb.song_title, sb.youtube_id, sb.start_time, sb.end_time, sb.words
    FROM sentence_bank sb
    WHERE 1=1
  `;
  const args: string[] = [];

  if (search) {
    sql += " AND (sb.japanese_text LIKE ? OR sb.english_text LIKE ?)";
    args.push(`%${search}%`, `%${search}%`);
  }
  if (song) {
    sql += " AND sb.song_title = ?";
    args.push(song);
  }

  sql += " ORDER BY sb.song_title ASC, sb.start_time ASC LIMIT 200";

  const rows = await query(sql, args);
  return NextResponse.json(rows);
}
