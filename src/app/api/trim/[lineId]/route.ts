import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { requireSongWriteByLine } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await params;
  const gate = await requireSongWriteByLine(lineId);
  if (gate instanceof NextResponse) return gate;

  const { trim } = await req.json();

  if (typeof trim !== "number" || trim < 0) {
    return NextResponse.json({ error: "Invalid trim value" }, { status: 400 });
  }

  await run("UPDATE lyric_lines SET trim = ? WHERE id = ?", [trim, lineId]);

  return NextResponse.json({ ok: true });
}
