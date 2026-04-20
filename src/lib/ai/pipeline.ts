import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AILineResult } from "@/types";
import type { ParsedLine } from "@/lib/lrc/parser";
import { logApiUsage } from "./usage-tracker";
import { lookupWords, cacheWords, type DictEntry } from "./dictionary";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const VOCAB_SCHEMA = `
    {
      "word": "the exact word/phrase as it appears in the lyric",
      "dictionary_form": "base dictionary form (e.g. 走る for 走って)",
      "furigana": "reading in hiragana",
      "english_meaning": "literal English meaning",
      "part_of_speech": "one of: Noun, Verb, Adjective, Adverb, Expression, Other",
      "jlpt_level": "N5, N4, N3, N2, N1, or None",
      "example_sentence": "a simple Japanese example sentence using this word",
      "example_sentence_english": "literal English translation of the example"
    }`;

const GRAMMAR_SCHEMA = `
    {
      "structure": "the grammar pattern (e.g. 〜てしまう, 〜なきゃ)",
      "explanation": "one sentence on how it functions in this line",
      "example_sentence_jp": "a simple Japanese example using this grammar",
      "example_sentence_en": "literal English translation of the example"
    }`;

const SYSTEM_PROMPT = `You are a Japanese language teacher analyzing song lyrics for a language study app.

TRANSLATION RULES — be strictly LITERAL, not poetic:
- Map each Japanese word to English as directly as possible
- Do NOT omit words because they sound awkward in English
- Do NOT add words or metaphors not present in the original Japanese
- If the line is grammatically incomplete (e.g. ends in て-form), leave the English similarly open-ended
- The goal is for learners to map English words 1-to-1 with Japanese vocabulary
- Also include a natural_translation for smoother reading context

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "line_analysis": {
    "japanese_line": "the full Japanese text as provided",
    "furigana_line": "the line with inline furigana (e.g. 漢[かん]字[じ])",
    "literal_translation": "word-for-word English, even if awkward",
    "natural_translation": "smooth, natural English for context"
  },
  "vocabulary": [${VOCAB_SCHEMA}],
  "grammar_points": [${GRAMMAR_SCHEMA}]
}

For vocabulary, extract EVERY content word exhaustively:
- Include ALL nouns, verbs (conjugated form as it appears), adjectives, adverbs, and set expressions
- Include compound words and compound verbs as a single entry (e.g. 歩き回る, 行き止まり)
- Include common words too — 空, 心, 夜, 好き, 思う are all worth explaining
- Use the word EXACTLY as it appears in the lyric so it can be highlighted
- Only skip: bare grammatical particles (は が を に で へ と から まで より も), the copula alone (だ です), standalone sentence-final particles (よ ね な)
- When in doubt, include the word

For grammar_points, identify notable grammatical structures:
- Verb conjugations and auxiliaries: ~てしまう, ~ている, ~てみる, ~ておく
- Conditional/hypothetical patterns: ~ば, ~たら, ~なら
- Colloquial contractions: ~なきゃ, ~ちゃう, ~てく
- Skip trivial constructions like plain ます/です`;

const EMPTY_RESULT: AILineResult = {
  line_analysis: { japanese_line: "", furigana_line: "", literal_translation: "", natural_translation: "" },
  vocabulary: [],
  grammar_points: [],
};

function isRateLimit(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("quota");
  }
  return false;
}

async function generateWithRetry(prompt: string, maxRetries = 3) {
  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      if (isRateLimit(err) && attempt < maxRetries) {
        console.warn(`Gemini rate limit hit — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

export async function analyzeLine(japaneseText: string): Promise<AILineResult> {
  try {
    const prompt = `${SYSTEM_PROMPT}\n\nInput Lyric: ${japaneseText}`;
    const result = await generateWithRetry(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();

    // Log API usage
    const usage = result.response.usageMetadata;
    if (usage) {
      await logApiUsage({
        prompt_tokens: usage.promptTokenCount ?? 0,
        completion_tokens: usage.candidatesTokenCount ?? 0,
        total_tokens: usage.totalTokenCount ?? 0,
        purpose: "line_analysis",
      });
    }

    const parsed = JSON.parse(cleaned) as AILineResult;

    // Sanitize vocabulary: drop entries with romaji furigana or words that
    // don't appear in the lyric text (e.g. dictionary form instead of conjugated).
    parsed.vocabulary = (parsed.vocabulary ?? []).filter((v) => {
      if (!v.word || !japaneseText.includes(v.word)) return false;
      if (v.furigana && /[a-zA-Z]/.test(v.furigana)) return false;
      return true;
    });

    // Replace LLM vocab with cached dictionary entries where available,
    // and cache any new words
    const words = (parsed.vocabulary ?? []).map((v) => v.word).filter(Boolean);
    const cached = await lookupWords(words);

    const newWords: DictEntry[] = [];
    parsed.vocabulary = (parsed.vocabulary ?? []).map((v) => {
      const hit = cached.get(v.word);
      if (hit) {
        return { ...v, ...hit };
      }
      // New word — queue for caching
      newWords.push({
        word: v.word ?? "",
        furigana: v.furigana ?? "",
        english_meaning: v.english_meaning ?? "",
        part_of_speech: v.part_of_speech ?? "",
        grammar_notes: "",
        example_sentence: v.example_sentence ?? "",
        example_sentence_english: v.example_sentence_english ?? "",
      });
      return v;
    });

    if (newWords.length > 0) {
      await cacheWords(newWords);
    }

    parsed.grammar_points = parsed.grammar_points ?? [];
    return parsed;
  } catch {
    return EMPTY_RESULT;
  }
}

const DIFFICULTY_PROMPT = `You are a Japanese language difficulty assessor for language learners.
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

export async function assessDifficulty(
  lyrics: string[],
  vocab: { word: string; pos: string }[]
): Promise<{ difficulty: number; reason: string }> {
  try {
    const uniqueVocab = [...new Map(vocab.map((v) => [v.word, v])).values()];
    const summary = [
      "LYRICS:",
      ...lyrics,
      "",
      `VOCABULARY (${uniqueVocab.length} unique words):`,
      ...uniqueVocab.map((v) => `${v.word} [${v.pos}]`),
    ].join("\n");

    const result = await model.generateContent(`${DIFFICULTY_PROMPT}\n\n${summary}`);
    const text = result.response.text();
    const cleaned = text.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();

    const usage = result.response.usageMetadata;
    if (usage) {
      await logApiUsage({
        prompt_tokens: usage.promptTokenCount ?? 0,
        completion_tokens: usage.candidatesTokenCount ?? 0,
        total_tokens: usage.totalTokenCount ?? 0,
        purpose: "difficulty_assessment",
      });
    }

    const parsed = JSON.parse(cleaned) as { difficulty: number; reason: string };
    const d = parsed.difficulty;
    if (typeof d === "number" && d >= 1 && d <= 5 && Number.isInteger(d)) {
      return { difficulty: d, reason: parsed.reason ?? "" };
    }
    return { difficulty: 3, reason: "" };
  } catch {
    return { difficulty: 3, reason: "" };
  }
}

export async function analyzeAllLines(
  lines: ParsedLine[],
  onProgress?: (done: number, total: number) => void
): Promise<AILineResult[]> {
  const results: AILineResult[] = [];
  for (let i = 0; i < lines.length; i++) {
    const result = await analyzeLine(lines[i].japanese_text);
    results.push(result);
    onProgress?.(i + 1, lines.length);
    if (i < lines.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return results;
}
