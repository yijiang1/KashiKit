import { query } from "@/lib/db";
import SongGrid from "@/components/dashboard/SongGrid";
import { isAdmin } from "@/lib/admin";
import type { Song } from "@/types";

export const revalidate = 0;

export default async function DashboardPage() {
  const songs = await query<Song>("SELECT * FROM songs ORDER BY created_at DESC");
  const lessons = await query<{ id: string; song_id: string }>("SELECT id, song_id FROM lessons");

  // Pass lesson IDs per song to the client so it can compute completions from LocalStorage
  const lessonsBySong = (lessons ?? []).reduce<Record<string, string[]>>((acc, l) => {
    acc[l.song_id] = acc[l.song_id] ?? [];
    acc[l.song_id].push(l.id);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your songs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {songs.length === 0
              ? "Import a song to generate your first course"
              : `${songs.length} song${songs.length !== 1 ? "s" : ""} in your library`}
          </p>
        </div>
      </div>

      <SongGrid songs={songs} lessonsBySong={lessonsBySong} isAdmin={isAdmin} />
    </div>
  );
}
