import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const db = getDb();

  const lines = db
    .prepare("SELECT * FROM lyric_lines WHERE lesson_id = ? ORDER BY start_time ASC")
    .all(lessonId) as Record<string, unknown>[];

  const vocab = db
    .prepare("SELECT * FROM vocabulary WHERE lyric_line_id IN (SELECT id FROM lyric_lines WHERE lesson_id = ?)")
    .all(lessonId) as Record<string, unknown>[];

  // Group vocabulary by lyric_line_id
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
