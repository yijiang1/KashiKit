import { query } from "@/lib/db";
import SongGrid from "@/components/dashboard/SongGrid";
import { isAdmin } from "@/lib/admin";
import type { Song } from "@/types";

export const revalidate = 0;

export default async function DashboardPage() {
  let songs: Song[] = [];
  let lessonsBySong: Record<string, string[]> = {};
  let dbAvailable = true;

  try {
    songs = await query<Song>("SELECT * FROM songs ORDER BY created_at DESC");
    const lessons = await query<{ id: string; song_id: string }>("SELECT id, song_id FROM lessons");
    // Pass lesson IDs per song to the client so it can compute completions from LocalStorage
    lessonsBySong = (lessons ?? []).reduce<Record<string, string[]>>((acc, l) => {
      acc[l.song_id] = acc[l.song_id] ?? [];
      acc[l.song_id].push(l.id);
      return acc;
    }, {});
  } catch {
    dbAvailable = false;
  }

  return (
    <div className="space-y-6">
      <SongGrid songs={songs} lessonsBySong={lessonsBySong} isAdmin={isAdmin} dbAvailable={dbAvailable} />
    </div>
  );
}
