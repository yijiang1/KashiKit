export type ParsedLine = {
  start_time: number;
  end_time: number;
  japanese_text: string;
};

// Matches [mm:ss.xx] or [mm:ss.xxx] timestamp prefix (minutes can be any length)
const TIMESTAMP_REGEX = /^\[(\d+):(\d{2})\.(\d{2,3})\](.*)$/;

function parseTimestamp(minutes: string, seconds: string, centiseconds: string): number {
  const cs = centiseconds.length === 2
    ? parseInt(centiseconds) / 100
    : parseInt(centiseconds) / 1000;
  return parseInt(minutes) * 60 + parseInt(seconds) + cs;
}

export function parseLRC(lrcContent: string): ParsedLine[] {
  const raw: Array<{ timestamp: number; text: string }> = [];

  for (const line of lrcContent.split("\n")) {
    const match = line.trim().match(TIMESTAMP_REGEX);
    if (!match) continue;

    const [, mm, ss, cs, text] = match;
    const trimmedText = text.trim();
    if (!trimmedText) continue; // skip blank/interlude lines

    raw.push({
      timestamp: parseTimestamp(mm, ss, cs),
      text: trimmedText,
    });
  }

  // Sort ascending by timestamp (some LRC files are out of order)
  raw.sort((a, b) => a.timestamp - b.timestamp);

  // Build final lines with end_time = next line's start_time
  return raw.map((entry, i) => ({
    start_time: entry.timestamp,
    end_time: i < raw.length - 1 ? raw[i + 1].timestamp : entry.timestamp + 4,
    japanese_text: entry.text,
  }));
}

export function distributeLines(lines: ParsedLine[], dayCount: number): ParsedLine[][] {
  const chunkSize = Math.ceil(lines.length / dayCount);
  const chunks: ParsedLine[][] = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize));
  }
  return chunks;
}
