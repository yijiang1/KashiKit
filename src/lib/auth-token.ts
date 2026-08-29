// Pure session-token helpers — no `next/headers`, no DB, no `node:crypto`.
// Safe to import from `src/proxy.ts` (middleware / Edge runtime). Anything that
// touches cookies, the database, or password hashing lives in `src/lib/auth.ts`.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "kk_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

export type SessionUser = { uid: string; username: string; admin: boolean };

function getSecret(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

/** True when AUTH_SECRET is configured well enough for logins to work. */
export function authConfigured(): boolean {
  return getSecret() !== null;
}

export async function signSession(user: SessionUser): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set (needs a random string of 16+ characters). User login is disabled until it is configured."
    );
  }
  return new SignJWT({ username: user.username, admin: user.admin })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.uid)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionUser | null> {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== "string" || typeof payload.username !== "string") return null;
    return { uid: payload.sub, username: payload.username, admin: payload.admin === true };
  } catch {
    return null;
  }
}
