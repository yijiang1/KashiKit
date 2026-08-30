import { NextRequest, NextResponse } from "next/server";
import { queryOne, run } from "@/lib/db";
import {
  getSession,
  hashPassword,
  setSessionCookie,
  validatePassword,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json(
      { error: "Current and new password are required." },
      { status: 400 }
    );
  }

  const user = await queryOne<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ?",
    [session.uid]
  );
  if (!user) {
    // A valid JWT with no matching row — e.g. an ADMIN_MODE session.
    return NextResponse.json({ error: "No account to update." }, { status: 404 });
  }

  if (!verifyPassword(currentPassword, user.password_hash)) {
    await new Promise((r) => setTimeout(r, 250)); // same brute-force speed bump as login
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }
  if (verifyPassword(newPassword, user.password_hash)) {
    return NextResponse.json(
      { error: "New password must be different from the current one." },
      { status: 400 }
    );
  }

  await run("UPDATE users SET password_hash = ? WHERE id = ?", [
    hashPassword(newPassword),
    session.uid,
  ]);

  // Re-issue this session so its 30-day clock restarts after the change. Note:
  // other existing sessions (other devices) stay valid until they expire —
  // stateless JWTs have no server-side revocation.
  await setSessionCookie(session);

  return NextResponse.json({ ok: true });
}
