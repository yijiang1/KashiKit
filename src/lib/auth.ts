// Server-only auth helpers: cookie handling, password hashing, session lookup,
// and route guards. Imports `next/headers` and the DB, so this must NEVER be
// imported from `src/proxy.ts` — use `src/lib/auth-token.ts` there instead.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { queryOne } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySessionToken,
  authConfigured,
  type SessionUser,
} from "@/lib/auth-token";
import type { Song } from "@/types";

export { SESSION_COOKIE, authConfigured, type SessionUser };

/** ADMIN_MODE env flag — a local "edit anything" bypass for the site owner. */
export const ENV_ADMIN = process.env.ADMIN_MODE === "true";

// ---------------------------------------------------------------------------
// Password hashing (scrypt, via node:crypto — no dependency)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---------------------------------------------------------------------------
// Credential validation — shared by register, change-username, change-password
// ---------------------------------------------------------------------------

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

/** Returns an error message, or null when the username is well-formed. */
export function validateUsername(username: unknown): string | null {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    return "Username must be 3–20 characters: letters, numbers, or underscore.";
  }
  return null;
}

/** Returns an error message, or null when the password meets the length rules. */
export function validatePassword(password: unknown): string | null {
  if (
    typeof password !== "string" ||
    password.length < PASSWORD_MIN ||
    password.length > PASSWORD_MAX
  ) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Session cookie
// ---------------------------------------------------------------------------

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSession(user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

export function isSiteAdmin(session: SessionUser | null | undefined): boolean {
  return ENV_ADMIN || !!session?.admin;
}

type OwnedSong = Song & { user_id: string | null };

/** Can this viewer edit/delete this song? Owner, DB admin, or ADMIN_MODE. */
export function canManageSong(
  session: SessionUser | null | undefined,
  song: { user_id: string | null }
): boolean {
  if (isSiteAdmin(session)) return true;
  if (!session) return false;
  return song.user_id != null && song.user_id === session.uid;
}

/**
 * Can this viewer open/study this song? Currently identical to `canManageSong`
 * (owner or site admin — which also hides legacy `user_id IS NULL` songs from
 * non-admins). Split out so view vs. write rules can diverge later.
 */
export function canViewSong(
  session: SessionUser | null | undefined,
  song: { user_id: string | null }
): boolean {
  return canManageSong(session, song);
}

// ---------------------------------------------------------------------------
// Route guards — return a NextResponse to short-circuit, or the value on success
// ---------------------------------------------------------------------------

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return session;
}

/** null = allowed (proceed); NextResponse = denied. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!isSiteAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function requireSongWrite(
  songId: string
): Promise<{ user: SessionUser | null; song: OwnedSong } | NextResponse> {
  const session = await getSession();
  if (!session && !ENV_ADMIN) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const song = await queryOne<OwnedSong>("SELECT * FROM songs WHERE id = ?", [songId]);
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });
  if (!canManageSong(session, song)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { user: session, song };
}

export async function requireSongWriteByLesson(lessonId: string) {
  const row = await queryOne<{ song_id: string }>(
    "SELECT song_id FROM lessons WHERE id = ?",
    [lessonId]
  );
  if (!row) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  return requireSongWrite(row.song_id);
}

/**
 * Read gate for a single song — signed-in, and (for non-admins) the owner.
 * Returns 404 rather than 403 for someone else's song so we don't confirm it
 * exists: to a non-admin, other people's songs simply aren't there.
 */
export async function requireSongView(
  songId: string
): Promise<{ user: SessionUser | null; song: OwnedSong } | NextResponse> {
  const session = await getSession();
  if (!session && !ENV_ADMIN) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const song = await queryOne<OwnedSong>("SELECT * FROM songs WHERE id = ?", [songId]);
  if (!song || !canViewSong(session, song)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return { user: session, song };
}

export async function requireSongViewByLesson(lessonId: string) {
  const row = await queryOne<{ song_id: string }>(
    "SELECT song_id FROM lessons WHERE id = ?",
    [lessonId]
  );
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return requireSongView(row.song_id);
}

export async function requireSongWriteByLine(lineId: string) {
  const row = await queryOne<{ song_id: string }>(
    `SELECT l.song_id FROM lyric_lines ll
     JOIN lessons l ON ll.lesson_id = l.id
     WHERE ll.id = ?`,
    [lineId]
  );
  if (!row) return NextResponse.json({ error: "Line not found" }, { status: 404 });
  return requireSongWrite(row.song_id);
}
