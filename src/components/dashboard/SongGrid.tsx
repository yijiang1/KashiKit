import type { Song } from "@/types";
import SongCard from "./SongCard";

interface Props {
  songs: Song[];
  completedDaysBySong: Record<string, number>;
}

export default function SongGrid({ songs, completedDaysBySong }: Props) {
  if (songs.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-5xl mb-4">🎵</p>
        <p className="text-lg font-medium">No songs yet</p>
        <p className="text-sm mt-1">Import your first song to start learning</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {songs.map((song) => (
        <SongCard key={song.id} song={song} completedDays={completedDaysBySong[song.id] ?? 0} />
      ))}
    </div>
  );
}
