import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word") || "";
  const exclude = req.nextUrl.searchParams.get("exclude") || "";
  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  const db = getDb();

  // words is stored as JSON array in SQLite — use json_each to check membership
  let rows;
  if (exclude) {
    rows = db
      .prepare(`
        SELECT japanese_text, english_text, youtube_id, start_time, end_time, song_title
        FROM sentence_bank
        WHERE EXISTS (SELECT 1 FROM json_each(words) WHERE value = ?)
          AND japanese_text != ?
        LIMIT 10
      `)
      .all(word, exclude);
  } else {
    rows = db
      .prepare(`
        SELECT japanese_text, english_text, youtube_id, start_time, end_time, song_title
        FROM sentence_bank
        WHERE EXISTS (SELECT 1 FROM json_each(words) WHERE value = ?)
        LIMIT 10
      `)
      .all(word);
  }

  return NextResponse.json(rows);
}
