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
  // Parse ALL timestamp lines, including blank ones (instrumental markers)
  const all: Array<{ timestamp: number; text: string }> = [];

  for (const line of lrcContent.split("\n")) {
    const match = line.trim().match(TIMESTAMP_REGEX);
    if (!match) continue;

    const [, mm, ss, cs, text] = match;
    all.push({
      timestamp: parseTimestamp(mm, ss, cs),
      text: text.trim(),
    });
  }

  // Sort ascending by timestamp (some LRC files are out of order)
  all.sort((a, b) => a.timestamp - b.timestamp);

  // Build lyric lines; use the next timestamp (lyric or blank) as end_time
  // so blank interlude markers correctly bound the singing duration
  const result: ParsedLine[] = [];
  for (let i = 0; i < all.length; i++) {
    if (!all[i].text) continue; // skip blank lines as output, but they still inform end_time below

    // Find the next timestamp (blank or lyric) to use as end_time
    const nextTimestamp = i < all.length - 1 ? all[i + 1].timestamp : all[i].timestamp + 4;

    result.push({
      start_time: all[i].timestamp,
      end_time: nextTimestamp,
      japanese_text: all[i].text,
    });
  }

  return result;
}

export function distributeLines(lines: ParsedLine[], dayCount: number): ParsedLine[][] {
  const chunkSize = Math.ceil(lines.length / dayCount);
  const chunks: ParsedLine[][] = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize));
  }
  return chunks;
}
