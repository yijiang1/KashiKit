import { query } from "@/lib/db";
import SongGrid from "@/components/dashboard/SongGrid";
import { getSession, isSiteAdmin } from "@/lib/auth";
import type { Song } from "@/types";

export const revalidate = 0;

export default async function DashboardPage() {
  let songs: Song[] = [];
  let lessonsBySong: Record<string, string[]> = {};
  let dbAvailable = true;

  const session = await getSession();

  try {
    songs = await query<Song>(
      `SELECT s.*, u.username AS owner_username
       FROM songs s
       LEFT JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC`
    );
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
      <SongGrid
        songs={songs}
        lessonsBySong={lessonsBySong}
        isAdmin={isSiteAdmin(session)}
        viewerId={session?.uid ?? null}
        dbAvailable={dbAvailable}
      />
    </div>
  );
}
