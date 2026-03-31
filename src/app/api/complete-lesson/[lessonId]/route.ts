import { NextRequest, NextResponse } from "next/server";
import { run, uuid } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  await run("INSERT INTO lesson_completions (id, lesson_id) VALUES (?, ?)", [uuid(), lessonId]);
  return NextResponse.json({ success: true });
}
