import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q") || "";

  if (search) {
    const pattern = `%${search}%`;
    const data = await query(
      "SELECT * FROM dictionary WHERE word LIKE ? OR furigana LIKE ? OR english_meaning LIKE ? ORDER BY word ASC",
      [pattern, pattern, pattern]
    );
    return NextResponse.json(data);
  }

  const data = await query("SELECT * FROM dictionary ORDER BY word ASC");
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { word, furigana, english_meaning, part_of_speech, grammar_notes } = body;

  await run(
    "UPDATE dictionary SET furigana = ?, english_meaning = ?, part_of_speech = ?, grammar_notes = ? WHERE word = ?",
    [furigana, english_meaning, part_of_speech, grammar_notes, word]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word") || "";
  if (!word) return NextResponse.json({ error: "Missing word" }, { status: 400 });

  await run("DELETE FROM dictionary WHERE word = ?", [word]);

  return NextResponse.json({ ok: true });
}
