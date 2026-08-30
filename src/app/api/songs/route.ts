import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession, isSiteAdmin, ENV_ADMIN } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session && !ENV_ADMIN) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Non-admins only see the songs they imported; admins see everything.
  const admin = isSiteAdmin(session);
  const songs = admin
    ? await query("SELECT * FROM songs ORDER BY created_at DESC")
    : await query("SELECT * FROM songs WHERE user_id = ? ORDER BY created_at DESC", [
        session?.uid ?? "__none__",
      ]);
  return NextResponse.json(songs);
}
