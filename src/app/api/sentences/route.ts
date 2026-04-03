import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";

export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word") || "";
  const exclude = req.nextUrl.searchParams.get("exclude") || "";
  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  let rows;
  if (exclude) {
    rows = await query(
      `SELECT japanese_text, english_text, youtube_id, start_time, end_time, song_title
       FROM sentence_bank
       WHERE EXISTS (SELECT 1 FROM json_each(words) WHERE value = ?)
         AND japanese_text != ?
       LIMIT 10`,
      [word, exclude]
    );
  } else {
    rows = await query(
      `SELECT japanese_text, english_text, youtube_id, start_time, end_time, song_title
       FROM sentence_bank
       WHERE EXISTS (SELECT 1 FROM json_each(words) WHERE value = ?)
       LIMIT 10`,
      [word]
    );
  }

  return NextResponse.json(rows);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await run("DELETE FROM sentence_bank WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
