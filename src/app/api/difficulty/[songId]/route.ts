import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const { difficulty } = await req.json();

  if (difficulty !== null && (typeof difficulty !== "number" || difficulty < 1 || difficulty > 5 || !Number.isInteger(difficulty))) {
    return NextResponse.json({ error: "Difficulty must be null or an integer 1-5" }, { status: 400 });
  }

  await run("UPDATE songs SET difficulty = ?, difficulty_reason = NULL WHERE id = ?", [difficulty, songId]);

  return NextResponse.json({ ok: true });
}
