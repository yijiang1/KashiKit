import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { analyzeLine } from "@/lib/ai/pipeline";
import { isLanguageId, DEFAULT_LANGUAGE } from "@/lib/languages";

export async function POST(req: NextRequest) {
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { japaneseText } = body;
  const language = isLanguageId(body.language) ? body.language : DEFAULT_LANGUAGE;
  if (!japaneseText || typeof japaneseText !== "string") {
    return NextResponse.json({ error: "japaneseText is required" }, { status: 400 });
  }

  const result = await analyzeLine(japaneseText, language);
  return NextResponse.json({ englishText: result.line_analysis?.literal_translation ?? "" });
}
