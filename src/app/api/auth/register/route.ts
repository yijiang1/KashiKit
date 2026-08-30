import { NextRequest, NextResponse } from "next/server";
import { queryOne, run, uuid } from "@/lib/db";
import {
  authConfigured,
  hashPassword,
  setSessionCookie,
  validatePassword,
  validateUsername,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Login is not configured on this server (AUTH_SECRET is missing)." },
      { status: 503 }
    );
  }
  if (process.env.SIGNUPS_DISABLED === "true") {
    return NextResponse.json({ error: "New registrations are closed." }, { status: 403 });
  }

  const { username, password } = await req.json().catch(() => ({}));

  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE lower(username) = lower(?)",
    [username]
  );
  if (existing) {
    return NextResponse.json({ error: "That username is taken." }, { status: 409 });
  }

  // The very first account to register becomes an admin, so a fresh deployment
  // has someone who can reach the global tools without shell access.
  const count = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users", []);
  const isAdmin = (count?.n ?? 0) === 0;

  const id = uuid();
  await run(
    "INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, ?)",
    [id, username, hashPassword(password), isAdmin ? 1 : 0]
  );

  await setSessionCookie({ uid: id, username, admin: isAdmin });
  return NextResponse.json({ username, admin: isAdmin });
}
