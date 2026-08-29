import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  // Returns full lyric_lines rows (japanese_text, english_text,
  // natural_translation) + vocab. Gated: no copyrighted lyric text to
  // unauthenticated callers.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const { lessonId } = await params;

  const lines = await query<Record<string, unknown>>(
    "SELECT * FROM lyric_lines WHERE lesson_id = ? ORDER BY start_time ASC",
    [lessonId]
  );

  const vocab = await query<Record<string, unknown>>(
    "SELECT * FROM vocabulary WHERE lyric_line_id IN (SELECT id FROM lyric_lines WHERE lesson_id = ?)",
    [lessonId]
  );

  const vocabByLine = new Map<string, Record<string, unknown>[]>();
  for (const v of vocab) {
    const lineId = v.lyric_line_id as string;
    if (!vocabByLine.has(lineId)) vocabByLine.set(lineId, []);
    vocabByLine.get(lineId)!.push(v);
  }

  const result = lines.map((line) => ({
    ...line,
    vocabulary: vocabByLine.get(line.id as string) ?? [],
  }));

  return NextResponse.json(result);
}
