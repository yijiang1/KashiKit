import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await params;
  const { trim } = await req.json();

  if (typeof trim !== "number" || trim < 0) {
    return NextResponse.json({ error: "Invalid trim value" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE lyric_lines SET trim = ? WHERE id = ?").run(trim, lineId);

  return NextResponse.json({ ok: true });
}
