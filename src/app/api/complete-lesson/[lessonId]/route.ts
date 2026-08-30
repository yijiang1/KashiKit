import { NextRequest, NextResponse } from "next/server";
import { run, uuid } from "@/lib/db";
import { requireSongViewByLesson } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  // Signed-in, and (for non-admins) the owner of the song this lesson belongs to.
  const gate = await requireSongViewByLesson(lessonId);
  if (gate instanceof NextResponse) return gate;

  await run("INSERT INTO lesson_completions (id, lesson_id) VALUES (?, ?)", [uuid(), lessonId]);
  return NextResponse.json({ success: true });
}
