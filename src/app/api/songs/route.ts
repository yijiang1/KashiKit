import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const songs = await query("SELECT * FROM songs ORDER BY created_at DESC");
  return NextResponse.json(songs);
}
