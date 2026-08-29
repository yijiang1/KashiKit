import { redirect } from "next/navigation";
import { getSession, isSiteAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Song } from "@/types";
import LyricsEditor from "@/components/admin/LyricsEditor";

export const dynamic = "force-dynamic";

export default async function LyricsEditorPage() {
  const session = await getSession();
  const admin = isSiteAdmin(session);
  if (!session && !admin) redirect("/login?next=/admin/lyrics-editor");

  const songs = admin
    ? await query<Song>("SELECT * FROM songs ORDER BY title ASC")
    : await query<Song>("SELECT * FROM songs WHERE user_id = ? ORDER BY title ASC", [session!.uid]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Lyrics Editor</h1>
      {songs.length === 0 ? (
        <p className="text-sm text-gray-500">
          You haven&apos;t imported any songs yet. Use <strong>+ Import song</strong> to create one.
        </p>
      ) : (
        <LyricsEditor songs={songs} />
      )}
    </div>
  );
}
