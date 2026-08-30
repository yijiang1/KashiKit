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
  const admin = isSiteAdmin(session);
  // Non-admins only ever see the songs they imported themselves; a fresh user
  // has an empty dashboard until they import. Admins see every song, including
  // legacy rows with user_id = NULL.
  const ownFilter = admin ? "" : "WHERE s.user_id = ?";
  const ownArgs = admin ? [] : [session?.uid ?? "__none__"];

  try {
    songs = await query<Song>(
      `SELECT s.*, u.username AS owner_username
       FROM songs s
       LEFT JOIN users u ON u.id = s.user_id
       ${ownFilter}
       ORDER BY s.created_at DESC`,
      ownArgs
    );
    const lessons = await query<{ id: string; song_id: string }>(
      admin
        ? "SELECT id, song_id FROM lessons"
        : "SELECT id, song_id FROM lessons WHERE song_id IN (SELECT id FROM songs WHERE user_id = ?)",
      ownArgs
    );
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
