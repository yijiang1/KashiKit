import { NextRequest, NextResponse } from "next/server";
import { SchemaType, type ResponseSchema, type GenerationConfig } from "@google/generative-ai";
import { query, queryOne, run, uuid } from "@/lib/db";
import { geminiModel as model } from "@/lib/ai/client";
import { withRateLimitRetry } from "@/lib/ai/pipeline";
import { logApiUsage } from "@/lib/ai/usage-tracker";
import { getLanguageConfig, isLanguageId } from "@/lib/languages";
import type { PitchAttempt, PitchAttemptFeedback } from "@/types";

export const maxDuration = 60;

// ~6MB decoded — a short a-cappella line clip is nowhere near this; it's just
// a fail-fast guard against a runaway or mistagged recording before spending
// a Gemini call on it.
const MAX_BASE64_LENGTH = 8_000_000;

const FEEDBACK_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overallScore: { type: SchemaType.INTEGER },
    summary: { type: SchemaType.STRING },
    tips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    wordNotes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          word: { type: SchemaType.STRING },
          note: { type: SchemaType.STRING },
        },
        required: ["word", "note"],
      },
    },
  },
  required: ["overallScore", "summary", "tips", "wordNotes"],
};

type LineRow = {
  japanese_text: string;
  english_text: string;
  language: string;
};

type VocabRow = { word: string; furigana: string };

type AttemptRow = {
  id: string;
  created_at: string;
  score: number | null;
  feedback: string;
};

type RawFeedback = {
  overallScore: number;
  summary: string;
  tips: string[];
  wordNotes: { word: string; note: string }[];
};

function toAttempt(row: AttemptRow): PitchAttempt {
  let feedback: PitchAttemptFeedback;
  try {
    feedback = JSON.parse(row.feedback);
  } catch {
    feedback = { summary: "", tips: [], wordNotes: [] };
  }
  return { id: row.id, created_at: row.created_at, score: row.score, feedback };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await params;
  const rows = await query<AttemptRow>(
    "SELECT id, created_at, score, feedback FROM pitch_attempts WHERE lyric_line_id = ? ORDER BY created_at DESC LIMIT 20",
    [lineId]
  );
  return NextResponse.json({ attempts: rows.map(toAttempt) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await params;
  const { audioBase64 } = await req.json();

  if (typeof audioBase64 !== "string" || !audioBase64) {
    return NextResponse.json({ error: "Missing audioBase64" }, { status: 400 });
  }
  if (audioBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "Recording too large" }, { status: 400 });
  }

  const line = await queryOne<LineRow>(
    `SELECT ll.japanese_text, ll.english_text, s.language
     FROM lyric_lines ll
     JOIN lessons le ON ll.lesson_id = le.id
     JOIN songs s ON le.song_id = s.id
     WHERE ll.id = ?`,
    [lineId]
  );
  if (!line) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }

  const language = isLanguageId(line.language) ? line.language : "ja";
  const langConfig = getLanguageConfig(language);

  const vocab = await query<VocabRow>("SELECT word, furigana FROM vocabulary WHERE lyric_line_id = ?", [lineId]);
  const readingHints = vocab
    .filter((v) => v.furigana)
    .map((v) => `${v.word} (${v.furigana})`)
    .join(", ");

  const prompt = `${langConfig.ai.pronunciationRules}

Target line (${langConfig.label}): "${line.japanese_text}"
${readingHints ? `Reference readings for key words: ${readingHints}` : ""}
English meaning: ${line.english_text}

The attached audio is a learner speaking or singing this line a cappella (the backing track was paused while recording). Assess ONLY pronunciation and tone/pitch-accent correctness — do not evaluate singing melody, rhythm, or musicality.`;

  let parsed: RawFeedback;
  try {
    const result = await withRateLimitRetry(() =>
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, { inlineData: { mimeType: "audio/wav", data: audioBase64 } }],
          },
        ],
        // Deliberately NOT fully disabling thinking here (unlike line
        // analysis, which is pure extraction) — judging pronunciation/tone
        // from audio is a genuine perceptual+linguistic judgment call. But
        // dynamic thinking with no cap was observed burning the *entire*
        // token budget on thoughtsTokenCount and truncating the JSON output
        // (finishReason MAX_TOKENS with the response cut off mid-string) —
        // maxOutputTokens caps thinking + output tokens together, not just
        // the visible response. Capping the thinking budget guarantees room
        // for the (small) JSON output regardless of how long the model wants
        // to deliberate.
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: FEEDBACK_SCHEMA,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 512 },
        } as unknown as GenerationConfig,
      })
    );

    const usage = result.response.usageMetadata;
    if (usage) {
      await logApiUsage({
        prompt_tokens: usage.promptTokenCount ?? 0,
        completion_tokens: usage.candidatesTokenCount ?? 0,
        total_tokens: usage.totalTokenCount ?? 0,
        purpose: "pronunciation_feedback",
      });
    }

    parsed = JSON.parse(result.response.text());
  } catch (err) {
    console.error("Pronunciation analysis failed:", err);
    return NextResponse.json({ error: "Analysis failed — please try again." }, { status: 502 });
  }

  const score = Number.isInteger(parsed.overallScore) ? Math.max(0, Math.min(100, parsed.overallScore)) : null;
  const feedback: PitchAttemptFeedback = {
    summary: parsed.summary ?? "",
    tips: Array.isArray(parsed.tips) ? parsed.tips : [],
    wordNotes: Array.isArray(parsed.wordNotes) ? parsed.wordNotes : [],
  };

  const id = uuid();
  await run("INSERT INTO pitch_attempts (id, lyric_line_id, score, feedback) VALUES (?, ?, ?, ?)", [
    id,
    lineId,
    score,
    JSON.stringify(feedback),
  ]);
  const saved = await queryOne<AttemptRow>(
    "SELECT id, created_at, score, feedback FROM pitch_attempts WHERE id = ?",
    [id]
  );

  return NextResponse.json(toAttempt(saved!));
}
