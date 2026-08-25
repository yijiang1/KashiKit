import { readFileSync } from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

// Shape of drkameleon/complete-hsk-vocabulary's per-level "exclusive" wordlists —
// each word appears in exactly one level's file (unlike the "inclusive" lists,
// which are cumulative).
type HskEntry = {
  simplified: string;
  forms: Array<{ transcriptions?: { pinyin?: string } }>;
};

async function main() {
  const { run, getDb } = await import("../src/lib/db");
  await getDb();

  // getDb() above already ran the app's own migrations, which create
  // jlpt_words with a (word, language) composite key — this is just a
  // defensive fallback in case this script is ever run standalone.
  await run(`
    CREATE TABLE IF NOT EXISTS jlpt_words (
      word     TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'ja',
      reading  TEXT,
      level    INTEGER NOT NULL CHECK (level BETWEEN 1 AND 6),
      PRIMARY KEY (word, language)
    )
  `);

  const words = new Map<string, { reading: string | null; level: number }>();

  // Source: drkameleon/complete-hsk-vocabulary — classic HSK 1-6 scale,
  // "exclusive" lists (each word appears at its first/lowest level only).
  for (let level = 1; level <= 6; level++) {
    console.log(`Fetching HSK ${level}...`);
    const entries = await fetchJson<HskEntry[]>(
      `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive/old/${level}.json`
    );
    let added = 0;
    for (const entry of entries) {
      const word = entry.simplified;
      if (!word || words.has(word)) continue;
      const reading = entry.forms?.[0]?.transcriptions?.pinyin ?? null;
      words.set(word, { reading, level });
      added++;
    }
    console.log(`  Added ${added} entries`);
  }

  console.log(`\nTotal unique entries: ${words.size}`);
  console.log("Inserting into DB...");

  const db = await getDb();
  const entries = [...words.entries()];
  const CHUNK = 200;
  let count = 0;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "(?, 'zh', ?, ?)").join(", ");
    const args = chunk.flatMap(([word, { reading, level }]) => [word, reading, level]);
    await db.execute({
      sql: `INSERT OR REPLACE INTO jlpt_words (word, language, reading, level) VALUES ${placeholders}`,
      args,
    });
    count += chunk.length;
    process.stdout.write(`  ${count}/${words.size}\r`);
  }

  console.log(`\nDone! Seeded ${count} entries.`);

  for (let n = 1; n <= 6; n++) {
    const levelCount = [...words.values()].filter((v) => v.level === n).length;
    console.log(`  HSK${n}: ${levelCount}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
