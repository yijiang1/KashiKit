import { getDb, uuid } from "@/lib/db";

export async function logApiUsage(data: {
  model?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  purpose: string;
}) {
  try {
    const db = getDb();
    db.prepare(
      "INSERT INTO api_usage (id, model, prompt_tokens, completion_tokens, total_tokens, purpose) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      uuid(),
      data.model ?? "gemini-2.0-flash",
      data.prompt_tokens,
      data.completion_tokens,
      data.total_tokens,
      data.purpose
    );
  } catch {
    // Don't let usage tracking failures break the main flow
  }
}
