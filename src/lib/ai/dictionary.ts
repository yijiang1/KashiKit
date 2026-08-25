import { query, run } from "@/lib/db";
import type { LanguageId } from "@/lib/languages";

export type DictEntry = {
  word: string;
  furigana: string;
  english_meaning: string;
  part_of_speech: string;
  grammar_notes: string;
  example_sentence: string;
  example_sentence_english: string;
};

// The dictionary cache is scoped by (word, language): Chinese and Japanese
// share many Han characters (e.g. 学校), so a word-only lookup would let one
// language's cached entry leak into the other.
export async function lookupWords(words: string[], language: LanguageId = "ja"): Promise<Map<string, DictEntry>> {
  if (words.length === 0) return new Map();
  const placeholders = words.map(() => "?").join(",");
  const data = await query<DictEntry>(
    `SELECT word, furigana, english_meaning, part_of_speech, grammar_notes, example_sentence, example_sentence_english
     FROM dictionary WHERE language = ? AND word IN (${placeholders})`,
    [language, ...words]
  );

  const map = new Map<string, DictEntry>();
  for (const row of data) {
    map.set(row.word, row);
  }
  return map;
}

export async function cacheWords(entries: DictEntry[], language: LanguageId = "ja"): Promise<void> {
  for (const e of entries) {
    await run(
      `INSERT INTO dictionary (word, language, furigana, english_meaning, part_of_speech, grammar_notes, example_sentence, example_sentence_english)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(word, language) DO NOTHING`,
      [e.word, language, e.furigana, e.english_meaning, e.part_of_speech, e.grammar_notes, e.example_sentence, e.example_sentence_english]
    );
  }
}
