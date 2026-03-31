import { GoogleGenerativeAI } from "@google/generative-ai";
import { logApiUsage } from "./usage-tracker";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

export async function generateQuizQuestions(
  lyricsContext: string,
  vocabList: { word: string; furigana: string; meaning: string; pos: string }[]
): Promise<QuizQuestion[]> {
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

  return JSON.parse(cleaned) as QuizQuestion[];
}
