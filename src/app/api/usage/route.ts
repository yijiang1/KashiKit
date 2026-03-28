import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const all = db
    .prepare("SELECT created_at, prompt_tokens, completion_tokens, total_tokens, purpose FROM api_usage ORDER BY created_at DESC")
    .all() as { created_at: string; total_tokens: number }[];

  const today = new Date().toISOString().slice(0, 10);
  const todayRows = all.filter((r) => r.created_at.slice(0, 10) === today);

  return NextResponse.json({
    totalCalls: all.length,
    totalTokens: all.reduce((sum, r) => sum + r.total_tokens, 0),
    todayCalls: todayRows.length,
    todayTokens: todayRows.reduce((sum, r) => sum + r.total_tokens, 0),
  });
}
