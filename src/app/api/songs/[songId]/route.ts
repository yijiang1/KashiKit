import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const db = getDb();
  db.prepare("DELETE FROM songs WHERE id = ?").run(songId);
  return NextResponse.json({ success: true });
}
