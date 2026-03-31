import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const { sync_offset } = await req.json();

  if (typeof sync_offset !== "number") {
    return NextResponse.json({ error: "Invalid sync_offset" }, { status: 400 });
  }

  await run("UPDATE songs SET sync_offset = ? WHERE id = ?", [sync_offset, songId]);

  return NextResponse.json({ ok: true });
}
