import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
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
