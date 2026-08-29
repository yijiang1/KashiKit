import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // quiz `questions` JSON embeds verbatim lyric fragments ("Complete the
  // lyric: …"). Gated: nothing lyric-derived to unauthenticated callers.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const lessonId = req.nextUrl.searchParams.get("lessonId");
  if (!lessonId) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 });
  }

  const row = await queryOne<{ questions: string }>(
    "SELECT questions FROM quizzes WHERE lesson_id = ?",
    [lessonId]
  );

  if (!row) {
    return NextResponse.json({ error: "No quiz found for this lesson" }, { status: 404 });
  }

  try {
    const questions = JSON.parse(row.questions);
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ error: "Quiz data corrupted" }, { status: 500 });
  }
}
