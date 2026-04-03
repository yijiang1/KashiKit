import { createClient } from "@libsql/client";
import type { Client, InValue } from "@libsql/client";
import path from "path";
import crypto from "crypto";

export function uuid(): string {
  return crypto.randomUUID();
}

let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL ?? `file:${path.join(process.cwd(), "lyriclearn.db")}`;
    _client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

let _initPromise: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const db = getClient();
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS songs (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        youtube_id  TEXT NOT NULL UNIQUE,
        total_days  INTEGER NOT NULL CHECK (total_days >= 1),
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS lessons (
        id          TEXT PRIMARY KEY,
        song_id     TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        day_number  INTEGER NOT NULL CHECK (day_number >= 1),
        UNIQUE(song_id, day_number)
      );

      CREATE TABLE IF NOT EXISTS lyric_lines (
        id             TEXT PRIMARY KEY,
        lesson_id      TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        start_time     REAL NOT NULL,
        end_time       REAL NOT NULL,
        japanese_text  TEXT NOT NULL,
        english_text   TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS vocabulary (
        id                       TEXT PRIMARY KEY,
        lyric_line_id            TEXT NOT NULL REFERENCES lyric_lines(id) ON DELETE CASCADE,
        word                     TEXT NOT NULL,
        furigana                 TEXT NOT NULL,
        english_meaning          TEXT NOT NULL,
        grammar_notes            TEXT NOT NULL DEFAULT '',
        part_of_speech           TEXT NOT NULL DEFAULT '',
        example_sentence         TEXT NOT NULL DEFAULT '',
        example_sentence_english TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS lesson_completions (
        id           TEXT PRIMARY KEY,
        lesson_id    TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        completed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS api_usage (
        id                TEXT PRIMARY KEY,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        model             TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
        prompt_tokens     INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens      INTEGER NOT NULL DEFAULT 0,
        purpose           TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS dictionary (
        word                     TEXT PRIMARY KEY,
        furigana                 TEXT NOT NULL DEFAULT '',
        english_meaning          TEXT NOT NULL DEFAULT '',
        part_of_speech           TEXT NOT NULL DEFAULT '',
        grammar_notes            TEXT NOT NULL DEFAULT '',
        example_sentence         TEXT NOT NULL DEFAULT '',
        example_sentence_english TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS sentence_bank (
        id             TEXT PRIMARY KEY,
        japanese_text  TEXT NOT NULL,
        english_text   TEXT NOT NULL DEFAULT '',
        youtube_id     TEXT NOT NULL,
        start_time     REAL NOT NULL,
        end_time       REAL NOT NULL,
        song_title     TEXT NOT NULL DEFAULT '',
        words          TEXT NOT NULL DEFAULT '[]',
        UNIQUE(youtube_id, start_time)
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        lesson_id    TEXT PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
        questions    TEXT NOT NULL DEFAULT '[]',
        generated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_lessons_song ON lessons(song_id, day_number);
      CREATE INDEX IF NOT EXISTS idx_lyric_lines_lesson ON lyric_lines(lesson_id);
      CREATE INDEX IF NOT EXISTS idx_vocabulary_line ON vocabulary(lyric_line_id);
      CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(created_at);
    `);

    // Migrations for columns added after initial schema
    const lineCols = await db.execute("PRAGMA table_info(lyric_lines)");
    const lineColNames = lineCols.rows.map((r) => r.name as string);
    if (!lineColNames.includes("trim")) {
      await db.execute("ALTER TABLE lyric_lines ADD COLUMN trim REAL NOT NULL DEFAULT 0");
    }

    const songCols = await db.execute("PRAGMA table_info(songs)");
    const songColNames = songCols.rows.map((r) => r.name as string);
    if (!songColNames.includes("difficulty")) {
      await db.execute("ALTER TABLE songs ADD COLUMN difficulty INTEGER DEFAULT NULL CHECK (difficulty IS NULL OR (difficulty >= 1 AND difficulty <= 5))");
    }
    if (!songColNames.includes("difficulty_reason")) {
      await db.execute("ALTER TABLE songs ADD COLUMN difficulty_reason TEXT DEFAULT NULL");
    }
  })();
  return _initPromise;
}

export async function getDb(): Promise<Client> {
  await ensureInit();
  return getClient();
}

// Typed query helpers
export async function query<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const db = await getDb();
  const result = await db.execute({ sql, args });
  return result.rows.map((row) => ({ ...row })) as unknown as T[];
}

export async function queryOne<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, args);
  return rows[0];
}

export async function run(sql: string, args: InValue[] = []): Promise<void> {
  const db = await getDb();
  await db.execute({ sql, args });
}
