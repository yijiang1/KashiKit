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
    // SQLite defaults foreign_keys to OFF, which silently disables the
    // ON DELETE CASCADE rules below. Turso enforces FKs server-side, and the
    // pragma may be rejected over HTTP — so failure here is non-fatal.
    try {
      await db.execute("PRAGMA foreign_keys = ON");
    } catch {
      // remote connection — rely on server-side enforcement
    }
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS songs (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        youtube_id  TEXT NOT NULL UNIQUE,
        total_days  INTEGER NOT NULL CHECK (total_days >= 1),
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        language    TEXT NOT NULL DEFAULT 'ja'
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
        word                     TEXT NOT NULL,
        language                 TEXT NOT NULL DEFAULT 'ja',
        furigana                 TEXT NOT NULL DEFAULT '',
        english_meaning          TEXT NOT NULL DEFAULT '',
        part_of_speech           TEXT NOT NULL DEFAULT '',
        grammar_notes            TEXT NOT NULL DEFAULT '',
        example_sentence         TEXT NOT NULL DEFAULT '',
        example_sentence_english TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (word, language)
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
        language       TEXT NOT NULL DEFAULT 'ja',
        UNIQUE(youtube_id, start_time)
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        lesson_id    TEXT PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
        questions    TEXT NOT NULL DEFAULT '[]',
        generated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS jlpt_words (
        word     TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'ja',
        reading  TEXT,
        level    INTEGER NOT NULL CHECK (level BETWEEN 1 AND 6),
        PRIMARY KEY (word, language)
      );

      CREATE TABLE IF NOT EXISTS grammar_points (
        id                  TEXT PRIMARY KEY,
        lyric_line_id       TEXT NOT NULL REFERENCES lyric_lines(id) ON DELETE CASCADE,
        structure           TEXT NOT NULL,
        explanation         TEXT NOT NULL DEFAULT '',
        example_sentence_jp TEXT NOT NULL DEFAULT '',
        example_sentence_en TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_lessons_song ON lessons(song_id, day_number);
      CREATE INDEX IF NOT EXISTS idx_lyric_lines_lesson ON lyric_lines(lesson_id);
      CREATE INDEX IF NOT EXISTS idx_vocabulary_line ON vocabulary(lyric_line_id);
      CREATE INDEX IF NOT EXISTS idx_grammar_points_line ON grammar_points(lyric_line_id);
      CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(created_at);
      CREATE INDEX IF NOT EXISTS idx_jlpt_words_level ON jlpt_words(level);
    `);

    // Migrations for columns added after initial schema
    const lineCols = await db.execute("PRAGMA table_info(lyric_lines)");
    const lineColNames = lineCols.rows.map((r) => r.name as string);
    if (!lineColNames.includes("trim")) {
      await db.execute("ALTER TABLE lyric_lines ADD COLUMN trim REAL NOT NULL DEFAULT 0");
    }
    if (!lineColNames.includes("natural_translation")) {
      await db.execute("ALTER TABLE lyric_lines ADD COLUMN natural_translation TEXT NOT NULL DEFAULT ''");
    }

    const songCols = await db.execute("PRAGMA table_info(songs)");
    const songColNames = songCols.rows.map((r) => r.name as string);
    if (!songColNames.includes("difficulty")) {
      await db.execute("ALTER TABLE songs ADD COLUMN difficulty INTEGER DEFAULT NULL CHECK (difficulty IS NULL OR (difficulty >= 1 AND difficulty <= 5))");
    }
    if (!songColNames.includes("difficulty_reason")) {
      await db.execute("ALTER TABLE songs ADD COLUMN difficulty_reason TEXT DEFAULT NULL");
    }
    if (!songColNames.includes("artist")) {
      await db.execute("ALTER TABLE songs ADD COLUMN artist TEXT NOT NULL DEFAULT ''");
    }
    if (!songColNames.includes("title_en")) {
      await db.execute("ALTER TABLE songs ADD COLUMN title_en TEXT DEFAULT NULL");
    }
    // Multi-language support: every existing row defaults to 'ja' so the
    // current (Japanese-only) production data keeps working unchanged.
    if (!songColNames.includes("language")) {
      await db.execute("ALTER TABLE songs ADD COLUMN language TEXT NOT NULL DEFAULT 'ja'");
    }

    const vocabCols = await db.execute("PRAGMA table_info(vocabulary)");
    const vocabColNames = vocabCols.rows.map((r) => r.name as string);
    if (!vocabColNames.includes("jlpt_level") && !vocabColNames.includes("level")) {
      await db.execute("ALTER TABLE vocabulary ADD COLUMN level INTEGER DEFAULT NULL");
    } else if (vocabColNames.includes("jlpt_level") && !vocabColNames.includes("level")) {
      // Renamed to a generic name since this column now also holds HSK levels for Chinese vocab.
      await db.execute("ALTER TABLE vocabulary RENAME COLUMN jlpt_level TO level");
    }

    const sentenceBankCols = await db.execute("PRAGMA table_info(sentence_bank)");
    const sentenceBankColNames = sentenceBankCols.rows.map((r) => r.name as string);
    if (!sentenceBankColNames.includes("language")) {
      await db.execute("ALTER TABLE sentence_bank ADD COLUMN language TEXT NOT NULL DEFAULT 'ja'");
    }

    // dictionary and jlpt_words are keyed by `word` alone, which collides across
    // languages since Chinese and Japanese share many Han characters (e.g. 学校).
    // Both get a `language` column and a composite (word, language) primary key.
    type ColInfo = { name: string; pk: number };

    const dictCols = (await db.execute("PRAGMA table_info(dictionary)")).rows as unknown as ColInfo[];
    if (!dictCols.some((c) => c.name === "language")) {
      await db.execute("ALTER TABLE dictionary ADD COLUMN language TEXT NOT NULL DEFAULT 'ja'");
    }
    const dictColsAfter = (await db.execute("PRAGMA table_info(dictionary)")).rows as unknown as ColInfo[];
    if (!dictColsAfter.some((c) => c.name === "language" && c.pk > 0)) {
      // batch() runs these in a real transaction (BEGIN/COMMIT with rollback on
      // failure) — executeMultiple does not, which would risk leaving a stray
      // dictionary_new table (and a broken idempotency check) behind on a
      // dropped connection to Turso mid-migration.
      await db.batch([
        `CREATE TABLE dictionary_new (
          word                     TEXT NOT NULL,
          language                 TEXT NOT NULL DEFAULT 'ja',
          furigana                 TEXT NOT NULL DEFAULT '',
          english_meaning          TEXT NOT NULL DEFAULT '',
          part_of_speech           TEXT NOT NULL DEFAULT '',
          grammar_notes            TEXT NOT NULL DEFAULT '',
          example_sentence         TEXT NOT NULL DEFAULT '',
          example_sentence_english TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (word, language)
        )`,
        `INSERT INTO dictionary_new (word, language, furigana, english_meaning, part_of_speech, grammar_notes, example_sentence, example_sentence_english)
          SELECT word, language, furigana, english_meaning, part_of_speech, grammar_notes, example_sentence, example_sentence_english FROM dictionary`,
        `DROP TABLE dictionary`,
        `ALTER TABLE dictionary_new RENAME TO dictionary`,
      ]);
    }

    const jlptCols = (await db.execute("PRAGMA table_info(jlpt_words)")).rows as unknown as ColInfo[];
    if (!jlptCols.some((c) => c.name === "language")) {
      await db.execute("ALTER TABLE jlpt_words ADD COLUMN language TEXT NOT NULL DEFAULT 'ja'");
    }
    const jlptColsAfter = (await db.execute("PRAGMA table_info(jlpt_words)")).rows as unknown as ColInfo[];
    if (!jlptColsAfter.some((c) => c.name === "language" && c.pk > 0)) {
      await db.batch([
        `CREATE TABLE jlpt_words_new (
          word     TEXT NOT NULL,
          language TEXT NOT NULL DEFAULT 'ja',
          reading  TEXT,
          level    INTEGER NOT NULL CHECK (level BETWEEN 1 AND 6),
          PRIMARY KEY (word, language)
        )`,
        `INSERT INTO jlpt_words_new (word, language, reading, level)
          SELECT word, language, reading, level FROM jlpt_words`,
        `DROP TABLE jlpt_words`,
        `ALTER TABLE jlpt_words_new RENAME TO jlpt_words`,
        `CREATE INDEX IF NOT EXISTS idx_jlpt_words_level ON jlpt_words(level)`,
      ]);
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

export async function isDbAvailable(): Promise<boolean> {
  try {
    await getClient().execute("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
