import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { execFileSync } from "child_process";

const envPath = path.join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

type Args = { song: string; day?: number; out: string; paddingMs: number };

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let day: number | undefined;
  let out = "anki-export";
  let paddingMs = 200;
  for (const arg of argv) {
    if (arg.startsWith("--day=")) day = Number(arg.slice("--day=".length));
    else if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
    else if (arg.startsWith("--padding=")) paddingMs = Number(arg.slice("--padding=".length));
    else positional.push(arg);
  }
  if (positional.length !== 1) {
    console.error("Usage: npx tsx scripts/export-anki.ts <youtube_id_or_title> [--day=N] [--out=dir] [--padding=200]");
    process.exit(1);
  }
  return { song: positional[0], day, out, paddingMs };
}

function checkBinary(name: string, versionFlag: string, installHint: string) {
  try {
    execFileSync(name, [versionFlag], { stdio: "ignore" });
  } catch {
    console.error(`Missing required tool: ${name}. Install it first (${installHint}).`);
    process.exit(1);
  }
}

function csvEscape(value: string): string {
  const str = value ?? "";
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Falls back to the youtube_id when the title has no ASCII letters/digits to
// slugify (common here — most songs are Japanese/Chinese titles).
function slugify(title: string, fallback: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || fallback;
}

type Song = { id: string; title: string; artist: string; youtube_id: string; language: "ja" | "zh" };
type LyricLine = {
  id: string;
  start_time: number;
  end_time: number;
  trim: number;
  japanese_text: string;
  natural_translation: string;
  english_text: string;
};
type VocabRow = {
  lyric_line_id: string;
  word: string;
  furigana: string;
  english_meaning: string;
  part_of_speech: string;
  example_sentence: string;
  example_sentence_english: string;
  level: number | null;
};
type Card = VocabRow & { line: LyricLine };

async function main() {
  const args = parseArgs(process.argv.slice(2));

  checkBinary("yt-dlp", "--version", "brew install yt-dlp");
  checkBinary("ffmpeg", "-version", "brew install ffmpeg");
  checkBinary("zip", "--version", "should be preinstalled on macOS/Linux");

  const { query, queryOne } = await import("../src/lib/db");
  const { getLanguageConfig } = await import("../src/lib/languages");

  // Resolve the song: exact youtube_id match first, else a title search.
  let song = await queryOne<Song>("SELECT id, title, artist, youtube_id, language FROM songs WHERE youtube_id = ?", [args.song]);
  if (!song) {
    const matches = await query<Song>(
      "SELECT id, title, artist, youtube_id, language FROM songs WHERE lower(title) LIKE ?",
      [`%${args.song.toLowerCase()}%`]
    );
    if (matches.length === 0) {
      console.error(`No song found matching "${args.song}".`);
      process.exit(1);
    } else if (matches.length > 1) {
      console.error(`Multiple songs match "${args.song}" — use the youtube_id instead:`);
      for (const m of matches) console.error(`  ${m.youtube_id}  ${m.title} (${m.artist})`);
      process.exit(1);
    }
    song = matches[0];
  }
  const langConfig = getLanguageConfig(song.language);
  console.log(`Exporting "${song.title}" (${song.artist}) [${song.youtube_id}, ${langConfig.label}]`);

  // Lyric lines in chronological order, optionally scoped to one day.
  let lineSql = `
    SELECT ll.id, ll.start_time, ll.end_time, ll.trim, ll.japanese_text, ll.natural_translation, ll.english_text
    FROM lyric_lines ll
    JOIN lessons l ON l.id = ll.lesson_id
    WHERE l.song_id = ?
  `;
  const lineArgs: (string | number)[] = [song.id];
  if (args.day != null) {
    lineSql += " AND l.day_number = ?";
    lineArgs.push(args.day);
  }
  lineSql += " ORDER BY l.day_number ASC, ll.start_time ASC";
  const lines = await query<LyricLine>(lineSql, lineArgs);
  if (lines.length === 0) {
    console.error("No lyric lines found for this song/day.");
    process.exit(1);
  }

  const lineIds = lines.map((l) => l.id);
  const placeholders = lineIds.map(() => "?").join(",");
  const vocabRows = await query<VocabRow>(
    `SELECT lyric_line_id, word, furigana, english_meaning, part_of_speech, example_sentence, example_sentence_english, level
     FROM vocabulary WHERE lyric_line_id IN (${placeholders})`,
    lineIds
  );
  const vocabByLine = new Map<string, VocabRow[]>();
  for (const v of vocabRows) {
    if (!vocabByLine.has(v.lyric_line_id)) vocabByLine.set(v.lyric_line_id, []);
    vocabByLine.get(v.lyric_line_id)!.push(v);
  }

  // Dedup: one card per word, tied to its first occurrence in the song.
  const seen = new Set<string>();
  const cards: Card[] = [];
  for (const line of lines) {
    for (const v of vocabByLine.get(line.id) ?? []) {
      if (!v.word || seen.has(v.word)) continue;
      seen.add(v.word);
      cards.push({ ...v, line });
    }
  }
  console.log(`${lines.length} lines, ${cards.length} unique vocabulary cards.`);

  const outDir = path.join(args.out, song.youtube_id);
  const mediaDir = path.join(outDir, "media");
  mkdirSync(mediaDir, { recursive: true });

  // Download full song audio once, cached by youtube_id.
  const audioPath = path.join(outDir, `${song.youtube_id}.mp3`);
  if (existsSync(audioPath)) {
    console.log("Audio already downloaded, skipping.");
  } else {
    console.log("Downloading audio via yt-dlp...");
    execFileSync(
      "yt-dlp",
      ["-x", "--audio-format", "mp3", "-o", path.join(outDir, `${song.youtube_id}.%(ext)s`), `https://www.youtube.com/watch?v=${song.youtube_id}`],
      { stdio: "inherit" }
    );
  }

  // Slice one clip per unique source line (several cards can share a line,
  // e.g. a line with several newly-seen words), using the line's existing
  // trim (the same field the study player uses to shorten bleed into the
  // next line).
  const paddingSec = args.paddingMs / 1000;
  const cardLines = [...new Map(cards.map((c) => [c.line.id, c.line])).values()];
  console.log(`Slicing ${cardLines.length} clips...`);
  const clipNameByLineId = new Map<string, string>();
  const clipFiles: string[] = [];
  cardLines.forEach((line, i) => {
    const start = Math.max(0, line.start_time - paddingSec);
    const end = Math.max(start + 0.1, line.end_time - line.trim + paddingSec);
    const clipName = `clip_${String(i).padStart(4, "0")}.mp3`;
    const clipPath = path.join(mediaDir, clipName);
    execFileSync(
      "ffmpeg",
      ["-y", "-i", audioPath, "-ss", start.toFixed(3), "-to", end.toFixed(3), "-acodec", "libmp3lame", "-b:a", "128k", clipPath],
      { stdio: ["ignore", "ignore", "ignore"] }
    );
    clipNameByLineId.set(line.id, clipName);
    clipFiles.push(clipPath);
  });

  // notes.csv, sorted by level (unleveled last) then word.
  const sorted = [...cards].sort((a, b) => {
    const la = a.level ?? 99;
    const lb = b.level ?? 99;
    if (la !== lb) return la - lb;
    return a.word.localeCompare(b.word);
  });
  const header = ["Word", "Reading", "Meaning", "Level", "POS", "Sentence", "Sentence_Translation", "Example_Sentence", "Example_Sentence_English", "Audio"];
  const rows = sorted.map((card) => {
    const clipName = clipNameByLineId.get(card.line.id)!;
    return [
      card.word,
      card.furigana,
      card.english_meaning,
      card.level != null ? langConfig.levelSystem.badge(card.level) : "",
      card.part_of_speech,
      card.line.japanese_text,
      card.line.natural_translation || card.line.english_text,
      card.example_sentence,
      card.example_sentence_english,
      `[sound:${clipName}]`,
    ].map(csvEscape).join(",");
  });
  const csvPath = path.join(outDir, "notes.csv");
  writeFileSync(csvPath, "﻿" + [header.join(","), ...rows].join("\n"), "utf-8");

  // Zip notes.csv + media flat together for easy Anki import.
  const zipPath = path.join(args.out, `${slugify(song.title, song.youtube_id)}-anki-deck.zip`);
  if (existsSync(zipPath)) execFileSync("rm", [zipPath]);
  execFileSync("zip", ["-j", zipPath, csvPath, ...clipFiles], { stdio: "ignore" });

  console.log(`\nDone: ${zipPath}`);
  console.log("To import into Anki:");
  console.log("  1. Unzip it.");
  console.log("  2. Anki desktop → File → Import → select notes.csv, map the Audio column to the Audio field.");
  console.log("  3. Copy all clip_*.mp3 files into your profile's collection.media folder.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
