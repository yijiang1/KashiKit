import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { analyzeLine } from "@/lib/ai/pipeline";
import { isLanguageId, DEFAULT_LANGUAGE } from "@/lib/languages";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { japaneseText } = body;
  const language = isLanguageId(body.language) ? body.language : DEFAULT_LANGUAGE;
  if (!japaneseText || typeof japaneseText !== "string") {
    return NextResponse.json({ error: "japaneseText is required" }, { status: 400 });
  }

  const result = await analyzeLine(japaneseText, language);
  return NextResponse.json({ englishText: result.line_analysis?.literal_translation ?? "" });
}
