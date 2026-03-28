import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const songs = db.prepare("SELECT * FROM songs ORDER BY created_at DESC").all();
  return NextResponse.json(songs);
}
