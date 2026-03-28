import { NextRequest, NextResponse } from "next/server";
import { getDb, uuid } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const db = getDb();
  db.prepare("INSERT INTO lesson_completions (id, lesson_id) VALUES (?, ?)").run(uuid(), lessonId);
  return NextResponse.json({ success: true });
}
