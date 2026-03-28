import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const days = [...new Set(dates.map((d) => d.slice(0, 10)))].sort().reverse();

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function GET() {
  const db = getDb();

  const completions = db
    .prepare("SELECT completed_at, lesson_id FROM lesson_completions")
    .all() as { completed_at: string; lesson_id: string }[];

  if (completions.length === 0) return NextResponse.json({ streak: 0, today: 0, total: 0, lessonIds: [] });

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = completions.filter((c) => c.completed_at.slice(0, 10) === today).length;
  const streak = calcStreak(completions.map((c) => c.completed_at));
  const completedLessonIds = [...new Set(completions.map((c) => c.lesson_id))];

  return NextResponse.json({
    streak,
    today: todayCount,
    total: completions.length,
    lessonIds: completedLessonIds,
  });
}
