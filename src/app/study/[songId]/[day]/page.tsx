import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import StudyLayout from "@/components/study/StudyLayout";
import type { Song, LyricLine, Vocabulary } from "@/types";

interface Props {
  params: Promise<{ songId: string; day: string }>;
}

export default async function StudyPage({ params }: Props) {
  const { songId, day: dayStr } = await params;
  const day = parseInt(dayStr, 10);

  if (isNaN(day) || day < 1) notFound();

  const db = getDb();

  // Fetch song
  const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(songId) as Song | undefined;
  if (!song) notFound();

  // Fetch lesson for this day
  const lesson = db.prepare("SELECT * FROM lessons WHERE song_id = ? AND day_number = ?").get(songId, day) as { id: string; song_id: string; day_number: number } | undefined;
  if (!lesson) notFound();

  // Fetch lyric lines with vocabulary
  const rawLines = db
    .prepare("SELECT * FROM lyric_lines WHERE lesson_id = ? ORDER BY start_time ASC")
    .all(lesson.id) as Record<string, unknown>[];

  const vocab = db
    .prepare("SELECT * FROM vocabulary WHERE lyric_line_id IN (SELECT id FROM lyric_lines WHERE lesson_id = ?)")
    .all(lesson.id) as (Vocabulary & { lyric_line_id: string })[];

  const vocabByLine = new Map<string, Vocabulary[]>();
  for (const v of vocab) {
    const lineId = v.lyric_line_id;
    if (!vocabByLine.has(lineId)) vocabByLine.set(lineId, []);
    vocabByLine.get(lineId)!.push(v);
  }

  const lines: LyricLine[] = rawLines.map((line) => ({
    ...(line as unknown as LyricLine),
    vocabulary: vocabByLine.get(line.id as string) ?? [],
  }));

  // Check if already completed
  const completionCount = db
    .prepare("SELECT COUNT(*) as cnt FROM lesson_completions WHERE lesson_id = ?")
    .get(lesson.id) as { cnt: number };

  const alreadyCompleted = completionCount.cnt > 0;

  return (
    <StudyLayout
      song={song}
      lines={lines}
      day={day}
      lessonId={lesson.id}
      alreadyCompleted={alreadyCompleted}
    />
  );
}
