import { readFileSync } from "fs";
import path from "path";

// Load .env.local BEFORE any other module initializes
const envPath = path.join(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

async function main() {
  // Dynamic imports so env vars are set before modules initialize
  const { query, run, getDb } = await import("../src/lib/db");
  const { assessDifficulty } = await import("../src/lib/ai/pipeline");

  await getDb();

  const songs = await query<{ id: string; title: string; difficulty: number | null }>(
    "SELECT id, title, difficulty FROM songs ORDER BY created_at ASC"
  );

  console.log(`Found ${songs.length} songs. Assessing all...`);

  for (const song of songs) {
    console.log(`\nAssessing: ${song.title}`);

    const lines = await query<{ japanese_text: string }>(
      `SELECT ll.japanese_text
       FROM lyric_lines ll
       JOIN lessons l ON ll.lesson_id = l.id
       WHERE l.song_id = ?
       ORDER BY l.day_number, ll.start_time`,
      [song.id]
    );

    const vocab = await query<{ word: string; part_of_speech: string }>(
      `SELECT DISTINCT v.word, v.part_of_speech
       FROM vocabulary v
       JOIN lyric_lines ll ON v.lyric_line_id = ll.id
       JOIN lessons l ON ll.lesson_id = l.id
       WHERE l.song_id = ?`,
      [song.id]
    );

    const { difficulty, reason } = await assessDifficulty(
      lines.map((l) => l.japanese_text),
      vocab.map((v) => ({ word: v.word, pos: v.part_of_speech }))
    );

    await run(
      "UPDATE songs SET difficulty = ?, difficulty_reason = ? WHERE id = ?",
      [difficulty, reason || null, song.id]
    );

    console.log(`  → ${"★".repeat(difficulty)}${"☆".repeat(5 - difficulty)} — ${reason}`);
  }

  console.log("\nDone!");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
