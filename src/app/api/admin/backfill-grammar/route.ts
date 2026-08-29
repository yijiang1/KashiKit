import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { query, run, uuid } from "@/lib/db";
import { analyzeLine } from "@/lib/ai/pipeline";
import { DEFAULT_LANGUAGE, isLanguageId } from "@/lib/languages";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 50, 200);

  // Lines that have vocabulary but no grammar_points yet
  const lines = await query<{ id: string; japanese_text: string; language: string }>(
    `SELECT ll.id, ll.japanese_text, s.language
     FROM lyric_lines ll
     JOIN lessons l ON ll.lesson_id = l.id
     JOIN songs s ON l.song_id = s.id
     WHERE EXISTS     (SELECT 1 FROM vocabulary     v  WHERE v.lyric_line_id  = ll.id)
       AND NOT EXISTS (SELECT 1 FROM grammar_points gp WHERE gp.lyric_line_id = ll.id)
     LIMIT ?`,
    [limit]
  );

  const [{ cnt: totalRemaining }] = await query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt
     FROM lyric_lines ll
     WHERE EXISTS     (SELECT 1 FROM vocabulary     v  WHERE v.lyric_line_id  = ll.id)
       AND NOT EXISTS (SELECT 1 FROM grammar_points gp WHERE gp.lyric_line_id = ll.id)`
  );

  let processed = 0;
  for (const line of lines) {
    try {
      const language = isLanguageId(line.language) ? line.language : DEFAULT_LANGUAGE;
      const result = await analyzeLine(line.japanese_text, language);
      const points = (result.grammar_points ?? []).filter((gp) => gp.structure);
      if (points.length > 0) {
        for (const gp of points) {
          await run(
            "INSERT INTO grammar_points (id, lyric_line_id, structure, explanation, example_sentence_jp, example_sentence_en) VALUES (?, ?, ?, ?, ?, ?)",
            [uuid(), line.id, gp.structure, gp.explanation ?? "", gp.example_sentence_jp ?? "", gp.example_sentence_en ?? ""]
          );
        }
      } else {
        // Insert sentinel so this line is not retried on future backfill runs
        await run(
          "INSERT INTO grammar_points (id, lyric_line_id, structure) VALUES (?, ?, '_none')",
          [uuid(), line.id]
        );
      }
      processed++;
    } catch {
      // Skip failed lines, continue batch
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (processed > 0) {
    try {
      revalidatePath("/grammar");
    } catch (err) {
      console.error("revalidatePath failed (non-fatal):", err);
    }
  }

  return NextResponse.json({
    processed,
    remaining: Math.max(0, Number(totalRemaining) - processed),
  });
}
