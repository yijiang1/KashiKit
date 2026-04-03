import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import StudyLayout from "@/components/study/StudyLayout";
import { isAdmin } from "@/lib/admin";
import type { Song, LyricLine, Vocabulary } from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ songId: string; day: string }>;
}

export default async function StudyPage({ params }: Props) {
  const { songId, day: dayStr } = await params;
  const day = parseInt(dayStr, 10);

  if (isNaN(day) || day < 1) notFound();

  const song = await queryOne<Song>("SELECT * FROM songs WHERE id = ?", [songId]);
  if (!song) notFound();

  const lesson = await queryOne<{ id: string; song_id: string; day_number: number }>(
    "SELECT * FROM lessons WHERE song_id = ? AND day_number = ?",
    [songId, day]
  );
  if (!lesson) notFound();

  const rawLines = await query<Record<string, unknown>>(
    "SELECT * FROM lyric_lines WHERE lesson_id = ? ORDER BY start_time ASC",
    [lesson.id]
  );

  const vocab = await query<Vocabulary & { lyric_line_id: string }>(
    "SELECT * FROM vocabulary WHERE lyric_line_id IN (SELECT id FROM lyric_lines WHERE lesson_id = ?)",
    [lesson.id]
  );

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

  const quizRow = await queryOne<{ lesson_id: string }>(
    "SELECT lesson_id FROM quizzes WHERE lesson_id = ?",
    [lesson.id]
  );

  return (
    <StudyLayout
      song={song}
      lines={lines}
      day={day}
      lessonId={lesson.id}
      isAdmin={isAdmin}
      hasQuiz={!!quizRow}
    />
  );
}
