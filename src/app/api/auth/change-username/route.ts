import { NextRequest, NextResponse } from "next/server";
import { queryOne, run } from "@/lib/db";
import { getSession, setSessionCookie, validateUsername, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { username, password } = await req.json().catch(() => ({}));

  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }
  if (typeof password !== "string") {
    return NextResponse.json({ error: "Your current password is required." }, { status: 400 });
  }

  const user = await queryOne<{ username: string; password_hash: string }>(
    "SELECT username, password_hash FROM users WHERE id = ?",
    [session.uid]
  );
  if (!user) {
    return NextResponse.json({ error: "No account to update." }, { status: 404 });
  }

  if (!verifyPassword(password, user.password_hash)) {
    await new Promise((r) => setTimeout(r, 250)); // same brute-force speed bump as login
    return NextResponse.json({ error: "Password is incorrect." }, { status: 403 });
  }

  if (username === user.username) {
    return NextResponse.json({ error: "That is already your username." }, { status: 400 });
  }

  // Case-insensitive uniqueness, excluding the caller's own row.
  const taken = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE lower(username) = lower(?) AND id <> ?",
    [username, session.uid]
  );
  if (taken) {
    return NextResponse.json({ error: "That username is taken." }, { status: 409 });
  }

  await run("UPDATE users SET username = ? WHERE id = ?", [username, session.uid]);

  // The session JWT embeds the username — re-issue it so the header and later
  // requests show the new name without forcing a re-login.
  await setSessionCookie({ ...session, username });

  return NextResponse.json({ username });
}
