import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q") || "";
  const levelParam = req.nextUrl.searchParams.get("level") || "";

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push("(d.word LIKE ? OR d.furigana LIKE ? OR d.english_meaning LIKE ?)");
    args.push(pattern, pattern, pattern);
  }

  if (levelParam === "unclassified") {
    conditions.push("j.word IS NULL");
  } else if (levelParam) {
    const n = parseInt(levelParam);
    if (n >= 1 && n <= 5) {
      conditions.push("j.level = ?");
      args.push(n);
    }
  }

  const posParam = req.nextUrl.searchParams.get("pos") || "";
  if (posParam) {
    conditions.push("d.part_of_speech = ?");
    args.push(posParam);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const data = await query(
    `SELECT d.*, j.level AS jlpt_level
     FROM dictionary d
     LEFT JOIN jlpt_words j ON j.word = d.word
     ${where}
     ORDER BY d.word ASC`,
    args
  );
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
