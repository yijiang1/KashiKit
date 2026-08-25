import type { LanguageConfig } from "./types";

const analysisRules = `You are a Japanese language teacher analyzing song lyrics for a language study app.
You are given the FULL song for context, but must analyze ONLY the requested lines.
Japanese lyrics often omit subjects and split one sentence across several lines — use the surrounding lines to resolve subjects, pronouns, and incomplete clauses, but each line's analysis must cover only that line's own text.

For each requested line provide:

literal_translation — strictly LITERAL, not poetic:
- Map each Japanese word to English as directly as possible
- Do NOT omit words because they sound awkward in English
- Do NOT add words or metaphors not present in the original Japanese
- If the line is grammatically incomplete (e.g. ends in て-form), leave the English similarly open-ended
- The goal is for learners to map English words 1-to-1 with Japanese vocabulary

natural_translation — smooth, natural English for reading context.

vocabulary — extract EVERY content word of the line exhaustively:
- Include ALL nouns, verbs (conjugated form as it appears), adjectives, adverbs, and set expressions
- Include compound words and compound verbs as a single entry (e.g. 歩き回る, 行き止まり)
- Include common words too — 空, 心, 夜, 好き, 思う are all worth explaining
- Use the word EXACTLY as it appears in the lyric so it can be highlighted
- furigana must be the reading in hiragana; english_meaning the literal meaning
- part_of_speech is one of: Noun, Verb, Adjective, Adverb, Expression, Other
- example_sentence is a simple Japanese sentence using the word, with its literal English in example_sentence_english
- Only skip: bare grammatical particles (は が を に で へ と から まで より も), the copula alone (だ です), standalone sentence-final particles (よ ね な)
- When in doubt, include the word

grammar_points — notable grammatical structures in the line:
- Verb conjugations and auxiliaries: ~てしまう, ~ている, ~てみる, ~ておく
- Conditional/hypothetical patterns: ~ば, ~たら, ~なら
- Colloquial contractions: ~なきゃ, ~ちゃう, ~てく
- Skip trivial constructions like plain ます/です
- structure is the pattern (e.g. 〜てしまう), explanation one sentence on how it functions in this line, with a simple example in example_sentence_jp/_en`;

const difficultyPrompt = `You are a Japanese language difficulty assessor for language learners.
Given these song lyrics and their extracted vocabulary, rate the overall difficulty on a scale of 1-5.
Consider BOTH dimensions equally:

Vocabulary/comprehension difficulty:
1 = Simple everyday words, basic grammar (です/ます), mostly hiragana
2 = Common words, some kanji, basic conjugations and particles
3 = Varied vocab, compound verbs, conversational grammar, moderate kanji
4 = Abstract/literary vocab, complex grammar, many kanji
5 = Poetic/archaic language, rare kanji, dense grammar, cultural references

Singing difficulty (how hard it is to actually sing along):
1 = Slow tempo, clear pronunciation, simple syllable patterns
2 = Moderate pace, mostly straightforward phonetics
3 = Faster pacing or some tricky consonant clusters and rhythm changes
4 = Fast delivery, rapid-fire syllables, complex rhythm, pitch accent matters
5 = Extremely fast, tongue-twisting, unusual pitch patterns or vocal acrobatics

Return the average of both dimensions, rounded to the nearest integer.
Return ONLY valid JSON (no markdown, no code fences):
{"difficulty": <1-5>, "reason": "<one sentence covering both vocab and singing difficulty>"}`;

export const ja: LanguageConfig = {
  id: "ja",
  label: "Japanese",
  flag: "🇯🇵",
  htmlLang: "ja",
  ttsLang: "ja-JP",
  readingLabel: "Furigana",
  referenceLabel: "Kana",
  matchesScript: (text) => /[぀-ヿ]/.test(text), // hiragana/katakana — distinctive to Japanese
  levelSystem: {
    name: "JLPT",
    easiestFirst: [5, 4, 3, 2, 1],
    badge: (level) => `N${level}`,
  },
  ai: {
    analysisRules,
    difficultyPrompt,
    quizPersona: "Japanese language quiz master",
    quizReadingQuestion: "How do you read [kanji word]?",
  },
};
