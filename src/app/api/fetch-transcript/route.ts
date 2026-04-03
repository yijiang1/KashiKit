import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractYouTubeId } from "@/lib/youtube/loader";
import { logApiUsage } from "@/lib/ai/usage-tracker";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
// Using 2.0 Flash for grouping — upgrade to "gemini-1.5-pro" if grouping quality is poor
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

type TranscriptItem = { offset: number; duration: number; text: string };
type GroupedSegment = { offset: number; text: string };

/**
 * Use Gemini to group raw caption segments into natural lyric lines.
 * Falls back to a simple gap-based split if the LLM call fails.
 */
async function groupSegmentsWithLLM(items: TranscriptItem[]): Promise<GroupedSegment[]> {
  if (items.length === 0) return [];

  // Build a numbered list for the LLM
  const numbered = items
    .map((item, i) => `${i}: ${item.text.trim()}`)
    .join("\n");

  const prompt = `These are raw auto-caption segments from a Japanese song. Each segment is a sentence fragment.
Your job: merge consecutive fragments into exactly ONE complete Japanese sentence per group.

Rules:
- One group = one grammatically complete Japanese sentence
- A sentence ends at: 。！？♪ or a clear grammatical endpoint (verb/adjective ending a clause)
- If a segment is already a complete sentence on its own, it stays alone
- Never merge two separate sentences into one group
- Never split one sentence across two groups

Return ONLY a JSON array of arrays of segment indices, no explanation.
Example: [[0,1,2],[3],[4,5],[6,7,8]]

Segments:
${numbered}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
    const groups: number[][] = JSON.parse(cleaned);

    // Log API usage for segment grouping
    const usage = result.response.usageMetadata;
    if (usage) {
      await logApiUsage({
        prompt_tokens: usage.promptTokenCount ?? 0,
        completion_tokens: usage.candidatesTokenCount ?? 0,
        total_tokens: usage.totalTokenCount ?? 0,
        purpose: "segment_grouping",
      });
    }

    return groups
      .filter((g) => g.length > 0)
      .map((indices) => ({
        offset: items[indices[0]].offset,
        text: indices.map((i) => items[i].text.trim()).join(""),
      }));
  } catch {
    // Fallback: split on gaps > 600ms
    const groups: GroupedSegment[] = [];
    let currentText = items[0].text.trim();
    let currentOffset = items[0].offset;
    for (let i = 1; i < items.length; i++) {
      const gap = items[i].offset - (items[i - 1].offset + items[i - 1].duration);
      if (gap > 600) {
        groups.push({ offset: currentOffset, text: currentText });
        currentText = items[i].text.trim();
        currentOffset = items[i].offset;
      } else {
        currentText += items[i].text.trim();
      }
    }
    if (currentText) groups.push({ offset: currentOffset, text: currentText });
    return groups;
  }
}

function msToLRCTimestamp(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `[${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}]`;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  const videoId = extractYouTubeId(url);

  if (!videoId) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  try {
    // Fetch Japanese captions
    let jpRaw: TranscriptItem[] = [];
    try {
      jpRaw = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ja" });
    } catch {
      // lang=ja not available; try default and verify it's actually Japanese
      try {
        const fallback = await YoutubeTranscript.fetchTranscript(videoId);
        const isJapanese = fallback.some((item) => /[\u3040-\u30FF\u4E00-\u9FFF]/.test(item.text));
        if (isJapanese) jpRaw = fallback;
      } catch {
        // no captions at all
      }
    }

    if (!jpRaw || jpRaw.length === 0) {
      return NextResponse.json({ error: "No Japanese captions found for this video" }, { status: 404 });
    }

    // Use LLM to group fragments into natural phrases
    const jpGroups = await groupSegmentsWithLLM(jpRaw);

    // Try to fetch English captions for free translations
    let enRaw: TranscriptItem[] = [];
    try {
      enRaw = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    } catch {
      // No English captions — AI will handle translation
    }
    const enGroups = enRaw.length > 0 ? await groupSegmentsWithLLM(enRaw) : [];

    // Match each grouped JP line to the nearest grouped EN line by timestamp
    const translations: string[] = jpGroups.map((jpItem) => {
      if (enGroups.length === 0) return "";
      const nearest = enGroups.reduce((best, enItem) =>
        Math.abs(enItem.offset - jpItem.offset) < Math.abs(best.offset - jpItem.offset)
          ? enItem
          : best
      );
      // Only use if within 3 seconds of the JP group start
      return Math.abs(nearest.offset - jpItem.offset) < 3000 ? nearest.text : "";
    });

    const hasEnglish = translations.some((t) => t.length > 0);

    const lrc = jpGroups
      .map((item) => `${msToLRCTimestamp(item.offset)}${item.text}`)
      .join("\n");

    return NextResponse.json({
      lrc,
      translations,
      hasEnglish,
      lineCount: jpGroups.length,
      rawLineCount: jpRaw.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not fetch captions. The video may have captions disabled." },
      { status: 404 }
    );
  }
}
