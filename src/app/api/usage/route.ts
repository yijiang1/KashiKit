import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const all = await query<{ created_at: string; total_tokens: number }>(
    "SELECT created_at, prompt_tokens, completion_tokens, total_tokens, purpose FROM api_usage ORDER BY created_at DESC"
  );

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayRows = all.filter((r) => {
    const d = new Date(r.created_at);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return local === today;
  });

  return NextResponse.json({
    totalCalls: all.length,
    totalTokens: all.reduce((sum, r) => sum + r.total_tokens, 0),
    todayCalls: todayRows.length,
    todayTokens: todayRows.reduce((sum, r) => sum + r.total_tokens, 0),
  });
}
