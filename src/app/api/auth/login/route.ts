import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { authConfigured, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Login is not configured on this server (AUTH_SECRET is missing)." },
      { status: 503 }
    );
  }

  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const user = await queryOne<{ id: string; username: string; password_hash: string; is_admin: number }>(
    "SELECT id, username, password_hash, is_admin FROM users WHERE lower(username) = lower(?)",
    [username]
  );

  if (!user || !verifyPassword(password, user.password_hash)) {
    // Blunt brute-forcing a little without a full rate limiter.
    await new Promise((r) => setTimeout(r, 250));
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await setSessionCookie({ uid: user.id, username: user.username, admin: user.is_admin === 1 });
  return NextResponse.json({ username: user.username, admin: user.is_admin === 1 });
}
