import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { isLanguageId, DEFAULT_LANGUAGE } from "@/lib/languages";

export async function GET(req: NextRequest) {
  // Returns verbatim sentence_bank lyric lines + translations. Gated: no
  // copyrighted lyric text to unauthenticated callers.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const word = req.nextUrl.searchParams.get("word") || "";
  const exclude = req.nextUrl.searchParams.get("exclude") || "";
  const langParam = req.nextUrl.searchParams.get("language");
  const language = isLanguageId(langParam) ? langParam : DEFAULT_LANGUAGE;
  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  let rows;
  if (exclude) {
    rows = await query(
      `SELECT japanese_text, english_text, youtube_id, start_time, end_time, song_title
       FROM sentence_bank
       WHERE language = ?
         AND EXISTS (SELECT 1 FROM json_each(words) WHERE value = ?)
         AND japanese_text != ?
       LIMIT 10`,
      [language, word, exclude]
    );
  } else {
    rows = await query(
      `SELECT japanese_text, english_text, youtube_id, start_time, end_time, song_title
       FROM sentence_bank
       WHERE language = ?
         AND EXISTS (SELECT 1 FROM json_each(words) WHERE value = ?)
       LIMIT 10`,
      [language, word]
    );
  }

  return NextResponse.json(rows);
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await run("DELETE FROM sentence_bank WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
