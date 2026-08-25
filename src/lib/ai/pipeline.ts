import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import type { AILineResult } from "@/types";
import { logApiUsage } from "./usage-tracker";
import { lookupWords, cacheWords, type DictEntry } from "./dictionary";
import { geminiModel as model, NO_THINKING } from "./client";
import { getLanguageConfig, type LanguageId } from "@/lib/languages";

// Lines analyzed per Gemini call. A vocab-dense line runs ~700 output tokens;
// 16 lines ≈ 11k tokens, well under the model's 65k output cap.
const BATCH_SIZE = 16;
const RETRY_BATCH_SIZE = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimit(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("quota");
  }
  return false;
}

export async function withRateLimitRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimit(err) && attempt < maxRetries) {
        console.warn(`Gemini rate limit hit — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

const EMPTY_RESULT: AILineResult = {
  line_analysis: { literal_translation: "", natural_translation: "" },
  vocabulary: [],
  grammar_points: [],
};

const LINE_ANALYSIS_SCHEMA: ResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      line_index: { type: SchemaType.INTEGER },
      literal_translation: { type: SchemaType.STRING },
      natural_translation: { type: SchemaType.STRING },
      vocabulary: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            word: { type: SchemaType.STRING },
            furigana: { type: SchemaType.STRING },
            english_meaning: { type: SchemaType.STRING },
            part_of_speech: { type: SchemaType.STRING },
            example_sentence: { type: SchemaType.STRING },
            example_sentence_english: { type: SchemaType.STRING },
          },
          required: ["word", "furigana", "english_meaning", "part_of_speech"],
        },
      },
      grammar_points: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            structure: { type: SchemaType.STRING },
            explanation: { type: SchemaType.STRING },
            example_sentence_jp: { type: SchemaType.STRING },
            example_sentence_en: { type: SchemaType.STRING },
          },
          required: ["structure", "explanation"],
        },
      },
    },
    required: ["line_index", "literal_translation", "natural_translation", "vocabulary", "grammar_points"],
  },
};

type RawLineAnalysis = {
  line_index: number;
  literal_translation: string;
  natural_translation: string;
  vocabulary: Array<{
    word: string;
    furigana: string;
    english_meaning: string;
    part_of_speech: string;
    example_sentence?: string;
    example_sentence_english?: string;
  }>;
  grammar_points: Array<{
    structure: string;
    explanation: string;
    example_sentence_jp?: string;
    example_sentence_en?: string;
  }>;
};

/**
 * Analyze one batch of line indices in a single Gemini call, with the full
 * song provided as context. Returns only the lines that came back valid —
 * missing entries are the caller's signal to retry.
 */
async function analyzeBatch(
  allLines: string[],
  indices: number[],
  language: LanguageId
): Promise<Map<number, AILineResult>> {
  const numbered = allLines.map((line, i) => `${i}: ${line}`).join("\n");
  const prompt = `${getLanguageConfig(language).ai.analysisRules}

FULL SONG LYRICS (numbered):
${numbered}

Analyze ONLY these lines: ${indices.join(", ")}
Return a JSON array with exactly one entry per requested line, each carrying its line_index.`;

  const result = await withRateLimitRetry(() =>
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // Per-request generationConfig replaces the model-level default,
      // so the no-thinking override must be repeated here.
      generationConfig: {
        ...NO_THINKING,
        responseMimeType: "application/json",
        responseSchema: LINE_ANALYSIS_SCHEMA,
        maxOutputTokens: 32768,
      },
    })
  );

  const usage = result.response.usageMetadata;
  if (usage) {
    await logApiUsage({
      prompt_tokens: usage.promptTokenCount ?? 0,
      completion_tokens: usage.candidatesTokenCount ?? 0,
      total_tokens: usage.totalTokenCount ?? 0,
      purpose: "line_analysis",
    });
  }

  const parsed = JSON.parse(result.response.text()) as RawLineAnalysis[];
  const wanted = new Set(indices);
  const out = new Map<number, AILineResult>();

  for (const entry of parsed) {
    const i = entry.line_index;
    if (!wanted.has(i) || out.has(i)) {
      console.warn(`Batch analysis: dropping entry with ${out.has(i) ? "duplicate" : "unrequested"} line_index ${i}`);
      continue;
    }
    if (typeof entry.literal_translation !== "string" || !entry.literal_translation.trim()) {
      console.warn(`Batch analysis: dropping line ${i} with empty literal_translation`);
      continue;
    }
    const lineText = allLines[i];

    // Drop words that don't appear in the lyric (e.g. dictionary form instead
    // of the conjugated form). Japanese furigana must be hiragana — reject any
    // that leaked romaji; Chinese furigana IS Latin-script pinyin, so that
    // check only applies to Japanese.
    const vocabulary = (entry.vocabulary ?? [])
      .filter((v) => {
        if (!v.word || !lineText.includes(v.word)) return false;
        if (language === "ja" && v.furigana && /[a-zA-Z]/.test(v.furigana)) return false;
        return true;
      })
      .map((v) => ({
        word: v.word,
        furigana: v.furigana ?? "",
        english_meaning: v.english_meaning ?? "",
        part_of_speech: v.part_of_speech ?? "",
        grammar_notes: "",
        example_sentence: v.example_sentence ?? "",
        example_sentence_english: v.example_sentence_english ?? "",
      }));

    const grammar_points = (entry.grammar_points ?? [])
      .filter((gp) => gp.structure)
      .map((gp) => ({
        structure: gp.structure,
        explanation: gp.explanation ?? "",
        example_sentence_jp: gp.example_sentence_jp ?? "",
        example_sentence_en: gp.example_sentence_en ?? "",
      }));

    out.set(i, {
      line_analysis: {
        literal_translation: entry.literal_translation.trim(),
        natural_translation: (entry.natural_translation ?? "").trim(),
      },
      vocabulary,
      grammar_points,
    });
  }

  return out;
}

export type SongAnalysis = {
  results: AILineResult[]; // parallel to the input lines; failed lines hold an empty result
  failedIndices: number[]; // lines that still had no valid analysis after the retry pass
};

/**
 * Analyze all lines of a song in batched Gemini calls with full-song context.
 * Lines that fail (bad JSON, truncated output, missing from the response) get
 * one retry pass in smaller batches; anything still missing is reported in
 * failedIndices rather than silently stored blank.
 */
export async function analyzeSong(
  lines: string[],
  language: LanguageId = "ja",
  onProgress?: (done: number, total: number) => void
): Promise<SongAnalysis> {
  const results = new Map<number, AILineResult>();
  const allIndices = lines.map((_, i) => i);

  async function runPass(indices: number[], batchSize: number): Promise<void> {
    for (let i = 0; i < indices.length; i += batchSize) {
      const batch = indices.slice(i, i + batchSize);
      try {
        const analyzed = await analyzeBatch(lines, batch, language);
        for (const [idx, res] of analyzed) results.set(idx, res);
      } catch (err) {
        console.warn(`Batch analysis failed for lines ${batch[0]}–${batch[batch.length - 1]}:`, err);
      }
      onProgress?.(Math.min(results.size, lines.length), lines.length);
      if (i + batchSize < indices.length) await sleep(500);
    }
  }

  await runPass(allIndices, BATCH_SIZE);

  let failed = allIndices.filter((i) => !results.has(i));
  if (failed.length > 0) {
    await runPass(failed, RETRY_BATCH_SIZE);
    failed = allIndices.filter((i) => !results.has(i));
  }

  // Merge the dictionary cache once for the whole song: cached entries win,
  // new words get cached for future imports.
  const allWords = [...results.values()].flatMap((r) => r.vocabulary.map((v) => v.word));
  const cached = await lookupWords([...new Set(allWords)], language);
  const newWords = new Map<string, DictEntry>();
  for (const res of results.values()) {
    res.vocabulary = res.vocabulary.map((v) => {
      const hit = cached.get(v.word);
      if (hit) return { ...v, ...hit };
      if (!newWords.has(v.word)) newWords.set(v.word, { ...v });
      return v;
    });
  }
  if (newWords.size > 0) {
    await cacheWords([...newWords.values()], language);
  }

  return {
    results: allIndices.map((i) => results.get(i) ?? EMPTY_RESULT),
    failedIndices: failed,
  };
}

/** Single-line convenience wrapper used by the admin retranslate/backfill routes. */
export async function analyzeLine(text: string, language: LanguageId = "ja"): Promise<AILineResult> {
  const { results } = await analyzeSong([text], language);
  return results[0];
}

export async function assessDifficulty(
  lyrics: string[],
  vocab: { word: string; pos: string }[],
  language: LanguageId = "ja"
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

    const difficultyPrompt = getLanguageConfig(language).ai.difficultyPrompt;
    const result = await withRateLimitRetry(() => model.generateContent(`${difficultyPrompt}\n\n${summary}`));
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
