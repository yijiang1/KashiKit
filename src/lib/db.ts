import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.join(process.cwd(), "lyriclearn.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
    migrate(_db);
  }
  return _db;
}

export function uuid(): string {
  return crypto.randomUUID();
}

function migrate(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(lyric_lines)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "trim")) {
    db.exec("ALTER TABLE lyric_lines ADD COLUMN trim REAL NOT NULL DEFAULT 0");
  }
}

function initSchema(db: Database.Database) {
  db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_lessons_song ON lessons(song_id, day_number);
    CREATE INDEX IF NOT EXISTS idx_lyric_lines_lesson ON lyric_lines(lesson_id);
    CREATE INDEX IF NOT EXISTS idx_vocabulary_line ON vocabulary(lyric_line_id);
    CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(created_at);
  `);
}
