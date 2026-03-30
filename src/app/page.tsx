import { getDb } from "@/lib/db";
import SongGrid from "@/components/dashboard/SongGrid";
import type { Song } from "@/types";

export const revalidate = 0;

export default async function DashboardPage() {
  const db = getDb();

  const songs = db.prepare("SELECT * FROM songs ORDER BY created_at DESC").all() as Song[];
  const completions = db.prepare("SELECT completed_at, lesson_id FROM lesson_completions").all() as { completed_at: string; lesson_id: string }[];
  const lessons = db.prepare("SELECT id, song_id FROM lessons").all() as { id: string; song_id: string }[];

  const allCompletions = completions ?? [];
  const completedLessonIds = new Set(allCompletions.map((c) => c.lesson_id));

  // Build per-song completed day count
  const lessonsBySong = (lessons ?? []).reduce<Record<string, string[]>>((acc, l) => {
    acc[l.song_id] = acc[l.song_id] ?? [];
    acc[l.song_id].push(l.id);
    return acc;
  }, {});

  const completedDaysBySong = Object.fromEntries(
    Object.entries(lessonsBySong).map(([songId, ids]) => [
      songId,
      ids.filter((id) => completedLessonIds.has(id)).length,
    ])
  );

  const songList: Song[] = songs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your songs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {songList.length === 0
              ? "Import a song to generate your first course"
              : `${songList.length} song${songList.length !== 1 ? "s" : ""} in your library`}
          </p>
        </div>
      </div>

      <SongGrid songs={songList} completedDaysBySong={completedDaysBySong} />
    </div>
  );
}
