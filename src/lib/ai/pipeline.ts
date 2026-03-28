import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AILineResult } from "@/types";
import type { ParsedLine } from "@/lib/lrc/parser";
import { logApiUsage } from "./usage-tracker";
import { lookupWords, cacheWords, type DictEntry } from "./dictionary";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const VOCAB_SCHEMA = `
    {
      "word": "the Japanese word/phrase (kanji or kana as it appears)",
      "furigana": "reading in hiragana",
      "english_meaning": "dictionary meaning",
      "part_of_speech": "one of: noun, verb, adjective, adverb, expression, other",
      "grammar_notes": "brief grammar note if relevant, empty string if not",
      "example_sentence": "a simple example sentence in Japanese using this word",
      "example_sentence_english": "English translation of the example sentence"
    }`;

const SYSTEM_PROMPT = `You are a Japanese language teacher. Analyze the following Japanese song lyric line.
Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "english": "<translate the Japanese line into natural English here>",
  "vocabulary": [${VOCAB_SCHEMA}]
}
IMPORTANT: The "english" field MUST contain an actual English translation of the Japanese text, not a placeholder.

For "vocabulary", extract EVERY content word in the line — be exhaustive:
- Include ALL nouns, verbs (dictionary form), i-adjectives, na-adjectives, adverbs, and set expressions
- Include compound words and compound verbs as a single entry (e.g. 歩き回る, 行き止まり)
- Include common words too — 空, 心, 夜, 好き, 思う, etc. are all worth explaining
- Use the word EXACTLY as it appears in the lyric (not the dictionary form), so it can be highlighted
- Only skip: bare grammatical particles (は が を に で へ と から まで より も), the copula alone (だ です), and standalone sentence-final particles (よ ね な)
- When in doubt, include the word`;

export async function analyzeLine(japaneseText: string): Promise<AILineResult> {
  try {
    const prompt = `${SYSTEM_PROMPT}\n\n${japaneseText}`;
    const result = await model.generateContent(prompt);
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

    // Replace LLM vocab with cached dictionary entries where available,
    // and cache any new words
    const words = parsed.vocabulary.map((v) => v.word).filter(Boolean);
    const cached = await lookupWords(words);

    const newWords: DictEntry[] = [];
    parsed.vocabulary = parsed.vocabulary.map((v) => {
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
        grammar_notes: v.grammar_notes ?? "",
        example_sentence: v.example_sentence ?? "",
        example_sentence_english: v.example_sentence_english ?? "",
      });
      return v;
    });

    if (newWords.length > 0) {
      await cacheWords(newWords);
    }

    return parsed;
  } catch {
    return { english: "", vocabulary: [] };
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
