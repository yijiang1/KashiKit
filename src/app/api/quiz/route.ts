import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logApiUsage } from "@/lib/ai/usage-tracker";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function GET(req: NextRequest) {
  const lessonId = req.nextUrl.searchParams.get("lessonId");
  if (!lessonId) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 });
  }

  const db = getDb();

  const lines = db
    .prepare("SELECT japanese_text, english_text, id FROM lyric_lines WHERE lesson_id = ? ORDER BY start_time ASC")
    .all(lessonId) as { japanese_text: string; english_text: string; id: string }[];

  if (!lines || lines.length === 0) {
    return NextResponse.json({ error: "No lines found" }, { status: 404 });
  }

  const lineIds = lines.map((l) => l.id);
  const vocab = db
    .prepare(`SELECT word, furigana, english_meaning, part_of_speech, grammar_notes, lyric_line_id FROM vocabulary WHERE lyric_line_id IN (${lineIds.map(() => "?").join(",")})`)
    .all(...lineIds) as { word: string; furigana: string; english_meaning: string; part_of_speech: string; grammar_notes: string; lyric_line_id: string }[];

  const vocabList = vocab.map((v) => ({
    word: v.word,
    furigana: v.furigana,
    meaning: v.english_meaning,
    pos: v.part_of_speech,
  }));

  const lyricsContext = lines
    .map((l) => `${l.japanese_text} → ${l.english_text}`)
    .join("\n");

  const prompt = `You are a Japanese language quiz master. Based on the vocabulary and lyrics below, create a quiz with exactly 5 questions.

Lyrics studied:
${lyricsContext}

Vocabulary:
${vocabList.map((v) => `${v.word} (${v.furigana}) = ${v.meaning} [${v.pos}]`).join("\n")}

Create 5 multiple-choice questions mixing these types:
- "What does [Japanese word] mean?" (test meaning)
- "How do you read [kanji word]?" (test reading/furigana)
- "Which word means [English meaning]?" (reverse lookup)
- "Complete the lyric: [partial line]" (context recall)

Rules:
- Each question has exactly 4 options (A, B, C, D)
- Exactly 1 correct answer per question
- Wrong options should be plausible but clearly wrong
- Use vocabulary from the list above
- Return ONLY valid JSON, no markdown, no code fences

Return this exact JSON structure:
[
  {
    "question": "the question text",
    "options": ["A", "B", "C", "D"],
    "correct": 0,
    "explanation": "brief explanation of the correct answer"
  }
]

The "correct" field is the 0-based index of the correct option.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();

    const usage = result.response.usageMetadata;
    if (usage) {
      await logApiUsage({
        prompt_tokens: usage.promptTokenCount ?? 0,
        completion_tokens: usage.candidatesTokenCount ?? 0,
        total_tokens: usage.totalTokenCount ?? 0,
        purpose: "quiz_generation",
      });
    }

    const questions = JSON.parse(cleaned);
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}
