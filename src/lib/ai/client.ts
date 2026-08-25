import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";

// Pinned to the current stable Flash model. gemini-2.0-flash was retired by
// Google in 2026 and started returning 404s on generateContent — if analysis
// suddenly fails with 404s again, list available models and bump this.
// (The gemini-flash-latest alias avoids retirements but proved slow and
// erratic for structured output — it points at a heavy thinking model.)
export const GEMINI_MODEL = "gemini-2.5-flash";

// Lyric analysis is extraction, not reasoning — disable thinking for speed
// and cost. thinkingConfig isn't in this SDK's types but passes through to
// the REST API, which accepts it for 2.5-series models.
export const NO_THINKING = {
  thinkingConfig: { thinkingBudget: 0 },
} as unknown as GenerationConfig;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  generationConfig: { ...NO_THINKING },
});
