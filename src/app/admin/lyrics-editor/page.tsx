import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import type { Song } from "@/types";
import LyricsEditor from "@/components/admin/LyricsEditor";

export default async function LyricsEditorPage() {
  if (!isAdmin) notFound();

  const songs = await query<Song>("SELECT * FROM songs ORDER BY title ASC");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Lyrics Editor</h1>
      <LyricsEditor songs={songs} />
    </div>
  );
}
