"use client";

import { useState, useEffect } from "react";
import type { Song } from "@/types";
import SongCard from "./SongCard";
import { getCompletedLessonIds } from "@/lib/progress";

interface Props {
  songs: Song[];
  lessonsBySong: Record<string, string[]>;
  isAdmin: boolean;
}

export default function SongGrid({ songs, lessonsBySong, isAdmin }: Props) {
  const [completedDaysBySong, setCompletedDaysBySong] = useState<Record<string, number>>({});

  useEffect(() => {
    const completedIds = getCompletedLessonIds();
    const result: Record<string, number> = {};
    for (const [songId, lessonIds] of Object.entries(lessonsBySong)) {
      result[songId] = lessonIds.filter((id) => completedIds.has(id)).length;
    }
    setCompletedDaysBySong(result);
  }, [lessonsBySong]);

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
        <SongCard
          key={song.id}
          song={song}
          completedDays={completedDaysBySong[song.id] ?? 0}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}
