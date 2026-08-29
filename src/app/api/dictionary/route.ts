import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { isLanguageId, DEFAULT_LANGUAGE } from "@/lib/languages";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q") || "";
  const levelParam = req.nextUrl.searchParams.get("level") || "";
  const langParam = req.nextUrl.searchParams.get("language");
  const language = isLanguageId(langParam) ? langParam : DEFAULT_LANGUAGE;

  const conditions: string[] = ["d.language = ?"];
  const args: (string | number)[] = [language];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push("(d.word LIKE ? OR d.furigana LIKE ? OR d.english_meaning LIKE ?)");
    args.push(pattern, pattern, pattern);
  }

  if (levelParam === "unclassified") {
    conditions.push("j.word IS NULL");
  } else if (levelParam) {
    const n = parseInt(levelParam);
    if (n >= 1 && n <= 6) {
      conditions.push("j.level = ?");
      args.push(n);
    }
  }

  const posParam = req.nextUrl.searchParams.get("pos") || "";
  if (posParam) {
    conditions.push("d.part_of_speech = ?");
    args.push(posParam);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const data = await query(
    `SELECT d.*, j.level AS level
     FROM dictionary d
     LEFT JOIN jlpt_words j ON j.word = d.word AND j.language = d.language
     ${where}
     ORDER BY d.word ASC`,
    args
  );
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { word, furigana, english_meaning, part_of_speech, grammar_notes } = body;
  const language = isLanguageId(body.language) ? body.language : DEFAULT_LANGUAGE;

  await run(
    "UPDATE dictionary SET furigana = ?, english_meaning = ?, part_of_speech = ?, grammar_notes = ? WHERE word = ? AND language = ?",
    [furigana, english_meaning, part_of_speech, grammar_notes, word, language]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const word = req.nextUrl.searchParams.get("word") || "";
  const langParam = req.nextUrl.searchParams.get("language");
  const language = isLanguageId(langParam) ? langParam : DEFAULT_LANGUAGE;
  if (!word) return NextResponse.json({ error: "Missing word" }, { status: 400 });

  await run("DELETE FROM dictionary WHERE word = ? AND language = ?", [word, language]);

  return NextResponse.json({ ok: true });
}
