import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET all dictionary entries (with optional search)
export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q") || "";
  const db = getDb();

  if (search) {
    const pattern = `%${search}%`;
    const data = db
      .prepare("SELECT * FROM dictionary WHERE word LIKE ? OR furigana LIKE ? OR english_meaning LIKE ? ORDER BY word ASC")
      .all(pattern, pattern, pattern);
    return NextResponse.json(data);
  }

  const data = db.prepare("SELECT * FROM dictionary ORDER BY word ASC").all();
  return NextResponse.json(data);
}

// PUT — update an existing entry
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { word, furigana, english_meaning, part_of_speech, grammar_notes } = body;

  const db = getDb();
  db.prepare("UPDATE dictionary SET furigana = ?, english_meaning = ?, part_of_speech = ?, grammar_notes = ? WHERE word = ?")
    .run(furigana, english_meaning, part_of_speech, grammar_notes, word);

  return NextResponse.json({ ok: true });
}

// DELETE — remove an entry
export async function DELETE(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word") || "";
  if (!word) return NextResponse.json({ error: "Missing word" }, { status: 400 });

  const db = getDb();
  db.prepare("DELETE FROM dictionary WHERE word = ?").run(word);

  return NextResponse.json({ ok: true });
}
