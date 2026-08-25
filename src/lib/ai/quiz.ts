import { logApiUsage } from "./usage-tracker";
import { withRateLimitRetry } from "./pipeline";
import { geminiModel as model } from "./client";
import { getLanguageConfig, type LanguageId } from "@/lib/languages";

export type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

export async function generateQuizQuestions(
  lyricsContext: string,
  vocabList: { word: string; furigana: string; meaning: string; pos: string }[],
  language: LanguageId = "ja"
): Promise<QuizQuestion[]> {
  const langConfig = getLanguageConfig(language);
  const prompt = `You are a ${langConfig.ai.quizPersona}. Based on the vocabulary and lyrics below, create a quiz with exactly 5 questions.

Lyrics studied:
${lyricsContext}

Vocabulary:
${vocabList.map((v) => `${v.word} (${v.furigana}) = ${v.meaning} [${v.pos}]`).join("\n")}

Create 5 multiple-choice questions mixing these types:
- "What does [${langConfig.label} word] mean?" (test meaning)
- "${langConfig.ai.quizReadingQuestion}" (test reading/${langConfig.readingLabel.toLowerCase()})
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

  const result = await withRateLimitRetry(() => model.generateContent(prompt));
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

  const questions = JSON.parse(cleaned) as QuizQuestion[];
  const valid = validate(questions);
  if (valid.length === 0) {
    throw new Error("Quiz generation returned no valid questions");
  }
  return valid;
}

// Drop structurally broken questions rather than guessing the correct answer —
// substring-matching options against the explanation can flip right answers to
// wrong ones (e.g. an explanation that mentions a distractor, or 空 inside 空気).
function validate(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.filter(
    (q) =>
      typeof q.question === "string" &&
      q.question.trim().length > 0 &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      q.options.every((o) => typeof o === "string" && o.trim().length > 0) &&
      new Set(q.options).size === q.options.length &&
      Number.isInteger(q.correct) &&
      q.correct >= 0 &&
      q.correct < q.options.length
  );
}
