import { readFileSync } from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

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

  // --- Source 1: Bluskyo/JLPT_Vocabulary (N1–N5, ~5186 entries) ---
  console.log("Fetching Bluskyo JLPT_Vocabulary...");
  const bluskyo = await fetchText(
    "https://raw.githubusercontent.com/Bluskyo/JLPT_Vocabulary/main/data/results/JLPTWords.json"
  );
  const blueskyoData = JSON.parse(bluskyo) as Record<string, string>;
  for (const [word, levelStr] of Object.entries(blueskyoData)) {
    const level = parseInt(levelStr.replace("N", ""));
    if (level >= 1 && level <= 5) {
      words.set(word, { reading: null, level });
    }
  }
  console.log(`  Loaded ${words.size} entries from Bluskyo`);

  // --- Source 2: surajsau/JLPT-Resources N4 + N5 (pipe-delimited, includes readings) ---
  for (const n of [4, 5]) {
    console.log(`Fetching surajsau N${n}...`);
    const tres = await fetchText(
      `https://raw.githubusercontent.com/surajsau/JLPT-Resources/master/Vocab/N${n}.tres`
    );
    let added = 0;
    let filled = 0;
    for (const line of tres.split("\n").slice(1)) {
      const parts = line.split("|");
      if (parts.length < 2) continue;
      const kanji = parts[0].trim();
      const reading = parts[1].trim();
      if (!reading) continue;

      // Use kanji form if present, otherwise reading is the word
      const word = kanji || reading;

      if (!words.has(word)) {
        words.set(word, { reading, level: n });
        added++;
      } else {
        // Word exists (from Bluskyo) but may be missing the reading — fill it in
        const existing = words.get(word)!;
        if (!existing.reading && reading) {
          existing.reading = reading;
          filled++;
        }
      }

      // Also index by reading alone if different from kanji (helps with kana-only lookups)
      if (kanji && reading !== kanji && !words.has(reading)) {
        words.set(reading, { reading, level: n });
        added++;
      }
    }
    console.log(`  Added ${added} new entries, filled readings on ${filled} existing entries`);
  }

  console.log(`\nTotal unique entries: ${words.size}`);
  console.log("Inserting into DB...");

  // Batch inserts in chunks inside a transaction for speed
  const db = await getDb();
  const entries = [...words.entries()];
  const CHUNK = 200;
  let count = 0;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "(?, ?, ?)").join(", ");
    const args = chunk.flatMap(([word, { reading, level }]) => [word, reading ?? null, level]);
    await db.execute({
      sql: `INSERT OR REPLACE INTO jlpt_words (word, reading, level) VALUES ${placeholders}`,
      args,
    });
    count += chunk.length;
    process.stdout.write(`  ${count}/${words.size}\r`);
  }

  console.log(`\nDone! Seeded ${count} entries.`);

  // Summary
  for (let n = 1; n <= 5; n++) {
    const levelCount = [...words.values()].filter((v) => v.level === n).length;
    console.log(`  N${n}: ${levelCount}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
