// Pinyin tone-mark utilities. Tone-mark placement follows the standard rule:
// mark 'a' if present, else 'e', else 'o' in "ou", else the second vowel in
// "iu"/"ui", else 'o', else whichever of i/u/ü is present.
const TONE_MARKS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à", "a"],
  e: ["ē", "é", "ě", "è", "e"],
  i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"],
  u: ["ū", "ú", "ǔ", "ù", "u"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

const TONE_TO_BASE: Record<string, string> = {};
for (const [base, marks] of Object.entries(TONE_MARKS)) {
  for (const mark of marks) TONE_TO_BASE[mark] = base;
}

/** Add a tone mark (1-4) or leave unmarked (5 = neutral) to a toneless syllable, e.g. addTone("ma", 3) → "mǎ". */
export function addTone(syllable: string, tone: 1 | 2 | 3 | 4 | 5): string {
  if (tone === 5) return syllable;
  let target: string | null = null;
  if (syllable.includes("a")) target = "a";
  else if (syllable.includes("e")) target = "e";
  else if (syllable.includes("ou")) target = "o";
  else if (syllable.includes("iu")) target = "u";
  else if (syllable.includes("ui")) target = "i";
  else if (syllable.includes("o")) target = "o";
  else if (syllable.includes("i")) target = "i";
  else if (syllable.includes("u")) target = "u";
  else if (syllable.includes("ü")) target = "ü";
  if (!target) return syllable;
  const idx = syllable.lastIndexOf(target);
  return syllable.slice(0, idx) + TONE_MARKS[target][tone - 1] + syllable.slice(idx + target.length);
}

/** Strip tone marks back to plain letters, e.g. "nǐ hǎo" → "ni hao". */
export function stripTones(text: string): string {
  return text
    .split("")
    .map((ch) => TONE_TO_BASE[ch] ?? ch)
    .join("")
    .toLowerCase();
}

/** Extract the first (toneless) syllable from a furigana field, e.g. "xǐ huān" → "xi". */
export function firstSyllable(pinyin: string): string | null {
  const token = pinyin.trim().split(/[\s·-]+/)[0];
  if (!token) return null;
  return stripTones(token);
}

export type PinyinCell = { base: string } | null;

// Standard "simple finals" initial × final combination table (声母韵母拼合表),
// grouped by place/manner of articulation the way most HSK1 textbooks present it.
// Columns: a o e i u ü
export const PINYIN_COLS = ["a", "o", "e", "i", "u", "ü"];

export const LABIALS_ALVEOLARS: Array<[string, PinyinCell[]]> = [
  ["", [{ base: "a" }, { base: "o" }, { base: "e" }, { base: "yi" }, { base: "wu" }, { base: "yu" }]],
  ["b", [{ base: "ba" }, { base: "bo" }, null, { base: "bi" }, { base: "bu" }, null]],
  ["p", [{ base: "pa" }, { base: "po" }, null, { base: "pi" }, { base: "pu" }, null]],
  ["m", [{ base: "ma" }, { base: "mo" }, { base: "me" }, { base: "mi" }, { base: "mu" }, null]],
  ["f", [{ base: "fa" }, { base: "fo" }, null, null, { base: "fu" }, null]],
  ["d", [{ base: "da" }, null, { base: "de" }, { base: "di" }, { base: "du" }, null]],
  ["t", [{ base: "ta" }, null, { base: "te" }, { base: "ti" }, { base: "tu" }, null]],
  ["n", [{ base: "na" }, null, { base: "ne" }, { base: "ni" }, { base: "nu" }, { base: "nü" }]],
  ["l", [{ base: "la" }, null, { base: "le" }, { base: "li" }, { base: "lu" }, { base: "lü" }]],
];

export const VELARS_PALATALS: Array<[string, PinyinCell[]]> = [
  ["g", [{ base: "ga" }, null, { base: "ge" }, null, { base: "gu" }, null]],
  ["k", [{ base: "ka" }, null, { base: "ke" }, null, { base: "ku" }, null]],
  ["h", [{ base: "ha" }, null, { base: "he" }, null, { base: "hu" }, null]],
  ["j", [null, null, null, { base: "ji" }, null, { base: "ju" }]],
  ["q", [null, null, null, { base: "qi" }, null, { base: "qu" }]],
  ["x", [null, null, null, { base: "xi" }, null, { base: "xu" }]],
];

export const SIBILANTS: Array<[string, PinyinCell[]]> = [
  ["zh", [{ base: "zha" }, null, { base: "zhe" }, { base: "zhi" }, { base: "zhu" }, null]],
  ["ch", [{ base: "cha" }, null, { base: "che" }, { base: "chi" }, { base: "chu" }, null]],
  ["sh", [{ base: "sha" }, null, { base: "she" }, { base: "shi" }, { base: "shu" }, null]],
  ["r", [null, null, { base: "re" }, { base: "ri" }, { base: "ru" }, null]],
  ["z", [{ base: "za" }, null, { base: "ze" }, { base: "zi" }, { base: "zu" }, null]],
  ["c", [{ base: "ca" }, null, { base: "ce" }, { base: "ci" }, { base: "cu" }, null]],
  ["s", [{ base: "sa" }, null, { base: "se" }, { base: "si" }, { base: "su" }, null]],
];
